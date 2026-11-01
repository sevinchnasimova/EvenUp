// Authorization test: tries to access another group's data on purpose.
// Run with the server already running: node authorizationTest.js

const BASE = 'http://localhost:3000/api';

let passed = 0;
let failed = 0;

async function request(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function expect(label, actual, expected) {
  if (actual === expected) {
    passed++;
    console.log(`  PASS  ${label} (${actual})`);
  } else {
    failed++;
    console.log(`  FAIL  ${label} — expected ${expected}, got ${actual}`);
  }
}

async function createUser(name) {
  const email = `${name.toLowerCase()}-${Date.now()}@test.com`;
  await request('POST', '/auth/signup', null, { email, password: 'password123', name });
  const { data } = await request('POST', '/auth/login', null, { email, password: 'password123' });
  return { email, token: data.token };
}

async function main() {
  // Alice owns a group with an expense; Mallory is logged in but not a member
  const alice = await createUser('Alice');
  const mallory = await createUser('Mallory');

  const { data: group } = await request('POST', '/groups', alice.token, { name: 'Alice Apartment' });
  const { data: expense } = await request('POST', `/groups/${group.id}/expenses`, alice.token, {
    amount: 100, description: 'Rent', category: 'Rent', date: '2026-10-01',
  });
  const { data: pending } = await request('POST', `/groups/${group.id}/expenses`, alice.token, {
    amount: 50, description: 'Internet', category: 'Utilities', date: '2026-10-01', status: 'pending',
  });

  console.log('\nNo token at all:');
  expect('GET expenses', (await request('GET', `/groups/${group.id}/expenses`)).status, 401);

  console.log('\nLogged in, but not a member of the group:');
  const g = `/groups/${group.id}`;
  expect('GET members', (await request('GET', `${g}/members`, mallory.token)).status, 403);
  expect('POST members (add self)', (await request('POST', `${g}/members`, mallory.token, { email: mallory.email })).status, 403);
  expect('GET expenses', (await request('GET', `${g}/expenses`, mallory.token)).status, 403);
  expect('POST expense', (await request('POST', `${g}/expenses`, mallory.token, { amount: 1, description: 'x', date: '2026-10-01' })).status, 403);
  expect('GET balances', (await request('GET', `${g}/balances`, mallory.token)).status, 403);
  expect('GET settle', (await request('GET', `${g}/settle`, mallory.token)).status, 403);
  expect('GET spending-by-category', (await request('GET', `${g}/spending-by-category`, mallory.token)).status, 403);
  expect('GET drinks', (await request('GET', `${g}/drinks`, mallory.token)).status, 403);
  expect('POST drink', (await request('POST', `${g}/drinks`, mallory.token, { name: 'x', cost: 1, rating: 5 })).status, 403);
  expect('POST parse-expense', (await request('POST', `${g}/parse-expense`, mallory.token, { text: 'x' })).status, 403);
  expect('PATCH pay expense', (await request('PATCH', `/expenses/${pending.id}/pay`, mallory.token)).status, 403);
  expect('DELETE expense', (await request('DELETE', `/expenses/${expense.id}`, mallory.token)).status, 403);

  console.log('\nGroup list only shows your own groups:');
  const { data: malloryGroups } = await request('GET', '/groups', mallory.token);
  expect('Mallory sees Alice group', malloryGroups.some(gr => gr.id === group.id), false);

  console.log('\nBad input:');
  expect('Non-numeric group id', (await request('GET', '/groups/abc/expenses', alice.token)).status, 400);
  expect('Non-existent expense', (await request('DELETE', '/expenses/999999999', alice.token)).status, 404);

  console.log('\nMembers still have normal access:');
  expect('Alice GET expenses', (await request('GET', `${g}/expenses`, alice.token)).status, 200);
  expect('Alice adds Mallory', (await request('POST', `${g}/members`, alice.token, { email: mallory.email })).status, 200);
  expect('Mallory (now a member) GET expenses', (await request('GET', `${g}/expenses`, mallory.token)).status, 200);
  expect('Mallory pays pending expense', (await request('PATCH', `/expenses/${pending.id}/pay`, mallory.token)).status, 200);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
