import type { VcsClient, VcsConfig, Change, VcsPrRef, GitHubPrNativeRef } from "../index";
import {
    parseGitHubPrUrl,
    getPullRequest as ghGetPullRequest,
    getChanges as ghGetChanges,
    getDiff as ghGetDiff,
    getFileContentAtCommit as ghGetFileContentAtCommit,
    listFilesAtCommit as ghListFilesAtCommit,
} from "./github";

export function createGitHubClient(cfg: Extract<VcsConfig, { provider: "github" }>): VcsClient<GitHubPrNativeRef> {
    process.env.GITHUB_BASE_URL = cfg.baseUrl ?? "https://api.github.com";
    process.env.GITHUB_AUTH_MODE = cfg.authMode ?? "bearer";
    process.env.GITHUB_TOKEN = cfg.token;

    return {
        provider: "github",

        parsePrUrl(prUrl: string): GitHubPrNativeRef  {
            const { owner, repo, prNumber } = parseGitHubPrUrl(prUrl);
            return { owner, repo, prNumber };
        },

        async getPullRequest(prUrl: string): Promise<VcsPrRef<GitHubPrNativeRef>> {
            const pr = await ghGetPullRequest(prUrl); // liefert GhPrRef aus deinem Modul
            const { owner, repo, prNumber } = parseGitHubPrUrl(prUrl);
            const host = new URL(prUrl).host;

            return {
                url: prUrl,
                title: pr.title,
                displayTitle: `${pr.title} (${owner}/${repo} #${prNumber})`,
                baseSha: pr.baseSha,
                headSha: pr.headSha,
                repo: { host, ownerOrProject: owner, nameOrSlug: repo },
                nativeRef: { owner, repo, prNumber },
            };
        },

        async getChanges(pr: VcsPrRef<GitHubPrNativeRef>): Promise<Change[]> {
            const { owner, repo, prNumber } = pr.nativeRef;
            return ghGetChanges({
                owner,
                repo,
                prNumber,
                url: pr.url,
                title: pr.title,
                baseSha: pr.baseSha,
                headSha: pr.headSha,
            });
        },

        async getDiff(pr: VcsPrRef<GitHubPrNativeRef>): Promise<string> {
            const { owner, repo, prNumber } = pr.nativeRef;
            return ghGetDiff({
                owner,
                repo,
                prNumber,
                url: pr.url,
                title: pr.title,
                baseSha: pr.baseSha,
                headSha: pr.headSha,
            });
        },

        async getFileContentAtCommit(pr: VcsPrRef<GitHubPrNativeRef>, filePath: string, commitOrRef: string): Promise<string> {
            const { owner, repo, prNumber } = pr.nativeRef;
            const ghPr = {
                owner,
                repo,
                prNumber,
                url: pr.url,
                title: pr.title,
                baseSha: pr.baseSha,
                headSha: pr.headSha,
            };
            return ghGetFileContentAtCommit(ghPr, filePath, commitOrRef);
        },

        async listFilesAtCommit(pr: VcsPrRef<GitHubPrNativeRef>, commitOrRef: string): Promise<string[]> {
            const { owner, repo, prNumber } = pr.nativeRef;
            const ghPr = {
                owner,
                repo,
                prNumber,
                url: pr.url,
                title: pr.title,
                baseSha: pr.baseSha,
                headSha: pr.headSha,
            };
            return ghListFilesAtCommit(ghPr, commitOrRef);
        },

        async listFilesInDirAtCommit(pr: VcsPrRef<GitHubPrNativeRef>, commitOrRef: string, dir: string): Promise<string[]> {
            const { owner, repo, prNumber } = pr.nativeRef;
            const ghPr = {
                owner,
                repo,
                prNumber,
                url: pr.url,
                title: pr.title,
                baseSha: pr.baseSha,
                headSha: pr.headSha,
            };
            return [];
        },

        async getJiraIssueForPr(pr: VcsPrRef<GitHubPrNativeRef>): Promise<string | null> {
            const s = String(pr?.title ?? "");
            const matches = s.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? [];
            const issues = Array.from(new Set(matches));
            return issues.length > 0 ? issues[0] : null;
        }
    };
}
