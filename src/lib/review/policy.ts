import { extOf } from "@/lib/diff-util";

export function envInt(name: string, fallback: number) {
    const raw = (process.env[name] ?? "").trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function envBool(name: string, fallback: boolean) {
    const raw = (process.env[name] ?? "").trim().toLowerCase();
    if (!raw) return fallback;
    return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
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

    const DIFF_SMALL_THRESHOLD_CHARS = envInt("OPENAI_DIFF_SMALL_THRESHOLD_CHARS", 6_000);
    const DIFF_HARD_SKIP_THRESHOLD_CHARS = envInt("OPENAI_DIFF_HARD_SKIP_THRESHOLD_CHARS", 40_000);

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

    return { fetch: envBool("OPENAI_FETCH_FILE_FOR_MEDIUM_DIFFS", true), reason: `medium_diff:${diffLen}` };
}
