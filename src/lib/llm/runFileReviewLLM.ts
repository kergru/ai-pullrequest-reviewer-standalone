import { llmRequest } from "./client";
import type { ReviewFileResult } from "./types";
import { buildDiagnostics } from "./review-diagnostic-data";

function extractJsonBlock(text: string): any | null {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (!match) return null;
    try {
        return JSON.parse(match[1]);
    } catch {
        return null;
    }
}

export async function runFileReviewLLM(input: {
    model: string;
    system: string;
    user: string;
    inputLimitTokens: number;
    reservedOutputTokens: number;
    maxOutputTokens: number;
}): Promise<ReviewFileResult> {
    const call = await llmRequest({
        model: input.model,
        systemPrompt: input.system,
        userPrompt: input.user,
        temperature: 0.1,
        maxOutputTokens: input.maxOutputTokens,
    });

    const outputText = call.text;
    const outputStructured = extractJsonBlock(outputText) ?? {};

    const diagnostics = buildDiagnostics({
        model: input.model,
        mode: call.mode,
        durationMs: call.durationMs,
        systemText: input.system,
        userText: input.user,
        inputLimitTokens: input.inputLimitTokens,
        reservedOutputTokens: input.reservedOutputTokens,
        maxOutputTokens: input.maxOutputTokens,
        usage: call.usage,
        responseId: call.responseId,
    });

    return {
        outputText,
        outputStructured,
        warnings: [],
        inputLimitTokens: input.inputLimitTokens,
        maxOutputTokens: input.maxOutputTokens,
        diagnostics,
    };
}