import { vcs } from "@/lib/vcs/client";
import type { SessionState } from "@/lib/session/types";
import { normalizePath } from "@/lib/utils/utilFunctions";

export async function getDiffForFile(session: SessionState, filePath: string) {
    const lookupKey = normalizePath(filePath);

    const fileEntry = session.files?.find((f) => f.path === lookupKey);
    if (fileEntry?.diffText) return fileEntry.diffText;

    const diff = getFromMap(session.diffMap, lookupKey);
    if (diff) return diff;

    const fullDiff = await vcs.getDiff(session.pr);
    const byFile = splitUnifiedDiffByFile(fullDiff);

    // store on session for subsequent lookups
    session.diffMap = byFile;

    // Also populate session.files[].diffText where possible for quicker subsequent access
    if (Array.isArray(session.files) && session.files.length > 0) {
        for (const f of session.files) {
            if (!f.diffText) {
                const key = normalizePath(f.path);
                const diff = getFromMap(session.diffMap, key);
                if (diff) f.diffText = diff;
            }
        }
    }

    const diff2 = getFromMap(session.diffMap, lookupKey) ?? null;
    return diff2;
}

function splitUnifiedDiffByFile(full: string): Map<string, string> {
    const map = new Map<string, string>();
    if (!full) return map;

    const lines = full.split(/\r?\n/);

    let buf: string[] = [];
    let curKey: string | null = null;

    // track within a file block
    let aPath: string | null = null;
    let bPath: string | null = null;
    let renameTo: string | null = null;

    const pickKey = () => {
        if (renameTo) return normalizePath(renameTo);
        if (bPath && bPath !== "/dev/null") return normalizePath(bPath);
        if (aPath && aPath !== "/dev/null") return normalizePath(aPath);
        return null;
    };

    const flush = () => {
        if (curKey === null) return;
        const raw = curKey;
        const key = normalizeKey(raw);
        map.set(key, buf.join("\n"));

        buf = [];
        curKey = null;
        aPath = null;
        bPath = null;
        renameTo = null;
    };

    for (const line of lines) {
        if (line.startsWith("diff --git ")) {
            flush();
            buf.push(line);

            // diff --git a/foo b/bar  (sometimes quoted)
            const m = /^diff --git (.+) (.+)$/.exec(line);
            if (m) {
                aPath = m[1];
                bPath = m[2];
                curKey = pickKey();
            }
            continue;
        }

        if (buf.length === 0) continue; // ignore preamble before first diff block

        buf.push(line);

        if (line.startsWith("rename to ")) {
            renameTo = line.slice("rename to ".length).trim();
            curKey = pickKey();
            continue;
        }

        if (line.startsWith("--- ")) {
            aPath = line.slice(4).trim();
            curKey = pickKey();
            continue;
        }

        if (line.startsWith("+++ ")) {
            bPath = line.slice(4).trim();
            curKey = pickKey();
            continue;
        }
    }

    flush();
    return map;
}

function normalizeKey(path: string) {
    if (!path) return "";
    // normalized path with forward slashes
    const p = normalizePath(path);
    // remove common dst:// prefix if present
    let key = p.replace(/^dst:\/\//, "");
    // remove everything up to the java/ segment if present (keeps package path)
    key = key.replace(/^.*?\/java\//, "");
    return key;
}

function getFromMap(diffMap: Map<string,string> | undefined, lookupKey: string) {
    if (diffMap && diffMap instanceof Map) {
        let d = diffMap.get(lookupKey);
        if (d) return d;
        d = diffMap.get(lookupKey.replace("src/main/java/", ""));
        if (d) return d;
        d = diffMap.get(lookupKey.replace("src/test/java/", ""));
        if (d) return d;
    }
    return null;
}
