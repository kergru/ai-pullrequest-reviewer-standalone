import { NextResponse } from "next/server";
import { openai } from "@/lib/llm";

export const runtime = "nodejs";

export async function GET() {
    try {
        const list = await openai.models.list();
        const ids = (list.data ?? [])
            .map((m: any) => m.id)
            .filter(Boolean)
            .sort((a: string, b: string) => a.localeCompare(b));

        const def = process.env.OPENAI_DEFAULT_MODEL || (ids[0] ?? "gpt-4.1-mini");

        return NextResponse.json({
            default: def,
            models: ids.map((id: string) => ({ id, label: id })),
            source: "openai",
        });
    } catch (e: any) {
        // Don't break the UI if OpenAI is unreachable
        const def = process.env.OPENAI_DEFAULT_MODEL || "gpt-4.1-mini";
        return NextResponse.json({
            default: def,
            models: [{ id: def, label: def }],
            source: "fallback",
            warning: e?.message ?? "OpenAI models.list failed",
        });
    }
}