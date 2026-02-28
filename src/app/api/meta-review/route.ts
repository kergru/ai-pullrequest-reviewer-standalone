import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, deleteSession } from "@/lib/session";
import { runMetaReview } from "@/lib/review";
import type { FileReviewResult } from "@/lib/review";

export const runtime = "nodejs";

const StartMeta = z.object({
    sessionId: z.string().min(1),
    deleteAfter: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
    const body = StartMeta.parse(await req.json());
    const s = getSession(body.sessionId);
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    if (s.inFlight) return NextResponse.json({ error: "Session busy (review in progress)" }, { status: 409 });
    s.inFlight = true;

    try {
        const fileReviewResults: FileReviewResult[] = Object.values(s.reviews)
            .filter(r => (r.status === "done" || r.status === "done_with_warnings"));

        if (!fileReviewResults.length) {
            return NextResponse.json(
                { error: "No completed file reviews found. Run at least one file review before meta review." },
                { status: 400 }
            );
        }

        const mr = await runMetaReview({
            model: s.model,
            language: s.language,
            userPrompt: s.prompt,
            jira: s.jira,
            fileReviewResults,
            changedFiles: s.files,
        });

        if (body.deleteAfter) deleteSession(s.id);

        return NextResponse.json({ status: "done", metaReview: mr, deleted: body.deleteAfter });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Meta review failed" }, { status: 500 });
    } finally {
        const sx = getSession(body.sessionId);
        if (sx) sx.inFlight = false;
    }
}
