import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(__dirname, "..", "src", "index.ts");

// Create temp directories for testing
const tempDir = path.join(os.tmpdir(), "robolocopy-test");
const sourceDir = path.join(tempDir, "source");
const destDir = path.join(tempDir, "dest");

describe("robolocopy CLI", () => {
	beforeEach(async () => {
		// Ensure clean test directories
		await fs.emptyDir(tempDir);
		await fs.emptyDir(sourceDir);
		await fs.emptyDir(destDir);
	});

	afterEach(async () => {
		// Clean up after tests
		await fs.remove(tempDir);
	});

	it("should copy files while respecting exclude patterns", async () => {
		// Create test directory structure
		await fs.ensureDir(path.join(sourceDir, "node_modules/package"));
		await fs.ensureDir(path.join(sourceDir, "dist"));
		await fs.ensureDir(path.join(sourceDir, "src"));

		// Create some test files
		await fs.writeFile(path.join(sourceDir, "file1.txt"), "test content");
		await fs.writeFile(path.join(sourceDir, "file2.log"), "log content");
		await fs.writeFile(path.join(sourceDir, "src/code.ts"), 'console.log("Hello")');
		await fs.writeFile(path.join(sourceDir, "dist/bundle.js"), "bundled code");
		await fs.writeFile(path.join(sourceDir, "node_modules/package/index.js"), "module code");

		// Run the CLI with default exclude patterns
		execSync(`tsx ${cliPath} ${sourceDir} ${destDir}`, { stdio: "ignore" });

		// Check that excluded paths weren't copied
		expect(await fs.pathExists(path.join(destDir, "node_modules"))).toBe(false);
		expect(await fs.pathExists(path.join(destDir, "dist"))).toBe(false);
		expect(await fs.pathExists(path.join(destDir, "file2.log"))).toBe(false);

		// Check that non-excluded paths were copied
		expect(await fs.pathExists(path.join(destDir, "file1.txt"))).toBe(true);
		expect(await fs.pathExists(path.join(destDir, "src/code.ts"))).toBe(true);
		expect(await fs.readFile(path.join(destDir, "file1.txt"), "utf8")).toBe("test content");
	});

	it("should ignore default exclude patterns with -X flag", async () => {
		// Create test files
		await fs.ensureDir(path.join(sourceDir, "dist"));
		await fs.writeFile(path.join(sourceDir, "dist/bundle.js"), "bundled code");
		await fs.writeFile(path.join(sourceDir, "file.log"), "log content");

		// Run CLI with -X flag to ignore default exclude patterns
		execSync(`tsx ${cliPath} ${sourceDir} ${destDir} -X`, { stdio: "ignore" });

		// Check that normally excluded paths were copied
		expect(await fs.pathExists(path.join(destDir, "dist/bundle.js"))).toBe(true);
		expect(await fs.pathExists(path.join(destDir, "file.log"))).toBe(true);
	});

	it("should handle comma-separated exclude patterns", async () => {
		// Create test files
		await fs.writeFile(path.join(sourceDir, "file1.txt"), "test content");
		await fs.writeFile(path.join(sourceDir, "file2.txt"), "test content 2");
		await fs.writeFile(path.join(sourceDir, "file3.txt"), "test content 3");

		// Run CLI with comma-separated exclude patterns
		execSync(`tsx ${cliPath} ${sourceDir} ${destDir} -x "file1.txt, file3.txt"`, { stdio: "ignore" });

		// Check that excluded files weren't copied
		expect(await fs.pathExists(path.join(destDir, "file1.txt"))).toBe(false);
		expect(await fs.pathExists(path.join(destDir, "file3.txt"))).toBe(false);

		// Check that non-excluded file was copied
		expect(await fs.pathExists(path.join(destDir, "file2.txt"))).toBe(true);
	});
});
