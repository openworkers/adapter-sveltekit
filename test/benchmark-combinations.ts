/**
 * Build all 8 combinations of cookies/params/hooks and output a size table.
 * Run with: bun test/benchmark-combinations.ts
 */

import { buildFunctionWorker } from '../src/adapter/build-function';
import { existsSync, mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';

const testDir = '/tmp/adapter-sveltekit-benchmark';
const endpointsDir = `${testDir}/endpoints`;
const buildDir = `${testDir}/build`;

// Setup
if (existsSync(testDir)) {
  rmSync(testDir, { recursive: true });
}

mkdirSync(endpointsDir, { recursive: true });
mkdirSync(buildDir, { recursive: true });

// Hooks file
writeFileSync(
  `${testDir}/hooks.server.js`,
  `export async function handle({ event, resolve }) {
  event.locals.user = { id: '42', name: 'Test' };
  return resolve(event);
}`
);

// Endpoints for each combination
const endpoints: Record<string, string> = {
  // No features
  'none': `export async function GET({ request }) {
  return new Response("ok");
}`,

  // Cookies only
  'cookies': `export async function GET({ cookies }) {
  const session = cookies.get("session");
  return new Response(session ?? "none");
}`,

  // Params only (params depend on route pattern, not source)
  'params': `export async function GET({ request }) {
  return new Response("ok");
}`,

  // Hooks/locals only
  'hooks': `export async function GET({ locals }) {
  return new Response(JSON.stringify(locals));
}`,

  // Cookies + Params
  'cookies+params': `export async function GET({ cookies }) {
  const session = cookies.get("session");
  return new Response(session ?? "none");
}`,

  // Cookies + Hooks
  'cookies+hooks': `export async function GET({ cookies, locals }) {
  const session = cookies.get("session");
  return new Response(JSON.stringify({ session, user: locals.user }));
}`,

  // Params + Hooks
  'params+hooks': `export async function GET({ locals }) {
  return new Response(JSON.stringify(locals));
}`,

  // All three
  'all': `export async function GET({ cookies, locals }) {
  const session = cookies.get("session");
  return new Response(JSON.stringify({ session, user: locals.user }));
}`,
};

for (const [name, code] of Object.entries(endpoints)) {
  writeFileSync(`${endpointsDir}/${name}.ts`, code);
}

interface Combo {
  label: string;
  endpoint: string;
  routePattern: string;
  hooksFile?: string;
  cookies: boolean;
  params: boolean;
  hooks: boolean;
}

const combos: Combo[] = [
  { label: 'none',              endpoint: 'none',           routePattern: '/api/health',        cookies: false, params: false, hooks: false },
  { label: 'cookies',           endpoint: 'cookies',        routePattern: '/api/health',        cookies: true,  params: false, hooks: false },
  { label: 'params',            endpoint: 'params',         routePattern: '/api/users/[id]',    cookies: false, params: true,  hooks: false },
  { label: 'hooks',             endpoint: 'hooks',          routePattern: '/api/health',        cookies: false, params: false, hooks: true,  hooksFile: `${testDir}/hooks.server.js` },
  { label: 'cookies+params',    endpoint: 'cookies+params', routePattern: '/api/users/[id]',    cookies: true,  params: true,  hooks: false },
  { label: 'cookies+hooks',     endpoint: 'cookies+hooks',  routePattern: '/api/health',        cookies: true,  params: false, hooks: true,  hooksFile: `${testDir}/hooks.server.js` },
  { label: 'params+hooks',      endpoint: 'params+hooks',   routePattern: '/api/users/[id]',    cookies: false, params: true,  hooks: true,  hooksFile: `${testDir}/hooks.server.js` },
  { label: 'all',               endpoint: 'all',            routePattern: '/api/users/[id]',    cookies: true,  params: true,  hooks: true,  hooksFile: `${testDir}/hooks.server.js` },
];

console.log('Building all combinations...\n');

const results: Array<{ label: string; cookies: boolean; params: boolean; hooks: boolean; size: number; minSize: number }> = [];

for (const combo of combos) {
  const outfile = `${buildDir}/${combo.label}.js`;
  const outfileMin = `${buildDir}/${combo.label}.min.js`;

  await buildFunctionWorker({
    endpointFile: `${endpointsDir}/${combo.endpoint}.ts`,
    outfile,
    routePattern: combo.routePattern,
    hooksFile: combo.hooksFile,
    minify: false,
  });

  await buildFunctionWorker({
    endpointFile: `${endpointsDir}/${combo.endpoint}.ts`,
    outfile: outfileMin,
    routePattern: combo.routePattern,
    hooksFile: combo.hooksFile,
    minify: true,
  });

  const size = statSync(outfile).size;
  const minSize = statSync(outfileMin).size;

  results.push({
    label: combo.label,
    cookies: combo.cookies,
    params: combo.params,
    hooks: combo.hooks,
    size,
    minSize,
  });
}

// Output table
const baseSize = results[0].size;
const baseMinSize = results[0].minSize;

const check = (v: boolean) => v ? ' x ' : '   ';
const kb = (n: number) => (n / 1024).toFixed(1).padStart(6);
const delta = (n: number, base: number) => {
  const d = n - base;

  if (d === 0) return '     -';
  return ('+' + (d / 1024).toFixed(1)).padStart(6);
};

console.log('| Cookies | Params | Hooks |  Raw KB | +delta  | Min KB  | +delta  |');
console.log('|---------|--------|-------|---------|---------|---------|---------|');

for (const r of results) {
  console.log(
    `|  ${check(r.cookies)}  ` +
    `|  ${check(r.params)} ` +
    `| ${check(r.hooks)} ` +
    `| ${kb(r.size)} ` +
    `| ${delta(r.size, baseSize)} ` +
    `| ${kb(r.minSize)} ` +
    `| ${delta(r.minSize, baseMinSize)} |`
  );
}

console.log('');
console.log(`Base (no features): ${(baseSize / 1024).toFixed(1)} KB raw, ${(baseMinSize / 1024).toFixed(1)} KB min`);
