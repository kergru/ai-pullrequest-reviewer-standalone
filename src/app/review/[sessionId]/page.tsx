"use client";

import { useEffect, useState } from "react";
import { getDiff, getSession, startMetaReview, startReview } from "@/lib/reviewApiClient";
import { FileTree } from "@/components/FileTree";
import { DiffViewer } from "@/components/DiffViewer";
import { ReviewPanel } from "@/components/ReviewPanel";
import { ReviewDiagnosticsPanel } from "@/components/ReviewDiagnosticsPanel";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

export default function ReviewPage({ params }: { params: { sessionId: string } }) {
    const sessionId = params.sessionId;

    const router = useRouter();

    const [session, setSession] = useState<any | null>(null);
    const [selected, setSelected] = useState<string>("");
    const [diff, setDiff] = useState<string>("");

    const [busy, setBusy] = useState(false);
    const [busyFile, setBusyFile] = useState<string | null>(null);
    const [meta, setMeta] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [showMetaDiagnostics, setShowMetaDiagnostics] = useState(false);

    const files = session?.files ?? [];
    const selectedReview = session?.reviews?.[selected] ?? null;

    const reviewedCount =
        session?.files?.filter(
            (f: any) => f.reviewStatus === "done" || f.reviewStatus === "done_with_warnings"
        ).length ?? 0;

    // ---------------------------
    // Initial load
    // ---------------------------
    useEffect(() => {
        (async () => {
            await loadSession();
        })().catch((e: any) => setError(e?.message ?? "Failed to load session"));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function loadSession(preselect?: string) {
        const s = await getSession(sessionId);
        setSession(s);

        const first = s.files?.[0]?.path ?? "";
        const initial = preselect ?? first;

        if (initial) {
            setSelected(initial);
            setDiff(""); // optional: clear while loading
            await loadDiff(initial); // <-- lädt Diff sofort
        } else {
            setSelected("");
            setDiff("");
        }
    }

    async function loadDiff(filePath: string) {
        const d = await getDiff(sessionId, filePath);
        setDiff(d.diff ?? "");
    }

    // ---------------------------
    // File selection
    // ---------------------------
    async function handleSelectFile(path: string) {
        setError(null);
        setSelected(path);
        try {
            await loadDiff(path);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load diff");
        }
    }

    // ---------------------------
    // Review actions
    // ---------------------------
    async function runReview(path: string) {
        if (!path) return;

        setBusy(true);
        setBusyFile(path);
        setError(null);

        setSession((prev: any) => {
            if (!prev) return prev;

            const next = { ...prev };

            next.files = next.files.map((f: any) => (f.path === path ? { ...f, reviewStatus: "running" } : f));

            next.reviews = { ...(next.reviews ?? {}) };
            next.reviews[path] = {
                ...(next.reviews[path] ?? {}),
                filePath: path,
                status: "running",
            };

            return next;
        });

        try {
            await startReview({ sessionId, filePath: path });

            await loadSession(path);
        } catch (e: any) {
            setError(e?.message ?? "Review failed");
        } finally {
            setBusy(false);
            setBusyFile(null);
        }
    }

    async function toggleIgnore(filePath: string, nextIgnored: boolean) {
        if (!filePath) return;

        setBusy(true);
        setBusyFile(filePath);
        setError(null);

        try {
            const r = await fetch("/api/reviews/ignore", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, filePath, ignored: nextIgnored }),
            });

            if (!r.ok) throw new Error(await r.text());

            await loadSession(filePath);
        } catch (e: any) {
            setError(e?.message ?? "Ignore toggle failed");
        } finally {
            setBusy(false);
            setBusyFile(null);
        }
    }

    async function runMeta() {
        setBusy(true);
        setError(null);

        try {
            const result = await startMetaReview({ sessionId, deleteAfter: true });
            setMeta(result.metaReview);
            setShowMetaDiagnostics(false);

            setSession(null); // last review step, backend deletes session
        } catch (e: any) {
            setError(e?.message ?? "Meta Review failed");
        } finally {
            setBusy(false);
        }
    }

    // ---------------------------
    // Render states
    // ---------------------------
    if (error) {
        return (
            <main style={{ padding: 20, fontFamily: "system-ui" }}>
                <h2>Fehler</h2>
                <pre style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
            </main>
        );
    }

    if (meta) {
        return (
            <main style={{ padding: 20, fontFamily: "system-ui", height: "100vh", overflow: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <h1 style={{ margin: 0 }}>Meta Review</h1>

                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        {meta?.diagnostics ? (
                            <button
                                onClick={() => setShowMetaDiagnostics((v) => !v)}
                                style={{
                                    fontSize: 12,
                                    color: "#2563eb",
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: 0,
                                }}
                                aria-expanded={showMetaDiagnostics}
                            >
                                {showMetaDiagnostics ? "Hide diagnostics" : "Diagnostics"}
                            </button>
                        ) : null}

                        <button
                            onClick={() => router.push("/")}
                            style={{
                                padding: "8px 14px",
                                borderRadius: 8,
                                border: "1px solid #ccc",
                                background: "white",
                                cursor: "pointer",
                                fontWeight: 500,
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>

                {showMetaDiagnostics ? <ReviewDiagnosticsPanel review={meta} /> : null}

                <div style={{ marginTop: 20, fontSize: 14, lineHeight: 1.6 }}>
                    <ReactMarkdown>{meta.outputMarkdown ?? ""}</ReactMarkdown>
                </div>
            </main>
        );
    }

    if (!session) {
        return <main style={{ padding: 20, fontFamily: "system-ui" }}>Lade Session…</main>;
    }

    // ---------------------------
    // Main layout
    // ---------------------------
    return (
        <main
            style={{
                height: "100vh",
                display: "grid",
                gridTemplateRows: "auto 1fr",
                fontFamily: "system-ui",
                overflow: "hidden",
                minHeight: 0,
            }}
        >
            <header
                style={{
                    padding: 12,
                    borderBottom: "1px solid #e5e5e5",
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                }}
            >
                <strong>PR AI Review</strong>
                <span style={{ color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {session.pr?.title} ({session.pr?.projectKey}/{session.pr?.repoSlug} #{session.pr?.prId})
                </span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                    Model: <b>{session.model}</b>
                </span>
            </header>

            <section
                style={{
                    display: "grid",
                    gridTemplateColumns: "320px 1fr 420px",
                    height: "100%",
                    overflow: "hidden",
                    minHeight: 0,
                }}
            >
                {/* Left pane */}
                <div style={{ overflow: "auto", minHeight: 0, borderRight: "1px solid #e5e5e5" }}>
                    <FileTree files={files} selected={selected} onSelect={handleSelectFile} />
                </div>

                {/* Center pane */}
                <div style={{ overflow: "auto", minHeight: 0, borderRight: "1px solid #e5e5e5" }}>
                    <DiffViewer diff={diff} />
                </div>

                {/* Right pane */}
                <div style={{ overflow: "auto", minHeight: 0 }}>
                    <ReviewPanel
                        filePath={selected}
                        review={selectedReview}
                        onReview={() => runReview(selected)}
                        onMeta={runMeta}
                        onToggleIgnore={(nextIgnored) => toggleIgnore(selected, nextIgnored)}
                        metaResult={meta}
                        busy={busy}
                        busyFile={busyFile}
                        reviewedCount={reviewedCount}
                        totalFilesCount={session.files.length}
                    />
                </div>
            </section>
        </main>
    );
}
