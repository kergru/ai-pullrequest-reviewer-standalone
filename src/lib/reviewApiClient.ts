import type { SessionDto, CreateSessionRequest, MetaReviewRequest } from "@/lib/types";

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export async function createSession(req: CreateSessionRequest): Promise<{ sessionId: string; status: string; pr: any; files: any[] }> {
  const response = await fetch(`/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });
  return parseJsonOrThrow(response);
}

export async function getSession(sessionId: string): Promise<SessionDto> {
  const response = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
  return parseJsonOrThrow(response);
}

export async function updateSessionSettings(
    sessionId: string,
    settings: { model?: string; language?: "EN" | "DE" | "RU" }
): Promise<{ sessionId: string; model: string; language: string }> {
    const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
    });
    return parseJsonOrThrow(response);
}

export async function getDiff(sessionId: string, filePath: string): Promise<{ filePath: string; diff: string }> {
    const response = await fetch(
        `/api/diff?sessionId=${encodeURIComponent(sessionId)}&filePath=${encodeURIComponent(filePath)}`,
        { cache: "no-store" }
    );
    return parseJsonOrThrow(response);
}

export async function startReview(req: { sessionId: string; filePath: string }): Promise<any> {
    const response = await fetch(`/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "single", ...req }),
    });
    return parseJsonOrThrow(response);
}

export async function startMetaReview(req: MetaReviewRequest): Promise<any> {
  const response = await fetch(`/api/meta-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });
  return parseJsonOrThrow(response);
}

export async function getModels(): Promise<{ default: string; models: Array<{ id: string; label: string }> }> {
    const response = await fetch(`/api/llm-models`, { cache: "no-store" });
    return parseJsonOrThrow(response);
}

export async function resolveJira(pullRequestUrl: string): Promise<{ jiraKey: string | null; jiraKeys: string[] }> {
    const response = await fetch(`/api/resolve-jira`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pullRequestUrl })
    });
    return parseJsonOrThrow(response);
}
