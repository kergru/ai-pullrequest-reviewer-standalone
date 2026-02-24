
import {SessionState} from "./types";

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