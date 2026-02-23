export function splitUnifiedDiffByFile(full: string): Map<string, string> {
    const map = new Map<string, string>();
    if (!full) return map;

    const lines = full.split(/\r?\n/);

    let buf: string[] = [];
    let curKey: string | null = null;

    // track within a file block
    let aPath: string | null = null;
    let bPath: string | null = null;
    let renameTo: string | null = null;

    const norm = (p: string) =>
        String(p ?? "")
            .trim()
            .replace(/^"+|"+$/g, "") // strip quotes
            .replace(/^[ab]\//, "")  // strip a/ or b/
            .replace(/^\/+/, "")
            .replace(/\\/g, "/");

    const pickKey = () => {
        if (renameTo) return norm(renameTo);
        if (bPath && bPath !== "/dev/null") return norm(bPath);
        if (aPath && aPath !== "/dev/null") return norm(aPath);
        return null;
    };

    const flush = () => {
        if (curKey && buf.length) map.set(curKey, buf.join("\n"));
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

export function normPath(p: string) {
    return String(p ?? "")
        .trim()
        .replace(/^[ab]\//, "")
        .replace(/^\/+/, "")
        .replace(/\\/g, "/");
}

export function extOf(path: string) {
    const p = normPath(path);
    const i = p.lastIndexOf(".");
    return i >= 0 ? p.slice(i + 1).toLowerCase() : "";
}

export function findDiffForPath(byFile: Map<string, string>, filePath: string): string | null {
    const wanted = normPath(filePath);

    const direct = byFile.get(filePath) ?? byFile.get(wanted);
    if (direct) return direct;

    for (const [k, v] of byFile.entries()) {
        if (normPath(k) === wanted) return v;
    }
    for (const [k, v] of byFile.entries()) {
        const nk = normPath(k);
        if (nk.endsWith(wanted) || wanted.endsWith(nk)) return v;
    }
    return null;
}