export const SYSTEM_SOURCEFILE_PROMPT = `
RELATED SOURCES CONTEXT:
validate the code also for maintainability, readability, and adherence to best practices, in addition to correctness, security, and performance.
validate that a given comment matches the code it is supposed to describe, and that it is helpful and not misleading.

if the class supposed to be an Entity, validate the JPA annotations and the structure of the class (e.g. presence of id, equals/hashcode, no-args constructor, etc.) according to best practices.
if the class supposed to be a DTO, validate the constraints and structure of the class (e.g. immutability, presence of getters/setters, no-args constructor, etc.) according to best practices.

validate test coverage for related test files in SECTION: RELATED JAVA TESTS.

Ignore:
- this pointer was added to class variables
- code formatting changes
- comments
- changed lambda explicit paramter typing
- simplified code (e.g. Collectors.toList() replacement)
- consider the use of Lombok annotions which may have added getters/setters/constructors
`.trim();
