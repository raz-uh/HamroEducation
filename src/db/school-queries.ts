import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db } from './index.ts';
import {
  bookmarks,
  chapters,
  contentReviews,
  curricula,
  educationLevels,
  grades,
  personalNotes,
  resourceCategories,
  resourceTags,
  resourceVersions,
  resources,
  streams,
  subjects,
  topics,
  type ChapterContentPayload,
} from './schema.ts';
import { ensureSeeded } from './seed.ts';
import { canStudentViewResourceStatus, normalizeGradeSlug } from '../lib/router.ts';

async function resolveNepalGradeBySlug(gradeSlug: string) {
  const gradeCode = normalizeGradeSlug(gradeSlug);
  const [cdc] = await db
    .select()
    .from(curricula)
    .where(eq(curricula.code, 'NP-CDC-NEB'))
    .limit(1);
  if (!cdc) return null;

  const lvls = await db
    .select()
    .from(educationLevels)
    .where(eq(educationLevels.curriculumId, cdc.id));
  const levelIds = lvls.map((l) => l.id);

  const allGrades = await db.select().from(grades);
  const matching = allGrades.find(
    (g) => levelIds.includes(g.educationLevelId) && g.code === gradeCode,
  );
  return matching ?? null;
}

export async function getSchoolGradeOverview(
  gradeSlug: string,
  userPermissions: string[],
) {
  try {
    await ensureSeeded();
    const gradeRow = await resolveNepalGradeBySlug(gradeSlug);
    if (!gradeRow) return null;

    const gradeStreams = await db
      .select()
      .from(streams)
      .where(eq(streams.gradeId, gradeRow.id))
      .orderBy(asc(streams.sortOrder));

    const allSubjects = await db.select().from(subjects).orderBy(asc(subjects.sortOrder));
    const allChapters = await db
      .select()
      .from(chapters)
      .orderBy(asc(chapters.chapterNumber));
    const allTopics = await db.select().from(topics).orderBy(asc(topics.topicNumber));
    const categories = await db
      .select()
      .from(resourceCategories)
      .orderBy(asc(resourceCategories.sortOrder));

    const gradeResourcesRaw = await db
      .select()
      .from(resources)
      .where(eq(resources.gradeId, gradeRow.id))
      .orderBy(desc(resources.publishedAt), asc(resources.id));

    // Enforce published visibility boundary
    const visibleResources = gradeResourcesRaw.filter((r) =>
      canStudentViewResourceStatus(r.status, userPermissions),
    );

    const catMap = new Map(categories.map((c) => [c.id, c]));

    const structuredStreams = gradeStreams.map((stream) => {
      const streamSubjects = allSubjects
        .filter((s) => s.streamId === stream.id)
        .map((sub) => {
          const subChapters = allChapters
            .filter((ch) => ch.subjectId === sub.id)
            .map((ch) => {
              const chTopics = allTopics.filter((t) => t.chapterId === ch.id);
              const chResources = visibleResources.filter((r) => r.chapterId === ch.id);
              return {
                ...ch,
                topicCount: chTopics.length,
                publishedResourceCount: chResources.filter((r) => r.status === 'published').length,
                resources: chResources.map((r) => ({
                  ...r,
                  category: catMap.get(r.categoryId) ?? null,
                })),
              };
            });

          return {
            ...sub,
            chapters: subChapters,
          };
        });

      return {
        ...stream,
        subjects: streamSubjects,
      };
    });

    return {
      grade: gradeRow,
      gradeSlug: gradeSlug.toLowerCase(),
      streams: structuredStreams,
      categories,
      resources: visibleResources.map((r) => ({
        ...r,
        category: catMap.get(r.categoryId) ?? null,
      })),
    };
  } catch (error) {
    console.error('Failed to load school grade overview:', error);
    throw new Error('Failed to load school curriculum overview.', { cause: error });
  }
}

export async function getChapterLearningBundle(params: {
  gradeSlug: string;
  subjectCode: string;
  chapterKey: string;
  userId: number | null;
  userPermissions: string[];
}) {
  try {
    await ensureSeeded();
    const gradeRow = await resolveNepalGradeBySlug(params.gradeSlug);
    if (!gradeRow) return null;

    const gradeStreams = await db
      .select()
      .from(streams)
      .where(eq(streams.gradeId, gradeRow.id));
    const streamIds = gradeStreams.map((s) => s.id);

    const allSubjects = await db.select().from(subjects);
    const subjectRow = allSubjects.find(
      (s) =>
        streamIds.includes(s.streamId) &&
        s.code.toUpperCase() === params.subjectCode.toUpperCase(),
    );
    if (!subjectRow) return null;

    const streamRow = gradeStreams.find((s) => s.id === subjectRow.streamId) ?? null;

    const subjectChapters = await db
      .select()
      .from(chapters)
      .where(eq(chapters.subjectId, subjectRow.id))
      .orderBy(asc(chapters.chapterNumber));

    const numericKey = Number(params.chapterKey);
    const chapterRow =
      subjectChapters.find((c) => c.chapterNumber === numericKey) ??
      subjectChapters.find((c) => c.id === numericKey) ??
      subjectChapters[0];
    if (!chapterRow) return null;

    const chapterTopics = await db
      .select()
      .from(topics)
      .where(eq(topics.chapterId, chapterRow.id))
      .orderBy(asc(topics.topicNumber));

    const categories = await db
      .select()
      .from(resourceCategories)
      .orderBy(asc(resourceCategories.sortOrder));
    const catMap = new Map(categories.map((c) => [c.id, c]));

    const rawResources = await db
      .select()
      .from(resources)
      .where(eq(resources.chapterId, chapterRow.id))
      .orderBy(asc(resources.id));

    // Strictly hide draft / in_review items from students & guests
    const visibleResources = rawResources.filter((r) =>
      canStudentViewResourceStatus(r.status, params.userPermissions),
    );

    const enrichedResources = await Promise.all(
      visibleResources.map(async (resRow) => {
        const [latestVersion] = await db
          .select()
          .from(resourceVersions)
          .where(
            and(
              eq(resourceVersions.resourceId, resRow.id),
              eq(resourceVersions.versionNumber, resRow.currentVersion),
            ),
          )
          .limit(1);

        const tags = await db
          .select()
          .from(resourceTags)
          .where(eq(resourceTags.resourceId, resRow.id));

        const reviews = await db
          .select()
          .from(contentReviews)
          .where(eq(contentReviews.resourceId, resRow.id))
          .orderBy(desc(contentReviews.reviewedAt));

        return {
          ...resRow,
          category: catMap.get(resRow.categoryId) ?? null,
          latestVersion: latestVersion ?? null,
          tags,
          reviews,
        };
      }),
    );

    let userBookmarks: Array<typeof bookmarks.$inferSelect> = [];
    let userNotes: Array<typeof personalNotes.$inferSelect> = [];

    if (params.userId) {
      userBookmarks = await db
        .select()
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, params.userId),
            eq(bookmarks.chapterId, chapterRow.id),
          ),
        );
      userNotes = await db
        .select()
        .from(personalNotes)
        .where(
          and(
            eq(personalNotes.userId, params.userId),
            eq(personalNotes.chapterId, chapterRow.id),
          ),
        )
        .orderBy(desc(personalNotes.createdAt));
    }

    return {
      grade: gradeRow,
      stream: streamRow,
      subject: subjectRow,
      chapter: chapterRow,
      siblingChapters: subjectChapters,
      topics: chapterTopics,
      resources: enrichedResources,
      bookmarks: userBookmarks,
      personalNotes: userNotes,
    };
  } catch (error) {
    console.error('Failed to load chapter learning bundle:', error);
    throw new Error('Failed to load chapter reader content.', { cause: error });
  }
}

export async function getUserBookmarks(userId: number) {
  try {
    await ensureSeeded();
    return await db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt));
  } catch (error) {
    console.error('Failed to load user bookmarks:', error);
    throw new Error('Failed to load bookmarks.', { cause: error });
  }
}

export async function toggleUserBookmark(
  userId: number,
  input: {
    gradeId: number;
    subjectId: number;
    chapterId: number;
    resourceId?: number | null;
    bookmarkType?: string;
    title: string;
  },
) {
  try {
    await ensureSeeded();
    const resId = input.resourceId ?? null;
    const existing = await db
      .select()
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, userId),
          eq(bookmarks.chapterId, input.chapterId),
          resId === null
            ? isNull(bookmarks.resourceId)
            : eq(bookmarks.resourceId, resId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await db.delete(bookmarks).where(eq(bookmarks.id, existing[0].id));
      return { bookmarked: false, bookmark: null };
    }

    const [created] = await db
      .insert(bookmarks)
      .values({
        userId,
        gradeId: input.gradeId,
        subjectId: input.subjectId,
        chapterId: input.chapterId,
        resourceId: resId,
        bookmarkType: input.bookmarkType ?? (resId ? 'resource' : 'chapter'),
        title: input.title.trim().slice(0, 160),
      })
      .returning();

    return { bookmarked: true, bookmark: created };
  } catch (error) {
    console.error('Failed to toggle bookmark:', error);
    throw new Error('Failed to update bookmark.', { cause: error });
  }
}

export async function deleteUserBookmark(userId: number, bookmarkId: number) {
  try {
    const deleted = await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
      .returning();
    return deleted[0] ?? null;
  } catch (error) {
    console.error('Failed to delete bookmark:', error);
    throw new Error('Failed to remove bookmark.', { cause: error });
  }
}

export async function getUserPersonalNotes(userId: number, chapterId?: number) {
  try {
    await ensureSeeded();
    if (chapterId) {
      return await db
        .select()
        .from(personalNotes)
        .where(
          and(
            eq(personalNotes.userId, userId),
            eq(personalNotes.chapterId, chapterId),
          ),
        )
        .orderBy(desc(personalNotes.createdAt));
    }
    return await db
      .select()
      .from(personalNotes)
      .where(eq(personalNotes.userId, userId))
      .orderBy(desc(personalNotes.createdAt));
  } catch (error) {
    console.error('Failed to fetch personal notes:', error);
    throw new Error('Failed to load personal study notes.', { cause: error });
  }
}

export async function createUserPersonalNote(
  userId: number,
  input: {
    chapterId: number;
    resourceId?: number | null;
    title: string;
    highlightText?: string | null;
    noteBody: string;
    languageCode?: string;
  },
) {
  try {
    await ensureSeeded();
    const [created] = await db
      .insert(personalNotes)
      .values({
        userId,
        chapterId: input.chapterId,
        resourceId: input.resourceId ?? null,
        title: input.title.trim().slice(0, 140),
        highlightText: input.highlightText?.trim().slice(0, 400) || null,
        noteBody: input.noteBody.trim().slice(0, 2000),
        languageCode: input.languageCode === 'ne' ? 'ne' : 'en',
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Failed to create personal note:', error);
    throw new Error('Failed to save personal note.', { cause: error });
  }
}

export async function deleteUserPersonalNote(userId: number, noteId: number) {
  try {
    const deleted = await db
      .delete(personalNotes)
      .where(and(eq(personalNotes.id, noteId), eq(personalNotes.userId, userId)))
      .returning();
    return deleted[0] ?? null;
  } catch (error) {
    console.error('Failed to delete personal note:', error);
    throw new Error('Failed to delete personal note.', { cause: error });
  }
}

export async function createSchoolResource(
  userId: number,
  canPublishDirectly: boolean,
  input: {
    categorySlug: string;
    gradeId: number;
    streamId?: number | null;
    subjectId: number;
    chapterId?: number | null;
    title: string;
    summary: string;
    resourceType: string;
    contentEn: ChapterContentPayload;
    tags?: string[];
  },
) {
  try {
    await ensureSeeded();
    const [cat] = await db
      .select()
      .from(resourceCategories)
      .where(eq(resourceCategories.slug, input.categorySlug))
      .limit(1);
    if (!cat) {
      throw new Error('Invalid resource category.');
    }

    const slug = `${input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}-${Date.now()}`;

    const initialStatus = canPublishDirectly ? 'published' : 'in_review';
    const [created] = await db
      .insert(resources)
      .values({
        slug,
        categoryId: cat.id,
        gradeId: input.gradeId,
        streamId: input.streamId ?? null,
        subjectId: input.subjectId,
        chapterId: input.chapterId ?? null,
        title: input.title.trim().slice(0, 160),
        summary: input.summary.trim().slice(0, 500),
        resourceType: input.resourceType || cat.slug,
        status: initialStatus,
        currentVersion: 1,
        createdBy: userId,
        publishedAt: initialStatus === 'published' ? new Date() : null,
      })
      .returning();

    await db.insert(resourceVersions).values({
      resourceId: created.id,
      versionNumber: 1,
      contentEn: input.contentEn,
      changelog: 'Initial submission',
      createdBy: userId,
    });

    if (input.tags?.length) {
      await db
        .insert(resourceTags)
        .values(
          input.tags.slice(0, 6).map((tag) => ({
            resourceId: created.id,
            slug: tag.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
            label: tag.trim().slice(0, 40),
          })),
        )
        .onConflictDoNothing();
    }

    return created;
  } catch (error) {
    console.error('Failed to create school resource:', error);
    throw new Error('Failed to create learning resource.', { cause: error });
  }
}

export async function reviewSchoolResource(params: {
  reviewerId: number;
  resourceId: number;
  decision: 'approved' | 'changes_requested';
  comments: string;
}) {
  try {
    await ensureSeeded();
    const [resRow] = await db
      .select()
      .from(resources)
      .where(eq(resources.id, params.resourceId))
      .limit(1);
    if (!resRow) return null;

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
      reviewerId: params.reviewerId,
      decision: params.decision,
      comments: params.comments.trim().slice(0, 500) || 'Reviewed.',
    });

    const nextStatus = params.decision === 'approved' ? 'published' : 'draft';
    const [updated] = await db
      .update(resources)
      .set({
        status: nextStatus,
        publishedAt: nextStatus === 'published' ? new Date() : resRow.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(resources.id, resRow.id))
      .returning();

    return updated;
  } catch (error) {
    console.error('Failed to review school resource:', error);
    throw new Error('Failed to record content review.', { cause: error });
  }
}
