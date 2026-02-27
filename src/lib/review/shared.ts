import { envBool, envInt, extOf } from "@/lib/utils/utilFunctions";

export const CHARS_PER_TOKEN = 4;

export type BudgetState = {
    remainingChars: number;
    warnings: string[];
};

export function getInputTokenLimit(): number {
    return envInt("OPENAI_MODEL_INPUT_LIMIT", 120_000);
}

export function getOutputTokenLimit(): number {
    return envInt("OPENAI_REVIEW_MAX_OUTPUT_TOKENS", 1200);
}

export function estimateTokens(text: string): number {
    return Math.ceil(String(text ?? "").length / CHARS_PER_TOKEN);
}

export function appendBlock(
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

export function normalizeTextForPrompt(text: string): string {
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

export function clampTextHeadTail(text: string, maxChars: number, marker: string) {
    const s = String(text ?? "");
    if (s.length <= maxChars) return { text: s, clamped: false };
    const head = s.slice(0, Math.floor(maxChars * 0.7));
    const tail = s.slice(-Math.floor(maxChars * 0.3));
    return { text: `${head}\n\n${marker}\n\n${tail}`, clamped: true };
}

export function shouldFetchFileContent(filePath: string, diffText: string) {
    const SMART_CONTEXT_ENABLED = envBool("OPENAI_SMART_CONTEXT", true);
    if (!SMART_CONTEXT_ENABLED) return { fetch: true, reason: "OPENAI_SMART_CONTEXT=off -> always fetch" };

    const DIFF_SMALL_THRESHOLD_CHARS = envInt("OPENAI_CONTEXT_DIFF_SMALL_THRESHOLD_CHARS", 6_000);
    const DIFF_HARD_SKIP_THRESHOLD_CHARS = envInt("OPENAI_CONTEXT_DIFF_HARD_SKIP_THRESHOLD_CHARS", 40_000);

    const SKIP_EXT = new Set(
        (process.env.OPENAI_CONTEXT_SKIP_EXT ??
            "png,jpg,jpeg,gif,webp,ico,pdf,zip,tar,gz,7z,jar,exe,dll,bin,lock,map,min.js,min.css")
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
    );

    const isNewFile =
        diffText.includes("new file mode") ||
        diffText.includes("--- /dev/null") ||
        /\@\@ -0,0 \+\d+,\d+ \@\@/.test(diffText);
    if (isNewFile) return { fetch: false, reason: "new_file_diff_already_contains_full_content" };


    const ext = extOf(filePath);
    const diffLen = (diffText ?? "").length;

    if (SKIP_EXT.has(ext)) return { fetch: false, reason: `skip_ext:${ext}` };
    if (diffLen >= DIFF_HARD_SKIP_THRESHOLD_CHARS) return { fetch: false, reason: `diff_too_large:${diffLen}` };
    if (diffLen <= DIFF_SMALL_THRESHOLD_CHARS) return { fetch: true, reason: `small_diff:${diffLen}` };

    return { fetch: envBool("OPENAI_CONTEXT_FETCH_FILE_FOR_MEDIUM_DIFFS", true), reason: `medium_diff:${diffLen}` };
}