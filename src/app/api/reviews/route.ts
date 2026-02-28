import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { runFileReview } from "@/lib/review/file/runFileReview";
import type { SeveritySummary, FileReviewResult } from "@/lib/review";

export const runtime = "nodejs";

const StartReview = z.object({
    sessionId: z.string().min(1),
    filePath: z.string().min(1),
});

function emptySummary(): SeveritySummary {
    return { blocker: 0, major: 0, minor: 0, nit: 0 };
}

export async function POST(req: Request) {
    const body = StartReview.parse(await req.json());

    const session = getSession(body.sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    if (session.inFlight) {
        return NextResponse.json({ error: "Session busy (review in progress)" }, { status: 409 });
    }
    session.inFlight = true;

    try {
        const review = await runFileReview(session, body.filePath);
        return NextResponse.json({ status: review.status, review });
    } catch (e: any) {
        const f = session.files.find((x) => x.path === body.filePath);
        if (f) f.reviewStatus = "failed";

        const msg = e?.message ?? "Review failed";
        const warnings = [`RUN_FAILED:${msg}`];

        const failed: FileReviewResult = {
            filePath: body.filePath,
            status: "failed",
            outputMarkdown: msg,
            outputStructured: null,
            severitySummary: emptySummary(),
            diagnostics: undefined,
            meta: {
                loadedContext: { tests: 0, sources: 0, liquibase: 0, fileContent: false },
                warnings,
            },
        };

        session.reviews[body.filePath] = failed;

        return NextResponse.json({ error: msg }, { status: 500 });
    } finally {
        session.inFlight = false;
    }
}
