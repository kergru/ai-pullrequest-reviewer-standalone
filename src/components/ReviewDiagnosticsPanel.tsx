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

function isObject(x: unknown): x is Record<string, any> {
    return typeof x === "object" && x !== null;
}

function pickWarnings(review: any): string[] {
    const w1 = review?.meta?.warnings;
    if (Array.isArray(w1)) return w1;
    const w2 = review?.warnings;
    if (Array.isArray(w2)) return w2;
    const w3 = review?.diagnostics?.warnings;
    if (Array.isArray(w3)) return w3;
    return [];
}

export function ReviewDiagnosticsPanel({ review }: ReviewDiagnosticsPanelProps) {
    const diagnostics = review?.diagnostics;

    const llm =
        (isObject(diagnostics) && isObject(diagnostics.metaLLM) && diagnostics.metaLLM) ||
        (isObject(diagnostics) && typeof diagnostics.model === "string" && diagnostics) ||
        null;

    const warnings = pickWarnings(review);

    const contextRequests: string[] =
        (Array.isArray(diagnostics?.contextRequests) && diagnostics.contextRequests) ||
        (Array.isArray(review?.outputStructured?.missingContext) && review.outputStructured.missingContext) ||
        [];

    const isFileReview = review?.meta?.loadedContext.fileContent !== undefined;
    const isMetaRewiew = !isFileReview;
    const loadedContext = review?.meta?.loadedContext;

    const inputLimit =
        llm?.inputLimitTokens ??
        diagnostics?.inputLimitTokens ??
        review?.inputLimitTokens;

    const reservedOut =
        llm?.reservedOutputTokens ??
        diagnostics?.reservedOutputTokens ??
        review?.reservedOutputTokens;

    const maxOut =
        llm?.maxOutputTokens ??
        diagnostics?.maxOutputTokens ??
        review?.maxOutputTokens;

    const hasAnything =
        !!llm ||
        warnings.length > 0 ||
        contextRequests.length > 0 ||
        !!loadedContext ||
        typeof inputLimit === "number" ||
        typeof maxOut === "number" ||
        typeof reservedOut === "number";

    if (!hasAnything) return null;

    return (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>Diagnostics</h3>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
          {llm?.mode ? `mode: ${llm.mode}` : ""}
        </span>
            </div>

            {/* Summary line */}
            <div style={{ marginTop: 8, fontSize: 12, color: "#111827" }}>
                <strong>Model:</strong> {llm?.model ?? "—"}{" "}
                <span style={{ marginLeft: 12 }}>
          <strong>Duration:</strong> {fmtMs(llm?.durationMs)}
        </span>
                <span style={{ marginLeft: 12 }}>
          <strong>Input limit:</strong> {fmt(inputLimit)}
        </span>
                <span style={{ marginLeft: 12 }}>
          <strong>Reserved output:</strong> {fmt(reservedOut)}
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
                        {fmt(llm?.estimatedInputTokens?.total)}{" "}
                        <span style={{ color: "#6b7280" }}>
              (system {fmt(llm?.estimatedInputTokens?.system)} / user {fmt(llm?.estimatedInputTokens?.user)})
            </span>
                    </div>
                    <div>
                        <strong>Actual usage:</strong>{" "}
                        {llm?.usage
                            ? `${fmt(llm.usage.input_tokens)} in / ${fmt(llm.usage.output_tokens)} out / ${fmt(llm.usage.total_tokens)} total`
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
                        {fmt(llm?.requestChars?.total)}{" "}
                        <span style={{ color: "#6b7280" }}>
                          (system {fmt(llm?.requestChars?.system)} / user {fmt(llm?.requestChars?.user)})
                        </span>
                    </div>
                    <div>
                        <strong>Response ID:</strong> {llm?.responseId ?? "—"}
                    </div>
                </div>
            </div>

            {/* Context loaded */}
            {isFileReview && loadedContext && (
                <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>Context loaded</div>
                    <div style={{ fontSize: 12, color: "#111827", marginTop: 4 }}>
                        <div>
                            <strong>File content:</strong> {loadedContext.fileContent ? "yes" : "no"}
                        </div>
                        <div>
                            <strong>Tests:</strong> {fmt(loadedContext.tests)}
                            <span style={{ marginLeft: 12 }}>
                                <strong>Sources:</strong> {fmt(loadedContext.sources)}
                            </span>
                            <span style={{ marginLeft: 12 }}>
                                <strong>Liquibase:</strong> {fmt(loadedContext.liquibase)}
                            </span>
                         </div>
                    </div>
                </div>
            )}
            {isMetaRewiew && loadedContext?.countFileReviews !== undefined && (
                <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>Meta Review based on:</div>
                    <div style={{ fontSize: 12, color: "#111827", marginTop: 4 }}>
                        <strong>File Reviews:</strong> {fmt(loadedContext.countFileReviews)}
                    </div>
                    <div style={{ fontSize: 12, color: "#111827", marginTop: 4 }}>
                        <strong>Sum Findings:</strong> {fmt(loadedContext.countFindings)}
                    </div>
                </div>
            )}

            {/* Warnings / Missing context */}
            {(warnings.length > 0 || contextRequests.length > 0) && (
                <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>Warnings / Context requests</div>
                    <div style={{ fontSize: 12, color: "#111827", marginTop: 4 }}>
                        {warnings.length > 0 && (
                            <div>
                                <strong>Warnings:</strong>{" "}
                                <span style={{ color: warnings.some((w: string) => w.includes("TRUNCATED")) ? "#b45309" : "#111827" }}>
                                  {warnings.join(", ")}
                                </span>
                            </div>
                        )}
                        {contextRequests.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                                <strong>Missing context:</strong>
                                <ul style={{ margin: "4px 0 0 18px" }}>
                                    {contextRequests.map((x: string, i: number) => (
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