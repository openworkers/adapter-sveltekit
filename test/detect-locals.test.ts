import { describe, test, expect, beforeAll } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { detectLocalsUsage } from '../src/adapter/detect-locals';

const testDir = '/tmp/adapter-sveltekit-test-detect-locals';

beforeAll(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }

  mkdirSync(testDir, { recursive: true });
});

describe('detectLocalsUsage', () => {
  test('detects destructured locals', () => {
    writeFileSync(
      `${testDir}/destructured.ts`,
      `export async function GET({ locals }) {
  return new Response(JSON.stringify(locals));
}`
    );

    expect(detectLocalsUsage(`${testDir}/destructured.ts`)).toBe(true);
  });

  test('detects destructured locals with other params', () => {
    writeFileSync(
      `${testDir}/destructured-multi.ts`,
      `export async function GET({ request, locals, cookies }) {
  return new Response(JSON.stringify(locals));
}`
    );

    expect(detectLocalsUsage(`${testDir}/destructured-multi.ts`)).toBe(true);
  });

  test('detects event.locals', () => {
    writeFileSync(
      `${testDir}/event-locals.ts`,
      `export async function GET(event) {
  const user = event.locals.user;
  return new Response(JSON.stringify(user));
}`
    );

    expect(detectLocalsUsage(`${testDir}/event-locals.ts`)).toBe(true);
  });

  test('does not detect locals in strings', () => {
    writeFileSync(
      `${testDir}/string-false-positive.ts`,
      `export async function GET({ request }) {
  return new Response("event.locals is not used here");
}`
    );

    expect(detectLocalsUsage(`${testDir}/string-false-positive.ts`)).toBe(false);
  });

  test('does not detect locals in comments', () => {
    writeFileSync(
      `${testDir}/comment-false-positive.ts`,
      `// event.locals would be nice to use
/* { locals } */
export async function GET({ request }) {
  return new Response("ok");
}`
    );

    expect(detectLocalsUsage(`${testDir}/comment-false-positive.ts`)).toBe(false);
  });

  test('returns false when no locals usage', () => {
    writeFileSync(
      `${testDir}/no-locals.ts`,
      `export async function GET({ request }) {
  return new Response("ok");
}`
    );

    expect(detectLocalsUsage(`${testDir}/no-locals.ts`)).toBe(false);
  });

  test('returns true for unreadable file (safe default)', () => {
    expect(detectLocalsUsage(`${testDir}/nonexistent.ts`)).toBe(true);
  });
});
