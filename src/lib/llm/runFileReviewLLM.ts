
import { llmRequest } from "./client";
import { buildDiagnostics } from "./review-diagnostic-data";
import type { ReviewResultLLM } from "./types";


export async function runFileReviewLLM(input: {
    model: string;
    system: string;
    user: string;
    inputLimitTokens: number;
    reservedOutputTokens: number;
    maxOutputTokens: number;
}): Promise<ReviewResultLLM> {
    const call = await llmRequest({
        model: input.model,
        systemPrompt: input.system,
        userPrompt: input.user,
        temperature: 0.1,
        maxOutputTokens: input.maxOutputTokens,
    });

    const outputText = call.text ?? "";

    const outputJson = extractJsonBlock(outputText);
    const outputMarkdown = stripJsonBlocks(outputText);

    const diagnostics = buildDiagnostics({
        model: input.model,
        mode: call.mode,
        durationMs: call.durationMs,
        systemText: input.system,
        userText: input.user,
        inputLimitTokens: input.inputLimitTokens,
        reservedOutputTokens: input.reservedOutputTokens,
        maxOutputTokens: input.maxOutputTokens,
        usage: call.usage,
        responseId: call.responseId,
    });

    return {
        outputMarkdown: outputMarkdown,
        outputJson: outputJson,
        diagnostics,
    };
}

function extractJsonBlock(text: string): any | null {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
    return match ? match[1] : null;
}

function stripJsonBlocks(text: string): string {
    const s = String(text ?? "");
    const closed = s.replaceAll(/```json\s*[\s\S]*?\s*```/gi, "");
    const open = closed.replace(/```json[\s\S]*$/i, "");
    return open.trim();
}
