import { META_REVIEW_PROMPT } from "@/lib/prompts/metaReviewPrompt";
import { buildMetaReviewUserPromptWithBudget } from "@/lib/review/meta/buildPromptWithBudget";
import { runReviewLLM } from "@/lib/llm/runReviewLLM";
import { compactFileReviewResults } from "@/lib/review/meta/prepareMetaReviewContext";
import type { FileReviewResult, MetaReviewResult } from "@/lib/review/types";


export async function runMetaReview(input: {
    model: string;
    language: string;
    jira?: any;
    userPrompt?: string;
    fileReviewResults: FileReviewResult[];
}): Promise<MetaReviewResult> {

    const systemPrompt = META_REVIEW_PROMPT;

    // prepare context
    const compactedFileReviews = compactFileReviewResults(input.fileReviewResults);

    // build user prompt
    const { userPrompt, warnings } = buildMetaReviewUserPromptWithBudget({
        jira: input.jira,
        language: input.language,
        userPrompt: input.userPrompt ?? "",
        fileReviewResults: compactedFileReviews
    });

    if (warnings.length) {
        console.warn(`⚠️ AI meta review input warnings: ${warnings.join(", ")}`);
    }

    const result = await runReviewLLM({
        model: input.model,
        systemPrompt: systemPrompt,
        userPrompt: userPrompt
    })

    return {
        outputMarkdown: result.outputMarkdown,
        diagnostics: result.diagnostics,
        meta: {
            loadedContext: {
                countFileReviews: input.fileReviewResults.length,
                countFindings: compactedFileReviews.reduce((sum, r) => sum + r.topFindings.length, 0),
            },
            warnings: warnings,
        },
    }
}
