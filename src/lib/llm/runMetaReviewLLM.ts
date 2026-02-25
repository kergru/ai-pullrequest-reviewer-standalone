
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

    console.log("########### SYSTEM PROMPT:\n:", input.systemPrompt);
    console.log("\n\n########### USER PROMPT:\n", input.userPrompt);

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
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        inputLimitTokens: input.inputLimitTokens,
        reservedOutputTokens: input.reservedOutputTokens,
        maxOutputTokens: input.maxOutputTokens,
        usage: call.usage,
        responseId: call.responseId,
    });

    return {
        outputMarkdown,
        outputJson: null, // no structured output for meta review
        diagnostics,
    };
}