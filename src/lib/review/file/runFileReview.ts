import { SYSTEM_REVIEW_PROMPT } from "@/lib/prompts/fileReviewPrompt";
import type { SessionState } from "@/lib/session";
import type { FileReviewResult, ReviewStructuredOutput } from "@/lib/review";
import { prepareFileReviewContext } from "./prepareFileReviewContext";
import { runReviewLLM } from "@/lib/llm/runReviewLLM";
import { buildFileReviewUserContentWithBudget } from "@/lib/review/file/buildPromptWithBudget";

type FileReviewStatus = SessionState["files"][number]["reviewStatus"];

function setFileStatus(session: SessionState, filePath: string, status: FileReviewStatus) {
    const f = session.files.find((x) => x.path === filePath);
    if (f) f.reviewStatus = status;
}

export async function runFileReview(session: SessionState, filePath: string): Promise<FileReviewResult> {
    setFileStatus(session, filePath, "running");

    // load context for review
    const ctx = await prepareFileReviewContext(session, filePath);

    // build prompt with budget
    const { finalUserPrompt, warnings } = buildFileReviewUserContentWithBudget({
        jira: session.jira,
        filePath,
        language: session.language,
        userPrompt: session.prompt ?? "",
        context: ctx
    });

    const result = await runReviewLLM({
        model: session.model,
        systemPrompt: SYSTEM_REVIEW_PROMPT,
        userPrompt: finalUserPrompt
    })

    console.log("outputJson: \n", result.outputJson);
    const structured = parseReviewStructuredOutput(result.outputJson);
    console.log("structured: \n" , structured);

    const meta = {
        loadedContext: {
            tests: ctx.relatedTests.length,
            sources: ctx.relatedSources.length,
            liquibase: ctx.relatedLiquibase.length,
            fileContent: Boolean(ctx.fileContent),
        },
        warnings,
    };

    const status: FileReviewResult["status"] = structured ? "done" : "failed";

    const review: FileReviewResult = {
        filePath,
        status,
        outputMarkdown: result.outputMarkdown,
        outputStructured: structured,
        severitySummary: structured?.summary ?? { blocker: 0, major: 0, minor: 0, nit: 0 },
        diagnostics: result.diagnostics,
        meta: meta,
    };

    session.reviews[filePath] = review;
    setFileStatus(session, filePath, status);

    return review;
}


function parseReviewStructuredOutput(text: string | null): ReviewStructuredOutput | null {
    if (!text) return null;

    try {
        const obj = JSON.parse(text);

        // super-minimaler sanity check
        if (!obj || typeof obj !== "object") return null;
        if (!Array.isArray((obj as any).findings)) return null;
        if (!(obj as any).summary) return null;

        return obj as ReviewStructuredOutput;
    } catch {
        return null;
    }
}
