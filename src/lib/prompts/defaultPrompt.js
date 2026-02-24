export const DEFAULT_USER_REVIEW_PROMPT = `Review the provided pull request changes.

Focus only on the modified code in the diff.

For each finding:
- explain the problem
- explain the impact
- suggest a concrete fix

Do not repeat the code.
Do not summarize the diff.
Be concise and specific.
`;