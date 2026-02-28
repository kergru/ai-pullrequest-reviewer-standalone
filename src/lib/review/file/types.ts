import type {ReviewStatus, SeveritySummary} from "@/lib/types";

export type FileReviewContext = {
    diffText: string | null;
    fileContent: string | null;
    relatedTests: TextRef[];
    relatedSources: TextRef[];
    relatedLiquibase: TextRef[];
};

export type TextRef = {
    path: string;
    content: string;
};

export type ChangedFile = {
    path: string;
    diffText?: string;
    contentAtHead?: string;
};

export type ContextBundle = {
    relatedTests: TextRef[];
    relatedSources: TextRef[];
    relatedLiquibase: TextRef[];
};
