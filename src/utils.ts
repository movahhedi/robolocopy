/**
 * Process exclude patterns, handling comma-separated values
 */
export function processExcludePatterns(excludeOptions: string[]): string[] {
	if (!excludeOptions || excludeOptions.length === 0) {
		return [];
	}

	const patterns: string[] = [];

	// Handle comma-separated values in each exclude option
	for (const option of excludeOptions) {
		const commaValues = option.split(",");

		for (const value of commaValues) {
			const trimmed = value.trim();
			if (trimmed) {
				patterns.push(trimmed);
			}
		}
	}

	return patterns;
}
