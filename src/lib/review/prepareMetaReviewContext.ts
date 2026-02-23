import { META_REVIEW_PROMPT } from "@/lib/prompts/metaReviewPrompt";
import { buildMetaReviewUserContentWithBudget } from "@/lib/llm";
import { FileReviewResults, PreparedMetaReviewContext } from "./types";

function envInt(name: string, fallback: number) {
    const raw = (process.env[name] ?? "").trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function prepareMetaReviewContext(input: {
    model: string;
    jira?: any;
    fileReviewResults: FileReviewResults;
}): Promise<PreparedMetaReviewContext> {
    const metaReviewSystemPrompt = META_REVIEW_PROMPT;

    // output token budget (fixes your undefined vars)
    const maxOutputTokens = envInt("OPENAI_META_REVIEW_MAX_OUTPUT_TOKENS", 1200);
    const reservedOutputTokens = maxOutputTokens;

    const fileReviewResults = compactMetaReview(input.fileReviewResults);

    const { userPrompt, warnings, inputLimitTokens } = buildMetaReviewUserContentWithBudget({
        jira: input.jira,
        fileReviewResults,
        systemPrompt: metaReviewSystemPrompt,
        reservedOutputTokens,
    });

    if (warnings.length) {
        // eslint-disable-next-line no-console
        console.warn(`⚠️ AI meta review input warnings: ${warnings.join(", ")}`);
    }

    return {
        model: input.model,
        systemPrompt: metaReviewSystemPrompt,
        userPrompt,
        warnings,
        inputLimitTokens,
        reservedOutputTokens,
        maxOutputTokens,
    };
}


// POLICY FOR META REVIEW /////////////////////////////////////////////////////////

function pickTopFindings(findings: any[], maxPerFile: number) {
    const rank: Record<string, number> = { blocker: 0, major: 1, minor: 2, nit: 3 };

    return (Array.isArray(findings) ? findings : [])
        .filter((f) => f?.severity && f?.category && (f?.title || f?.problem))
        .sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9))
        .slice(0, Math.max(1, maxPerFile))
        .map((f) => ({
            severity: f.severity,
            category: String(f.category).slice(0, 60),
            title: String(f.title ?? f.problem ?? "Finding").slice(0, 140),
            impact: String(f.impact ?? "").slice(0, 220),
            recommendation: String(f.recommendation ?? f.fix ?? "").slice(0, 220),
        }));
}

function compactMetaReview(fileReviewResults: FileReviewResults) {
    const MAX_PER_FILE = envInt("OPENAI_META_MAX_FINDINGS_PER_FILE", 6);
    const MAX_FILES = envInt("OPENAI_META_MAX_FILES", 50);

    return (fileReviewResults ?? [])
        .slice(0, Math.max(1, MAX_FILES))
        .map((r) => {
            const structured = r.outputStructured ?? {};
            const findings = Array.isArray(structured.findings) ? structured.findings : [];

            const topFindings = pickTopFindings(findings, MAX_PER_FILE);

            const summary =
                r.severitySummary && typeof r.severitySummary === "object"
                    ? r.severitySummary
                    : topFindings.reduce(
                        (acc: any, f: any) => {
                            acc[f.severity] = (acc[f.severity] ?? 0) + 1;
                            return acc;
                        },
                        { blocker: 0, major: 0, minor: 0, nit: 0 }
                    );

            const missingContext = Array.isArray(structured.missingContext) ? structured.missingContext.slice(0, 8) : [];

            return {
                filePath: r.filePath,
                summary,
                topFindings,
                ...(missingContext.length ? { missingContext } : {}),
            };
        });
}