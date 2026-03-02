"use client";

import { useEffect, useState } from "react";
import { getDiff, getModels, getSession, startMetaReview, startReview, updateSessionSettings } from "@/lib/reviewApiClient";
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
    const [selectedFilePath, setSelectedFilePath] = useState<string>("");
    const [selectedFileDiff, setSelectedFileDiff] = useState<string>("");

    const [busy, setBusy] = useState(false);
    const [busyFile, setBusyFile] = useState<string | null>(null);
    const [metaReview, setMetaReview] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [availableModels, setAvailableModels] = useState<Array<{ id: string; label: string }>>([]);
    const [isSessionSettingsUpdating, setIsSessionSettingsUpdating] = useState(false);
    const [sessionSettingsError, setSessionSettingsError] = useState<string | null>(null);

    const [showMetaDiagnostics, setShowMetaDiagnostics] = useState(false);

    const changedFiles = session?.files ?? [];
    const selectedReview = session?.reviews?.[selectedFilePath] ?? null;

    const reviewedCount =
        session?.files?.filter(
            (file: any) => file.reviewStatus === "done" || file.reviewStatus === "done_with_warnings"
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

    useEffect(() => {
        (async () => {
            try {
                const modelsResponse = await getModels();
                const fetchedModels = modelsResponse.models ?? [];
                const defaultModel = modelsResponse.default ?? fetchedModels[0]?.id ?? "gpt-4.1-mini";
                setAvailableModels(
                    fetchedModels.length ? fetchedModels : [{ id: defaultModel, label: defaultModel }]
                );
            } catch {
                const fallbackModel = "gpt-4.1-mini";
                setAvailableModels([{ id: fallbackModel, label: fallbackModel }]);
            }
        })();
    }, []);

    async function loadSession(preselectedFilePath?: string) {
        const sessionData = await getSession(sessionId);
        setSession(sessionData);

        const firstFilePath = sessionData.files?.[0]?.path ?? "";
        const initialFilePath = preselectedFilePath ?? firstFilePath;

        if (initialFilePath) {
            setSelectedFilePath(initialFilePath);
            setSelectedFileDiff("");
            await loadDiff(initialFilePath);
        } else {
            setSelectedFilePath("");
            setSelectedFileDiff("");
        }
    }

    async function loadDiff(filePath: string) {
        const diffResponse = await getDiff(sessionId, filePath);
        setSelectedFileDiff(diffResponse.diff ?? "");
    }

    // ---------------------------
    // File selection
    // ---------------------------
    async function handleSelectFile(filePath: string) {
        setError(null);
        setSelectedFilePath(filePath);
        try {
            await loadDiff(filePath);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load diff");
        }
    }

    // ---------------------------
    // Review actions
    // ---------------------------
    async function runReview(filePath: string) {
        if (!filePath) return;

        setBusy(true);
        setBusyFile(filePath);
        setError(null);

        setSession((previousSession: any) => {
            if (!previousSession) return previousSession;

            const updatedSession = { ...previousSession };

            updatedSession.files = updatedSession.files.map((file: any) =>
                file.path === filePath ? { ...file, reviewStatus: "running" } : file
            );

            updatedSession.reviews = { ...(updatedSession.reviews ?? {}) };
            updatedSession.reviews[filePath] = {
                ...(updatedSession.reviews[filePath] ?? {}),
                filePath,
                status: "running",
            };

            return updatedSession;
        });

        try {
            await startReview({ sessionId, filePath });

            await loadSession(filePath);
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
            const response = await fetch("/api/reviews/ignore", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, filePath, ignored: nextIgnored }),
            });

            if (!response.ok) throw new Error(await response.text());

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
            const metaReviewResponse = await startMetaReview({ sessionId, deleteAfter: true });
            setMetaReview(metaReviewResponse.metaReview);
            setShowMetaDiagnostics(false);

            setSession(null); // last review step, backend deletes session
        } catch (e: any) {
            setError(e?.message ?? "Meta Review failed");
        } finally {
            setBusy(false);
        }
    }

    async function updateSessionSetting(
        patch: { model?: string; language?: "EN" | "DE" | "RU" },
        fallback: { model: string; language: string }
    ) {
        setSessionSettingsError(null);
        setIsSessionSettingsUpdating(true);

        setSession((previousSession: any) =>
            previousSession ? { ...previousSession, ...patch } : previousSession
        );

        try {
            await updateSessionSettings(sessionId, patch);
        } catch (e: any) {
            setSession((previousSession: any) =>
                previousSession ? { ...previousSession, model: fallback.model, language: fallback.language } : previousSession
            );
            setSessionSettingsError(e?.message ?? "Failed to update session settings");
        } finally {
            setIsSessionSettingsUpdating(false);
        }
    }

    async function handleModelChange(nextModel: string) {
        if (!session || !nextModel || session.model === nextModel) return;

        await updateSessionSetting(
            { model: nextModel },
            { model: session.model, language: session.language ?? "EN" }
        );
    }

    async function handleLanguageChange(nextLanguage: "EN" | "DE" | "RU") {
        if (!session || !nextLanguage || session.language === nextLanguage) return;

        await updateSessionSetting(
            { language: nextLanguage },
            { model: session.model, language: session.language ?? "EN" }
        );
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

    if (metaReview) {
        return (
            <main style={{ padding: 20, fontFamily: "system-ui", height: "100vh", overflow: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <h1 style={{ margin: 0 }}>Meta Review</h1>

                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        {metaReview?.diagnostics ? (
                            <button
                                onClick={() => setShowMetaDiagnostics((visible) => !visible)}
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

                {showMetaDiagnostics ? <ReviewDiagnosticsPanel review={metaReview} /> : null}

                <div style={{ marginTop: 20, fontSize: 14, lineHeight: 1.6 }}>
                    <ReactMarkdown>{metaReview.outputMarkdown ?? ""}</ReactMarkdown>
                </div>
            </main>
        );
    }

    if (!session) {
        return <main style={{ padding: 20, fontFamily: "system-ui" }}>Lade Session...</main>;
    }

    const modelOptions =
        availableModels.some((modelOption) => modelOption.id === session.model)
            ? availableModels
            : [...availableModels, { id: session.model, label: session.model }];

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
                    {session.pr?.displayTitle}
                </span>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#666" }}>Model</span>
                    <select
                        value={session.model}
                        onChange={(e) => handleModelChange(e.target.value)}
                        disabled={isSessionSettingsUpdating}
                        style={{ padding: "6px 8px", fontSize: 12 }}
                    >
                        {modelOptions.map((modelOption) => (
                            <option key={modelOption.id} value={modelOption.id}>
                                {modelOption.label}
                            </option>
                        ))}
                    </select>

                    <span style={{ fontSize: 12, color: "#666", marginLeft: 8 }}>Language</span>
                    <select
                        value={session.language ?? "EN"}
                        onChange={(e) => handleLanguageChange(e.target.value as "EN" | "DE" | "RU")}
                        disabled={isSessionSettingsUpdating}
                        style={{ padding: "6px 8px", fontSize: 12 }}
                    >
                        <option value="EN">EN</option>
                        <option value="DE">DE</option>
                        <option value="RU">RU</option>
                    </select>

                    {isSessionSettingsUpdating ? <span style={{ fontSize: 12, color: "#666" }}>Saving...</span> : null}
                    {sessionSettingsError ? <span style={{ fontSize: 12, color: "red" }}>{sessionSettingsError}</span> : null}
                </div>
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
                    <FileTree files={changedFiles} selected={selectedFilePath} onSelect={handleSelectFile} />
                </div>

                {/* Center pane */}
                <div style={{ overflow: "auto", minHeight: 0, borderRight: "1px solid #e5e5e5" }}>
                    <DiffViewer diff={selectedFileDiff} />
                </div>

                {/* Right pane */}
                <div style={{ overflow: "auto", minHeight: 0 }}>
                    <ReviewPanel
                        filePath={selectedFilePath}
                        review={selectedReview}
                        onReview={() => runReview(selectedFilePath)}
                        onMeta={runMeta}
                        onToggleIgnore={(nextIgnored) => toggleIgnore(selectedFilePath, nextIgnored)}
                        metaResult={metaReview}
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
