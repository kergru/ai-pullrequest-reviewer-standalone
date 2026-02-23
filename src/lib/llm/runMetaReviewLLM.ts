import { llmRequest } from "./client";
import type { MetaReviewResult } from "./types";
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

export async function runMetaReviewLLM(input: {
    model: string;
    systemPrompt: string;
    userPrompt: string;

    warnings: string[];
    inputLimitTokens: number;

    reservedOutputTokens: number;
    maxOutputTokens: number;
}): Promise<MetaReviewResult> {
    const call = await llmRequest({
        model: input.model,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        temperature: 0.1,
        maxOutputTokens: input.maxOutputTokens,
    });

    const outputText = call.text;
    const outputStructured = extractJsonBlock(outputText) ?? {};

    const diagnostics = buildDiagnostics({
        model: input.model,
        mode: call.mode,
        durationMs: call.durationMs,
        systemText: input.systemPrompt,
        userText: input.userPrompt,
        inputLimitTokens: input.inputLimitTokens,
        reservedOutputTokens: input.reservedOutputTokens,
        maxOutputTokens: input.maxOutputTokens,
        usage: call.usage,
        responseId: call.responseId,
    });

    return {
        outputText,
        outputStructured,
        warnings: input.warnings ?? [],
        inputLimitTokens: input.inputLimitTokens,
        maxOutputTokens: input.maxOutputTokens,
        diagnostics,
    };
}