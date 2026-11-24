import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  achievements,
  applicationDeadlines,
  attemptAnswers,
  attemptEvents,
  auditLogs,
  bookmarks,
  careerPaths,
  chapters,
  colleges,
  contentReviews,
  contentSources,
  countries,
  courseColleges,
  courses,
  curricula,
  discussionComments,
  discussionGroups,
  discussionPosts,
  educationLevels,
  entranceExams,
  examAttempts,
  examQuestions,
  examResults,
  examSections,
  exams,
  flashcards,
  grades,
  institutions,
  languages,
  learningProgress,
  mistakeBook,
  moderationActions,
  notifications,
  opportunities,
  permissions,
  personalNotes,
  postVotes,
  profiles,
  questionAnswers,
  questionExplanations,
  questionOptions,
  questionSources,
  questionTags,
  questionVersions,
  questions,
  reports,
  resourceCategories,
  resourceTags,
  resourceVersions,
  resources,
  rolePermissions,
  roles,
  scholarships,
  streams,
  studentGoals,
  studyPlans,
  studyTasks,
  subjects,
  systemSettings,
  topics,
  universities,
  userRoles,
  users,
} from './schema.ts';
import { ensureSeeded } from './seed.ts';

export interface HydratedUserContext {
  id: number;
  uid: string;
  email: string;
  authProvider: string;
  status: string;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  profile: {
    fullName: string;
    displayName: string | null;
    countryId: number | null;
    preferredLanguageId: number | null;
    institutionId: number | null;
    gradeLevel: string | null;
    bio: string | null;
  } | null;
  roles: Array<{
    assignmentId: number;
    roleId: number;
    slug: string;
    name: string;
    hierarchyTier: number;
    scopeType: string;
    institutionId: number | null;
    institutionName: string | null;
    countryId: number | null;
  }>;
  permissions: string[];
  institutionIds: number[];
}

export async function getUserWithRbacById(userId: number): Promise<HydratedUserContext | null> {
  try {
    await ensureSeeded();
    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const userRow = userRows[0];
    if (!userRow) return null;

    const profileRows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userRow.id))
      .limit(1);

    const assignedRoleRows = await db
      .select({
        assignmentId: userRoles.id,
        roleId: roles.id,
        slug: roles.slug,
        name: roles.name,
        hierarchyTier: roles.hierarchyTier,
        scopeType: roles.scopeType,
        institutionId: userRoles.institutionId,
        institutionName: institutions.name,
        countryId: userRoles.countryId,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .leftJoin(institutions, eq(userRoles.institutionId, institutions.id))
      .where(and(eq(userRoles.userId, userRow.id), eq(userRoles.isActive, true)))
      .orderBy(desc(roles.hierarchyTier));

    const roleIds = assignedRoleRows.map((r) => r.roleId);
    const permCodes = new Set<string>();

    if (roleIds.length > 0) {
      const rolePermRows = await db
        .select({
          roleId: rolePermissions.roleId,
          code: permissions.code,
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id));

      for (const row of rolePermRows) {
        if (roleIds.includes(row.roleId)) {
          permCodes.add(row.code);
        }
      }
    }

    const institutionIds = Array.from(
      new Set(
        assignedRoleRows
          .map((r) => r.institutionId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    );

    return {
      id: userRow.id,
      uid: userRow.uid,
      email: userRow.email,
      authProvider: userRow.authProvider,
      status: userRow.status,
      emailVerified: userRow.emailVerified,
      lastLoginAt: userRow.lastLoginAt,
      createdAt: userRow.createdAt,
      profile: profileRows[0]
        ? {
            fullName: profileRows[0].fullName,
            displayName: profileRows[0].displayName,
            countryId: profileRows[0].countryId,
            preferredLanguageId: profileRows[0].preferredLanguageId,
            institutionId: profileRows[0].institutionId,
            gradeLevel: profileRows[0].gradeLevel,
            bio: profileRows[0].bio,
          }
        : null,
      roles: assignedRoleRows,
      permissions: Array.from(permCodes),
      institutionIds,
    };
  } catch (error) {
    console.error('Failed to load user RBAC context:', error);
    throw new Error('Failed to retrieve user access context.', { cause: error });
  }
}

export async function getUserByEmail(email: string) {
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to query user by email:', error);
    throw new Error('Database lookup failed.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    await ensureSeeded();
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to query user by UID:', error);
    throw new Error('Database lookup failed.', { cause: error });
  }
}

export async function ensureRoleAssigned(params: {
  userId: number;
  roleSlug: string;
  institutionId?: number | null;
  countryId?: number | null;
  assignedBy?: number | null;
}) {
  try {
    await ensureSeeded();
    const roleRows = await db
      .select()
      .from(roles)
      .where(eq(roles.slug, params.roleSlug))
      .limit(1);
    const roleRow = roleRows[0];
    if (!roleRow) {
      throw new Error(`Role '${params.roleSlug}' does not exist.`);
    }

    const instId = params.institutionId ?? null;
    const existing = await db
      .select()
      .from(userRoles)
      .where(
        and(
          eq(userRoles.userId, params.userId),
          eq(userRoles.roleId, roleRow.id),
          instId === null ? isNull(userRoles.institutionId) : eq(userRoles.institutionId, instId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      if (!existing[0].isActive) {
        await db
          .update(userRoles)
          .set({ isActive: true, assignedBy: params.assignedBy ?? null })
          .where(eq(userRoles.id, existing[0].id));
      }
      return existing[0];
    }

    const [created] = await db
      .insert(userRoles)
      .values({
        userId: params.userId,
        roleId: roleRow.id,
        institutionId: instId,
        countryId: params.countryId ?? null,
        assignedBy: params.assignedBy ?? null,
        isActive: true,
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Failed to assign role:', error);
    throw new Error('Failed to update role assignment.', { cause: error });
  }
}

export async function hasAnySuperAdmin(): Promise<boolean> {
  try {
    await ensureSeeded();
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(roles.slug, 'super_administrator'), eq(userRoles.isActive, true)));
    return (rows[0]?.count ?? 0) > 0;
  } catch (error) {
    console.error('Failed to check super admin existence:', error);
    throw new Error('Failed to verify system bootstrap status.', { cause: error });
  }
}

export async function upsertGoogleUser(params: {
  uid: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
  avatarUrl?: string | null;
  grantSuperAdmin: boolean;
}): Promise<HydratedUserContext> {
  try {
    await ensureSeeded();
    const normalizedEmail = params.email.trim().toLowerCase();

    const [nepal] = await db
      .select()
      .from(countries)
      .where(eq(countries.isoCode, 'NP'))
      .limit(1);

    const existingByUid = await db
      .select()
      .from(users)
      .where(eq(users.uid, params.uid))
      .limit(1);

    let userRow = existingByUid[0];

    if (!userRow) {
      const existingByEmail = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existingByEmail[0]) {
        const [updated] = await db
          .update(users)
          .set({
            uid: params.uid,
            emailVerified: params.emailVerified || existingByEmail[0].emailVerified,
            lastLoginAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingByEmail[0].id))
          .returning();
        userRow = updated;
      } else {
        const [inserted] = await db
          .insert(users)
          .values({
            uid: params.uid,
            email: normalizedEmail,
            authProvider: 'google',
            emailVerified: params.emailVerified,
            lastLoginAt: new Date(),
          })
          .onConflictDoUpdate({
            target: users.uid,
            set: {
              email: normalizedEmail,
              emailVerified: params.emailVerified,
              lastLoginAt: new Date(),
              updatedAt: new Date(),
            },
          })
          .returning();
        userRow = inserted;
      }
    } else {
      const [updated] = await db
        .update(users)
        .set({
          email: normalizedEmail,
          emailVerified: params.emailVerified || userRow.emailVerified,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userRow.id))
        .returning();
      userRow = updated;
    }

    await db
      .insert(profiles)
      .values({
        userId: userRow.id,
        fullName: params.fullName || normalizedEmail.split('@')[0],
        displayName: params.fullName || normalizedEmail.split('@')[0],
        countryId: nepal?.id ?? null,
        avatarUrl: params.avatarUrl ?? null,
      })
      .onConflictDoNothing({ target: profiles.userId });

    await ensureRoleAssigned({
      userId: userRow.id,
      roleSlug: 'registered_student',
      countryId: nepal?.id ?? null,
    });

    if (params.grantSuperAdmin) {
      await ensureRoleAssigned({
        userId: userRow.id,
        roleSlug: 'super_administrator',
        countryId: nepal?.id ?? null,
      });
    }

    const hydrated = await getUserWithRbacById(userRow.id);
    if (!hydrated) {
      throw new Error('Failed to load newly synchronized user.');
    }
    return hydrated;
  } catch (error) {
    console.error('Failed to upsert Google user:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function createEmailUser(params: {
  uid: string;
  email: string;
  passwordHash: string;
  fullName: string;
  countryId?: number | null;
  roleSlug?: string;
}): Promise<HydratedUserContext> {
  try {
    await ensureSeeded();
    const normalizedEmail = params.email.trim().toLowerCase();

    let resolvedCountryId = params.countryId ?? null;
    if (!resolvedCountryId) {
      const [nepal] = await db
        .select()
        .from(countries)
        .where(eq(countries.isoCode, 'NP'))
        .limit(1);
      resolvedCountryId = nepal?.id ?? null;
    }

    const [userRow] = await db
      .insert(users)
      .values({
        uid: params.uid,
        email: normalizedEmail,
        passwordHash: params.passwordHash,
        authProvider: 'email',
        emailVerified: false,
        lastLoginAt: new Date(),
      })
      .returning();

    await db.insert(profiles).values({
      userId: userRow.id,
      fullName: params.fullName.trim(),
      displayName: params.fullName.trim(),
      countryId: resolvedCountryId,
    });

    await ensureRoleAssigned({
      userId: userRow.id,
      roleSlug: params.roleSlug ?? 'registered_student',
      countryId: resolvedCountryId,
    });

    const hydrated = await getUserWithRbacById(userRow.id);
    if (!hydrated) {
      throw new Error('Failed to hydrate created user.');
    }
    return hydrated;
  } catch (error) {
    console.error('Failed to create email user:', error);
    throw new Error('Failed to register account.', { cause: error });
  }
}

export async function getCurriculumHierarchyTree(countryIso?: string) {
  try {
    await ensureSeeded();

    const allCountries = await db
      .select()
      .from(countries)
      .orderBy(desc(countries.isPrimary), asc(countries.name));

    const targetCountry = countryIso
      ? allCountries.find((c) => c.isoCode.toUpperCase() === countryIso.toUpperCase()) ?? allCountries[0]
      : allCountries[0];

    if (!targetCountry) {
      return {
        countries: [],
        activeCountry: null,
        languages: [],
        curricula: [],
      };
    }

    const countryLanguages = await db
      .select()
      .from(languages)
      .where(eq(languages.countryId, targetCountry.id))
      .orderBy(desc(languages.isDefault), asc(languages.name));

    const countryCurricula = await db
      .select()
      .from(curricula)
      .where(eq(curricula.countryId, targetCountry.id))
      .orderBy(asc(curricula.id));

    const allLevels = await db.select().from(educationLevels).orderBy(asc(educationLevels.sortOrder));
    const allGrades = await db.select().from(grades).orderBy(asc(grades.sortOrder));
    const allStreams = await db.select().from(streams).orderBy(asc(streams.sortOrder));
    const allSubjects = await db.select().from(subjects).orderBy(asc(subjects.sortOrder));
    const allChapters = await db.select().from(chapters).orderBy(asc(chapters.chapterNumber));
    const allTopics = await db.select().from(topics).orderBy(asc(topics.topicNumber));

    const languageMap = new Map(countryLanguages.map((l) => [l.id, l]));

    const structuredCurricula = countryCurricula.map((cur) => {
      const levelsForCur = allLevels
        .filter((lvl) => lvl.curriculumId === cur.id)
        .map((lvl) => {
          const gradesForLvl = allGrades
            .filter((g) => g.educationLevelId === lvl.id)
            .map((g) => {
              const streamsForGrade = allStreams
                .filter((st) => st.gradeId === g.id)
                .map((st) => {
                  const subjectsForStream = allSubjects
                    .filter((sub) => sub.streamId === st.id)
                    .map((sub) => {
                      const chaptersForSubject = allChapters
                        .filter((ch) => ch.subjectId === sub.id)
                        .map((ch) => ({
                          ...ch,
                          topics: allTopics.filter((t) => t.chapterId === ch.id),
                        }));
                      return {
                        ...sub,
                        language: sub.languageId ? languageMap.get(sub.languageId) ?? null : null,
                        chapters: chaptersForSubject,
                      };
                    });
                  return {
                    ...st,
                    subjects: subjectsForStream,
                  };
                });
              return {
                ...g,
                streams: streamsForGrade,
              };
            });
          return {
            ...lvl,
            grades: gradesForLvl,
          };
        });

      return {
        ...cur,
        language: languageMap.get(cur.languageId) ?? null,
        educationLevels: levelsForCur,
      };
    });

    return {
      countries: allCountries,
      activeCountry: targetCountry,
      languages: countryLanguages,
      curricula: structuredCurricula,
    };
  } catch (error) {
    console.error('Failed to load curriculum hierarchy:', error);
    throw new Error('Failed to load country curriculum hierarchy.', { cause: error });
  }
}

export async function getRbacDirectory() {
  try {
    await ensureSeeded();

    const allRoles = await db
      .select()
      .from(roles)
      .orderBy(desc(roles.hierarchyTier));
    const allPerms = await db.select().from(permissions).orderBy(asc(permissions.id));
    const allRolePerms = await db.select().from(rolePermissions);

    const permMap = new Map(allPerms.map((p) => [p.id, p]));

    const rolesWithPermissions = allRoles.map((role) => {
      const permsForRole = allRolePerms
        .filter((rp) => rp.roleId === role.id)
        .map((rp) => permMap.get(rp.permissionId))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));
      return {
        ...role,
        permissions: permsForRole,
      };
    });

    return {
      roles: rolesWithPermissions,
      permissions: allPerms,
    };
  } catch (error) {
    console.error('Failed to load RBAC directory:', error);
    throw new Error('Failed to load roles and permissions.', { cause: error });
  }
}

export async function getInstitutionsList(countryId?: number) {
  try {
    await ensureSeeded();
    const allCountries = await db.select().from(countries);
    const countryMap = new Map(allCountries.map((c) => [c.id, c]));

    const rows = countryId
      ? await db
          .select()
          .from(institutions)
          .where(eq(institutions.countryId, countryId))
          .orderBy(asc(institutions.name))
      : await db.select().from(institutions).orderBy(asc(institutions.name));

    return rows.map((inst) => ({
      ...inst,
      country: countryMap.get(inst.countryId) ?? null,
    }));
  } catch (error) {
    console.error('Failed to load institutions:', error);
    throw new Error('Failed to load institutions directory.', { cause: error });
  }
}

export async function getUsersDirectory() {
  try {
    await ensureSeeded();
    const userRows = await db.select().from(users).orderBy(desc(users.createdAt));
    const profileRows = await db.select().from(profiles);
    const roleAssignments = await db
      .select({
        assignmentId: userRoles.id,
        userId: userRoles.userId,
        roleSlug: roles.slug,
        roleName: roles.name,
        hierarchyTier: roles.hierarchyTier,
        institutionId: userRoles.institutionId,
        institutionName: institutions.name,
        isActive: userRoles.isActive,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .leftJoin(institutions, eq(userRoles.institutionId, institutions.id))
      .where(eq(userRoles.isActive, true));

    const profileMap = new Map(profileRows.map((p) => [p.userId, p]));

    return userRows.map((u) => {
      const prof = profileMap.get(u.id);
      const assigned = roleAssignments.filter((ra) => ra.userId === u.id);
      return {
        id: u.id,
        email: u.email,
        authProvider: u.authProvider,
        status: u.status,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        fullName: prof?.fullName ?? u.email.split('@')[0],
        countryId: prof?.countryId ?? null,
        institutionId: prof?.institutionId ?? null,
        roles: assigned,
      };
    });
  } catch (error) {
    console.error('Failed to load users directory:', error);
    throw new Error('Failed to load users directory.', { cause: error });
  }
}

export async function getSchemaCounts() {
  try {
    await ensureSeeded();
    const tableQueries = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(countries),
      db.select({ count: sql<number>`count(*)::int` }).from(languages),
      db.select({ count: sql<number>`count(*)::int` }).from(curricula),
      db.select({ count: sql<number>`count(*)::int` }).from(educationLevels),
      db.select({ count: sql<number>`count(*)::int` }).from(grades),
      db.select({ count: sql<number>`count(*)::int` }).from(streams),
      db.select({ count: sql<number>`count(*)::int` }).from(subjects),
      db.select({ count: sql<number>`count(*)::int` }).from(chapters),
      db.select({ count: sql<number>`count(*)::int` }).from(topics),
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(profiles),
      db.select({ count: sql<number>`count(*)::int` }).from(roles),
      db.select({ count: sql<number>`count(*)::int` }).from(permissions),
      db.select({ count: sql<number>`count(*)::int` }).from(rolePermissions),
      db.select({ count: sql<number>`count(*)::int` }).from(userRoles),
      db.select({ count: sql<number>`count(*)::int` }).from(institutions),
      db.select({ count: sql<number>`count(*)::int` }).from(resourceCategories),
      db.select({ count: sql<number>`count(*)::int` }).from(resources),
      db.select({ count: sql<number>`count(*)::int` }).from(resourceVersions),
      db.select({ count: sql<number>`count(*)::int` }).from(contentReviews),
      db.select({ count: sql<number>`count(*)::int` }).from(resourceTags),
      db.select({ count: sql<number>`count(*)::int` }).from(bookmarks),
      db.select({ count: sql<number>`count(*)::int` }).from(personalNotes),
      db.select({ count: sql<number>`count(*)::int` }).from(questionSources),
      db.select({ count: sql<number>`count(*)::int` }).from(questions),
      db.select({ count: sql<number>`count(*)::int` }).from(questionOptions),
      db.select({ count: sql<number>`count(*)::int` }).from(questionAnswers),
      db.select({ count: sql<number>`count(*)::int` }).from(questionExplanations),
      db.select({ count: sql<number>`count(*)::int` }).from(questionTags),
      db.select({ count: sql<number>`count(*)::int` }).from(questionVersions),
      db.select({ count: sql<number>`count(*)::int` }).from(exams),
      db.select({ count: sql<number>`count(*)::int` }).from(examSections),
      db.select({ count: sql<number>`count(*)::int` }).from(examQuestions),
      db.select({ count: sql<number>`count(*)::int` }).from(examAttempts),
      db.select({ count: sql<number>`count(*)::int` }).from(attemptAnswers),
      db.select({ count: sql<number>`count(*)::int` }).from(attemptEvents),
      db.select({ count: sql<number>`count(*)::int` }).from(examResults),
      db.select({ count: sql<number>`count(*)::int` }).from(mistakeBook),
      db.select({ count: sql<number>`count(*)::int` }).from(learningProgress),
      db.select({ count: sql<number>`count(*)::int` }).from(achievements),
      db.select({ count: sql<number>`count(*)::int` }).from(studentGoals),
      db.select({ count: sql<number>`count(*)::int` }).from(studyPlans),
      db.select({ count: sql<number>`count(*)::int` }).from(studyTasks),
      db.select({ count: sql<number>`count(*)::int` }).from(flashcards),
      db.select({ count: sql<number>`count(*)::int` }).from(entranceExams),
      db.select({ count: sql<number>`count(*)::int` }).from(universities),
      db.select({ count: sql<number>`count(*)::int` }).from(courses),
      db.select({ count: sql<number>`count(*)::int` }).from(colleges),
      db.select({ count: sql<number>`count(*)::int` }).from(courseColleges),
      db.select({ count: sql<number>`count(*)::int` }).from(scholarships),
      db.select({ count: sql<number>`count(*)::int` }).from(careerPaths),
      db.select({ count: sql<number>`count(*)::int` }).from(opportunities),
      db.select({ count: sql<number>`count(*)::int` }).from(applicationDeadlines),
      db.select({ count: sql<number>`count(*)::int` }).from(discussionGroups),
      db.select({ count: sql<number>`count(*)::int` }).from(discussionPosts),
      db.select({ count: sql<number>`count(*)::int` }).from(discussionComments),
      db.select({ count: sql<number>`count(*)::int` }).from(postVotes),
      db.select({ count: sql<number>`count(*)::int` }).from(reports),
      db.select({ count: sql<number>`count(*)::int` }).from(moderationActions),
      db.select({ count: sql<number>`count(*)::int` }).from(auditLogs),
      db.select({ count: sql<number>`count(*)::int` }).from(systemSettings),
      db.select({ count: sql<number>`count(*)::int` }).from(contentSources),
      db.select({ count: sql<number>`count(*)::int` }).from(notifications),
    ]);

    return {
      countries: tableQueries[0][0]?.count ?? 0,
      languages: tableQueries[1][0]?.count ?? 0,
      curricula: tableQueries[2][0]?.count ?? 0,
      education_levels: tableQueries[3][0]?.count ?? 0,
      grades: tableQueries[4][0]?.count ?? 0,
      streams: tableQueries[5][0]?.count ?? 0,
      subjects: tableQueries[6][0]?.count ?? 0,
      chapters: tableQueries[7][0]?.count ?? 0,
      topics: tableQueries[8][0]?.count ?? 0,
      users: tableQueries[9][0]?.count ?? 0,
      profiles: tableQueries[10][0]?.count ?? 0,
      roles: tableQueries[11][0]?.count ?? 0,
      permissions: tableQueries[12][0]?.count ?? 0,
      role_permissions: tableQueries[13][0]?.count ?? 0,
      user_roles: tableQueries[14][0]?.count ?? 0,
      institutions: tableQueries[15][0]?.count ?? 0,
      resource_categories: tableQueries[16][0]?.count ?? 0,
      resources: tableQueries[17][0]?.count ?? 0,
      resource_versions: tableQueries[18][0]?.count ?? 0,
      content_reviews: tableQueries[19][0]?.count ?? 0,
      resource_tags: tableQueries[20][0]?.count ?? 0,
      bookmarks: tableQueries[21][0]?.count ?? 0,
      personal_notes: tableQueries[22][0]?.count ?? 0,
      question_sources: tableQueries[23][0]?.count ?? 0,
      questions: tableQueries[24][0]?.count ?? 0,
      question_options: tableQueries[25][0]?.count ?? 0,
      question_answers: tableQueries[26][0]?.count ?? 0,
      question_explanations: tableQueries[27][0]?.count ?? 0,
      question_tags: tableQueries[28][0]?.count ?? 0,
      question_versions: tableQueries[29][0]?.count ?? 0,
      exams: tableQueries[30][0]?.count ?? 0,
      exam_sections: tableQueries[31][0]?.count ?? 0,
      exam_questions: tableQueries[32][0]?.count ?? 0,
      exam_attempts: tableQueries[33][0]?.count ?? 0,
      attempt_answers: tableQueries[34][0]?.count ?? 0,
      attempt_events: tableQueries[35][0]?.count ?? 0,
      exam_results: tableQueries[36][0]?.count ?? 0,
      mistake_book: tableQueries[37][0]?.count ?? 0,
      learning_progress: tableQueries[38][0]?.count ?? 0,
      achievements: tableQueries[39][0]?.count ?? 0,
      student_goals: tableQueries[40][0]?.count ?? 0,
      study_plans: tableQueries[41][0]?.count ?? 0,
      study_tasks: tableQueries[42][0]?.count ?? 0,
      flashcards: tableQueries[43][0]?.count ?? 0,
      entrance_exams: tableQueries[44][0]?.count ?? 0,
      universities: tableQueries[45][0]?.count ?? 0,
      courses: tableQueries[46][0]?.count ?? 0,
      colleges: tableQueries[47][0]?.count ?? 0,
      course_colleges: tableQueries[48][0]?.count ?? 0,
      scholarships: tableQueries[49][0]?.count ?? 0,
      career_paths: tableQueries[50][0]?.count ?? 0,
      opportunities: tableQueries[51][0]?.count ?? 0,
      application_deadlines: tableQueries[52][0]?.count ?? 0,
      discussion_groups: tableQueries[53][0]?.count ?? 0,
      discussion_posts: tableQueries[54][0]?.count ?? 0,
      discussion_comments: tableQueries[55][0]?.count ?? 0,
      post_votes: tableQueries[56][0]?.count ?? 0,
      reports: tableQueries[57][0]?.count ?? 0,
      moderation_actions: tableQueries[58][0]?.count ?? 0,
      audit_logs: tableQueries[59][0]?.count ?? 0,
      system_settings: tableQueries[60][0]?.count ?? 0,
      content_sources: tableQueries[61][0]?.count ?? 0,
      notifications: tableQueries[62][0]?.count ?? 0,
    };
  } catch (error) {
    console.error('Failed to count schema tables:', error);
    throw new Error('Failed to load schema metrics.', { cause: error });
  }
}
