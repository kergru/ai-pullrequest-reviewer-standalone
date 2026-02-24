import {ApiUsage, DiagnosticDataLLM, Mode} from "./types";

const CHARS_PER_TOKEN = 4;

export function buildDiagnostics(input: {
    model: string;
    mode: Mode;
    durationMs: number;
    systemText: string;
    userText: string;
    inputLimitTokens: number;
    reservedOutputTokens: number;
    maxOutputTokens: number;
    usage?: ApiUsage;
    responseId?: string;
}): DiagnosticDataLLM {
    const systemChars = input.systemText.length;
    const userChars = input.userText.length;
    const systemTokensEst = estimateTokens(input.systemText);
    const userTokensEst = estimateTokens(input.userText);

    return {
        model: input.model,
        mode: input.mode,
        durationMs: input.durationMs,
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
