import type { DiagnosticDataLLM } from "@/lib/llm";

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
export type FileReviewResult = {
    filePath: string;
    status: ReviewStatus;
    //human readable
    outputMarkdown: string;
    //machine readable
    outputStructured: ReviewStructuredOutput | null;
    severitySummary: SeveritySummary;
    diagnostics?: DiagnosticDataLLM;
    meta?: FileReviewMeta;
};

export type FileReviewMeta = {
    loadedContext: { tests: number; sources: number; liquibase: number; fileContent: boolean };
    warnings: string[];
};

export type ReviewStructuredOutput = {
    filePath: string;
    findings: ReviewFinding[];
    summary: SeveritySummary;
    missingContext: string[];
};

export type ReviewFinding = {
    id: string;
    severity: Severity;
    category: Category;
    lineStart: number | null;
    lineEnd: number | null;
    title: string;
    problem: string;
    impact: string;
    recommendation: string;
};

export type MetaReviewResult = {
    outputMarkdown: string;
    diagnostics?: DiagnosticDataLLM;
    meta?:MetaReviewMeta;
};

export type MetaReviewMeta = {
    loadedContext: {countFileReviews: number, countFindings: number }
    warnings: string[];
};

