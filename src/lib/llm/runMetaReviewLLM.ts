
import { buildDiagnostics } from "./review-diagnostic-data";
import { llmRequest } from "./client";
import type { ReviewResultLLM } from "./types";

export async function runMetaReviewLLM(input: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    inputLimitTokens: number;
    reservedOutputTokens: number;
    maxOutputTokens: number;
}): Promise<ReviewResultLLM> {
    const call = await llmRequest({
        model: input.model,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        temperature: 0.1,
        maxOutputTokens: input.maxOutputTokens,
    });

    const outputMarkdown = call.text;

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
        outputMarkdown,
        outputStructured: null, // no structured output for meta review
        diagnostics,
    };
}