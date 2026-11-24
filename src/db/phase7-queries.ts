import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  careerPaths,
  colleges,
  courses,
  discussionComments,
  discussionGroups,
  discussionPosts,
  entranceExams,
  learningProgress,
  moderationActions,
  postVotes,
  profiles,
  reports,
  roles,
  scholarships,
  studentGoals,
  studyPlans,
  studyTasks,
  userRoles,
  users,
} from './schema.ts';
import { ensureSeeded } from './seed.ts';
import {
  canMarkTeacherVerified,
  canModerateCommunity,
  formatYouthSafeCommunityAuthor,
  moderateCommunityText,
  YOUTH_SAFETY_RULES,
} from '../lib/ai-community.ts';

async function loadAuthorLookup(userIds: number[]) {
  if (userIds.length === 0) {
    return new Map<number, ReturnType<typeof formatYouthSafeCommunityAuthor>>();
  }
  const uniqueIds = Array.from(new Set(userIds));
  const [userRows, profileRows, roleAssignments, allRoles, goalRows] = await Promise.all([
    db.select({ id: users.id }).from(users).where(inArray(users.id, uniqueIds)),
    db
      .select({
        userId: profiles.userId,
        fullName: profiles.fullName,
        displayName: profiles.displayName,
      })
      .from(profiles)
      .where(inArray(profiles.userId, uniqueIds)),
    db
      .select({ userId: userRoles.userId, roleId: userRoles.roleId })
      .from(userRoles)
      .where(inArray(userRoles.userId, uniqueIds)),
    db.select({ id: roles.id, slug: roles.slug }).from(roles),
    db
      .select({ userId: studentGoals.userId, targetTrack: studentGoals.targetTrack })
      .from(studentGoals)
      .where(inArray(studentGoals.userId, uniqueIds)),
  ]);

  const roleSlugById = new Map(allRoles.map((r) => [r.id, r.slug]));
  const profileByUid = new Map(profileRows.map((p) => [p.userId, p]));
  const goalByUid = new Map(goalRows.map((g) => [g.userId, g.targetTrack]));
  const roleSlugsByUid = new Map<number, string[]>();

  for (const ra of roleAssignments) {
    const slug = roleSlugById.get(ra.roleId);
    if (!slug) continue;
    const list = roleSlugsByUid.get(ra.userId) ?? [];
    list.push(slug);
    roleSlugsByUid.set(ra.userId, list);
  }

  const out = new Map<number, ReturnType<typeof formatYouthSafeCommunityAuthor>>();
  for (const u of userRows) {
    const prof = profileByUid.get(u.id);
    const slugs = roleSlugsByUid.get(u.id) ?? ['registered_student'];
    out.set(
      u.id,
      formatYouthSafeCommunityAuthor({
        fullName: prof?.fullName ?? `Learner #${u.id}`,
        displayName: prof?.displayName ?? null,
        roleSlugs: slugs,
        userId: u.id,
        gradeOrTrack: goalByUid.get(u.id) ?? null,
      }),
    );
  }
  return out;
}

export async function getCommunityFeed(params: {
  viewerUserId: number | null;
  viewerPermissions: string[];
  viewerRoles: string[];
  groupSlug?: string;
  filter?: string;
  search?: string;
}) {
  await ensureSeeded();

  const canVerifyAnswers = canMarkTeacherVerified(params.viewerPermissions, params.viewerRoles);
  const canModerate = canModerateCommunity(params.viewerPermissions, params.viewerRoles);

  const [groups, allPosts, allComments] = await Promise.all([
    db.select().from(discussionGroups).orderBy(asc(discussionGroups.id)),
    db.select().from(discussionPosts).orderBy(desc(discussionPosts.createdAt)),
    db.select().from(discussionComments).orderBy(asc(discussionComments.createdAt)),
  ]);

  const visiblePosts = allPosts.filter((p) => canModerate || p.moderationStatus !== 'hidden');
  const visibleComments = allComments.filter((c) => canModerate || c.moderationStatus !== 'hidden');

  const userVotes = params.viewerUserId
    ? await db
        .select({ targetKey: postVotes.targetKey })
        .from(postVotes)
        .where(eq(postVotes.userId, params.viewerUserId))
    : [];
  const votedSet = new Set(userVotes.map((v) => v.targetKey));

  const authorIds = [
    ...visiblePosts.map((p) => p.authorId),
    ...visibleComments.map((c) => c.authorId),
  ];
  const authorMap = await loadAuthorLookup(authorIds);
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const commentsByPostId = new Map<number, typeof visibleComments>();
  for (const c of visibleComments) {
    const list = commentsByPostId.get(c.postId) ?? [];
    list.push(c);
    commentsByPostId.set(c.postId, list);
  }

  // Group counts
  const postCountByGroup = new Map<number, number>();
  const unansweredByGroup = new Map<number, number>();
  for (const p of visiblePosts) {
    if (p.moderationStatus === 'hidden') continue;
    postCountByGroup.set(p.groupId, (postCountByGroup.get(p.groupId) ?? 0) + 1);
    if (!p.isAnswered) {
      unansweredByGroup.set(p.groupId, (unansweredByGroup.get(p.groupId) ?? 0) + 1);
    }
  }

  const filteredPosts = visiblePosts.filter((p) => {
    const grp = groupMap.get(p.groupId);
    if (params.groupSlug && params.groupSlug !== 'all' && grp?.slug !== params.groupSlug) {
      return false;
    }
    if (params.filter === 'unanswered' && p.isAnswered) {
      return false;
    }
    if (params.filter === 'teacher_verified' && !p.hasTeacherVerified) {
      return false;
    }
    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      const hay = `${p.title} ${p.body} ${p.tags.join(' ')} ${grp?.name ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  let moderationQueue: Array<{
    id: number;
    targetType: 'post' | 'comment';
    postId: number | null;
    commentId: number | null;
    reason: string;
    details: string;
    status: string;
    targetPreview: string;
    targetModerationStatus: string;
    reporterHandle: string;
    createdAt: string;
    resolvedAt: string | null;
  }> = [];

  if (canModerate) {
    const reportRows = await db
      .select()
      .from(reports)
      .orderBy(desc(reports.createdAt))
      .limit(40);
    const reporterMap = await loadAuthorLookup(reportRows.map((r) => r.reporterId));
    const postById = new Map(allPosts.map((p) => [p.id, p]));
    const commentById = new Map(allComments.map((c) => [c.id, c]));

    moderationQueue = reportRows.map((r) => {
      const post = r.postId ? postById.get(r.postId) : undefined;
      const comment = r.commentId ? commentById.get(r.commentId) : undefined;
      const targetPreview =
        r.targetType === 'post'
          ? post
            ? `${post.title} — ${post.body.slice(0, 110)}`
            : 'Removed post'
          : comment
            ? comment.body.slice(0, 120)
            : 'Removed comment';
      const targetModerationStatus =
        r.targetType === 'post'
          ? post?.moderationStatus ?? 'hidden'
          : comment?.moderationStatus ?? 'hidden';

      return {
        id: r.id,
        targetType: r.targetType as 'post' | 'comment',
        postId: r.postId,
        commentId: r.commentId,
        reason: r.reason,
        details: r.details,
        status: r.status,
        targetPreview,
        targetModerationStatus,
        reporterHandle: reporterMap.get(r.reporterId)?.displayHandle ?? `User #${r.reporterId}`,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      };
    });
  }

  return {
    groups: groups.map((g) => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      groupType: g.groupType as 'class' | 'subject' | 'entrance',
      academicLevel: g.academicLevel,
      subjectName: g.subjectName,
      description: g.description,
      memberCount: g.memberCount,
      postCount: postCountByGroup.get(g.id) ?? 0,
      unansweredCount: unansweredByGroup.get(g.id) ?? 0,
      isModerated: g.isModerated,
    })),
    posts: filteredPosts.map((p) => {
      const grp = groupMap.get(p.groupId);
      const comments = commentsByPostId.get(p.id) ?? [];
      return {
        id: p.id,
        groupId: p.groupId,
        groupSlug: grp?.slug ?? '',
        groupName: grp?.name ?? 'General Study Room',
        title: p.title,
        body: p.body,
        postType: p.postType as 'question' | 'explanation' | 'resource_tip',
        tags: p.tags ?? [],
        author:
          authorMap.get(p.authorId) ??
          formatYouthSafeCommunityAuthor({
            fullName: 'Scholar',
            roleSlugs: ['registered_student'],
            userId: p.authorId,
          }),
        upvoteCount: p.upvoteCount,
        commentCount: comments.length,
        isAnswered: p.isAnswered,
        hasTeacherVerified: p.hasTeacherVerified,
        userHasVoted: votedSet.has(`post:${p.id}`),
        moderationStatus: p.moderationStatus as 'active' | 'flagged' | 'hidden',
        createdAt: p.createdAt.toISOString(),
        comments: comments.map((c) => ({
          id: c.id,
          postId: c.postId,
          body: c.body,
          author:
            authorMap.get(c.authorId) ??
            formatYouthSafeCommunityAuthor({
              fullName: 'Scholar',
              roleSlugs: ['registered_student'],
              userId: c.authorId,
            }),
          isTeacherVerified: c.isTeacherVerified,
          verifiedByName: c.verifiedByName,
          verifiedAt: c.verifiedAt ? c.verifiedAt.toISOString() : null,
          upvoteCount: c.upvoteCount,
          userHasVoted: votedSet.has(`comment:${c.id}`),
          moderationStatus: c.moderationStatus as 'active' | 'flagged' | 'hidden',
          createdAt: c.createdAt.toISOString(),
        })),
      };
    }),
    canVerifyAnswers,
    canModerate,
    moderationQueue,
    youthSafetyRules: YOUTH_SAFETY_RULES,
  };
}

export async function createCommunityPost(params: {
  authorId: number;
  groupId: number;
  title: string;
  body: string;
  postType: 'question' | 'explanation' | 'resource_tip';
  tags: string[];
}) {
  await ensureSeeded();

  const [group] = await db
    .select()
    .from(discussionGroups)
    .where(eq(discussionGroups.id, params.groupId));
  if (!group) {
    throw new Error('Selected discussion group was not found.');
  }

  const safetyCheck = moderateCommunityText(`${params.title}\n${params.body}`);
  if (!safetyCheck.clean) {
    throw new Error(safetyCheck.blockedReason || 'Content rejected by Youth Safety filter.');
  }

  const safeTags = params.tags
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 32)
    .slice(0, 5);

  const [created] = await db
    .insert(discussionPosts)
    .values({
      groupId: group.id,
      authorId: params.authorId,
      title: params.title.trim(),
      body: params.body.trim(),
      postType: params.postType,
      tags: safeTags,
      upvoteCount: 0,
      commentCount: 0,
      isAnswered: false,
      hasTeacherVerified: false,
      moderationStatus: 'active',
    })
    .returning();

  return created;
}

export async function createCommunityComment(params: {
  authorId: number;
  postId: number;
  body: string;
}) {
  await ensureSeeded();

  const [post] = await db
    .select()
    .from(discussionPosts)
    .where(eq(discussionPosts.id, params.postId));
  if (!post || post.moderationStatus === 'hidden') {
    throw new Error('Discussion post was not found.');
  }

  const safetyCheck = moderateCommunityText(params.body);
  if (!safetyCheck.clean) {
    throw new Error(safetyCheck.blockedReason || 'Reply rejected by Youth Safety filter.');
  }

  const [comment] = await db
    .insert(discussionComments)
    .values({
      postId: post.id,
      authorId: params.authorId,
      body: params.body.trim(),
      isTeacherVerified: false,
      upvoteCount: 0,
      moderationStatus: 'active',
    })
    .returning();

  await db
    .update(discussionPosts)
    .set({
      commentCount: sql`${discussionPosts.commentCount} + 1`,
      isAnswered: true,
      updatedAt: new Date(),
    })
    .where(eq(discussionPosts.id, post.id));

  return comment;
}

export async function toggleCommunityVote(params: {
  userId: number;
  targetType: 'post' | 'comment';
  targetId: number;
}) {
  await ensureSeeded();
  const targetKey = `${params.targetType}:${params.targetId}`;

  const [existing] = await db
    .select()
    .from(postVotes)
    .where(and(eq(postVotes.userId, params.userId), eq(postVotes.targetKey, targetKey)));

  if (existing) {
    await db.delete(postVotes).where(eq(postVotes.id, existing.id));
    if (params.targetType === 'post') {
      const [updated] = await db
        .update(discussionPosts)
        .set({ upvoteCount: sql`GREATEST(0, ${discussionPosts.upvoteCount} - 1)` })
        .where(eq(discussionPosts.id, params.targetId))
        .returning({ upvoteCount: discussionPosts.upvoteCount });
      return { voted: false, upvoteCount: updated?.upvoteCount ?? 0 };
    } else {
      const [updated] = await db
        .update(discussionComments)
        .set({ upvoteCount: sql`GREATEST(0, ${discussionComments.upvoteCount} - 1)` })
        .where(eq(discussionComments.id, params.targetId))
        .returning({ upvoteCount: discussionComments.upvoteCount });
      return { voted: false, upvoteCount: updated?.upvoteCount ?? 0 };
    }
  }

  await db.insert(postVotes).values({
    userId: params.userId,
    targetType: params.targetType,
    targetKey,
    postId: params.targetType === 'post' ? params.targetId : null,
    commentId: params.targetType === 'comment' ? params.targetId : null,
    voteValue: 1,
  });

  if (params.targetType === 'post') {
    const [updated] = await db
      .update(discussionPosts)
      .set({ upvoteCount: sql`${discussionPosts.upvoteCount} + 1` })
      .where(eq(discussionPosts.id, params.targetId))
      .returning({ upvoteCount: discussionPosts.upvoteCount });
    return { voted: true, upvoteCount: updated?.upvoteCount ?? 1 };
  } else {
    const [updated] = await db
      .update(discussionComments)
      .set({ upvoteCount: sql`${discussionComments.upvoteCount} + 1` })
      .where(eq(discussionComments.id, params.targetId))
      .returning({ upvoteCount: discussionComments.upvoteCount });
    return { voted: true, upvoteCount: updated?.upvoteCount ?? 1 };
  }
}

export async function toggleTeacherVerifiedComment(params: {
  commentId: number;
  verifierId: number;
  verifierName: string;
  verified: boolean;
}) {
  await ensureSeeded();

  const [comment] = await db
    .select()
    .from(discussionComments)
    .where(eq(discussionComments.id, params.commentId));
  if (!comment) {
    return null;
  }

  const [updated] = await db
    .update(discussionComments)
    .set({
      isTeacherVerified: params.verified,
      verifiedById: params.verified ? params.verifierId : null,
      verifiedByName: params.verified ? params.verifierName : null,
      verifiedAt: params.verified ? new Date() : null,
    })
    .where(eq(discussionComments.id, comment.id))
    .returning();

  // Recompute post's hasTeacherVerified flag
  const allPostComments = await db
    .select({ isTeacherVerified: discussionComments.isTeacherVerified })
    .from(discussionComments)
    .where(eq(discussionComments.postId, comment.postId));
  const anyVerified = allPostComments.some((c) => c.isTeacherVerified);

  await db
    .update(discussionPosts)
    .set({
      hasTeacherVerified: anyVerified,
      isAnswered: anyVerified ? true : undefined,
      updatedAt: new Date(),
    })
    .where(eq(discussionPosts.id, comment.postId));

  return updated;
}

export async function submitCommunityReport(params: {
  reporterId: number;
  targetType: 'post' | 'comment';
  targetId: number;
  reason: string;
  details: string;
}) {
  await ensureSeeded();

  if (params.targetType === 'post') {
    const [post] = await db
      .select()
      .from(discussionPosts)
      .where(eq(discussionPosts.id, params.targetId));
    if (!post) throw new Error('Target post not found.');
    if (post.moderationStatus === 'active') {
      await db
        .update(discussionPosts)
        .set({ moderationStatus: 'flagged' })
        .where(eq(discussionPosts.id, post.id));
    }
  } else {
    const [comment] = await db
      .select()
      .from(discussionComments)
      .where(eq(discussionComments.id, params.targetId));
    if (!comment) throw new Error('Target reply not found.');
    if (comment.moderationStatus === 'active') {
      await db
        .update(discussionComments)
        .set({ moderationStatus: 'flagged' })
        .where(eq(discussionComments.id, comment.id));
    }
  }

  const [report] = await db
    .insert(reports)
    .values({
      reporterId: params.reporterId,
      targetType: params.targetType,
      postId: params.targetType === 'post' ? params.targetId : null,
      commentId: params.targetType === 'comment' ? params.targetId : null,
      reason: params.reason,
      details: params.details.trim().slice(0, 400),
      status: 'open',
    })
    .returning();

  return report;
}

export async function resolveCommunityModeration(params: {
  reportId?: number;
  moderatorId: number;
  targetType: 'post' | 'comment';
  targetId: number;
  actionType: 'approve' | 'hide' | 'restore' | 'dismiss_report';
  reasonNotes: string;
}) {
  await ensureSeeded();

  const nextModStatus =
    params.actionType === 'hide'
      ? 'hidden'
      : params.actionType === 'approve' || params.actionType === 'restore' || params.actionType === 'dismiss_report'
        ? 'active'
        : 'active';

  if (params.targetType === 'post') {
    await db
      .update(discussionPosts)
      .set({ moderationStatus: nextModStatus, updatedAt: new Date() })
      .where(eq(discussionPosts.id, params.targetId));
  } else {
    await db
      .update(discussionComments)
      .set({ moderationStatus: nextModStatus })
      .where(eq(discussionComments.id, params.targetId));
  }

  if (params.reportId) {
    await db
      .update(reports)
      .set({
        status: params.actionType === 'dismiss_report' ? 'dismissed' : 'action_taken',
        resolvedAt: new Date(),
      })
      .where(eq(reports.id, params.reportId));
  }

  const [action] = await db
    .insert(moderationActions)
    .values({
      reportId: params.reportId ?? null,
      moderatorId: params.moderatorId,
      targetType: params.targetType,
      targetId: params.targetId,
      actionType: params.actionType,
      reasonNotes: params.reasonNotes.trim().slice(0, 400),
    })
    .returning();

  return action;
}

export async function getStudentWeakTopicsForPlanner(userId: number) {
  await ensureSeeded();
  const [goalRows, progressRows] = await Promise.all([
    db.select().from(studentGoals).where(eq(studentGoals.userId, userId)).limit(1),
    db
      .select()
      .from(learningProgress)
      .where(eq(learningProgress.userId, userId))
      .orderBy(asc(learningProgress.accuracyPercent)),
  ]);

  const weakTopics = progressRows
    .filter((r) => r.isWeak || r.accuracyPercent < 60)
    .slice(0, 8)
    .map((r) => ({
      subjectName: r.subjectName,
      chapterName: r.chapterName,
      topicName: r.topicName,
      accuracyPercent: Math.round(r.accuracyPercent),
    }));

  return {
    goal: goalRows[0] ?? null,
    weakTopics,
  };
}

export async function saveAiGeneratedStudyPlan(params: {
  userId: number;
  title: string;
  goalFocus: string;
  subjectName: string;
  gradeCode: string;
  startDate: string;
  endDate: string;
  tasks: Array<{
    title: string;
    taskType: 'chapter_study' | 'revision' | 'practice' | 'mock_test';
    subjectName: string;
    chapterName: string;
    scheduledDate: string;
    estimatedMinutes: number;
  }>;
}) {
  await ensureSeeded();

  const [plan] = await db
    .insert(studyPlans)
    .values({
      userId: params.userId,
      title: params.title.trim().slice(0, 140),
      goalFocus: params.goalFocus.trim().slice(0, 140),
      subjectName: params.subjectName.trim().slice(0, 100),
      gradeCode: params.gradeCode.trim().slice(0, 20),
      startDate: params.startDate,
      endDate: params.endDate,
      status: 'active',
    })
    .returning();

  const insertedTasks =
    params.tasks.length > 0
      ? await db
          .insert(studyTasks)
          .values(
            params.tasks.map((t) => ({
              planId: plan.id,
              userId: params.userId,
              title: t.title.trim().slice(0, 180),
              taskType: t.taskType,
              subjectName: t.subjectName.trim().slice(0, 80),
              chapterName: t.chapterName ? t.chapterName.trim().slice(0, 120) : null,
              scheduledDate: t.scheduledDate,
              estimatedMinutes: Math.max(15, Math.min(240, Math.round(t.estimatedMinutes))),
              isCompleted: false,
            })),
          )
          .returning()
      : [];

  return { plan, tasks: insertedTasks };
}

export async function getVerifiedExplorerGroundingSnapshot() {
  await ensureSeeded();
  const [courseRows, collegeRows, examRows, scholarshipRows, careerRows] = await Promise.all([
    db.select().from(courses).orderBy(asc(courses.id)),
    db.select().from(colleges).orderBy(asc(colleges.id)),
    db.select().from(entranceExams).orderBy(asc(entranceExams.id)),
    db.select().from(scholarships).orderBy(asc(scholarships.id)),
    db.select().from(careerPaths).orderBy(asc(careerPaths.id)),
  ]);

  return {
    courses: courseRows,
    colleges: collegeRows,
    entranceExams: examRows,
    scholarships: scholarshipRows,
    careerPaths: careerRows,
  };
}
