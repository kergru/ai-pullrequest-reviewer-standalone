import type { VcsPrRef } from "@/lib/vcs";

export type SessionLike = {
    model: string;
    prompt: string;
    jira?: any;
    pr: VcsPrRef;
    files: Array<{ path: string; reviewStatus?: string }>;
    inFlight: boolean;
    reviews: Record<string, any>;
    repoFileIndex?: string[];
};

export type ReviewStatus = "pending" | "running" | "done" | "done_with_warnings" | "failed";

export type Severity = "blocker" | "major" | "minor" | "nit";
export type SeveritySummary = Record<Severity, number>;

export type Finding = {
    severity: Severity;
    message: string;
    rule?: string;
    filePath?: string;
    line?: number;
};

export type StructuredReview = {
    findings?: Finding[];
    missingContext?: string[];
};

export type PreparedFileReviewContext = {
    filePath: string;
    systemPrompt: string;
    userPrompt: string;
    warnings: string[];
    inputLimitTokens: number;
    reservedOutputTokens: number;
    maxOutputTokens: number;
    meta: {
        headSha?: string;
        fileContent: { attempted: boolean; fetched: boolean; reason: string; clamped?: boolean };
        tests: { attempted: boolean; fetchedCount: number; reason: string; usedIndex: boolean };
        liquibase?: {
            detected: boolean;
            changedFilesCount: number;
        };
    };
};

export type FileReviewResult = {
    filePath: string;
    severitySummary: any;
    outputStructured: any;
    outputText?: string;
};

export type FileReviewResults = FileReviewResult[];

export type PreparedMetaReviewContext = {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    warnings: string[];
    inputLimitTokens: number;
    reservedOutputTokens: number;
    maxOutputTokens: number;
};
