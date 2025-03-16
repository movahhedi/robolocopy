#!/usr/bin/env tsx
import path from "path";
import fs from "fs-extra";
import { program } from "commander";
import chalk from "chalk";
import { execSync } from "child_process";
import fg from "fast-glob";
import os from "os";
import { minimatch } from "minimatch";
import { fileURLToPath } from "url";
import { processExcludePatterns } from "./utils.js";

// Get the package version
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, "../package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

// Default exclude patterns
const DEFAULT_EXCLUDE_PATTERNS = [
	"node_modules/**",
	"dist/**",
	"build/**",
	"temp/**",
	"delete/**",
	"bin/**",
	"obj/**",
	"cache/**",
	"tmp/**",
	".DS_Store",
	"coverage/**",
	".cache/**",
	".idea/**",
	"*.log",
	// ".git/**",
	// ".vscode/**",
	// "*.lock",
	// "*.tgz",
	// "*.tar.gz",
];

interface CopyOptions {
	excludePatterns: string[];
	ignoreDefaults: boolean;
	verbose: boolean;
}

program
	.name("robolocopy")
	.description("A cross-platform file copying utility with glob pattern exclusions")
	.version(packageJson.version, "-v, --version", "Output the current version")
	.argument("<input-path>", "Source directory or file to copy from")
	.argument("<output-path>", "Destination directory to copy to")
	.option("-x, --exclude <patterns...>", "Glob patterns to exclude (comma-separated or multiple flags)")
	.option("-X, --ignore-defaults", "Ignore default exclusion patterns")
	.option("-V, --verbose", "Enable verbose output")
	.action(async (inputPath: string, outputPath: string, options) => {
		const excludePatterns = processExcludePatterns(options.exclude || []);

		const copyOptions: CopyOptions = {
			excludePatterns,
			ignoreDefaults: !!options.ignoreDefaults,
			verbose: !!options.verbose,
		};

		try {
			await copyFiles(inputPath, outputPath, copyOptions);
			console.log(chalk.green(`✓ Copy completed successfully.`));
		} catch (error) {
			console.error(chalk.red(`Error: ${(error as Error).message}`));
			process.exit(1);
		}
	});

program.parse();

async function copyFiles(inputPath: string, outputPath: string, options: CopyOptions): Promise<void> {
	const { excludePatterns, ignoreDefaults, verbose } = options;

	if (verbose) {
		console.log(chalk.blue(`Copying from: ${inputPath}`));
		console.log(chalk.blue(`Copying to: ${outputPath}`));
	}

	// Validate paths
	try {
		await fs.access(inputPath);
	} catch (error) {
		throw new Error(`Source path does not exist: ${inputPath}`);
	}

	// Create destination if it doesn't exist
	await fs.ensureDir(outputPath);

	// Combine exclude patterns
	const allExcludePatterns = ignoreDefaults
		? [...excludePatterns]
		: [...DEFAULT_EXCLUDE_PATTERNS, ...excludePatterns];

	if (verbose && allExcludePatterns.length > 0) {
		console.log(chalk.yellow("Excluding patterns:"));
		allExcludePatterns.forEach((pattern) => console.log(chalk.yellow(`- ${pattern}`)));
	}

	const isWindows = os.platform() === "win32";
	const isDirectoryCopy = (await fs.stat(inputPath)).isDirectory();

	// For Windows, try to use robocopy for better performance with directories
	if (isWindows && isDirectoryCopy) {
		try {
			return await useWindowsRobocopy(inputPath, outputPath, allExcludePatterns, verbose);
		} catch (error) {
			if (verbose) {
				console.log(chalk.yellow("Robocopy failed, falling back to Node.js implementation."));
				console.error(error);
			}
		}
	}

	// For Linux/Mac or when Windows robocopy fails, use Node.js implementation
	return await useNodeImplementation(inputPath, outputPath, allExcludePatterns, verbose);
}

async function useWindowsRobocopy(
	inputPath: string,
	outputPath: string,
	excludePatterns: string[],
	verbose: boolean
): Promise<void> {
	const sourceDir = path.resolve(inputPath);
	const destDir = path.resolve(outputPath);

	// Process exclude patterns into directory and file exclusions for robocopy
	const { dirExcludes, fileExcludes } = processExcludePatternsForRobocopy(excludePatterns);

	// Build the robocopy command
	let command = `robocopy "${sourceDir}" "${destDir}" /E /NFL /NDL`;

	// Add file exclusions
	if (fileExcludes.length > 0) {
		// Group file exclusions to avoid command line length limitations
		// Robocopy allows multiple files in a single /XF argument
		command += ` /XF ${fileExcludes.map(pattern => `"${pattern}"`).join(" ")}`;
	}

	// Add directory exclusions
	if (dirExcludes.length > 0) {
		// Group directory exclusions to avoid command line length limitations
		command += ` /XD ${dirExcludes.map(pattern => `"${pattern}"`).join(" ")}`;
	}

	if (verbose) {
		console.log(chalk.blue(`Using robocopy: ${command}`));
		if (dirExcludes.length > 0) {
			console.log(chalk.yellow("Directory exclusions:"));
			dirExcludes.forEach(dir => console.log(chalk.yellow(`- ${dir}`)));
		}
		if (fileExcludes.length > 0) {
			console.log(chalk.yellow("File exclusions:"));
			fileExcludes.forEach(file => console.log(chalk.yellow(`- ${file}`)));
		}
	}

	try {
		// Robocopy returns non-zero exit codes for successful operations too
		execSync(command, { stdio: verbose ? "inherit" : "ignore" });
		return;
	} catch (error) {
		// Robocopy exit codes 0-7 indicate success with different levels of file operations performed
		const exitCode = (error as { status?: number }).status;
		if (exitCode !== undefined && exitCode <= 7) {
			return; // These exit codes indicate successful operations
		}
		throw error; // Re-throw for other error codes
	}
}

/**
 * Processes glob patterns into robocopy-compatible directory and file exclude patterns
 */
function processExcludePatternsForRobocopy(excludePatterns: string[]): {
	dirExcludes: string[],
	fileExcludes: string[]
} {
	const dirExcludes: string[] = [];
	const fileExcludes: string[] = [];

	for (const pattern of excludePatterns) {
		// Normalize pattern to use forward slashes
		const normalizedPattern = pattern.replace(/\\/g, '/');

		// Handle common directory exclusion patterns with ** wildcard
		if (normalizedPattern.endsWith('/**')) {
			// Extract the directory name (e.g., "dist" from "dist/**")
			const dirName = normalizedPattern.slice(0, normalizedPattern.length - 3);
			dirExcludes.push(dirName);
			continue;
		}

		// Handle other directory-specific exclusions
		if (normalizedPattern.includes('/')) {
			// If there's a path separator, it's likely a subdirectory pattern
			// For robocopy, we need to extract just the directory name for /XD
			const parts = normalizedPattern.split('/');
			// Check if we're excluding a specific directory
			if (!parts[parts.length - 1].includes('*')) {
				dirExcludes.push(parts.join('\\'));
			}
		} else {
			// Handle file exclusion patterns
			// Convert glob wildcards to robocopy wildcards (mostly compatible already)
			const filePattern = normalizedPattern
				.replace(/\*\*/g, '*') // Convert ** to * for robocopy
				.replace(/\?/g, '?');  // ? works the same in both

			// Check if it's likely a directory or file pattern
			if (filePattern.endsWith('/')) {
				dirExcludes.push(filePattern.slice(0, -1));
			} else if (!filePattern.includes('*') && !filePattern.includes('?')) {
				// If no wildcards and no slash, could be either file or directory
				// For robocopy, add to both to be safe
				if (!filePattern.includes('.')) {
					dirExcludes.push(filePattern);
				} else {
					fileExcludes.push(filePattern);
				}
			} else {
				// Has wildcards, likely file pattern
				fileExcludes.push(filePattern);
			}
		}
	}

	// Special handling for common patterns
	if (excludePatterns.some(p => p.includes('node_modules'))) {
		dirExcludes.push('node_modules');
	}
	if (excludePatterns.some(p => p.includes('dist/'))) {
		dirExcludes.push('dist');
	}
	if (excludePatterns.some(p => p.includes('build/'))) {
		dirExcludes.push('build');
	}
	if (excludePatterns.some(p => p.includes('.git'))) {
		dirExcludes.push('.git');
	}

	// Remove duplicates
	return {
		dirExcludes: [...new Set(dirExcludes)],
		fileExcludes: [...new Set(fileExcludes)]
	};
}

async function useNodeImplementation(
	inputPath: string,
	outputPath: string,
	excludePatterns: string[],
	verbose: boolean
): Promise<void> {
	const inputStat = await fs.stat(inputPath);

	// Handle single file copy
	if (!inputStat.isDirectory()) {
		const filename = path.basename(inputPath);
		const destFilePath = path.resolve(outputPath, filename);

		// Check if the file should be excluded
		const relativePath = filename;
		if (shouldExclude(relativePath, excludePatterns)) {
			if (verbose) {
				console.log(chalk.yellow(`Skipping excluded file: ${relativePath}`));
			}
			return;
		}

		await fs.copy(inputPath, destFilePath);
		if (verbose) {
			console.log(chalk.green(`Copied file: ${relativePath}`));
		}
		return;
	}

	// For directory copies, we'll use fast-glob to list files efficiently
	// and exclude patterns before copying
	const inputPathResolved = path.resolve(inputPath);

	// Get all files and directories with fast-glob, filtering excluded patterns
	const entries = await fg(['**'], {
		cwd: inputPathResolved,
		dot: true,
		onlyFiles: false,
		followSymbolicLinks: false,
	});

	if (verbose) {
		console.log(chalk.blue(`Found ${entries.length} entries to process`));
	}

	// Filter out the entries that should be excluded
	const filteredEntries = entries.filter(entry => !shouldExclude(entry, excludePatterns));

	if (verbose) {
		console.log(chalk.blue(`After exclusion filters: ${filteredEntries.length} entries to copy`));
	}

	// Process files in batch using Promise.all for better performance
	const BATCH_SIZE = 100;
	let copiedCount = 0;

	for (let i = 0; i < filteredEntries.length; i += BATCH_SIZE) {
		const batch = filteredEntries.slice(i, i + BATCH_SIZE);
		await Promise.all(
			batch.map(async (entry) => {
				const sourcePath = path.join(inputPathResolved, entry);
				const destPath = path.join(outputPath, entry);

				// Create parent directory if it doesn't exist
				await fs.ensureDir(path.dirname(destPath));

				try {
					const stats = await fs.stat(sourcePath);

					if (stats.isDirectory()) {
						// Just ensure the directory exists, no need to copy it
						await fs.ensureDir(destPath);
					} else {
						// Copy the file with its attributes
						await fs.copy(sourcePath, destPath, {
							preserveTimestamps: true,
							errorOnExist: false,
						});
					}

					copiedCount++;
					if (verbose && copiedCount % 100 === 0) {
						console.log(chalk.green(`Progress: copied ${copiedCount} entries...`));
					}
				} catch (err) {
					console.error(chalk.red(`Failed to copy ${entry}: ${(err as Error).message}`));
				}
			})
		);
	}

	if (verbose) {
		console.log(chalk.green(`Successfully copied ${copiedCount} out of ${filteredEntries.length} entries`));
	}
}

function shouldExclude(filePath: string, excludePatterns: string[]): boolean {
	if (excludePatterns.length === 0) {
		return false;
	}
	// Normalize path separators for consistent matching
	const normalizedPath = filePath.replace(/\\/g, '/');
	return excludePatterns.some(pattern => {
		const normalizedPattern = pattern.replace(/\\/g, '/');
		return minimatch(normalizedPath, normalizedPattern, { dot: true });
	});
}
