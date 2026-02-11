import { describe, test, expect } from 'bun:test';
import { createTestWorker } from './helpers';

const endpointCode = `
export async function GET(event) {
  return new Response(JSON.stringify(event.params), {
    headers: { 'Content-Type': 'application/json' }
  });
}
`;

describe('Params Integration: Single Required Param', () => {
  test('[id] with numeric value', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/users/[id]' });
    const response = await fetch('https://test.com/users/123');
    const params = await response.json();
    expect(params).toEqual({ id: '123' });
  });

  test('[slug] with text value', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/posts/[slug]' });
    const response = await fetch('https://test.com/posts/hello-world');
    const params = await response.json();
    expect(params).toEqual({ slug: 'hello-world' });
  });

  test('[uuid] with UUID format', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/items/[uuid]' });
    const response = await fetch('https://test.com/items/550e8400-e29b-41d4-a716-446655440000');
    const params = await response.json();
    expect(params).toEqual({ uuid: '550e8400-e29b-41d4-a716-446655440000' });
  });
});

describe('Params Integration: Multiple Required Params', () => {
  test('[user]/[repo] - two params', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/[user]/[repo]' });
    const response = await fetch('https://test.com/anthropics/claude');
    const params = await response.json();
    expect(params).toEqual({ user: 'anthropics', repo: 'claude' });
  });

  test('[category]/[subcategory]/[item] - three params', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/shop/[category]/[subcategory]/[item]' });
    const response = await fetch('https://test.com/shop/electronics/phones/iphone');
    const params = await response.json();
    expect(params).toEqual({ category: 'electronics', subcategory: 'phones', item: 'iphone' });
  });

  test('static/[id]/static/[slug] - mixed static and params', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/api/users/[id]/posts/[slug]' });
    const response = await fetch('https://test.com/api/users/42/posts/my-post');
    const params = await response.json();
    expect(params).toEqual({ id: '42', slug: 'my-post' });
  });
});

describe('Params Integration: Optional Params', () => {
  test('[[optional]] - param present', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/status/[[code]]' });
    const response = await fetch('https://test.com/status/200');
    const params = await response.json();
    expect(params).toEqual({ code: '200' });
  });

  test('[[optional]] - param absent', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/status/[[code]]' });
    const response = await fetch('https://test.com/status');
    const params = await response.json();
    expect(params).toEqual({});
  });

  test('[required]/[[optional]] - both present', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/status/[code]/[[reason]]' });
    const response = await fetch('https://test.com/status/404/not-found');
    const params = await response.json();
    expect(params).toEqual({ code: '404', reason: 'not-found' });
  });

  test('[required]/[[optional]] - only required', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/status/[code]/[[reason]]' });
    const response = await fetch('https://test.com/status/404');
    const params = await response.json();
    expect(params).toEqual({ code: '404' });
  });
});

describe('Params Integration: Rest Params', () => {
  test('[...rest] - single segment', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/files/[...path]' });
    const response = await fetch('https://test.com/files/doc.txt');
    const params = await response.json();
    expect(params).toEqual({ path: 'doc.txt' });
  });

  test('[...rest] - multiple segments', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/files/[...path]' });
    const response = await fetch('https://test.com/files/folder/subfolder/doc.txt');
    const params = await response.json();
    expect(params).toEqual({ path: 'folder/subfolder/doc.txt' });
  });

  test('[...rest] - empty (no segments)', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/files/[...path]' });
    const response = await fetch('https://test.com/files');
    const params = await response.json();
    expect(params).toEqual({ path: '' });
  });

  test('static/[id]/[...rest] - rest after required', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/docs/[version]/[...path]' });
    const response = await fetch('https://test.com/docs/v2/api/endpoints');
    const params = await response.json();
    expect(params).toEqual({ version: 'v2', path: 'api/endpoints' });
  });
});

describe('Params Integration: Special Characters', () => {
  test('param with dashes', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/posts/[slug]' });
    const response = await fetch('https://test.com/posts/hello-world-2024');
    const params = await response.json();
    expect(params).toEqual({ slug: 'hello-world-2024' });
  });

  test('param with underscores', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/posts/[slug]' });
    const response = await fetch('https://test.com/posts/my_awesome_post');
    const params = await response.json();
    expect(params).toEqual({ slug: 'my_awesome_post' });
  });

  test('param with dots', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/files/[name]' });
    const response = await fetch('https://test.com/files/document.v2.pdf');
    const params = await response.json();
    expect(params).toEqual({ name: 'document.v2.pdf' });
  });
});

describe('Params Integration: Edge Cases', () => {
  test('trailing slash - present', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/users/[id]' });
    const response = await fetch('https://test.com/users/123/');
    const params = await response.json();
    expect(params).toEqual({ id: '123' });
  });

  test('trailing slash - absent', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/users/[id]' });
    const response = await fetch('https://test.com/users/123');
    const params = await response.json();
    expect(params).toEqual({ id: '123' });
  });

  test('query string ignored', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/users/[id]' });
    const response = await fetch('https://test.com/users/123?foo=bar');
    const params = await response.json();
    expect(params).toEqual({ id: '123' });
  });

  test('hash fragment ignored', async () => {
    const { fetch } = await createTestWorker({ endpointCode, routePattern: '/users/[id]' });
    const response = await fetch('https://test.com/users/123#section');
    const params = await response.json();
    expect(params).toEqual({ id: '123' });
  });
});
