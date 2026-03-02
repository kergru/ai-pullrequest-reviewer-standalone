import type { SessionState } from "@/lib/session";
import type { ChangedFile, ContextBundle, TextRef } from "./types";
import { vcs } from "@/lib/vcs/client";
import { clampTextHeadTail } from "@/lib/review/shared";
import { envBool, envInt } from "@/lib/utils/utilFunctions";
import {VcsPrRef} from "@/lib/vcs";

export async function loadContextBundle(
    session: SessionState,
    filePath: string,
    fileContent: string,
    headSha: string | undefined,
): Promise<ContextBundle> {
    const relatedTests: TextRef[] = [];
    const relatedSources: TextRef[] = [];
    let relatedLiquibase: TextRef[] = [];

    const testOpts = {
        enabled: envBool("OPENAI_CONTEXT_INCLUDE_TESTS", true),
        maxFiles: envInt("OPENAI_CONTEXT_MAX_TEST_FILES", 3),
        maxChars: envInt("OPENAI_CONTEXT_MAX_TEST_CHARS", 18_000),
    };

    const sourceOpts = {
        enabled: envBool("OPENAI_CONTEXT_INCLUDE_JAVA_SOURCES", true),
        maxFiles: envInt("OPENAI_CONTEXT_MAX_JAVA_SOURCE_FILES", 3),
        maxChars: envInt("OPENAI_CONTEXT_MAX_JAVA_SOURCE_CHARS", 18_000),
    };

    const liquibaseOpts = {
        enabled: envBool("OPENAI_CONTEXT_INCLUDE_LIQUIBASE", true),
        maxFiles: envInt("OPENAI_CONTEXT_MAX_LIQUIBASE_FILES", 10),
        maxChars: envInt("OPENAI_CONTEXT_MAX_LIQUIBASE_CHARS", 18_000),
        fetchFallback: envBool("OPENAI_CONTEXT_LIQUIBASE_FETCH_FALLBACK", false),
    };

    // ---- JAVA CONTEXT ----
    if (isJavaSourceFile(filePath) && headSha) {
        relatedTests.push(
            ...(await findRelatedTestsForSource(session.pr, headSha, filePath, testOpts))
        );
        // try to lookup some relevant sources as well
        relatedSources.push(
            ...(await findRelatedSourcesFromImport(session.pr, headSha, filePath, fileContent, sourceOpts))
        );
    }

    if (isJavaTestFile(filePath) && headSha) {
        relatedSources.push(
            ...(await findRelatedSourcesForTest(session.pr, headSha, filePath, sourceOpts))
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
                }
            );
        }

        relatedLiquibase = sortLiquibaseFirstChangelog(relatedLiquibase);
    }

    return { relatedTests, relatedSources, relatedLiquibase };
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
    pr: VcsPrRef,
    headSha: string,
    path: string,
    maxChars: number,
    clampMsg: string,
): Promise<TextRef> {
    const raw = await vcs.getFileContentAtCommit(pr, path, headSha);
    const clamped = clampTextHeadTail(raw, maxChars, clampMsg);
    return { path, content: clamped.text };
}

async function findRelatedTestsForSource(
    pr: VcsPrRef,
    headSha: string,
    filePath: string,
    opts: { maxFiles: number; maxChars: number; enabled: boolean },
): Promise<TextRef[]> {
    if (!opts.enabled || opts.maxFiles <= 0) return [];

    const base = baseNameOf(filePath);
    const testDir = toTargetPackageDir(filePath, "main", "test");

    try {
        const entries: string[] = await vcs.listFilesInDirAtCommit(pr, headSha, testDir);

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
                    "... TEST FILE CLAMPED ..."
                )
            )
        );
    } catch {
        return [];
    }
}

async function findRelatedSourcesForTest(
    pr: VcsPrRef,
    headSha: string,
    filePath: string,
    opts: { maxFiles: number; maxChars: number; enabled: boolean },
): Promise<TextRef[]> {
    if (!opts.enabled || opts.maxFiles <= 0) return [];

    const testBase = baseNameOf(filePath);
    const srcBase = stripTestSuffix(testBase);
    const srcDir = toTargetPackageDir(filePath, "test", "main");

    try {
        const entries: string[] = await vcs.listFilesInDirAtCommit(pr, headSha, srcDir);

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
                    "... SOURCE FILE CLAMPED ..."
                )
            )
        );
    } catch {
        return [];
    }
}

// parse imports from the java file content and try to fetch some of them as context, prioritizing those from the same package
async function findRelatedSourcesFromImport(pr: VcsPrRef, headSha: string, filePath: string, fileContent: string, sourceOpts: {
    enabled: boolean;
    maxFiles: number;
    maxChars: number
}) {
    if (!sourceOpts.enabled || sourceOpts.maxFiles <= 0) return [];

    //eventually load file content here if not already loaded
    let fileContentToUse = fileContent;
    if(!fileContentToUse) {
        try {
            fileContentToUse = await vcs.getFileContentAtCommit(pr, filePath, headSha);
        } catch (e: any) {
            console.warn(`⚠️ Could not fetch file content for ${filePath}: ${e?.message ?? String(e)}`);
        }
    }
    const importLines = fileContentToUse
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("import ") && l.endsWith(";"));
    const imports = importLines.map((l) => {
        const imp = l.slice(7, -1).trim(); // remove "import " and ";"
        return imp;
    });

    // filter Service or Client classes
    const filtered = imports.filter((imp) => {
        const name = imp.slice(imp.lastIndexOf(".") + 1);
        // Regex: endet mit einem Kleinbuchstaben gefolgt von Service oder Client
        return /[a-z]Service$/.test(name) || /[a-z]Client$/.test(name);
    });

    const chosenImports = filtered
        .slice(0, sourceOpts.maxFiles)
        .map((imp) => imp.replaceAll(".", "/") + ".java");

    const refs: TextRef[] = [];

    for (const impPath of chosenImports) {
        try {
            const ref = await fetchAndClamp(
                pr,
                headSha,
                `src/main/java/${impPath}`,
                sourceOpts.maxChars,
                "... SOURCE FILE CLAMPED ..."
            );
            refs.push(ref);
        } catch {
            // ignore fetch errors, just skip the file
        }
    }

    return refs;
}

// ----------------------------------------------------------------
// LIQUIBASE
// ----------------------------------------------------------------

function filterLiquibaseFilesFromChanges(
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

async function loadLiquibaseContext(
    pr: VcsPrRef,
    headSha: string,
    changedFiles: ChangedFile[],
    opts: { maxFiles: number; maxChars: number; enableFetchFallback: boolean },
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
                "... LIQUIBASE FILE CLAMPED ..."
            );
            out.push(ref);
        } catch {
            out.push({ path: f.path, content: "(failed to fetch)" });
        }
    }

    return out;
}
