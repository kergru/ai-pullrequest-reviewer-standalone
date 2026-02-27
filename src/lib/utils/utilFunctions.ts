
export function envInt(name: string, fallback: number) {
    const raw = (process.env[name] ?? "").trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function envBool(name: string, fallback: boolean) {
    const raw = (process.env[name] ?? "").trim().toLowerCase();
    if (!raw) return fallback;
    return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function mustEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}

export function optionalEnv(name: string): string | undefined {
    const v = process.env[name];
    return v?.trim() ? v.trim() : undefined;
}


export function extOf(path: string) {
    const p = normalizePath(path);
    const i = p.lastIndexOf(".");
    return i >= 0 ? p.slice(i + 1).toLowerCase() : "";
}

export function normalizePath(p: string | undefined | null) {
    if (!p) return "";
    return String(p)
        .trim()
        .replace(/^"+|"+$/g, "") // strip quotes
        .replace(/^[ab]\//, "")  // strip a/ or b/
        .replace(/^\/+/, "")
        .replace(/\\/g, "/");
}