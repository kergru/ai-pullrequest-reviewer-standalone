import { META_REVIEW_PROMPT } from "@/lib/prompts/metaReviewPrompt";
import { buildMetaReviewUserPromptWithBudget } from "@/lib/review/meta/buildPromptWithBudget";
import { runReviewLLM } from "@/lib/llm/runReviewLLM";
import { prepareMetaReviewContext } from "@/lib/review/meta/prepareMetaReviewContext";
import type { FileReviewResult, MetaReviewResult } from "@/lib/review/types";
import type { VcsPrRef } from "@/lib/vcs";
import {FileEntry} from "@/lib/session";

export async function runMetaReview(input: {
    model: string;
    language: string;
    jira?: any;
    userPrompt?: string;
    fileReviewResults: FileReviewResult[];
    changedFiles: FileEntry[];
}): Promise<MetaReviewResult> {

    const systemPrompt = META_REVIEW_PROMPT;

    // prepare context (compaction + optional full diff)
    const { compactedFileReviews, compactedDiff } = await prepareMetaReviewContext({
        fileReviewResults: input.fileReviewResults,
        changedFiles: input.changedFiles,
    });

    // build user prompt
    const promptInput: any = {
        jira: input.jira,
        language: input.language,
        userPrompt: input.userPrompt ?? "",
        fileReviewResults: compactedFileReviews,
        compactedDiff,
    };

    const { userPrompt, warnings } = buildMetaReviewUserPromptWithBudget(promptInput);

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
