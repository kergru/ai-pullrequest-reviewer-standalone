import React from "react";

export function DiffViewer({ diff }: { diff: string }) {
    const lines = diff.split("\n");

    let oldLine = 0;
    let newLine = 0;

    function parseHunk(header: string) {
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
              parseHunk(line);
              return (
                  <Row key={i} left="" right="" content={line} type="hunk" />
              );
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

          return (
              <Row
                  key={i}
                  left={left}
                  right={right}
                  content={line}
                  type={
                      line.startsWith("+")
                          ? "add"
                          : line.startsWith("-")
                              ? "del"
                              : "ctx"
                  }
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
                 type
             }: {
    left: number | "";
    right: number | "";
    content: string;
    type: "add" | "del" | "ctx" | "hunk";
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
        <div style={{ display: "flex", whiteSpace: "pre" }}>
            <span style={lnStyle}>{left}</span>
            <span style={lnStyle}>{right}</span>
            <span style={{ flex: 1, ...style }}>{content}</span>
        </div>
    );
}

const lnStyle: React.CSSProperties = {
    width: 40,
    textAlign: "right",
    paddingRight: 8,
    color: "#6e7781",
    userSelect: "none"
};

const preStyle: React.CSSProperties = {
    margin: 0,
    padding: 12,
    fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
    fontSize: 12,
    background: "#ffffff",
    color: "#24292f",
    borderLeft: "1px solid #e5e7eb"
};
