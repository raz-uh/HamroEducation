import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  achievements,
  applicationDeadlines,
  bookmarks,
  careerPaths,
  chapters,
  examAttempts,
  examResults,
  exams,
  flashcards,
  grades,
  learningProgress,
  mistakeBook,
  opportunities,
  personalNotes,
  profiles,
  questionExplanations,
  questionOptions,
  questions,
  resourceVersions,
  resources,
  scholarships,
  studentGoals,
  studyPlans,
  studyTasks,
  subjects,
  users,
  type MistakeQuestionSnapshot,
  type QuestionAnswerJson,
  type QuestionType,
  type SnapshotOptionItem,
} from './schema.ts';
import { ensureSeeded } from './seed.ts';
import {
  evaluateQuestionAnswer,
  type GradedQuestionReviewItem,
  type SubmittedAnswerPayload,
} from '../lib/exam-engine.ts';
import {
  BADGE_CATALOG,
  CAREER_OPPORTUNITIES_CATALOG,
  computeNextSpacedReview,
  computeRecommendedNextAction,
  detectWeakTopics,
  evaluateUnlockedBadges,
  formatPrivacySafeName,
  type SpacedRating,
} from '../lib/student-features.ts';

export function getNepalTodayDateStr(now = new Date()): string {
  // Nepal Standard Time is UTC+05:45 (345 minutes)
  const nst = new Date(now.getTime() + 345 * 60 * 1000);
  return nst.toISOString().slice(0, 10);
}

function getPreviousDateStr(dateStr: string): string {
  const dt = new Date(`${dateStr}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export async function ensureStudentGoalInitialized(userId: number) {
  await ensureSeeded();
  const existing = await db
    .select()
    .from(studentGoals)
    .where(eq(studentGoals.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(studentGoals)
    .values({
      userId,
      targetTrack: 'SEE Class 10',
      targetExamSlug: 'see-compulsory-mock-1',
      targetExamName: 'SEE Compulsory & Model Preparation',
      dailyStudyMinutes: 90,
      dailyQuestionTarget: 15,
      selectedSubjects: ['Compulsory Mathematics', 'Science & Technology', 'English', 'Computer Science'],
      careerInterests: ['Software Engineering & AI', 'Civil & Structural Engineering', 'Medicine & Public Health'],
      leaderboardPrivacy: 'masked',
    })
    .onConflictDoNothing({ target: studentGoals.userId })
    .returning();

  if (created) return created;
  const retry = await db
    .select()
    .from(studentGoals)
    .where(eq(studentGoals.userId, userId))
    .limit(1);
  return retry[0];
}

export async function syncStudentActivityAndBadges(params: {
  userId: number;
  questionsSolvedDelta?: number;
  completedDailyChallenge?: boolean;
}) {
  const goal = await ensureStudentGoalInitialized(params.userId);
  const today = getNepalTodayDateStr();
  const yesterday = getPreviousDateStr(today);

  let nextStreak = goal.streakDays;
  if (goal.lastActiveDate !== today) {
    if (goal.lastActiveDate === yesterday) {
      nextStreak = goal.streakDays + 1;
    } else {
      nextStreak = 1;
    }
  } else if (nextStreak === 0) {
    nextStreak = 1;
  }

  const nextLongest = Math.max(goal.longestStreakDays, nextStreak);
  const nextQuestionsSolved =
    goal.totalQuestionsSolved + Math.max(0, params.questionsSolvedDelta ?? 0);
  const nextDailyCount =
    goal.dailyChallengesCompleted + (params.completedDailyChallenge ? 1 : 0);
  const nextDailyDate = params.completedDailyChallenge ? today : goal.lastDailyChallengeDate;

  const [userExamResults, progressRows, mistakeRows, taskRows] = await Promise.all([
    db
      .select()
      .from(examResults)
      .where(eq(examResults.userId, params.userId))
      .orderBy(asc(examResults.createdAt)),
    db.select().from(learningProgress).where(eq(learningProgress.userId, params.userId)),
    db.select().from(mistakeBook).where(eq(mistakeBook.userId, params.userId)),
    db.select().from(studyTasks).where(eq(studyTasks.userId, params.userId)),
  ]);

  let improvementDelta = goal.improvementScore;
  if (userExamResults.length >= 2) {
    const firstAcc = userExamResults[0].accuracyPercent;
    const latestAcc = userExamResults[userExamResults.length - 1].accuracyPercent;
    improvementDelta = Math.max(0, Math.round((latestAcc - firstAcc) * 10) / 10);
  }

  const resolvedMistakesCount = mistakeRows.filter((m) => m.status === 'resolved').length;
  const masteredTopicsCount = progressRows.filter(
    (p) => p.totalAttempts >= 1 && p.accuracyPercent >= 85,
  ).length;
  const completedStudyTasks = taskRows.filter((t) => t.isCompleted).length;

  await db
    .update(studentGoals)
    .set({
      streakDays: nextStreak,
      longestStreakDays: nextLongest,
      lastActiveDate: today,
      totalQuestionsSolved: nextQuestionsSolved,
      dailyChallengesCompleted: nextDailyCount,
      lastDailyChallengeDate: nextDailyDate,
      improvementScore: improvementDelta,
      updatedAt: new Date(),
    })
    .where(eq(studentGoals.userId, params.userId));

  const candidateBadges = evaluateUnlockedBadges({
    completedMockTests: userExamResults.length,
    dailyChallengesCompleted: nextDailyCount,
    streakDays: nextStreak,
    totalQuestionsSolved: nextQuestionsSolved,
    masteredTopicsCount,
    resolvedMistakesCount,
    improvementDeltaPercent: improvementDelta,
    completedStudyTasks,
  });

  const existingBadges = await db
    .select()
    .from(achievements)
    .where(eq(achievements.userId, params.userId));
  const existingCodes = new Set(existingBadges.map((b) => b.badgeCode));

  const newlyUnlocked: Array<{ code: string; title: string; description: string }> = [];
  for (const badge of candidateBadges) {
    if (!existingCodes.has(badge.code)) {
      await db
        .insert(achievements)
        .values({
          userId: params.userId,
          badgeCode: badge.code,
          title: badge.title,
          description: badge.description,
          category: badge.category,
          metricValue: badge.metricValue,
        })
        .onConflictDoNothing({ target: [achievements.userId, achievements.badgeCode] });
      newlyUnlocked.push({
        code: badge.code,
        title: badge.title,
        description: badge.description,
      });
    }
  }

  return {
    streakDays: nextStreak,
    dailyChallengesCompleted: nextDailyCount,
    totalQuestionsSolved: nextQuestionsSolved,
    newlyUnlockedBadges: newlyUnlocked,
  };
}

async function recordSingleOutcome(params: {
  userId: number;
  sourceType: 'exam' | 'chapter_practice' | 'daily_challenge';
  sourceRefKey: string;
  questionId: number | null;
  resourceId: number | null;
  academicLevel: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  difficulty: string;
  questionSnapshot: MistakeQuestionSnapshot;
  submittedAnswer: SubmittedAnswerPayload | Record<string, unknown> | null;
  correctAnswer: QuestionAnswerJson;
  explanation: string;
  isCorrect: boolean;
}) {
  // 1. Update learning_progress
  const existingProgress = await db
    .select()
    .from(learningProgress)
    .where(
      and(
        eq(learningProgress.userId, params.userId),
        eq(learningProgress.subjectName, params.subjectName),
        eq(learningProgress.chapterName, params.chapterName),
        eq(learningProgress.topicName, params.topicName),
      ),
    )
    .limit(1);

  if (existingProgress[0]) {
    const nextTotal = existingProgress[0].totalAttempts + 1;
    const nextCorrect = existingProgress[0].correctAttempts + (params.isCorrect ? 1 : 0);
    const nextAcc = Math.round((nextCorrect / nextTotal) * 1000) / 10;
    await db
      .update(learningProgress)
      .set({
        academicLevel: params.academicLevel,
        totalAttempts: nextTotal,
        correctAttempts: nextCorrect,
        accuracyPercent: nextAcc,
        isWeak: nextAcc < 60,
        lastPracticedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(learningProgress.id, existingProgress[0].id));
  } else {
    const acc = params.isCorrect ? 100 : 0;
    await db.insert(learningProgress).values({
      userId: params.userId,
      academicLevel: params.academicLevel,
      subjectName: params.subjectName,
      chapterName: params.chapterName,
      topicName: params.topicName,
      totalAttempts: 1,
      correctAttempts: params.isCorrect ? 1 : 0,
      accuracyPercent: acc,
      isWeak: acc < 60,
    });
  }

  // 2. Update mistake_book
  const existingMistake = await db
    .select()
    .from(mistakeBook)
    .where(
      and(
        eq(mistakeBook.userId, params.userId),
        eq(mistakeBook.sourceRefKey, params.sourceRefKey),
      ),
    )
    .limit(1);

  if (!params.isCorrect) {
    if (existingMistake[0]) {
      await db
        .update(mistakeBook)
        .set({
          sourceType: params.sourceType,
          studentWrongAnswer: params.submittedAnswer as Record<string, unknown> | null,
          correctAnswer: params.correctAnswer,
          explanation: params.explanation,
          questionSnapshot: params.questionSnapshot,
          status: 'unresolved',
          attemptCount: existingMistake[0].attemptCount + 1,
          resolvedAt: null,
          lastAttemptedAt: new Date(),
        })
        .where(eq(mistakeBook.id, existingMistake[0].id));
    } else {
      await db.insert(mistakeBook).values({
        userId: params.userId,
        sourceType: params.sourceType,
        sourceRefKey: params.sourceRefKey,
        questionId: params.questionId,
        resourceId: params.resourceId,
        academicLevel: params.academicLevel,
        subjectName: params.subjectName,
        chapterName: params.chapterName,
        topicName: params.topicName,
        difficulty: params.difficulty,
        questionSnapshot: params.questionSnapshot,
        studentWrongAnswer: params.submittedAnswer as Record<string, unknown> | null,
        correctAnswer: params.correctAnswer,
        explanation: params.explanation,
        status: 'unresolved',
        attemptCount: 1,
      });
    }
    return 'recorded' as const;
  }

  if (existingMistake[0] && existingMistake[0].status === 'unresolved') {
    await db
      .update(mistakeBook)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        lastAttemptedAt: new Date(),
      })
      .where(eq(mistakeBook.id, existingMistake[0].id));
    return 'resolved' as const;
  }

  return 'none' as const;
}

export async function recordExamSubmissionToPhase5(params: {
  userId: number;
  gradedQuestions: GradedQuestionReviewItem[];
  academicLevelByQuestionId?: Map<number, string>;
}) {
  let solvedCount = 0;
  for (const gq of params.gradedQuestions) {
    if (gq.status === 'unattempted') continue;
    solvedCount += 1;
    const isCorrect = gq.status === 'correct';
    const academicLevel =
      params.academicLevelByQuestionId?.get(gq.questionId) ?? 'Board / Entrance';
    await recordSingleOutcome({
      userId: params.userId,
      sourceType: 'exam',
      sourceRefKey: gq.questionUid,
      questionId: gq.questionId,
      resourceId: null,
      academicLevel,
      subjectName: gq.subjectName,
      chapterName: gq.chapterName,
      topicName: gq.topicName,
      difficulty: gq.difficulty,
      questionSnapshot: {
        prompt: gq.questionContent.prompt,
        promptNe: gq.questionContent.promptNe,
        passage: gq.questionContent.passage,
        assertion: gq.questionContent.assertion,
        reason: gq.questionContent.reason,
        diagramLabel: gq.questionContent.diagramLabel,
        diagramSvg: gq.questionContent.diagramSvg,
        matchingLeft: gq.questionContent.matchingLeft,
        matchingRight: gq.questionContent.matchingRight,
        unitHint: gq.questionContent.unitHint,
        questionType: gq.questionType,
        options: gq.options,
      },
      submittedAnswer: gq.submittedAnswer,
      correctAnswer: gq.correctAnswer,
      explanation: gq.explanation,
      isCorrect,
    });
  }

  await syncStudentActivityAndBadges({
    userId: params.userId,
    questionsSolvedDelta: solvedCount,
  });
}

export async function recordChapterPracticeMcq(params: {
  userId: number;
  resourceId: number;
  mcqId: string;
  selectedIndex: number;
}) {
  await ensureSeeded();
  const resRows = await db
    .select({
      resource: resources,
      subjectName: subjects.name,
      chapterTitle: chapters.title,
      gradeName: grades.name,
    })
    .from(resources)
    .innerJoin(subjects, eq(resources.subjectId, subjects.id))
    .leftJoin(chapters, eq(resources.chapterId, chapters.id))
    .innerJoin(grades, eq(resources.gradeId, grades.id))
    .where(and(eq(resources.id, params.resourceId), eq(resources.status, 'published')))
    .limit(1);

  const row = resRows[0];
  if (!row) {
    throw new Error('Published chapter resource not found.');
  }

  const versionRows = await db
    .select()
    .from(resourceVersions)
    .where(
      and(
        eq(resourceVersions.resourceId, row.resource.id),
        eq(resourceVersions.versionNumber, row.resource.currentVersion),
      ),
    )
    .limit(1);

  const content = versionRows[0]?.contentEn;
  const mcq = content?.mcqs.find((m) => m.id === params.mcqId);
  if (!mcq) {
    throw new Error('Practice question not found in chapter resource.');
  }

  if (
    !Number.isInteger(params.selectedIndex) ||
    params.selectedIndex < 0 ||
    params.selectedIndex >= mcq.options.length
  ) {
    throw new Error('Selected option index is out of range.');
  }

  const isCorrect = params.selectedIndex === mcq.correctIndex;
  const optionKeys = ['A', 'B', 'C', 'D', 'E', 'F'];
  const snapshotOptions: SnapshotOptionItem[] = mcq.options.map((text, idx) => ({
    optionKey: optionKeys[idx] ?? String(idx + 1),
    optionText: text,
    optionTextNe: null,
  }));
  const chosenKey = optionKeys[params.selectedIndex] ?? String(params.selectedIndex + 1);
  const correctKey = optionKeys[mcq.correctIndex] ?? String(mcq.correctIndex + 1);
  const chapterName = row.chapterTitle ?? row.resource.title;

  const mistakeAction = await recordSingleOutcome({
    userId: params.userId,
    sourceType: 'chapter_practice',
    sourceRefKey: `RES-${row.resource.id}:${mcq.id}`,
    questionId: null,
    resourceId: row.resource.id,
    academicLevel: row.gradeName,
    subjectName: row.subjectName,
    chapterName,
    topicName: `${chapterName} Practice`,
    difficulty: 'medium',
    questionSnapshot: {
      prompt: mcq.question,
      questionType: 'single_mcq',
      options: snapshotOptions,
    },
    submittedAnswer: { optionKeys: [chosenKey] },
    correctAnswer: { optionKeys: [correctKey] },
    explanation: mcq.explanation,
    isCorrect,
  });

  const badgeSync = await syncStudentActivityAndBadges({
    userId: params.userId,
    questionsSolvedDelta: 1,
  });

  return {
    isCorrect,
    correctIndex: mcq.correctIndex,
    explanation: mcq.explanation,
    mistakeAction,
    newlyUnlockedBadges: badgeSync.newlyUnlockedBadges,
  };
}

export async function getUserMistakesBundle(params: {
  userId: number;
  subject?: string;
  chapter?: string;
  status?: string;
}) {
  await ensureSeeded();
  const allRows = await db
    .select()
    .from(mistakeBook)
    .where(eq(mistakeBook.userId, params.userId))
    .orderBy(desc(mistakeBook.lastAttemptedAt));

  const subjectsList = Array.from(new Set(allRows.map((r) => r.subjectName))).sort();
  const chaptersList = Array.from(
    new Set(
      allRows
        .filter((r) => !params.subject || params.subject === 'all' || r.subjectName === params.subject)
        .map((r) => r.chapterName),
    ),
  ).sort();

  const filtered = allRows.filter((r) => {
    if (params.subject && params.subject !== 'all' && r.subjectName !== params.subject) return false;
    if (params.chapter && params.chapter !== 'all' && r.chapterName !== params.chapter) return false;
    if (params.status && params.status !== 'all' && r.status !== params.status) return false;
    return true;
  });

  return {
    mistakes: filtered,
    counts: {
      total: allRows.length,
      unresolved: allRows.filter((r) => r.status === 'unresolved').length,
      resolved: allRows.filter((r) => r.status === 'resolved').length,
    },
    subjects: subjectsList,
    chapters: chaptersList,
  };
}

export async function reattemptMistakeEntry(params: {
  userId: number;
  mistakeId: number;
  selectedAnswer: SubmittedAnswerPayload;
}) {
  await ensureSeeded();
  const rows = await db
    .select()
    .from(mistakeBook)
    .where(and(eq(mistakeBook.id, params.mistakeId), eq(mistakeBook.userId, params.userId)))
    .limit(1);

  const entry = rows[0];
  if (!entry) return null;

  const evalOutcome = evaluateQuestionAnswer(
    entry.questionSnapshot.questionType,
    entry.correctAnswer,
    params.selectedAnswer,
    1,
    0,
  );
  const isCorrect = evalOutcome.isCorrect === true;

  const nextStatus = isCorrect ? 'resolved' : 'unresolved';
  const now = new Date();

  const [updated] = await db
    .update(mistakeBook)
    .set({
      status: nextStatus,
      attemptCount: entry.attemptCount + 1,
      studentWrongAnswer: isCorrect
        ? entry.studentWrongAnswer
        : (params.selectedAnswer as Record<string, unknown> | null),
      resolvedAt: isCorrect ? now : null,
      lastAttemptedAt: now,
    })
    .where(eq(mistakeBook.id, entry.id))
    .returning();

  // Also update learning_progress accuracy for this topic
  const lpRows = await db
    .select()
    .from(learningProgress)
    .where(
      and(
        eq(learningProgress.userId, params.userId),
        eq(learningProgress.subjectName, entry.subjectName),
        eq(learningProgress.chapterName, entry.chapterName),
        eq(learningProgress.topicName, entry.topicName),
      ),
    )
    .limit(1);

  if (lpRows[0]) {
    const nextTotal = lpRows[0].totalAttempts + 1;
    const nextCorrect = lpRows[0].correctAttempts + (isCorrect ? 1 : 0);
    const nextAcc = Math.round((nextCorrect / nextTotal) * 1000) / 10;
    await db
      .update(learningProgress)
      .set({
        totalAttempts: nextTotal,
        correctAttempts: nextCorrect,
        accuracyPercent: nextAcc,
        isWeak: nextAcc < 60,
        lastPracticedAt: now,
        updatedAt: now,
      })
      .where(eq(learningProgress.id, lpRows[0].id));
  }

  const badgeSync = await syncStudentActivityAndBadges({
    userId: params.userId,
    questionsSolvedDelta: 1,
  });

  return {
    isCorrect,
    mistake: updated,
    correctAnswer: entry.correctAnswer,
    explanation: entry.explanation,
    newlyUnlockedBadges: badgeSync.newlyUnlockedBadges,
  };
}

function deterministicPick<T extends { id: number }>(
  items: T[],
  count: number,
  seedStr: string,
): T[] {
  const scored = items.map((item) => {
    let hash = 2166136261;
    const key = `${seedStr}-${item.id}`;
    for (let i = 0; i < key.length; i += 1) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return { item, score: hash >>> 0 };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, count).map((s) => s.item);
}

async function hydratePublishedSanitizedQuestions(qRows: Array<typeof questions.$inferSelect>) {
  if (qRows.length === 0) return [];
  const qIds = qRows.map((q) => q.id);
  const optRows = await db
    .select()
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, qIds))
    .orderBy(asc(questionOptions.sortOrder));

  const optsByQ = new Map<number, SnapshotOptionItem[]>();
  for (const o of optRows) {
    const arr = optsByQ.get(o.questionId) ?? [];
    arr.push({
      optionKey: o.optionKey,
      optionText: o.optionText,
      optionTextNe: o.optionTextNe ?? null,
    });
    optsByQ.set(o.questionId, arr);
  }

  return qRows.map((q, idx) => ({
    questionId: q.id,
    questionUid: q.questionUid,
    sectionId: null,
    sectionTitle: q.subjectName,
    questionType: q.questionType,
    difficulty: q.difficulty,
    academicLevel: q.academicLevel,
    examination: q.examination,
    subjectName: q.subjectName,
    chapterName: q.chapterName,
    topicName: q.topicName,
    questionContent: q.questionContent,
    options: optsByQ.get(q.id) ?? q.answerOptions ?? [],
    marks: q.marks,
    negativeMarks: 0,
    sortOrder: idx + 1,
  }));
}

export async function getDailyChallengeBundle(params: {
  userId: number | null;
  mode: string;
  subject?: string;
  gradeLevel?: string;
  examSlug?: string;
}) {
  await ensureSeeded();
  const today = getNepalTodayDateStr();

  const publishedQs = await db
    .select()
    .from(questions)
    .where(eq(questions.status, 'Published'))
    .orderBy(asc(questions.id));

  const availableSubjects = Array.from(new Set(publishedQs.map((q) => q.subjectName))).sort();

  // Exclude subjective short/long_answer from auto-graded daily quizzes so all questions auto-grade crisply
  const autoGradable = publishedQs.filter(
    (q) => q.questionType !== 'short_answer' && q.questionType !== 'long_answer',
  );

  const qodPicked = deterministicPick(autoGradable, 1, `qod-${today}`);

  let pool = autoGradable;
  let targetCount = 5;
  if (params.mode === 'daily_10') {
    targetCount = 10;
  } else if (params.mode === 'subject' && params.subject && params.subject !== 'all') {
    pool = autoGradable.filter(
      (q) => q.subjectName.toLowerCase() === params.subject!.toLowerCase(),
    );
    targetCount = 5;
  } else if (params.mode === 'class_wise' && params.gradeLevel && params.gradeLevel !== 'all') {
    const gl = params.gradeLevel.toLowerCase();
    pool = autoGradable.filter(
      (q) =>
        q.academicLevel.toLowerCase().includes(gl) ||
        q.examination.toLowerCase().includes(gl),
    );
    targetCount = 5;
  } else if (params.mode === 'entrance') {
    const es = params.examSlug?.toLowerCase() ?? '';
    pool = autoGradable.filter((q) => {
      const ex = q.examination.toLowerCase();
      if (es && es !== 'all') {
        return ex.includes(es.replace(/-/g, ' ')) || ex.includes(es);
      }
      return (
        ex.includes('ioe') ||
        ex.includes('csit') ||
        ex.includes('cmat') ||
        ex.includes('mecee') ||
        q.academicLevel.toLowerCase().includes('entrance')
      );
    });
    targetCount = 6;
  } else if (params.mode === 'weekly') {
    targetCount = 12;
  }

  if (pool.length === 0) {
    pool = autoGradable;
  }

  const weekKey = today.slice(0, 7);
  const seedKey =
    params.mode === 'weekly'
      ? `weekly-${weekKey}`
      : `daily-${today}-${params.mode}-${params.subject ?? ''}-${params.gradeLevel ?? ''}-${params.examSlug ?? ''}`;

  const pickedQuestions = deterministicPick(pool, Math.min(targetCount, pool.length), seedKey);

  const [qodHydrated, challengeHydrated] = await Promise.all([
    hydratePublishedSanitizedQuestions(qodPicked),
    hydratePublishedSanitizedQuestions(pickedQuestions),
  ]);

  let userProgress: {
    streakDays: number;
    dailyChallengesCompleted: number;
    doneToday: boolean;
    totalQuestionsSolved: number;
  } | null = null;

  if (params.userId) {
    const goal = await ensureStudentGoalInitialized(params.userId);
    userProgress = {
      streakDays: goal.streakDays,
      dailyChallengesCompleted: goal.dailyChallengesCompleted,
      doneToday: goal.lastDailyChallengeDate === today,
      totalQuestionsSolved: goal.totalQuestionsSolved,
    };
  }

  return {
    todayDate: today,
    mode: params.mode,
    questionOfTheDay: qodHydrated[0] ?? null,
    challengeQuestions: challengeHydrated,
    availableSubjects,
    userProgress,
  };
}

export async function submitDailyChallenge(params: {
  userId: number;
  mode: string;
  answers: Array<{ questionId: number; selectedAnswer: SubmittedAnswerPayload | null }>;
}) {
  await ensureSeeded();
  if (!params.answers || params.answers.length === 0) {
    throw new Error('At least one question response is required.');
  }

  const qIds = Array.from(new Set(params.answers.map((a) => a.questionId)));
  const qRows = await db
    .select()
    .from(questions)
    .where(and(inArray(questions.id, qIds), eq(questions.status, 'Published')));

  if (qRows.length === 0) {
    throw new Error('No published questions found for this challenge submission.');
  }

  const explRows = await db
    .select()
    .from(questionExplanations)
    .where(inArray(questionExplanations.questionId, qIds));
  const optRows = await db
    .select()
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, qIds))
    .orderBy(asc(questionOptions.sortOrder));

  const qMap = new Map(qRows.map((q) => [q.id, q]));
  const explMap = new Map(explRows.map((e) => [e.questionId, e.explanation]));
  const optMap = new Map<number, SnapshotOptionItem[]>();
  for (const o of optRows) {
    const arr = optMap.get(o.questionId) ?? [];
    arr.push({
      optionKey: o.optionKey,
      optionText: o.optionText,
      optionTextNe: o.optionTextNe ?? null,
    });
    optMap.set(o.questionId, arr);
  }

  let correctCount = 0;
  let incorrectCount = 0;
  let mistakesRecorded = 0;
  let mistakesResolved = 0;

  const gradedItems: Array<{
    questionId: number;
    questionUid: string;
    prompt: string;
    subjectName: string;
    chapterName: string;
    topicName: string;
    isCorrect: boolean;
    submittedAnswer: SubmittedAnswerPayload | null;
    correctAnswer: QuestionAnswerJson;
    explanation: string;
  }> = [];

  for (const item of params.answers) {
    const q = qMap.get(item.questionId);
    if (!q) continue;
    const evalOutcome = evaluateQuestionAnswer(
      q.questionType,
      q.correctAnswer,
      item.selectedAnswer,
      q.marks,
      q.negativeMarks,
    );
    const isCorrect = evalOutcome.isCorrect === true;
    if (isCorrect) correctCount += 1;
    else incorrectCount += 1;

    const expl = explMap.get(q.id) ?? q.explanation;
    const options = optMap.get(q.id) ?? q.answerOptions ?? [];

    const outcome = await recordSingleOutcome({
      userId: params.userId,
      sourceType: 'daily_challenge',
      sourceRefKey: q.questionUid,
      questionId: q.id,
      resourceId: null,
      academicLevel: q.academicLevel,
      subjectName: q.subjectName,
      chapterName: q.chapterName,
      topicName: q.topicName,
      difficulty: q.difficulty,
      questionSnapshot: {
        prompt: q.questionContent.prompt,
        promptNe: q.questionContent.promptNe,
        passage: q.questionContent.passage,
        assertion: q.questionContent.assertion,
        reason: q.questionContent.reason,
        diagramLabel: q.questionContent.diagramLabel,
        diagramSvg: q.questionContent.diagramSvg,
        matchingLeft: q.questionContent.matchingLeft,
        matchingRight: q.questionContent.matchingRight,
        unitHint: q.questionContent.unitHint,
        questionType: q.questionType,
        options,
      },
      submittedAnswer: item.selectedAnswer,
      correctAnswer: q.correctAnswer,
      explanation: expl,
      isCorrect,
    });

    if (outcome === 'recorded') mistakesRecorded += 1;
    if (outcome === 'resolved') mistakesResolved += 1;

    gradedItems.push({
      questionId: q.id,
      questionUid: q.questionUid,
      prompt: q.questionContent.prompt,
      subjectName: q.subjectName,
      chapterName: q.chapterName,
      topicName: q.topicName,
      isCorrect,
      submittedAnswer: item.selectedAnswer,
      correctAnswer: q.correctAnswer,
      explanation: expl,
    });
  }

  const badgeSync = await syncStudentActivityAndBadges({
    userId: params.userId,
    questionsSolvedDelta: gradedItems.length,
    completedDailyChallenge: true,
  });

  const totalQ = gradedItems.length;
  const accuracyPercent =
    totalQ > 0 ? Math.round((correctCount / totalQ) * 1000) / 10 : 0;

  return {
    mode: params.mode,
    totalQuestions: totalQ,
    correctCount,
    incorrectCount,
    accuracyPercent,
    mistakesRecorded,
    mistakesResolved,
    streakDays: badgeSync.streakDays,
    dailyChallengesCompleted: badgeSync.dailyChallengesCompleted,
    newlyUnlockedBadges: badgeSync.newlyUnlockedBadges,
    gradedItems,
  };
}

export async function getLeaderboardsBundle(params: {
  viewerUserId: number | null;
  scope: string;
  subject?: string;
  gradeLevel?: string;
}) {
  await ensureSeeded();

  const [allUsers, allProfiles, allGoals, allResults, allProgress, allAchievements] =
    await Promise.all([
      db.select({ id: users.id, status: users.status }).from(users),
      db
        .select({
          userId: profiles.userId,
          fullName: profiles.fullName,
          displayName: profiles.displayName,
          gradeLevel: profiles.gradeLevel,
        })
        .from(profiles),
      db.select().from(studentGoals),
      db.select().from(examResults),
      db.select().from(learningProgress),
      db.select().from(achievements),
    ]);

  const profileMap = new Map(allProfiles.map((p) => [p.userId, p]));
  const goalMap = new Map(allGoals.map((g) => [g.userId, g]));

  const now = Date.now();
  const weekCutoff = now - 7 * 24 * 60 * 60 * 1000;
  const monthCutoff = now - 30 * 24 * 60 * 60 * 1000;

  const entriesRaw = allUsers
    .filter((u) => u.status === 'active')
    .map((u) => {
      const prof = profileMap.get(u.id);
      const goal = goalMap.get(u.id);
      const userResults = allResults.filter((r) => r.userId === u.id);
      const userProgress = allProgress.filter((p) => p.userId === u.id);
      const userBadges = allAchievements.filter((a) => a.userId === u.id);

      const totalAttempts = userProgress.reduce((s, p) => s + p.totalAttempts, 0);
      const correctAttempts = userProgress.reduce((s, p) => s + p.correctAttempts, 0);
      const avgAcc =
        totalAttempts > 0
          ? Math.round((correctAttempts / totalAttempts) * 1000) / 10
          : userResults.length > 0
            ? Math.round(
                (userResults.reduce((s, r) => s + r.accuracyPercent, 0) / userResults.length) *
                  10,
              ) / 10
            : 0;

      let scoreMetric = 0;
      let metricUnit = 'pts';

      if (params.scope === 'weekly') {
        const weeklyResults = userResults.filter(
          (r) => new Date(r.createdAt).getTime() >= weekCutoff,
        );
        const weeklyProg = userProgress.filter(
          (p) => new Date(p.lastPracticedAt).getTime() >= weekCutoff,
        );
        scoreMetric =
          weeklyProg.reduce((s, p) => s + p.correctAttempts * 10, 0) +
          weeklyResults.reduce((s, r) => s + Math.round(r.obtainedMarks * 5), 0) +
          (goal?.streakDays ?? 0) * 15;
        metricUnit = 'weekly pts';
      } else if (params.scope === 'monthly') {
        const monthlyResults = userResults.filter(
          (r) => new Date(r.createdAt).getTime() >= monthCutoff,
        );
        const monthlyProg = userProgress.filter(
          (p) => new Date(p.lastPracticedAt).getTime() >= monthCutoff,
        );
        scoreMetric =
          monthlyProg.reduce((s, p) => s + p.correctAttempts * 10, 0) +
          monthlyResults.reduce((s, r) => s + Math.round(r.obtainedMarks * 5), 0);
        metricUnit = 'monthly pts';
      } else if (params.scope === 'mock_exam') {
        const bestMarks = userResults.reduce(
          (best, r) => Math.max(best, r.obtainedMarks),
          0,
        );
        scoreMetric = Math.round(bestMarks * 10) / 10;
        metricUnit = 'best marks';
      } else if (params.scope === 'improvement') {
        scoreMetric = Math.round((goal?.improvementScore ?? 0) * 10) / 10;
        metricUnit = '% gain';
      } else if (params.scope === 'subject_wise') {
        const subFilter = params.subject?.toLowerCase();
        const subProg = userProgress.filter(
          (p) => !subFilter || subFilter === 'all' || p.subjectName.toLowerCase() === subFilter,
        );
        const subTotal = subProg.reduce((s, p) => s + p.totalAttempts, 0);
        const subCorrect = subProg.reduce((s, p) => s + p.correctAttempts, 0);
        scoreMetric = subTotal > 0 ? Math.round((subCorrect / subTotal) * 1000) / 10 : 0;
        metricUnit = '% accuracy';
      } else {
        // class_wise
        const gradeFilter = params.gradeLevel?.toLowerCase();
        const trackMatches =
          !gradeFilter ||
          gradeFilter === 'all' ||
          (goal?.targetTrack ?? '').toLowerCase().includes(gradeFilter) ||
          (prof?.gradeLevel ?? '').toLowerCase().includes(gradeFilter);
        if (!trackMatches) {
          return null;
        }
        scoreMetric = (goal?.totalQuestionsSolved ?? 0) * 5 + Math.round(avgAcc);
        metricUnit = 'class pts';
      }

      const privacyMode = goal?.leaderboardPrivacy ?? 'masked';
      const displayLabel = formatPrivacySafeName({
        fullName: prof?.fullName ?? 'Learner',
        displayName: prof?.displayName ?? null,
        leaderboardAlias: goal?.leaderboardAlias ?? null,
        privacyMode,
        userId: u.id,
      });

      const hasActivity =
        (goal?.totalQuestionsSolved ?? 0) > 0 ||
        userResults.length > 0 ||
        userProgress.length > 0 ||
        u.id === params.viewerUserId;

      if (!hasActivity) return null;

      return {
        userId: u.id,
        displayLabel,
        isCurrentUser: u.id === params.viewerUserId,
        targetTrack: goal?.targetTrack ?? prof?.gradeLevel ?? 'Nepal CDC Track',
        scoreMetric,
        metricUnit,
        accuracyPercent: avgAcc,
        streakDays: goal?.streakDays ?? 0,
        questionsSolved: goal?.totalQuestionsSolved ?? 0,
        badgesCount: userBadges.length,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.scoreMetric - a.scoreMetric || b.accuracyPercent - a.accuracyPercent)
    .slice(0, 25)
    .map((entry, idx) => ({
      rank: idx + 1,
      displayLabel: entry.displayLabel,
      isCurrentUser: entry.isCurrentUser,
      targetTrack: entry.targetTrack,
      scoreMetric: entry.scoreMetric,
      metricUnit: entry.metricUnit,
      accuracyPercent: entry.accuracyPercent,
      streakDays: entry.streakDays,
      questionsSolved: entry.questionsSolved,
      badgesCount: entry.badgesCount,
    }));

  let myPrivacy: { leaderboardPrivacy: string; leaderboardAlias: string | null } | null = null;
  let unlockedMap = new Map<string, { unlockedAt: string; metricValue: number }>();

  if (params.viewerUserId) {
    const goal = await ensureStudentGoalInitialized(params.viewerUserId);
    myPrivacy = {
      leaderboardPrivacy: goal.leaderboardPrivacy,
      leaderboardAlias: goal.leaderboardAlias,
    };
    const userBadges = allAchievements.filter((a) => a.userId === params.viewerUserId);
    unlockedMap = new Map(
      userBadges.map((b) => [
        b.badgeCode,
        { unlockedAt: b.unlockedAt.toISOString(), metricValue: b.metricValue },
      ]),
    );
  }

  const achievementsCatalog = BADGE_CATALOG.map((def) => {
    const unlocked = unlockedMap.get(def.code);
    return {
      code: def.code,
      title: def.title,
      description: def.description,
      category: def.category,
      targetLabel: def.targetLabel,
      unlocked: Boolean(unlocked),
      unlockedAt: unlocked?.unlockedAt ?? null,
      metricValue: unlocked?.metricValue ?? 0,
    };
  });

  return {
    scope: params.scope,
    entries: entriesRaw,
    myPrivacy,
    achievementsCatalog,
  };
}

export async function getFlashcardsDeckBundle(params: {
  userId: number | null;
  category?: string;
  subject?: string;
  dueOnly?: boolean;
}) {
  await ensureSeeded();
  const now = new Date();

  const curatedTemplates = await db
    .select()
    .from(flashcards)
    .where(and(eq(flashcards.isCurated, true), isNull(flashcards.userId)))
    .orderBy(asc(flashcards.id));

  let userStates: Array<typeof flashcards.$inferSelect> = [];
  if (params.userId) {
    userStates = await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.userId, params.userId))
      .orderBy(desc(flashcards.createdAt));
  }

  const overrideByCuratedId = new Map<number, typeof flashcards.$inferSelect>();
  const customCards: Array<typeof flashcards.$inferSelect> = [];
  for (const row of userStates) {
    if (row.parentCuratedId) {
      overrideByCuratedId.set(row.parentCuratedId, row);
    } else {
      customCards.push(row);
    }
  }

  const mergedCurated = curatedTemplates.map((tpl) => {
    const state = overrideByCuratedId.get(tpl.id);
    const nextReview = state ? state.nextReviewAt : tpl.nextReviewAt;
    return {
      id: tpl.id,
      curatedTemplateId: tpl.id,
      isCurated: true,
      category: tpl.category,
      academicLevel: tpl.academicLevel,
      subjectName: tpl.subjectName,
      chapterName: tpl.chapterName,
      frontText: tpl.frontText,
      backText: tpl.backText,
      hintText: tpl.hintText,
      intervalDays: state?.intervalDays ?? tpl.intervalDays,
      easeFactor: state?.easeFactor ?? tpl.easeFactor,
      repetitions: state?.repetitions ?? tpl.repetitions,
      nextReviewAt: nextReview.toISOString(),
      lastReviewedAt: state?.lastReviewedAt ? state.lastReviewedAt.toISOString() : null,
      isDue: nextReview.getTime() <= now.getTime(),
    };
  });

  const formattedCustom = customCards.map((c) => ({
    id: c.id,
    curatedTemplateId: c.id,
    isCurated: false,
    category: c.category,
    academicLevel: c.academicLevel,
    subjectName: c.subjectName,
    chapterName: c.chapterName,
    frontText: c.frontText,
    backText: c.backText,
    hintText: c.hintText,
    intervalDays: c.intervalDays,
    easeFactor: c.easeFactor,
    repetitions: c.repetitions,
    nextReviewAt: c.nextReviewAt.toISOString(),
    lastReviewedAt: c.lastReviewedAt ? c.lastReviewedAt.toISOString() : null,
    isDue: c.nextReviewAt.getTime() <= now.getTime(),
  }));

  const allCards = [...formattedCustom, ...mergedCurated];

  const filtered = allCards.filter((card) => {
    if (params.category && params.category !== 'all' && card.category !== params.category) {
      return false;
    }
    if (params.subject && params.subject !== 'all' && card.subjectName !== params.subject) {
      return false;
    }
    if (params.dueOnly && !card.isDue) {
      return false;
    }
    return true;
  });

  return {
    cards: filtered,
    counts: {
      total: allCards.length,
      due: allCards.filter((c) => c.isDue).length,
      custom: formattedCustom.length,
    },
  };
}

export async function reviewFlashcardCard(params: {
  userId: number;
  cardId: number;
  rating: SpacedRating;
}) {
  await ensureSeeded();
  const rows = await db
    .select()
    .from(flashcards)
    .where(eq(flashcards.id, params.cardId))
    .limit(1);

  const target = rows[0];
  if (!target) return null;

  const now = new Date();
  if (target.isCurated && target.userId === null) {
    // Check if student already has a personal spaced-repetition row for this curated template
    const existingState = await db
      .select()
      .from(flashcards)
      .where(
        and(
          eq(flashcards.userId, params.userId),
          eq(flashcards.parentCuratedId, target.id),
        ),
      )
      .limit(1);

    const prev = existingState[0];
    const next = computeNextSpacedReview({
      repetitions: prev?.repetitions ?? 0,
      intervalDays: prev?.intervalDays ?? 1,
      easeFactor: prev?.easeFactor ?? 2.5,
      rating: params.rating,
      now,
    });

    if (prev) {
      await db
        .update(flashcards)
        .set({
          repetitions: next.repetitions,
          intervalDays: next.intervalDays,
          easeFactor: next.easeFactor,
          nextReviewAt: next.nextReviewAt,
          lastReviewedAt: now,
        })
        .where(eq(flashcards.id, prev.id));
    } else {
      await db.insert(flashcards).values({
        userId: params.userId,
        parentCuratedId: target.id,
        isCurated: false,
        category: target.category,
        academicLevel: target.academicLevel,
        subjectName: target.subjectName,
        chapterName: target.chapterName,
        frontText: target.frontText,
        backText: target.backText,
        hintText: target.hintText,
        repetitions: next.repetitions,
        intervalDays: next.intervalDays,
        easeFactor: next.easeFactor,
        nextReviewAt: next.nextReviewAt,
        lastReviewedAt: now,
      });
    }

    await syncStudentActivityAndBadges({ userId: params.userId });

    return {
      cardId: target.id,
      ...next,
    };
  }

  // Student's own custom card
  if (target.userId !== params.userId) {
    throw new Error('Forbidden: cannot review another learner’s custom flashcard.');
  }

  const next = computeNextSpacedReview({
    repetitions: target.repetitions,
    intervalDays: target.intervalDays,
    easeFactor: target.easeFactor,
    rating: params.rating,
    now,
  });

  await db
    .update(flashcards)
    .set({
      repetitions: next.repetitions,
      intervalDays: next.intervalDays,
      easeFactor: next.easeFactor,
      nextReviewAt: next.nextReviewAt,
      lastReviewedAt: now,
    })
    .where(eq(flashcards.id, target.id));

  await syncStudentActivityAndBadges({ userId: params.userId });

  return {
    cardId: target.id,
    ...next,
  };
}

export async function createCustomFlashcardCard(params: {
  userId: number;
  category: 'definition' | 'formula' | 'important_fact' | 'vocabulary';
  academicLevel: string;
  subjectName: string;
  chapterName: string;
  frontText: string;
  backText: string;
  hintText?: string | null;
}) {
  await ensureSeeded();
  const [created] = await db
    .insert(flashcards)
    .values({
      userId: params.userId,
      parentCuratedId: null,
      isCurated: false,
      category: params.category,
      academicLevel: params.academicLevel.trim().slice(0, 60),
      subjectName: params.subjectName.trim().slice(0, 80),
      chapterName: params.chapterName.trim().slice(0, 100),
      frontText: params.frontText.trim().slice(0, 300),
      backText: params.backText.trim().slice(0, 800),
      hintText: params.hintText ? params.hintText.trim().slice(0, 200) : null,
      intervalDays: 1,
      easeFactor: 2.5,
      repetitions: 0,
      nextReviewAt: new Date(),
    })
    .returning();

  return created;
}

export async function getPlannerBundle(userId: number) {
  const goal = await ensureStudentGoalInitialized(userId);
  const today = getNepalTodayDateStr();

  const [plans, tasks] = await Promise.all([
    db
      .select()
      .from(studyPlans)
      .where(eq(studyPlans.userId, userId))
      .orderBy(desc(studyPlans.createdAt)),
    db
      .select()
      .from(studyTasks)
      .where(eq(studyTasks.userId, userId))
      .orderBy(asc(studyTasks.scheduledDate), asc(studyTasks.isCompleted), desc(studyTasks.createdAt)),
  ]);

  return {
    goal,
    plans,
    tasks,
    todayDate: today,
  };
}

export async function updateStudentGoalsConfig(
  userId: number,
  updates: {
    targetTrack?: string;
    targetExamSlug?: string | null;
    targetExamName?: string | null;
    targetExamDate?: string | null;
    dailyStudyMinutes?: number;
    dailyQuestionTarget?: number;
    selectedSubjects?: string[];
    careerInterests?: string[];
    leaderboardPrivacy?: 'masked' | 'alias' | 'public_name';
    leaderboardAlias?: string | null;
  },
) {
  await ensureStudentGoalInitialized(userId);
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof updates.targetTrack === 'string' && updates.targetTrack.trim()) {
    patch.targetTrack = updates.targetTrack.trim().slice(0, 80);
  }
  if (updates.targetExamSlug !== undefined) {
    patch.targetExamSlug = updates.targetExamSlug ? updates.targetExamSlug.trim().slice(0, 80) : null;
  }
  if (updates.targetExamName !== undefined) {
    patch.targetExamName = updates.targetExamName ? updates.targetExamName.trim().slice(0, 120) : null;
  }
  if (updates.targetExamDate !== undefined) {
    patch.targetExamDate = updates.targetExamDate ? new Date(updates.targetExamDate) : null;
  }
  if (
    typeof updates.dailyStudyMinutes === 'number' &&
    updates.dailyStudyMinutes >= 15 &&
    updates.dailyStudyMinutes <= 600
  ) {
    patch.dailyStudyMinutes = Math.round(updates.dailyStudyMinutes);
  }
  if (
    typeof updates.dailyQuestionTarget === 'number' &&
    updates.dailyQuestionTarget >= 1 &&
    updates.dailyQuestionTarget <= 200
  ) {
    patch.dailyQuestionTarget = Math.round(updates.dailyQuestionTarget);
  }
  if (Array.isArray(updates.selectedSubjects)) {
    patch.selectedSubjects = updates.selectedSubjects
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  if (Array.isArray(updates.careerInterests)) {
    patch.careerInterests = updates.careerInterests
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 10);
  }
  if (
    updates.leaderboardPrivacy &&
    ['masked', 'alias', 'public_name'].includes(updates.leaderboardPrivacy)
  ) {
    patch.leaderboardPrivacy = updates.leaderboardPrivacy;
  }
  if (updates.leaderboardAlias !== undefined) {
    patch.leaderboardAlias = updates.leaderboardAlias
      ? updates.leaderboardAlias.trim().slice(0, 40)
      : null;
  }

  const [updated] = await db
    .update(studentGoals)
    .set(patch)
    .where(eq(studentGoals.userId, userId))
    .returning();

  return updated;
}

export async function createStudyPlanEntry(params: {
  userId: number;
  title: string;
  goalFocus: string;
  subjectName: string;
  gradeCode: string;
  startDate: string;
  endDate: string;
}) {
  await ensureStudentGoalInitialized(params.userId);
  const [created] = await db
    .insert(studyPlans)
    .values({
      userId: params.userId,
      title: params.title.trim().slice(0, 140),
      goalFocus: params.goalFocus.trim().slice(0, 140),
      subjectName: params.subjectName.trim().slice(0, 80),
      gradeCode: params.gradeCode.trim().slice(0, 20),
      startDate: params.startDate,
      endDate: params.endDate,
      status: 'active',
    })
    .returning();
  return created;
}

export async function createStudyTaskEntry(params: {
  userId: number;
  planId?: number | null;
  title: string;
  taskType: string;
  subjectName: string;
  chapterName?: string | null;
  scheduledDate: string;
  estimatedMinutes: number;
}) {
  await ensureStudentGoalInitialized(params.userId);
  const [created] = await db
    .insert(studyTasks)
    .values({
      userId: params.userId,
      planId: params.planId ?? null,
      title: params.title.trim().slice(0, 160),
      taskType: ['chapter_study', 'revision', 'practice', 'mock_test'].includes(params.taskType)
        ? params.taskType
        : 'chapter_study',
      subjectName: params.subjectName.trim().slice(0, 80),
      chapterName: params.chapterName ? params.chapterName.trim().slice(0, 120) : null,
      scheduledDate: params.scheduledDate,
      estimatedMinutes: Math.max(10, Math.min(240, Math.round(params.estimatedMinutes || 30))),
      isCompleted: false,
    })
    .returning();
  return created;
}

export async function toggleStudyTaskStatus(params: {
  userId: number;
  taskId: number;
  isCompleted: boolean;
}) {
  const existing = await db
    .select()
    .from(studyTasks)
    .where(and(eq(studyTasks.id, params.taskId), eq(studyTasks.userId, params.userId)))
    .limit(1);
  if (!existing[0]) return null;

  const [updated] = await db
    .update(studyTasks)
    .set({
      isCompleted: params.isCompleted,
      completedAt: params.isCompleted ? new Date() : null,
    })
    .where(eq(studyTasks.id, params.taskId))
    .returning();

  const badgeSync = await syncStudentActivityAndBadges({ userId: params.userId });

  return { task: updated, newlyUnlockedBadges: badgeSync.newlyUnlockedBadges };
}

export async function deleteStudyTaskEntry(userId: number, taskId: number) {
  const deleted = await db
    .delete(studyTasks)
    .where(and(eq(studyTasks.id, taskId), eq(studyTasks.userId, userId)))
    .returning();
  return deleted[0] ?? null;
}

export async function getCompleteStudentDashboard(userId: number) {
  const goal = await ensureStudentGoalInitialized(userId);
  const today = getNepalTodayDateStr();

  const [
    mistakesBundle,
    progressRows,
    userResults,
    userBookmarks,
    userNotes,
    plannerData,
    flashcardData,
    dailyBundle,
    userAchievements,
    liveCareers,
    liveScholarships,
    liveOpportunities,
    liveDeadlines,
  ] = await Promise.all([
    getUserMistakesBundle({ userId }),
    db
      .select()
      .from(learningProgress)
      .where(eq(learningProgress.userId, userId))
      .orderBy(asc(learningProgress.accuracyPercent)),
    db
      .select({
        result: examResults,
        examTitle: exams.title,
        examSlug: exams.slug,
        attemptUid: examAttempts.attemptUid,
      })
      .from(examResults)
      .innerJoin(exams, eq(examResults.examId, exams.id))
      .innerJoin(examAttempts, eq(examResults.attemptId, examAttempts.id))
      .where(eq(examResults.userId, userId))
      .orderBy(desc(examResults.createdAt))
      .limit(6),
    db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt))
      .limit(8),
    db
      .select()
      .from(personalNotes)
      .where(eq(personalNotes.userId, userId))
      .orderBy(desc(personalNotes.updatedAt))
      .limit(3),
    getPlannerBundle(userId),
    getFlashcardsDeckBundle({ userId }),
    getDailyChallengeBundle({ userId, mode: 'daily_5' }),
    db.select().from(achievements).where(eq(achievements.userId, userId)),
    db.select().from(careerPaths).orderBy(asc(careerPaths.id)).limit(6),
    db.select().from(scholarships).orderBy(asc(scholarships.id)).limit(4),
    db.select().from(opportunities).orderBy(asc(opportunities.deadlineDate)).limit(6),
    db.select().from(applicationDeadlines).orderBy(asc(applicationDeadlines.deadlineDate)).limit(4),
  ]);

  const weakTopics = detectWeakTopics(progressRows, 60);

  const tasksToday = plannerData.tasks.filter((t) => t.scheduledDate === today);
  const pendingTasksToday = tasksToday.filter((t) => !t.isCompleted);

  const totalAttempts = progressRows.reduce((s, r) => s + r.totalAttempts, 0);
  const correctAttempts = progressRows.reduce((s, r) => s + r.correctAttempts, 0);
  const overallAccuracy =
    totalAttempts > 0
      ? Math.round((correctAttempts / totalAttempts) * 1000) / 10
      : userResults.length > 0
        ? Math.round(
            (userResults.reduce((s, r) => s + r.result.accuracyPercent, 0) / userResults.length) *
              10,
          ) / 10
        : 0;

  // Continue Learning priority: most recent bookmark -> most recent exam result -> grade path
  let continueLearning = {
    title: 'Class 10 / SEE Compulsory Mathematics — Chapter 1: Sets',
    subtitle: 'Nepal CDC Curriculum · Notes, Formulas & Practice Questions',
    route: '/school/class-10/MATH-10/1',
    source: 'Recommended Curriculum Start',
  };
  if (userBookmarks[0]) {
    const bm = userBookmarks[0];
    const [chRow] = await db
      .select({
        chapterNumber: chapters.chapterNumber,
        subjectCode: subjects.code,
        gradeCode: grades.code,
      })
      .from(chapters)
      .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
      .innerJoin(grades, eq(grades.id, bm.gradeId))
      .where(eq(chapters.id, bm.chapterId))
      .limit(1);
    if (chRow) {
      const slug =
        chRow.gradeCode === 'G12'
          ? 'class-12'
          : chRow.gradeCode === 'G11'
            ? 'class-11'
            : 'class-10';
      continueLearning = {
        title: bm.title,
        subtitle: `Saved ${bm.bookmarkType} · Pick up where you left off`,
        route: `/school/${slug}/${encodeURIComponent(chRow.subjectCode)}/${chRow.chapterNumber}`,
        source: 'Recent Bookmark',
      };
    }
  } else if (userNotes[0]) {
    continueLearning = {
      title: userNotes[0].title,
      subtitle: 'Recent Personal Study Note',
      route: '/school/class-10/MATH-10/1',
      source: 'Study Notes',
    };
  } else if (userResults[0]) {
    continueLearning = {
      title: userResults[0].examTitle,
      subtitle: `Last score: ${userResults[0].result.obtainedMarks}/${userResults[0].result.totalMarks} (${userResults[0].result.accuracyPercent}%)`,
      route: `/exams/${userResults[0].examSlug}/result?attemptUid=${encodeURIComponent(userResults[0].attemptUid)}`,
      source: 'Recent Timed Exam',
    };
  }

  const targetLower = goal.targetTrack.toLowerCase();
  const myClasses = [
    {
      slug: 'class-10',
      code: 'SEE',
      name: 'Class 10 / SEE',
      route: '/school/class-10',
      isPrimary: targetLower.includes('10') || targetLower.includes('see'),
    },
    {
      slug: 'class-11',
      code: 'NEB +2',
      name: 'Class 11 (NEB)',
      route: '/school/class-11',
      isPrimary: targetLower.includes('11'),
    },
    {
      slug: 'class-12',
      code: 'NEB +2',
      name: 'Class 12 (NEB)',
      route: '/school/class-12',
      isPrimary: targetLower.includes('12'),
    },
    {
      slug: 'entrance',
      code: 'BACHELOR',
      name: 'Bachelor Entrances',
      route: '/entrance',
      isPrimary:
        targetLower.includes('ioe') ||
        targetLower.includes('csit') ||
        targetLower.includes('cmat') ||
        targetLower.includes('mecee') ||
        targetLower.includes('entrance'),
    },
  ];

  // Build My Subjects combining selectedSubjects + learningProgress metrics
  const progressBySubject = new Map<string, { attempts: number; correct: number }>();
  for (const row of progressRows) {
    const prev = progressBySubject.get(row.subjectName) ?? { attempts: 0, correct: 0 };
    prev.attempts += row.totalAttempts;
    prev.correct += row.correctAttempts;
    progressBySubject.set(row.subjectName, prev);
  }
  const allSubjectNames = Array.from(
    new Set([...(goal.selectedSubjects ?? []), ...Array.from(progressBySubject.keys())]),
  );
  const mySubjects = allSubjectNames.map((name) => {
    const stat = progressBySubject.get(name);
    const acc =
      stat && stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 1000) / 10 : 0;
    return {
      name,
      attempts: stat?.attempts ?? 0,
      accuracyPercent: acc,
      isWeak: Boolean(stat && stat.attempts > 0 && acc < 60),
    };
  });

  // Upcoming Exam Countdown
  let daysRemaining: number | null = null;
  if (goal.targetExamDate) {
    const diffMs = new Date(goal.targetExamDate).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  }

  // Unlocked badges map hydrated with all 7 catalog items
  const unlockedMap = new Map(
    userAchievements.map((b) => [
      b.badgeCode,
      { unlockedAt: b.unlockedAt.toISOString(), metricValue: b.metricValue },
    ]),
  );
  const hydratedBadges = BADGE_CATALOG.map((def) => {
    const u = unlockedMap.get(def.code);
    return {
      code: def.code,
      title: def.title,
      description: def.description,
      category: def.category,
      targetLabel: def.targetLabel,
      unlocked: Boolean(u),
      unlockedAt: u?.unlockedAt ?? null,
      metricValue: u?.metricValue ?? 0,
    };
  });

  const recommendedNextAction = computeRecommendedNextAction({
    weakTopics,
    unresolvedMistakesCount: mistakesBundle.counts.unresolved,
    pendingTaskTodayTitle: pendingTasksToday[0]?.title ?? null,
    pendingTasksTodayCount: pendingTasksToday.length,
    dueFlashcardsCount: flashcardData.counts.due,
    dailyChallengeDoneToday: dailyBundle.userProgress?.doneToday ?? false,
    targetExamSlug: goal.targetExamSlug,
  });

  const interestKeywords = (goal.careerInterests ?? []).map((x) => x.toLowerCase());
  const matchesInterest = (text: string) =>
    interestKeywords.some((kw) =>
      kw
        .split(/[\s&/]+/)
        .filter((part) => part.length >= 3)
        .some((part) => text.toLowerCase().includes(part)),
    );

  const prioritizedCareer =
    liveCareers.find((c) => matchesInterest(`${c.title} ${c.category}`)) ?? liveCareers[0];
  const prioritizedOpp =
    liveOpportunities.find((o) =>
      matchesInterest(`${o.title} ${o.careerCategories.join(' ')}`),
    ) ?? liveOpportunities[0];
  const prioritizedSch = liveScholarships[0];
  const prioritizedDeadline = liveDeadlines[0];

  const liveOpportunityCards: Array<{
    id: string;
    kind: 'career' | 'scholarship' | 'deadline';
    title: string;
    organization: string;
    track: string;
    windowLabel: string;
    summary: string;
    route: string;
  }> = [];

  if (prioritizedSch) {
    liveOpportunityCards.push({
      id: `sch-${prioritizedSch.slug}`,
      kind: 'scholarship',
      title: prioritizedSch.title,
      organization: prioritizedSch.provider,
      track: prioritizedSch.category,
      windowLabel: `Deadline ${prioritizedSch.applicationDeadline}`,
      summary: prioritizedSch.financialBenefits,
      route: '/explore/scholarships',
    });
  }
  if (prioritizedCareer) {
    liveOpportunityCards.push({
      id: `career-${prioritizedCareer.slug}`,
      kind: 'career',
      title: `${prioritizedCareer.title} Roadmap`,
      organization: prioritizedCareer.licensingBody,
      track: prioritizedCareer.category,
      windowLabel: prioritizedCareer.demandOutlook,
      summary: prioritizedCareer.summary,
      route: '/explore/careers',
    });
  }
  if (prioritizedOpp) {
    liveOpportunityCards.push({
      id: `opp-${prioritizedOpp.slug}`,
      kind: 'deadline',
      title: prioritizedOpp.title,
      organization: prioritizedOpp.organization,
      track: prioritizedOpp.category,
      windowLabel: prioritizedOpp.windowLabel,
      summary: prioritizedOpp.benefitOrPrize,
      route: '/explore/opportunities',
    });
  }
  if (prioritizedDeadline) {
    liveOpportunityCards.push({
      id: `dl-${prioritizedDeadline.slug}`,
      kind: 'deadline',
      title: prioritizedDeadline.title,
      organization: prioritizedDeadline.authority,
      track: prioritizedDeadline.category,
      windowLabel: `Exam ${prioritizedDeadline.examDate}`,
      summary: prioritizedDeadline.targetAudience,
      route: '/explore/opportunities',
    });
  }

  return {
    todayDate: today,
    recommendedNextAction,
    goal,
    continueLearning,
    myClasses,
    mySubjects,
    dailyStudyPlan: {
      plansCount: plannerData.plans.length,
      tasksToday,
      completedTodayCount: tasksToday.filter((t) => t.isCompleted).length,
      totalTodayCount: tasksToday.length,
    },
    dailyChallenge: {
      doneToday: dailyBundle.userProgress?.doneToday ?? false,
      streakDays: goal.streakDays,
      dailyChallengesCompleted: goal.dailyChallengesCompleted,
      questionOfTheDayPrompt: dailyBundle.questionOfTheDay?.questionContent.prompt ?? null,
      questionOfTheDaySubject: dailyBundle.questionOfTheDay?.subjectName ?? null,
    },
    upcomingExamCountdown: {
      examTitle: goal.targetExamName || goal.targetTrack,
      examSlug: goal.targetExamSlug,
      targetDate: goal.targetExamDate ? goal.targetExamDate.toISOString() : null,
      daysRemaining,
    },
    recentTests: userResults.map((r) => ({
      attemptUid: r.attemptUid,
      examSlug: r.examSlug,
      examTitle: r.examTitle,
      obtainedMarks: r.result.obtainedMarks,
      totalMarks: r.result.totalMarks,
      accuracyPercent: r.result.accuracyPercent,
      submittedAt: r.result.createdAt.toISOString(),
    })),
    performanceOverview: {
      overallAccuracy,
      totalQuestionsSolved: goal.totalQuestionsSolved,
      completedMockTests: userResults.length,
      topicProgress: progressRows,
      weakTopics,
    },
    mistakeBookSummary: {
      total: mistakesBundle.counts.total,
      unresolved: mistakesBundle.counts.unresolved,
      resolved: mistakesBundle.counts.resolved,
      recentUnresolved: mistakesBundle.mistakes
        .filter((m) => m.status === 'unresolved')
        .slice(0, 4),
    },
    bookmarks: userBookmarks,
    achievements: hydratedBadges,
    careerInterests: goal.careerInterests ?? [],
    opportunities:
      liveOpportunityCards.length > 0 ? liveOpportunityCards : CAREER_OPPORTUNITIES_CATALOG,
    dueFlashcardsCount: flashcardData.counts.due,
  };
}
