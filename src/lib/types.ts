export type CreateSessionRequest = {
    pullRequestUrl: string;
    jiraKey?: string;
    prompt: string;
    model: string;
    ttlMinutes?: number;
    autoReviewFirstFile?: boolean;
};

export type ReviewStatus = "pending" | "running" | "done" | "done_with_warnings" | "failed" | "ignored";

export type SeveritySummary = { blocker: number; major: number; minor: number; nit: number };

export type ReviewDiagnosticsDto = {
    warnings: string[];
    contextRequests: string[];
    inputLimitTokens?: number;
    maxOutputTokens?: number;
    // optional, falls du es in der UI anzeigen willst:
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
    outputText: string;
    outputStructured: any;
    severitySummary: SeveritySummary;

    // NEW: diagnostics
    diagnostics: ReviewDiagnosticsDto;

    // optional: smart context info for UI
    fileContentMeta?: { attempted: boolean; fetched: boolean; reason: string; clamped?: boolean };
    testsMeta?: { attempted: boolean; fetchedCount: number; reason: string; usedIndex: boolean };

    // optional: only store paths to avoid session bloat
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

    // NEW: typed reviews
    reviews: Record<string, ReviewDto>;

    // optional: cache repo index presence (du musst nicht den Index im DTO mitschicken)
    hasRepoFileIndex?: boolean;
};

export type ReviewRequest = { sessionId: string; filePath: string };
export type MetaReviewRequest = { sessionId: string; deleteAfter?: boolean };