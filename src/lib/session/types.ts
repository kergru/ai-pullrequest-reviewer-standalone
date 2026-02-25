import type { VcsPrRef } from "@/lib/vcs";
import type { ReviewStatus } from "@/lib/types";
import type { FileReviewResult } from "@/lib/review/types";

export type FileEntry = {
    path: string;
    type: "code" | "template" | "db" | "config" | "docs" | "other";
    additions: number;
    deletions: number;
    reviewStatus: ReviewStatus;
    diffText?: string;
    contentAtHead?: string;
};

export type SessionState = {
    id: string;
    createdAt: number;
    expiresAt: number;

    pr: VcsPrRef;

    jira?: { key: string; summary: string; description: string; acceptanceCriteria: string };

    prompt: string;
    model: string;

    files: FileEntry[];

    reviews: Record<string, FileReviewResult>;

    inFlight: boolean;
    repoFileIndex?: string[];

    language: string;
};
