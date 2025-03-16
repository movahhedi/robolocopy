import { describe, it, expect } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";

// Import internal functions for testing
// Note: We need to create these utility functions in a separate module to make testing easier
import { processExcludePatterns } from "../src/utils";

describe("Utility functions", () => {
	describe("processExcludePatterns", () => {
		it("should handle empty input", () => {
			expect(processExcludePatterns([])).toEqual([]);
		});

		it("should process comma-separated patterns", () => {
			const input = ["pattern1,pattern2", " pattern3 , pattern4"];
			const expected = ["pattern1", "pattern2", "pattern3", "pattern4"];
			expect(processExcludePatterns(input)).toEqual(expected);
		});

		it("should trim whitespace", () => {
			const input = [" pattern1 ", "pattern2  ,  pattern3"];
			const expected = ["pattern1", "pattern2", "pattern3"];
			expect(processExcludePatterns(input)).toEqual(expected);
		});

		it("should filter empty values", () => {
			const input = ["pattern1,,pattern2", ",", " "];
			const expected = ["pattern1", "pattern2"];
			expect(processExcludePatterns(input)).toEqual(expected);
		});
	});
});
