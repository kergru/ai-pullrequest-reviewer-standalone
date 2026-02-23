import "server-only";
import { createGitHubClient } from "./providers/githubClient";
import { createBitbucketClient } from "./providers/bitbucketClient";
import type { VcsClient, AnyPrNativeRef  } from "./index";

function createClient(): VcsClient<AnyPrNativeRef> {
    const provider = process.env.VCS_PROVIDER ?? "github";

    if (provider === "bitbucket") {
        return createBitbucketClient({
            provider: "bitbucket",
            baseUrl: process.env.BITBUCKET_BASE_URL!,
            authMode: (process.env.BITBUCKET_AUTH_MODE as any) ?? "bearer",
            token: process.env.BITBUCKET_TOKEN,
            username: process.env.BITBUCKET_USERNAME,
            password: process.env.BITBUCKET_PASSWORD,
        });
    }

    return createGitHubClient({
        provider: "github",
        baseUrl: process.env.GITHUB_BASE_URL,
        authMode: (process.env.GITHUB_AUTH_MODE as any) ?? "bearer",
        token: process.env.GITHUB_TOKEN!,
    });
}

export const vcs: VcsClient = createClient();