export function isLiquibaseChangelog(filePath: string): boolean {
    return filePath.toLowerCase().endsWith("changelog.xml");
}

export function filterLiquibaseFilesFromChanges(
    changedFiles: Array<{ path: string }>
): string[] {
    return changedFiles
        .map(f => f.path)
        .filter(p => {
            const l = p.toLowerCase();
            return l.includes("resources/db") || l.includes("liquibase");
        });
}