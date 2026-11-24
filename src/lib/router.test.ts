import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canStudentViewResourceStatus,
  normalizeGradeSlug,
  parseAppRoute,
} from './router';

test('parseAppRoute resolves homepage and school routes cleanly', () => {
  assert.deepEqual(parseAppRoute('/'), { kind: 'home', tab: 'curriculum' });
  assert.deepEqual(parseAppRoute('/school/class-10'), {
    kind: 'school-grade',
    gradeSlug: 'class-10',
  });
  assert.deepEqual(parseAppRoute('/school/see'), {
    kind: 'school-grade',
    gradeSlug: 'see',
  });
  assert.deepEqual(parseAppRoute('/school/class-11'), {
    kind: 'school-grade',
    gradeSlug: 'class-11',
  });
  assert.deepEqual(parseAppRoute('/school/class-12'), {
    kind: 'school-grade',
    gradeSlug: 'class-12',
  });
  assert.deepEqual(parseAppRoute('/school/class-10/MATH-101/1'), {
    kind: 'school-chapter',
    gradeSlug: 'class-10',
    subjectCode: 'MATH-101',
    chapterKey: '1',
  });
});

test('normalizeGradeSlug maps class-10 and see to G10', () => {
  assert.equal(normalizeGradeSlug('class-10'), 'G10');
  assert.equal(normalizeGradeSlug('see'), 'G10');
  assert.equal(normalizeGradeSlug('class-11'), 'G11');
  assert.equal(normalizeGradeSlug('class-12'), 'G12');
});

test('canStudentViewResourceStatus hides draft and in_review resources from guests and students', () => {
  assert.equal(canStudentViewResourceStatus('published', ['curriculum:read']), true);
  assert.equal(canStudentViewResourceStatus('draft', ['curriculum:read']), false);
  assert.equal(canStudentViewResourceStatus('in_review', ['curriculum:read']), false);

  assert.equal(canStudentViewResourceStatus('draft', ['curriculum:write']), true);
  assert.equal(canStudentViewResourceStatus('in_review', ['curriculum:review']), true);
  assert.equal(canStudentViewResourceStatus('draft', ['system:admin']), true);
});

test('parseAppRoute resolves Phase 4 entrance, question bank, and exam routes', () => {
  assert.deepEqual(parseAppRoute('/entrance'), { kind: 'entrance-hub' });
  assert.deepEqual(parseAppRoute('/entrance/bsc-csit'), {
    kind: 'entrance-detail',
    examSlug: 'bsc-csit',
  });
  assert.deepEqual(parseAppRoute('/question-bank'), { kind: 'question-bank' });
  assert.deepEqual(parseAppRoute('/exams'), { kind: 'exams-hub' });
  assert.deepEqual(parseAppRoute('/exams/ioe-be-mock-1'), {
    kind: 'exam-runner',
    examId: 'ioe-be-mock-1',
  });
  assert.deepEqual(parseAppRoute('/exams/12/result'), {
    kind: 'exam-result',
    examId: '12',
  });
});

test('parseAppRoute resolves Phase 5 student dashboard and signature feature routes', () => {
  assert.deepEqual(parseAppRoute('/dashboard'), { kind: 'dashboard' });
  assert.deepEqual(parseAppRoute('/dashboard/mistakes'), {
    kind: 'dashboard-mistakes',
  });
  assert.deepEqual(parseAppRoute('/dashboard/flashcards'), {
    kind: 'dashboard-flashcards',
  });
  assert.deepEqual(parseAppRoute('/dashboard/planner'), {
    kind: 'dashboard-planner',
  });
  assert.deepEqual(parseAppRoute('/practice/daily'), {
    kind: 'daily-practice',
    initialSection: 'challenges',
  });
  assert.deepEqual(parseAppRoute('/leaderboards'), {
    kind: 'daily-practice',
    initialSection: 'leaderboards',
  });
});

test('parseAppRoute resolves Phase 6 Career, Course, College, and Scholarship Explorer routes', () => {
  assert.deepEqual(parseAppRoute('/explore'), { kind: 'explore-courses' });
  assert.deepEqual(parseAppRoute('/explore/courses'), { kind: 'explore-courses' });
  assert.deepEqual(parseAppRoute('/explore/courses/compare'), {
    kind: 'explore-courses',
    compare: true,
  });
  assert.deepEqual(parseAppRoute('/explore/courses/bsc-csit'), {
    kind: 'explore-courses',
    slug: 'bsc-csit',
  });
  assert.deepEqual(parseAppRoute('/explore/colleges'), { kind: 'explore-colleges' });
  assert.deepEqual(parseAppRoute('/explore/scholarships'), { kind: 'explore-scholarships' });
  assert.deepEqual(parseAppRoute('/explore/careers'), { kind: 'explore-careers' });
  assert.deepEqual(parseAppRoute('/explore/opportunities'), {
    kind: 'explore-opportunities',
  });
});

test('parseAppRoute resolves Phase 7 Community route', () => {
  assert.deepEqual(parseAppRoute('/community'), { kind: 'community' });
});

test('parseAppRoute resolves Phase 8 Admin & Governance routes', () => {
  assert.deepEqual(parseAppRoute('/admin'), { kind: 'admin' });
  assert.deepEqual(parseAppRoute('/admin/audit-logs'), {
    kind: 'admin',
    section: 'audit-logs',
  });
  assert.deepEqual(parseAppRoute('/admin/questions'), {
    kind: 'admin',
    section: 'questions',
  });
});





