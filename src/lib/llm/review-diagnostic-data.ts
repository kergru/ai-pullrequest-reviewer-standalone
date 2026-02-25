import type { ApiUsage, DiagnosticDataLLM, Mode } from "./types";

const CHARS_PER_TOKEN = 4;

export function buildDiagnostics(input: {
    model: string;
    mode: Mode;
    durationMs: number;
    systemPrompt: string;
    userPrompt: string;
    inputLimitTokens: number;
    reservedOutputTokens: number;
    maxOutputTokens: number;
    usage?: ApiUsage;
    responseId?: string;
}): DiagnosticDataLLM {
    const systemChars = input.systemPrompt.length;
    const userChars = input.userPrompt.length;
    const systemTokensEst = estimateTokens(input.systemPrompt);
    const userTokensEst = estimateTokens(input.userPrompt);

    return {
        model: input.model,
        mode: input.mode,
        durationMs: input.durationMs,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        requestChars: { system: systemChars, user: userChars, total: systemChars + userChars },
        estimatedInputTokens: {
            system: systemTokensEst,
            user: userTokensEst,
            total: systemTokensEst + userTokensEst,
        },
        inputLimitTokens: input.inputLimitTokens,
        reservedOutputTokens: input.reservedOutputTokens,
        maxOutputTokens: input.maxOutputTokens,
        usage: input.usage,
        responseId: input.responseId,
    };
}

function estimateTokens(text: string): number {
    return Math.ceil(String(text ?? "").length / CHARS_PER_TOKEN);
}
