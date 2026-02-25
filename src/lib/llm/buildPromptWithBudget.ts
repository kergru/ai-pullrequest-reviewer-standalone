import { SYSTEM_SOURCEFILE_PROMPT } from "@/lib/prompts/sourcefilePrompt";
import { SYSTEM_TESTFILE_PROMPT } from "@/lib/prompts/testfilePrompt";
import { SYSTEM_LIQUIBASE_PROMPT } from "@/lib/prompts/liquibasePrompt";
const DEFAULT_MODEL_INPUT_LIMIT = 120_000;
const CHARS_PER_TOKEN = 4;

export function buildFileReviewUserContentWithBudget(input: {
    jira?: any;
    filePath: string;
    diffText: string;
    language: string;
    systemPrompt: string;
    userPrompt: string;
    fileContent?: string;
    relatedTests?: Array<{ path: string; content: string }>;
    relatedSources?: Array<{ path: string; content: string }>;
    relatedLiquibase?: Array<{ path: string; content: string }>;
    reservedOutputTokens: number;
}) {
    const inputLimitTokens = getModelInputLimit();
    const systemTokens = estimateTokens(input.systemPrompt);

    const maxInputChars = Math.max(
        2_000,
        (inputLimitTokens - input.reservedOutputTokens - systemTokens) * CHARS_PER_TOKEN
    );

    const warnings: string[] = [];
    const parts: string[] = [];

    console.log("JIRA CONTEXT:", input.jira);

    // Base block (always)
    const baseRaw = [
        "HUMAN READALE MARKDOWN LANGUAGE: " + input.language,
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

    appendBlock(parts, state, "BASE", "", baseRaw, {
        hardCapChars: capBase,
        marker: "... USER CONTEXT TRUNCATED ...",
        minKeepChars: 1500,
    });

    // Diff (always)
    appendBlock(parts, state, "DIFF", "DIFF (unified):", input.diffText ?? "", {
        hardCapChars: capDiff,
        marker: `... DIFF TRUNCATED (limit ~${inputLimitTokens} tokens; tune OPENAI_MODEL_INPUT_LIMIT) ...`,
        minKeepChars: 1500,
    });

    // File content (optional)
    if (input.fileContent?.trim()) {
        appendBlock(parts, state, "FILE_CONTENT", "FILE CONTENT (post-change):", input.fileContent, {
            hardCapChars: capFile,
            marker: `... FILE CONTENT TRUNCATED (limit ~${inputLimitTokens} tokens; tune OPENAI_MODEL_INPUT_LIMIT) ...`,
            minKeepChars: 1000,
        });
    }

    // Related tests (optional)
    const tests = Array.isArray(input.relatedTests) ? input.relatedTests : [];
    if (tests.length) {
        const rendered = renderRelatedBlock(
            tests.map(t => ({ path: t.path, content: normalizeTextForPrompt(t.content) }))
        );
        appendBlock(parts, state, "RELATED_TESTS", SYSTEM_TESTFILE_PROMPT, rendered, {
            hardCapChars: capTests,
            marker: `... RELATED TESTS TRUNCATED (limit ~${inputLimitTokens} tokens) ...`,
            minKeepChars: 800,
        });
    }

    // Related sources (optional)
    const sources = Array.isArray(input.relatedSources) ? input.relatedSources : [];
    if (sources.length) {
        const rendered = renderRelatedBlock(
            sources.map(s => ({ path: s.path, content: normalizeTextForPrompt(s.content) }))
        );
        appendBlock(parts, state, "RELATED_SOURCES", SYSTEM_SOURCEFILE_PROMPT, rendered, {
            hardCapChars: capSources,
            marker: `... RELATED SOURCES TRUNCATED (limit ~${inputLimitTokens} tokens) ...`,
            minKeepChars: 800,
        });
    }

    // Liquibase (optional)
    const lb = Array.isArray(input.relatedLiquibase) ? input.relatedLiquibase : [];
    if (lb.length) {
        const rendered = renderLiquibaseBlock(
            lb.map(f => ({ path: f.path, content: normalizeTextForPrompt(f.content) }))
        );
        appendBlock(parts, state, "LIQUIBASE", SYSTEM_LIQUIBASE_PROMPT, rendered, {
            hardCapChars: capLiquibase,
            marker: `... LIQUIBASE CONTEXT TRUNCATED (limit ~${inputLimitTokens} tokens) ...`,
            minKeepChars: 800,
        });
    }

    // Warning preamble (only if needed)
    const finalWarnings = warnings.length ? [`⚠️ WARNING: Input was truncated/limited. ${warnings.join(", ")}\n\n`] : [];
    const finalUser = finalWarnings.join("") + parts.join("\n\n").trim();

    return { finalUser, warnings, inputLimitTokens };
}

export function buildMetaReviewUserContentWithBudget(input: {
    jira?: any;
    fileReviewResults: any;
    language: string;
    userPrompt: string;
    systemPrompt: string;
    reservedOutputTokens: number;
}) {
    const inputLimitTokens = getModelInputLimit();
    const systemTokens = estimateTokens(input.systemPrompt);

    const maxInputChars = Math.max(
        2_000,
        (inputLimitTokens - input.reservedOutputTokens - systemTokens) * CHARS_PER_TOKEN
    );

    const warnings: string[] = [];
    const parts: string[] = [];
    const state: BudgetState = { remainingChars: maxInputChars, warnings };

    const base = [
        "HUMAN READALE MARKDOWN LANGUAGE: " + input.language,
        "",
        "JIRA-ISSUE:",
        JSON.stringify(input.jira ?? {}, null, 2),
        "",
        "FINDINGS (structured, compact):",
        JSON.stringify(input.fileReviewResults ?? [], null, 2),
    ].join("\n");

    appendBlock(parts, state, "USER INSTRUCTIONS", "USER INSTRUCTIONS:", input.userPrompt, {});

    appendBlock(parts, state, "META", "", base, {
        hardCapChars: maxInputChars, // use everything available
        marker: `... META REVIEW INPUT TRUNCATED (limit ~${inputLimitTokens} tokens) ...`,
        minKeepChars: 1500,
    });

    const preamble = warnings.length
        ? `⚠️ WARNING: Input was truncated/limited. ${warnings.join(", ")}\n\n`
        : "";

    return { userPrompt: preamble + parts.join("\n\n").trim(), warnings, inputLimitTokens };
}

function getModelInputLimit(): number {
    const raw = (process.env.OPENAI_MODEL_INPUT_LIMIT ?? "").trim();
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n <= 0) return DEFAULT_MODEL_INPUT_LIMIT;
    return Math.max(8_000, Math.floor(n));
}

function estimateTokens(text: string): number {
    return Math.ceil(String(text ?? "").length / CHARS_PER_TOKEN);
}

function normalizeTextForPrompt(text: string): string {
    return String(text ?? "").replace(/\u0000/g, "");
}

function truncateWithHeadTail(text: string, maxChars: number, marker: string) {
    const s = String(text ?? "");
    if (s.length <= maxChars) return { text: s, truncated: false, removedChars: 0 };

    const headChars = Math.floor(maxChars * 0.7);
    const tailChars = Math.max(0, maxChars - headChars);

    const head = s.slice(0, headChars);
    const tail = tailChars > 0 ? s.slice(-tailChars) : "";

    const truncatedText = `${head}\n\n${marker}\n\n${tail}`;
    return {
        text: truncatedText,
        truncated: true,
        removedChars: Math.max(0, s.length - (headChars + tailChars)),
    };
}

function renderRelatedBlock(related: Array<{ path: string; content: string }>): string {
    return related
        .map(r => `--- ${r.path} ---\n${r.content}\n`)
        .join("\n")
        .trim();
}

function renderLiquibaseBlock(files: Array<{ path: string; content: string }>): string {
    return files
        .map(f => `--- ${f.path} ---\n${f.content}\n`)
        .join("\n")
        .trim();
}

type BudgetState = {
    remainingChars: number;
    warnings: string[];
};

function envInt(name: string, fallback: number) {
    const raw = (process.env[name] ?? "").trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function appendBlock(
    parts: string[],
    state: BudgetState,
    blockId: string,
    title: string,
    bodyRaw: string,
    opts?: { marker?: string; hardCapChars?: number; minKeepChars?: number }
) {
    if (state.remainingChars <= 0) return;

    const body = normalizeTextForPrompt(bodyRaw ?? "");
    if (!body.trim()) return;

    const marker = opts?.marker ?? `... ${blockId} TRUNCATED ...`;
    const hardCap = opts?.hardCapChars ?? Number.MAX_SAFE_INTEGER;
    const minKeep = opts?.minKeepChars ?? 800; // avoid adding useless tiny crumbs

    const allowed = Math.min(state.remainingChars, hardCap);

    if (allowed < minKeep) {
        state.warnings.push(`${blockId}_SKIPPED_NO_BUDGET`);
        return;
    }

    const tr = truncateWithHeadTail(body, allowed, marker);

    // Cost includes heading + blank lines too; keep it simple: subtract after push.
    const blockText = `${title}\n${tr.text}\n`;
    parts.push(blockText);

    state.remainingChars -= blockText.length;

    if (tr.truncated) {
        state.warnings.push(`${blockId}_TRUNCATED`);
        state.warnings.push(`${blockId}_TRUNCATED_REMOVED_CHARS:${tr.removedChars}`);
    }
}