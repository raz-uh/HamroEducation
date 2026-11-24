import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AI_QUESTION_SOURCE_LABEL,
  SlidingWindowRateLimiter,
  canMarkTeacherVerified,
  canModerateCommunity,
  enforceAiQuestionDraftGuardrail,
  formatYouthSafeCommunityAuthor,
  moderateCommunityText,
  validateAiPromptText,
} from './ai-community.ts';

test('SlidingWindowRateLimiter allows within window and blocks above limit until window expires', () => {
  const limiter = new SlidingWindowRateLimiter();
  const base = 1_700_000_000_000;

  assert.equal(limiter.consume('user:1', 2, 60_000, base).allowed, true);
  const second = limiter.consume('user:1', 2, 60_000, base + 1000);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);

  const blocked = limiter.consume('user:1', 2, 60_000, base + 2000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 58);

  // After 60 seconds, oldest request expires
  const allowedAfterWindow = limiter.consume('user:1', 2, 60_000, base + 61_000);
  assert.equal(allowedAfterWindow.allowed, true);
});

test('validateAiPromptText rejects empty, non-string, and oversized payloads', () => {
  assert.equal(validateAiPromptText('').valid, false);
  assert.equal(validateAiPromptText(null).valid, false);
  assert.equal(validateAiPromptText('x'.repeat(2001)).valid, false);

  const ok = validateAiPromptText('  Explain Ohm law for SEE students\u0000  ');
  assert.equal(ok.valid, true);
  if (ok.valid) {
    assert.equal(ok.text, 'Explain Ohm law for SEE students');
  }
});

test('moderateCommunityText blocks profanity, spam, and youth PII (phone/email)', () => {
  assert.equal(
    moderateCommunityText('Can someone explain Kirchoff current law in Class 12 Physics?').clean,
    true,
  );

  const profanity = moderateCommunityText('This question is shit and stupid');
  assert.equal(profanity.clean, false);
  assert.ok(profanity.violations.includes('profanity_or_abuse'));

  const phoneLeak = moderateCommunityText('Call me at 9841234567 for notes');
  assert.equal(phoneLeak.clean, false);
  assert.ok(phoneLeak.violations.includes('personal_phone_pii'));

  const emailLeak = moderateCommunityText('Send PDF to student.test@gmail.com');
  assert.equal(emailLeak.clean, false);
  assert.ok(emailLeak.violations.includes('personal_email_pii'));
});

test('formatYouthSafeCommunityAuthor masks student surnames and identifies verified educators without PII', () => {
  const student = formatYouthSafeCommunityAuthor({
    fullName: 'Aarav Sharma',
    roleSlugs: ['registered_student'],
    userId: 14,
    gradeOrTrack: 'Class 12 Science',
  });
  assert.equal(student.displayHandle, 'Aarav S.');
  assert.equal(student.isEducator, false);
  assert.equal(student.trackLabel, 'Class 12 Science');

  const emailFallback = formatYouthSafeCommunityAuthor({
    fullName: 'secret@example.com',
    roleSlugs: ['registered_student'],
    userId: 22,
  });
  assert.equal(emailFallback.displayHandle.includes('@'), false);

  const teacher = formatYouthSafeCommunityAuthor({
    fullName: 'Dr. Ramesh Adhikari',
    roleSlugs: ['teacher'],
    userId: 5,
  });
  assert.equal(teacher.isEducator, true);
  assert.equal(teacher.roleLabel, 'Verified Teacher');
});

test('enforceAiQuestionDraftGuardrail strictly forces Draft status regardless of caller input', () => {
  const safeguarded = enforceAiQuestionDraftGuardrail({
    prompt: 'What is SI unit of impulse?',
    status: 'Published',
    source: 'Tampered',
    aiGenerated: false,
  });
  assert.equal(safeguarded.status, 'Draft');
  assert.equal(safeguarded.source, AI_QUESTION_SOURCE_LABEL);
  assert.equal(safeguarded.aiGenerated, true);
});

test('RBAC helpers separate student vs teacher-verification vs moderation permissions', () => {
  assert.equal(canMarkTeacherVerified(['curriculum:read'], ['registered_student']), false);
  assert.equal(canMarkTeacherVerified(['curriculum:write'], ['teacher']), true);
  assert.equal(canMarkTeacherVerified(['curriculum:review'], ['academic_reviewer']), true);

  assert.equal(canModerateCommunity(['curriculum:write'], ['teacher']), false);
  assert.equal(canModerateCommunity(['moderation:act'], ['moderator']), true);
});
