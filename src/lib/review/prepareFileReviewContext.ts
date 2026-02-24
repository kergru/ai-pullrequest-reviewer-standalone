import type { PreparedFileReviewContext } from "./types";
import type { SessionState } from "@/lib/session";
import { SYSTEM_REVIEW_PROMPT } from "@/lib/prompts/systemPrompt";
import { vcs } from "@/lib/vcs/client";
import { clampTextHeadTail, envBool, envInt, shouldFetchFileContent } from "@/lib/review/policy";
import { loadContextBundle } from "@/lib/review/loadRelatedFilesContext";
import { buildReviewUserContentWithBudget } from "@/lib/llm";
import { findDiffForPath, splitUnifiedDiffByFile } from "@/lib/diff-util";

export async function prepareFileReviewContext(
    session: SessionState,
    filePath: string
): Promise<PreparedFileReviewContext> {
    const headSha = session.pr.headSha;
    const fullDiff = await vcs.getDiff(session.pr);
    const byFile = splitUnifiedDiffByFile(fullDiff);
    cacheDiffsIntoSession(session, byFile);

    const diffText = findDiffForPath(byFile, filePath) ?? "";
    if (!diffText) {
        throw new Error(`No diff found for filePath=${filePath}. Diff splitter couldn't match.`);
    }

    // -------- FILE CONTENT (optional) --------
    let fileContent = "";
    const decision = shouldFetchFileContent(filePath, diffText);

    if (decision.fetch && headSha) {
        try {
            const raw = await vcs.getFileContentAtCommit(session.pr, filePath, headSha);
            const clamped = clampTextHeadTail(
                raw,
                envInt("OPENAI_MAX_FILE_CONTENT_CHARS", 25_000),
                "... FILE CONTENT CLAMPED ..."
            );
            fileContent = clamped.text;
        } catch (e: any) {
            console.warn(`⚠️ Could not fetch file content for ${filePath}: ${e?.message ?? String(e)}`);
        }
    }

    // -------- SYSTEM PROMPT + CONTEXT --------
    const baseSystemPrompt = SYSTEM_REVIEW_PROMPT;

    const bundle = await loadContextBundle(session, filePath, headSha, {
        vcs,
        clampTextHeadTail,
        envInt,
        envBool,
    });

    const finalSystemPrompt = baseSystemPrompt + bundle.systemPromptSuffix;

    // -------- BUILD PROMPT WITH BUDGET --------
    const maxOutputTokens = envInt("OPENAI_REVIEW_MAX_OUTPUT_TOKENS", 1500);

    const { finalUser, warnings, inputLimitTokens } = buildReviewUserContentWithBudget({
        jira: session.jira,
        filePath,
        diffText,
        systemPrompt: finalSystemPrompt,
        userPrompt: session.prompt ?? "",
        fileContent: fileContent || undefined,
        relatedTests: bundle.relatedTests,
        relatedSources: bundle.relatedSources,
        relatedLiquibase: bundle.relatedLiquibase,
        reservedOutputTokens: maxOutputTokens,
    });

    const meta = {
        headSha: headSha ?? null,
        loadedContext: {
            tests: bundle.relatedTests.length,
            sources: bundle.relatedSources.length,
            liquibase: bundle.relatedLiquibase.length,
            fileContent: Boolean(fileContent),
        },
        warnings,
    };

    return {
        filePath,
        systemPrompt: finalSystemPrompt,
        userPrompt: finalUser,
        warnings,
        inputLimitTokens,
        reservedOutputTokens: maxOutputTokens,
        maxOutputTokens,
        meta,
    };
}

function cacheDiffsIntoSession(
    session: SessionState,
    byFile: Map<string, string>
) {
    for (const file of session.files) {
        if (!file.diffText) {
            const diff = byFile.get(file.path);
            if (diff) {
                file.diffText = diff;
            }
        }
    }
}
