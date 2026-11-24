import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEARNING_PILLARS,
  MORE_NAV_ITEMS,
  NEPAL_QUICK_TRACKS,
  PRIMARY_NAV_ITEMS,
  isSecondaryTabActive,
} from './pillars.ts';

test('LEARNING_PILLARS covers all 5 core educational pillars cleanly', () => {
  assert.deepEqual(
    LEARNING_PILLARS.map((p) => p.id),
    ['learn', 'practice', 'test', 'improve', 'discover'],
  );
  for (const pillar of LEARNING_PILLARS) {
    assert.ok(pillar.route.startsWith('/'));
    assert.ok(pillar.ctaLabel.length >= 4);
  }
});

test('NEPAL_QUICK_TRACKS maps Class 10/SEE, Class 11, Class 12, and Bachelor Entrances', () => {
  assert.equal(NEPAL_QUICK_TRACKS.length, 4);
  assert.deepEqual(
    NEPAL_QUICK_TRACKS.map((t) => t.route),
    ['/school/class-10', '/school/class-11', '/school/class-12', '/entrance'],
  );
});

test('Navigation groups preserve all 13 Phase 1-8 workspace destinations cleanly', () => {
  const allIds = [...PRIMARY_NAV_ITEMS, ...MORE_NAV_ITEMS].map((item) => item.id);
  assert.equal(PRIMARY_NAV_ITEMS.length, 5);
  assert.equal(allIds.length, 13);
  assert.equal(new Set(allIds).size, 13);
  assert.equal(isSecondaryTabActive('community'), true);
  assert.equal(isSecondaryTabActive('dashboard'), false);
});
