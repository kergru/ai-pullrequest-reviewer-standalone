import type { FileReviewResults } from "./types";
import { prepareMetaReviewContext } from "./prepareMetaReviewContext";
import { runMetaReviewLLM } from "@/lib/llm";
import type { MetaReviewResult } from "@/lib/llm/types";

export async function runMetaReview(input: {
    model: string;
    jira?: any;
    fileReviewResults: FileReviewResults;
}): Promise<MetaReviewResult> {

    const ctx = await prepareMetaReviewContext(input);

    return runMetaReviewLLM({
        model: ctx.model,
        systemPrompt: ctx.systemPrompt,
        userPrompt: ctx.userPrompt,
        warnings: ctx.warnings,
        inputLimitTokens: ctx.inputLimitTokens,
        reservedOutputTokens: ctx.reservedOutputTokens,
        maxOutputTokens: ctx.maxOutputTokens,
    });
}