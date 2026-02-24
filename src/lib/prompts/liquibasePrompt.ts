export const SYSTEM_LIQUIBASE_PROMPT = `
if the file ist a changelog then always check the referenced changeset files exist in list of changed files and 
mention if not because liquibase won't work this wrong definition (find files in section LIQUIBASE-RELATED FILES CHANGED IN THIS PR).

if file is a changeset file then validate the SQL or Liquibase DDL
validate table, column definitions, data types, index, constraints, and syntax
`.trim();
