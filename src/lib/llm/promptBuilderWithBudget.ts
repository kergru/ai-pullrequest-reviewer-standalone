import type { RelatedTest } from "./types";

const DEFAULT_MODEL_INPUT_LIMIT = 120_000;
const CHARS_PER_TOKEN = 4;

function getModelInputLimit(): number {
    const raw = (process.env.OPENAI_MODEL_INPUT_LIMIT ?? "").trim();
    if (!raw) return DEFAULT_MODEL_INPUT_LIMIT;

    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MODEL_INPUT_LIMIT;

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

function renderRelatedTestsBlock(tests: RelatedTest[]): string {
    const chunks: string[] = [];
    for (const t of tests) {
        chunks.push(`--- ${t.path} ---`);
        chunks.push(t.content);
        chunks.push("");
    }
    return chunks.join("\n").trim();
}

function renderLiquibaseChangedFilesBlock(paths: string[]): string {
    const uniq = Array.from(new Set((paths ?? []).filter(Boolean)));

    const chunks: string[] = [];
    for (const p of uniq) {
        const fileName = p.split(/[\\/]/).pop(); // funktioniert für / und \
        if (fileName) chunks.push(`- ${fileName}`);
    }

    return chunks.join("\n").trim();
}

export function buildReviewUserContentWithBudget(input: {
    jira?: any;
    filePath: string;
    diffText: string;
    systemPrompt: string;
    userPrompt: string;
    fileContent?: string;
    relatedTests?: RelatedTest[];
    liquibaseChangedFiles?: string[];
    reservedOutputTokens: number;
}) {
    const inputLimitTokens = getModelInputLimit();
    const warnings: string[] = [];

    const userBase = [
        "JIRA (Snapshot):",
        JSON.stringify(input.jira ?? {}, null, 2),
        "",
        `FILE: ${input.filePath}`,
        "",
        "USER INSTRUCTIONS:",
        input.userPrompt,
    ].join("\n");

    const systemTokens = estimateTokens(input.systemPrompt);
    let safeBase = userBase;
    let remainingTokens =
        inputLimitTokens - input.reservedOutputTokens - systemTokens - estimateTokens(safeBase);

    // If already over budget (rare), truncate base.
    if (remainingTokens <= 0) {
        const maxCharsForBase = Math.max(
            1_000,
            (inputLimitTokens - input.reservedOutputTokens - systemTokens) * CHARS_PER_TOKEN
        );
        const trBase = truncateWithHeadTail(
            safeBase,
            maxCharsForBase,
            "... USER CONTEXT TRUNCATED (input too large before context/diff) ..."
        );
        safeBase = trBase.text;
        if (trBase.truncated) {
            warnings.push("USER_CONTEXT_TRUNCATED");
            warnings.push(`USER_CONTEXT_TRUNCATED_REMOVED_CHARS:${trBase.removedChars}`);
        }
        remainingTokens =
            inputLimitTokens - input.reservedOutputTokens - systemTokens - estimateTokens(safeBase);
    }

    const hasFileContent = Boolean(input.fileContent?.trim().length);
    const fileContentRaw = hasFileContent ? normalizeTextForPrompt(input.fileContent!) : "";

    const testsRaw = Array.isArray(input.relatedTests) ? input.relatedTests : [];
    const hasTests = testsRaw.length > 0;

    const lbRaw = Array.isArray(input.liquibaseChangedFiles) ? input.liquibaseChangedFiles : [];
    const hasLiquibaseList = lbRaw.length > 0;

    // Token share heuristic:
    // - diff: 65%
    // - file content: 20%
    // - tests: 10%
    // - liquibase file list: 5%
    const diffShareBase = 0.65;
    const fileShareBase = hasFileContent ? 0.2 : 0;
    const testsShareBase = hasTests ? 0.10 : 0;
    const lbShareBase = hasLiquibaseList ? 0.05 : 0;

    const usedShare = diffShareBase + fileShareBase + testsShareBase + lbShareBase;
    const diffShare = usedShare > 0 ? diffShareBase / usedShare : 1;
    const fileShare = usedShare > 0 ? fileShareBase / usedShare : 0;
    const testsShare = usedShare > 0 ? testsShareBase / usedShare : 0;
    const lbShare = usedShare > 0 ? lbShareBase / usedShare : 0;

    const diffBudgetChars = Math.max(0, Math.floor(remainingTokens * diffShare) * CHARS_PER_TOKEN);
    const fileBudgetChars = Math.max(0, Math.floor(remainingTokens * fileShare) * CHARS_PER_TOKEN);
    const testsBudgetChars = Math.max(0, Math.floor(remainingTokens * testsShare) * CHARS_PER_TOKEN);
    const lbBudgetChars = Math.max(0, Math.floor(remainingTokens * lbShare) * CHARS_PER_TOKEN);

    // Truncate file content
    let safeFileContent = "";
    if (hasFileContent) {
        const trFile = truncateWithHeadTail(
            fileContentRaw,
            fileBudgetChars,
            `... FILE CONTENT TRUNCATED (limit ~${inputLimitTokens} tokens; tune OPENAI_MODEL_INPUT_LIMIT) ...`
        );
        safeFileContent = trFile.text;
        if (trFile.truncated) {
            warnings.push("FILE_CONTENT_TRUNCATED");
            warnings.push(`FILE_CONTENT_TRUNCATED_REMOVED_CHARS:${trFile.removedChars}`);
        }
    }

    // Truncate tests as a single block
    let safeTestsBlock = "";
    if (hasTests) {
        const rendered = renderRelatedTestsBlock(
            testsRaw.map((t) => ({ path: t.path, content: normalizeTextForPrompt(t.content) }))
        );
        const trTests = truncateWithHeadTail(
            rendered,
            testsBudgetChars,
            `... RELATED TESTS TRUNCATED (limit ~${inputLimitTokens} tokens; tune OPENAI_MODEL_INPUT_LIMIT) ...`
        );
        safeTestsBlock = trTests.text;
        if (trTests.truncated) {
            warnings.push("RELATED_TESTS_TRUNCATED");
            warnings.push(`RELATED_TESTS_TRUNCATED_REMOVED_CHARS:${trTests.removedChars}`);
        }
    }

    let safeLiquibaseBlock = "";
    if (hasLiquibaseList) {
        const rendered = renderLiquibaseChangedFilesBlock(lbRaw);
        const trLb = truncateWithHeadTail(
            rendered,
            lbBudgetChars,
            `... LIQUIBASE FILE LIST TRUNCATED (limit ~${inputLimitTokens} tokens) ...`
        );
        safeLiquibaseBlock = trLb.text;
        if (trLb.truncated) {
            warnings.push("LIQUIBASE_FILE_LIST_TRUNCATED");
            warnings.push(`LIQUIBASE_FILE_LIST_TRUNCATED_REMOVED_CHARS:${trLb.removedChars}`);
        }
    }

    // Truncate diff
    const trDiff = truncateWithHeadTail(
        input.diffText,
        diffBudgetChars,
        `... DIFF TRUNCATED (limit ~${inputLimitTokens} tokens; tune OPENAI_MODEL_INPUT_LIMIT) ...`
    );
    const safeDiff = trDiff.text;
    if (trDiff.truncated) {
        warnings.push("DIFF_TRUNCATED");
        warnings.push(`DIFF_TRUNCATED_REMOVED_CHARS:${trDiff.removedChars}`);
    }

    const parts: string[] = [];
    if (warnings.length > 0) {
        parts.push(`⚠️ WARNING: Input was truncated for size. Warnings: ${warnings.join(", ")}`, "");
    }

    parts.push(safeBase, "");

    if (hasFileContent) {
        parts.push("FILE CONTENT (post-change):", safeFileContent, "");
    }

    if (hasTests) {
        parts.push("RELATED JAVA TESTS (name patterns only):", safeTestsBlock, "");
    }

    if (hasLiquibaseList) {
        parts.push("LIQUIBASE-RELATED FILES CHANGED IN THIS PR:", safeLiquibaseBlock, "");
    }

    parts.push("DIFF (unified):", safeDiff);

    return { finalUser: parts.join("\n"), warnings, inputLimitTokens };
}

export function buildMetaReviewUserContentWithBudget(input: {
    jira?: any;
    fileReviewResults: any; // already compact JSON payload
    systemPrompt: string;
    reservedOutputTokens: number;
}) {
    const inputLimitTokens = getModelInputLimit();

    const userPromptBase = [
        "JIRA:",
        JSON.stringify(input.jira ?? {}, null, 2),
        "",
        "FINDINGS (structured, compact):",
        JSON.stringify(input.fileReviewResults ?? [], null, 2),
    ].join("\n");

    const systemTokens = estimateTokens(input.systemPrompt);
    const baseTokens = estimateTokens(userPromptBase);

    const warnings: string[] = [];

    if (systemTokens + baseTokens + input.reservedOutputTokens <= inputLimitTokens) {
        return { userPrompt: userPromptBase, warnings, inputLimitTokens };
    }

    const maxCharsForUser = Math.max(
        2_000,
        (inputLimitTokens - input.reservedOutputTokens - systemTokens) * CHARS_PER_TOKEN
    );

    const tr = truncateWithHeadTail(
        userPromptBase,
        maxCharsForUser,
        `... META REVIEW INPUT TRUNCATED (limit ~${inputLimitTokens} tokens; tune OPENAI_MODEL_INPUT_LIMIT) ...`
    );

    if (tr.truncated) {
        warnings.push("META_INPUT_TRUNCATED");
        warnings.push(`META_INPUT_TRUNCATED_REMOVED_CHARS:${tr.removedChars}`);
    }

    const preamble = `⚠️ WARNING: Input was truncated for size. Warnings: ${warnings.join(", ")}\n\n`;
    return { userPrompt: preamble + tr.text, warnings, inputLimitTokens };
}
