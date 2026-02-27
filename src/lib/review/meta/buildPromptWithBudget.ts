import { META_REVIEW_PROMPT } from "@/lib/prompts/metaReviewPrompt";
import {
    appendBlock, BudgetState,
    CHARS_PER_TOKEN,
    estimateTokens,
    getInputTokenLimit,
    getOutputTokenLimit
} from "@/lib/review/shared";
import { envInt } from "@/lib/utils/utilFunctions";

export function buildMetaReviewUserPromptWithBudget(input: {
    jira?: any;
    language: string;
    userPrompt: string;
    fileReviewResults: any;
    compactedDiff?: string;
}) {

    // Token budget calculation
    const inputLimitTokens = getInputTokenLimit();
    const systemTokens = estimateTokens(META_REVIEW_PROMPT);
    const maxOutputTokens = getOutputTokenLimit();

    const maxInputChars = Math.max(
        2_000,
        (inputLimitTokens - maxOutputTokens - systemTokens) * CHARS_PER_TOKEN
    );

    const warnings: string[] = [];
    const parts: string[] = [];
    const state: BudgetState = { remainingChars: maxInputChars, warnings };

    const base = [
        "HUMAN READALE MARKDOWN LANGUAGE: " + input.language,
        "",
        "CONTEXT JIRA-ISSUE:",
        JSON.stringify(input.jira ?? {}, null, 2),
        "",
        "CONTEXT FILE REVIEW FINDINGS:",
        JSON.stringify(input.fileReviewResults ?? [], null, 2),
    ].join("\n");

    appendBlock(parts, state, "USER INSTRUCTIONS", "USER INSTRUCTIONS:", input.userPrompt, {});

    // add the main META block (jira + file review findings)
    appendBlock(parts, state, "META", "", base, {
        hardCapChars: maxInputChars, // use everything available
        marker: `... META REVIEW INPUT TRUNCATED (limit ~${inputLimitTokens} tokens) ...`,
        minKeepChars: 1500,
    });

    // append full diff as its own token-aware block (configurable hard cap)
    appendBlock(parts, state, "DIFF", "CONTEXT DIFF:", input.compactedDiff ?? "", {
        hardCapChars: Math.min(maxInputChars, envInt("OPENAI_META_MAX_DIFF_CHARS", 50000)),
        marker: `... FULL DIFF TRUNCATED (limit ~${inputLimitTokens} tokens) ...`,
        minKeepChars: 500,
    });

    const preamble = warnings.length
        ? `⚠️ WARNING: Input was truncated/limited. ${warnings.join(", ")}\n\n`
        : "";

    return { userPrompt: preamble + parts.join("\n\n").trim(), warnings };
}
