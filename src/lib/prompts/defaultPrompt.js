export const DEFAULT_USER_REVIEW_PROMPT = `Review the provided pull request changes.

Focus only on the modified code in the diff.

Evaluate:
- Correctness
- Security
- Performance
- Maintainability
- Test coverage
- If a liquibase changelog is detected, always check the referenced changeset files exist in list of changed files and mention if not because liquibase won't work this wrong definition (find files in section LIQUIBASE-RELATED FILES CHANGED IN THIS PR).

Ignore:
- this pointer was added to class variables
- code formatting changes
- comments
- changed lambda explicit paramter typing
- simplified code (e.g. Collectors.toList() replacement)
- consider the use of Lombok annotions which may have added getters/setters/constructors

Use the Jira ticket (summary, description, acceptance criteria) as functional context but list not coverage here.

For each finding:
- explain the problem
- explain the impact
- suggest a concrete fix

Do not repeat the code.
Do not summarize the diff.
Be concise and specific.`;