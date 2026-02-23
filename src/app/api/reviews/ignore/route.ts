import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";

const Body = z.object({
    sessionId: z.string().min(1),
    filePath: z.string().min(1),
});

export async function POST(req: Request) {
    const { sessionId, filePath } = Body.parse(await req.json());

    const session = getSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const review = session.reviews[filePath];
    if (review) review.status = "ignored";

    return NextResponse.json({ status: "ignored" });
}