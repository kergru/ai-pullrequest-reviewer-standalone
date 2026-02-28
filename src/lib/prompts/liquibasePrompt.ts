export const SYSTEM_LIQUIBASE_CONTEXT = `
Detect file type and apply rules.

CHANGELOG:
- Extract referenced changeset files.
- Check they exist in section: "LIQUIBASE CONTEXT"
- If missing → report and state Liquibase will fail.

CHANGESET:
Validate SQL/Liquibase DDL:
- tables, columns, data types
- indexes
- constraints (PK, FK, UNIQUE, NOT NULL)
- syntax
Flag invalid/inconsistent defs, risky/unsupported types,
missing required constraints, SQL errors.
`;
