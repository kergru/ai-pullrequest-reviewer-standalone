import type { SessionLike } from "./types";
import { prepareFileReviewContext } from "./prepareFileReviewContext";
import { runFileReviewLLM } from "@/lib/llm";

function setFileStatus(session: SessionLike, filePath: string, status: string) {
    const f = session.files.find((x) => x.path === filePath);
    if (f) f.reviewStatus = status;
}

export async function runFileReview(session: SessionLike, filePath: string) {
    setFileStatus(session, filePath, "running");

    const ctx = await prepareFileReviewContext(session, filePath);

    const llm = await runFileReviewLLM({
        model: session.model,
        system: ctx.systemPrompt,
        user: ctx.userPrompt,
        inputLimitTokens: ctx.inputLimitTokens,
        reservedOutputTokens: ctx.reservedOutputTokens,
        maxOutputTokens: ctx.maxOutputTokens,
    });

    const warnings = [...ctx.warnings, ...(llm.warnings ?? [])];
    const hasWarnings = warnings.length > 0;

    const review = {
        filePath,
        status: hasWarnings ? "done_with_warnings" : "done",
        outputText: llm.outputText,
        outputStructured: llm.outputStructured,
        warnings,
        inputLimitTokens: ctx.inputLimitTokens,
        maxOutputTokens: ctx.maxOutputTokens,
        diagnostics: llm.diagnostics,
        fileContentMeta: ctx.meta.fileContent,
        testsMeta: ctx.meta.tests,
    };

    session.reviews[filePath] = review;
    setFileStatus(session, filePath, review.status);

    return review;
}
