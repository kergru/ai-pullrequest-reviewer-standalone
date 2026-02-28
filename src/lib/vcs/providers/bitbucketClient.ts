import type {VcsClient, VcsPrRef, VcsConfig, Change, BitbucketPrNativeRef} from "../index";
import {
    parseBbsPrUrl,
    getPullRequest as bbsGetPullRequest,
    getChanges as bbsGetChanges,
    getDiff as bbsGetDiff,
    getFileContentAtCommitWithFallback as bbsgetFileContentAtCommitWithFallback,
    listFilesAtCommit as bbsListFilesAtCommit,
    listFilesInDirAtCommit as bbsListFilesInDirAtCommit,
    getJiraIssueForPrById as bbsGetJiraIssuesForPrById,
} from "./bitbucket";

export function createBitbucketClient(cfg: Extract<VcsConfig, { provider: "bitbucket" }>): VcsClient<BitbucketPrNativeRef> {
    process.env.BITBUCKET_BASE_URL = cfg.baseUrl;
    process.env.BITBUCKET_AUTH_MODE = cfg.authMode ?? "bearer";
    if ((cfg.authMode ?? "bearer") === "basic") {
        process.env.BITBUCKET_USERNAME = cfg.username ?? "";
        process.env.BITBUCKET_PASSWORD = cfg.password ?? "";
    } else {
        process.env.BITBUCKET_TOKEN = cfg.token ?? "";
    }

    return {
        provider: "bitbucket",

        parsePrUrl(prUrl: string): BitbucketPrNativeRef {
            return parseBbsPrUrl(prUrl);
        },

        async getPullRequest(prUrl: string): Promise<VcsPrRef<BitbucketPrNativeRef>> {
            const pr = await bbsGetPullRequest(prUrl); // BbsPrRef
            const { projectKey, repoSlug, prId } = parseBbsPrUrl(prUrl);
            const host = new URL(prUrl).host;

            return {
                url: prUrl,
                title: pr.title,
                displayTitle: `${pr.title} (${projectKey}/${repoSlug} #${prId})`,
                baseSha: pr.toCommit,
                headSha: pr.fromCommit,
                repo: { host, ownerOrProject: projectKey, nameOrSlug: repoSlug },
                nativeRef: { projectKey, repoSlug, prId },
            };
        },

        async getChanges(pr: VcsPrRef<BitbucketPrNativeRef>): Promise<Change[]> {
            const { projectKey, repoSlug, prId } = pr.nativeRef;
            const bbsPr = {
                projectKey,
                repoSlug,
                prId,
                url: pr.url,
                title: pr.title,
                toCommit: pr.baseSha,
                fromCommit: pr.headSha,
            };
            return bbsGetChanges(bbsPr);
        },

        async getDiff(pr: VcsPrRef<BitbucketPrNativeRef>): Promise<string> {
            const { projectKey, repoSlug, prId } = pr.nativeRef;
            const bbsPr = {
                projectKey,
                repoSlug,
                prId,
                url: pr.url,
                title: pr.title,
                toCommit: pr.baseSha,
                fromCommit: pr.headSha,
            };
            return bbsGetDiff(bbsPr);
        },

        async getFileContentAtCommit(pr: VcsPrRef<BitbucketPrNativeRef>, filePath: string, commitOrRef: string): Promise<string> {
            const { projectKey, repoSlug, prId } = pr.nativeRef;
            const bbsPr = {
                projectKey,
                repoSlug,
                prId,
                url: pr.url,
                title: pr.title,
                toCommit: pr.baseSha,
                fromCommit: pr.headSha,
            };
            return bbsgetFileContentAtCommitWithFallback(bbsPr, filePath, commitOrRef);
        },

        async listFilesAtCommit(pr: VcsPrRef<BitbucketPrNativeRef>, commitOrRef: string): Promise<string[]> {
            const { projectKey, repoSlug, prId } = pr.nativeRef;
            const bbsPr = {
                projectKey,
                repoSlug,
                prId,
                url: pr.url,
                title: pr.title,
                toCommit: pr.baseSha,
                fromCommit: pr.headSha,
            };
            return bbsListFilesAtCommit(bbsPr, commitOrRef);
        },

        async listFilesInDirAtCommit(pr: VcsPrRef<BitbucketPrNativeRef>, commitOrRef: string, dir: string): Promise<string[]> {
            const { projectKey, repoSlug, prId } = pr.nativeRef;
            const bbsPr = {
                projectKey,
                repoSlug,
                prId,
                url: pr.url,
                title: pr.title,
                toCommit: pr.baseSha,
                fromCommit: pr.headSha,
            };
            return bbsListFilesInDirAtCommit(bbsPr, commitOrRef, dir);
        },

        async getJiraIssueForPr(pr: VcsPrRef<BitbucketPrNativeRef>): Promise<string | null> {
            const { projectKey, repoSlug, prId } = pr.nativeRef;

            if (!projectKey || !repoSlug || prId === undefined) return null;

            return await bbsGetJiraIssuesForPrById({ projectKey, repoSlug, prId });
        },
    };
}
