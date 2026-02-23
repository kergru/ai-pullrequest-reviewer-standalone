import { findDiffForPath, splitUnifiedDiffByFile, extOf } from "@/lib/diff-util";
import { vcs } from "@/lib/vcs/client";
import { SessionLike, PreparedFileReviewContext } from "./types";
import { SYSTEM_REVIEW_PROMPT } from "@/lib/prompts/systemPrompt";
import { buildReviewUserContentWithBudget } from "@/lib/llm";
import { clampTextHeadTail, envBool, envInt, shouldFetchFileContent } from "./policy";
import { isLiquibaseChangelog, filterLiquibaseFilesFromChanges } from "@/lib/review/liquibase/liquibaseChangedFiles";

export async function prepareFileReviewContext(
    session: SessionLike,
    filePath: string
): Promise<PreparedFileReviewContext> {
    const headSha = session.pr.headSha;
    const fullDiff = await vcs.getDiff(session.pr);
    const byFile = splitUnifiedDiffByFile(fullDiff);

    const diffText = findDiffForPath(byFile, filePath) ?? "";
    if (!diffText) {
        throw new Error(`No diff found for filePath=${filePath}. Diff splitter couldn't match.`);
    }

    // ---------- FILE CONTENT ----------
    let fileContent = "";
    const fileContentMeta = {
        attempted: false,
        fetched: false,
        reason: "not_evaluated",
    } as { attempted: boolean; fetched: boolean; reason: string; clamped?: boolean };

    const decision = shouldFetchFileContent(filePath, diffText);

    if (decision.fetch && headSha) {
        fileContentMeta.attempted = true;
        fileContentMeta.reason = decision.reason;

        try {
            const raw = await vcs.getFileContentAtCommit(session.pr, filePath, headSha);

            const clamped = clampTextHeadTail(
                raw,
                envInt("OPENAI_MAX_FILE_CONTENT_CHARS", 25_000),
                "... FILE CONTENT CLAMPED ..."
            );

            fileContent = clamped.text;
            fileContentMeta.fetched = true;
            fileContentMeta.clamped = clamped.clamped;
        } catch (e: any) {
            console.warn(
                `⚠️ Could not fetch file content for ${filePath} at headSha=${headSha}: ${e?.message ?? String(e)}`
            );
        }
    } else {
        fileContentMeta.reason = !headSha ? "no_headSha" : decision.reason;
    }

    // ---------- RELATED JAVA TESTS ----------
    const MAX_TEST_FILES = envInt("OPENAI_MAX_JAVA_TEST_FILES", 3);
    const MAX_TEST_CHARS = envInt("OPENAI_MAX_JAVA_TEST_CHARS", 18_000);
    const ENABLE_TEST_CONTEXT = envBool("OPENAI_INCLUDE_JAVA_TESTS", true);

    let relatedTests: Array<{ path: string; content: string }> = [];

    const testsMeta = {
        attempted: false,
        fetchedCount: 0,
        reason: "disabled_or_not_applicable",
        usedIndex: false,
    };

    const isJavaSource = extOf(filePath) === "java";
    const isTestFile = filePath.toLowerCase().includes("src/test/");

    if (ENABLE_TEST_CONTEXT && isJavaSource && !isTestFile && headSha && MAX_TEST_FILES > 0) {
        testsMeta.attempted = true;
        testsMeta.usedIndex = false;
        testsMeta.reason = "java_test_same_package";

        console.log("loading related tests for", filePath, "from", headSha);

        const baseName = baseNameOf(filePath);
        const testDir = toTestPackageDir(filePath);

        try {
            const files = await vcs.listFilesInDirAtCommit(session.pr, headSha, testDir);
            const matches = files
                .filter((p) => {
                    const name = p.slice(p.lastIndexOf("/") + 1);
                    return (
                        name.startsWith(baseName) &&
                        (name.endsWith("Test.java") || name.endsWith("Tests.java"))
                    );
                })
                .slice(0, MAX_TEST_FILES);

            const rawTests = await Promise.all(
                matches.map(async (p) => {
                    const filePath = testDir + "/" + p;
                    const content = await vcs.getFileContentAtCommit(session.pr, filePath, headSha);
                    return { path: p, content };
                })
            );

            relatedTests = rawTests.map((t) => {
                const clamped = clampTextHeadTail(
                    t.content,
                    MAX_TEST_CHARS,
                    "... TEST FILE CLAMPED ..."
                );
                return { path: t.path, content: clamped.text };
            });

        } catch (e: any) {
            console.warn(`⚠️ Could not load tests from ${testDir}: ${e?.message ?? String(e)}`);
        }
    }

    // ---------- LIQUIBASE CONTEXT ----------
    let liquibaseChangedFiles: string[] | undefined = undefined;

    if (isLiquibaseChangelog(filePath)) {
        liquibaseChangedFiles = filterLiquibaseFilesFromChanges(session.files);
    }

    // ---------- FIXED SYSTEM PROMPT ----------
    const systemPrompt = SYSTEM_REVIEW_PROMPT;


    // ---------- BUILD PROMPT WITH BUDGET ----------
    const maxOutputTokens = envInt("OPENAI_REVIEW_MAX_OUTPUT_TOKENS", 1500);
    const reservedOutputTokens = maxOutputTokens;
    const { finalUser, warnings, inputLimitTokens } = buildReviewUserContentWithBudget({
        jira: session.jira,
        filePath,
        diffText,
        systemPrompt,
        userPrompt: session.prompt,
        fileContent,
        relatedTests,
        liquibaseChangedFiles,
        reservedOutputTokens,
    });

    return {
        filePath,
        systemPrompt: systemPrompt,
        userPrompt: finalUser,
        warnings,
        inputLimitTokens,
        reservedOutputTokens,
        maxOutputTokens,
        meta: {
            headSha,
            fileContent: fileContentMeta,
            tests: testsMeta,
        },
    };
}

function toTestPackageDir(mainFilePath: string) {
    return mainFilePath
        .replaceAll("\\", "/")
        .replace(/^src\/main\/java\//, "src/test/java/")
        .replace(/\/[^/]+\.java$/, "");
}

function baseNameOf(javaFile: string) {
    const f = javaFile.replaceAll("\\", "/");
    return f.slice(f.lastIndexOf("/") + 1, -5); // XY
}
