import { prepareMetaReviewContext } from "./prepareMetaReviewContext";
import { runMetaReviewLLM } from "@/lib/llm";
import {MetaReviewResult, ReviewStructuredOutput} from "./types";

export async function runMetaReview(input: {
    model: string;
    jira?: any;
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
        warnings: ctx.warnings,
        diagnostics: {
            inputLimitTokens: ctx.inputLimitTokens,
            maxOutputTokens: ctx.maxOutputTokens,
            metaLLM: reviewResultLLM.diagnostics,
        },
    }
}
