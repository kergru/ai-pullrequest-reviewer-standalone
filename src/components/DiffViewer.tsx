// typescript
// Datei: `src/components/DiffViewer.tsx`
import React from "react";

export function DiffViewer({ diff }: { diff: string }) {
    const lines = diff.split("\n");

    // 1) Pre-scan, um maximale Zeilennummern (für Breite) zu bestimmen
    let scanOld = 0;
    let scanNew = 0;
    let maxOld = 0;
    let maxNew = 0;

    function parseHunk(header: string) {
        const match = header.match(/@@ -(\d+),?\d* \+(\d+),?/);
        if (match) {
            scanOld = Number(match[1]);
            scanNew = Number(match[2]);
        }
    }

    for (const line of lines) {
        if (line.startsWith("@@")) {
            parseHunk(line);
            continue;
        }
        if (
            line.startsWith("diff --git") ||
            line.startsWith("index ") ||
            line.startsWith("--- ") ||
            line.startsWith("+++ ")
        ) {
            continue;
        }

        if (line.startsWith("+")) {
            maxNew = Math.max(maxNew, scanNew);
            scanNew++;
        } else if (line.startsWith("-")) {
            maxOld = Math.max(maxOld, scanOld);
            scanOld++;
        } else {
            maxOld = Math.max(maxOld, scanOld);
            maxNew = Math.max(maxNew, scanNew);
            scanOld++;
            scanNew++;
        }
    }

    const maxLine = Math.max(maxOld, maxNew, 1);
    const digitCount = String(maxLine).length;

    // Nutze 'ch' für monospace-ziffern: +1 für etwas Puffer, Mindestbreite 3ch
    const lnCh = Math.max(3, digitCount + 1);

    const lnStyle: React.CSSProperties = {
        width: `${lnCh}ch`,
        minWidth: `${lnCh}ch`,
        flexShrink: 0,
        textAlign: "left", // linksbündig wie gewünscht
        paddingLeft: 0,
        color: "#6e7781",
        userSelect: "none",
        overflow: "hidden",
        whiteSpace: "nowrap"
    };

    // 2) Rendering, Zeilen zählen neu setzen
    let oldLine = 0;
    let newLine = 0;

    function parseHunkForRender(header: string) {
        const match = header.match(/@@ -(\d+),?\d* \+(\d+),?/);
        if (match) {
            oldLine = Number(match[1]);
            newLine = Number(match[2]);
        }
    }

    return (
        <pre style={preStyle}>
            {lines.map((line, i) => {
                if (line.startsWith("@@")) {
                    parseHunkForRender(line);
                    return null;
                }

                if (
                    line.startsWith("diff --git") ||
                    line.startsWith("index ") ||
                    line.startsWith("--- ") ||
                    line.startsWith("+++ ")
                ) {
                    return null;
                }

                let left: number | "" = "";
                let right: number | "" = "";

                if (line.startsWith("+")) {
                    right = newLine++;
                } else if (line.startsWith("-")) {
                    left = oldLine++;
                } else {
                    left = oldLine++;
                    right = newLine++;
                }

                // Anzeige: entferne ein führendes '+', '-' oder Leerzeichen
                const displayContent = line.replace(/^([+\-\s])/, "");

                return (
                    <Row
                        key={i}
                        left={left}
                        right={right}
                        content={displayContent}
                        type={
                            line.startsWith("+")
                                ? "add"
                                : line.startsWith("-")
                                    ? "del"
                                    : "ctx"
                        }
                        lnStyle={lnStyle}
                    />
                );
            })}
        </pre>
    );
}

function Row({
                 left,
                 right,
                 content,
                 type,
                 lnStyle
             }: {
    left: number | "";
    right: number | "";
    content: string;
    type: "add" | "del" | "ctx" | "hunk";
    lnStyle: React.CSSProperties;
}) {
    const style =
        type === "add"
            ? { background: "#e6ffed", color: "#1a7f37" }
            : type === "del"
                ? { background: "#ffebe9", color: "#cf222e" }
                : type === "hunk"
                    ? { background: "#f6f8fa", color: "#6f42c1", fontWeight: 600 }
                    : {};

    return (
        <div style={{ display: "flex", whiteSpace: "pre", alignItems: "flex-start" }}>
            <span style={lnStyle}>{left}</span>
            <span style={lnStyle}>{right}</span>
            <span style={{ flex: 1, ...style }}>{content}</span>
        </div>
    );
}

const preStyle: React.CSSProperties = {
    margin: 0,
    padding: 12,
    fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
    fontSize: 12,
    background: "#ffffff",
    color: "#24292f",
    borderLeft: "1px solid #e5e7eb",
    overflowX: "auto"
};
