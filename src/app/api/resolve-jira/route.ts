import { NextResponse } from "next/server";
import { z } from "zod";
import { vcs } from "@/lib/vcs/client";

export const runtime = "nodejs";

const Body = z.object({
    pullRequestUrl: z.string().min(1),
});

export async function POST(req: Request) {
    const body = Body.parse(await req.json());

    const pr = await vcs.getPullRequest(body.pullRequestUrl);
    const jiraKey =
        typeof vcs.getJiraIssueForPr === "function"
            ? await vcs.getJiraIssueForPr(pr)
            : null;

    return NextResponse.json({
        repo: pr.repo,
        url: pr.url,
        title: pr.title,
        baseSha: pr.baseSha ?? null,
        headSha: pr.headSha ?? null,
        jiraKey: jiraKey,
    });
}