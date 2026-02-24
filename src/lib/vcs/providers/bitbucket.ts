const baseUrl = (process.env.BITBUCKET_BASE_URL ?? "").replace(/\/$/, "");
const authMode = (process.env.BITBUCKET_AUTH_MODE ?? "bearer").toLowerCase();
const API_LATEST = "/rest/api/latest";

function authHeader(): string {
    if (authMode === "basic") {
        const u = process.env.BITBUCKET_USERNAME ?? "";
        const p = process.env.BITBUCKET_PASSWORD ?? "";
        return `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;
    }
    const t = process.env.BITBUCKET_TOKEN ?? "";
    return `Bearer ${t}`;
}

function normalizePath(p: string) {
    return p.replaceAll("\\", "/").replace(/^\/+/, "");
}

function encodePathPreserveSlashes(p: string) {
    const n = normalizePath(p);
    return n.split("/").map(encodeURIComponent).join("/");
}

async function reqJson(path: string) {
    const r = await fetch(`${baseUrl}${path}`, {
        headers: { Authorization: authHeader(), Accept: "application/json" },
    });

    if (!r.ok) {
        const err: any = new Error(`BBS ${r.status}: ${await r.text()}`);
        err.status = r.status;
        err.url = `${baseUrl}${path}`;
        throw err;
    }

    const text = await r.text();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        const err: any = new Error(`BBS returned non-JSON for ${path}: ${text.slice(0, 200)}`);
        err.status = 200;
        err.url = `${baseUrl}${path}`;
        throw err;
    }
}

async function reqText(path: string, accept?: string) {
    const r = await fetch(`${baseUrl}${path}`, {
        headers: {
            Authorization: authHeader(),
            Accept: accept ?? "text/plain",
        },
    });

    if (!r.ok) {
        const err: any = new Error(`BBS ${r.status}: ${await r.text()}`);
        err.status = r.status;
        err.url = `${baseUrl}${path}`;
        throw err;
    }

    return r.text();
}

const apiJson = (p: string) => reqJson(`${API_LATEST}${p}`);
const apiText = (p: string, accept?: string) => reqText(`${API_LATEST}${p}`, accept);

export type BbsPrRef = {
    projectKey: string;
    repoSlug: string;
    prId: number;
    url: string;
    title: string;
    toCommit: string;
    fromCommit: string;
};

export function parseBbsPrUrl(prUrl: string): { projectKey: string; repoSlug: string; prId: number } {
    const u = new URL(prUrl);
    const parts = u.pathname.split("/").filter(Boolean);

    const projIdx = parts.findIndex((p) => p.toLowerCase() === "projects");
    const reposIdx = parts.findIndex((p) => p.toLowerCase() === "repos");
    const prIdx = parts.findIndex((p) => p.toLowerCase() === "pull-requests");

    if (projIdx < 0 || reposIdx < 0 || prIdx < 0) {
        throw new Error("Invalid Bitbucket Server PR URL");
    }

    const projectKey = parts[projIdx + 1];
    const repoSlug = parts[reposIdx + 1];
    const prId = Number(parts[prIdx + 1]);

    if (!projectKey || !repoSlug || !Number.isFinite(prId)) {
        throw new Error("Invalid PR URL components");
    }

    return { projectKey, repoSlug, prId };
}

export async function getPullRequest(prUrl: string): Promise<BbsPrRef> {
    const { projectKey, repoSlug, prId } = parseBbsPrUrl(prUrl);

    const pr = await apiJson(
        `/projects/${encodeURIComponent(projectKey)}/repos/${encodeURIComponent(repoSlug)}/pull-requests/${encodeURIComponent(prId)}`
    );

    return {
        projectKey,
        repoSlug,
        prId,
        url: prUrl,
        title: pr?.title ?? "",
        toCommit: pr?.toRef?.latestCommit,
        fromCommit: pr?.fromRef?.latestCommit,
    };
}

function asPathString(p: any): string {
    if (!p) return "";
    if (typeof p === "string") return p;
    if (typeof p.toString === "string") return p.toString;
    if (typeof p.toString === "function") {
        const s = p.toString();
        if (typeof s === "string" && s) return s;
    }
    if (typeof p.name === "string" && p.name) return p.name;
    if (Array.isArray(p.components)) return p.components.filter((x: any) => typeof x === "string").join("/");
    return "";
}

export async function getChanges(pr: BbsPrRef): Promise<Array<{ path: string; type?: string }>> {
    const data = await apiJson(
        `/projects/${encodeURIComponent(pr.projectKey)}/repos/${encodeURIComponent(pr.repoSlug)}/pull-requests/${encodeURIComponent(pr.prId)}/changes?limit=1000`
    );

    let values: unknown[] = [];

    if (data && typeof data === "object") {
        const maybe = data as { values?: unknown[] };
        if (Array.isArray(maybe.values)) values = maybe.values;
    }

    if (values.length === 0 && Array.isArray(data)) values = data;

    return values
        .map((v) => {
            const obj = v as Record<string, unknown> | null;

            const pathStr =
                asPathString(obj?.["path"]) ||
                asPathString(obj?.["srcPath"]) ||
                asPathString(obj?.["toPath"]) ||
                asPathString(obj?.["file"]) ||
                asPathString(obj?.["filePath"]);

            return { path: pathStr, type: obj?.["type"] as string | undefined };
        })
        .filter((x) => !!x.path);
}

export async function getDiff(pr: BbsPrRef): Promise<string> {
    return apiText(
        `/projects/${encodeURIComponent(pr.projectKey)}/repos/${encodeURIComponent(pr.repoSlug)}/pull-requests/${encodeURIComponent(pr.prId)}/diff?contextLines=3`
    );
}

async function getFileContentAtCommit(
    pr: BbsPrRef,
    filePath: string,
    commitOrRef: string
): Promise<string> {
    const filePathEnc = encodePathPreserveSlashes(filePath);

    return apiText(
        `/projects/${encodeURIComponent(pr.projectKey)}` +
        `/repos/${encodeURIComponent(pr.repoSlug)}` +
        `/raw/${filePathEnc}?at=${encodeURIComponent(commitOrRef)}`,
        "text/plain, */*;q=0.8"
    );
}

export async function listFilesInDirAtCommit(
    pr: BbsPrRef,
    commitOrRef: string,
    dir: string
): Promise<string[]> {
    const dirPath = encodePathPreserveSlashes(dir);
    const data = await apiJson(
        `/projects/${encodeURIComponent(pr.projectKey)}` +
        `/repos/${encodeURIComponent(pr.repoSlug)}` +
        `/files/${dirPath}?at=${encodeURIComponent(commitOrRef)}&limit=100`
    );

    const page = extractFilesPage(data);
    return (page.values ?? []).map((p: string) => p.replaceAll("\\", "/"));
}

export async function getFileContentAtCommitWithFallback(
    pr: BbsPrRef,
    filePath: string,
    commitOrRef: string
): Promise<string> {
    try {
        return await getFileContentAtCommit(pr, filePath, commitOrRef);
    } catch (e: any) {
        const status = e?.status;

        // ✅ Fallback NUR wenn es wirklich "not found" ist
        if (status !== 404) throw e;

        const head = pr.fromCommit;
        if (head && head !== commitOrRef) {
            return await getFileContentAtCommit(pr, filePath, head);
        }

        throw e;
    }
}

export async function listFilesAtCommit(pr: BbsPrRef, commitOrRef: string): Promise<string[]> {
    const out: string[] = [];
    let start = 0;

    while (true) {
        const data = await apiJson(
            `/projects/${encodeURIComponent(pr.projectKey)}/repos/${encodeURIComponent(pr.repoSlug)}/files?at=${encodeURIComponent(commitOrRef)}&start=${start}&limit=1000`
        );

        const page = extractFilesPage(data);
        if (page.values.length) out.push(...page.values);

        if (page.isLastPage) break;
        if (!Number.isFinite(page.nextPageStart ?? NaN)) break;

        start = page.nextPageStart!;
    }

    return Array.from(new Set(out.map((p) => p.replaceAll("\\", "/"))));
}

export async function getJiraIssueForPrById(input: {
    projectKey: string;
    repoSlug: string;
    prId: number;
}) {
    const dataRaw = await reqJson(
        `/rest/jira/1.0/projects/${encodeURIComponent(input.projectKey)}/repos/${encodeURIComponent(input.repoSlug)}/pull-requests/${encodeURIComponent(input.prId)}/issues`
    );

    let issues: unknown[] = [];

    if (Array.isArray(dataRaw)) issues = dataRaw;
    else if (dataRaw && typeof dataRaw === "object") {
        const d = dataRaw as { issues?: unknown[]; values?: unknown[] };
        if (Array.isArray(d.issues)) issues = d.issues;
        else if (Array.isArray(d.values)) issues = d.values;
    }

    for (const v of issues) {
        if (v && typeof v === "object" && "key" in v) {
            const key = (v as { key: unknown }).key;
            if (key) return String(key);
        }
    }

    return null;
}

function extractFilesPage(data: unknown): {
    values: string[];
    isLastPage: boolean;
    nextPageStart?: number;
} {
    const result = { values: [] as string[], isLastPage: true, nextPageStart: undefined as number | undefined };

    if (Array.isArray(data)) {
        result.values = data.map(String);
        return result;
    }

    if (data && typeof data === "object") {
        const d = data as Record<string, unknown>;

        if (Array.isArray(d["values"])) result.values = d["values"].map(String);
        result.isLastPage = Boolean(d["isLastPage"]);

        if (typeof d["nextPageStart"] === "number") {
            result.nextPageStart = d["nextPageStart"];
        }
    }

    return result;
}
