// app/api/reviews/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { runFileReview } from "@/lib/review/runFileReview";

export const runtime = "nodejs";

const StartReview = z.object({
    sessionId: z.string().min(1),
    filePath: z.string().min(1),
});

export async function POST(req: Request) {
    const body = StartReview.parse(await req.json());

    const session = getSession(body.sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    if (session.inFlight) return NextResponse.json({ error: "Session busy (review in progress)" }, { status: 409 });
    session.inFlight = true;

    try {
        const review = await runFileReview(session, body.filePath);
        return NextResponse.json({ status: review.status, review });
    } catch (e: any) {
        const f = session.files.find((x: any) => x.path === body.filePath);
        if (f) f.reviewStatus = "failed";

        session.reviews[body.filePath] = {
            filePath: body.filePath,
            status: "failed",
            outputText: e?.message ?? "Review failed",
            outputStructured: {},
            warnings: [],
            contextRequests: [],
        };

        return NextResponse.json({ error: e?.message ?? "Review failed" }, { status: 500 });
    } finally {
        session.inFlight = false;
    }
}