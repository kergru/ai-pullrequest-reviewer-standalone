import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { ReviewDiagnosticsPanel } from "./ReviewDiagnosticsPanel";

export function ReviewPanel(
    props: Readonly<{
        filePath: string;
        review: any | null;

        onReview: () => void;
        onMeta: () => void;

        onToggleIgnore: (nextIgnored: boolean) => void;

        metaResult: any | null;
        busy: boolean;
        busyFile?: string | null;
        reviewedCount: number;
        totalFilesCount: number;
    }>
) {
    const {
        filePath,
        review,
        onReview,
        onMeta,
        onToggleIgnore,
        metaResult,
        busy,
        busyFile,
        reviewedCount,
        totalFilesCount,
    } = props;

    const [showDiagnostics, setShowDiagnostics] = useState(false);

    const isReviewingThis = !!busy && busyFile === filePath;

    const isIgnored = review?.status === "ignored";
    const isDone = review?.status === "done" || review?.status === "done_with_warnings" || isIgnored;

    const hasReview = !!review && typeof review === "object" && typeof review.status === "string";

    const canRunMeta = !busy && reviewedCount > 0;

    const canToggleIgnore =
        !busy && !isReviewingThis && hasReview && (isDone || review?.status === "failed");

    return (
        <div
            style={{
                borderLeft: "1px solid #e5e5e5",
                padding: 12,
                height: "100%",
                overflow: "visible",
                boxSizing: "border-box",
            }}
        >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Review</div>

            <div style={{ fontFamily: "ui-monospace", fontSize: 12, marginBottom: 10, opacity: 0.8 }}>
                {filePath}
            </div>

            {isReviewingThis ? (
                <div style={{ marginBottom: 10, fontSize: 12, color: "#666" }}>Review requested… running now.</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button
                    onClick={onReview}
                    disabled={busy}
                    style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid #111",
                        background: "#111",
                        color: "#fff",
                        cursor: busy ? "not-allowed" : "pointer",
                        opacity: busy ? 0.8 : 1,
                    }}
                >
                    {isReviewingThis ? "Reviewing…" : "Review this file"}
                </button>

                <div style={{ fontSize: 12, color: "#6b7280", userSelect: "none" }}>
                    ({reviewedCount} / {totalFilesCount} reviewed)
                </div>

                <button
                    onClick={onMeta}
                    disabled={!canRunMeta}
                    title={
                        !busy && reviewedCount === 0
                            ? "Run at least one file review before generating a meta review."
                            : busy
                                ? "Busy"
                                : "Create a PR-level meta review"
                    }
                    style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        background: "#fff",
                        cursor: !canRunMeta ? "not-allowed" : "pointer",
                        opacity: !canRunMeta ? 0.7 : 1,
                    }}
                >
                    Generate meta review
                </button>
            </div>

            <hr style={{ margin: "14px 0" }} />

            {isDone ? (
                <>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>Result</div>

                            {review?.status === "done_with_warnings" ? (
                                <span style={{ fontSize: 12, color: "#b45309" }}>done with warnings</span>
                            ) : null}

                            {isIgnored ? <span style={{ fontSize: 12, color: "#6b7280" }}>ignored</span> : null}
                        </div>

                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>

                            {hasReview ? (
                                <button
                                    onClick={() => onToggleIgnore(!isIgnored)}
                                    disabled={!canToggleIgnore}
                                    title={isIgnored ? "Include this review in meta review again" : "Exclude this review from meta review"}
                                    style={{
                                        fontSize: 12,
                                        color: isIgnored ? "#065f46" : "#b91c1c",
                                        background: "transparent",
                                        border: "none",
                                        cursor: !canToggleIgnore ? "not-allowed" : "pointer",
                                        padding: 0,
                                        opacity: !canToggleIgnore ? 0.6 : 1,
                                    }}
                                >
                                    {isIgnored ? "Unignore" : "Ignore"}
                                </button>
                            ) : null}

                            <button
                                onClick={() => setShowDiagnostics((v) => !v)}
                                style={{
                                    fontSize: 12,
                                    color: "#2563eb",
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: 0,
                                }}
                                aria-expanded={showDiagnostics}
                            >
                                {showDiagnostics ? "Hide diagnostics" : "Diagnostics"}
                            </button>
                        </div>
                    </div>

                    {showDiagnostics ? <ReviewDiagnosticsPanel review={review} /> : null}

                    <div style={{ fontSize: 12, lineHeight: 1.5, marginTop: 10 }}>
                        <ReactMarkdown>{review.outputMarkdown ?? ""}</ReactMarkdown>
                    </div>
                </>
            ) : (
                <div style={{ color: "#666" }}>{isReviewingThis ? "Reviewing…" : "No review yet for this file."}</div>
            )}

            {metaResult ? (
                <>
                    <hr style={{ margin: "14px 0" }} />
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Meta review</div>

                    {"diagnostics" in metaResult ? <ReviewDiagnosticsPanel review={metaResult} /> : null}

                    <div style={{ fontSize: 12, lineHeight: 1.5, marginTop: 10 }}>
                        <ReactMarkdown>{metaResult.outputMarkdown ?? ""}</ReactMarkdown>
                    </div>
                </>
            ) : null}
        </div>
    );
}
