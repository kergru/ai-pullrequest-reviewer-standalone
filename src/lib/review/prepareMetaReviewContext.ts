import { META_REVIEW_PROMPT } from "@/lib/prompts/metaReviewPrompt";
import { buildMetaReviewUserContentWithBudget } from "@/lib/llm";
import type {FileReviewResult, PreparedMetaReviewContext, ReviewStructuredOutput} from "./types";

function envInt(name: string, fallback: number) {
    const raw = (process.env[name] ?? "").trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function prepareMetaReviewContext(input: {
    model: string;
    language: string;
    jira?: any;
    userPrompt?: string;
    fileReviewResults: ReviewStructuredOutput[];
}): Promise<PreparedMetaReviewContext> {
    const systemPrompt = META_REVIEW_PROMPT;

    // output token budget
    const maxOutputTokens = envInt("OPENAI_META_REVIEW_MAX_OUTPUT_TOKENS", 1200);
    const reservedOutputTokens = maxOutputTokens;

    console.log("fileReviewResults:", JSON.stringify(input.fileReviewResults, null, 2));
    const compactResults = compactMetaReview(input.fileReviewResults);
    console.log("\n\ncompactResults:", JSON.stringify(compactResults, null, 2));
    // ✅ richtiger Aufruf
    const { userPrompt, warnings, inputLimitTokens } = buildMetaReviewUserContentWithBudget({
        jira: input.jira,
        fileReviewResults: compactResults,
        language: input.language,
        userPrompt: input.userPrompt ?? "",
        systemPrompt,
        reservedOutputTokens,
    });

    if (warnings.length) {
        console.warn(`⚠️ AI meta review input warnings: ${warnings.join(", ")}`);
    }

    return {
        model: input.model,
        systemPrompt,
        userPrompt,
        warnings,
        inputLimitTokens,
        reservedOutputTokens,
        maxOutputTokens,
    };
}

// POLICY FOR META REVIEW /////////////////////////////////////////////////////////

type Severity = "blocker" | "major" | "minor" | "nit";

function pickTopFindings(findings: any[], maxPerFile: number) {
    const rank: Record<string, number> = { blocker: 0, major: 1, minor: 2, nit: 3 };

    return (Array.isArray(findings) ? findings : [])
        .filter((f) => f?.severity && f?.category && (f?.title || f?.problem))
        .sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9))
        .slice(0, Math.max(1, maxPerFile))
        .map((f) => ({
            severity: f.severity as Severity,
            category: String(f.category).slice(0, 60),
            title: String(f.title ?? f.problem ?? "Finding").slice(0, 140),
            impact: String(f.impact ?? "").slice(0, 220),
            recommendation: String(f.recommendation ?? f.fix ?? "").slice(0, 220),
        }));
}

function normalizeSummary(summary: any) {
    const zero = { blocker: 0, major: 0, minor: 0, nit: 0 };

    if (!summary || typeof summary !== "object") return zero;

    return {
        blocker: Number(summary.blocker ?? 0) || 0,
        major: Number(summary.major ?? 0) || 0,
        minor: Number(summary.minor ?? 0) || 0,
        nit: Number(summary.nit ?? 0) || 0,
    };
}

// compacts an array of per-file review outputs into a small meta payload
function compactMetaReview(fileReviewResults: ReviewStructuredOutput[]) {
    const MAX_PER_FILE = envInt("OPENAI_META_MAX_FINDINGS_PER_FILE", 6);
    const MAX_FILES = envInt("OPENAI_META_MAX_FILES", 50);

    return (Array.isArray(fileReviewResults) ? fileReviewResults : [])
        .slice(0, Math.max(1, MAX_FILES))
        .map((structured: any) => {
            const findings = Array.isArray(structured.findings) ? structured.findings : [];

            const topFindings = pickTopFindings(findings, MAX_PER_FILE);

            const summary =
                structured?.severitySummary && typeof structured.severitySummary === "object"
                    ? normalizeSummary(structured.severitySummary)
                    : topFindings.reduce(
                        (acc: any, f: any) => {
                            acc[f.severity] = (acc[f.severity] ?? 0) + 1;
                            return acc;
                        },
                        { blocker: 0, major: 0, minor: 0, nit: 0 }
                    );

            const missingContext = Array.isArray(structured.missingContext)
                ? structured.missingContext.slice(0, 8).map((x: any) => String(x).slice(0, 160))
                : [];

            return {
                filePath: String(structured.filePath ?? ""),
                summary,
                topFindings,
                ...(missingContext.length ? { missingContext } : {}),
            };
        })
        .filter((r: any) => r.filePath);
}
