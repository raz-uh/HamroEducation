import crypto from 'node:crypto';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from './index.ts';
import {
  attemptAnswers,
  attemptEvents,
  examAttempts,
  examQuestions,
  examResults,
  examSections,
  exams,
  questionAnswers,
  questionExplanations,
  questionOptions,
  questionSources,
  questionTags,
  questionVersions,
  questions,
  type ImmutableExamQuestionSnapshot,
  type ImmutableExamSnapshot,
  type QuestionAnswerJson,
  type QuestionContentJson,
  type QuestionType,
  type QuestionWorkflowStatus,
  type SnapshotOptionItem,
} from './schema.ts';
import { ensureSeeded } from './seed.ts';
import {
  canUserManageQuestions,
  gradeAttemptFromSnapshot,
  hasAttemptExpired,
  isAnswerProvided,
  isQuestionLiveInMockExam,
  sanitizeSnapshotForClient,
  shuffleDeterministic,
  type SubmittedAnswerPayload,
} from '../lib/exam-engine.ts';
import {
  normalizeLifecycleStage,
  validateEditorialTransition,
} from '../lib/admin-governance.ts';
import { recordExamSubmissionToPhase5 } from './phase5-queries.ts';

export async function resolveExamByIdentifier(examIdentifier: string) {
  await ensureSeeded();
  const trimmed = examIdentifier.trim();
  const numericId = Number(trimmed);
  if (Number.isInteger(numericId) && numericId > 0) {
    const byId = await db
      .select()
      .from(exams)
      .where(eq(exams.id, numericId))
      .limit(1);
    if (byId[0]) return byId[0];
  }
  const bySlug = await db
    .select()
    .from(exams)
    .where(eq(exams.slug, trimmed))
    .limit(1);
  return bySlug[0] ?? null;
}

export async function getPublishedExamsList(userId: number | null) {
  await ensureSeeded();
  const allExams = await db
    .select()
    .from(exams)
    .where(eq(exams.status, 'published'))
    .orderBy(asc(exams.id));

  const allSections = await db
    .select()
    .from(examSections)
    .orderBy(asc(examSections.sortOrder));

  const allLinks = await db
    .select({
      examId: examQuestions.examId,
      questionId: examQuestions.questionId,
      status: questions.status,
      marks: questions.marks,
      marksOverride: examQuestions.marksOverride,
    })
    .from(examQuestions)
    .innerJoin(questions, eq(examQuestions.questionId, questions.id));

  let userAttempts: Array<typeof examAttempts.$inferSelect> = [];
  let userResults: Array<typeof examResults.$inferSelect> = [];

  if (userId) {
    userAttempts = await db
      .select()
      .from(examAttempts)
      .where(eq(examAttempts.userId, userId))
      .orderBy(desc(examAttempts.createdAt));
    userResults = await db
      .select()
      .from(examResults)
      .where(eq(examResults.userId, userId))
      .orderBy(desc(examResults.createdAt));
  }

  return allExams.map((exam) => {
    const sections = allSections.filter((s) => s.examId === exam.id);
    // Strict Published-only live question count
    const liveLinks = allLinks.filter(
      (l) => l.examId === exam.id && isQuestionLiveInMockExam(l.status),
    );
    const liveMarksTotal = liveLinks.reduce(
      (sum, l) => sum + (l.marksOverride ?? l.marks),
      0,
    );
    const attemptsForExam = userAttempts.filter((a) => a.examId === exam.id);
    const activeAttempt = attemptsForExam.find((a) => a.status === 'in_progress') ?? null;
    const latestResult = userResults.find((r) => r.examId === exam.id) ?? null;

    return {
      ...exam,
      sections,
      liveQuestionCount: liveLinks.length,
      liveTotalMarks: Math.round(liveMarksTotal * 100) / 100 || exam.totalMarks,
      userAttemptCount: attemptsForExam.length,
      hasActiveAttempt: Boolean(activeAttempt),
      latestResult,
    };
  });
}

export async function getExamOverviewByIdentifier(
  examIdentifier: string,
  userId: number | null,
) {
  const exam = await resolveExamByIdentifier(examIdentifier);
  if (!exam) return null;

  const sections = await db
    .select()
    .from(examSections)
    .where(eq(examSections.examId, exam.id))
    .orderBy(asc(examSections.sortOrder));

  const linked = await db
    .select({
      questionStatus: questions.status,
      marks: questions.marks,
      marksOverride: examQuestions.marksOverride,
    })
    .from(examQuestions)
    .innerJoin(questions, eq(examQuestions.questionId, questions.id))
    .where(eq(examQuestions.examId, exam.id));

  const liveLinked = linked.filter((l) => isQuestionLiveInMockExam(l.questionStatus));
  const liveMarksTotal = liveLinked.reduce(
    (sum, l) => sum + (l.marksOverride ?? l.marks),
    0,
  );

  let userAttempts: Array<typeof examAttempts.$inferSelect> = [];
  let userResults: Array<typeof examResults.$inferSelect> = [];

  if (userId) {
    userAttempts = await db
      .select()
      .from(examAttempts)
      .where(and(eq(examAttempts.examId, exam.id), eq(examAttempts.userId, userId)))
      .orderBy(desc(examAttempts.createdAt));

    userResults = await db
      .select()
      .from(examResults)
      .where(and(eq(examResults.examId, exam.id), eq(examResults.userId, userId)))
      .orderBy(desc(examResults.createdAt));
  }

  const activeAttempt = userAttempts.find((a) => a.status === 'in_progress') ?? null;

  return {
    exam: {
      ...exam,
      liveQuestionCount: liveLinked.length,
      liveTotalMarks: Math.round(liveMarksTotal * 100) / 100 || exam.totalMarks,
    },
    sections,
    userAttemptCount: userAttempts.length,
    activeAttempt: activeAttempt
      ? {
          attemptUid: activeAttempt.attemptUid,
          attemptNumber: activeAttempt.attemptNumber,
          startedAt: activeAttempt.startedAt,
          expiresAt: activeAttempt.expiresAt,
        }
      : null,
    recentResults: userResults,
  };
}

export async function getQuestionBankItems(params: {
  examination?: string;
  questionType?: string;
  difficulty?: string;
  subject?: string;
  status?: string;
  search?: string;
  userPermissions: string[];
}) {
  await ensureSeeded();
  const canManage = canUserManageQuestions(params.userPermissions);

  const allQuestions = await db
    .select()
    .from(questions)
    .orderBy(desc(questions.updatedAt), asc(questions.id));

  const allTags = await db.select().from(questionTags);
  const allOptions = await db
    .select()
    .from(questionOptions)
    .orderBy(asc(questionOptions.sortOrder));
  const allVersions = await db
    .select()
    .from(questionVersions)
    .orderBy(desc(questionVersions.versionNumber));
  const allSources = await db.select().from(questionSources);

  const tagsByQ = new Map<number, typeof allTags>();
  for (const t of allTags) {
    const arr = tagsByQ.get(t.questionId) ?? [];
    arr.push(t);
    tagsByQ.set(t.questionId, arr);
  }

  const optsByQ = new Map<number, typeof allOptions>();
  for (const o of allOptions) {
    const arr = optsByQ.get(o.questionId) ?? [];
    arr.push(o);
    optsByQ.set(o.questionId, arr);
  }

  const versByQ = new Map<number, typeof allVersions>();
  for (const v of allVersions) {
    const arr = versByQ.get(v.questionId) ?? [];
    arr.push(v);
    versByQ.set(v.questionId, arr);
  }

  const filtered = allQuestions.filter((q) => {
    // Only Published questions visible to non-managers
    if (!canManage && !isQuestionLiveInMockExam(q.status)) {
      return false;
    }
    if (params.status && params.status !== 'all' && q.status !== params.status) {
      return false;
    }
    if (
      params.examination &&
      params.examination !== 'all' &&
      q.examination.toLowerCase() !== params.examination.toLowerCase()
    ) {
      return false;
    }
    if (
      params.questionType &&
      params.questionType !== 'all' &&
      q.questionType !== params.questionType
    ) {
      return false;
    }
    if (
      params.difficulty &&
      params.difficulty !== 'all' &&
      q.difficulty.toLowerCase() !== params.difficulty.toLowerCase()
    ) {
      return false;
    }
    if (
      params.subject &&
      params.subject !== 'all' &&
      q.subjectName.toLowerCase() !== params.subject.toLowerCase()
    ) {
      return false;
    }
    if (params.search && params.search.trim()) {
      const needle = params.search.trim().toLowerCase();
      const hay = `${q.questionUid} ${q.subjectName} ${q.chapterName} ${q.topicName} ${q.questionContent.prompt}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  return {
    canManage,
    sources: allSources,
    questions: filtered.map((q) => ({
      ...q,
      options: optsByQ.get(q.id) ?? [],
      tags: tagsByQ.get(q.id) ?? [],
      versions: versByQ.get(q.id) ?? [],
    })),
  };
}

export async function createQuestionBankItem(params: {
  actorId: number;
  actorName: string;
  academicLevel: string;
  examination: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  questionType: QuestionType;
  difficulty: string;
  questionContent: QuestionContentJson;
  options: Array<SnapshotOptionItem & { isCorrect?: boolean }>;
  correctAnswer: QuestionAnswerJson;
  explanation: string;
  marks: number;
  negativeMarks: number;
  source: string;
  language?: string;
  status?: QuestionWorkflowStatus;
  aiGenerated?: boolean;
  reviewerLabel?: string;
  tags?: string[];
  linkExamId?: number | null;
}) {
  await ensureSeeded();
  const randSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const uid = `Q-${params.examination.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6)}-${Date.now().toString().slice(-6)}-${randSuffix}`;
  const safeStatus: QuestionWorkflowStatus = params.aiGenerated
    ? 'Draft'
    : (params.status ?? 'Draft');

  const snapshotOpts: SnapshotOptionItem[] = params.options.map((o) => ({
    optionKey: o.optionKey,
    optionText: o.optionText,
    optionTextNe: o.optionTextNe ?? null,
  }));

  const [created] = await db
    .insert(questions)
    .values({
      questionUid: uid,
      academicLevel: params.academicLevel.trim(),
      examination: params.examination.trim(),
      subjectName: params.subjectName.trim(),
      chapterName: params.chapterName.trim(),
      topicName: params.topicName.trim(),
      questionType: params.questionType,
      difficulty: params.difficulty,
      questionContent: params.questionContent,
      answerOptions: snapshotOpts,
      correctAnswer: params.correctAnswer,
      explanation: params.explanation.trim(),
      marks: params.marks,
      negativeMarks: params.negativeMarks,
      source: params.aiGenerated
        ? 'AI-Generated — Pending Academic Review'
        : params.source.trim() || 'Faculty Original',
      language: params.language === 'ne' ? 'ne' : 'en',
      status: safeStatus,
      aiGenerated: Boolean(params.aiGenerated),
      reviewer: params.aiGenerated
        ? 'Pending Academic Review'
        : params.reviewerLabel ?? params.actorName,
      reviewerId: params.aiGenerated ? null : params.actorId,
      version: 1,
      createdBy: params.actorId,
    })
    .returning();

  if (params.options.length > 0) {
    await db
      .insert(questionOptions)
      .values(
        params.options.map((o, idx) => ({
          questionId: created.id,
          optionKey: o.optionKey,
          optionText: o.optionText,
          optionTextNe: o.optionTextNe ?? null,
          isCorrect: Boolean(o.isCorrect),
          sortOrder: idx + 1,
        })),
      )
      .onConflictDoNothing();
  }

  await db
    .insert(questionAnswers)
    .values({ questionId: created.id, correctAnswer: params.correctAnswer })
    .onConflictDoNothing();

  await db
    .insert(questionExplanations)
    .values({
      questionId: created.id,
      explanation: params.explanation.trim(),
      referenceNote: params.source.trim(),
    })
    .onConflictDoNothing();

  if (params.tags?.length) {
    await db
      .insert(questionTags)
      .values(
        params.tags.slice(0, 8).map((tag) => ({
          questionId: created.id,
          slug: tag.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
          label: tag.trim().slice(0, 40),
        })),
      )
      .onConflictDoNothing();
  }

  await db.insert(questionVersions).values({
    questionId: created.id,
    versionNumber: 1,
    snapshotJson: {
      questionContent: params.questionContent,
      answerOptions: snapshotOpts,
      correctAnswer: params.correctAnswer,
      explanation: params.explanation.trim(),
      marks: params.marks,
      negativeMarks: params.negativeMarks,
    },
    changeSummary: `Created in ${safeStatus} workflow stage`,
    createdBy: params.actorId,
  });

  if (params.linkExamId && Number.isInteger(params.linkExamId)) {
    await db
      .insert(examQuestions)
      .values({
        examId: params.linkExamId,
        questionId: created.id,
        sortOrder: 99,
      })
      .onConflictDoNothing();
  }

  return created;
}

export async function transitionQuestionStatus(params: {
  questionId: number;
  nextStatus: QuestionWorkflowStatus;
  actorId: number;
  actorName: string;
  actorRoles?: string[];
  actorPermissions?: string[];
  updatedPrompt?: string;
  updatedExplanation?: string;
}) {
  await ensureSeeded();
  const [existing] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, params.questionId))
    .limit(1);
  if (!existing) return null;

  const nextStage = normalizeLifecycleStage(params.nextStatus);
  const actorPerms = params.actorPermissions ?? [];
  const actorRoles = params.actorRoles ?? [];
  let resolvedSource = (existing.source ?? '').trim();

  if (
    existing.aiGenerated &&
    nextStage === 'Published' &&
    resolvedSource === 'AI-Generated — Pending Academic Review' &&
    (actorPerms.includes('curriculum:review') || actorPerms.includes('system:admin'))
  ) {
    resolvedSource = `AI-Assisted — Academic Reviewer Verified (${params.actorName})`;
  }

  const check = validateEditorialTransition({
    currentStatus: existing.status,
    nextStage,
    aiGenerated: existing.aiGenerated,
    hasVerifiedSource:
      resolvedSource.length >= 3 &&
      !resolvedSource.toLowerCase().includes('unverified') &&
      (!existing.aiGenerated ||
        nextStage !== 'Published' ||
        resolvedSource !== 'AI-Generated — Pending Academic Review'),
    userPermissions: actorPerms,
    userRoles: actorRoles,
  });

  if (!check.allowed) {
    throw new Error(check.reason ?? 'Question lifecycle transition not permitted.');
  }

  const nextVersion = existing.version + 1;
  const nextContent: QuestionContentJson = params.updatedPrompt
    ? { ...existing.questionContent, prompt: params.updatedPrompt }
    : existing.questionContent;
  const nextExplanation = params.updatedExplanation ?? existing.explanation;

  const [updated] = await db
    .update(questions)
    .set({
      status: params.nextStatus,
      questionContent: nextContent,
      explanation: nextExplanation,
      source: resolvedSource,
      reviewerId: params.actorId,
      reviewer: params.actorName,
      version: nextVersion,
      updatedAt: new Date(),
    })
    .where(eq(questions.id, existing.id))
    .returning();

  await db.insert(questionVersions).values({
    questionId: existing.id,
    versionNumber: nextVersion,
    snapshotJson: {
      questionContent: nextContent,
      answerOptions: existing.answerOptions,
      correctAnswer: existing.correctAnswer,
      explanation: nextExplanation,
      marks: existing.marks,
      negativeMarks: existing.negativeMarks,
    },
    changeSummary: `Status transitioned to ${params.nextStatus} by ${params.actorName}`,
    createdBy: params.actorId,
  });

  return updated;
}

async function finalizeAttemptScoring(params: {
  attempt: typeof examAttempts.$inferSelect;
  reason: 'manual' | 'timeout';
  userId: number;
}): Promise<{
  alreadyFinalized: boolean;
  result: typeof examResults.$inferSelect | undefined;
}> {
  const { attempt, reason, userId } = params;
  const snapshot = attempt.immutableSnapshot;

  const now = new Date();
  const rawElapsedSeconds = Math.round(
    (now.getTime() - new Date(attempt.startedAt).getTime()) / 1000,
  );
  const maxSeconds = snapshot.durationMinutes * 60;
  const boundedSeconds = Math.max(1, Math.min(rawElapsedSeconds, maxSeconds));
  const finalAttemptStatus = reason === 'timeout' ? 'auto_submitted' : 'submitted';

  // Atomic claim ensures concurrent submit/timeout calls never double-score or double-credit Phase 5 progress
  const [claimed] = await db
    .update(examAttempts)
    .set({
      status: finalAttemptStatus,
      submittedAt: now,
      timeTakenSeconds: boundedSeconds,
      updatedAt: now,
    })
    .where(and(eq(examAttempts.id, attempt.id), eq(examAttempts.status, 'in_progress')))
    .returning();

  if (!claimed) {
    let existingResult: typeof examResults.$inferSelect | undefined;
    for (let i = 0; i < 6; i += 1) {
      const rows = await db
        .select()
        .from(examResults)
        .where(eq(examResults.attemptId, attempt.id))
        .limit(1);
      if (rows[0]) {
        existingResult = rows[0];
        break;
      }
      await new Promise((r) => setTimeout(r, 75));
    }
    return { alreadyFinalized: true, result: existingResult };
  }

  const savedRows = await db
    .select()
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attempt.id));

  const answerMap = new Map<number, SubmittedAnswerPayload | null>();
  for (const row of savedRows) {
    answerMap.set(row.questionId, row.selectedAnswer ?? null);
  }

  const graded = gradeAttemptFromSnapshot(snapshot, answerMap, boundedSeconds);

  // Update per-question grading on attempt_answers
  for (const gq of graded.gradedQuestions) {
    await db
      .update(attemptAnswers)
      .set({
        isCorrect: gq.isCorrect,
        marksAwarded: gq.marksAwarded,
      })
      .where(
        and(
          eq(attemptAnswers.attemptId, attempt.id),
          eq(attemptAnswers.questionId, gq.questionId),
        ),
      );
  }

  await db
    .insert(examResults)
    .values({
      attemptId: attempt.id,
      examId: attempt.examId,
      userId,
      totalMarks: graded.totalMarks,
      obtainedMarks: graded.obtainedMarks,
      correctCount: graded.correctCount,
      incorrectCount: graded.incorrectCount,
      unattemptedCount: graded.unattemptedCount,
      accuracyPercent: graded.accuracyPercent,
      timeTakenSeconds: graded.timeTakenSeconds,
      subjectBreakdown: graded.subjectBreakdown,
      chapterBreakdown: graded.chapterBreakdown,
      topicBreakdown: graded.topicBreakdown,
    })
    .onConflictDoNothing({ target: examResults.attemptId });

  const [resultRow] = await db
    .select()
    .from(examResults)
    .where(eq(examResults.attemptId, attempt.id))
    .limit(1);

  await db.insert(attemptEvents).values({
    attemptId: attempt.id,
    userId,
    eventType: reason === 'timeout' ? 'auto_submit_timeout' : 'manual_submit',
    payload: {
      obtainedMarks: graded.obtainedMarks,
      totalMarks: graded.totalMarks,
      accuracyPercent: graded.accuracyPercent,
    },
  });

  // Phase 5 hook: populate Mistake Book, update Learning Progress, and evaluate Achievements
  const levelMap = new Map(snapshot.questions.map((q) => [q.questionId, q.academicLevel]));
  await recordExamSubmissionToPhase5({
    userId,
    gradedQuestions: graded.gradedQuestions,
    academicLevelByQuestionId: levelMap,
  });

  return { alreadyFinalized: false, result: resultRow };
}

export async function startOrResumeExamAttempt(params: {
  examIdentifier: string;
  userId: number;
  forceNew?: boolean;
}) {
  const exam = await resolveExamByIdentifier(params.examIdentifier);
  if (!exam || exam.status !== 'published') {
    throw new Error('Requested examination is not available.');
  }

  const now = new Date();
  if (exam.startWindow && now < new Date(exam.startWindow)) {
    throw new Error('This examination window has not opened yet.');
  }
  if (exam.endWindow && now > new Date(exam.endWindow)) {
    throw new Error('This examination window has already closed.');
  }

  const existingAttempts = await db
    .select()
    .from(examAttempts)
    .where(and(eq(examAttempts.examId, exam.id), eq(examAttempts.userId, params.userId)))
    .orderBy(desc(examAttempts.attemptNumber));

  // Auto-finalize any expired in-progress attempts first
  for (const att of existingAttempts) {
    if (att.status === 'in_progress' && hasAttemptExpired(att.expiresAt, now)) {
      await finalizeAttemptScoring({
        attempt: att,
        reason: 'timeout',
        userId: params.userId,
      });
      att.status = 'auto_submitted';
    }
  }

  // Resume active attempt unless forceNew requested
  const active = existingAttempts.find((a) => a.status === 'in_progress');
  if (active && !params.forceNew) {
    const savedRows = await db
      .select()
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, active.id));

    await db.insert(attemptEvents).values({
      attemptId: active.id,
      userId: params.userId,
      eventType: 'network_reconnected',
      payload: { resumedAt: now.toISOString() },
    });

    return {
      resumed: true,
      attempt: {
        id: active.id,
        attemptUid: active.attemptUid,
        attemptNumber: active.attemptNumber,
        status: active.status,
        startedAt: active.startedAt,
        expiresAt: active.expiresAt,
      },
      examConfig: {
        id: exam.id,
        slug: exam.slug,
        title: exam.title,
        category: exam.category,
        academicLevel: exam.academicLevel,
        instructions: exam.instructions,
        negativeMarkingRule: exam.negativeMarkingRule,
        resultVisibility: exam.resultVisibility,
        attemptLimit: exam.attemptLimit,
      },
      snapshot: sanitizeSnapshotForClient(active.immutableSnapshot),
      savedAnswers: savedRows.map((r) => ({
        questionId: r.questionId,
        selectedAnswer: r.selectedAnswer,
        status: r.status,
        isMarkedForReview: r.isMarkedForReview,
      })),
    };
  }

  if (existingAttempts.length >= exam.attemptLimit) {
    throw new Error(
      `Attempt limit reached (${exam.attemptLimit} attempts allowed for this examination).`,
    );
  }

  // Fetch linked questions strictly filtering to Published status ONLY!
  const linkedRows = await db
    .select({
      sortOrder: examQuestions.sortOrder,
      sectionId: examQuestions.sectionId,
      marksOverride: examQuestions.marksOverride,
      negativeMarksOverride: examQuestions.negativeMarksOverride,
      question: questions,
    })
    .from(examQuestions)
    .innerJoin(questions, eq(examQuestions.questionId, questions.id))
    .where(eq(examQuestions.examId, exam.id))
    .orderBy(asc(examQuestions.sortOrder));

  const publishedLinks = linkedRows.filter((row) =>
    isQuestionLiveInMockExam(row.question.status),
  );
  if (publishedLinks.length === 0) {
    throw new Error('This examination has no published questions available yet.');
  }

  const sections = await db
    .select()
    .from(examSections)
    .where(eq(examSections.examId, exam.id));
  const sectionMap = new Map(sections.map((s) => [s.id, s]));

  const qIds = publishedLinks.map((l) => l.question.id);
  const optionRows = await db
    .select()
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, qIds))
    .orderBy(asc(questionOptions.sortOrder));
  const explRows = await db
    .select()
    .from(questionExplanations)
    .where(inArray(questionExplanations.questionId, qIds));

  const optsByQ = new Map<number, SnapshotOptionItem[]>();
  for (const o of optionRows) {
    const arr = optsByQ.get(o.questionId) ?? [];
    arr.push({
      optionKey: o.optionKey,
      optionText: o.optionText,
      optionTextNe: o.optionTextNe ?? null,
    });
    optsByQ.set(o.questionId, arr);
  }
  const explByQ = new Map(explRows.map((e) => [e.questionId, e]));

  const attemptUid = `ATT-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;

  let snapshotQuestions: ImmutableExamQuestionSnapshot[] = publishedLinks.map((link, idx) => {
    const q = link.question;
    const rawOptions = optsByQ.get(q.id) ?? q.answerOptions ?? [];
    const finalOptions = exam.randomizeOptions
      ? shuffleDeterministic(rawOptions, `${attemptUid}-opt-${q.id}`)
      : rawOptions;
    const sec = link.sectionId ? sectionMap.get(link.sectionId) : null;
    const expl = explByQ.get(q.id);
    const marks = link.marksOverride ?? q.marks;
    const negMarks = exam.negativeMarkingRule.enabled
      ? (link.negativeMarksOverride ?? q.negativeMarks)
      : 0;

    return {
      questionId: q.id,
      questionUid: q.questionUid,
      sectionId: sec?.id ?? null,
      sectionTitle: sec?.title ?? q.subjectName,
      questionType: q.questionType,
      difficulty: q.difficulty,
      academicLevel: q.academicLevel,
      examination: q.examination,
      subjectName: q.subjectName,
      chapterName: q.chapterName,
      topicName: q.topicName,
      questionContent: q.questionContent,
      options: finalOptions,
      correctAnswer: q.correctAnswer,
      explanation: expl?.explanation ?? q.explanation,
      explanationNe: expl?.explanationNe ?? null,
      marks,
      negativeMarks: negMarks,
      sortOrder: idx + 1,
    };
  });

  if (exam.randomizeQuestions) {
    snapshotQuestions = shuffleDeterministic(snapshotQuestions, attemptUid).map(
      (q, idx) => ({ ...q, sortOrder: idx + 1 }),
    );
  }

  const totalMarksSum =
    Math.round(snapshotQuestions.reduce((s, q) => s + q.marks, 0) * 100) / 100;

  const immutableSnapshot: ImmutableExamSnapshot = {
    examId: exam.id,
    examSlug: exam.slug,
    examTitle: exam.title,
    durationMinutes: exam.durationMinutes,
    totalMarks: totalMarksSum,
    negativeMarkingEnabled: exam.negativeMarkingRule.enabled,
    questions: snapshotQuestions,
  };

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + exam.durationMinutes * 60 * 1000);
  const nextAttemptNum = existingAttempts.length + 1;

  const [createdAttempt] = await db
    .insert(examAttempts)
    .values({
      attemptUid,
      examId: exam.id,
      userId: params.userId,
      attemptNumber: nextAttemptNum,
      status: 'in_progress',
      startedAt,
      expiresAt,
      immutableSnapshot,
    })
    .returning();

  const initialAnswerRows = snapshotQuestions.map((q) => ({
    attemptId: createdAttempt.id,
    questionId: q.questionId,
    selectedAnswer: null,
    status: 'unvisited',
    isMarkedForReview: false,
  }));

  await db.insert(attemptAnswers).values(initialAnswerRows).onConflictDoNothing();

  await db.insert(attemptEvents).values({
    attemptId: createdAttempt.id,
    userId: params.userId,
    eventType: 'exam_started',
    payload: {
      attemptNumber: nextAttemptNum,
      questionCount: snapshotQuestions.length,
      randomizedQuestions: exam.randomizeQuestions,
      randomizedOptions: exam.randomizeOptions,
    },
  });

  return {
    resumed: false,
    attempt: {
      id: createdAttempt.id,
      attemptUid: createdAttempt.attemptUid,
      attemptNumber: createdAttempt.attemptNumber,
      status: createdAttempt.status,
      startedAt: createdAttempt.startedAt,
      expiresAt: createdAttempt.expiresAt,
    },
    examConfig: {
      id: exam.id,
      slug: exam.slug,
      title: exam.title,
      category: exam.category,
      academicLevel: exam.academicLevel,
      instructions: exam.instructions,
      negativeMarkingRule: exam.negativeMarkingRule,
      resultVisibility: exam.resultVisibility,
      attemptLimit: exam.attemptLimit,
    },
    snapshot: sanitizeSnapshotForClient(immutableSnapshot),
    savedAnswers: initialAnswerRows.map((r) => ({
      questionId: r.questionId,
      selectedAnswer: null,
      status: 'unvisited',
      isMarkedForReview: false,
    })),
  };
}

export async function saveAttemptAnswer(params: {
  attemptUid: string;
  userId: number;
  questionId: number;
  selectedAnswer: SubmittedAnswerPayload | null;
  isMarkedForReview: boolean;
  visitedOnly?: boolean;
}) {
  await ensureSeeded();
  const [attempt] = await db
    .select()
    .from(examAttempts)
    .where(
      and(
        eq(examAttempts.attemptUid, params.attemptUid),
        eq(examAttempts.userId, params.userId),
      ),
    )
    .limit(1);

  if (!attempt) {
    throw new Error('Exam attempt not found.');
  }
  if (attempt.status !== 'in_progress') {
    throw new Error('This attempt has already been submitted and locked.');
  }

  const now = new Date();
  if (hasAttemptExpired(attempt.expiresAt, now)) {
    const finalized = await finalizeAttemptScoring({
      attempt,
      reason: 'timeout',
      userId: params.userId,
    });
    return { expired: true, result: finalized.result };
  }

  const snapQuestion = attempt.immutableSnapshot.questions.find(
    (q) => q.questionId === params.questionId,
  );
  if (!snapQuestion) {
    throw new Error('Question does not belong to this attempt snapshot.');
  }

  const rawSel = params.selectedAnswer;
  const boundedAnswer: SubmittedAnswerPayload | null =
    rawSel && typeof rawSel === 'object'
      ? {
          ...(Array.isArray(rawSel.optionKeys)
            ? {
                optionKeys: rawSel.optionKeys
                  .filter((k): k is string => typeof k === 'string')
                  .map((k) => k.slice(0, 12))
                  .slice(0, 10),
              }
            : {}),
          ...(typeof rawSel.booleanValue === 'boolean'
            ? { booleanValue: rawSel.booleanValue }
            : {}),
          ...(typeof rawSel.numericValue === 'number' && Number.isFinite(rawSel.numericValue)
            ? { numericValue: rawSel.numericValue }
            : {}),
          ...(typeof rawSel.textValue === 'string'
            ? { textValue: rawSel.textValue.slice(0, 4000) }
            : {}),
          ...(rawSel.matchingMap && typeof rawSel.matchingMap === 'object'
            ? {
                matchingMap: Object.fromEntries(
                  Object.entries(rawSel.matchingMap)
                    .slice(0, 16)
                    .map(([k, v]) => [String(k).slice(0, 40), String(v).slice(0, 120)]),
                ),
              }
            : {}),
        }
      : null;

  const answered = isAnswerProvided(snapQuestion.questionType, boundedAnswer);
  const nextStatus = params.isMarkedForReview
    ? 'marked_for_review'
    : answered
      ? 'answered'
      : 'not_answered';

  await db
    .insert(attemptAnswers)
    .values({
      attemptId: attempt.id,
      questionId: params.questionId,
      selectedAnswer: boundedAnswer,
      status: nextStatus,
      isMarkedForReview: params.isMarkedForReview,
      savedAt: now,
    })
    .onConflictDoUpdate({
      target: [attemptAnswers.attemptId, attemptAnswers.questionId],
      set: {
        selectedAnswer: boundedAnswer,
        status: nextStatus,
        isMarkedForReview: params.isMarkedForReview,
        savedAt: now,
      },
    });

  if (!params.visitedOnly) {
    await db.insert(attemptEvents).values({
      attemptId: attempt.id,
      userId: params.userId,
      eventType: params.isMarkedForReview ? 'marked_for_review' : 'answer_saved',
      payload: {
        questionId: params.questionId,
        status: nextStatus,
      },
    });
  }

  return {
    expired: false,
    questionId: params.questionId,
    status: nextStatus,
    isMarkedForReview: params.isMarkedForReview,
    savedAt: now,
  };
}

export async function submitExamAttempt(params: {
  attemptUid: string;
  userId: number;
  reason?: 'manual' | 'timeout';
}) {
  await ensureSeeded();
  const [attempt] = await db
    .select()
    .from(examAttempts)
    .where(
      and(
        eq(examAttempts.attemptUid, params.attemptUid),
        eq(examAttempts.userId, params.userId),
      ),
    )
    .limit(1);

  if (!attempt) {
    throw new Error('Exam attempt not found.');
  }

  // Duplicate submission prevention
  if (attempt.status !== 'in_progress') {
    await db.insert(attemptEvents).values({
      attemptId: attempt.id,
      userId: params.userId,
      eventType: 'duplicate_submit_blocked',
      payload: { existingStatus: attempt.status },
    });

    const [existingResult] = await db
      .select()
      .from(examResults)
      .where(eq(examResults.attemptId, attempt.id))
      .limit(1);

    return {
      duplicateBlocked: true,
      result: existingResult,
      attemptUid: attempt.attemptUid,
    };
  }

  const effectiveReason: 'manual' | 'timeout' =
    params.reason === 'timeout' || hasAttemptExpired(attempt.expiresAt)
      ? 'timeout'
      : 'manual';

  const finalized = await finalizeAttemptScoring({
    attempt,
    reason: effectiveReason,
    userId: params.userId,
  });

  if (finalized.alreadyFinalized) {
    await db.insert(attemptEvents).values({
      attemptId: attempt.id,
      userId: params.userId,
      eventType: 'duplicate_submit_blocked',
      payload: { existingStatus: 'already_finalized' },
    });
  }

  return {
    duplicateBlocked: finalized.alreadyFinalized,
    result: finalized.result,
    attemptUid: attempt.attemptUid,
  };
}

export async function getExamResultView(params: {
  examIdentifier: string;
  userId: number;
  attemptUid?: string;
}) {
  const exam = await resolveExamByIdentifier(params.examIdentifier);
  if (!exam) return null;

  if (
    exam.resultVisibility === 'after_window' &&
    exam.endWindow &&
    new Date() < new Date(exam.endWindow)
  ) {
    throw new Error('Results for this exam will be published after the exam window closes.');
  }

  const allUserAttempts = await db
    .select()
    .from(examAttempts)
    .where(and(eq(examAttempts.examId, exam.id), eq(examAttempts.userId, params.userId)))
    .orderBy(desc(examAttempts.attemptNumber));

  const targetAttempt = params.attemptUid
    ? allUserAttempts.find((a) => a.attemptUid === params.attemptUid)
    : allUserAttempts.find((a) => a.status !== 'in_progress') ?? allUserAttempts[0];

  if (!targetAttempt) return null;

  // Ensure expired active attempts are auto-scored before returning result
  if (targetAttempt.status === 'in_progress') {
    if (hasAttemptExpired(targetAttempt.expiresAt)) {
      await finalizeAttemptScoring({
        attempt: targetAttempt,
        reason: 'timeout',
        userId: params.userId,
      });
    } else {
      throw new Error('Attempt is still in progress. Submit your exam to view results.');
    }
  }

  const [freshAttempt] = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.id, targetAttempt.id))
    .limit(1);

  const [resultRow] = await db
    .select()
    .from(examResults)
    .where(eq(examResults.attemptId, targetAttempt.id))
    .limit(1);

  const savedRows = await db
    .select()
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, targetAttempt.id));

  const events = await db
    .select()
    .from(attemptEvents)
    .where(eq(attemptEvents.attemptId, targetAttempt.id))
    .orderBy(asc(attemptEvents.createdAt));

  const answerMap = new Map<number, SubmittedAnswerPayload | null>();
  for (const r of savedRows) {
    answerMap.set(r.questionId, r.selectedAnswer ?? null);
  }

  // Reconstruct full answer review strictly from the attempt's immutableSnapshot
  const review = gradeAttemptFromSnapshot(
    freshAttempt.immutableSnapshot,
    answerMap,
    freshAttempt.timeTakenSeconds ?? resultRow?.timeTakenSeconds ?? 0,
  );

  // Previous attempts comparison
  const allResults = await db
    .select({
      attemptId: examResults.attemptId,
      obtainedMarks: examResults.obtainedMarks,
      totalMarks: examResults.totalMarks,
      accuracyPercent: examResults.accuracyPercent,
      correctCount: examResults.correctCount,
      incorrectCount: examResults.incorrectCount,
      timeTakenSeconds: examResults.timeTakenSeconds,
      createdAt: examResults.createdAt,
    })
    .from(examResults)
    .where(and(eq(examResults.examId, exam.id), eq(examResults.userId, params.userId)))
    .orderBy(desc(examResults.createdAt));

  const attemptMetaMap = new Map(allUserAttempts.map((a) => [a.id, a]));

  return {
    exam,
    attempt: {
      id: freshAttempt.id,
      attemptUid: freshAttempt.attemptUid,
      attemptNumber: freshAttempt.attemptNumber,
      status: freshAttempt.status,
      startedAt: freshAttempt.startedAt,
      submittedAt: freshAttempt.submittedAt,
      timeTakenSeconds: freshAttempt.timeTakenSeconds ?? resultRow?.timeTakenSeconds ?? 0,
    },
    result: resultRow,
    review,
    auditEvents: events,
    previousAttempts: allResults.map((r) => ({
      ...r,
      attemptUid: attemptMetaMap.get(r.attemptId)?.attemptUid ?? '',
      attemptNumber: attemptMetaMap.get(r.attemptId)?.attemptNumber ?? 1,
      status: attemptMetaMap.get(r.attemptId)?.status ?? 'submitted',
    })),
  };
}
