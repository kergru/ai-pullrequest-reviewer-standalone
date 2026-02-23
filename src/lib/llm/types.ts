
export type Mode = "responses" | "chat_completions";

export type RelatedTest = { path: string; content: string };

export type ApiUsage = {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    input_tokens_details?: any;
    output_tokens_details?: any;
};

export type ReviewDiagnosticData = {
    model: string;
    mode: Mode;
    durationMs: number;

    requestChars: { system: number; user: number; total: number };
    estimatedInputTokens: { system: number; user: number; total: number };

    inputLimitTokens: number;
    reservedOutputTokens: number;
    maxOutputTokens: number;

    usage?: ApiUsage;
    responseId?: string;
};

export type ReviewFileResult = {
    outputText: string;
    outputStructured: any;
    warnings: string[];
    inputLimitTokens: number;
    maxOutputTokens: number;
    diagnostics: ReviewDiagnosticData;
};

export type MetaReviewResult = {
    outputText: string;
    outputStructured: any;
    warnings: string[];
    inputLimitTokens: number;
    maxOutputTokens: number;
    diagnostics: ReviewDiagnosticData;
};
