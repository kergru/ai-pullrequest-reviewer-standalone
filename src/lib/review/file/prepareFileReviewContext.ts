import type { FileReviewContext } from "./types";
import type { SessionState } from "@/lib/session";
import { vcs } from "@/lib/vcs/client";
import { clampTextHeadTail, shouldAppendFileContent } from "@/lib/review/shared";
import { loadContextBundle } from "@/lib/review/file/loadRelatedFilesContext";
import { envInt } from "@/lib/utils/utilFunctions";
import { getDiffForFile } from "@/lib/diff/getDiff";

export async function prepareFileReviewContext(
    session: SessionState,
    filePath: string
): Promise<FileReviewContext> {
    const headSha = session.pr.headSha;

    let diffText = await getDiffForFile(session, filePath);
    if (!diffText) {
        throw new Error(`No diff found for filePath=${filePath}. Diff splitter couldn't match.`);
    } else {
        // Keep unified diff line anchors (`@@ ... @@`) so the model can map findings to real file lines.
        // Drop only noisy transport headers that do not help review quality.
        const filteredLines = diffText.split("\n").filter(line =>
            !line.startsWith("diff --git") &&
            !line.startsWith("index ")
        );
        diffText = filteredLines.join("\n");
    }

    // -------- FILE CONTENT (optional) --------
    let fileContent = "";
    const decision = shouldAppendFileContent(filePath, diffText);

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
    const bundle = await loadContextBundle(session, filePath, fileContent, headSha);

    return {
        diffText,
        fileContent,
        relatedTests: bundle.relatedTests,
        relatedSources: bundle.relatedSources,
        relatedLiquibase: bundle.relatedLiquibase
    }
}
