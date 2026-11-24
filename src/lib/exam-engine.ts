import type {
  ImmutableExamQuestionSnapshot,
  ImmutableExamSnapshot,
  PerformanceBreakdownBucket,
  QuestionAnswerJson,
  QuestionType,
  QuestionWorkflowStatus,
} from '../db/schema.ts';

export const QUESTION_WORKFLOW_STAGES: QuestionWorkflowStatus[] = [
  'Draft',
  'Academic Review',
  'Correction',
  'Approval',
  'Published',
  'Archived',
];

export const QUESTION_TYPE_CATALOG: Array<{
  id: QuestionType;
  label: string;
  shortLabel: string;
}> = [
  { id: 'single_mcq', label: 'Single-correct MCQ', shortLabel: 'Single MCQ' },
  { id: 'multiple_mcq', label: 'Multiple-correct MCQ', shortLabel: 'Multi MCQ' },
  { id: 'true_false', label: 'True / False', shortLabel: 'True/False' },
  { id: 'short_answer', label: 'Short Answer', shortLabel: 'Short' },
  { id: 'long_answer', label: 'Long Answer', shortLabel: 'Long' },
  { id: 'numerical', label: 'Numerical', shortLabel: 'Numerical' },
  { id: 'diagram_based', label: 'Diagram-based', shortLabel: 'Diagram' },
  { id: 'case_based', label: 'Case-based', shortLabel: 'Case' },
  { id: 'assertion_reason', label: 'Assertion & Reason', shortLabel: 'Assertion' },
  { id: 'matching', label: 'Matching', shortLabel: 'Matching' },
];

export function isQuestionLiveInMockExam(status: string): boolean {
  return status === 'Published';
}

export function canUserManageQuestions(permissions: string[]): boolean {
  return (
    permissions.includes('questions:manage') ||
    permissions.includes('exams:manage') ||
    permissions.includes('curriculum:review') ||
    permissions.includes('system:admin')
  );
}

export function hasAttemptExpired(
  expiresAt: Date | string,
  now: Date = new Date(),
): boolean {
  const expMs = typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt.getTime();
  return now.getTime() >= expMs;
}

export function shuffleDeterministic<T>(items: T[], seedInput: string): T[] {
  const arr = [...items];
  let hash = 2166136261;
  for (let i = 0; i < seedInput.length; i += 1) {
    hash ^= seedInput.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const nextRand = () => {
    hash += 0x6d2b79f5;
    let t = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRand() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

export interface SanitizedExamQuestion {
  questionId: number;
  questionUid: string;
  sectionId: number | null;
  sectionTitle: string;
  questionType: QuestionType;
  difficulty: string;
  academicLevel: string;
  examination: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  questionContent: ImmutableExamQuestionSnapshot['questionContent'];
  options: ImmutableExamQuestionSnapshot['options'];
  marks: number;
  negativeMarks: number;
  sortOrder: number;
}

export interface SanitizedExamSnapshot {
  examId: number;
  examSlug: string;
  examTitle: string;
  durationMinutes: number;
  totalMarks: number;
  negativeMarkingEnabled: boolean;
  questions: SanitizedExamQuestion[];
}

export function sanitizeSnapshotForClient(
  snapshot: ImmutableExamSnapshot,
): SanitizedExamSnapshot {
  return {
    examId: snapshot.examId,
    examSlug: snapshot.examSlug,
    examTitle: snapshot.examTitle,
    durationMinutes: snapshot.durationMinutes,
    totalMarks: snapshot.totalMarks,
    negativeMarkingEnabled: snapshot.negativeMarkingEnabled,
    questions: snapshot.questions.map((q) => ({
      questionId: q.questionId,
      questionUid: q.questionUid,
      sectionId: q.sectionId,
      sectionTitle: q.sectionTitle,
      questionType: q.questionType,
      difficulty: q.difficulty,
      academicLevel: q.academicLevel,
      examination: q.examination,
      subjectName: q.subjectName,
      chapterName: q.chapterName,
      topicName: q.topicName,
      questionContent: q.questionContent,
      options: q.options,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      sortOrder: q.sortOrder,
    })),
  };
}

export interface SubmittedAnswerPayload {
  optionKeys?: string[];
  booleanValue?: boolean;
  numericValue?: number | null;
  textValue?: string;
  matchingMap?: Record<string, string>;
}

export function isAnswerProvided(
  questionType: QuestionType,
  ans: SubmittedAnswerPayload | null | undefined,
): boolean {
  if (!ans) return false;
  switch (questionType) {
    case 'single_mcq':
    case 'multiple_mcq':
    case 'diagram_based':
    case 'case_based':
    case 'assertion_reason':
      return Array.isArray(ans.optionKeys) && ans.optionKeys.length > 0;
    case 'true_false':
      return typeof ans.booleanValue === 'boolean';
    case 'numerical':
      return typeof ans.numericValue === 'number' && Number.isFinite(ans.numericValue);
    case 'short_answer':
    case 'long_answer':
      return typeof ans.textValue === 'string' && ans.textValue.trim().length > 0;
    case 'matching':
      return Boolean(
        ans.matchingMap && Object.values(ans.matchingMap).some((v) => v && v.trim().length > 0),
      );
    default:
      return false;
  }
}

export function evaluateQuestionAnswer(
  questionType: QuestionType,
  expected: QuestionAnswerJson,
  submitted: SubmittedAnswerPayload | null | undefined,
  marks: number,
  negativeMarks: number,
): {
  status: 'unattempted' | 'correct' | 'incorrect';
  isCorrect: boolean | null;
  marksAwarded: number;
} {
  if (!isAnswerProvided(questionType, submitted)) {
    return { status: 'unattempted', isCorrect: null, marksAwarded: 0 };
  }

  let matched = false;
  const sub = submitted!;

  switch (questionType) {
    case 'single_mcq':
    case 'diagram_based':
    case 'case_based':
    case 'assertion_reason': {
      const expKeys = (expected.optionKeys ?? []).map((k) => k.trim().toUpperCase()).sort();
      const subKeys = (sub.optionKeys ?? []).map((k) => k.trim().toUpperCase()).sort();
      matched =
        expKeys.length > 0 &&
        expKeys.length === subKeys.length &&
        expKeys.every((k, idx) => k === subKeys[idx]);
      break;
    }
    case 'multiple_mcq': {
      const expSet = Array.from(
        new Set((expected.optionKeys ?? []).map((k) => k.trim().toUpperCase())),
      ).sort();
      const subSet = Array.from(
        new Set((sub.optionKeys ?? []).map((k) => k.trim().toUpperCase())),
      ).sort();
      matched =
        expSet.length > 0 &&
        expSet.length === subSet.length &&
        expSet.every((k, idx) => k === subSet[idx]);
      break;
    }
    case 'true_false': {
      matched =
        typeof expected.booleanValue === 'boolean' &&
        sub.booleanValue === expected.booleanValue;
      break;
    }
    case 'numerical': {
      if (
        typeof expected.numericValue === 'number' &&
        typeof sub.numericValue === 'number' &&
        Number.isFinite(sub.numericValue)
      ) {
        const tol = typeof expected.tolerance === 'number' ? expected.tolerance : 0.01;
        matched = Math.abs(sub.numericValue - expected.numericValue) <= tol;
      }
      break;
    }
    case 'short_answer':
    case 'long_answer': {
      const text = (sub.textValue ?? '').trim().toLowerCase();
      const keywords = (expected.keywords ?? []).map((kw) => kw.trim().toLowerCase()).filter(Boolean);
      if (keywords.length > 0) {
        const hits = keywords.filter((kw) => text.includes(kw)).length;
        matched = hits >= Math.ceil(keywords.length / 2);
      } else if (expected.acceptedText) {
        matched = text === expected.acceptedText.trim().toLowerCase();
      }
      break;
    }
    case 'matching': {
      const expMap = expected.matchingMap ?? {};
      const subMap = sub.matchingMap ?? {};
      const expKeys = Object.keys(expMap);
      matched =
        expKeys.length > 0 &&
        expKeys.every(
          (k) =>
            (subMap[k] ?? '').trim().toLowerCase() ===
            (expMap[k] ?? '').trim().toLowerCase(),
        );
      break;
    }
    default:
      matched = false;
  }

  if (matched) {
    return { status: 'correct', isCorrect: true, marksAwarded: roundScore(marks) };
  }

  const deduction = negativeMarks > 0 ? -Math.abs(negativeMarks) : 0;
  return { status: 'incorrect', isCorrect: false, marksAwarded: roundScore(deduction) };
}

function roundScore(val: number): number {
  return Math.round(val * 100) / 100;
}

export interface GradedQuestionReviewItem {
  questionId: number;
  questionUid: string;
  sectionTitle: string;
  questionType: QuestionType;
  difficulty: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  questionContent: ImmutableExamQuestionSnapshot['questionContent'];
  options: ImmutableExamQuestionSnapshot['options'];
  submittedAnswer: SubmittedAnswerPayload | null;
  correctAnswer: QuestionAnswerJson;
  explanation: string;
  explanationNe: string | null;
  status: 'unattempted' | 'correct' | 'incorrect';
  isCorrect: boolean | null;
  maxMarks: number;
  negativeMarks: number;
  marksAwarded: number;
}

export interface GradedAttemptSummary {
  totalMarks: number;
  obtainedMarks: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  accuracyPercent: number;
  timeTakenSeconds: number;
  subjectBreakdown: PerformanceBreakdownBucket[];
  chapterBreakdown: PerformanceBreakdownBucket[];
  topicBreakdown: PerformanceBreakdownBucket[];
  gradedQuestions: GradedQuestionReviewItem[];
}

export function gradeAttemptFromSnapshot(
  snapshot: ImmutableExamSnapshot,
  answersByQuestionId: Map<number, SubmittedAnswerPayload | null>,
  timeTakenSeconds: number,
): GradedAttemptSummary {
  let totalMarks = 0;
  let obtainedMarks = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;

  const subjectMap = new Map<string, PerformanceBreakdownBucket>();
  const chapterMap = new Map<string, PerformanceBreakdownBucket>();
  const topicMap = new Map<string, PerformanceBreakdownBucket>();

  const updateBucket = (
    map: Map<string, PerformanceBreakdownBucket>,
    key: string,
    label: string,
    qMarks: number,
    awarded: number,
    outcome: 'correct' | 'incorrect' | 'unattempted',
  ) => {
    const bucket = map.get(key) ?? {
      key,
      label,
      totalQuestions: 0,
      correct: 0,
      incorrect: 0,
      unattempted: 0,
      maxMarks: 0,
      obtainedMarks: 0,
      accuracyPercent: 0,
    };
    bucket.totalQuestions += 1;
    bucket.maxMarks = roundScore(bucket.maxMarks + qMarks);
    bucket.obtainedMarks = roundScore(bucket.obtainedMarks + awarded);
    if (outcome === 'correct') bucket.correct += 1;
    else if (outcome === 'incorrect') bucket.incorrect += 1;
    else bucket.unattempted += 1;
    const attempted = bucket.correct + bucket.incorrect;
    bucket.accuracyPercent =
      attempted > 0 ? roundScore((bucket.correct / attempted) * 100) : 0;
    map.set(key, bucket);
  };

  const gradedQuestions: GradedQuestionReviewItem[] = snapshot.questions.map((q) => {
    const submitted = answersByQuestionId.get(q.questionId) ?? null;
    const evaluation = evaluateQuestionAnswer(
      q.questionType,
      q.correctAnswer,
      submitted,
      q.marks,
      snapshot.negativeMarkingEnabled ? q.negativeMarks : 0,
    );

    totalMarks = roundScore(totalMarks + q.marks);
    obtainedMarks = roundScore(obtainedMarks + evaluation.marksAwarded);

    if (evaluation.status === 'correct') correctCount += 1;
    else if (evaluation.status === 'incorrect') incorrectCount += 1;
    else unattemptedCount += 1;

    updateBucket(subjectMap, q.subjectName, q.subjectName, q.marks, evaluation.marksAwarded, evaluation.status);
    updateBucket(
      chapterMap,
      `${q.subjectName}::${q.chapterName}`,
      `${q.subjectName} — ${q.chapterName}`,
      q.marks,
      evaluation.marksAwarded,
      evaluation.status,
    );
    updateBucket(
      topicMap,
      `${q.chapterName}::${q.topicName}`,
      q.topicName,
      q.marks,
      evaluation.marksAwarded,
      evaluation.status,
    );

    return {
      questionId: q.questionId,
      questionUid: q.questionUid,
      sectionTitle: q.sectionTitle,
      questionType: q.questionType,
      difficulty: q.difficulty,
      subjectName: q.subjectName,
      chapterName: q.chapterName,
      topicName: q.topicName,
      questionContent: q.questionContent,
      options: q.options,
      submittedAnswer: submitted,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      explanationNe: q.explanationNe,
      status: evaluation.status,
      isCorrect: evaluation.isCorrect,
      maxMarks: q.marks,
      negativeMarks: snapshot.negativeMarkingEnabled ? q.negativeMarks : 0,
      marksAwarded: evaluation.marksAwarded,
    };
  });

  const totalAttempted = correctCount + incorrectCount;
  const accuracyPercent =
    totalAttempted > 0 ? roundScore((correctCount / totalAttempted) * 100) : 0;

  return {
    totalMarks,
    obtainedMarks,
    correctCount,
    incorrectCount,
    unattemptedCount,
    accuracyPercent,
    timeTakenSeconds: Math.max(0, Math.round(timeTakenSeconds)),
    subjectBreakdown: Array.from(subjectMap.values()),
    chapterBreakdown: Array.from(chapterMap.values()),
    topicBreakdown: Array.from(topicMap.values()),
    gradedQuestions,
  };
}
