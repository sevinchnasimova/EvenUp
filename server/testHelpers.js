// Shared helpers for the API test scripts. The server must already be running.

const BASE = 'http://localhost:3000/api';

const results = { passed: 0, failed: 0 };

async function request(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function expect(label, actual, expected) {
  if (actual === expected) {
    results.passed++;
    console.log(`  PASS  ${label} (${actual})`);
  } else {
    results.failed++;
    console.log(`  FAIL  ${label} — expected ${expected}, got ${actual}`);
  }
}

async function createUser(name) {
  const email = `${name.toLowerCase()}-${Date.now()}@test.com`;
  await request('POST', '/auth/signup', null, { email, password: 'password123', name });
  const { data } = await request('POST', '/auth/login', null, { email, password: 'password123' });
  return { email, token: data.token };
}

function finish() {
  console.log(`\n${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

module.exports = { request, expect, createUser, finish };
