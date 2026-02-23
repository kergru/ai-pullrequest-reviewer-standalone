"use client";

import { useMemo, useState } from "react";

type FileRow = {
    path: string;
    type: string;
    additions: number;
    deletions: number;
    priority: number;
    reviewStatus: string;
};

type DirNode = {
    kind: "dir";
    name: string; // display label (may be compressed "a/b/c")
    path: string; // stable key for collapse state
    children: TreeNode[];
};

type FileNode = {
    kind: "file";
    name: string; // basename
    path: string; // full file path
    file: FileRow;
};

type TreeNode = DirNode | FileNode;

function buildTree(files: FileRow[]): DirNode {
    const root: DirNode = { kind: "dir", name: "", path: "", children: [] };
    const dirMap = new Map<string, DirNode>();
    dirMap.set("", root);

    for (const f of files) {
        const parts = f.path.split("/").filter(Boolean);
        let cur = root;
        let curPath = "";

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;

            if (isLast) {
                cur.children.push({
                    kind: "file",
                    name: part,
                    path: (curPath ? `${curPath}/` : "") + part,
                    file: f,
                });
            } else {
                const nextPath = (curPath ? `${curPath}/` : "") + part;
                let dir = dirMap.get(nextPath);
                if (!dir) {
                    dir = { kind: "dir", name: part, path: nextPath, children: [] };
                    dirMap.set(nextPath, dir);
                    cur.children.push(dir);
                }
                cur = dir;
                curPath = nextPath;
            }
        }
    }

    // sort: dirs first; files by priority desc within a dir
    const sortDir = (d: DirNode) => {
        d.children.sort((a, b) => {
            if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
            if (a.kind === "file" && b.kind === "file")
                return (b.file.priority ?? 0) - (a.file.priority ?? 0);
            return a.name.localeCompare(b.name);
        });
        d.children.forEach((c) => c.kind === "dir" && sortDir(c));
    };
    sortDir(root);

    return root;
}

/**
 * Compress directory chains like classic diff tools:
 * If a directory has exactly one child and that child is a directory,
 * merge them into "dir/subdir" and continue.
 */
function compressTree(root: DirNode): DirNode {
    const compressDir = (d: DirNode): DirNode => {
        // compress children first
        const children = d.children.map((c) =>
            c.kind === "dir" ? compressDir(c) : c
        );

        // rebuild node
        let node: DirNode = { ...d, children };

        // repeatedly merge single-child dirs
        while (
            node.children.length === 1 &&
            node.children[0].kind === "dir"
            ) {
            const child = node.children[0] as DirNode;
            node = {
                kind: "dir",
                name: node.name ? `${node.name}/${child.name}` : child.name,
                path: child.path, // stable collapse key
                children: child.children,
            };
        }

        return node;
    };

    // IMPORTANT: we keep root as root container (name = ""), only compress its children
    return {
        ...root,
        children: root.children.map((c) => (c.kind === "dir" ? compressDir(c) : c)),
    };
}

export function FileTree(props: Readonly<{
    files: FileRow[];
    selected: string;
    onSelect: (path: string) => void;
}>) {
    const { files, selected, onSelect } = props;

    const tree = useMemo(() => compressTree(buildTree(files)), [files]);

    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const toggleDir = (dirPath: string) => {
        setCollapsed((prev) => ({ ...prev, [dirPath]: !prev[dirPath] }));
    };

    const renderNode = (node: TreeNode, depth: number) => {
        const indent = 8 + depth * 12;

        if (node.kind === "dir") {
            const isCollapsed = collapsed[node.path] ?? false;

            return (
                <div key={`dir:${node.path}`}>
                    <button
                        onClick={() => toggleDir(node.path)}
                        style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "6px 8px",
                            marginBottom: 4,
                            borderRadius: 8,
                            border: "1px solid #eee",
                            background: "#fafafa",
                            cursor: "pointer",
                        }}
                        title={node.path || "/"}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: indent }}>
                            <span style={{ width: 14, display: "inline-block" }}>{isCollapsed ? "▸" : "▾"}</span>
                            <span style={{ fontWeight: 700, fontSize: 12 }}>{node.name || "root"}</span>
                            <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.7 }}>{node.children.length}</span>
                        </div>
                    </button>

                    {!isCollapsed && (
                        <div>
                            {node.children.map((c) => renderNode(c, depth + 1))}
                        </div>
                    )}
                </div>
            );
        }

        const f = node.file;
        const active = node.path === selected;
        const delta = (f.additions ?? 0) + (f.deletions ?? 0);

        return (
            <button
                key={`file:${node.path}`}
                onClick={() => onSelect(node.path)}
                style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    marginBottom: 6,
                    borderRadius: 10,
                    border: active ? "1px solid #111" : "1px solid #ddd",
                    background: active ? "#111" : "#fff",
                    color: active ? "#fff" : "#111",
                    cursor: "pointer",
                }}
                title={node.path}
            >
                <div style={{ paddingLeft: indent, display: "flex", gap: 8, alignItems: "baseline" }}>
                    <div
                        style={{
                            fontSize: 14,
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            flex: 1,
                        }}
                    >
                        {node.name}
                    </div>
                    <div style={{ fontSize: 12, opacity: active ? 0.9 : 0.7 }}>#{f.priority}</div>
                </div>

                <div style={{ fontSize: 12, opacity: 0.8, paddingLeft: indent }}>
                    {f.type} · {f.reviewStatus}
                </div>
            </button>
        );
    };

    return (
        <div style={{ borderRight: "1px solid #e5e5e5", padding: 12, height: "100%"}}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Changed files</div>
            {tree.children.map((n) => renderNode(n, 0))}
        </div>
    );
}