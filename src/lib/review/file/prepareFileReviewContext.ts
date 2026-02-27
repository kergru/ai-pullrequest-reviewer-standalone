import type { FileReviewContext } from "./types";
import type { SessionState } from "@/lib/session";
import { vcs } from "@/lib/vcs/client";
import { clampTextHeadTail, shouldFetchFileContent } from "@/lib/review/shared";
import { loadContextBundle } from "@/lib/review/file/loadRelatedFilesContext";
import { findDiffForPath, splitUnifiedDiffByFile } from "@/lib/diff-util";
import {envInt} from "@/lib/envUtil";

export async function prepareFileReviewContext(
    session: SessionState,
    filePath: string
): Promise<FileReviewContext> {
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
                envInt("OPENAI_CONTEXT_FILE_CONTENT_CHARS", 25_000),
                "... FILE CONTENT CLAMPED ..."
            );
            fileContent = clamped.text;
        } catch (e: any) {
            console.warn(`⚠️ Could not fetch file content for ${filePath}: ${e?.message ?? String(e)}`);
        }
    }

    // context files
    const bundle = await loadContextBundle(session, filePath, headSha);

    return {
        diffText,
        fileContent,
        relatedTests: bundle.relatedTests,
        relatedSources: bundle.relatedSources,
        relatedLiquibase: bundle.relatedLiquibase
    }
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
