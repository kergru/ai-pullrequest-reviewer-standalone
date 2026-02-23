export function DiffViewer({ diff }: { diff: string }) {
    const lines = diff.split("\n");

    const visibleLines = lines.filter(line =>
        !line.startsWith("diff --git") &&
        !line.startsWith("index ") &&
        !line.startsWith("--- ") &&
        !line.startsWith("+++ ") &&
        !line.startsWith("@@")
    );

    return (
        <pre
            style={{
                margin: 0,
                padding: 12,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 12,
                height: "100%",
                background: "#ffffff",
                color: "#24292f",
                borderLeft: "1px solid #e5e7eb"
            }}
        >
      {visibleLines.map((line, i) => {
          let style: React.CSSProperties = {};

          // ➕ Added
          if (line.startsWith("+") && !line.startsWith("+++")) {
              style = {
                  background: "#e6ffed",
                  color: "#1a7f37"
              };
          }

          // ➖ Removed
          else if (line.startsWith("-") && !line.startsWith("---")) {
              style = {
                  background: "#ffebe9",
                  color: "#cf222e"
              };
          }

          // Hunk header @@
          else if (line.startsWith("@@")) {
              style = {
                  background: "#f6f8fa",
                  color: "#6f42c1",
                  fontWeight: 600
              };
          }

          // diff --git header
          else if (line.startsWith("diff --git")) {
              style = {
                  color: "#0969da",
                  fontWeight: 600
              };
          }

          return (
              <div key={i} style={{ whiteSpace: "pre", ...style }}>
                  {line}
              </div>
          );
      })}
    </pre>
    );
}