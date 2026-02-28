import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDiffForFile } from "@/lib/diff/getDiff";

export const runtime = "nodejs";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const sessionId = String(searchParams.get("sessionId") ?? "");
    const filePath = String(searchParams.get("filePath") ?? "");

    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    if (!filePath) return NextResponse.json({ error: "filePath required" }, { status: 400 });

    const s = getSession(sessionId);
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const fileDiff = await getDiffForFile(s, filePath);
    if (!fileDiff) {
        return NextResponse.json(
            { error: "No diff for filePath (splitter could not match)", filePath, normalized: filePath },
            { status: 404 }
        );
    }

    return NextResponse.json({ filePath, diff: fileDiff });
}