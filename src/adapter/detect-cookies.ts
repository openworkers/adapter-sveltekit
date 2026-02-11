import { readFileSync } from 'node:fs';

/**
 * Detect if an endpoint uses cookies by analyzing its source code
 */
export function detectCookiesUsage(filePath: string): boolean {
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

    // Check if 'cookies' appears in parameter destructuring or usage
    // Matches patterns like: ({ cookies }) or event.cookies
    const patterns = [
      /\{\s*[^}]*\bcookies\b[^}]*\}/, // Destructuring: { cookies }
      /\bevent\.cookies\b/, // Direct access: event.cookies
      /\brequest\.cookies\b/ // Alternative: request.cookies
    ];

    return patterns.some((pattern) => pattern.test(code));
  } catch (error) {
    // If we can't read the file, assume it uses cookies (safer default)
    console.warn(`Could not analyze ${filePath} for cookie usage:`, (error as Error).message);
    return true;
  }
}
