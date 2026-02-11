import { readFileSync } from 'node:fs';

/**
 * Detect if an endpoint uses locals by analyzing its source code
 */
export function detectLocalsUsage(filePath: string): boolean {
  try {
    let code = readFileSync(filePath, 'utf-8');

    // Remove string literals and comments to avoid false positives
    // Remove single-line comments
    code = code.replace(/\/\/.*$/gm, '');
    // Remove multi-line comments
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove template literals
    code = code.replace(/`[^`]*`/g, '');
    // Remove double-quoted strings
    code = code.replace(/"[^"]*"/g, '');
    // Remove single-quoted strings
    code = code.replace(/'[^']*'/g, '');

    // Check if 'locals' appears in parameter destructuring or usage
    // Matches patterns like: ({ locals }) or event.locals
    const patterns = [
      /\{\s*[^}]*\blocals\b[^}]*\}/, // Destructuring: { locals }
      /\bevent\.locals\b/ // Direct access: event.locals
    ];

    return patterns.some((pattern) => pattern.test(code));
  } catch (error) {
    // If we can't read the file, assume it uses locals (safer default)
    console.warn(`Could not analyze ${filePath} for locals usage:`, (error as Error).message);
    return true;
  }
}
