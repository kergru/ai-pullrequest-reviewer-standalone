const baseUrl = (process.env.GITHUB_BASE_URL ?? "https://api.github.com").replace(/\/$/, "");
const authMode = (process.env.GITHUB_AUTH_MODE ?? "bearer").toLowerCase();

function authHeader(): string {
    const t = process.env.GITHUB_TOKEN ?? "";
    if (!t) throw new Error("Missing GITHUB_TOKEN");
    return authMode === "token" ? `token ${t}` : `Bearer ${t}`;
}

type HeadersDict = Record<string, string>;

async function reqRaw(path: string, headers?: HeadersDict) {
    const r = await fetch(`${baseUrl}${path}`, {
        headers: {
            Authorization: authHeader(),
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            ...(headers ?? {}),
        },
    });

    const text = await r.text();
    if (!r.ok) {
        const hint = text?.slice(0, 400) ?? "";
        throw new Error(`GitHub ${r.status}: ${hint}`);
    }

    return { status: r.status, headers: r.headers, text };
}

async function reqJson(path: string, headers?: HeadersDict) {
    const { text } = await reqRaw(path, headers);
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`GitHub returned non-JSON for ${path}: ${text.slice(0, 200)}`);
    }
}

async function reqText(path: string, headers?: HeadersDict) {
    const { text } = await reqRaw(path, headers);
    return text;
}

// -------- pagination (Link header) --------
function parseLinkHeader(link: string | null): Record<string, string> {
    // format: <url>; rel="next", <url>; rel="last"
    if (!link) return {};
    const out: Record<string, string> = {};
    for (const part of link.split(",")) {
        const m = part.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
        if (m) out[m[2]] = m[1];
    }
    return out;
}

function toApiPath(fullUrl: string): string {
    // convert absolute url to /path?query relative to baseUrl
    if (fullUrl.startsWith(baseUrl)) return fullUrl.slice(baseUrl.length);
    // If GitHub returns a different host, still try to use as-is relative
    const u = new URL(fullUrl);
    return `${u.pathname}${u.search}`;
}

// -------- Types / URL parsing --------
export type GhPrRef = {
    owner: string;
    repo: string;
    prNumber: number;
    url: string;
    title: string;
    baseSha: string; // "toCommit"
    headSha: string; // "fromCommit"
};

export function parseGitHubPrUrl(prUrl: string): { owner: string; repo: string; prNumber: number } {
    // Supports:
    // - https://github.com/{owner}/{repo}/pull/{number}
    // - https://github.{enterprise}/{owner}/{repo}/pull/{number}
    // - ... optional extra segments, query, etc.
    const u = new URL(prUrl);
    const parts = u.pathname.split("/").filter(Boolean);

    const owner = parts[0];
    const repo = parts[1];
    const pullIdx = parts.findIndex((p) => p.toLowerCase() === "pull" || p.toLowerCase() === "pulls");

    if (!owner || !repo || pullIdx < 0) throw new Error("Invalid GitHub PR URL");
    const prNumber = Number(parts[pullIdx + 1]);
    if (!Number.isFinite(prNumber)) throw new Error("Invalid GitHub PR number");

    return { owner, repo, prNumber };
}

export async function getPullRequest(prUrl: string): Promise<GhPrRef> {
    const { owner, repo, prNumber } = parseGitHubPrUrl(prUrl);

    const pr = await reqJson(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${encodeURIComponent(prNumber)}`);

    return {
        owner,
        repo,
        prNumber,
        url: prUrl,
        title: pr?.title ?? "",
        baseSha: pr?.base?.sha, // target branch commit sha
        headSha: pr?.head?.sha, // source branch commit sha
    };
}

// -------- PR files / diff --------
export async function getChanges(pr: GhPrRef): Promise<Array<{ path: string; type?: string }>> {
    // GET /repos/{owner}/{repo}/pulls/{pull_number}/files (paginated)
    const out: Array<{ path: string; type?: string }> = [];
    let apiPath = `/repos/${encodeURIComponent(pr.owner)}/${encodeURIComponent(pr.repo)}/pulls/${encodeURIComponent(pr.prNumber)}/files?per_page=100`;

    while (apiPath) {
        const raw = await reqRaw(apiPath, {
            Accept: "application/vnd.github+json",
        });

        const data = raw.text ? JSON.parse(raw.text) : [];
        for (const f of Array.isArray(data) ? data : []) {
            // status: added|modified|removed|renamed|...
            const filename = String(f?.filename ?? "");
            if (filename) out.push({ path: filename.replaceAll("\\", "/"), type: f?.status });
        }

        const links = parseLinkHeader(raw.headers.get("link"));
        apiPath = links.next ? toApiPath(links.next) : "";
    }

    return out;
}

export async function getDiff(pr: GhPrRef): Promise<string> {
    // GitHub: set Accept to diff media type
    return reqText(
        `/repos/${encodeURIComponent(pr.owner)}/${encodeURIComponent(pr.repo)}/pulls/${encodeURIComponent(pr.prNumber)}`,
        { Accept: "application/vnd.github.v3.diff" }
    );
}

// -------- File content at commit/ref --------
export async function getFileContentAtCommit(
    pr: GhPrRef,
    filePath: string,
    commitOrRef: string
): Promise<string> {
    const safePath = String(filePath ?? "")
        .replace(/^\/+/, "")
        .replace(/\\/g, "/")
        .split("/")
        .map(encodeURIComponent)
        .join("/");

    // contents API can return JSON unless we ask for raw
    return reqText(
        `/repos/${encodeURIComponent(pr.owner)}/${encodeURIComponent(pr.repo)}/contents/${safePath}?ref=${encodeURIComponent(commitOrRef)}`,
        { Accept: "application/vnd.github.v3.raw" }
    );
}

// -------- List files at commit/ref (Tree API) --------
export async function listFilesAtCommit(pr: GhPrRef, commitOrRef: string): Promise<string[]> {
    // Resolve commitOrRef -> commit sha (if it's a branch/tag)
    // GET /repos/{owner}/{repo}/commits/{ref}
    const commit = await reqJson(
        `/repos/${encodeURIComponent(pr.owner)}/${encodeURIComponent(pr.repo)}/commits/${encodeURIComponent(commitOrRef)}`
    );
    const treeSha = commit?.commit?.tree?.sha ?? commit?.tree?.sha;
    if (!treeSha) return [];

    // GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1
    const tree = await reqJson(
        `/repos/${encodeURIComponent(pr.owner)}/${encodeURIComponent(pr.repo)}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`
    );

    const items = Array.isArray(tree?.tree) ? tree.tree : [];
    const files = items
        .filter((x: any) => x?.type === "blob" && typeof x?.path === "string")
        .map((x: any) => String(x.path).replaceAll("\\", "/"));

    return Array.from(new Set(files));
}
