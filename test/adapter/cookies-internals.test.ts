/**
 * Test for SvelteKit cookies integration
 * Validates that set_trailing_slash() is required for cookies.set() to work
 */

import { describe, test, expect, beforeAll } from 'bun:test';

// @ts-ignore
import { get_cookies, add_cookies_to_headers } from '../../node_modules/@sveltejs/kit/src/runtime/server/cookie.js';

console.log('\n=== Testing SvelteKit Cookies ===\n');

// Create mock Request and URL
const mockRequest = new Request('http://localhost:3000/api/test', {
  method: 'GET',
  headers: new Headers()
});

const mockURL = new URL('http://localhost:3000/api/test');

console.log('1. Calling get_cookies()...');
const result = get_cookies(mockRequest, mockURL);
console.log('   ✓ Result keys:', Object.keys(result));

console.log('\n2. Setting cookie WITHOUT set_trailing_slash()...');
result.cookies.set('test_without_init', 'value1', { path: '/', httpOnly: true });
console.log('   new_cookies size:', result.new_cookies.size);
console.log('   new_cookies entries:', Array.from(result.new_cookies.entries()));

console.log('\n3. Calling set_trailing_slash("ignore")...');
result.set_trailing_slash('ignore');
console.log('   ✓ Trailing slash initialized');

console.log('\n4. Setting cookie AFTER set_trailing_slash()...');
result.cookies.set('test_with_init', 'value2', { path: '/', httpOnly: true });
console.log('   new_cookies size:', result.new_cookies.size);
console.log('   new_cookies entries:', Array.from(result.new_cookies.entries()));

console.log('\n5. Testing add_cookies_to_headers()...');
const responseHeaders = new Headers();
add_cookies_to_headers(responseHeaders, result.new_cookies.values());
console.log('   Set-Cookie headers:', responseHeaders.getAll('set-cookie'));

// Validation
console.log('\n=== Test Results ===');

if (result.new_cookies.size === 2) {
  console.log('✅ SUCCESS: Both cookies were set correctly');
  console.log('✅ set_trailing_slash() properly flushes the internal queue');
} else if (result.new_cookies.size === 1) {
  console.log('⚠️  PARTIAL: Only the second cookie was set');
  console.log('⚠️  This confirms set_trailing_slash() is required BEFORE cookies.set()');
} else {
  console.log('❌ FAILURE: No cookies were set');
}

console.log('\n');
