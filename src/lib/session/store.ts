import {VcsPrRef} from "@/lib/vcs";

export type FileEntry = {
    path: string;
    type: "code" | "template" | "db" | "config" | "docs" | "other";
    additions: number;
    deletions: number;
    reviewStatus: "pending" | "running" | "done" | "done_with_warnings" | "failed" | "ignored";
};

export type ReviewResult = {
    filePath: string;
    status: "queued" | "running" | "done" | "done_with_warnings" | "failed" | "ignored";
    outputText?: string;
    outputStructured?: any;
    warnings?: string[];
    contextRequests?: string[];
    inputLimitTokens?: number;
    hadFileContent?: boolean;
    fileContentMeta?: {
        attempted: boolean;
        fetched: boolean;
        reason?: string; // if !attempted, why not (e.g. "no_toCommit" or "decision_reject")
    };
    testsMeta?: { attempted: boolean; fetchedCount: number; reason: string; usedIndex: boolean };
    relatedTests?: Array<{ path: string }>;
    diagnostics?: {
        warnings?: string[];
        contextRequests?: string[];
        inputLimitTokens?: number;
        maxOutputTokens?: number;
        meta?: any; // LlmCallMeta (model/duration/tokens/usage/...)
    }
};

export type SessionState = {
    id: string;
    createdAt: number;
    expiresAt: number;
    pr: VcsPrRef;
    jira?: { key: string; summary: string; description: string; acceptanceCriteria: string };
    prompt: string;
    model: string;
    files: FileEntry[];
    reviews: Record<string, ReviewResult>;
    inFlight: boolean;
};

// ---- GLOBAL SINGLETON (prevents HMR/module duplication issues) ----
type GlobalWithSessions = typeof globalThis & { __pr_ai_review_sessions__?: Map<string, SessionState> };

const g = globalThis as GlobalWithSessions;
const sessions: Map<string, SessionState> = g.__pr_ai_review_sessions__ ?? (g.__pr_ai_review_sessions__ = new Map());

function isExpired(s: SessionState, now = Date.now()) {
    return s.expiresAt <= now;
}

export function putSession(s: SessionState) {
    sessions.set(s.id, s);
}

export function getSession(id: string) {
    const s = sessions.get(id);
    if (!s) return undefined;

    if (isExpired(s)) {
        sessions.delete(id);
        return undefined;
    }
    return s;
}

export function deleteSession(id: string) {
    sessions.delete(id);
}

export function listSessionIds() {
    return Array.from(sessions.keys());
}