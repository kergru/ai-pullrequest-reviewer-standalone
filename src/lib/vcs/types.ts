export type VcsProvider = "bitbucket" | "github";

export type VcsConfig =
    | {
    provider: "github";
    baseUrl?: string;
    authMode?: "bearer" | "token";
    token: string;
}
    | {
    provider: "bitbucket";
    baseUrl: string;
    authMode?: "bearer" | "basic";
    token?: string;
    username?: string;
    password?: string;
};

export type VcsPrRef<TNative = unknown> = {
    url: string;
    title: string;
    displayTitle: string;
    baseSha: string;
    headSha: string;
    repo: {
        host: string;
        ownerOrProject: string;
        nameOrSlug: string;
    };
    nativeRef: TNative;
};

export type GitHubPrNativeRef = { owner: string; repo: string; prNumber: number };
export type BitbucketPrNativeRef = { projectKey: string; repoSlug: string; prId: number };
export type AnyPrNativeRef = GitHubPrNativeRef | BitbucketPrNativeRef;

export type Change = { path: string; type?: string };
export type RelatedTest = { path: string; content: string };


// VCS-Client Interface, generic with provider-specific native PR-Ref (GitHubPrNativeRef or BitbucketPrNativeRef)
export interface VcsClient<TNative = unknown> {
    readonly provider: VcsProvider;

    parsePrUrl(prUrl: string): TNative;
    getPullRequest(prUrl: string): Promise<VcsPrRef<TNative>>;

    getChanges(pr: VcsPrRef<TNative>): Promise<Change[]>;
    getDiff(pr: VcsPrRef<TNative>): Promise<string>;

    getFileContentAtCommit(pr: VcsPrRef<TNative>, filePath: string, commitOrRef: string): Promise<string>;
    listFilesAtCommit(pr: VcsPrRef<TNative>, commitOrRef: string): Promise<string[]>;
    listFilesInDirAtCommit(pr: VcsPrRef<TNative>, commitOrRef: string, dir: string): Promise<string[]>;

    getJiraIssueForPr?(pr: VcsPrRef<TNative>): Promise<string | null>;
}
