import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './auth-crypto';

test('hashPassword and verifyPassword verify valid password and reject invalid password', () => {
  const hash = hashPassword('Himalaya99!');
  assert.ok(hash.includes(':'));
  assert.equal(verifyPassword('Himalaya99!', hash), true);
  assert.equal(verifyPassword('WrongPass99!', hash), false);
  assert.equal(verifyPassword('Himalaya99!', 'malformed'), false);
});

test('signSessionToken and verifySessionToken validate signature and expiry', () => {
  const secret = 'test-secret-key-for-hamro-education';
  const token = signSessionToken(
    { sub: 'local:abc', userId: 7, email: 'aarav@hamro.edu.np' },
    secret,
    3600,
  );

  const verified = verifySessionToken(token, secret);
  assert.ok(verified);
  assert.equal(verified?.userId, 7);
  assert.equal(verified?.email, 'aarav@hamro.edu.np');

  // Tampered token fails
  const tampered = `${token.slice(0, -4)}xxxx`;
  assert.equal(verifySessionToken(tampered, secret), null);

  // Wrong secret fails
  assert.equal(verifySessionToken(token, 'other-secret'), null);

  // Expired token fails
  const futureTime = Math.floor(Date.now() / 1000) + 7200;
  assert.equal(verifySessionToken(token, secret, futureTime), null);
});
