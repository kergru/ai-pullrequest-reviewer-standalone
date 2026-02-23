import type { SessionDto, CreateSessionRequest, MetaReviewRequest } from "@/lib/types";


async function ok<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

export async function createSession(req: CreateSessionRequest): Promise<{ sessionId: string; status: string; pr: any; files: any[] }> {
  const r = await fetch(`/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });
  return ok(r);
}

export async function getSession(sessionId: string): Promise<SessionDto> {
  const r = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
  return ok(r);
}

export async function getDiff(sessionId: string, filePath: string): Promise<{ filePath: string; diff: string }> {
    const r = await fetch(
        `/api/diff?sessionId=${encodeURIComponent(sessionId)}&filePath=${encodeURIComponent(filePath)}`,
        { cache: "no-store" }
    );
    return ok(r);
}

export async function startReview(req: { sessionId: string; filePath: string }): Promise<any> {
    const r = await fetch(`/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "single", ...req }),
    });
    return ok(r);
}

export async function startMetaReview(req: MetaReviewRequest): Promise<any> {
  const r = await fetch(`/api/meta-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });
  return ok(r);
}

export async function getModels(): Promise<{ default: string; models: Array<{ id: string; label: string }> }> {
    const r = await fetch(`/api/llm-models`, { cache: "no-store" });
    return ok(r);
}

export async function resolveJira(pullRequestUrl: string): Promise<{ jiraKey: string | null; jiraKeys: string[] }> {
    const r = await fetch(`/api/resolve-jira`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pullRequestUrl })
    });
    return ok(r);
}
