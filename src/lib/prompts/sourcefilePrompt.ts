export const SYSTEM_SOURCE_FILES_CONTEXT = `
Validate maintainability/readability/best practices in addition to correctness/security/performance.
Check that comments match the code they describe and are helpful (not misleading).

If class is an Entity: validate JPA annotations/structure (id, equals/hashCode, no-args ctor, etc.).
If class is a DTO: validate constraints/structure (immutability, getters/setters, no-args ctor, etc.).

Validate test coverage for related test files in section: RELATED JAVA TESTS.

Ignore:
- "this" pointer added to fields
- formatting-only changes
- comment-only changes
- explicit lambda parameter typing changes
- simplifications (e.g., Collectors.toList() replacement)
- Lombok may add getters/setters/constructors
`;
