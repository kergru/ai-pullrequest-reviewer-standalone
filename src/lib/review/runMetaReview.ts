import { prepareMetaReviewContext } from "./prepareMetaReviewContext";
import { runMetaReviewLLM } from "@/lib/llm";
import type { MetaReviewResult, ReviewStructuredOutput } from "./types";

export async function runMetaReview(input: {
    model: string;
    language: string;
    jira?: any;
    userPrompt?: string;
    fileReviewResults: ReviewStructuredOutput[];
}): Promise<MetaReviewResult> {

    const ctx = await prepareMetaReviewContext(input);

    const reviewResultLLM = await runMetaReviewLLM({
        model: ctx.model,
        systemPrompt: ctx.systemPrompt,
        userPrompt: ctx.userPrompt,
        inputLimitTokens: ctx.inputLimitTokens,
        reservedOutputTokens: ctx.reservedOutputTokens,
        maxOutputTokens: ctx.maxOutputTokens,
    });

    return {
        outputMarkdown: reviewResultLLM.outputMarkdown,
        diagnostics: reviewResultLLM.diagnostics,
        meta: {
            loadedContext: {
                countFileReviews: input.fileReviewResults.length,
                countFindings: input.fileReviewResults.reduce((sum, r) => sum + r.findings.length, 0),
            },
            warnings: ctx.warnings,
        },
    }
}
