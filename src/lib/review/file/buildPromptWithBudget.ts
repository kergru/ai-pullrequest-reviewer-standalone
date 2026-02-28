import { SYSTEM_SOURCE_FILES_CONTEXT } from "@/lib/prompts/sourcefilePrompt";
import { SYSTEM_TESTFILE_CONTEXT } from "@/lib/prompts/testfilePrompt";
import { SYSTEM_LIQUIBASE_CONTEXT } from "@/lib/prompts/liquibasePrompt";
import { SYSTEM_REVIEW_PROMPT } from "@/lib/prompts/fileReviewPrompt";
import {
    appendBlock,
    CHARS_PER_TOKEN,
    estimateTokens, getInputTokenLimit, getOutputTokenLimit,
    normalizeTextForPrompt
} from "@/lib/review/shared";
import { envInt } from "@/lib/utils/utilFunctions";
import type { BudgetState } from "@/lib/review/shared";
import type { FileReviewContext } from "@/lib/review/file/types";

export function buildFileReviewUserContentWithBudget(input: {
    jira?: any;
    filePath: string;
    language: string;
    userPrompt: string;
    context: FileReviewContext
}) {
    const inputLimitTokens = getInputTokenLimit();
    const outputLimitTokens  = getOutputTokenLimit();
    const systemTokens = estimateTokens(SYSTEM_REVIEW_PROMPT);

    const maxInputChars = Math.max(
        2_000,
        (inputLimitTokens - outputLimitTokens - systemTokens) * CHARS_PER_TOKEN
    );

    const context = input.context;
    const warnings: string[] = [];
    const parts: string[] = [];

    const baseRaw = [
        "HUMAN READABLE MARKDOWN LANGUAGE: " + input.language,
        "",
        "JIRA-ISSUE:",
        JSON.stringify(input.jira ?? {}, null, 2),
        "",
        `FILE: ${input.filePath}`,
        "",
    ].join("\n");

    // state starts with max budget
    const state: BudgetState = { remainingChars: maxInputChars, warnings };

    // Per-block caps (optional via env; defaults are conservative)
    const capBase = envInt("OPENAI_BUDGET_BASE_CHARS", 18_000);
    const capDiff = envInt("OPENAI_BUDGET_DIFF_CHARS", 80_000);
    const capFile = envInt("OPENAI_BUDGET_FILE_CHARS", 20_000);
    const capTests = envInt("OPENAI_BUDGET_TESTS_CHARS", 18_000);
    const capSources = envInt("OPENAI_BUDGET_SOURCES_CHARS", 12_000);
    const capLiquibase = envInt("OPENAI_BUDGET_LIQUIBASE_CHARS", 12_000);

    appendBlock(parts, state, "USER INSTRUCTIONS", "USER INSTRUCTIONS:", input.userPrompt, {});

    appendBlock(parts, state, "USER", "USER INSTRUCTIONS:", baseRaw, {
        hardCapChars: capBase,
        marker: "... USER CONTEXT TRUNCATED ...",
        minKeepChars: 1500,
    });

    // Diff (always)
    appendBlock(parts, state, "DIFF", "DIFF (unified) CONTEXT:", context.diffText ?? "", {
        hardCapChars: capDiff,
        marker: `... DIFF TRUNCATED (limit ~${inputLimitTokens} tokens; tune OPENAI_MODEL_INPUT_LIMIT) ...`,
        minKeepChars: 1500,
    });

    // File content (optional)
    if (context.fileContent?.trim()) {
        appendBlock(parts, state, "FILE_CONTENT", "FILE CONTENT CONTEXT:", context.fileContent, {
            hardCapChars: capFile,
            marker: `... FILE CONTENT TRUNCATED (limit ~${inputLimitTokens} tokens; tune OPENAI_MODEL_INPUT_LIMIT) ...`,
            minKeepChars: 1000,
        });
    }

    // Related tests (optional)
    const tests = Array.isArray(context.relatedTests) ? context.relatedTests : [];
    if (tests.length) {
        const rendered = renderRelatedFilesBlock(
            tests.map(t => ({ path: t.path, content: normalizeTextForPrompt(t.content) }))
        );
        appendBlock(parts, state, "RELATED_TESTS", SYSTEM_TESTFILE_CONTEXT, rendered, {
            hardCapChars: capTests,
            marker: `... RELATED TESTS TRUNCATED (limit ~${inputLimitTokens} tokens) ...`,
            minKeepChars: 800,
        });
    }

    // Related sources (optional)
    const sources = Array.isArray(context.relatedSources) ? context.relatedSources : [];
    if (sources.length) {
        const rendered = renderRelatedFilesBlock(
            sources.map(s => ({ path: s.path, content: normalizeTextForPrompt(s.content) }))
        );
        appendBlock(parts, state, "RELATED_SOURCES", SYSTEM_SOURCE_FILES_CONTEXT, rendered, {
            hardCapChars: capSources,
            marker: `... RELATED SOURCES TRUNCATED (limit ~${inputLimitTokens} tokens) ...`,
            minKeepChars: 800,
        });
    }

    // Liquibase (optional)
    const lb = Array.isArray(context.relatedLiquibase) ? context.relatedLiquibase : [];
    if (lb.length) {
        const rendered = renderRelatedFilesBlock(
            lb.map(f => ({ path: f.path, content: normalizeTextForPrompt(f.content) }))
        );
        appendBlock(parts, state, "LIQUIBASE CONTEXT:", SYSTEM_LIQUIBASE_CONTEXT, rendered, {
            hardCapChars: capLiquibase,
            marker: `... LIQUIBASE CONTEXT TRUNCATED (limit ~${inputLimitTokens} tokens) ...`,
            minKeepChars: 800,
        });
    }

    const finalWarnings = warnings.length ? [`⚠️ WARNING: Input was truncated/limited. ${warnings.join(", ")}\n\n`] : [];
    const finalUserPrompt = finalWarnings.join("") + parts.join("\n\n").trim();

    return { finalUserPrompt, warnings };
}

function renderRelatedFilesBlock(related: Array<{ path: string; content: string }>): string {
    return related
        .map(r => `--- ${r.path} ---\n${r.content}\n`)
        .join("\n")
        .trim();
}
