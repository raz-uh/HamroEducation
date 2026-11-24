import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BADGE_CATALOG,
  computeNextSpacedReview,
  computeRecommendedNextAction,
  detectWeakTopics,
  evaluateUnlockedBadges,
  formatPrivacySafeName,
} from './student-features';

test('evaluateUnlockedBadges detects all 7 milestone badges accurately', () => {
  assert.equal(BADGE_CATALOG.length, 7);

  const earned = evaluateUnlockedBadges({
    completedMockTests: 10,
    dailyChallengesCompleted: 2,
    streakDays: 7,
    totalQuestionsSolved: 120,
    masteredTopicsCount: 4,
    resolvedMistakesCount: 5,
    improvementDeltaPercent: 14,
    completedStudyTasks: 3,
  });

  const codes = earned.map((b) => b.code);
  assert.deepEqual(codes.sort(), [
    'chapter_master',
    'consistent_learner',
    'first_test',
    'hundred_questions',
    'most_improved',
    'seven_day_streak',
    'ten_mock_tests',
  ]);
});

test('detectWeakTopics flags topics below 60% accuracy with actionable recommendations', () => {
  const weak = detectWeakTopics([
    {
      academicLevel: 'Class 12 / NEB',
      subjectName: 'Physics',
      chapterName: 'Rotational Dynamics',
      topicName: 'Moment of Inertia',
      totalAttempts: 5,
      correctAttempts: 2,
      accuracyPercent: 40,
    },
    {
      academicLevel: 'SEE / Class 10',
      subjectName: 'Mathematics',
      chapterName: 'Sets',
      topicName: 'Venn Diagrams',
      totalAttempts: 4,
      correctAttempts: 1,
      accuracyPercent: 25,
    },
    {
      academicLevel: 'SEE / Class 10',
      subjectName: 'Science',
      chapterName: 'Force',
      topicName: 'Gravitation',
      totalAttempts: 5,
      correctAttempts: 4,
      accuracyPercent: 80,
    },
  ]);

  assert.equal(weak.length, 2);
  assert.equal(weak[0].topicName, 'Venn Diagrams');
  assert.equal(weak[0].severity, 'critical');
  assert.equal(weak[0].recommendations.chapterNotesRoute, '/school/class-10/MATH-10/1?tab=notes');
  assert.equal(weak[1].severity, 'needs_focus');
  assert.equal(weak[1].recommendations.chapterNotesRoute, '/school/class-12/PHY-12/1?tab=notes');
});

test('computeNextSpacedReview schedules intervals across ratings', () => {
  const baseDate = new Date('2026-11-23T06:00:00Z');
  const easyFirst = computeNextSpacedReview({
    repetitions: 0,
    intervalDays: 1,
    easeFactor: 2.5,
    rating: 'easy',
    now: baseDate,
  });
  assert.equal(easyFirst.intervalDays, 3);
  assert.equal(easyFirst.repetitions, 1);

  const goodNext = computeNextSpacedReview({
    repetitions: 2,
    intervalDays: 4,
    easeFactor: 2.5,
    rating: 'good',
    now: baseDate,
  });
  assert.equal(goodNext.intervalDays, 10);
  assert.equal(goodNext.repetitions, 3);

  const resetOnAgain = computeNextSpacedReview({
    repetitions: 4,
    intervalDays: 14,
    easeFactor: 2.5,
    rating: 'again',
    now: baseDate,
  });
  assert.equal(resetOnAgain.repetitions, 0);
  assert.equal(resetOnAgain.intervalDays, 1);
});

test('formatPrivacySafeName masks PII and obeys privacy modes', () => {
  assert.equal(
    formatPrivacySafeName({
      fullName: 'Aarav Sharma',
      privacyMode: 'masked',
      userId: 19,
    }),
    'Aarav S. · #19',
  );
  assert.equal(
    formatPrivacySafeName({
      fullName: 'secret@example.com',
      leaderboardAlias: 'HimalayanEuler',
      privacyMode: 'alias',
      userId: 19,
    }),
    'HimalayanEuler',
  );
  assert.equal(
    formatPrivacySafeName({
      fullName: 'secret@example.com',
      privacyMode: 'public_name',
      userId: 19,
    }),
    'secret',
  );
});

test('computeRecommendedNextAction prioritizes weak topics -> mistakes -> tasks -> flashcards -> daily', () => {
  const weak = detectWeakTopics([
    {
      academicLevel: 'Class 12 / NEB',
      subjectName: 'Physics',
      chapterName: 'Optics',
      topicName: 'Wave Optics',
      totalAttempts: 4,
      correctAttempts: 1,
      accuracyPercent: 25,
    },
  ]);

  const act1 = computeRecommendedNextAction({
    weakTopics: weak,
    unresolvedMistakesCount: 3,
    pendingTaskTodayTitle: 'Revise Calculus',
    pendingTasksTodayCount: 1,
    dueFlashcardsCount: 4,
    dailyChallengeDoneToday: false,
  });
  assert.equal(act1.priorityType, 'weak_topic');

  const act2 = computeRecommendedNextAction({
    weakTopics: [],
    unresolvedMistakesCount: 3,
    pendingTaskTodayTitle: 'Revise Calculus',
    pendingTasksTodayCount: 1,
    dueFlashcardsCount: 4,
    dailyChallengeDoneToday: false,
  });
  assert.equal(act2.priorityType, 'unresolved_mistakes');
  assert.equal(act2.route, '/dashboard/mistakes');

  const act3 = computeRecommendedNextAction({
    weakTopics: [],
    unresolvedMistakesCount: 0,
    pendingTaskTodayTitle: 'Revise Calculus',
    pendingTasksTodayCount: 1,
    dueFlashcardsCount: 4,
    dailyChallengeDoneToday: false,
  });
  assert.equal(act3.priorityType, 'daily_task');
});
