"use client";

import { useEffect, useRef, useState } from "react";
import { createSession, getModels, resolveJira } from "@/lib/reviewApiClient";
import { DEFAULT_USER_REVIEW_PROMPT } from "@/lib/prompts/defaultPrompt";

export default function IntakePage() {
    const [prUrl, setPrUrl] = useState("");
    const [jiraKey, setJiraKey] = useState("");
    const [prompt, setPrompt] = useState(DEFAULT_USER_REVIEW_PROMPT);

    const [models, setModels] = useState<Array<{ id: string; label: string }>>([]);
    const [model, setModel] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [jiraLoading, setJiraLoading] = useState(false);
    const [jiraError, setJiraError] = useState<string | null>(null);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lookupSeqRef = useRef(0);

    // Load models
    useEffect(() => {
        (async () => {
            try {
                const m = await getModels();
                const ms = m.models ?? [];
                const def = m.default ?? ms[0]?.id ?? "gpt-4.1-mini";
                setModels(ms.length ? ms : [{ id: def, label: def }]);
                setModel(def);
            } catch {
                const def = "gpt-4.1-mini";
                setModels([{ id: def, label: def }]);
                setModel(def);
            }
        })();
    }, []);

    function scheduleJiraResolve(nextUrl: string) {
        setJiraError(null);

        // Bei jeder URL-Änderung sofort "optimistisch" resetten,
        // damit kein stale jiraKey angezeigt wird.
        setJiraKey("");

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(async () => {
            const url = nextUrl.trim();

            // Wenn leer -> sauber aufräumen
            if (!url) {
                lookupSeqRef.current++;
                setJiraLoading(false);
                setJiraError(null);
                return;
            }

            const seq = ++lookupSeqRef.current;
            setJiraLoading(true);

            try {
                const r = await resolveJira(url);
                if (seq !== lookupSeqRef.current) return;

                // Wichtig: auch "kein Key gefunden" explizit abbilden
                if (r?.jiraKey) {
                    setJiraKey(r.jiraKey);
                } else {
                    setJiraKey("");
                    // Optional: UX-Hinweis statt Error (je nachdem, wie ihr es wollt)
                    // setJiraError("No Jira issue key found for this PR.");
                }
            } catch (e: any) {
                if (seq !== lookupSeqRef.current) return;
                setJiraKey("");
                setJiraError(e?.message ?? "Failed to resolve Jira issue");
            } finally {
                if (seq === lookupSeqRef.current) setJiraLoading(false);
            }
        }, 400);
    }

    async function onSubmit() {
        setError(null);
        setLoading(true);

        try {
            const resp = await createSession({
                pullRequestUrl: prUrl.trim(),
                jiraKey: jiraKey.trim() || undefined,
                prompt,
                model,
                ttlMinutes: 60,
                autoReviewFirstFile: true
            });

            window.location.href = `/review/${resp.sessionId}`;
        } catch (e: any) {
            setError(e?.message ?? "Failed to create session");
        } finally {
            setLoading(false);
        }
    }

    const canSubmit = !!prUrl.trim() && !!model && !loading;

    return (
        <main style={{ maxWidth: 900, margin: "10px auto", padding: 16, fontFamily: "system-ui" }}>
            <h1 style={{ fontSize: 28 }}>PullRequest AI Review</h1>
            <p style={{ color: "#555" }}>
                Paste a Bitbucket PR URL. The linked Jira issue will be resolved automatically.
            </p>

            <label>Pull Request URL</label>
            <input
                value={prUrl}
                onChange={(e) => {
                    setPrUrl(e.target.value);
                    scheduleJiraResolve(e.target.value);
                }}
                placeholder="https://bitbucket/.../pull-requests/123/overview"
                style={{ width: "100%", padding: 10, marginTop: 6 }}
            />

            <label style={{ marginTop: 16, display: "block" }}>Jira Issue</label>
            <input
                value={jiraKey}
                onChange={(e) => setJiraKey(e.target.value)}
                placeholder="ABC-123"
                style={{ width: "100%", padding: 10 }}
            />

            {jiraLoading && <div style={{ marginTop: 6 }}>Resolving Jira issue…</div>}
            {jiraError && <div style={{ color: "red" }}>{jiraError}</div>}

            <label style={{ marginTop: 16, display: "block" }}>Review Prompt</label>
            <textarea
                rows={10}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                style={{ width: "100%", padding: 10, fontFamily: "monospace" }}
            />

            <label style={{ marginTop: 16, display: "block" }}>Model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)} style={{ padding: 10, marginBottom: 20}}>
                {models.map((m) => (
                    <option key={m.id} value={m.id}>
                        {m.label}
                    </option>
                ))}
            </select>

            {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}

            <button
                onClick={onSubmit}
                disabled={!canSubmit}
                style={{
                    marginLeft: 20,
                    padding: "10px 16px",
                    background: canSubmit ? "black" : "#ccc",
                    color: "white",
                    borderRadius: 8
                }}
            >
                {loading ? "Creating session…" : "Start Review"}
            </button>
        </main>
    );
}