import { describe, test, expect, beforeAll } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { buildFunctionWorker } from '../src/adapter/build-function';

const testDir = '/tmp/adapter-sveltekit-test-params-integration';
const endpointsDir = `${testDir}/endpoints`;
const buildDir = `${testDir}/build`;

beforeAll(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }

  mkdirSync(endpointsDir, { recursive: true });
  mkdirSync(buildDir, { recursive: true });

  // Create endpoint that returns its params
  const endpointCode = `
export async function GET(event) {
  return new Response(JSON.stringify(event.params), {
    headers: { 'Content-Type': 'application/json' }
  });
}
`;

  writeFileSync(`${endpointsDir}/params-echo.ts`, endpointCode);
});

async function testRoute(routePattern: string, url: string, expectedParams: Record<string, string>) {
  const workerFile = `${buildDir}/${routePattern.replace(/\//g, '-').replace(/[\[\]\.]/g, '_')}.js`;

  await buildFunctionWorker({
    endpointFile: `${endpointsDir}/params-echo.ts`,
    outfile: workerFile,
    routePattern,
    minify: false
  });

  const worker = await import(workerFile);
  const handler = worker.default;

  const req = new Request(url);
  const env = {};
  const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };

  const response = await handler.fetch(req, env, ctx);
  const params = await response.json();

  return params;
}

describe('Params Integration: Single Required Param', () => {
  test('[id] with numeric value', async () => {
    const params = await testRoute('/users/[id]', 'https://test.com/users/123', { id: '123' });
    expect(params).toEqual({ id: '123' });
  });

  test('[slug] with text value', async () => {
    const params = await testRoute('/posts/[slug]', 'https://test.com/posts/hello-world', { slug: 'hello-world' });
    expect(params).toEqual({ slug: 'hello-world' });
  });

  test('[uuid] with UUID format', async () => {
    const params = await testRoute('/items/[uuid]', 'https://test.com/items/550e8400-e29b-41d4-a716-446655440000', { uuid: '550e8400-e29b-41d4-a716-446655440000' });
    expect(params).toEqual({ uuid: '550e8400-e29b-41d4-a716-446655440000' });
  });
});

describe('Params Integration: Multiple Required Params', () => {
  test('[user]/[repo] - two params', async () => {
    const params = await testRoute('/[user]/[repo]', 'https://test.com/anthropics/claude', { user: 'anthropics', repo: 'claude' });
    expect(params).toEqual({ user: 'anthropics', repo: 'claude' });
  });

  test('[category]/[subcategory]/[item] - three params', async () => {
    const params = await testRoute('/shop/[category]/[subcategory]/[item]', 'https://test.com/shop/electronics/phones/iphone', { category: 'electronics', subcategory: 'phones', item: 'iphone' });
    expect(params).toEqual({ category: 'electronics', subcategory: 'phones', item: 'iphone' });
  });

  test('static/[id]/static/[slug] - mixed static and params', async () => {
    const params = await testRoute('/api/users/[id]/posts/[slug]', 'https://test.com/api/users/42/posts/my-post', { id: '42', slug: 'my-post' });
    expect(params).toEqual({ id: '42', slug: 'my-post' });
  });
});

describe('Params Integration: Optional Params', () => {
  test('[[optional]] - param present', async () => {
    const params = await testRoute('/status/[[code]]', 'https://test.com/status/200', { code: '200' });
    expect(params).toEqual({ code: '200' });
  });

  test('[[optional]] - param absent', async () => {
    const params = await testRoute('/status/[[code]]', 'https://test.com/status', {});
    expect(params).toEqual({});
  });

  test('[required]/[[optional]] - both present', async () => {
    const params = await testRoute('/status/[code]/[[reason]]', 'https://test.com/status/404/not-found', { code: '404', reason: 'not-found' });
    expect(params).toEqual({ code: '404', reason: 'not-found' });
  });

  test('[required]/[[optional]] - only required', async () => {
    const params = await testRoute('/status/[code]/[[reason]]', 'https://test.com/status/404', { code: '404' });
    expect(params).toEqual({ code: '404' });
  });
});

describe('Params Integration: Rest Params', () => {
  test('[...rest] - single segment', async () => {
    const params = await testRoute('/files/[...path]', 'https://test.com/files/doc.txt', { path: 'doc.txt' });
    expect(params).toEqual({ path: 'doc.txt' });
  });

  test('[...rest] - multiple segments', async () => {
    const params = await testRoute('/files/[...path]', 'https://test.com/files/folder/subfolder/doc.txt', { path: 'folder/subfolder/doc.txt' });
    expect(params).toEqual({ path: 'folder/subfolder/doc.txt' });
  });

  test('[...rest] - empty (no segments)', async () => {
    const params = await testRoute('/files/[...path]', 'https://test.com/files', { path: '' });
    expect(params).toEqual({ path: '' });
  });

  test('static/[id]/[...rest] - rest after required', async () => {
    const params = await testRoute('/docs/[version]/[...path]', 'https://test.com/docs/v2/api/endpoints', { version: 'v2', path: 'api/endpoints' });
    expect(params).toEqual({ version: 'v2', path: 'api/endpoints' });
  });
});

describe('Params Integration: Special Characters', () => {
  test('param with dashes', async () => {
    const params = await testRoute('/posts/[slug]', 'https://test.com/posts/hello-world-2024', { slug: 'hello-world-2024' });
    expect(params).toEqual({ slug: 'hello-world-2024' });
  });

  test('param with underscores', async () => {
    const params = await testRoute('/posts/[slug]', 'https://test.com/posts/my_awesome_post', { slug: 'my_awesome_post' });
    expect(params).toEqual({ slug: 'my_awesome_post' });
  });

  test('param with dots', async () => {
    const params = await testRoute('/files/[name]', 'https://test.com/files/document.v2.pdf', { name: 'document.v2.pdf' });
    expect(params).toEqual({ name: 'document.v2.pdf' });
  });
});

describe('Params Integration: Edge Cases', () => {
  test('trailing slash - present', async () => {
    const params = await testRoute('/users/[id]', 'https://test.com/users/123/', { id: '123' });
    expect(params).toEqual({ id: '123' });
  });

  test('trailing slash - absent', async () => {
    const params = await testRoute('/users/[id]', 'https://test.com/users/123', { id: '123' });
    expect(params).toEqual({ id: '123' });
  });

  test('query string ignored', async () => {
    const params = await testRoute('/users/[id]', 'https://test.com/users/123?foo=bar', { id: '123' });
    expect(params).toEqual({ id: '123' });
  });

  test('hash fragment ignored', async () => {
    const params = await testRoute('/users/[id]', 'https://test.com/users/123#section', { id: '123' });
    expect(params).toEqual({ id: '123' });
  });
});
