export type CreateSessionRequest = {
    pullRequestUrl: string;
    jiraKey?: string;
    prompt: string;
    model: string;
    ttlMinutes?: number;
    autoReviewFirstFile?: boolean;
};

export type ReviewStatus = "pending" | "running" | "done" | "done_with_warnings" | "failed" | "ignored";

export type Severity = "blocker" | "major" | "minor" | "nit";

export type SeveritySummary = { blocker: number; major: number; minor: number; nit: number };

export type Category =
    | "Correctness"
    | "Security"
    | "Performance"
    | "Maintainability"
    | "Testability"
    | "Style";

export type ReviewDiagnosticsDto = {
    warnings: string[];
    contextRequests: string[];
    inputLimitTokens?: number;
    maxOutputTokens?: number;
    meta?: {
        model: string;
        mode: "responses" | "chat_completions";
        durationMs: number;
        requestChars: { system: number; user: number; total: number };
        estimatedInputTokens: { system: number; user: number; total: number };
        usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
        responseId?: string;
    };
};

export type ReviewDto = {
    filePath: string;
    status: ReviewStatus;
    outputMarkdown: string;
    outputStructured: any;
    severitySummary: SeveritySummary;
    diagnostics: ReviewDiagnosticsDto;
    fileContentMeta?: { attempted: boolean; fetched: boolean; reason: string; clamped?: boolean };
    testsMeta?: { attempted: boolean; fetchedCount: number; reason: string; usedIndex: boolean };
    relatedTests?: Array<{ path: string }>;
};

export type SessionDto = {
    sessionId: string;
    pr: { url: string; projectKey: string; repoSlug: string; prId: number; title: string; toCommit?: string; fromCommit?: string };
    jira: null | { key: string; summary: string; description: string; acceptanceCriteria: string };
    prompt: string;
    model: string;
    files: Array<{
        path: string;
        type: string;
        additions: number;
        deletions: number;
        priority: number;
        reviewStatus: ReviewStatus;
    }>;
    reviews: Record<string, ReviewDto>;
    hasRepoFileIndex?: boolean;
};

export type ReviewRequest = { sessionId: string; filePath: string };

export type MetaReviewRequest = { sessionId: string; deleteAfter?: boolean };
