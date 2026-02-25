import type {Category, ReviewStatus, Severity, SeveritySummary} from "@/lib/types";
import type { DiagnosticDataLLM } from "@/lib/llm/types";

export type PreparedFileReviewContext = {
    filePath: string;

    systemPrompt: string;
    userPrompt: string;

    warnings: string[];

    inputLimitTokens: number;
    reservedOutputTokens: number;
    maxOutputTokens: number;

    meta: FileReviewMeta;
};

export type PreparedMetaReviewContext = {
    model: string;

    systemPrompt: string;
    userPrompt: string;

    warnings: string[];

    inputLimitTokens: number;
    reservedOutputTokens: number;
    maxOutputTokens: number;
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

export type ReviewStructuredOutput = {
    filePath: string;
    findings: ReviewFinding[];
    summary: SeveritySummary;
    missingContext: string[];
};

export type FileReviewFindingsMeta = {
    countFileReviews: number;
    countFindings: number;
}

export type FileReviewMeta = {
    headSha: string | null;
    loadedContext: { tests: number; sources: number; liquibase: number; fileContent: boolean };
    warnings: string[];
};

export type FileReviewResult = {
    filePath: string;
    status: ReviewStatus;
    outputMarkdown: string;
    outputStructured: ReviewStructuredOutput | null;
    severitySummary: SeveritySummary;
    diagnostics?: DiagnosticDataLLM;
    meta?: FileReviewMeta;
};

export type MetatReviewMeta = {
    loadedContext: {countFileReviews: number, countFindings: number }
    warnings: string[];
};

export type MetaReviewResult = {
    outputMarkdown: string;
    diagnostics?: DiagnosticDataLLM;
    meta?:MetatReviewMeta;
};

export type TextRef = {
    path: string;
    content: string;
};

export type ChangedFile = {
    path: string;
    diffText?: string;
    contentAtHead?: string;
};

export type ContextBundle = {
    relatedTests: TextRef[];
    relatedSources: TextRef[];
    relatedLiquibase: TextRef[];
};
