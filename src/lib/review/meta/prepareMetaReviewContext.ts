import { envInt } from "@/lib/utils/utilFunctions";
import type { Severity, FileReviewResult, ReviewStructuredOutput, SeveritySummary, ReviewFinding } from "../types";
import type { FileEntry } from "@/lib/session";

type CompactFileReviewResult = {
    filePath: string;
    topFindings: ReducedFinding[];
    severitySummary: SeveritySummary;
}

type ReducedFinding = {
    filePath: string;
    severity: Severity;
    category: string;
    title: string;
    problem: string;
}

export async function prepareMetaReviewContext(params: {
    fileReviewResults: FileReviewResult[];
    changedFiles: FileEntry[];
}): Promise<{ compactedFileReviews: CompactFileReviewResult[]; compactedDiff?: string }>{

    const compactedFileReviews = compactFileReviewResults(params.fileReviewResults);

    // load a compacted diff only from source files to use is as context for meta review.
    const compactedDiff = compactDiff(params.changedFiles);

    return { compactedFileReviews,compactedDiff };
}

// create compacted diff, use diff only from source files
function compactDiff(changedFiles: FileEntry[]): string {
    if (!Array.isArray(changedFiles) || changedFiles.length === 0) return "";

    const parts: string[] = [];

    for (const f of changedFiles) {
        if (!f || typeof f.path !== "string") continue;
        const path = String(f.path).trim();
        // only include repository source files (start with src/)
        if (path.startsWith("src/test")) continue;

        const diffText = String(f.diffText ?? "").trim();
        // include a small header with the file path and the diff text
        const header = `FILE: ${path}`;
        if (diffText) {
            parts.push(`${header}\n${diffText}`);
        } else {
            // keep an explicit empty placeholder so callers know file was considered
            parts.push(`${header}\n`);
        }
    }

    return parts.length ? parts.join("\n\n") : "";
}

function compactFileReviewResults(fileReviewResults: FileReviewResult[]): CompactFileReviewResult[] {
    const MAX_PER_FILE = envInt("OPENAI_META_MAX_FINDINGS_PER_FILE", 6);
    const MAX_FILES = envInt("OPENAI_META_MAX_FILES", 50);

    if (!Array.isArray(fileReviewResults) || fileReviewResults.length === 0) return [];

    const rank: Record<string, number> = { blocker: 0, major: 1, minor: 2, nit: 3 };

    return fileReviewResults
        .slice(0, Math.max(0, Math.floor(MAX_FILES)))
        .map((fr) => {
            const filePath = String(fr.filePath ?? "");
            const structured = (fr.outputStructured ?? {}) as Partial<ReviewStructuredOutput>;
            const rawFindings = Array.isArray(structured.findings) ? structured.findings : [];

            const findingsSorted = [...rawFindings].sort((a, b) => {
                const ra = rank[(a?.severity as string) ?? ""] ?? 99;
                const rb = rank[(b?.severity as string) ?? ""] ?? 99;
                return ra - rb;
            });

            const top = findingsSorted.slice(0, Math.max(0, Math.floor(MAX_PER_FILE)));

            const topReduced: ReducedFinding[] = top
                .filter((f): f is ReviewFinding => !!f && typeof f === "object")
                .map((f) => ({
                    filePath,
                    severity: f.severity ?? "minor",
                    category: String(f.category ?? ""),
                    title: String(f.title ?? ""),
                    problem: String(f.problem ?? ""),
                }));

            const severitySummary: SeveritySummary = structured?.summary && typeof structured.summary === "object"
                ? {
                    blocker: Number((structured.summary as any).blocker ?? 0) || 0,
                    major: Number((structured.summary as any).major ?? 0) || 0,
                    minor: Number((structured.summary as any).minor ?? 0) || 0,
                    nit: Number((structured.summary as any).nit ?? 0) || 0,
                }
                : topReduced.reduce(
                    (acc: SeveritySummary, f) => {
                        const sev = f.severity;
                        if (sev === "blocker" || sev === "major" || sev === "minor" || sev === "nit") {
                            acc[sev] = (acc[sev] ?? 0) + 1;
                        }
                        return acc;
                    },
                    { blocker: 0, major: 0, minor: 0, nit: 0 }
                );

            return {
                filePath,
                topFindings: topReduced,
                severitySummary,
            } as CompactFileReviewResult;
        })
        .filter((c) => Array.isArray(c.topFindings) && c.topFindings.length > 0);
}
