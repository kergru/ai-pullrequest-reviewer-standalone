import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";

const Body = z.object({
    sessionId: z.string().min(1),
    filePath: z.string().min(1),
    ignored: z.boolean(), // <-- neu
});

export async function POST(req: Request) {
    const { sessionId, filePath, ignored } = Body.parse(await req.json());

    const session = getSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const review = session.reviews[filePath];
    if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

    review.status = ignored ? "ignored" : "done";

    return NextResponse.json({ status: review.status });
}
