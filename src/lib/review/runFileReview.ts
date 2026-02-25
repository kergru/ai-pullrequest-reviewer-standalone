import type { SessionState } from "@/lib/session";
import type { FileReviewResult, ReviewStructuredOutput } from "@/lib/review/types";
import { prepareFileReviewContext } from "./prepareFileReviewContext";
import { runFileReviewLLM } from "@/lib/llm";

type FileReviewStatus = SessionState["files"][number]["reviewStatus"];

function setFileStatus(session: SessionState, filePath: string, status: FileReviewStatus) {
    const f = session.files.find((x) => x.path === filePath);
    if (f) f.reviewStatus = status;
}

export async function runFileReview(session: SessionState, filePath: string): Promise<FileReviewResult> {
    setFileStatus(session, filePath, "running");

    const ctx = await prepareFileReviewContext(session, filePath);

    const llm = await runFileReviewLLM({
        model: session.model,
        systemPrompt: ctx.systemPrompt,
        userPrompt: ctx.userPrompt,
        inputLimitTokens: ctx.inputLimitTokens,
        reservedOutputTokens: ctx.reservedOutputTokens,
        maxOutputTokens: ctx.maxOutputTokens,
    });

    const structured = parseReviewStructuredOutput(llm.outputJson);
    const status: FileReviewResult["status"] = structured ? "done" : "failed";
    const diagnosticLLM = llm.diagnostics;

    const review: FileReviewResult = {
        filePath,
        status,
        outputMarkdown: llm.outputMarkdown,
        outputStructured: structured,
        severitySummary: structured?.summary ?? { blocker: 0, major: 0, minor: 0, nit: 0 },
        diagnostics: diagnosticLLM,
        meta: ctx.meta,
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
