import { SYSTEM_SOURCEFILE_PROMPT } from "@/lib/prompts/sourcefilePrompt";
import { SYSTEM_TESTFILE_PROMPT } from "@/lib/prompts/testfilePrompt";
import { SYSTEM_LIQUIBASE_PROMPT } from "@/lib/prompts/liquibasePrompt";

import type { SessionState } from "@/lib/session";
import {ChangedFile, ContextBundle, TextRef} from "@/lib/review/types";

export async function loadContextBundle(
    session: SessionState,
    filePath: string,
    headSha: string | undefined,
    deps: { vcs: any; clampTextHeadTail: any; envInt: any; envBool: any }
): Promise<ContextBundle> {
    const relatedTests: TextRef[] = [];
    const relatedSources: TextRef[] = [];
    let relatedLiquibase: TextRef[] = [];

    const testOpts = {
        enabled: deps.envBool("OPENAI_INCLUDE_JAVA_TESTS", true),
        maxFiles: deps.envInt("OPENAI_MAX_JAVA_TEST_FILES", 3),
        maxChars: deps.envInt("OPENAI_MAX_JAVA_TEST_CHARS", 18_000),
    };

    const sourceOpts = {
        enabled: deps.envBool("OPENAI_INCLUDE_JAVA_SOURCES", true),
        maxFiles: deps.envInt("OPENAI_MAX_JAVA_SOURCE_FILES", 3),
        maxChars: deps.envInt("OPENAI_MAX_JAVA_SOURCE_CHARS", 18_000),
    };

    const liquibaseOpts = {
        enabled: deps.envBool("OPENAI_INCLUDE_LIQUIBASE", true),
        maxFiles: deps.envInt("OPENAI_MAX_LIQUIBASE_FILES", 10),
        maxChars: deps.envInt("OPENAI_MAX_LIQUIBASE_CHARS", 18_000),
        fetchFallback: deps.envBool("OPENAI_LIQUIBASE_FETCH_FALLBACK", false),
    };

    // ---- JAVA CONTEXT ----
    if (isJavaSourceFile(filePath) && headSha) {
        relatedTests.push(
            ...(await findRelatedTestsForSource(session.pr, headSha, filePath, testOpts, deps))
        );
    }

    if (isJavaTestFile(filePath) && headSha) {
        relatedSources.push(
            ...(await findRelatedSourcesForTest(session.pr, headSha, filePath, sourceOpts, deps))
        );
    }

    // ---- LIQUIBASE CONTEXT ----
    if (liquibaseOpts.enabled && isLiquibaseFile(filePath)) {
        const changed: ChangedFile[] = session.files.map((f) => ({
            path: f.path,
            diffText: f.diffText,
            contentAtHead: f.contentAtHead,
        }));

        if (!liquibaseOpts.fetchFallback) {
            relatedLiquibase = filterLiquibaseFilesFromChanges(changed, liquibaseOpts.maxFiles);
        } else if (headSha) {
            relatedLiquibase = await loadLiquibaseContext(
                session.pr,
                headSha,
                changed,
                {
                    maxFiles: liquibaseOpts.maxFiles,
                    maxChars: liquibaseOpts.maxChars,
                    enableFetchFallback: true,
                },
                deps
            );
        }

        relatedLiquibase = sortLiquibaseFirstChangelog(relatedLiquibase);
    }

    // ---- PROMPT SUFFIX ----
    let suffix = "";

    if (isJavaSourceFile(filePath)) {
        suffix += section("Review hints for Java source files", SYSTEM_SOURCEFILE_PROMPT);
        suffix += renderFilesBlock("TEST FILES RELATED TO THIS SOURCE FILE", relatedTests);
    }

    if (isJavaTestFile(filePath)) {
        suffix += section("Review hints for Java test files", SYSTEM_TESTFILE_PROMPT);
        suffix += renderFilesBlock("SOURCE FILES RELATED TO THIS TEST FILE", relatedSources);
    }

    if (isLiquibaseFile(filePath)) {
        suffix += section("Liquibase review hints", SYSTEM_LIQUIBASE_PROMPT);
        suffix += renderFilesBlock("LIQUIBASE FILES RELATED TO THIS CHANGE", relatedLiquibase);
    }

    return { relatedTests, relatedSources, relatedLiquibase, systemPromptSuffix: suffix };
}

// ----------------------------------------------------------------
// FILE TYPE DETECTION
// ----------------------------------------------------------------

function normalize(p: string) {
    return p.replaceAll("\\", "/");
}

function isJavaSourceFile(path: string) {
    const p = normalize(path).toLowerCase();
    return p.endsWith(".java") && p.includes("src/main/java/");
}

function isJavaTestFile(path: string) {
    const p = normalize(path).toLowerCase();
    return p.endsWith(".java") && p.includes("src/test/java/");
}

function isLiquibaseFile(path: string) {
    const l = normalize(path).toLowerCase();
    return l.includes("/resources/db/") || l.includes("liquibase");
}

// ----------------------------------------------------------------
// RENDER HELPERS
// ----------------------------------------------------------------

function section(title: string, body: string) {
    return `\n\n---\n# ${title}\n${body}\n`;
}

function renderFilesBlock(title: string, files: TextRef[]) {
    if (!files.length) return section(title, "(none)");

    const rendered = files
        .map((f) => `## ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
        .join("\n\n");

    return section(title, rendered);
}

function sortLiquibaseFirstChangelog(files: TextRef[]) {
    return [...files].sort((a, b) => {
        const la = a.path.toLowerCase();
        const lb = b.path.toLowerCase();
        const aIsChangelog = la.includes("changelog");
        const bIsChangelog = lb.includes("changelog");
        if (aIsChangelog !== bIsChangelog) return aIsChangelog ? -1 : 1;
        return la.localeCompare(lb);
    });
}

// ----------------------------------------------------------------
// JAVA RELATED CONTEXT
// ----------------------------------------------------------------

function baseNameOf(javaFile: string) {
    const f = normalize(javaFile);
    const name = f.slice(f.lastIndexOf("/") + 1);
    return name.endsWith(".java") ? name.slice(0, -5) : name;
}

function stripTestSuffix(name: string) {
    return name.replace(/(Tests|Test)$/i, "");
}

function toTargetPackageDir(filePath: string, source: "main" | "test", target: "main" | "test") {
    const p = normalize(filePath);
    const re = new RegExp(`^src\\/${source}\\/java\\/`);
    return p.replace(re, `src/${target}/java/`).replace(/\/[^/]+\.java$/, "");
}

async function fetchAndClamp(
    pr: any,
    headSha: string,
    path: string,
    maxChars: number,
    clampMsg: string,
    vcs: any,
    clampTextHeadTail: (t: string, m: number, s: string) => { text: string }
): Promise<TextRef> {
    const raw = await vcs.getFileContentAtCommit(pr, path, headSha);
    const clamped = clampTextHeadTail(raw, maxChars, clampMsg);
    return { path, content: clamped.text };
}

export async function findRelatedTestsForSource(
    pr: any,
    headSha: string,
    filePath: string,
    opts: { maxFiles: number; maxChars: number; enabled: boolean },
    deps: { vcs: any; clampTextHeadTail: any }
): Promise<TextRef[]> {
    if (!opts.enabled || opts.maxFiles <= 0) return [];

    const base = baseNameOf(filePath);
    const testDir = toTargetPackageDir(filePath, "main", "test");

    try {
        const entries: string[] = await deps.vcs.listFilesInDirAtCommit(pr, headSha, testDir);

        const matches = entries
            .map((e) => ({ entry: e, name: e.slice(e.lastIndexOf("/") + 1) }))
            .filter(({ name }) => name.startsWith(base) && /^(.*)(Test|Tests)\.java$/.test(name))
            .slice(0, opts.maxFiles);

        return await Promise.all(
            matches.map(({ entry }) =>
                fetchAndClamp(
                    pr,
                    headSha,
                    entry.includes("/") ? entry : `${testDir}/${entry}`,
                    opts.maxChars,
                    "... TEST FILE CLAMPED ...",
                    deps.vcs,
                    deps.clampTextHeadTail
                )
            )
        );
    } catch {
        return [];
    }
}

export async function findRelatedSourcesForTest(
    pr: any,
    headSha: string,
    filePath: string,
    opts: { maxFiles: number; maxChars: number; enabled: boolean },
    deps: { vcs: any; clampTextHeadTail: any }
): Promise<TextRef[]> {
    if (!opts.enabled || opts.maxFiles <= 0) return [];

    const testBase = baseNameOf(filePath);
    const srcBase = stripTestSuffix(testBase);
    const srcDir = toTargetPackageDir(filePath, "test", "main");

    try {
        const entries: string[] = await deps.vcs.listFilesInDirAtCommit(pr, headSha, srcDir);

        const exact = entries.filter(
            (e) => e.slice(e.lastIndexOf("/") + 1).toLowerCase() === `${srcBase.toLowerCase()}.java`
        );

        const fallback = entries.filter((e) => e.toLowerCase().endsWith(".java"));
        const chosen = (exact.length ? exact : fallback).slice(0, opts.maxFiles);

        return await Promise.all(
            chosen.map((entry) =>
                fetchAndClamp(
                    pr,
                    headSha,
                    entry.includes("/") ? entry : `${srcDir}/${entry}`,
                    opts.maxChars,
                    "... SOURCE FILE CLAMPED ...",
                    deps.vcs,
                    deps.clampTextHeadTail
                )
            )
        );
    } catch {
        return [];
    }
}

// ----------------------------------------------------------------
// LIQUIBASE
// ----------------------------------------------------------------

export function filterLiquibaseFilesFromChanges(
    changedFiles: ChangedFile[],
    maxFiles = 10
): TextRef[] {
    return changedFiles
        .filter((f) => isLiquibaseFile(f.path))
        .slice(0, maxFiles)
        .map((f) => ({
            path: f.path,
            content: f.contentAtHead ?? f.diffText ?? "(no content available in session.files)",
        }));
}

export async function loadLiquibaseContext(
    pr: any,
    headSha: string,
    changedFiles: ChangedFile[],
    opts: { maxFiles: number; maxChars: number; enableFetchFallback: boolean },
    deps: { vcs: any; clampTextHeadTail: any }
): Promise<TextRef[]> {
    const picked = changedFiles.filter((f) => isLiquibaseFile(f.path)).slice(0, opts.maxFiles);

    const out: TextRef[] = [];

    for (const f of picked) {
        const existing = f.contentAtHead ?? f.diffText ?? "";

        if (existing.trim().length > 0) {
            out.push({ path: f.path, content: existing });
            continue;
        }

        if (!opts.enableFetchFallback) continue;

        try {
            const ref = await fetchAndClamp(
                pr,
                headSha,
                f.path,
                opts.maxChars,
                "... LIQUIBASE FILE CLAMPED ...",
                deps.vcs,
                deps.clampTextHeadTail
            );
            out.push(ref);
        } catch {
            out.push({ path: f.path, content: "(failed to fetch)" });
        }
    }

    return out;
}
