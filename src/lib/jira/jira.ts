import { mustEnv, optionalEnv } from "@/lib/envUtil";
import type { JiraIssue } from "@/lib/jira/types";

/* ---------------- ADF → TEXT ---------------- */

function adfToText(node: any): string {
    if (!node) return "";
    if (typeof node === "string") return node;

    if (node.type === "doc" && Array.isArray(node.content)) {
        return node.content.map(adfToText).join("\n").trim();
    }

    if (node.type === "paragraph" && Array.isArray(node.content)) {
        return node.content.map(adfToText).join("").trim();
    }

    if (node.type === "text") {
        return node.text ?? "";
    }

    if (Array.isArray(node.content)) {
        return node.content.map(adfToText).join("\n").trim();
    }

    return "";
}

function normalizeDescription(desc: any): string {
    if (!desc) return "";

    if (typeof desc === "string") return desc;

    if (desc.type === "doc") {
        return adfToText(desc);
    }

    return JSON.stringify(desc);
}

/* ---------------- ACCEPTANCE CRITERIA ---------------- */

function pickAcceptanceCriteria(fields: any): string {
    const acFieldId = optionalEnv("JIRA_AC_FIELD_ID");

    if (acFieldId && fields?.[acFieldId]) {
        const v = fields[acFieldId];
        return typeof v === "string" ? v : normalizeDescription(v);
    }

    return "";
}

/* ---------------- AUTH ---------------- */

function authHeader() {
    const token = mustEnv("JIRA_BEARER_TOKEN");
    return `Bearer ${token}`;
}

/* ---------------- API ---------------- */

export async function getJiraIssue(key: string): Promise<JiraIssue> {
    const baseUrl = mustEnv("JIRA_BASE_URL").replace(/\/$/, "");

    const url = `${baseUrl}/rest/api/2/issue/${encodeURIComponent(
        key
    )}?fields=summary,description${optionalEnv("JIRA_AC_FIELD_ID") ? `,${optionalEnv("JIRA_AC_FIELD_ID")}` : ""}`;

    const r = await fetch(url, {
        headers: {
            Authorization: authHeader(),
            Accept: "application/json"
        }
    });

    if (!r.ok) {
        const body = await r.text().catch(() => "");
        throw new Error(`Jira ${r.status}: failed to load issue ${key}. ${body}`);
    }

    const data: any = await r.json();
    const fields = data?.fields ?? {};

    return {
        key,
        url: `${baseUrl}/browse/${key}`,
        summary: String(fields.summary ?? ""),
        description: normalizeDescription(fields.description),
        acceptanceCriteria: pickAcceptanceCriteria(fields)
    };
}