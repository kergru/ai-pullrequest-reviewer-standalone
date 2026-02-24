
export type Mode = "responses" | "chat_completions";

export type ApiUsage = {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    input_tokens_details?: any;
    output_tokens_details?: any;
};

export type ReviewResultLLM = {
    outputMarkdown: string,
    outputJson: string | null,
    diagnostics: DiagnosticDataLLM,
}

export type DiagnosticDataLLM = {
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
