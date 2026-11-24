import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateQuestionAnswer,
  gradeAttemptFromSnapshot,
  isQuestionLiveInMockExam,
  sanitizeSnapshotForClient,
  shuffleDeterministic,
} from './exam-engine.ts';
import type { ImmutableExamSnapshot } from '../db/schema.ts';

test('isQuestionLiveInMockExam strictly allows only Published questions', () => {
  assert.equal(isQuestionLiveInMockExam('Published'), true);
  assert.equal(isQuestionLiveInMockExam('Draft'), false);
  assert.equal(isQuestionLiveInMockExam('Academic Review'), false);
  assert.equal(isQuestionLiveInMockExam('Correction'), false);
  assert.equal(isQuestionLiveInMockExam('Approval'), false);
});

test('sanitizeSnapshotForClient strips correct answers and explanations before sending to student client', () => {
  const snapshot: ImmutableExamSnapshot = {
    examId: 1,
    examSlug: 'ioe-be-mock-1',
    examTitle: 'IOE Engineering Mock',
    durationMinutes: 120,
    totalMarks: 4,
    negativeMarkingEnabled: true,
    questions: [
      {
        questionId: 10,
        questionUid: 'Q-IOE-01',
        sectionId: 1,
        sectionTitle: 'Physics',
        questionType: 'single_mcq',
        difficulty: 'medium',
        academicLevel: 'Bachelor Entrance',
        examination: 'IOE',
        subjectName: 'Physics',
        chapterName: 'Mechanics',
        topicName: 'Rotational Dynamics',
        questionContent: { prompt: 'What is the SI unit of torque?' },
        options: [
          { optionKey: 'A', optionText: 'N·m', optionTextNe: null },
          { optionKey: 'B', optionText: 'kg/m', optionTextNe: null },
        ],
        correctAnswer: { optionKeys: ['A'] },
        explanation: 'Torque = r × F so unit is N·m.',
        explanationNe: null,
        marks: 2,
        negativeMarks: 0.2,
        sortOrder: 1,
      },
    ],
  };

  const sanitized = sanitizeSnapshotForClient(snapshot);
  const q = sanitized.questions[0] as unknown as Record<string, unknown>;
  assert.equal('correctAnswer' in q, false);
  assert.equal('explanation' in q, false);
  assert.equal(q.questionUid, 'Q-IOE-01');
});

test('evaluateQuestionAnswer grades all specialized types including numerical, matching, and multiple_mcq', () => {
  // Multiple MCQ exact set match
  assert.equal(
    evaluateQuestionAnswer(
      'multiple_mcq',
      { optionKeys: ['A', 'C'] },
      { optionKeys: ['C', 'A'] },
      2,
      0.5,
    ).status,
    'correct',
  );
  assert.equal(
    evaluateQuestionAnswer(
      'multiple_mcq',
      { optionKeys: ['A', 'C'] },
      { optionKeys: ['A'] },
      2,
      0.5,
    ).marksAwarded,
    -0.5,
  );

  // Numerical with tolerance
  assert.equal(
    evaluateQuestionAnswer(
      'numerical',
      { numericValue: 9.81, tolerance: 0.05 },
      { numericValue: 9.8 },
      2,
      0.2,
    ).isCorrect,
    true,
  );

  // Matching
  assert.equal(
    evaluateQuestionAnswer(
      'matching',
      { matchingMap: { '1': 'B', '2': 'A' } },
      { matchingMap: { '1': 'B', '2': 'A' } },
      2,
      0,
    ).status,
    'correct',
  );

  // Short answer rubric keywords
  assert.equal(
    evaluateQuestionAnswer(
      'short_answer',
      { keywords: ['inertia', 'torque'] },
      { textValue: 'Moment of inertia resists rotational acceleration under applied torque.' },
      2,
      0,
    ).status,
    'correct',
  );
});

test('gradeAttemptFromSnapshot calculates negative marking, accuracy, and subject/chapter/topic breakdowns', () => {
  const snapshot: ImmutableExamSnapshot = {
    examId: 99,
    examSlug: 'mecee-bl-mock-1',
    examTitle: 'MECEE-BL Mock',
    durationMinutes: 180,
    totalMarks: 3,
    negativeMarkingEnabled: true,
    questions: [
      {
        questionId: 1,
        questionUid: 'Q1',
        sectionId: 1,
        sectionTitle: 'Biology',
        questionType: 'single_mcq',
        difficulty: 'easy',
        academicLevel: 'Bachelor Entrance',
        examination: 'MECEE-BL',
        subjectName: 'Biology',
        chapterName: 'Cell Biology',
        topicName: 'Mitochondria',
        questionContent: { prompt: 'Powerhouse?' },
        options: [],
        correctAnswer: { optionKeys: ['A'] },
        explanation: 'ATP synthesis.',
        explanationNe: null,
        marks: 1,
        negativeMarks: 0.25,
        sortOrder: 1,
      },
      {
        questionId: 2,
        questionUid: 'Q2',
        sectionId: 2,
        sectionTitle: 'Chemistry',
        questionType: 'true_false',
        difficulty: 'medium',
        academicLevel: 'Bachelor Entrance',
        examination: 'MECEE-BL',
        subjectName: 'Chemistry',
        chapterName: 'Acids & Bases',
        topicName: 'pH Scale',
        questionContent: { prompt: 'pH of pure water at 25C is 7.' },
        options: [],
        correctAnswer: { booleanValue: true },
        explanation: 'Neutral at 25C.',
        explanationNe: null,
        marks: 1,
        negativeMarks: 0.25,
        sortOrder: 2,
      },
      {
        questionId: 3,
        questionUid: 'Q3',
        sectionId: 2,
        sectionTitle: 'Chemistry',
        questionType: 'single_mcq',
        difficulty: 'hard',
        academicLevel: 'Bachelor Entrance',
        examination: 'MECEE-BL',
        subjectName: 'Chemistry',
        chapterName: 'Acids & Bases',
        topicName: 'Buffers',
        questionContent: { prompt: 'Buffer formula?' },
        options: [],
        correctAnswer: { optionKeys: ['B'] },
        explanation: 'Henderson-Hasselbalch.',
        explanationNe: null,
        marks: 1,
        negativeMarks: 0.25,
        sortOrder: 3,
      },
    ],
  };

  const answers = new Map([
    [1, { optionKeys: ['A'] }], // +1
    [2, { booleanValue: false }], // -0.25
    // 3 unattempted -> 0
  ]);

  const graded = gradeAttemptFromSnapshot(snapshot, answers, 420);
  assert.equal(graded.totalMarks, 3);
  assert.equal(graded.obtainedMarks, 0.75);
  assert.equal(graded.correctCount, 1);
  assert.equal(graded.incorrectCount, 1);
  assert.equal(graded.unattemptedCount, 1);
  assert.equal(graded.accuracyPercent, 50);
  assert.equal(graded.subjectBreakdown.length, 2);
  assert.equal(graded.chapterBreakdown.length, 2);
  assert.equal(graded.topicBreakdown.length, 3);
});

test('shuffleDeterministic preserves array items and produces repeatable order for same seed', () => {
  const input = [1, 2, 3, 4, 5];
  const a = shuffleDeterministic(input, 'attempt-123');
  const b = shuffleDeterministic(input, 'attempt-123');
  assert.deepEqual(a, b);
  assert.deepEqual([...a].sort(), input);
});
