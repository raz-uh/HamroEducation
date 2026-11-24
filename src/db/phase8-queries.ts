import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  auditLogs,
  bookmarks,
  careerPaths,
  chapters,
  colleges,
  contentReviews,
  contentSources,
  courses,
  entranceExams,
  examAttempts,
  examQuestions,
  examResults,
  exams,
  grades,
  learningProgress,
  mistakeBook,
  notifications,
  personalNotes,
  profiles,
  questionExplanations,
  questionVersions,
  questions,
  reports,
  resourceCategories,
  resourceVersions,
  resources,
  roles,
  scholarships,
  streams,
  subjects,
  systemSettings,
  topics,
  universities,
  userRoles,
  users,
  type ChapterContentPayload,
} from './schema.ts';
import { ensureSeeded } from './seed.ts';
import {
  detectDuplicateQuestions,
  getAllowedAdminModules,
  normalizeLifecycleStage,
  parseQuestionImportCsv,
  toQuestionStatusDb,
  toResourceStatusDb,
  validateEditorialTransition,
} from '../lib/admin-governance.ts';
import { createQuestionBankItem } from './phase4-queries.ts';
import { isSafeHttpUrl, validateVerifiedRecord } from '../lib/explorer.ts';
import { canManageTargetUserAccount } from '../lib/rbac.ts';
import type {
  AdminAnalyticsBundle,
  AdminContentResourceItem,
  AdminExamItem,
  AdminExamResultSummary,
  AdminOverviewMetricsResponse,
  AnnouncementItem,
  AuditLogItem,
  CsvImportReport,
  EditorialLifecycleStage,
  SystemSettingItem,
} from '../types/api.ts';

export interface AuditActorInfo {
  id: number;
  email: string;
  roles: string[];
  permissions: string[];
  fullName?: string | null;
  ipAddress?: string | null;
}

export async function recordAuditLog(params: {
  actor: Pick<AuditActorInfo, 'id' | 'email' | 'roles' | 'ipAddress'>;
  action: string;
  targetEntity: string;
  targetId?: string | number | null;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<AuditLogItem | null> {
  try {
    const primaryRole = params.actor.roles[0] ?? 'staff';
    const [created] = await db
      .insert(auditLogs)
      .values({
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        actorRole: primaryRole,
        action: params.action,
        targetEntity: params.targetEntity,
        targetId: params.targetId !== undefined && params.targetId !== null ? String(params.targetId) : null,
        summary: params.summary.slice(0, 400),
        metadata: params.metadata ?? {},
        ipAddress: params.actor.ipAddress ?? null,
      })
      .returning();

    if (!created) return null;
    return {
      ...created,
      createdAt: created.createdAt.toISOString(),
    };
  } catch (err) {
    console.error('Audit log insert failed:', err);
    return null;
  }
}

export async function getAdminOverviewMetrics(
  userRolesList: string[],
  userPermissions: string[],
): Promise<AdminOverviewMetricsResponse> {
  await ensureSeeded();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    allUsers,
    activeStudentRoles,
    newUsersRows,
    allAttempts,
    allResources,
    allQuestions,
    openReportsRows,
    allBookmarks,
    allSubjects,
    allProgress,
    recentLogs,
  ] = await Promise.all([
    db.select().from(users),
    db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(roles.slug, 'registered_student'), eq(userRoles.isActive, true))),
    db.select({ id: users.id }).from(users).where(gte(users.createdAt, sevenDaysAgo)),
    db.select().from(examAttempts),
    db.select().from(resources),
    db.select().from(questions),
    db.select({ id: reports.id }).from(reports).where(eq(reports.status, 'open')),
    db.select().from(bookmarks),
    db.select().from(subjects),
    db.select().from(learningProgress),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(12),
  ]);

  const studentIdSet = new Set(activeStudentRoles.map((r) => r.userId));
  const activeStudents = allUsers.filter(
    (u) => studentIdSet.has(u.id) && u.status === 'active',
  ).length;

  const publishedResources = allResources.filter(
    (r) => normalizeLifecycleStage(r.status) === 'Published',
  ).length;
  const contentAwaitingReview = allResources.filter((r) => {
    const st = normalizeLifecycleStage(r.status);
    return st === 'Review' || st === 'Correction' || st === 'Approved' || st === 'Draft';
  }).length;

  const publishedQuestions = allQuestions.filter((q) => q.status === 'Published').length;
  const aiDraftsPendingReview = allQuestions.filter(
    (q) => q.aiGenerated && q.status !== 'Published' && q.status !== 'Archived',
  ).length;

  const qStageCounts = new Map<string, number>();
  for (const stage of ['Draft', 'Academic Review', 'Correction', 'Approval', 'Published', 'Archived']) {
    qStageCounts.set(stage, 0);
  }
  for (const q of allQuestions) {
    qStageCounts.set(q.status, (qStageCounts.get(q.status) ?? 0) + 1);
  }

  const rStageCounts = new Map<string, number>();
  for (const stage of ['Draft', 'Review', 'Correction', 'Approved', 'Published', 'Archived']) {
    rStageCounts.set(stage, 0);
  }
  for (const r of allResources) {
    const norm = normalizeLifecycleStage(r.status);
    rStageCounts.set(norm, (rStageCounts.get(norm) ?? 0) + 1);
  }

  const subjectMap = new Map(allSubjects.map((s) => [s.id, s.name]));
  const bookmarkCountByResource = new Map<number, number>();
  for (const b of allBookmarks) {
    if (b.resourceId) {
      bookmarkCountByResource.set(b.resourceId, (bookmarkCountByResource.get(b.resourceId) ?? 0) + 1);
    }
  }

  const popularResources = [...allResources]
    .sort((a, b) => {
      const diff = (bookmarkCountByResource.get(b.id) ?? 0) - (bookmarkCountByResource.get(a.id) ?? 0);
      if (diff !== 0) return diff;
      return a.id - b.id;
    })
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      title: r.title,
      subjectName: subjectMap.get(r.subjectId) ?? 'General',
      status: normalizeLifecycleStage(r.status),
      bookmarkCount: bookmarkCountByResource.get(r.id) ?? 0,
    }));

  const subjectPerfMap = new Map<string, { attempts: number; accSum: number; rows: number }>();
  for (const lp of allProgress) {
    const entry = subjectPerfMap.get(lp.subjectName) ?? { attempts: 0, accSum: 0, rows: 0 };
    entry.attempts += lp.totalAttempts;
    entry.accSum += lp.accuracyPercent;
    entry.rows += 1;
    subjectPerfMap.set(lp.subjectName, entry);
  }

  const popularSubjects = Array.from(subjectPerfMap.entries())
    .sort((a, b) => b[1].attempts - a[1].attempts)
    .slice(0, 6)
    .map(([subjectName, stats]) => ({
      subjectName,
      attemptsCount: stats.attempts,
      avgAccuracyPercent: stats.rows > 0 ? Math.round((stats.accSum / stats.rows) * 10) / 10 : 0,
    }));

  return {
    allowedModules: getAllowedAdminModules(userPermissions, userRolesList),
    metrics: {
      registeredStudents: studentIdSet.size,
      activeStudents,
      newRegistrations7d: newUsersRows.length,
      totalUsers: allUsers.length,
      examinationAttempts: allAttempts.length,
      submittedAttempts: allAttempts.filter((a) => a.status === 'submitted').length,
      publishedResources,
      contentAwaitingReview,
      publishedQuestions,
      aiDraftsPendingReview,
      openModerationReports: openReportsRows.length,
    },
    questionVerificationStatus: Array.from(qStageCounts.entries()).map(([stage, count]) => ({
      stage,
      count,
    })),
    resourceLifecycleStatus: Array.from(rStageCounts.entries()).map(([stage, count]) => ({
      stage,
      count,
    })),
    popularResources,
    popularSubjects,
    recentActivity: recentLogs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
  };
}

export async function adminUpdateUserAccount(params: {
  actor: AuditActorInfo;
  userId: number;
  status?: 'active' | 'suspended';
  institutionId?: number | null;
  fullName?: string;
}) {
  await ensureSeeded();
  const [target] = await db.select().from(users).where(eq(users.id, params.userId)).limit(1);
  if (!target) return null;

  if (params.userId === params.actor.id && params.status === 'suspended') {
    throw new Error('You cannot suspend your own active administrator account.');
  }

  const [targetProfileRows, targetRoleRows, actorRoleRows] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, params.userId)).limit(1),
    db
      .select({ roleSlug: roles.slug, institutionId: userRoles.institutionId })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(userRoles.userId, params.userId), eq(userRoles.isActive, true))),
    db
      .select({ institutionId: userRoles.institutionId })
      .from(userRoles)
      .where(and(eq(userRoles.userId, params.actor.id), eq(userRoles.isActive, true))),
  ]);

  const targetProfileInst = targetProfileRows[0]?.institutionId ?? null;
  const targetAssignedInst = targetRoleRows.find((r) => r.institutionId !== null)?.institutionId ?? null;
  const targetEffectiveInst = targetProfileInst ?? targetAssignedInst;

  const actorInstSet = new Set<number>(
    actorRoleRows
      .map((r) => r.institutionId)
      .filter((id): id is number => typeof id === 'number' && id > 0),
  );

  const authCheck = canManageTargetUserAccount({
    actorRoles: params.actor.roles,
    actorInstitutionIds: Array.from(actorInstSet),
    targetRoles: targetRoleRows.map((r) => r.roleSlug),
    targetInstitutionId: targetEffectiveInst,
    requestedStatus: params.status,
    requestedInstitutionId: params.institutionId,
    requestedFullName: params.fullName,
  });

  if (!authCheck.allowed) {
    throw new Error(`Forbidden: ${authCheck.reason ?? 'Insufficient privilege to update this user.'}`);
  }

  if (params.status) {
    await db
      .update(users)
      .set({ status: params.status, updatedAt: new Date() })
      .where(eq(users.id, params.userId));
  }

  const profileUpdates: Record<string, unknown> = { updatedAt: new Date() };
  let hasProfileUpdate = false;
  if (params.institutionId !== undefined) {
    profileUpdates.institutionId = params.institutionId;
    hasProfileUpdate = true;
  }
  if (typeof params.fullName === 'string' && params.fullName.trim().length >= 2) {
    profileUpdates.fullName = params.fullName.trim().slice(0, 100);
    hasProfileUpdate = true;
  }
  if (hasProfileUpdate) {
    await db.update(profiles).set(profileUpdates).where(eq(profiles.userId, params.userId));
  }

  await recordAuditLog({
    actor: params.actor,
    action: 'USER_ACCOUNT_UPDATED',
    targetEntity: 'users',
    targetId: params.userId,
    summary: `Updated account ${target.email} (${params.status ? `status=${params.status}` : 'profile update'}).`,
    metadata: {
      status: params.status ?? target.status,
      institutionId: params.institutionId,
    },
  });

  return { updated: true, userId: params.userId };
}

export async function adminCreateSubjectNode(params: {
  actor: AuditActorInfo;
  streamId: number;
  code: string;
  name: string;
  creditHours: number;
  isCompulsory: boolean;
}) {
  await ensureSeeded();
  const [streamRow] = await db.select().from(streams).where(eq(streams.id, params.streamId)).limit(1);
  if (!streamRow) throw new Error('Target stream not found.');

  const [created] = await db
    .insert(subjects)
    .values({
      streamId: params.streamId,
      code: params.code.trim().toUpperCase().slice(0, 24),
      name: params.name.trim().slice(0, 120),
      creditHours: Math.max(1, Math.min(12, Math.round(params.creditHours || 4))),
      isCompulsory: Boolean(params.isCompulsory),
      status: 'published',
    })
    .returning();

  await recordAuditLog({
    actor: params.actor,
    action: 'CURRICULUM_SUBJECT_CREATED',
    targetEntity: 'subjects',
    targetId: created.id,
    summary: `Created subject ${created.code} (${created.name}).`,
    metadata: { streamId: params.streamId, code: created.code },
  });

  return created;
}

export async function adminCreateChapterNode(params: {
  actor: AuditActorInfo;
  subjectId: number;
  chapterNumber: number;
  title: string;
  summary: string;
  estimatedHours: number;
}) {
  await ensureSeeded();
  const [subRow] = await db.select().from(subjects).where(eq(subjects.id, params.subjectId)).limit(1);
  if (!subRow) throw new Error('Target subject not found.');

  const [created] = await db
    .insert(chapters)
    .values({
      subjectId: params.subjectId,
      chapterNumber: Math.max(1, Math.round(params.chapterNumber || 1)),
      title: params.title.trim().slice(0, 160),
      summary: params.summary.trim().slice(0, 400),
      estimatedHours: Math.max(1, Math.min(80, Math.round(params.estimatedHours || 8))),
      reviewStatus: 'approved',
    })
    .returning();

  await recordAuditLog({
    actor: params.actor,
    action: 'CURRICULUM_CHAPTER_CREATED',
    targetEntity: 'chapters',
    targetId: created.id,
    summary: `Added Chapter ${created.chapterNumber}: ${created.title} under ${subRow.code}.`,
    metadata: { subjectId: params.subjectId, chapterNumber: created.chapterNumber },
  });

  return created;
}

export async function adminCreateTopicNode(params: {
  actor: AuditActorInfo;
  chapterId: number;
  topicNumber: string;
  title: string;
  learningObjectives: string;
  difficultyLevel: string;
  estimatedMinutes: number;
}) {
  await ensureSeeded();
  const [chRow] = await db.select().from(chapters).where(eq(chapters.id, params.chapterId)).limit(1);
  if (!chRow) throw new Error('Target chapter not found.');

  const safeDiff = ['foundational', 'intermediate', 'advanced'].includes(params.difficultyLevel)
    ? params.difficultyLevel
    : 'intermediate';

  const [created] = await db
    .insert(topics)
    .values({
      chapterId: params.chapterId,
      topicNumber: params.topicNumber.trim().slice(0, 20),
      title: params.title.trim().slice(0, 160),
      learningObjectives: params.learningObjectives.trim().slice(0, 600),
      difficultyLevel: safeDiff,
      estimatedMinutes: Math.max(10, Math.min(240, Math.round(params.estimatedMinutes || 45))),
      reviewStatus: 'approved',
      createdBy: params.actor.id,
    })
    .returning();

  await recordAuditLog({
    actor: params.actor,
    action: 'CURRICULUM_TOPIC_CREATED',
    targetEntity: 'topics',
    targetId: created.id,
    summary: `Created topic ${created.topicNumber}: ${created.title}.`,
    metadata: { chapterId: params.chapterId },
  });

  return created;
}

export async function adminListContentGovernance(): Promise<{
  resources: AdminContentResourceItem[];
  sources: Array<typeof contentSources.$inferSelect>;
  categories: Array<typeof resourceCategories.$inferSelect>;
}> {
  await ensureSeeded();

  const [allResources, allGrades, allSubjects, allChapters, allUsers, allReviews, allSources, allCats] =
    await Promise.all([
      db.select().from(resources).orderBy(desc(resources.updatedAt)),
      db.select().from(grades),
      db.select().from(subjects),
      db.select().from(chapters),
      db.select({ id: users.id, email: users.email }).from(users),
      db.select().from(contentReviews).orderBy(desc(contentReviews.reviewedAt)),
      db.select().from(contentSources).orderBy(asc(contentSources.id)),
      db.select().from(resourceCategories).orderBy(asc(resourceCategories.sortOrder)),
    ]);

  const gradeMap = new Map(allGrades.map((g) => [g.id, g.name]));
  const subjectMap = new Map(allSubjects.map((s) => [s.id, s.name]));
  const chapterMap = new Map(allChapters.map((c) => [c.id, c.title]));
  const userMap = new Map(allUsers.map((u) => [u.id, u.email]));
  const latestReviewMap = new Map<number, typeof allReviews[number]>();
  for (const rev of allReviews) {
    if (!latestReviewMap.has(rev.resourceId)) {
      latestReviewMap.set(rev.resourceId, rev);
    }
  }

  return {
    resources: allResources.map((r) => {
      const latestRev = latestReviewMap.get(r.id);
      return {
        id: r.id,
        slug: r.slug,
        title: r.title,
        summary: r.summary,
        resourceType: r.resourceType,
        status: r.status,
        lifecycleStage: normalizeLifecycleStage(r.status),
        currentVersion: r.currentVersion,
        sourceSlug: r.sourceSlug ?? 'nepal-cdc-sanothimi',
        gradeName: gradeMap.get(r.gradeId) ?? 'Grade',
        subjectName: subjectMap.get(r.subjectId) ?? 'Subject',
        chapterTitle: r.chapterId ? chapterMap.get(r.chapterId) ?? null : null,
        creatorEmail: r.createdBy ? userMap.get(r.createdBy) ?? null : null,
        publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
        archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
        updatedAt: r.updatedAt.toISOString(),
        latestReviewDecision: latestRev?.decision ?? null,
        latestReviewComment: latestRev?.comments ?? null,
      };
    }),
    sources: allSources,
    categories: allCats,
  };
}

export async function adminCreateManagedResource(params: {
  actor: AuditActorInfo;
  categorySlug: string;
  gradeId: number;
  streamId?: number | null;
  subjectId: number;
  chapterId?: number | null;
  title: string;
  summary: string;
  notesHeading: string;
  notesBody: string;
  sourceSlug: string;
  initialStage: EditorialLifecycleStage;
}) {
  await ensureSeeded();
  const [cat] = await db
    .select()
    .from(resourceCategories)
    .where(eq(resourceCategories.slug, params.categorySlug))
    .limit(1);
  if (!cat) throw new Error('Invalid resource category.');

  const [sourceRow] = await db
    .select()
    .from(contentSources)
    .where(eq(contentSources.slug, params.sourceSlug))
    .limit(1);

  const safeStage: EditorialLifecycleStage =
    params.initialStage === 'Review' ? 'Review' : 'Draft';
  const dbStatus = toResourceStatusDb(safeStage);

  const payload: ChapterContentPayload = {
    introduction: params.summary.trim(),
    learningObjectives: [params.notesHeading.trim() || 'Master core syllabus concepts'],
    completeNotes: [
      {
        heading: params.notesHeading.trim() || params.title.trim(),
        body: params.notesBody.trim(),
      },
    ],
    importantConcepts: [],
    definitions: [],
    formulaSheets: [],
    solvedExamples: [],
    diagrams: [],
    mcqs: [],
    shortQuestions: [],
    longQuestions: [],
    numericals: [],
    chapterTest: {
      durationMinutes: 20,
      totalMarks: 10,
      instructions: 'Review chapter notes before attempting.',
      sections: [],
    },
    revisionSheet: [params.summary.trim()],
  };

  const slug = `${params.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}-${Date.now()}`;

  const [created] = await db
    .insert(resources)
    .values({
      slug,
      categoryId: cat.id,
      gradeId: params.gradeId,
      streamId: params.streamId ?? null,
      subjectId: params.subjectId,
      chapterId: params.chapterId ?? null,
      title: params.title.trim().slice(0, 160),
      summary: params.summary.trim().slice(0, 500),
      resourceType: cat.slug,
      status: dbStatus,
      currentVersion: 1,
      sourceSlug: sourceRow?.slug ?? 'hamro-faculty-original',
      createdBy: params.actor.id,
    })
    .returning();

  await db.insert(resourceVersions).values({
    resourceId: created.id,
    versionNumber: 1,
    contentEn: payload,
    changelog: `Created in ${safeStage} stage (${sourceRow?.name ?? params.sourceSlug})`,
    createdBy: params.actor.id,
  });

  await recordAuditLog({
    actor: params.actor,
    action: 'RESOURCE_CREATED',
    targetEntity: 'resources',
    targetId: created.id,
    summary: `Created learning resource "${created.title}" in ${safeStage} stage.`,
    metadata: { sourceSlug: created.sourceSlug, stage: safeStage },
  });

  return created;
}

export async function adminTransitionResourceLifecycle(params: {
  actor: AuditActorInfo;
  resourceId: number;
  nextStage: EditorialLifecycleStage;
  comments: string;
  sourceSlug?: string;
}) {
  await ensureSeeded();
  const [resRow] = await db
    .select()
    .from(resources)
    .where(eq(resources.id, params.resourceId))
    .limit(1);
  if (!resRow) return null;

  const effectiveSource = (params.sourceSlug ?? resRow.sourceSlug ?? 'nepal-cdc-sanothimi').trim();
  const check = validateEditorialTransition({
    currentStatus: resRow.status,
    nextStage: params.nextStage,
    aiGenerated: false,
    hasVerifiedSource: effectiveSource.length >= 2,
    userPermissions: params.actor.permissions,
    userRoles: params.actor.roles,
  });
  if (!check.allowed) {
    throw new Error(check.reason ?? 'Editorial transition not permitted.');
  }

  const nextStatusDb = toResourceStatusDb(params.nextStage);
  const [verRow] = await db
    .select()
    .from(resourceVersions)
    .where(
      and(
        eq(resourceVersions.resourceId, resRow.id),
        eq(resourceVersions.versionNumber, resRow.currentVersion),
      ),
    )
    .limit(1);

  await db.insert(contentReviews).values({
    resourceId: resRow.id,
    versionId: verRow?.id ?? null,
    reviewerId: params.actor.id,
    decision: params.nextStage.toLowerCase(),
    comments: params.comments.trim().slice(0, 500) || `Transitioned to ${params.nextStage}`,
  });

  const [updated] = await db
    .update(resources)
    .set({
      status: nextStatusDb,
      sourceSlug: effectiveSource,
      publishedAt: params.nextStage === 'Published' ? new Date() : resRow.publishedAt,
      archivedAt: params.nextStage === 'Archived' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(resources.id, resRow.id))
    .returning();

  await recordAuditLog({
    actor: params.actor,
    action: 'RESOURCE_LIFECYCLE_TRANSITION',
    targetEntity: 'resources',
    targetId: resRow.id,
    summary: `Moved resource "${resRow.title}" from ${normalizeLifecycleStage(resRow.status)} to ${params.nextStage}.`,
    metadata: {
      fromStage: normalizeLifecycleStage(resRow.status),
      toStage: params.nextStage,
      sourceSlug: effectiveSource,
      comments: params.comments,
    },
  });

  return updated;
}

export async function adminBulkImportQuestionsCsv(params: {
  actor: AuditActorInfo;
  csvText: string;
  initialStage: 'Draft' | 'Review';
}): Promise<CsvImportReport> {
  await ensureSeeded();
  const parsed = parseQuestionImportCsv(params.csvText);

  const existingRows = await db
    .select({ questionContent: questions.questionContent })
    .from(questions);
  const existingPrompts = existingRows.map((r) => r.questionContent.prompt);

  const deduped = detectDuplicateQuestions(parsed.validRows, existingPrompts);
  const initialDbStatus = params.initialStage === 'Review' ? 'Academic Review' : 'Draft';

  const importedQuestions: CsvImportReport['importedQuestions'] = [];
  for (const row of deduped.uniqueRows) {
    const created = await createQuestionBankItem({
      actorId: params.actor.id,
      actorName: params.actor.fullName ?? params.actor.email,
      academicLevel: row.academicLevel,
      examination: row.examination,
      subjectName: row.subjectName,
      chapterName: row.chapterName,
      topicName: row.topicName,
      questionType: row.questionType,
      difficulty: row.difficulty,
      questionContent: { prompt: row.prompt },
      options: row.options,
      correctAnswer: row.correctAnswer,
      explanation: row.explanation,
      marks: row.marks,
      negativeMarks: row.negativeMarks,
      source: row.source,
      status: initialDbStatus,
      aiGenerated: false,
      tags: [row.examination.toLowerCase(), row.subjectName.toLowerCase(), 'csv-import'],
    });
    importedQuestions.push({
      id: created.id,
      questionUid: created.questionUid,
      prompt: row.prompt,
      status: created.status,
    });
  }

  await recordAuditLog({
    actor: params.actor,
    action: 'QUESTIONS_CSV_BULK_IMPORT',
    targetEntity: 'questions',
    targetId: `batch:${importedQuestions.length}`,
    summary: `CSV bulk imported ${importedQuestions.length} questions (${deduped.duplicates.length} duplicates skipped, ${parsed.errors.length} invalid rows) into ${initialDbStatus}.`,
    metadata: {
      importedCount: importedQuestions.length,
      skippedDuplicateCount: deduped.duplicates.length,
      errorCount: parsed.errors.length,
      initialStatus: initialDbStatus,
    },
  });

  return {
    totalRows: parsed.validRows.length + parsed.errors.length,
    importedCount: importedQuestions.length,
    skippedDuplicateCount: deduped.duplicates.length,
    errorCount: parsed.errors.length,
    importedQuestions,
    duplicates: deduped.duplicates,
    errors: parsed.errors,
  };
}

export async function adminTransitionQuestionLifecycle(params: {
  actor: AuditActorInfo;
  questionId: number;
  nextStage: EditorialLifecycleStage;
  comment?: string;
  updatedPrompt?: string;
  updatedExplanation?: string;
  verifiedSource?: string;
}) {
  await ensureSeeded();
  const [existing] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, params.questionId))
    .limit(1);
  if (!existing) return null;

  const effectiveSource = (params.verifiedSource ?? existing.source ?? '').trim();
  const hasVerifiedSource =
    effectiveSource.length >= 3 &&
    !effectiveSource.toLowerCase().includes('unverified') &&
    !(
      params.nextStage === 'Published' &&
      existing.aiGenerated &&
      effectiveSource === 'AI-Generated — Pending Academic Review'
    );

  // If an academic reviewer approves & publishes an AI question, promote source label if none overridden
  let resolvedSource = effectiveSource;
  if (
    existing.aiGenerated &&
    params.nextStage === 'Published' &&
    effectiveSource === 'AI-Generated — Pending Academic Review' &&
    (params.actor.permissions.includes('curriculum:review') ||
      params.actor.permissions.includes('system:admin'))
  ) {
    resolvedSource = `AI-Assisted — Academic Reviewer Verified (${params.actor.fullName ?? params.actor.email})`;
  }

  const check = validateEditorialTransition({
    currentStatus: existing.status,
    nextStage: params.nextStage,
    aiGenerated: existing.aiGenerated,
    hasVerifiedSource:
      resolvedSource.length >= 3 &&
      (!existing.aiGenerated ||
        params.nextStage !== 'Published' ||
        resolvedSource !== 'AI-Generated — Pending Academic Review'),
    userPermissions: params.actor.permissions,
    userRoles: params.actor.roles,
  });

  if (!check.allowed) {
    throw new Error(check.reason ?? 'Question lifecycle transition blocked.');
  }

  const nextDbStatus = toQuestionStatusDb(params.nextStage);
  const nextVersion = existing.version + 1;
  const nextContent = params.updatedPrompt?.trim()
    ? { ...existing.questionContent, prompt: params.updatedPrompt.trim() }
    : existing.questionContent;
  const nextExplanation = params.updatedExplanation?.trim() || existing.explanation;
  const actorLabel = params.actor.fullName ?? params.actor.email;

  const [updated] = await db
    .update(questions)
    .set({
      status: nextDbStatus,
      questionContent: nextContent,
      explanation: nextExplanation,
      source: resolvedSource,
      reviewerId: params.actor.id,
      reviewer: actorLabel,
      version: nextVersion,
      updatedAt: new Date(),
    })
    .where(eq(questions.id, existing.id))
    .returning();

  await db
    .update(questionExplanations)
    .set({
      explanation: nextExplanation,
      referenceNote: resolvedSource,
      updatedAt: new Date(),
    })
    .where(eq(questionExplanations.questionId, existing.id));

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
    changeSummary:
      params.comment?.trim() ||
      `Transitioned ${existing.status} -> ${nextDbStatus} by ${actorLabel}`,
    createdBy: params.actor.id,
  });

  await recordAuditLog({
    actor: params.actor,
    action: 'QUESTION_LIFECYCLE_TRANSITION',
    targetEntity: 'questions',
    targetId: existing.questionUid,
    summary: `Transitioned question ${existing.questionUid} from ${existing.status} to ${nextDbStatus}.`,
    metadata: {
      fromStatus: existing.status,
      toStatus: nextDbStatus,
      aiGenerated: existing.aiGenerated,
      source: resolvedSource,
      comment: params.comment ?? '',
    },
  });

  return updated;
}

export async function adminUpdateQuestionFields(params: {
  actor: AuditActorInfo;
  questionId: number;
  prompt?: string;
  explanation?: string;
  difficulty?: string;
  marks?: number;
  negativeMarks?: number;
  source?: string;
}) {
  await ensureSeeded();
  const [existing] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, params.questionId))
    .limit(1);
  if (!existing) return null;

  const isLockedStage = existing.status === 'Published' || existing.status === 'Approval';
  const canEditPublished =
    params.actor.permissions.includes('system:admin') ||
    params.actor.permissions.includes('curriculum:review') ||
    params.actor.permissions.includes('questions:manage');
  if (isLockedStage && !canEditPublished) {
    throw new Error(
      'Forbidden: Only Question Bank Managers, Academic Reviewers, or Administrators can edit Approved or Published questions.',
    );
  }

  const nextVersion = existing.version + 1;
  const nextContent =
    typeof params.prompt === 'string' && params.prompt.trim().length >= 5
      ? { ...existing.questionContent, prompt: params.prompt.trim() }
      : existing.questionContent;
  const nextExp =
    typeof params.explanation === 'string' && params.explanation.trim().length >= 3
      ? params.explanation.trim()
      : existing.explanation;
  const nextDiff =
    params.difficulty && ['easy', 'medium', 'hard'].includes(params.difficulty)
      ? params.difficulty
      : existing.difficulty;
  const nextMarks =
    typeof params.marks === 'number' && params.marks > 0 ? params.marks : existing.marks;
  const nextNeg =
    typeof params.negativeMarks === 'number' && params.negativeMarks >= 0
      ? params.negativeMarks
      : existing.negativeMarks;
  const nextSource =
    typeof params.source === 'string' && params.source.trim().length >= 2
      ? params.source.trim()
      : existing.source;

  const [updated] = await db
    .update(questions)
    .set({
      questionContent: nextContent,
      explanation: nextExp,
      difficulty: nextDiff,
      marks: nextMarks,
      negativeMarks: nextNeg,
      source: nextSource,
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
      explanation: nextExp,
      marks: nextMarks,
      negativeMarks: nextNeg,
    },
    changeSummary: `Edited fields by ${params.actor.fullName ?? params.actor.email}`,
    createdBy: params.actor.id,
  });

  await recordAuditLog({
    actor: params.actor,
    action: 'QUESTION_UPDATED',
    targetEntity: 'questions',
    targetId: existing.questionUid,
    summary: `Edited question ${existing.questionUid} (v${nextVersion}).`,
    metadata: { difficulty: nextDiff, marks: nextMarks, negativeMarks: nextNeg },
  });

  return updated;
}

export async function adminListExamsWithStats(): Promise<AdminExamItem[]> {
  await ensureSeeded();
  const [allExams, allLinks, allAttempts] = await Promise.all([
    db.select().from(exams).orderBy(desc(exams.updatedAt)),
    db.select().from(examQuestions),
    db.select().from(examAttempts),
  ]);

  const qCountMap = new Map<number, number>();
  for (const l of allLinks) {
    qCountMap.set(l.examId, (qCountMap.get(l.examId) ?? 0) + 1);
  }
  const attCountMap = new Map<number, number>();
  for (const a of allAttempts) {
    attCountMap.set(a.examId, (attCountMap.get(a.examId) ?? 0) + 1);
  }

  return allExams.map((e) => ({
    ...e,
    startWindow: e.startWindow ? e.startWindow.toISOString() : null,
    endWindow: e.endWindow ? e.endWindow.toISOString() : null,
    questionCount: qCountMap.get(e.id) ?? 0,
    attemptCount: attCountMap.get(e.id) ?? 0,
  }));
}

export async function adminCreateOrUpdateExam(params: {
  actor: AuditActorInfo;
  examId?: number;
  title: string;
  slug?: string;
  category: string;
  examinationSlug: string;
  academicLevel: string;
  subjectScope: string;
  totalMarks: number;
  durationMinutes: number;
  negativeEnabled: boolean;
  deductionPerWrong: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  startWindow?: string | null;
  endWindow?: string | null;
  attemptLimit: number;
  status: 'draft' | 'published' | 'archived';
  instructions?: string;
}) {
  await ensureSeeded();

  const negRule = {
    enabled: Boolean(params.negativeEnabled),
    deductionPerWrong: params.negativeEnabled
      ? Math.max(0, Number(params.deductionPerWrong || 0.25))
      : 0,
    description: params.negativeEnabled
      ? `Negative marking enabled (-${Number(params.deductionPerWrong || 0.25)} per wrong answer).`
      : 'No negative marking.',
  };

  const parsedStart = params.startWindow ? new Date(params.startWindow) : null;
  const parsedEnd = params.endWindow ? new Date(params.endWindow) : null;
  const safeStart = parsedStart && !Number.isNaN(parsedStart.getTime()) ? parsedStart : null;
  const safeEnd = parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : null;

  if (params.examId) {
    const [updated] = await db
      .update(exams)
      .set({
        title: params.title.trim().slice(0, 160),
        category: params.category.trim(),
        examinationSlug: params.examinationSlug.trim(),
        academicLevel: params.academicLevel.trim(),
        subjectScope: params.subjectScope.trim(),
        totalMarks: Math.max(1, Number(params.totalMarks || 100)),
        durationMinutes: Math.max(5, Math.min(360, Math.round(params.durationMinutes || 60))),
        negativeMarkingRule: negRule,
        randomizeQuestions: Boolean(params.randomizeQuestions),
        randomizeOptions: Boolean(params.randomizeOptions),
        startWindow: safeStart,
        endWindow: safeEnd,
        attemptLimit: Math.max(1, Math.min(50, Math.round(params.attemptLimit || 5))),
        status: params.status,
        instructions: params.instructions?.trim() || 'Follow standard NEB / Entrance exam guidelines.',
        updatedAt: new Date(),
      })
      .where(eq(exams.id, params.examId))
      .returning();

    if (!updated) return null;

    await recordAuditLog({
      actor: params.actor,
      action: 'EXAM_UPDATED',
      targetEntity: 'exams',
      targetId: updated.id,
      summary: `Updated exam "${updated.title}" (${updated.durationMinutes} min, ${updated.totalMarks} marks, status=${updated.status}).`,
      metadata: {
        durationMinutes: updated.durationMinutes,
        totalMarks: updated.totalMarks,
        randomizeQuestions: updated.randomizeQuestions,
        negativeMarking: negRule,
      },
    });
    return updated;
  }

  const slug =
    params.slug?.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-') ||
    `${params.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now()}`;

  const [created] = await db
    .insert(exams)
    .values({
      slug,
      title: params.title.trim().slice(0, 160),
      category: params.category.trim() || 'school',
      examinationSlug: params.examinationSlug.trim() || 'see',
      academicLevel: params.academicLevel.trim() || 'Secondary / SEE',
      subjectScope: params.subjectScope.trim() || 'All Subjects',
      totalMarks: Math.max(1, Number(params.totalMarks || 100)),
      durationMinutes: Math.max(5, Math.min(360, Math.round(params.durationMinutes || 60))),
      negativeMarkingRule: negRule,
      randomizeQuestions: Boolean(params.randomizeQuestions),
      randomizeOptions: Boolean(params.randomizeOptions),
      startWindow: safeStart,
      endWindow: safeEnd,
      attemptLimit: Math.max(1, Math.min(50, Math.round(params.attemptLimit || 5))),
      instructions: params.instructions?.trim() || 'Read all questions carefully before submitting.',
      status: params.status || 'draft',
      createdBy: params.actor.id,
    })
    .returning();

  await recordAuditLog({
    actor: params.actor,
    action: 'EXAM_CREATED',
    targetEntity: 'exams',
    targetId: created.id,
    summary: `Created exam "${created.title}" (${created.slug}).`,
    metadata: { status: created.status, durationMinutes: created.durationMinutes },
  });

  return created;
}

export async function adminGetExamResults(examId: number): Promise<AdminExamResultSummary[]> {
  await ensureSeeded();
  const rows = await db
    .select({
      attemptUid: examAttempts.attemptUid,
      userEmail: users.email,
      fullName: profiles.fullName,
      obtainedMarks: examResults.obtainedMarks,
      totalMarks: examResults.totalMarks,
      accuracyPercent: examResults.accuracyPercent,
      correctCount: examResults.correctCount,
      incorrectCount: examResults.incorrectCount,
      timeTakenSeconds: examResults.timeTakenSeconds,
      createdAt: examResults.createdAt,
    })
    .from(examResults)
    .innerJoin(examAttempts, eq(examResults.attemptId, examAttempts.id))
    .innerJoin(users, eq(examResults.userId, users.id))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(examResults.examId, examId))
    .orderBy(desc(examResults.createdAt));

  return rows.map((r) => ({
    attemptUid: r.attemptUid,
    userEmail: r.userEmail,
    studentName: r.fullName ?? r.userEmail.split('@')[0],
    obtainedMarks: r.obtainedMarks,
    totalMarks: r.totalMarks,
    accuracyPercent: r.accuracyPercent,
    correctCount: r.correctCount,
    incorrectCount: r.incorrectCount,
    timeTakenSeconds: r.timeTakenSeconds,
    submittedAt: r.createdAt.toISOString(),
  }));
}

export async function adminGetExplorerCatalog() {
  await ensureSeeded();
  const [entrances, unis, allCourses, allColleges, allScholarships, allCareers] = await Promise.all([
    db.select().from(entranceExams).orderBy(asc(entranceExams.id)),
    db.select().from(universities).orderBy(asc(universities.id)),
    db.select().from(courses).orderBy(asc(courses.id)),
    db.select().from(colleges).orderBy(asc(colleges.id)),
    db.select().from(scholarships).orderBy(asc(scholarships.id)),
    db.select().from(careerPaths).orderBy(asc(careerPaths.id)),
  ]);

  return {
    entranceExams: entrances,
    universities: unis,
    courses: allCourses,
    colleges: allColleges,
    scholarships: allScholarships,
    careerPaths: allCareers,
  };
}

export async function adminUpsertEntranceExamRecord(params: {
  actor: AuditActorInfo;
  slug: string;
  code: string;
  name: string;
  conductingBody: string;
  academicCategory: string;
  examPatternSummary: string;
  eligibilitySummary: string;
  officialUrl: string;
  source: string;
  lastVerifiedDate: string;
}) {
  await ensureSeeded();
  const check = validateVerifiedRecord({
    source: params.source,
    lastVerifiedDate: params.lastVerifiedDate,
  });
  if (!check.valid) throw new Error(check.reason);
  if (!isSafeHttpUrl(params.officialUrl)) {
    throw new Error('Official URL must be a valid http:// or https:// link.');
  }

  const [saved] = await db
    .insert(entranceExams)
    .values({
      slug: params.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      code: params.code.trim().toUpperCase(),
      name: params.name.trim(),
      conductingBody: params.conductingBody.trim(),
      academicCategory: params.academicCategory.trim(),
      examPatternSummary: params.examPatternSummary.trim(),
      eligibilitySummary: params.eligibilitySummary.trim(),
      officialUrl: params.officialUrl.trim(),
      source: params.source.trim(),
      lastVerifiedDate: params.lastVerifiedDate.trim(),
    })
    .onConflictDoUpdate({
      target: entranceExams.slug,
      set: {
        name: params.name.trim(),
        conductingBody: params.conductingBody.trim(),
        examPatternSummary: params.examPatternSummary.trim(),
        eligibilitySummary: params.eligibilitySummary.trim(),
        officialUrl: params.officialUrl.trim(),
        source: params.source.trim(),
        lastVerifiedDate: params.lastVerifiedDate.trim(),
      },
    })
    .returning();

  await recordAuditLog({
    actor: params.actor,
    action: 'ENTRANCE_RECORD_SAVED',
    targetEntity: 'entrance_exams',
    targetId: saved.slug,
    summary: `Saved verified entrance exam ${saved.code} (${saved.name}).`,
    metadata: { source: saved.source, lastVerifiedDate: saved.lastVerifiedDate },
  });

  return saved;
}

export async function adminCreateCourseRecord(params: {
  actor: AuditActorInfo;
  slug: string;
  code: string;
  name: string;
  fullForm: string;
  category: string;
  universityId: number;
  durationYears: number;
  eligibility: string;
  admissionProcess: string;
  verifiedFeeMinNpr: number;
  verifiedFeeMaxNpr: number;
  verifiedFeeNote: string;
  streamRecommendation: string;
  source: string;
  lastVerifiedDate: string;
}) {
  await ensureSeeded();
  const check = validateVerifiedRecord({
    source: params.source,
    lastVerifiedDate: params.lastVerifiedDate,
  });
  if (!check.valid) throw new Error(check.reason);

  const [saved] = await db
    .insert(courses)
    .values({
      slug: params.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      code: params.code.trim().toUpperCase(),
      name: params.name.trim(),
      fullForm: params.fullForm.trim(),
      category: params.category.trim(),
      universityId: params.universityId,
      durationYears: Number(params.durationYears || 4),
      durationLabel: `${Number(params.durationYears || 4)} Years`,
      eligibility: params.eligibility.trim(),
      admissionProcess: params.admissionProcess.trim(),
      verifiedFeeMinNpr: Math.max(0, Math.round(params.verifiedFeeMinNpr || 0)),
      verifiedFeeMaxNpr: Math.max(0, Math.round(params.verifiedFeeMaxNpr || 0)),
      verifiedFeeNote: params.verifiedFeeNote.trim(),
      streamRecommendation: params.streamRecommendation.trim() || '+2 Science / Management',
      source: params.source.trim(),
      lastVerifiedDate: params.lastVerifiedDate.trim(),
    })
    .onConflictDoUpdate({
      target: courses.slug,
      set: {
        name: params.name.trim(),
        fullForm: params.fullForm.trim(),
        verifiedFeeMinNpr: Math.max(0, Math.round(params.verifiedFeeMinNpr || 0)),
        verifiedFeeMaxNpr: Math.max(0, Math.round(params.verifiedFeeMaxNpr || 0)),
        verifiedFeeNote: params.verifiedFeeNote.trim(),
        source: params.source.trim(),
        lastVerifiedDate: params.lastVerifiedDate.trim(),
      },
    })
    .returning();

  await recordAuditLog({
    actor: params.actor,
    action: 'EXPLORER_COURSE_SAVED',
    targetEntity: 'courses',
    targetId: saved.slug,
    summary: `Saved verified course ${saved.name} (${saved.source}).`,
    metadata: { source: saved.source, lastVerifiedDate: saved.lastVerifiedDate },
  });

  return saved;
}

export async function adminCreateScholarshipRecord(params: {
  actor: AuditActorInfo;
  slug: string;
  title: string;
  provider: string;
  category: string;
  eligibility: string;
  financialBenefits: string;
  applicationDeadline: string;
  officialSourceUrl: string;
  source: string;
  lastVerifiedDate: string;
}) {
  await ensureSeeded();
  const check = validateVerifiedRecord({
    source: params.source,
    lastVerifiedDate: params.lastVerifiedDate,
  });
  if (!check.valid) throw new Error(check.reason);
  if (!isSafeHttpUrl(params.officialSourceUrl)) {
    throw new Error('Official source URL must be a valid http:// or https:// link.');
  }

  const [saved] = await db
    .insert(scholarships)
    .values({
      slug: params.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      title: params.title.trim(),
      provider: params.provider.trim(),
      category: params.category.trim(),
      eligibility: params.eligibility.trim(),
      financialBenefits: params.financialBenefits.trim(),
      applicationDeadline: params.applicationDeadline.trim(),
      officialSourceUrl: params.officialSourceUrl.trim(),
      source: params.source.trim(),
      lastVerifiedDate: params.lastVerifiedDate.trim(),
    })
    .onConflictDoUpdate({
      target: scholarships.slug,
      set: {
        title: params.title.trim(),
        financialBenefits: params.financialBenefits.trim(),
        applicationDeadline: params.applicationDeadline.trim(),
        source: params.source.trim(),
        lastVerifiedDate: params.lastVerifiedDate.trim(),
      },
    })
    .returning();

  await recordAuditLog({
    actor: params.actor,
    action: 'EXPLORER_SCHOLARSHIP_SAVED',
    targetEntity: 'scholarships',
    targetId: saved.slug,
    summary: `Saved verified scholarship "${saved.title}".`,
    metadata: { source: saved.source, lastVerifiedDate: saved.lastVerifiedDate },
  });

  return saved;
}

export async function getAnnouncementsFeed(publishedOnly: boolean): Promise<AnnouncementItem[]> {
  await ensureSeeded();
  const [rows, userRows] = await Promise.all([
    publishedOnly
      ? db
          .select()
          .from(notifications)
          .where(eq(notifications.isPublished, true))
          .orderBy(desc(notifications.createdAt))
          .limit(20)
      : db.select().from(notifications).orderBy(desc(notifications.createdAt)),
    db.select({ id: users.id, fullName: profiles.fullName, email: users.email })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id)),
  ]);

  const userMap = new Map(userRows.map((u) => [u.id, u.fullName ?? u.email]));

  return rows.map((n) => ({
    id: n.id,
    audienceRole: n.audienceRole,
    title: n.title,
    message: n.message,
    category: n.category,
    isPublished: n.isPublished,
    authorName: n.createdBy ? userMap.get(n.createdBy) ?? 'Nepal Governance Board' : 'Hamro Education',
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function adminCreateAnnouncement(params: {
  actor: AuditActorInfo;
  title: string;
  message: string;
  category: string;
  audienceRole: string;
  isPublished: boolean;
}) {
  await ensureSeeded();
  const [created] = await db
    .insert(notifications)
    .values({
      title: params.title.trim().slice(0, 160),
      message: params.message.trim().slice(0, 1200),
      category: ['announcement', 'exam_alert', 'review_notice', 'system'].includes(params.category)
        ? params.category
        : 'announcement',
      audienceRole: params.audienceRole.trim() || 'all_students',
      isPublished: Boolean(params.isPublished),
      createdBy: params.actor.id,
    })
    .returning();

  await recordAuditLog({
    actor: params.actor,
    action: 'ANNOUNCEMENT_CREATED',
    targetEntity: 'notifications',
    targetId: created.id,
    summary: `Created announcement "${created.title}" (published=${created.isPublished}).`,
    metadata: { audienceRole: created.audienceRole, category: created.category },
  });

  return created;
}

export async function adminToggleAnnouncementPublished(params: {
  actor: AuditActorInfo;
  id: number;
  isPublished: boolean;
}) {
  await ensureSeeded();
  const [updated] = await db
    .update(notifications)
    .set({ isPublished: Boolean(params.isPublished) })
    .where(eq(notifications.id, params.id))
    .returning();
  if (!updated) return null;

  await recordAuditLog({
    actor: params.actor,
    action: 'ANNOUNCEMENT_VISIBILITY_UPDATED',
    targetEntity: 'notifications',
    targetId: updated.id,
    summary: `Set announcement "${updated.title}" isPublished=${updated.isPublished}.`,
  });

  return updated;
}

export async function getAdminAnalyticsBundle(): Promise<AdminAnalyticsBundle> {
  await ensureSeeded();
  const [progressRows, examRows, attemptRows, resultRows, qRows, bRows, nRows, mRows] =
    await Promise.all([
      db.select().from(learningProgress),
      db.select().from(exams),
      db.select().from(examAttempts),
      db.select().from(examResults),
      db.select().from(questions),
      db.select({ count: sql<number>`count(*)::int` }).from(bookmarks),
      db.select({ count: sql<number>`count(*)::int` }).from(personalNotes),
      db.select().from(mistakeBook),
    ]);

  const subjMap = new Map<string, { attempts: number; accSum: number; count: number; weak: number }>();
  for (const row of progressRows) {
    const entry = subjMap.get(row.subjectName) ?? { attempts: 0, accSum: 0, count: 0, weak: 0 };
    entry.attempts += row.totalAttempts;
    entry.accSum += row.accuracyPercent;
    entry.count += 1;
    if (row.isWeak) entry.weak += 1;
    subjMap.set(row.subjectName, entry);
  }

  const subjectPerformance = Array.from(subjMap.entries()).map(([subjectName, v]) => ({
    subjectName,
    totalAttempts: v.attempts,
    avgAccuracy: v.count > 0 ? Math.round((v.accSum / v.count) * 10) / 10 : 0,
    weakTopicCount: v.weak,
  }));

  const examCompletion = examRows.map((ex) => {
    const atts = attemptRows.filter((a) => a.examId === ex.id);
    const resList = resultRows.filter((r) => r.examId === ex.id);
    const avgAcc =
      resList.length > 0
        ? Math.round(
            (resList.reduce((acc, r) => acc + r.accuracyPercent, 0) / resList.length) * 10,
          ) / 10
        : 0;
    return {
      examTitle: ex.title,
      attemptsCount: atts.length,
      submittedCount: atts.filter((a) => a.status === 'submitted').length,
      avgAccuracyPercent: avgAcc,
    };
  });

  const aiQuestions = qRows.filter((q) => q.aiGenerated);

  return {
    subjectPerformance,
    examCompletion,
    aiGovernance: {
      totalAiDrafts: aiQuestions.length,
      approvedAiQuestions: aiQuestions.filter((q) => q.status === 'Published' || q.status === 'Approval').length,
      pendingAiQuestions: aiQuestions.filter((q) => q.status !== 'Published' && q.status !== 'Archived').length,
    },
    totals: {
      bookmarksCount: bRows[0]?.count ?? 0,
      notesCount: nRows[0]?.count ?? 0,
      mistakesLogged: mRows.length,
      mistakesResolved: mRows.filter((m) => m.status === 'resolved').length,
    },
  };
}

export async function getNepalSystemSettings(): Promise<SystemSettingItem[]> {
  await ensureSeeded();
  const rows = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.countryCode, 'NP'))
    .orderBy(asc(systemSettings.id));
  return rows.map((r) => ({
    ...r,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function adminUpdateNepalSetting(params: {
  actor: AuditActorInfo;
  settingKey: string;
  valueJson: Record<string, unknown>;
}) {
  await ensureSeeded();
  const [existing] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.settingKey, params.settingKey))
    .limit(1);
  if (!existing) return null;

  // Enforce Nepal lock if active_country_profile is edited
  const merged = {
    ...existing.valueJson,
    ...params.valueJson,
  };
  if (params.settingKey === 'active_country_profile') {
    merged.countryCode = 'NP';
    merged.countryName = 'Nepal';
  }

  const [updated] = await db
    .update(systemSettings)
    .set({
      valueJson: merged,
      countryCode: 'NP',
      updatedBy: params.actor.id,
      updatedAt: new Date(),
    })
    .where(eq(systemSettings.id, existing.id))
    .returning();

  await recordAuditLog({
    actor: params.actor,
    action: 'SYSTEM_SETTING_UPDATED',
    targetEntity: 'system_settings',
    targetId: updated.settingKey,
    summary: `Updated Nepal system setting "${updated.label}".`,
    metadata: { settingKey: updated.settingKey, valueJson: merged },
  });

  return {
    ...updated,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function getAuditLogsList(params: {
  action?: string;
  targetEntity?: string;
  search?: string;
  limit?: number;
}): Promise<AuditLogItem[]> {
  await ensureSeeded();
  const rows = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(params.limit ?? 150);

  return rows
    .filter((row) => {
      if (params.action && params.action !== 'all' && row.action !== params.action) {
        return false;
      }
      if (
        params.targetEntity &&
        params.targetEntity !== 'all' &&
        row.targetEntity !== params.targetEntity
      ) {
        return false;
      }
      if (params.search && params.search.trim()) {
        const needle = params.search.trim().toLowerCase();
        const hay = `${row.actorEmail} ${row.actorRole} ${row.action} ${row.targetEntity} ${row.summary}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    })
    .map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }));
}
