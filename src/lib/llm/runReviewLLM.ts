import type {ApiUsage, DiagnosticDataLLM, Mode, ReviewResultLLM} from "./types";
import { llmRequest } from "@/lib/llm/client";
import { estimateTokens, getInputTokenLimit, getOutputTokenLimit } from "@/lib/review/shared";

export async function runReviewLLM(input: {
    model: string,
    systemPrompt: string,
    userPrompt: string,
}): Promise<ReviewResultLLM> {

    console.log("########### SYSTEM PROMPT:\n:", input.systemPrompt);
    console.log("\n\n########### USER PROMPT:\n", input.userPrompt);

    // call llm
    const call = await llmRequest({
        model: input.model,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        temperature: 0.1,
        maxOutputTokens: getOutputTokenLimit()
    });

    // extract output
    const outputText = call.text ?? "";
    const outputJson = extractJsonBlock(outputText);
    const outputMarkdown = stripJsonBlocks(outputText);

    // build diagnostic
    const diagnostics = buildDiagnostics({
        model: input.model,
        mode: call.mode,
        durationMs: call.durationMs,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        inputLimitTokens: getInputTokenLimit(),
        outputLimitTokens: getOutputTokenLimit(),
        usage: call.usage,
        responseId: call.responseId,
    });

    return {
        outputMarkdown,
        outputJson,
        diagnostics,
    }
}

function extractJsonBlock(text: string): any | null {
    if (text === null || text === undefined) return null;
    const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
    return match ? match[1] : null;
}

function stripJsonBlocks(text: string): string {
    const s = String(text ?? "");
    const closed = s.replaceAll(/```json\s*[\s\S]*?\s*```/gi, "");
    const open = closed.replace(/```json[\s\S]*$/i, "");
    return open.trim();
}

function buildDiagnostics(input: {
    model: string;
    mode: Mode;
    durationMs: number;
    systemPrompt: string;
    userPrompt: string;
    inputLimitTokens: number;
    outputLimitTokens: number;
    usage?: ApiUsage;
    responseId?: string;
}): DiagnosticDataLLM {
    const systemChars = input.systemPrompt.length;
    const userChars = input.userPrompt.length;
    const systemTokensEst = estimateTokens(input.systemPrompt);
    const userTokensEst = estimateTokens(input.userPrompt);

    return {
        model: input.model,
        mode: input.mode,
        durationMs: input.durationMs,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        requestChars: { system: systemChars, user: userChars, total: systemChars + userChars },
        estimatedInputTokens: {
            system: systemTokensEst,
            user: userTokensEst,
            total: systemTokensEst + userTokensEst,
        },
        inputLimitTokens: input.inputLimitTokens,
        outputLimitTokens: input.outputLimitTokens,
        usage: input.usage,
        responseId: input.responseId,
    };
}
