import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const s = getSession(params.id);

    if (!s) return NextResponse.json({ error: "Session not found (expired/finished)" }, { status: 404 });

    return NextResponse.json({
        sessionId: s.id,
        pr: s.pr,
        jira: s.jira ?? null,
        prompt: s.prompt,
        model: s.model,
        files: s.files,
        reviews: s.reviews,
    });
}