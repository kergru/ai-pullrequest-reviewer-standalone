import OpenAI from "openai";
import type { ApiUsage, Mode } from "./types";

function mode(): Mode {
    const m = (process.env.OPENAI_MODE ?? "responses").toLowerCase();
    return m === "chat_completions" ? "chat_completions" : "responses";
}

export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
});

function extractResponsesText(resp: any): string {
    if (typeof resp?.output_text === "string") return resp.output_text;

    const out = resp?.output;
    if (!Array.isArray(out)) return "";

    const chunks: string[] = [];
    for (const item of out) {
        const content = item?.content;
        if (!Array.isArray(content)) continue;

        for (const c of content) {
            if (typeof c?.text === "string") chunks.push(c.text);
            if (typeof c?.content === "string") chunks.push(c.content);
        }
    }
    return chunks.join("\n");
}

export async function llmRequest(input: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
    maxOutputTokens: number;
}): Promise<{ text: string; usage?: ApiUsage; responseId?: string; durationMs: number; mode: Mode }> {
    const selectedMode = mode();
    const t0 = Date.now();

    if (selectedMode === "responses") {
        const resp: any = await openai.responses.create({
            model: input.model,
            temperature: input.temperature,
            max_output_tokens: input.maxOutputTokens,
            input: [
                { role: "system", content: input.systemPrompt },
                { role: "user", content: input.userPrompt },
            ],
        });

        return {
            text: extractResponsesText(resp),
            usage: resp?.usage,
            responseId: resp?.id,
            durationMs: Date.now() - t0,
            mode: selectedMode,
        };
    }

    const resp: any = await openai.chat.completions.create({
        model: input.model,
        temperature: input.temperature,
        max_tokens: input.maxOutputTokens,
        messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: input.userPrompt },
        ],
    });

    return {
        text: resp?.choices?.[0]?.message?.content ?? "",
        usage: resp?.usage,
        responseId: resp?.id,
        durationMs: Date.now() - t0,
        mode: selectedMode,
    };
}