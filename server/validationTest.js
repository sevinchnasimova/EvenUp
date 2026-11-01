// Validation test: sends bad input straight to the API, skipping the frontend's
// form checks, and makes sure the server rejects it with a clear error.
// Run with the server already running: node validationTest.js

const { request, expect, createUser, finish } = require('./testHelpers');

async function main() {
  console.log('\nSignup:');
  const email = `val-${Date.now()}@test.com`;
  expect('Missing fields', (await request('POST', '/auth/signup', null, {})).status, 400);
  expect('Invalid email', (await request('POST', '/auth/signup', null, { email: 'notanemail', password: 'password123', name: 'X' })).status, 400);
  expect('Short password', (await request('POST', '/auth/signup', null, { email, password: 'short', name: 'X' })).status, 400);
  expect('Blank name', (await request('POST', '/auth/signup', null, { email, password: 'password123', name: '   ' })).status, 400);
  expect('Valid signup', (await request('POST', '/auth/signup', null, { email, password: 'password123', name: 'Val' })).status, 200);
  const duplicate = await request('POST', '/auth/signup', null, { email, password: 'password123', name: 'Val' });
  expect('Duplicate email', duplicate.status, 409);
  expect('No database details leaked', duplicate.data.error.includes('prisma'), false);

  console.log('\nLogin:');
  expect('Missing password', (await request('POST', '/auth/login', null, { email })).status, 400);
  expect('Wrong password', (await request('POST', '/auth/login', null, { email, password: 'wrongpass1' })).status, 401);

  console.log('\nMalformed request:');
  expect('Body is not valid JSON', (await request('POST', '/auth/login', null, '{bad json')).status, 400);

  const user = await createUser('Valerie');
  const other = await createUser('Otto');

  console.log('\nGroups and members:');
  expect('Blank group name', (await request('POST', '/groups', user.token, { name: '' })).status, 400);
  const { data: group } = await request('POST', '/groups', user.token, { name: 'Validation Group' });
  const g = `/groups/${group.id}`;
  expect('Add member with no email', (await request('POST', `${g}/members`, user.token, {})).status, 400);
  expect('Add member', (await request('POST', `${g}/members`, user.token, { email: other.email })).status, 200);
  expect('Add same member twice', (await request('POST', `${g}/members`, user.token, { email: other.email })).status, 409);

  console.log('\nExpenses:');
  const valid = { amount: 40, description: 'Groceries', category: 'Groceries', date: '2026-10-01' };
  expect('Negative amount', (await request('POST', `${g}/expenses`, user.token, { ...valid, amount: -50 })).status, 400);
  expect('Zero amount', (await request('POST', `${g}/expenses`, user.token, { ...valid, amount: 0 })).status, 400);
  expect('Amount as text', (await request('POST', `${g}/expenses`, user.token, { ...valid, amount: 'abc' })).status, 400);
  expect('Huge amount', (await request('POST', `${g}/expenses`, user.token, { ...valid, amount: 1e12 })).status, 400);
  expect('Blank description', (await request('POST', `${g}/expenses`, user.token, { ...valid, description: ' ' })).status, 400);
  expect('Unknown category', (await request('POST', `${g}/expenses`, user.token, { ...valid, category: 'Yachts' })).status, 400);
  expect('Unknown status', (await request('POST', `${g}/expenses`, user.token, { ...valid, status: 'maybe' })).status, 400);
  expect('Invalid date', (await request('POST', `${g}/expenses`, user.token, { ...valid, date: 'not-a-date' })).status, 400);
  expect('Valid expense', (await request('POST', `${g}/expenses`, user.token, valid)).status, 200);

  const { data: pending } = await request('POST', `${g}/expenses`, user.token, { ...valid, status: 'pending' });
  expect('Pay pending expense', (await request('PATCH', `/expenses/${pending.id}/pay`, other.token)).status, 200);
  expect('Pay it again', (await request('PATCH', `/expenses/${pending.id}/pay`, user.token)).status, 409);

  console.log('\nDrinks:');
  const drink = { name: 'Matcha', cost: 6.5, rating: 5 };
  expect('Rating of 47', (await request('POST', `${g}/drinks`, user.token, { ...drink, rating: 47 })).status, 400);
  expect('Rating of 3.5', (await request('POST', `${g}/drinks`, user.token, { ...drink, rating: 3.5 })).status, 400);
  expect('Negative cost', (await request('POST', `${g}/drinks`, user.token, { ...drink, cost: -1 })).status, 400);
  expect('Non-http image URL', (await request('POST', `${g}/drinks`, user.token, { ...drink, imageUrl: 'javascript:alert(1)' })).status, 400);
  expect('Valid drink', (await request('POST', `${g}/drinks`, user.token, drink)).status, 200);

  console.log('\nAI parsing:');
  expect('Empty text', (await request('POST', `${g}/parse-expense`, user.token, { text: '' })).status, 400);
  expect('Text over 500 characters', (await request('POST', `${g}/parse-expense`, user.token, { text: 'a'.repeat(501) })).status, 400);

  finish();
}

main();
