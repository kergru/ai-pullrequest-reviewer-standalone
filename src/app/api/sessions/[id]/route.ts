import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { z } from "zod";

export const runtime = "nodejs";

const UpdateSessionSettings = z
    .object({
        model: z.string().min(1).optional(),
        language: z.enum(["EN", "DE", "RU"]).optional(),
    })
    .refine((payload) => payload.model || payload.language, {
        message: "At least one field is required: model or language",
    });

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const session = getSession(params.id);

    if (!session) return NextResponse.json({ error: "Session not found (expired/finished)" }, { status: 404 });

    return NextResponse.json({
        sessionId: session.id,
        pr: session.pr,
        jira: session.jira ?? null,
        prompt: session.prompt,
        model: session.model,
        language: session.language,
        files: session.files,
        reviews: session.reviews,
    });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const session = getSession(params.id);
    if (!session) return NextResponse.json({ error: "Session not found (expired/finished)" }, { status: 404 });

    const payload = UpdateSessionSettings.parse(await req.json());

    if (payload.model) session.model = payload.model;
    if (payload.language) session.language = payload.language;

    return NextResponse.json({
        sessionId: session.id,
        model: session.model,
        language: session.language,
    });
}
