import React from "react";

type ReviewDiagnosticsPanelProps = {
    review: any; // später typisieren
};

function fmt(n?: number) {
    if (typeof n !== "number" || !Number.isFinite(n)) return "—";
    return n.toLocaleString();
}

function fmtMs(ms?: number) {
    if (typeof ms !== "number" || !Number.isFinite(ms)) return "—";
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
}

export function ReviewDiagnosticsPanel({ review }: ReviewDiagnosticsPanelProps) {
    const diag = review?.diagnostics;

    const warnings: string[] = Array.isArray(review?.warnings)
        ? review.warnings
        : Array.isArray(diag?.warnings)
            ? diag.warnings
            : [];

    const contextRequests: string[] = Array.isArray(review?.contextRequests)
        ? review.contextRequests
        : Array.isArray(diag?.contextRequests)
            ? diag.contextRequests
            : [];

    const fileContentMeta = review?.fileContentMeta;
    const testsMeta = review?.testsMeta;

    // hide whole block if nothing useful exists
    const hasAnything =
        warnings.length ||
        contextRequests.length ||
        diag ||
        fileContentMeta ||
        testsMeta ||
        review?.inputLimitTokens ||
        review?.maxOutputTokens ||
        diag?.inputLimitTokens ||
        diag?.maxOutputTokens;

    if (!hasAnything) return null;

    const inputLimit = diag?.inputLimitTokens ?? review?.inputLimitTokens;
    const maxOut = diag?.maxOutputTokens ?? review?.maxOutputTokens;

    return (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>Diagnostics</h3>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
          {diag?.mode ? `mode: ${diag.mode}` : ""}
        </span>
            </div>

            {/* Summary line */}
            <div style={{ marginTop: 8, fontSize: 12, color: "#111827" }}>
                <strong>Model:</strong> {diag?.model ?? "—"}{" "}
                <span style={{ marginLeft: 12 }}>
          <strong>Duration:</strong> {fmtMs(diag?.durationMs)}
        </span>
                <span style={{ marginLeft: 12 }}>
          <strong>Input limit:</strong> {fmt(inputLimit)}
        </span>
                <span style={{ marginLeft: 12 }}>
          <strong>Max output:</strong> {fmt(maxOut)}
        </span>
            </div>

            {/* Tokens */}
            <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Tokens</div>
                <div style={{ fontSize: 12, color: "#111827", marginTop: 4 }}>
                    <div>
                        <strong>Estimated input:</strong>{" "}
                        {fmt(diag?.estimatedInputTokens?.total)}{" "}
                        <span style={{ color: "#6b7280" }}>
              (system {fmt(diag?.estimatedInputTokens?.system)} / user {fmt(diag?.estimatedInputTokens?.user)})
            </span>
                    </div>
                    <div>
                        <strong>Actual usage:</strong>{" "}
                        {diag?.usage
                            ? `${fmt(diag.usage.input_tokens)} in / ${fmt(diag.usage.output_tokens)} out / ${fmt(diag.usage.total_tokens)} total`
                            : "—"}
                    </div>
                </div>
            </div>

            {/* Request size */}
            <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Request size</div>
                <div style={{ fontSize: 12, color: "#111827", marginTop: 4 }}>
                    <div>
                        <strong>Chars:</strong>{" "}
                        {fmt(diag?.requestChars?.total)}{" "}
                        <span style={{ color: "#6b7280" }}>
              (system {fmt(diag?.requestChars?.system)} / user {fmt(diag?.requestChars?.user)})
            </span>
                    </div>
                    <div>
                        <strong>Response ID:</strong> {diag?.responseId ?? "—"}
                    </div>
                </div>
            </div>

            {/* Smart context */}
            {(fileContentMeta || testsMeta) && (
                <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>Context</div>
                    <div style={{ fontSize: 12, color: "#111827", marginTop: 4 }}>
                        <div>
                            <strong>File content:</strong>{" "}
                            {fileContentMeta
                                ? `${fileContentMeta.fetched ? "fetched" : "not fetched"} (reason: ${fileContentMeta.reason ?? "—"})${
                                    fileContentMeta.clamped ? ", clamped" : ""
                                }`
                                : "—"}
                        </div>
                        <div>
                            <strong>Tests:</strong>{" "}
                            {testsMeta
                                ? `${testsMeta.fetchedCount ?? 0} files (usedIndex: ${String(!!testsMeta.usedIndex)}) (reason: ${testsMeta.reason ?? "—"})`
                                : "—"}
                        </div>
                    </div>
                </div>
            )}

            {/* Warnings */}
            {(warnings.length > 0 || contextRequests.length > 0) && (
                <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>Warnings / Context requests</div>
                    <div style={{ fontSize: 12, color: "#111827", marginTop: 4 }}>
                        {warnings.length > 0 && (
                            <div>
                                <strong>Warnings:</strong>{" "}
                                <span style={{ color: warnings.some((w) => w.includes("TRUNCATED")) ? "#b45309" : "#111827" }}>
                  {warnings.join(", ")}
                </span>
                            </div>
                        )}
                        {contextRequests.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                                <strong>Missing context:</strong>
                                <ul style={{ margin: "4px 0 0 18px" }}>
                                    {contextRequests.map((x, i) => (
                                        <li key={`${x}-${i}`}>{x}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}