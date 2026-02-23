import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { putSession } from "@/lib/session";
import { vcs } from "@/lib/vcs/client";
import { getJiraIssue } from "@/lib/jira";

export const runtime = "nodejs";

const CreateSession = z.object({
    pullRequestUrl: z.string().min(10),
    jiraKey: z.string().optional(),
    prompt: z.string().min(1),
    model: z.string().min(1),
    ttlMinutes: z.number().int().min(5).max(240).optional(),
    autoReviewFirstFile: z.boolean().optional().default(true),
});

function newId(prefix: string) {
    return `${prefix}_${crypto.randomUUID()}`;
}

export async function POST(req: Request) {
    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid or empty JSON body. Send Content-Type: application/json and a JSON payload." },
            { status: 400 }
        );
    }

    let body: z.infer<typeof CreateSession>;
    try {
        body = CreateSession.parse(raw);
    } catch (e: any) {
        return NextResponse.json({ error: "Invalid request payload", details: e?.errors ?? String(e) }, { status: 400 });
    }

    try {
        const pr = await vcs.getPullRequest(body.pullRequestUrl);

        const changes = await vcs.getChanges(pr);

        const files = (changes ?? []).map((c: any) => ({
            path: c.path,
            additions: 0,
            deletions: 0,
            type: c.type,
            reviewStatus: "pending" as const,
        }));

        const sessionId = newId("sess");
        const ttlMs = (body.ttlMinutes ?? 60) * 60_000;

        const jira = body.jiraKey ? await getJiraIssue(body.jiraKey) : undefined;

        // NEW: cache repo file index once per session (best-effort)
        let repoFileIndex: string[] | undefined = undefined;
        if (pr.baseSha) {
            try {
                repoFileIndex = await vcs.listFilesAtCommit(pr, pr.baseSha);
            } catch (e: any) {
                // eslint-disable-next-line no-console
                console.warn(`⚠️ Could not build repo file index at toCommit=${pr.baseSha}: ${e?.message ?? String(e)}`);
                repoFileIndex = undefined;
            }
        }

        putSession({
            id: sessionId,
            createdAt: Date.now(),
            expiresAt: Date.now() + ttlMs,
            pr,
            jira,
            prompt: body.prompt,
            model: body.model,
            files,
            reviews: {},
            inFlight: false,
            repoFileIndex,
        } as any);

        return NextResponse.json({ sessionId, status: "ready", pr, files, hasRepoFileIndex: Boolean(repoFileIndex) });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Failed to create session" }, { status: 500 });
    }
}