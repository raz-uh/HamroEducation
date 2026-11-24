import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import {
  chapters,
  institutions,
  profiles,
  roles,
  streams,
  subjects,
  topics,
  userRoles,
  users,
} from './src/db/schema.ts';
import {
  createEmailUser,
  ensureRoleAssigned,
  getCurriculumHierarchyTree,
  getInstitutionsList,
  getRbacDirectory,
  getSchemaCounts,
  getUserByEmail,
  getUserWithRbacById,
  getUsersDirectory,
  hasAnySuperAdmin,
  upsertGoogleUser,
} from './src/db/queries.ts';
import {
  createSchoolResource,
  createUserPersonalNote,
  deleteUserBookmark,
  deleteUserPersonalNote,
  getChapterLearningBundle,
  getSchoolGradeOverview,
  getUserBookmarks,
  getUserPersonalNotes,
  reviewSchoolResource,
  toggleUserBookmark,
} from './src/db/school-queries.ts';
import {
  createQuestionBankItem,
  getExamOverviewByIdentifier,
  getExamResultView,
  getPublishedExamsList,
  getQuestionBankItems,
  saveAttemptAnswer,
  startOrResumeExamAttempt,
  submitExamAttempt,
  transitionQuestionStatus,
} from './src/db/phase4-queries.ts';
import {
  createCustomFlashcardCard,
  createStudyPlanEntry,
  createStudyTaskEntry,
  deleteStudyTaskEntry,
  getCompleteStudentDashboard,
  getDailyChallengeBundle,
  getFlashcardsDeckBundle,
  getLeaderboardsBundle,
  getPlannerBundle,
  getUserMistakesBundle,
  reattemptMistakeEntry,
  recordChapterPracticeMcq,
  reviewFlashcardCard,
  submitDailyChallenge,
  toggleStudyTaskStatus,
  updateStudentGoalsConfig,
} from './src/db/phase5-queries.ts';
import {
  getCareerPathsDirectory,
  getClass12BachelorBridgeData,
  getCollegesDirectory,
  getCourseComparison,
  getCourseDetailBySlug,
  getCoursesDirectory,
  getOpportunitiesAndCalendar,
  getScholarshipsDirectory,
} from './src/db/phase6-queries.ts';
import {
  createCommunityComment,
  createCommunityPost,
  getCommunityFeed,
  getStudentWeakTopicsForPlanner,
  getVerifiedExplorerGroundingSnapshot,
  resolveCommunityModeration,
  saveAiGeneratedStudyPlan,
  submitCommunityReport,
  toggleCommunityVote,
  toggleTeacherVerifiedComment,
} from './src/db/phase7-queries.ts';
import {
  adminBulkImportQuestionsCsv,
  adminCreateAnnouncement,
  adminCreateChapterNode,
  adminCreateCourseRecord,
  adminCreateManagedResource,
  adminCreateOrUpdateExam,
  adminCreateScholarshipRecord,
  adminCreateSubjectNode,
  adminCreateTopicNode,
  adminGetExamResults,
  adminGetExplorerCatalog,
  adminListContentGovernance,
  adminListExamsWithStats,
  adminToggleAnnouncementPublished,
  adminTransitionQuestionLifecycle,
  adminTransitionResourceLifecycle,
  adminUpdateNepalSetting,
  adminUpdateQuestionFields,
  adminUpdateUserAccount,
  adminUpsertEntranceExamRecord,
  getAdminAnalyticsBundle,
  getAdminOverviewMetrics,
  getAnnouncementsFeed,
  getAuditLogsList,
  getNepalSystemSettings,
  recordAuditLog,
  type AuditActorInfo,
} from './src/db/phase8-queries.ts';
import {
  CSV_IMPORT_MAX_CHARS,
  EDITORIAL_LIFECYCLE_STAGES,
  getAllowedAdminModules,
  normalizeLifecycleStage,
  validateSafeSvgMarkup,
} from './src/lib/admin-governance.ts';
import type { AdminModuleId } from './src/types/api.ts';
import {
  runAiCareerAssistant,
  runAiQuestionGenerator,
  runAiStudyAssistant,
  runAiStudyPlanGenerator,
} from './src/server/ai-service.ts';
import {
  canMarkTeacherVerified,
  canModerateCommunity,
  SlidingWindowRateLimiter,
  validateAiPromptText,
} from './src/lib/ai-community.ts';
import {
  ENTRANCE_CATEGORIES,
  ENTRANCE_EXAM_PROFILES,
  getEntranceExamBySlug,
} from './src/lib/entrance-catalog.ts';
import {
  QUESTION_TYPE_CATALOG,
  QUESTION_WORKFLOW_STAGES,
} from './src/lib/exam-engine.ts';
import { ensureSeeded } from './src/db/seed.ts';
import { hashPassword, signSessionToken, verifyPassword } from './src/lib/auth-crypto.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import {
  canAssignRole,
  canRevokeRole,
  isValidEmail,
  isValidPasswordStrength,
} from './src/lib/rbac.ts';
import {
  getSessionSecret,
  optionalAuth,
  requireAuth,
  requirePermission,
  type AuthRequest,
} from './src/middleware/auth.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OWNER_EMAIL = 'nms.th666@gmail.com';

async function createServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));

  const authRateLimiter = new SlidingWindowRateLimiter();
  const communityWriteLimiter = new SlidingWindowRateLimiter();
  const communityReportLimiter = new SlidingWindowRateLimiter();
  const csvImportLimiter = new SlidingWindowRateLimiter();
  const examSubmitLimiter = new SlidingWindowRateLimiter();

  function enforceWindowLimit(
    limiter: SlidingWindowRateLimiter,
    key: string,
    maxRequests: number,
    windowMs: number,
    label: string,
    res: express.Response,
  ): boolean {
    const decision = limiter.consume(key, maxRequests, windowMs);
    if (!decision.allowed) {
      res.setHeader('Retry-After', String(decision.retryAfterSeconds));
      res.status(429).json({
        error: `${label} rate limit exceeded. Try again in ${decision.retryAfterSeconds}s.`,
      });
      return false;
    }
    return true;
  }

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'hamro-education' });
  });

  // Schema summary (live PostgreSQL table row counts)
  app.get('/api/schema-summary', async (_req, res) => {
    try {
      const counts = await getSchemaCounts();
      res.json({ counts });
    } catch (error) {
      console.error('Schema summary error:', error);
      res.status(500).json({ error: 'Unable to load database schema summary.' });
    }
  });

  // Bootstrap status for first-run Super Administrator claim
  app.get('/api/auth/bootstrap-status', async (_req, res) => {
    try {
      const superAdminExists = await hasAnySuperAdmin();
      const passcodeConfigured = Boolean(
        process.env.ADMIN_BOOTSTRAP_PASSCODE &&
          process.env.ADMIN_BOOTSTRAP_PASSCODE.trim().length > 0,
      );
      res.json({ superAdminExists, passcodeConfigured });
    } catch (error) {
      console.error('Bootstrap status error:', error);
      res.status(500).json({ error: 'Unable to check bootstrap status.' });
    }
  });

  // Email/Password Registration (defaults strictly to Registered Student)
  app.post('/api/auth/register', async (req, res) => {
    if (!enforceWindowLimit(authRateLimiter, `ip:${req.ip || 'unknown'}`, 20, 5 * 60 * 1000, 'Authentication', res)) {
      return;
    }
    try {
      const { email, password, fullName, countryId } = req.body ?? {};
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }
      if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100) {
        return res.status(400).json({ error: 'Full name must be between 2 and 100 characters.' });
      }
      const pwdCheck = isValidPasswordStrength(password);
      if (!pwdCheck.valid) {
        return res.status(400).json({ error: pwdCheck.reason });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existing = await getUserByEmail(normalizedEmail);
      if (existing) {
        return res.status(409).json({
          error: 'An account with this email already exists. Please sign in instead.',
        });
      }

      const passwordHash = hashPassword(password);
      const uid = `local:${crypto.randomUUID()}`;
      const user = await createEmailUser({
        uid,
        email: normalizedEmail,
        passwordHash,
        fullName: fullName.trim(),
        countryId: typeof countryId === 'number' ? countryId : null,
        roleSlug: 'registered_student',
      });

      const token = signSessionToken(
        { sub: user.uid, userId: user.id, email: user.email },
        getSessionSecret(),
      );

      return res.status(201).json({ token, user });
    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  });

  // Email/Password Sign-In
  app.post('/api/auth/login', async (req, res) => {
    if (!enforceWindowLimit(authRateLimiter, `ip:${req.ip || 'unknown'}`, 20, 5 * 60 * 1000, 'Sign-in', res)) {
      return;
    }
    try {
      const { email, password } = req.body ?? {};
      if (!isValidEmail(email) || typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'Valid email and password are required.' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const userRow = await getUserByEmail(normalizedEmail);
      if (!userRow || !userRow.passwordHash) {
        return res.status(401).json({
          error: 'Invalid email or password. If you signed up with Google, use Google Sign-In.',
        });
      }

      if (!verifyPassword(password, userRow.passwordHash)) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      if (userRow.status !== 'active') {
        return res.status(403).json({ error: 'This account is currently suspended.' });
      }

      await db
        .update(users)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, userRow.id));

      const hydrated = await getUserWithRbacById(userRow.id);
      if (!hydrated) {
        return res.status(500).json({ error: 'Unable to load user access profile.' });
      }

      const token = signSessionToken(
        { sub: hydrated.uid, userId: hydrated.id, email: hydrated.email },
        getSessionSecret(),
      );

      return res.json({ token, user: hydrated });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Sign-in failed. Please try again.' });
    }
  });

  // Google Sign-In Verification & PostgreSQL Sync
  app.post('/api/auth/google', async (req, res) => {
    if (!enforceWindowLimit(authRateLimiter, `ip:${req.ip || 'unknown'}`, 20, 5 * 60 * 1000, 'Authentication', res)) {
      return;
    }
    try {
      const idToken =
        typeof req.body?.idToken === 'string'
          ? req.body.idToken
          : req.headers.authorization?.replace(/^Bearer\s+/i, '');

      if (!idToken) {
        return res.status(400).json({ error: 'Firebase ID token is required.' });
      }

      const decoded = await adminAuth.verifyIdToken(idToken);
      const email = (decoded.email ?? '').trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ error: 'Google account must expose an email address.' });
      }

      const user = await upsertGoogleUser({
        uid: decoded.uid,
        email,
        fullName: decoded.name || email.split('@')[0],
        emailVerified: Boolean(decoded.email_verified),
        avatarUrl: decoded.picture ?? null,
        grantSuperAdmin: Boolean(decoded.email_verified && email === OWNER_EMAIL),
      });

      return res.json({ user });
    } catch (error) {
      console.error('Google auth sync error:', error);
      return res.status(401).json({ error: 'Google sign-in verification failed.' });
    }
  });

  // One-time Super Administrator Bootstrap / Passcode Claim
  app.post('/api/auth/claim-super-admin', async (req, res) => {
    if (!enforceWindowLimit(authRateLimiter, `ip:${req.ip || 'unknown'}`, 10, 5 * 60 * 1000, 'Admin bootstrap', res)) {
      return;
    }
    try {
      const { email, password, fullName, passcode } = req.body ?? {};
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Valid email address is required.' });
      }
      const pwdCheck = isValidPasswordStrength(password);
      if (!pwdCheck.valid) {
        return res.status(400).json({ error: pwdCheck.reason });
      }

      const envPasscode = process.env.ADMIN_BOOTSTRAP_PASSCODE?.trim();
      const superAdminExists = await hasAnySuperAdmin();

      if (envPasscode && envPasscode.length > 0) {
        if (typeof passcode !== 'string') {
          return res.status(403).json({ error: 'Admin bootstrap passcode is required.' });
        }
        const a = Buffer.from(passcode, 'utf8');
        const b = Buffer.from(envPasscode, 'utf8');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          return res.status(403).json({ error: 'Invalid admin bootstrap passcode.' });
        }
      } else if (superAdminExists) {
        return res.status(403).json({
          error:
            'Initial Super Administrator has already been claimed. Sign in with your administrator account.',
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existing = await getUserByEmail(normalizedEmail);
      let userId: number;

      if (existing) {
        if (existing.authProvider !== 'local' && !existing.passwordHash) {
          return res.status(403).json({
            error: 'Existing Google-authenticated account cannot be claimed with a password.',
          });
        }
        if (existing.passwordHash && !verifyPassword(password, existing.passwordHash)) {
          return res.status(401).json({
            error: 'Existing account password does not match.',
          });
        }
        userId = existing.id;
        if (!existing.passwordHash) {
          await db
            .update(users)
            .set({ passwordHash: hashPassword(password), updatedAt: new Date() })
            .where(eq(users.id, existing.id));
        }
      } else {
        if (typeof fullName !== 'string' || fullName.trim().length < 2) {
          return res.status(400).json({ error: 'Full name is required for initial admin setup.' });
        }
        const created = await createEmailUser({
          uid: `local:${crypto.randomUUID()}`,
          email: normalizedEmail,
          passwordHash: hashPassword(password),
          fullName: fullName.trim(),
          roleSlug: 'super_administrator',
        });
        userId = created.id;
      }

      await ensureRoleAssigned({
        userId,
        roleSlug: 'super_administrator',
      });

      const hydrated = await getUserWithRbacById(userId);
      if (!hydrated) {
        return res.status(500).json({ error: 'Failed to load claimed administrator profile.' });
      }

      const token = signSessionToken(
        { sub: hydrated.uid, userId: hydrated.id, email: hydrated.email },
        getSessionSecret(),
      );

      return res.status(201).json({ token, user: hydrated });
    } catch (error) {
      console.error('Claim super admin error:', error);
      return res.status(500).json({ error: 'Unable to complete administrator setup.' });
    }
  });

  // Current Authenticated Session / Guest Context
  app.get('/api/auth/me', optionalAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      if (req.currentUser) {
        return res.json({ authenticated: true, user: req.currentUser });
      }
      return res.json({
        authenticated: false,
        guestRole: {
          slug: 'guest',
          name: 'Guest',
          permissions: ['curriculum:read', 'institutions:read'],
        },
      });
    } catch (error) {
      console.error('Auth me error:', error);
      return res.status(500).json({ error: 'Failed to inspect current session.' });
    }
  });

  // Update Own Profile
  app.patch('/api/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const current = req.currentUser!;
      const { fullName, displayName, countryId, preferredLanguageId, institutionId, gradeLevel, bio } =
        req.body ?? {};

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof fullName === 'string' && fullName.trim().length >= 2) {
        updates.fullName = fullName.trim().slice(0, 100);
      }
      if (typeof displayName === 'string') {
        updates.displayName = displayName.trim().slice(0, 60) || null;
      }
      if (countryId === null || (typeof countryId === 'number' && Number.isInteger(countryId) && countryId > 0)) {
        updates.countryId = countryId;
      }
      if (
        preferredLanguageId === null ||
        (typeof preferredLanguageId === 'number' && Number.isInteger(preferredLanguageId) && preferredLanguageId > 0)
      ) {
        updates.preferredLanguageId = preferredLanguageId;
      }
      if (
        institutionId === null ||
        (typeof institutionId === 'number' && Number.isInteger(institutionId) && institutionId > 0)
      ) {
        updates.institutionId = institutionId;
      }
      if (typeof gradeLevel === 'string') {
        updates.gradeLevel = gradeLevel.trim().slice(0, 40) || null;
      }
      if (typeof bio === 'string') {
        updates.bio = bio.trim().slice(0, 300) || null;
      }

      await db
        .update(profiles)
        .set(updates)
        .where(eq(profiles.userId, current.id));

      const hydrated = await getUserWithRbacById(current.id);
      return res.json({ user: hydrated });
    } catch (error) {
      console.error('Update profile error:', error);
      return res.status(500).json({ error: 'Failed to update profile.' });
    }
  });

  // Country & Curriculum Hierarchy
  app.get('/api/curriculum', async (req, res) => {
    try {
      const countryIso = typeof req.query.country === 'string' ? req.query.country : undefined;
      const tree = await getCurriculumHierarchyTree(countryIso);
      return res.json(tree);
    } catch (error) {
      console.error('Curriculum load error:', error);
      return res.status(500).json({ error: 'Failed to load curriculum hierarchy.' });
    }
  });

  // Create Curriculum Topic (Requires curriculum:write -> Teacher, Content Manager, Admin, Super Admin, Institutional Admin)
  app.post(
    '/api/curriculum/topics',
    requireAuth,
    requirePermission('curriculum:write'),
    async (req: AuthRequest, res) => {
      try {
        const { chapterId, topicNumber, title, learningObjectives, difficultyLevel, estimatedMinutes } =
          req.body ?? {};

        if (typeof chapterId !== 'number' || !Number.isInteger(chapterId)) {
          return res.status(400).json({ error: 'Valid chapterId is required.' });
        }
        if (typeof topicNumber !== 'string' || !topicNumber.trim()) {
          return res.status(400).json({ error: 'Topic number (e.g. 1.3) is required.' });
        }
        if (typeof title !== 'string' || title.trim().length < 3) {
          return res.status(400).json({ error: 'Topic title must be at least 3 characters.' });
        }
        if (typeof learningObjectives !== 'string' || learningObjectives.trim().length < 5) {
          return res.status(400).json({ error: 'Learning objectives are required.' });
        }

        const chapterRows = await db
          .select()
          .from(chapters)
          .where(eq(chapters.id, chapterId))
          .limit(1);
        if (!chapterRows[0]) {
          return res.status(404).json({ error: 'Target chapter was not found.' });
        }

        const allowedDifficulties = ['foundational', 'intermediate', 'advanced'];
        const safeDifficulty = allowedDifficulties.includes(difficultyLevel)
          ? difficultyLevel
          : 'intermediate';
        const safeMinutes =
          typeof estimatedMinutes === 'number' && estimatedMinutes >= 10 && estimatedMinutes <= 240
            ? Math.round(estimatedMinutes)
            : 45;

        const [created] = await db
          .insert(topics)
          .values({
            chapterId,
            topicNumber: topicNumber.trim().slice(0, 20),
            title: title.trim().slice(0, 140),
            learningObjectives: learningObjectives.trim().slice(0, 600),
            difficultyLevel: safeDifficulty,
            estimatedMinutes: safeMinutes,
            reviewStatus: req.currentUser!.permissions.includes('curriculum:review')
              ? 'approved'
              : 'in_review',
            createdBy: req.currentUser!.id,
          })
          .returning();

        return res.status(201).json({ topic: created });
      } catch (error) {
        console.error('Create topic error:', error);
        return res.status(500).json({ error: 'Failed to create topic. Check if topic number already exists.' });
      }
    },
  );

  // Review / Approve Topic (Requires curriculum:review -> Academic Reviewer, Admin, Super Admin)
  app.patch(
    '/api/curriculum/topics/:id/review',
    requireAuth,
    requirePermission('curriculum:review'),
    async (req: AuthRequest, res) => {
      try {
        const topicId = Number(req.params.id);
        if (!Number.isInteger(topicId) || topicId <= 0) {
          return res.status(400).json({ error: 'Invalid topic ID.' });
        }
        const { reviewStatus } = req.body ?? {};
        if (!['draft', 'in_review', 'approved'].includes(reviewStatus)) {
          return res.status(400).json({ error: 'Invalid reviewStatus value.' });
        }

        const [updated] = await db
          .update(topics)
          .set({ reviewStatus })
          .where(eq(topics.id, topicId))
          .returning();

        if (!updated) {
          return res.status(404).json({ error: 'Topic not found.' });
        }
        return res.json({ topic: updated });
      } catch (error) {
        console.error('Review topic error:', error);
        return res.status(500).json({ error: 'Failed to update topic review status.' });
      }
    },
  );

  // Create Subject (Requires curriculum:write)
  app.post(
    '/api/curriculum/subjects',
    requireAuth,
    requirePermission('curriculum:write'),
    async (req: AuthRequest, res) => {
      try {
        const { streamId, code, name, creditHours, isCompulsory } = req.body ?? {};
        if (typeof streamId !== 'number' || !Number.isInteger(streamId)) {
          return res.status(400).json({ error: 'Valid streamId is required.' });
        }
        if (typeof code !== 'string' || code.trim().length < 2) {
          return res.status(400).json({ error: 'Subject code is required.' });
        }
        if (typeof name !== 'string' || name.trim().length < 2) {
          return res.status(400).json({ error: 'Subject name is required.' });
        }

        const streamRows = await db
          .select()
          .from(streams)
          .where(eq(streams.id, streamId))
          .limit(1);
        if (!streamRows[0]) {
          return res.status(404).json({ error: 'Target stream was not found.' });
        }

        const [created] = await db
          .insert(subjects)
          .values({
            streamId,
            code: code.trim().toUpperCase().slice(0, 24),
            name: name.trim().slice(0, 120),
            creditHours:
              typeof creditHours === 'number' && creditHours >= 1 && creditHours <= 12
                ? Math.round(creditHours)
                : 4,
            isCompulsory: Boolean(isCompulsory ?? true),
            status: 'published',
          })
          .returning();

        return res.status(201).json({ subject: created });
      } catch (error) {
        console.error('Create subject error:', error);
        return res.status(500).json({ error: 'Failed to create subject.' });
      }
    },
  );

  // RBAC Matrix (Public metadata of system roles & permissions)
  app.get('/api/rbac/matrix', async (_req, res) => {
    try {
      const directory = await getRbacDirectory();
      return res.json(directory);
    } catch (error) {
      console.error('RBAC matrix error:', error);
      return res.status(500).json({ error: 'Failed to load RBAC matrix.' });
    }
  });

  // Users Directory (Requires users:read)
  app.get(
    '/api/rbac/users',
    requireAuth,
    requirePermission('users:read'),
    async (_req, res) => {
      try {
        const directory = await getUsersDirectory();
        return res.json({ users: directory });
      } catch (error) {
        console.error('Users directory error:', error);
        return res.status(500).json({ error: 'Failed to load users directory.' });
      }
    },
  );

  // Assign Role (Server-Side Hierarchical RBAC Enforcement)
  app.post(
    '/api/rbac/assign-role',
    requireAuth,
    requirePermission('users:assign_role'),
    async (req: AuthRequest, res) => {
      try {
        const { userId, roleSlug, institutionId, countryId } = req.body ?? {};
        if (typeof userId !== 'number' || !Number.isInteger(userId)) {
          return res.status(400).json({ error: 'Valid userId is required.' });
        }
        if (typeof roleSlug !== 'string' || !roleSlug.trim()) {
          return res.status(400).json({ error: 'Valid roleSlug is required.' });
        }

        const actor = req.currentUser!;
        const actorRoleSlugs = actor.roles.map((r) => r.slug);
        const safeInstitutionId = typeof institutionId === 'number' ? institutionId : null;

        const check = canAssignRole({
          actorRoles: actorRoleSlugs,
          targetRoleSlug: roleSlug,
          actorInstitutionIds: actor.institutionIds,
          targetInstitutionId: safeInstitutionId,
        });

        if (!check.allowed) {
          return res.status(403).json({ error: check.reason });
        }

        const targetUser = await getUserWithRbacById(userId);
        if (!targetUser) {
          return res.status(404).json({ error: 'Target user not found.' });
        }

        await ensureRoleAssigned({
          userId,
          roleSlug,
          institutionId: safeInstitutionId,
          countryId: typeof countryId === 'number' ? countryId : null,
          assignedBy: actor.id,
        });

        await recordAuditLog({
          actor: {
            id: actor.id,
            email: actor.email,
            roles: actorRoleSlugs,
            ipAddress: req.ip ?? null,
          },
          action: 'RBAC_ROLE_ASSIGNED',
          targetEntity: 'user_roles',
          targetId: userId,
          summary: `Assigned role '${roleSlug}' to ${targetUser.email}.`,
          metadata: { targetEmail: targetUser.email, roleSlug, institutionId: safeInstitutionId },
        });

        const updatedTarget = await getUserWithRbacById(userId);
        return res.json({ user: updatedTarget });
      } catch (error) {
        console.error('Assign role error:', error);
        return res.status(500).json({ error: 'Failed to assign role.' });
      }
    },
  );

  // Revoke Role Assignment
  app.delete(
    '/api/rbac/assignments/:assignmentId',
    requireAuth,
    requirePermission('users:assign_role'),
    async (req: AuthRequest, res) => {
      try {
        const assignmentId = Number(req.params.assignmentId);
        if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
          return res.status(400).json({ error: 'Invalid assignment ID.' });
        }

        const [assignment] = await db
          .select({
            id: userRoles.id,
            userId: userRoles.userId,
            institutionId: userRoles.institutionId,
            roleSlug: roles.slug,
          })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(and(eq(userRoles.id, assignmentId), eq(userRoles.isActive, true)))
          .limit(1);

        if (!assignment) {
          return res.status(404).json({ error: 'Role assignment not found.' });
        }

        const actor = req.currentUser!;
        const actorRoleSlugs = actor.roles.map((r) => r.slug);

        const revokeCheck = canRevokeRole({
          actorRoles: actorRoleSlugs,
          targetRoleSlug: assignment.roleSlug,
          actorInstitutionIds: actor.institutionIds,
          targetInstitutionId: assignment.institutionId ?? null,
        });
        if (!revokeCheck.allowed) {
          return res.status(403).json({
            error: revokeCheck.reason ?? 'Forbidden: cannot revoke this role assignment.',
          });
        }

        if (
          assignment.userId === actor.id &&
          assignment.roleSlug === 'super_administrator'
        ) {
          return res.status(400).json({
            error: 'Cannot revoke your own Super Administrator role to prevent lockout.',
          });
        }

        await db
          .update(userRoles)
          .set({ isActive: false })
          .where(eq(userRoles.id, assignmentId));

        await recordAuditLog({
          actor: {
            id: actor.id,
            email: actor.email,
            roles: actorRoleSlugs,
            ipAddress: req.ip ?? null,
          },
          action: 'RBAC_ROLE_REVOKED',
          targetEntity: 'user_roles',
          targetId: assignmentId,
          summary: `Revoked role '${assignment.roleSlug}' assignment #${assignmentId} (userId=${assignment.userId}).`,
          metadata: { targetUserId: assignment.userId, roleSlug: assignment.roleSlug },
        });

        return res.json({ revoked: true, assignmentId });
      } catch (error) {
        console.error('Revoke role error:', error);
        return res.status(500).json({ error: 'Failed to revoke role assignment.' });
      }
    },
  );

  // Institutions Directory
  app.get('/api/institutions', async (req, res) => {
    try {
      const countryId = req.query.countryId ? Number(req.query.countryId) : undefined;
      const list = await getInstitutionsList(
        countryId && Number.isInteger(countryId) ? countryId : undefined,
      );
      return res.json({ institutions: list });
    } catch (error) {
      console.error('Institutions load error:', error);
      return res.status(500).json({ error: 'Failed to load institutions.' });
    }
  });

  // Create Institution (Requires institutions:manage)
  app.post(
    '/api/institutions',
    requireAuth,
    requirePermission('institutions:manage'),
    async (req: AuthRequest, res) => {
      try {
        const { countryId, name, code, institutionType, provinceOrState, city, domain, isVerified } =
          req.body ?? {};

        if (typeof countryId !== 'number' || !Number.isInteger(countryId)) {
          return res.status(400).json({ error: 'Valid countryId is required.' });
        }
        if (typeof name !== 'string' || name.trim().length < 2) {
          return res.status(400).json({ error: 'Institution name is required.' });
        }
        if (typeof code !== 'string' || code.trim().length < 2) {
          return res.status(400).json({ error: 'Unique institution code is required.' });
        }

        const allowedTypes = ['school', 'college', 'university', 'training_center', 'board'];
        const safeType = allowedTypes.includes(institutionType) ? institutionType : 'school';

        const [created] = await db
          .insert(institutions)
          .values({
            countryId,
            name: name.trim().slice(0, 140),
            code: code.trim().toUpperCase().slice(0, 32),
            institutionType: safeType,
            provinceOrState: typeof provinceOrState === 'string' ? provinceOrState.trim() : null,
            city: typeof city === 'string' ? city.trim() : null,
            domain: typeof domain === 'string' ? domain.trim().toLowerCase() : null,
            isVerified: Boolean(isVerified ?? false),
          })
          .returning();

        return res.status(201).json({ institution: created });
      } catch (error) {
        console.error('Create institution error:', error);
        return res.status(500).json({ error: 'Failed to create institution. Code may already exist.' });
      }
    },
  );

  // ==========================================================================
  // Phase 3: School Learning System & Content Storage Routes
  // ==========================================================================

  app.get('/api/school/grade/:gradeSlug', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const permissions = req.currentUser?.permissions ?? ['curriculum:read'];
      const data = await getSchoolGradeOverview(req.params.gradeSlug, permissions);
      if (!data) {
        return res.status(404).json({ error: 'Requested school grade was not found.' });
      }
      return res.json(data);
    } catch (error) {
      console.error('School grade overview error:', error);
      return res.status(500).json({ error: 'Failed to load school grade overview.' });
    }
  });

  app.get(
    '/api/school/chapter/:gradeSlug/:subjectCode/:chapterKey',
    optionalAuth,
    async (req: AuthRequest, res) => {
      try {
        const permissions = req.currentUser?.permissions ?? ['curriculum:read'];
        const data = await getChapterLearningBundle({
          gradeSlug: req.params.gradeSlug,
          subjectCode: req.params.subjectCode,
          chapterKey: req.params.chapterKey,
          userId: req.currentUser?.id ?? null,
          userPermissions: permissions,
        });
        if (!data) {
          return res.status(404).json({ error: 'Chapter learning bundle not found.' });
        }
        return res.json(data);
      } catch (error) {
        console.error('Chapter reader error:', error);
        return res.status(500).json({ error: 'Failed to load chapter learning bundle.' });
      }
    },
  );

  app.get('/api/school/bookmarks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const list = await getUserBookmarks(req.currentUser!.id);
      return res.json({ bookmarks: list });
    } catch (error) {
      console.error('Bookmarks fetch error:', error);
      return res.status(500).json({ error: 'Failed to load bookmarks.' });
    }
  });

  app.post('/api/school/bookmarks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { gradeId, subjectId, chapterId, resourceId, bookmarkType, title } = req.body ?? {};
      if (
        typeof gradeId !== 'number' ||
        typeof subjectId !== 'number' ||
        typeof chapterId !== 'number' ||
        typeof title !== 'string' ||
        !title.trim()
      ) {
        return res.status(400).json({ error: 'Valid gradeId, subjectId, chapterId, and title are required.' });
      }
      const result = await toggleUserBookmark(req.currentUser!.id, {
        gradeId,
        subjectId,
        chapterId,
        resourceId: typeof resourceId === 'number' ? resourceId : null,
        bookmarkType: typeof bookmarkType === 'string' ? bookmarkType : undefined,
        title,
      });
      return res.json(result);
    } catch (error) {
      console.error('Toggle bookmark error:', error);
      return res.status(500).json({ error: 'Failed to update bookmark.' });
    }
  });

  app.delete('/api/school/bookmarks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid bookmark ID.' });
      }
      const deleted = await deleteUserBookmark(req.currentUser!.id, id);
      if (!deleted) {
        return res.status(404).json({ error: 'Bookmark not found.' });
      }
      return res.json({ deleted: true, id });
    } catch (error) {
      console.error('Delete bookmark error:', error);
      return res.status(500).json({ error: 'Failed to remove bookmark.' });
    }
  });

  app.get('/api/school/notes', requireAuth, async (req: AuthRequest, res) => {
    try {
      const chapterId = req.query.chapterId ? Number(req.query.chapterId) : undefined;
      const list = await getUserPersonalNotes(
        req.currentUser!.id,
        chapterId && Number.isInteger(chapterId) ? chapterId : undefined,
      );
      return res.json({ notes: list });
    } catch (error) {
      console.error('Personal notes fetch error:', error);
      return res.status(500).json({ error: 'Failed to load personal notes.' });
    }
  });

  app.post('/api/school/notes', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { chapterId, resourceId, title, highlightText, noteBody, languageCode } = req.body ?? {};
      if (typeof chapterId !== 'number' || !Number.isInteger(chapterId)) {
        return res.status(400).json({ error: 'Valid chapterId is required.' });
      }
      if (typeof title !== 'string' || title.trim().length < 2) {
        return res.status(400).json({ error: 'Note title is required.' });
      }
      if (typeof noteBody !== 'string' || noteBody.trim().length < 2) {
        return res.status(400).json({ error: 'Note body is required.' });
      }
      const note = await createUserPersonalNote(req.currentUser!.id, {
        chapterId,
        resourceId: typeof resourceId === 'number' ? resourceId : null,
        title,
        highlightText: typeof highlightText === 'string' ? highlightText : null,
        noteBody,
        languageCode: typeof languageCode === 'string' ? languageCode : 'en',
      });
      return res.status(201).json({ note });
    } catch (error) {
      console.error('Create personal note error:', error);
      return res.status(500).json({ error: 'Failed to save personal study note.' });
    }
  });

  app.delete('/api/school/notes/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid note ID.' });
      }
      const deleted = await deleteUserPersonalNote(req.currentUser!.id, id);
      if (!deleted) {
        return res.status(404).json({ error: 'Personal note not found.' });
      }
      return res.json({ deleted: true, id });
    } catch (error) {
      console.error('Delete personal note error:', error);
      return res.status(500).json({ error: 'Failed to delete personal note.' });
    }
  });

  app.post(
    '/api/school/resources',
    requireAuth,
    requirePermission('curriculum:write'),
    async (req: AuthRequest, res) => {
      try {
        const {
          categorySlug,
          gradeId,
          streamId,
          subjectId,
          chapterId,
          title,
          summary,
          resourceType,
          contentEn,
          tags,
        } = req.body ?? {};
        if (
          typeof categorySlug !== 'string' ||
          typeof gradeId !== 'number' ||
          typeof subjectId !== 'number' ||
          typeof title !== 'string' ||
          title.trim().length < 3 ||
          typeof summary !== 'string' ||
          !contentEn ||
          typeof contentEn !== 'object' ||
          Array.isArray(contentEn)
        ) {
          return res.status(400).json({ error: 'Missing required resource fields.' });
        }
        const canPublish = req.currentUser!.permissions.includes('curriculum:publish');
        const created = await createSchoolResource(req.currentUser!.id, canPublish, {
          categorySlug,
          gradeId,
          streamId: typeof streamId === 'number' ? streamId : null,
          subjectId,
          chapterId: typeof chapterId === 'number' ? chapterId : null,
          title,
          summary,
          resourceType: typeof resourceType === 'string' ? resourceType : categorySlug,
          contentEn,
          tags: Array.isArray(tags) ? tags : [],
        });
        await recordAuditLog({
          actor: {
            id: req.currentUser!.id,
            email: req.currentUser!.email,
            roles: req.currentUser!.roles.map((r) => r.slug),
            ipAddress: req.ip ?? null,
          },
          action: 'SCHOOL_RESOURCE_CREATED',
          targetEntity: 'resources',
          targetId: created.id,
          summary: `Created school resource "${created.title}" (status=${created.status}).`,
          metadata: { status: created.status, categorySlug },
        });
        return res.status(201).json({ resource: created });
      } catch (error) {
        console.error('Create school resource error:', error);
        return res.status(500).json({ error: 'Failed to create resource.' });
      }
    },
  );

  app.patch(
    '/api/school/resources/:id/review',
    requireAuth,
    requirePermission('curriculum:review'),
    async (req: AuthRequest, res) => {
      try {
        const resourceId = Number(req.params.id);
        if (!Number.isInteger(resourceId) || resourceId <= 0) {
          return res.status(400).json({ error: 'Invalid resource ID.' });
        }
        const { decision, comments } = req.body ?? {};
        if (!['approved', 'changes_requested'].includes(decision)) {
          return res.status(400).json({ error: 'Decision must be approved or changes_requested.' });
        }
        const updated = await reviewSchoolResource({
          reviewerId: req.currentUser!.id,
          resourceId,
          decision,
          comments: typeof comments === 'string' ? comments : '',
        });
        if (!updated) {
          return res.status(404).json({ error: 'Resource not found.' });
        }
        await recordAuditLog({
          actor: {
            id: req.currentUser!.id,
            email: req.currentUser!.email,
            roles: req.currentUser!.roles.map((r) => r.slug),
            ipAddress: req.ip ?? null,
          },
          action: 'RESOURCE_REVIEW_DECISION',
          targetEntity: 'resources',
          targetId: resourceId,
          summary: `Reviewed resource "${updated.title}" with decision '${decision}'.`,
          metadata: { decision, comments: typeof comments === 'string' ? comments : '' },
        });
        return res.json({ resource: updated });
      } catch (error) {
        console.error('Review resource error:', error);
        return res.status(500).json({ error: 'Failed to review resource.' });
      }
    },
  );

  // ==========================================================================
  // Phase 4: Bachelor Entrance, Question Bank & Examination Engine Routes
  // ==========================================================================

  app.get('/api/entrance', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const category = typeof req.query.category === 'string' ? req.query.category : 'all';
      const search = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
      const allExams = await getPublishedExamsList(req.currentUser?.id ?? null);

      const profiles = ENTRANCE_EXAM_PROFILES.filter((p) => {
        if (category !== 'all' && p.category !== category) return false;
        if (search) {
          const hay = `${p.title} ${p.shortName} ${p.authority} ${p.degreePrograms.join(' ')}`.toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      }).map((p) => ({
        ...p,
        liveMockExam:
          allExams.find((e) => e.slug === p.mockExamSlug || e.examinationSlug === p.slug) ?? null,
      }));

      return res.json({
        categories: ENTRANCE_CATEGORIES,
        profiles,
      });
    } catch (error) {
      console.error('Entrance catalog error:', error);
      return res.status(500).json({ error: 'Failed to load bachelor entrance catalog.' });
    }
  });

  app.get('/api/entrance/:slug', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const profile = getEntranceExamBySlug(req.params.slug);
      if (!profile) {
        return res.status(404).json({ error: 'Requested bachelor entrance exam was not found.' });
      }
      const userId = req.currentUser?.id ?? null;
      const allExams = await getPublishedExamsList(userId);
      const matchingExams = allExams.filter(
        (e) => e.examinationSlug === profile.slug || e.slug === profile.mockExamSlug,
      );

      const qResult = await getQuestionBankItems({
        examination: profile.shortName === 'B.Sc. CSIT' ? 'BSc CSIT' : profile.shortName,
        userPermissions: req.currentUser?.permissions ?? ['curriculum:read'],
      });

      return res.json({
        profile,
        mockExams: matchingExams,
        sampleQuestions: qResult.questions.slice(0, 8),
      });
    } catch (error) {
      console.error('Entrance detail error:', error);
      return res.status(500).json({ error: 'Failed to load entrance exam details.' });
    }
  });

  app.get('/api/question-bank', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getQuestionBankItems({
        examination: typeof req.query.examination === 'string' ? req.query.examination : undefined,
        questionType: typeof req.query.questionType === 'string' ? req.query.questionType : undefined,
        difficulty: typeof req.query.difficulty === 'string' ? req.query.difficulty : undefined,
        subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        userPermissions: req.currentUser?.permissions ?? ['curriculum:read'],
      });
      return res.json(data);
    } catch (error) {
      console.error('Question bank load error:', error);
      return res.status(500).json({ error: 'Failed to load question bank.' });
    }
  });

  app.post(
    '/api/question-bank',
    requireAuth,
    requirePermission('questions:manage'),
    async (req: AuthRequest, res) => {
      try {
        const body = req.body ?? {};
        const validTypes = QUESTION_TYPE_CATALOG.map((t) => t.id);
        if (!validTypes.includes(body.questionType)) {
          return res.status(400).json({ error: 'Invalid questionType.' });
        }
        if (
          typeof body.examination !== 'string' ||
          typeof body.subjectName !== 'string' ||
          typeof body.chapterName !== 'string' ||
          typeof body.topicName !== 'string' ||
          !body.questionContent?.prompt ||
          typeof body.explanation !== 'string'
        ) {
          return res.status(400).json({ error: 'Missing required question fields.' });
        }

        const svgCheck = validateSafeSvgMarkup(body.questionContent?.diagramSvg);
        if (!svgCheck.valid) {
          return res.status(400).json({ error: svgCheck.reason });
        }

        const requestedStatus = QUESTION_WORKFLOW_STAGES.includes(body.status)
          ? body.status
          : 'Draft';

        if (
          requestedStatus === 'Published' &&
          !req.currentUser!.permissions.includes('curriculum:review') &&
          !req.currentUser!.permissions.includes('system:admin')
        ) {
          return res.status(403).json({
            error: 'Publishing directly requires Academic Review or Administrator permission.',
          });
        }

        const created = await createQuestionBankItem({
          actorId: req.currentUser!.id,
          actorName: req.currentUser!.profile?.fullName ?? req.currentUser!.email,
          academicLevel:
            typeof body.academicLevel === 'string' && body.academicLevel.trim()
              ? body.academicLevel
              : 'Bachelor Entrance',
          examination: body.examination,
          subjectName: body.subjectName,
          chapterName: body.chapterName,
          topicName: body.topicName,
          questionType: body.questionType,
          difficulty:
            ['easy', 'medium', 'hard'].includes(body.difficulty) ? body.difficulty : 'medium',
          questionContent: body.questionContent,
          options: Array.isArray(body.options) ? body.options : [],
          correctAnswer: body.correctAnswer ?? {},
          explanation: body.explanation,
          marks: typeof body.marks === 'number' && body.marks > 0 ? body.marks : 1,
          negativeMarks:
            typeof body.negativeMarks === 'number' && body.negativeMarks >= 0
              ? body.negativeMarks
              : 0,
          source: typeof body.source === 'string' ? body.source : 'Faculty Original',
          language: body.language === 'ne' ? 'ne' : 'en',
          status: requestedStatus,
          tags: Array.isArray(body.tags) ? body.tags : [],
          linkExamId: typeof body.linkExamId === 'number' ? body.linkExamId : null,
        });

        return res.status(201).json({ question: created });
      } catch (error) {
        console.error('Create question error:', error);
        return res.status(500).json({ error: 'Failed to create question in bank.' });
      }
    },
  );

  app.patch(
    '/api/question-bank/:id/status',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const perms = req.currentUser!.permissions;
        const actorRoles = req.currentUser!.roles.map((r) => r.slug);
        if (
          !perms.includes('questions:manage') &&
          !perms.includes('curriculum:review') &&
          !perms.includes('system:admin')
        ) {
          return res.status(403).json({
            error: 'Insufficient permissions to transition question workflow status.',
          });
        }

        const questionId = Number(req.params.id);
        if (!Number.isInteger(questionId) || questionId <= 0) {
          return res.status(400).json({ error: 'Invalid question ID.' });
        }

        const { nextStatus, updatedPrompt, updatedExplanation } = req.body ?? {};
        if (!QUESTION_WORKFLOW_STAGES.includes(nextStatus)) {
          return res.status(400).json({
            error: `nextStatus must be one of: ${QUESTION_WORKFLOW_STAGES.join(', ')}`,
          });
        }

        if (
          (nextStatus === 'Approval' || nextStatus === 'Published') &&
          !perms.includes('curriculum:review') &&
          !perms.includes('system:admin')
        ) {
          return res.status(403).json({
            error: 'Academic Reviewer or Administrator permission required for Approval/Published stages.',
          });
        }

        const updated = await transitionQuestionStatus({
          questionId,
          nextStatus,
          actorId: req.currentUser!.id,
          actorName: req.currentUser!.profile?.fullName ?? req.currentUser!.email,
          actorRoles,
          actorPermissions: perms,
          updatedPrompt: typeof updatedPrompt === 'string' ? updatedPrompt : undefined,
          updatedExplanation:
            typeof updatedExplanation === 'string' ? updatedExplanation : undefined,
        });

        if (!updated) {
          return res.status(404).json({ error: 'Question not found.' });
        }

        await recordAuditLog({
          actor: {
            id: req.currentUser!.id,
            email: req.currentUser!.email,
            roles: actorRoles,
            ipAddress: req.ip ?? null,
          },
          action: 'QUESTION_STATUS_CHANGED',
          targetEntity: 'questions',
          targetId: updated.questionUid,
          summary: `Transitioned question ${updated.questionUid} to '${nextStatus}'.`,
          metadata: { nextStatus },
        });

        return res.json({ question: updated });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to transition question workflow status.';
        const status =
          message.includes('AI-generated') ||
          message.includes('Only ') ||
          message.includes('requires') ||
          message.includes('verified source') ||
          message.includes('Insufficient')
            ? 403
            : 400;
        return res.status(status).json({ error: message });
      }
    },
  );

  app.get('/api/exams', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const list = await getPublishedExamsList(req.currentUser?.id ?? null);
      return res.json({ exams: list });
    } catch (error) {
      console.error('Exams list error:', error);
      return res.status(500).json({ error: 'Failed to load published examinations.' });
    }
  });

  app.get('/api/exams/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const overview = await getExamOverviewByIdentifier(
        req.params.id,
        req.currentUser?.id ?? null,
      );
      if (!overview) {
        return res.status(404).json({ error: 'Examination not found.' });
      }
      return res.json(overview);
    } catch (error) {
      console.error('Exam overview error:', error);
      return res.status(500).json({ error: 'Failed to load examination details.' });
    }
  });

  app.post('/api/exams/:id/start', requireAuth, async (req: AuthRequest, res) => {
    try {
      const forceNew = Boolean(req.body?.forceNew);
      const data = await startOrResumeExamAttempt({
        examIdentifier: req.params.id,
        userId: req.currentUser!.id,
        forceNew,
      });
      return res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start examination.';
      const statusCode =
        message.includes('limit') || message.includes('window') ? 403 : 400;
      return res.status(statusCode).json({ error: message });
    }
  });

  app.post(
    '/api/exams/attempts/:attemptUid/answer',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const { questionId, selectedAnswer, isMarkedForReview, visitedOnly } = req.body ?? {};
        if (typeof questionId !== 'number' || !Number.isInteger(questionId)) {
          return res.status(400).json({ error: 'Valid questionId is required.' });
        }
        const saved = await saveAttemptAnswer({
          attemptUid: req.params.attemptUid,
          userId: req.currentUser!.id,
          questionId,
          selectedAnswer: selectedAnswer ?? null,
          isMarkedForReview: Boolean(isMarkedForReview),
          visitedOnly: Boolean(visitedOnly),
        });
        return res.json(saved);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save attempt answer.';
        return res.status(400).json({ error: message });
      }
    },
  );

  app.post(
    '/api/exams/attempts/:attemptUid/submit',
    requireAuth,
    async (req: AuthRequest, res) => {
      if (
        !enforceWindowLimit(
          examSubmitLimiter,
          `exam-submit:${req.currentUser!.id}`,
          15,
          60 * 1000,
          'Exam submission',
          res,
        )
      ) {
        return;
      }
      try {
        const reason = req.body?.reason === 'timeout' ? 'timeout' : 'manual';
        const outcome = await submitExamAttempt({
          attemptUid: req.params.attemptUid,
          userId: req.currentUser!.id,
          reason,
        });
        return res.json(outcome);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to submit examination.';
        return res.status(400).json({ error: message });
      }
    },
  );

  app.get('/api/exams/:id/result', requireAuth, async (req: AuthRequest, res) => {
    try {
      const attemptUid =
        typeof req.query.attemptUid === 'string' ? req.query.attemptUid : undefined;
      const resultView = await getExamResultView({
        examIdentifier: req.params.id,
        userId: req.currentUser!.id,
        attemptUid,
      });
      if (!resultView) {
        return res.status(404).json({ error: 'No submitted result found for this examination.' });
      }
      return res.json(resultView);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load exam result.';
      return res.status(400).json({ error: message });
    }
  });

  // ==========================================================================
  // Phase 5: Signature Student Features & Complete Student Dashboard Routes
  // ==========================================================================

  app.get('/api/dashboard', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getCompleteStudentDashboard(req.currentUser!.id);
      return res.json(data);
    } catch (error) {
      console.error('Student dashboard error:', error);
      return res.status(500).json({ error: 'Failed to load student dashboard.' });
    }
  });

  app.patch('/api/dashboard/goals', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await updateStudentGoalsConfig(req.currentUser!.id, req.body ?? {});
      return res.json({ goal: updated });
    } catch (error) {
      console.error('Update student goals error:', error);
      return res.status(500).json({ error: 'Failed to update goals and privacy settings.' });
    }
  });

  app.get('/api/mistakes', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getUserMistakesBundle({
        userId: req.currentUser!.id,
        subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
        chapter: typeof req.query.chapter === 'string' ? req.query.chapter : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
      });
      return res.json(data);
    } catch (error) {
      console.error('Mistake book load error:', error);
      return res.status(500).json({ error: 'Failed to load mistake book.' });
    }
  });

  app.post('/api/mistakes/record-practice', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { resourceId, mcqId, selectedIndex } = req.body ?? {};
      if (
        typeof resourceId !== 'number' ||
        !Number.isInteger(resourceId) ||
        typeof mcqId !== 'string' ||
        !mcqId.trim() ||
        typeof selectedIndex !== 'number' ||
        !Number.isInteger(selectedIndex)
      ) {
        return res.status(400).json({ error: 'Valid resourceId, mcqId, and selectedIndex are required.' });
      }
      const outcome = await recordChapterPracticeMcq({
        userId: req.currentUser!.id,
        resourceId,
        mcqId: mcqId.trim(),
        selectedIndex,
      });
      return res.json(outcome);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to record practice response.';
      return res.status(400).json({ error: message });
    }
  });

  app.post('/api/mistakes/:id/reattempt', requireAuth, async (req: AuthRequest, res) => {
    try {
      const mistakeId = Number(req.params.id);
      if (!Number.isInteger(mistakeId) || mistakeId <= 0) {
        return res.status(400).json({ error: 'Invalid mistake entry ID.' });
      }
      const { selectedAnswer } = req.body ?? {};
      if (!selectedAnswer || typeof selectedAnswer !== 'object') {
        return res.status(400).json({ error: 'selectedAnswer payload is required.' });
      }
      const outcome = await reattemptMistakeEntry({
        userId: req.currentUser!.id,
        mistakeId,
        selectedAnswer,
      });
      if (!outcome) {
        return res.status(404).json({ error: 'Mistake book entry not found.' });
      }
      return res.json(outcome);
    } catch (error) {
      console.error('Mistake reattempt error:', error);
      return res.status(500).json({ error: 'Failed to evaluate mistake reattempt.' });
    }
  });

  app.get('/api/practice/daily', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const mode = typeof req.query.mode === 'string' ? req.query.mode : 'daily_5';
      const data = await getDailyChallengeBundle({
        userId: req.currentUser?.id ?? null,
        mode,
        subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
        gradeLevel: typeof req.query.gradeLevel === 'string' ? req.query.gradeLevel : undefined,
        examSlug: typeof req.query.examSlug === 'string' ? req.query.examSlug : undefined,
      });
      return res.json(data);
    } catch (error) {
      console.error('Daily challenge load error:', error);
      return res.status(500).json({ error: 'Failed to load daily practice challenge.' });
    }
  });

  app.post('/api/practice/daily/submit', requireAuth, async (req: AuthRequest, res) => {
    if (
      !enforceWindowLimit(
        examSubmitLimiter,
        `daily-submit:${req.currentUser!.id}`,
        15,
        60 * 1000,
        'Daily challenge submission',
        res,
      )
    ) {
      return;
    }
    try {
      const { mode, answers } = req.body ?? {};
      if (!Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({ error: 'Answers array is required.' });
      }
      if (answers.length > 25) {
        return res.status(400).json({ error: 'Challenge submission cannot exceed 25 answers.' });
      }
      const result = await submitDailyChallenge({
        userId: req.currentUser!.id,
        mode: typeof mode === 'string' ? mode : 'daily_5',
        answers,
      });
      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to grade challenge.';
      return res.status(400).json({ error: message });
    }
  });

  app.get('/api/leaderboards', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const scope = typeof req.query.scope === 'string' ? req.query.scope : 'weekly';
      const data = await getLeaderboardsBundle({
        viewerUserId: req.currentUser?.id ?? null,
        scope,
        subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
        gradeLevel: typeof req.query.gradeLevel === 'string' ? req.query.gradeLevel : undefined,
      });
      return res.json(data);
    } catch (error) {
      console.error('Leaderboard load error:', error);
      return res.status(500).json({ error: 'Failed to load leaderboards.' });
    }
  });

  app.get('/api/flashcards', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getFlashcardsDeckBundle({
        userId: req.currentUser?.id ?? null,
        category: typeof req.query.category === 'string' ? req.query.category : undefined,
        subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
        dueOnly: req.query.dueOnly === 'true',
      });
      return res.json(data);
    } catch (error) {
      console.error('Flashcards load error:', error);
      return res.status(500).json({ error: 'Failed to load flashcards.' });
    }
  });

  app.post('/api/flashcards', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { category, academicLevel, subjectName, chapterName, frontText, backText, hintText } =
        req.body ?? {};
      if (
        typeof subjectName !== 'string' ||
        !subjectName.trim() ||
        typeof chapterName !== 'string' ||
        !chapterName.trim() ||
        typeof frontText !== 'string' ||
        frontText.trim().length < 2 ||
        typeof backText !== 'string' ||
        backText.trim().length < 2
      ) {
        return res.status(400).json({ error: 'Subject, chapter, front prompt, and back explanation are required.' });
      }
      const allowedCats = ['definition', 'formula', 'important_fact', 'vocabulary'] as const;
      const safeCat = allowedCats.includes(category) ? category : 'definition';

      const card = await createCustomFlashcardCard({
        userId: req.currentUser!.id,
        category: safeCat,
        academicLevel: typeof academicLevel === 'string' && academicLevel.trim() ? academicLevel : 'Custom Study',
        subjectName,
        chapterName,
        frontText,
        backText,
        hintText: typeof hintText === 'string' ? hintText : null,
      });
      return res.status(201).json({ card });
    } catch (error) {
      console.error('Create flashcard error:', error);
      return res.status(500).json({ error: 'Failed to save custom flashcard.' });
    }
  });

  app.post('/api/flashcards/:id/review', requireAuth, async (req: AuthRequest, res) => {
    try {
      const cardId = Number(req.params.id);
      if (!Number.isInteger(cardId) || cardId <= 0) {
        return res.status(400).json({ error: 'Invalid flashcard ID.' });
      }
      const rating = req.body?.rating;
      if (!['again', 'hard', 'good', 'easy'].includes(rating)) {
        return res.status(400).json({ error: 'Rating must be again, hard, good, or easy.' });
      }
      const result = await reviewFlashcardCard({
        userId: req.currentUser!.id,
        cardId,
        rating,
      });
      if (!result) {
        return res.status(404).json({ error: 'Flashcard not found.' });
      }
      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to schedule flashcard review.';
      return res.status(400).json({ error: message });
    }
  });

  app.get('/api/planner', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getPlannerBundle(req.currentUser!.id);
      return res.json(data);
    } catch (error) {
      console.error('Planner load error:', error);
      return res.status(500).json({ error: 'Failed to load study planner.' });
    }
  });

  app.post('/api/planner/plans', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { title, goalFocus, subjectName, gradeCode, startDate, endDate } = req.body ?? {};
      if (
        typeof title !== 'string' ||
        title.trim().length < 2 ||
        typeof subjectName !== 'string' ||
        !subjectName.trim() ||
        typeof startDate !== 'string' ||
        typeof endDate !== 'string'
      ) {
        return res.status(400).json({ error: 'Title, subject, startDate, and endDate are required.' });
      }
      const plan = await createStudyPlanEntry({
        userId: req.currentUser!.id,
        title,
        goalFocus: typeof goalFocus === 'string' && goalFocus.trim() ? goalFocus : 'Board & Entrance Mastery',
        subjectName,
        gradeCode: typeof gradeCode === 'string' ? gradeCode : 'G10',
        startDate,
        endDate,
      });
      return res.status(201).json({ plan });
    } catch (error) {
      console.error('Create study plan error:', error);
      return res.status(500).json({ error: 'Failed to create study plan.' });
    }
  });

  app.post('/api/planner/tasks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { planId, title, taskType, subjectName, chapterName, scheduledDate, estimatedMinutes } =
        req.body ?? {};
      if (
        typeof title !== 'string' ||
        title.trim().length < 2 ||
        typeof subjectName !== 'string' ||
        !subjectName.trim() ||
        typeof scheduledDate !== 'string'
      ) {
        return res.status(400).json({ error: 'Task title, subject, and scheduledDate are required.' });
      }
      const task = await createStudyTaskEntry({
        userId: req.currentUser!.id,
        planId: typeof planId === 'number' ? planId : null,
        title,
        taskType: typeof taskType === 'string' ? taskType : 'chapter_study',
        subjectName,
        chapterName: typeof chapterName === 'string' ? chapterName : null,
        scheduledDate,
        estimatedMinutes: typeof estimatedMinutes === 'number' ? estimatedMinutes : 30,
      });
      return res.status(201).json({ task });
    } catch (error) {
      console.error('Create study task error:', error);
      return res.status(500).json({ error: 'Failed to create study task.' });
    }
  });

  app.patch('/api/planner/tasks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const taskId = Number(req.params.id);
      if (!Number.isInteger(taskId) || taskId <= 0) {
        return res.status(400).json({ error: 'Invalid task ID.' });
      }
      const result = await toggleStudyTaskStatus({
        userId: req.currentUser!.id,
        taskId,
        isCompleted: Boolean(req.body?.isCompleted),
      });
      if (!result) {
        return res.status(404).json({ error: 'Study task not found.' });
      }
      return res.json(result);
    } catch (error) {
      console.error('Toggle study task error:', error);
      return res.status(500).json({ error: 'Failed to update task status.' });
    }
  });

  app.delete('/api/planner/tasks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const taskId = Number(req.params.id);
      if (!Number.isInteger(taskId) || taskId <= 0) {
        return res.status(400).json({ error: 'Invalid task ID.' });
      }
      const deleted = await deleteStudyTaskEntry(req.currentUser!.id, taskId);
      if (!deleted) {
        return res.status(404).json({ error: 'Study task not found.' });
      }
      return res.json({ deleted: true, id: taskId });
    } catch (error) {
      console.error('Delete study task error:', error);
      return res.status(500).json({ error: 'Failed to delete study task.' });
    }
  });

  // ============================================================================
  // Phase 6: Career, Course, College & Scholarship Explorer API
  // ============================================================================

  app.get('/api/explore/courses', async (_req, res) => {
    try {
      const data = await getCoursesDirectory();
      return res.json(data);
    } catch (error) {
      console.error('Explore courses load error:', error);
      return res.status(500).json({ error: 'Failed to load courses directory.' });
    }
  });

  app.get('/api/explore/courses/compare', async (req, res) => {
    try {
      const rawSlugs = typeof req.query.slugs === 'string' ? req.query.slugs : '';
      const slugs = rawSlugs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4);
      const data = await getCourseComparison(slugs);
      return res.json(data);
    } catch (error) {
      console.error('Course comparison error:', error);
      return res.status(500).json({ error: 'Failed to build course comparison.' });
    }
  });

  app.get('/api/explore/courses/:slug', async (req, res) => {
    try {
      const detail = await getCourseDetailBySlug(req.params.slug);
      if (!detail) {
        return res.status(404).json({ error: 'Course not found.' });
      }
      return res.json(detail);
    } catch (error) {
      console.error('Explore course detail error:', error);
      return res.status(500).json({ error: 'Failed to load course detail.' });
    }
  });

  app.get('/api/explore/colleges', async (_req, res) => {
    try {
      const data = await getCollegesDirectory();
      return res.json(data);
    } catch (error) {
      console.error('Explore colleges error:', error);
      return res.status(500).json({ error: 'Failed to load colleges directory.' });
    }
  });

  app.get('/api/explore/scholarships', async (_req, res) => {
    try {
      const data = await getScholarshipsDirectory();
      return res.json(data);
    } catch (error) {
      console.error('Explore scholarships error:', error);
      return res.status(500).json({ error: 'Failed to load scholarships.' });
    }
  });

  app.get('/api/explore/careers', async (_req, res) => {
    try {
      const data = await getCareerPathsDirectory();
      return res.json(data);
    } catch (error) {
      console.error('Explore careers error:', error);
      return res.status(500).json({ error: 'Failed to load career roadmaps.' });
    }
  });

  app.get('/api/explore/opportunities', async (_req, res) => {
    try {
      const data = await getOpportunitiesAndCalendar();
      return res.json(data);
    } catch (error) {
      console.error('Explore opportunities error:', error);
      return res.status(500).json({ error: 'Failed to load opportunities and calendar.' });
    }
  });

  app.get('/api/explore/bachelor-bridge', async (_req, res) => {
    try {
      const data = await getClass12BachelorBridgeData();
      return res.json(data);
    } catch (error) {
      console.error('Bachelor bridge load error:', error);
      return res.status(500).json({ error: 'Failed to load Class 12 bachelor journey data.' });
    }
  });

  // ============================================================================
  // Phase 7: Server-Side Gemini AI Learning Suite & Youth-Safe Student Community
  // ============================================================================

  const aiRateLimiter = new SlidingWindowRateLimiter();
  const AI_RATE_LIMIT_MAX = 15;
  const AI_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

  function consumeAiRateLimit(req: AuthRequest, res: express.Response): number | null {
    const key = req.currentUser
      ? `user:${req.currentUser.id}`
      : `ip:${req.ip || 'unknown'}`;
    const decision = aiRateLimiter.consume(key, AI_RATE_LIMIT_MAX, AI_RATE_LIMIT_WINDOW_MS);
    if (!decision.allowed) {
      res.setHeader('Retry-After', String(decision.retryAfterSeconds));
      res.status(429).json({
        error: `AI rate limit reached (${AI_RATE_LIMIT_MAX} requests per 5 minutes). Try again in ${decision.retryAfterSeconds}s.`,
      });
      return null;
    }
    return decision.remaining;
  }

  app.post('/api/ai/study-assistant', optionalAuth, async (req: AuthRequest, res) => {
    const remaining = consumeAiRateLimit(req, res);
    if (remaining === null) return;

    try {
      const { action, prompt, language, context } = req.body ?? {};
      const allowedActions = [
        'explain_simple',
        'solve_numerical',
        'summarize_chapter',
        'generate_practice_5',
        'explain_incorrect',
        'custom_chat',
      ];
      if (!allowedActions.includes(action)) {
        return res.status(400).json({ error: 'Invalid AI study assistant action.' });
      }

      const promptCheck = validateAiPromptText(prompt, {
        minLength: 2,
        maxLength: 2000,
        fieldName: 'Study prompt',
      });
      if (!promptCheck.valid) {
        return res.status(400).json({ error: promptCheck.error });
      }

      const safeLang = language === 'ne' ? 'ne' : 'en';
      const safeContext =
        context && typeof context === 'object'
          ? {
              mode: (
                ['chapter', 'exam_result', 'mistake'].includes(context.mode)
                  ? context.mode
                  : 'chapter'
              ) as 'chapter' | 'exam_result' | 'mistake',
              gradeLevel: typeof context.gradeLevel === 'string' ? context.gradeLevel.slice(0, 120) : undefined,
              subjectName: typeof context.subjectName === 'string' ? context.subjectName.slice(0, 120) : undefined,
              chapterName: typeof context.chapterName === 'string' ? context.chapterName.slice(0, 160) : undefined,
              topicName: typeof context.topicName === 'string' ? context.topicName.slice(0, 160) : undefined,
              chapterSummary: typeof context.chapterSummary === 'string' ? context.chapterSummary.slice(0, 1400) : undefined,
              questionPrompt: typeof context.questionPrompt === 'string' ? context.questionPrompt.slice(0, 1000) : undefined,
              studentAnswer: typeof context.studentAnswer === 'string' ? context.studentAnswer.slice(0, 400) : undefined,
              correctAnswer: typeof context.correctAnswer === 'string' ? context.correctAnswer.slice(0, 400) : undefined,
              officialExplanation: typeof context.officialExplanation === 'string' ? context.officialExplanation.slice(0, 800) : undefined,
            }
          : { mode: 'chapter' as const };

      const result = await runAiStudyAssistant({
        action,
        prompt: promptCheck.text,
        language: safeLang,
        context: safeContext,
      });

      return res.json({
        ...result,
        rateLimitRemaining: remaining,
      });
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode ?? 502;
      const message = err instanceof Error ? err.message : 'AI Study Assistant failed.';
      return res.status(status).json({ error: message });
    }
  });

  app.post('/api/ai/generate-questions', requireAuth, async (req: AuthRequest, res) => {
    const perms = req.currentUser!.permissions;
    if (
      !perms.includes('questions:manage') &&
      !perms.includes('curriculum:write') &&
      !perms.includes('curriculum:review') &&
      !perms.includes('system:admin')
    ) {
      return res.status(403).json({
        error: 'Teacher, Question Bank Manager, or Academic Reviewer access is required to generate draft questions.',
      });
    }

    const remaining = consumeAiRateLimit(req, res);
    if (remaining === null) return;

    try {
      const {
        gradeOrExam,
        subjectName,
        chapterName,
        topicName,
        questionType,
        difficulty,
        count,
        language,
        saveToBank,
      } = req.body ?? {};

      const examCheck = validateAiPromptText(gradeOrExam, { minLength: 2, maxLength: 80, fieldName: 'Class / Exam' });
      const subjCheck = validateAiPromptText(subjectName, { minLength: 2, maxLength: 80, fieldName: 'Subject' });
      const chapCheck = validateAiPromptText(chapterName, { minLength: 2, maxLength: 120, fieldName: 'Chapter' });
      const topicCheck = validateAiPromptText(topicName, { minLength: 2, maxLength: 120, fieldName: 'Topic' });

      if (!examCheck.valid) return res.status(400).json({ error: examCheck.error });
      if (!subjCheck.valid) return res.status(400).json({ error: subjCheck.error });
      if (!chapCheck.valid) return res.status(400).json({ error: chapCheck.error });
      if (!topicCheck.valid) return res.status(400).json({ error: topicCheck.error });

      const safeType = questionType === 'numerical' ? 'numerical' : 'single_mcq';
      const safeDiff = ['easy', 'medium', 'hard'].includes(difficulty)
        ? (difficulty as 'easy' | 'medium' | 'hard')
        : 'medium';
      const safeCount = typeof count === 'number' ? Math.max(1, Math.min(5, Math.round(count))) : 3;
      const safeLang = language === 'ne' ? 'ne' : 'en';

      const drafts = await runAiQuestionGenerator({
        gradeOrExam: examCheck.text,
        subjectName: subjCheck.text,
        chapterName: chapCheck.text,
        topicName: topicCheck.text,
        questionType: safeType,
        difficulty: safeDiff,
        count: safeCount,
        language: safeLang,
      });

      const savedQuestions = [];
      if (saveToBank !== false) {
        const actorName = req.currentUser!.profile?.fullName ?? req.currentUser!.email;
        const isSchool = /see|class\s*10|class\s*11|class\s*12|neb/i.test(examCheck.text);

        for (const draft of drafts) {
          const created = await createQuestionBankItem({
            actorId: req.currentUser!.id,
            actorName,
            academicLevel: isSchool ? 'Secondary & Higher Secondary' : 'Bachelor Entrance',
            examination: examCheck.text,
            subjectName: subjCheck.text,
            chapterName: chapCheck.text,
            topicName: topicCheck.text,
            questionType: draft.questionType,
            difficulty: safeDiff,
            questionContent: {
              prompt: draft.prompt,
              unitHint: draft.unitHint,
            },
            options: draft.options,
            correctAnswer:
              draft.questionType === 'numerical'
                ? { numericValue: draft.numericValue ?? 0, tolerance: 0.05 }
                : { optionKeys: [draft.correctOptionKey || 'A'] },
            explanation: draft.explanation,
            marks: draft.marks,
            negativeMarks: isSchool ? 0 : 0.1,
            source: 'AI-Generated — Pending Academic Review',
            language: safeLang,
            // Strict guardrail: always Draft until human Academic Review approves
            status: 'Draft',
            aiGenerated: true,
            reviewerLabel: 'Pending Academic Review',
            tags: ['ai-generated', 'pending-review', subjCheck.text],
          });
          savedQuestions.push(created);
        }
      }

      return res.status(201).json({
        questions: drafts,
        savedQuestions,
        notice:
          'All AI-generated questions have been saved strictly with status = Draft and flagged as "AI-Generated — Pending Academic Review". Human review and approval is required before appearing in live mock exams.',
        rateLimitRemaining: remaining,
      });
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode ?? 502;
      const message = err instanceof Error ? err.message : 'AI Question Generator failed.';
      return res.status(status).json({ error: message });
    }
  });

  app.post('/api/ai/study-plan', requireAuth, async (req: AuthRequest, res) => {
    const remaining = consumeAiRateLimit(req, res);
    if (remaining === null) return;

    try {
      const { examDate, subjects, dailyHours, targetGoal, gradeCode } = req.body ?? {};
      const goalCheck = validateAiPromptText(targetGoal || 'SEE / NEB Exam Mastery', {
        minLength: 2,
        maxLength: 140,
        fieldName: 'Target goal',
      });
      if (!goalCheck.valid) return res.status(400).json({ error: goalCheck.error });

      const safeSubjects = Array.isArray(subjects)
        ? subjects.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 8)
        : [];
      if (safeSubjects.length === 0) {
        return res.status(400).json({ error: 'Select at least one subject for AI study plan generation.' });
      }

      const todayIso = new Date().toISOString().slice(0, 10);
      const safeExamDate =
        typeof examDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(examDate)
          ? examDate
          : new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
      const safeHours =
        typeof dailyHours === 'number' && !Number.isNaN(dailyHours)
          ? Math.max(0.5, Math.min(10, dailyHours))
          : 2;

      const { weakTopics } = await getStudentWeakTopicsForPlanner(req.currentUser!.id);
      const generated = await runAiStudyPlanGenerator({
        examDate: safeExamDate,
        subjects: safeSubjects,
        dailyHours: safeHours,
        targetGoal: goalCheck.text,
        weakTopics,
        startDate: todayIso,
      });

      const endDt = new Date(`${todayIso}T00:00:00Z`);
      endDt.setUTCDate(endDt.getUTCDate() + 7);
      const endDate = endDt.toISOString().slice(0, 10);

      const saved = await saveAiGeneratedStudyPlan({
        userId: req.currentUser!.id,
        title: generated.planTitle,
        goalFocus: goalCheck.text,
        subjectName: safeSubjects[0],
        gradeCode: typeof gradeCode === 'string' && gradeCode.trim() ? gradeCode.trim() : 'G10',
        startDate: todayIso,
        endDate,
        tasks: generated.tasks.map((t) => {
          const dt = new Date(`${todayIso}T00:00:00Z`);
          dt.setUTCDate(dt.getUTCDate() + t.dayOffset);
          return {
            title: t.title,
            taskType: t.taskType,
            subjectName: t.subjectName,
            chapterName: t.chapterName,
            scheduledDate: dt.toISOString().slice(0, 10),
            estimatedMinutes: t.estimatedMinutes,
          };
        }),
      });

      return res.status(201).json({
        plan: saved.plan,
        tasks: saved.tasks,
        weakTopicsTargeted: weakTopics.length,
        rateLimitRemaining: remaining,
      });
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode ?? 502;
      const message = err instanceof Error ? err.message : 'AI Study Plan generation failed.';
      return res.status(status).json({ error: message });
    }
  });

  app.post('/api/ai/career-assistant', optionalAuth, async (req: AuthRequest, res) => {
    const remaining = consumeAiRateLimit(req, res);
    if (remaining === null) return;

    try {
      const promptCheck = validateAiPromptText(req.body?.prompt, {
        minLength: 3,
        maxLength: 1000,
        fieldName: 'Career question',
      });
      if (!promptCheck.valid) {
        return res.status(400).json({ error: promptCheck.error });
      }

      const grounding = await getVerifiedExplorerGroundingSnapshot();
      const result = await runAiCareerAssistant({
        prompt: promptCheck.text,
        grounding,
      });

      return res.json({
        ...result,
        rateLimitRemaining: remaining,
      });
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode ?? 502;
      const message = err instanceof Error ? err.message : 'AI Career Assistant failed.';
      return res.status(status).json({ error: message });
    }
  });

  app.get('/api/community', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getCommunityFeed({
        viewerUserId: req.currentUser?.id ?? null,
        viewerPermissions: req.currentUser?.permissions ?? ['curriculum:read'],
        viewerRoles: req.currentUser?.roles.map((r) => r.slug) ?? [],
        groupSlug: typeof req.query.groupSlug === 'string' ? req.query.groupSlug : undefined,
        filter: typeof req.query.filter === 'string' ? req.query.filter : undefined,
        search: typeof req.query.q === 'string' ? req.query.q : undefined,
      });
      return res.json(data);
    } catch (error) {
      console.error('Community feed error:', error);
      return res.status(500).json({ error: 'Failed to load student community.' });
    }
  });

  app.post('/api/community/posts', requireAuth, async (req: AuthRequest, res) => {
    if (
      !enforceWindowLimit(
        communityWriteLimiter,
        `community:${req.currentUser!.id}`,
        20,
        5 * 60 * 1000,
        'Community posting',
        res,
      )
    ) {
      return;
    }
    try {
      const { groupId, title, body, postType, tags } = req.body ?? {};
      if (typeof groupId !== 'number' || !Number.isInteger(groupId) || groupId <= 0) {
        return res.status(400).json({ error: 'Valid community groupId is required.' });
      }
      const titleCheck = validateAiPromptText(title, { minLength: 5, maxLength: 160, fieldName: 'Question title' });
      const bodyCheck = validateAiPromptText(body, { minLength: 10, maxLength: 3000, fieldName: 'Discussion body' });
      if (!titleCheck.valid) return res.status(400).json({ error: titleCheck.error });
      if (!bodyCheck.valid) return res.status(400).json({ error: bodyCheck.error });

      const safeType = ['question', 'explanation', 'resource_tip'].includes(postType)
        ? (postType as 'question' | 'explanation' | 'resource_tip')
        : 'question';

      const created = await createCommunityPost({
        authorId: req.currentUser!.id,
        groupId,
        title: titleCheck.text,
        body: bodyCheck.text,
        postType: safeType,
        tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : [],
      });
      return res.status(201).json({ post: created });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to publish discussion post.';
      return res.status(400).json({ error: message });
    }
  });

  app.post('/api/community/posts/:id/comments', requireAuth, async (req: AuthRequest, res) => {
    if (
      !enforceWindowLimit(
        communityWriteLimiter,
        `community:${req.currentUser!.id}`,
        20,
        5 * 60 * 1000,
        'Community reply',
        res,
      )
    ) {
      return;
    }
    try {
      const postId = Number(req.params.id);
      if (!Number.isInteger(postId) || postId <= 0) {
        return res.status(400).json({ error: 'Invalid post ID.' });
      }
      const bodyCheck = validateAiPromptText(req.body?.body, {
        minLength: 2,
        maxLength: 2500,
        fieldName: 'Reply',
      });
      if (!bodyCheck.valid) return res.status(400).json({ error: bodyCheck.error });

      const comment = await createCommunityComment({
        authorId: req.currentUser!.id,
        postId,
        body: bodyCheck.text,
      });
      return res.status(201).json({ comment });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to publish reply.';
      return res.status(400).json({ error: message });
    }
  });

  app.post('/api/community/vote', requireAuth, async (req: AuthRequest, res) => {
    if (
      !enforceWindowLimit(
        communityWriteLimiter,
        `community:${req.currentUser!.id}`,
        30,
        5 * 60 * 1000,
        'Community voting',
        res,
      )
    ) {
      return;
    }
    try {
      const { targetType, targetId } = req.body ?? {};
      if ((targetType !== 'post' && targetType !== 'comment') || typeof targetId !== 'number' || !Number.isInteger(targetId) || targetId <= 0) {
        return res.status(400).json({ error: 'Valid targetType and targetId are required.' });
      }
      const outcome = await toggleCommunityVote({
        userId: req.currentUser!.id,
        targetType,
        targetId,
      });
      return res.json(outcome);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update vote.';
      const status = message.includes('not found') ? 404 : 500;
      return res.status(status).json({ error: message });
    }
  });

  app.patch('/api/community/comments/:id/verify', requireAuth, async (req: AuthRequest, res) => {
    try {
      const roleSlugs = req.currentUser!.roles.map((r) => r.slug);
      if (!canMarkTeacherVerified(req.currentUser!.permissions, roleSlugs)) {
        return res.status(403).json({
          error: 'Only authenticated Teachers, Academic Reviewers, or Administrators can mark Teacher-Verified explanations.',
        });
      }
      const commentId = Number(req.params.id);
      if (!Number.isInteger(commentId) || commentId <= 0) {
        return res.status(400).json({ error: 'Invalid comment ID.' });
      }
      const verifierName = req.currentUser!.profile?.fullName ?? 'Verified Educator';
      const updated = await toggleTeacherVerifiedComment({
        commentId,
        verifierId: req.currentUser!.id,
        verifierName,
        verified: req.body?.verified !== false,
      });
      if (!updated) {
        return res.status(404).json({ error: 'Comment not found.' });
      }
      return res.json({ comment: updated });
    } catch (error) {
      console.error('Teacher verify comment error:', error);
      return res.status(500).json({ error: 'Failed to verify answer.' });
    }
  });

  app.post('/api/community/reports', requireAuth, async (req: AuthRequest, res) => {
    if (
      !enforceWindowLimit(
        communityReportLimiter,
        `report:${req.currentUser!.id}`,
        6,
        10 * 60 * 1000,
        'Community reporting',
        res,
      )
    ) {
      return;
    }
    try {
      const { targetType, targetId, reason, details } = req.body ?? {};
      if ((targetType !== 'post' && targetType !== 'comment') || typeof targetId !== 'number' || !Number.isInteger(targetId) || targetId <= 0) {
        return res.status(400).json({ error: 'Valid targetType and targetId are required.' });
      }
      const reasonCheck = validateAiPromptText(reason || 'Inappropriate or inaccurate content', {
        minLength: 3,
        maxLength: 100,
        fieldName: 'Report reason',
      });
      if (!reasonCheck.valid) return res.status(400).json({ error: reasonCheck.error });

      const report = await submitCommunityReport({
        reporterId: req.currentUser!.id,
        targetType,
        targetId,
        reason: reasonCheck.text,
        details: typeof details === 'string' ? details : '',
      });
      return res.status(201).json({ report });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit report.';
      const status = message.includes('already submitted') ? 409 : 400;
      return res.status(status).json({ error: message });
    }
  });

  app.post('/api/community/moderation/resolve', requireAuth, async (req: AuthRequest, res) => {
    try {
      const roleSlugs = req.currentUser!.roles.map((r) => r.slug);
      if (!canModerateCommunity(req.currentUser!.permissions, roleSlugs)) {
        return res.status(403).json({
          error: 'Moderator or Administrator privileges required for moderation actions.',
        });
      }
      const { reportId, targetType, targetId, actionType, reasonNotes } = req.body ?? {};
      if (
        (targetType !== 'post' && targetType !== 'comment') ||
        typeof targetId !== 'number' ||
        !['approve', 'hide', 'restore', 'dismiss_report'].includes(actionType)
      ) {
        return res.status(400).json({ error: 'Invalid moderation action parameters.' });
      }
      const action = await resolveCommunityModeration({
        reportId: typeof reportId === 'number' ? reportId : undefined,
        moderatorId: req.currentUser!.id,
        targetType,
        targetId,
        actionType,
        reasonNotes: typeof reasonNotes === 'string' ? reasonNotes : `Action ${actionType} applied`,
      });
      await recordAuditLog({
        actor: {
          id: req.currentUser!.id,
          email: req.currentUser!.email,
          roles: roleSlugs,
          ipAddress: req.ip ?? null,
        },
        action: 'COMMUNITY_MODERATION_ACTION',
        targetEntity: targetType,
        targetId,
        summary: `Moderation '${actionType}' on ${targetType} #${targetId}.`,
        metadata: { reportId: reportId ?? null, reasonNotes: reasonNotes ?? '' },
      });
      return res.json({ action });
    } catch (error) {
      console.error('Community moderation resolve error:', error);
      return res.status(500).json({ error: 'Failed to execute moderation action.' });
    }
  });

  // ============================================================================
  // Phase 8: Complete Nepal Administration System, RBAC & Content Governance
  // ============================================================================

  function toAuditActor(req: AuthRequest): AuditActorInfo {
    const u = req.currentUser!;
    return {
      id: u.id,
      email: u.email,
      roles: u.roles.map((r) => r.slug),
      permissions: u.permissions,
      fullName: u.profile?.fullName ?? null,
      ipAddress: req.ip ?? null,
    };
  }

  function hasAdminModuleAccess(req: AuthRequest, moduleId: AdminModuleId): boolean {
    if (!req.currentUser) return false;
    const roleSlugs = req.currentUser.roles.map((r) => r.slug);
    const allowed = getAllowedAdminModules(req.currentUser.permissions, roleSlugs);
    return allowed.includes(moduleId);
  }

  function requireAdminModule(moduleId: AdminModuleId) {
    return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
      if (!hasAdminModuleAccess(req, moduleId)) {
        return res.status(403).json({
          error: `Your current role does not grant access to the '${moduleId}' administration module.`,
        });
      }
      return next();
    };
  }

  // Public published announcements for student workspaces
  app.get('/api/announcements', async (_req, res) => {
    try {
      const items = await getAnnouncementsFeed(true);
      return res.json({ announcements: items });
    } catch (error) {
      console.error('Public announcements error:', error);
      return res.status(500).json({ error: 'Failed to load announcements.' });
    }
  });

  // Admin Overview Metrics (Section 14.1)
  app.get('/api/admin/overview', requireAuth, async (req: AuthRequest, res) => {
    try {
      const roleSlugs = req.currentUser!.roles.map((r) => r.slug);
      const allowed = getAllowedAdminModules(req.currentUser!.permissions, roleSlugs);
      if (allowed.length === 0) {
        return res.status(403).json({
          error: 'Administration Portal requires Educator, Reviewer, Moderator, Manager, or Administrator privileges.',
        });
      }
      const data = await getAdminOverviewMetrics(roleSlugs, req.currentUser!.permissions);
      return res.json(data);
    } catch (error) {
      console.error('Admin overview error:', error);
      return res.status(500).json({ error: 'Failed to load administration overview metrics.' });
    }
  });

  // Admin User Management
  app.get(
    '/api/admin/users',
    requireAuth,
    requireAdminModule('users'),
    async (_req, res) => {
      try {
        const list = await getUsersDirectory();
        return res.json({ users: list });
      } catch (error) {
        console.error('Admin users list error:', error);
        return res.status(500).json({ error: 'Failed to load user directory.' });
      }
    },
  );

  app.patch(
    '/api/admin/users/:id',
    requireAuth,
    requireAdminModule('users'),
    async (req: AuthRequest, res) => {
      try {
        const userId = Number(req.params.id);
        if (!Number.isInteger(userId) || userId <= 0) {
          return res.status(400).json({ error: 'Invalid user ID.' });
        }
        const { status, institutionId, fullName } = req.body ?? {};
        if (status !== undefined && status !== 'active' && status !== 'suspended') {
          return res.status(400).json({ error: 'Status must be active or suspended.' });
        }
        const updated = await adminUpdateUserAccount({
          actor: toAuditActor(req),
          userId,
          status,
          institutionId:
            institutionId === null ||
            (typeof institutionId === 'number' && Number.isInteger(institutionId) && institutionId > 0)
              ? institutionId
              : undefined,
          fullName: typeof fullName === 'string' ? fullName : undefined,
        });
        if (!updated) {
          return res.status(404).json({ error: 'User not found.' });
        }
        return res.json(updated);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update user account.';
        const statusCode = message.startsWith('Forbidden:') ? 403 : 400;
        return res.status(statusCode).json({ error: message });
      }
    },
  );

  // Admin Curriculum Creation (Subjects, Chapters, Topics)
  app.post(
    '/api/admin/curriculum/subjects',
    requireAuth,
    requireAdminModule('curriculum'),
    async (req: AuthRequest, res) => {
      try {
        const { streamId, code, name, creditHours, isCompulsory } = req.body ?? {};
        if (typeof streamId !== 'number' || typeof code !== 'string' || typeof name !== 'string') {
          return res.status(400).json({ error: 'Valid streamId, code, and name are required.' });
        }
        const subject = await adminCreateSubjectNode({
          actor: toAuditActor(req),
          streamId,
          code,
          name,
          creditHours: Number(creditHours || 4),
          isCompulsory: Boolean(isCompulsory ?? true),
        });
        return res.status(201).json({ subject });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create subject.';
        return res.status(400).json({ error: message });
      }
    },
  );

  app.post(
    '/api/admin/curriculum/chapters',
    requireAuth,
    requireAdminModule('curriculum'),
    async (req: AuthRequest, res) => {
      try {
        const { subjectId, chapterNumber, title, summary, estimatedHours } = req.body ?? {};
        if (typeof subjectId !== 'number' || typeof title !== 'string' || title.trim().length < 2) {
          return res.status(400).json({ error: 'Valid subjectId and chapter title are required.' });
        }
        const chapter = await adminCreateChapterNode({
          actor: toAuditActor(req),
          subjectId,
          chapterNumber: Number(chapterNumber || 1),
          title,
          summary: typeof summary === 'string' ? summary : 'Core Nepal CDC/NEB syllabus unit.',
          estimatedHours: Number(estimatedHours || 8),
        });
        return res.status(201).json({ chapter });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create chapter.';
        return res.status(400).json({ error: message });
      }
    },
  );

  app.post(
    '/api/admin/curriculum/topics',
    requireAuth,
    requireAdminModule('curriculum'),
    async (req: AuthRequest, res) => {
      try {
        const { chapterId, topicNumber, title, learningObjectives, difficultyLevel, estimatedMinutes } =
          req.body ?? {};
        if (
          typeof chapterId !== 'number' ||
          typeof topicNumber !== 'string' ||
          typeof title !== 'string' ||
          title.trim().length < 2
        ) {
          return res.status(400).json({ error: 'Valid chapterId, topicNumber, and title are required.' });
        }
        const topic = await adminCreateTopicNode({
          actor: toAuditActor(req),
          chapterId,
          topicNumber,
          title,
          learningObjectives:
            typeof learningObjectives === 'string' && learningObjectives.trim()
              ? learningObjectives
              : 'Understand core concepts and solve board-level exercises.',
          difficultyLevel: typeof difficultyLevel === 'string' ? difficultyLevel : 'intermediate',
          estimatedMinutes: Number(estimatedMinutes || 45),
        });
        return res.status(201).json({ topic });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create topic.';
        return res.status(400).json({ error: message });
      }
    },
  );

  // Admin Content Management & 6-Stage Lifecycle
  app.get(
    '/api/admin/content',
    requireAuth,
    requireAdminModule('content'),
    async (_req, res) => {
      try {
        const data = await adminListContentGovernance();
        return res.json(data);
      } catch (error) {
        console.error('Admin content list error:', error);
        return res.status(500).json({ error: 'Failed to load content governance list.' });
      }
    },
  );

  app.post(
    '/api/admin/content',
    requireAuth,
    requireAdminModule('content'),
    async (req: AuthRequest, res) => {
      try {
        const {
          categorySlug,
          gradeId,
          streamId,
          subjectId,
          chapterId,
          title,
          summary,
          notesHeading,
          notesBody,
          sourceSlug,
          initialStage,
        } = req.body ?? {};
        if (
          typeof categorySlug !== 'string' ||
          typeof gradeId !== 'number' ||
          typeof subjectId !== 'number' ||
          typeof title !== 'string' ||
          title.trim().length < 3 ||
          typeof summary !== 'string' ||
          typeof notesBody !== 'string'
        ) {
          return res.status(400).json({ error: 'Missing required content fields.' });
        }
        const created = await adminCreateManagedResource({
          actor: toAuditActor(req),
          categorySlug,
          gradeId,
          streamId: typeof streamId === 'number' ? streamId : null,
          subjectId,
          chapterId: typeof chapterId === 'number' ? chapterId : null,
          title,
          summary,
          notesHeading: typeof notesHeading === 'string' ? notesHeading : title,
          notesBody,
          sourceSlug: typeof sourceSlug === 'string' ? sourceSlug : 'hamro-faculty-original',
          initialStage: initialStage === 'Review' ? 'Review' : 'Draft',
        });
        return res.status(201).json({ resource: created });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create resource.';
        return res.status(400).json({ error: message });
      }
    },
  );

  app.patch(
    '/api/admin/content/:id/lifecycle',
    requireAuth,
    requireAdminModule('content'),
    async (req: AuthRequest, res) => {
      try {
        const resourceId = Number(req.params.id);
        if (!Number.isInteger(resourceId) || resourceId <= 0) {
          return res.status(400).json({ error: 'Invalid resource ID.' });
        }
        const { nextStage, comments, sourceSlug } = req.body ?? {};
        const normalizedStage = normalizeLifecycleStage(String(nextStage ?? ''));
        if (!EDITORIAL_LIFECYCLE_STAGES.includes(normalizedStage)) {
          return res.status(400).json({ error: 'Invalid editorial lifecycle stage.' });
        }
        const updated = await adminTransitionResourceLifecycle({
          actor: toAuditActor(req),
          resourceId,
          nextStage: normalizedStage,
          comments: typeof comments === 'string' ? comments : '',
          sourceSlug: typeof sourceSlug === 'string' ? sourceSlug : undefined,
        });
        if (!updated) {
          return res.status(404).json({ error: 'Resource not found.' });
        }
        return res.json({ resource: updated });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update lifecycle status.';
        const status = message.includes('Only ') || message.includes('requires') || message.includes('Insufficient')
          ? 403
          : 400;
        return res.status(status).json({ error: message });
      }
    },
  );

  // Admin Question Bank Governance (CSV Bulk Import, Duplicate Check, Edit, 6-Stage Lifecycle)
  app.post(
    '/api/admin/questions/import-csv',
    requireAuth,
    requireAdminModule('questions'),
    async (req: AuthRequest, res) => {
      if (
        !enforceWindowLimit(
          csvImportLimiter,
          `csv-import:${req.currentUser!.id}`,
          10,
          10 * 60 * 1000,
          'CSV bulk import',
          res,
        )
      ) {
        return;
      }
      try {
        const { csvText, initialStage } = req.body ?? {};
        if (typeof csvText !== 'string' || csvText.trim().length < 10) {
          return res.status(400).json({ error: 'Valid CSV text payload is required.' });
        }
        if (csvText.length > CSV_IMPORT_MAX_CHARS) {
          return res.status(400).json({
            error: `CSV payload exceeds the ${Math.round(CSV_IMPORT_MAX_CHARS / 1000)} KB batch limit.`,
          });
        }
        const report = await adminBulkImportQuestionsCsv({
          actor: toAuditActor(req),
          csvText,
          initialStage: initialStage === 'Review' ? 'Review' : 'Draft',
        });
        return res.status(201).json(report);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'CSV import failed.';
        return res.status(400).json({ error: message });
      }
    },
  );

  app.patch(
    '/api/admin/questions/:id',
    requireAuth,
    requireAdminModule('questions'),
    async (req: AuthRequest, res) => {
      try {
        const questionId = Number(req.params.id);
        if (!Number.isInteger(questionId) || questionId <= 0) {
          return res.status(400).json({ error: 'Invalid question ID.' });
        }
        const { prompt, explanation, difficulty, marks, negativeMarks, source } = req.body ?? {};
        const updated = await adminUpdateQuestionFields({
          actor: toAuditActor(req),
          questionId,
          prompt: typeof prompt === 'string' ? prompt : undefined,
          explanation: typeof explanation === 'string' ? explanation : undefined,
          difficulty: typeof difficulty === 'string' ? difficulty : undefined,
          marks: typeof marks === 'number' ? marks : undefined,
          negativeMarks: typeof negativeMarks === 'number' ? negativeMarks : undefined,
          source: typeof source === 'string' ? source : undefined,
        });
        if (!updated) {
          return res.status(404).json({ error: 'Question not found.' });
        }
        return res.json({ question: updated });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update question.';
        const statusCode = message.startsWith('Forbidden:') ? 403 : 400;
        return res.status(statusCode).json({ error: message });
      }
    },
  );

  app.patch(
    '/api/admin/questions/:id/lifecycle',
    requireAuth,
    requireAdminModule('questions'),
    async (req: AuthRequest, res) => {
      try {
        const questionId = Number(req.params.id);
        if (!Number.isInteger(questionId) || questionId <= 0) {
          return res.status(400).json({ error: 'Invalid question ID.' });
        }
        const { nextStage, comment, updatedPrompt, updatedExplanation, verifiedSource } =
          req.body ?? {};
        const normalizedStage = normalizeLifecycleStage(String(nextStage ?? ''));
        if (!EDITORIAL_LIFECYCLE_STAGES.includes(normalizedStage)) {
          return res.status(400).json({ error: 'Invalid editorial lifecycle stage.' });
        }
        const updated = await adminTransitionQuestionLifecycle({
          actor: toAuditActor(req),
          questionId,
          nextStage: normalizedStage,
          comment: typeof comment === 'string' ? comment : undefined,
          updatedPrompt: typeof updatedPrompt === 'string' ? updatedPrompt : undefined,
          updatedExplanation: typeof updatedExplanation === 'string' ? updatedExplanation : undefined,
          verifiedSource: typeof verifiedSource === 'string' ? verifiedSource : undefined,
        });
        if (!updated) {
          return res.status(404).json({ error: 'Question not found.' });
        }
        return res.json({ question: updated });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Lifecycle transition failed.';
        const status =
          message.includes('AI-generated') ||
          message.includes('Only ') ||
          message.includes('requires') ||
          message.includes('verified source') ||
          message.includes('Insufficient')
            ? 403
            : 400;
        return res.status(status).json({ error: message });
      }
    },
  );

  // Admin Examination Management & Results
  app.get(
    '/api/admin/exams',
    requireAuth,
    requireAdminModule('exams'),
    async (_req, res) => {
      try {
        const examsList = await adminListExamsWithStats();
        return res.json({ exams: examsList });
      } catch (error) {
        console.error('Admin exams list error:', error);
        return res.status(500).json({ error: 'Failed to load exams configuration.' });
      }
    },
  );

  app.post(
    '/api/admin/exams',
    requireAuth,
    requireAdminModule('exams'),
    async (req: AuthRequest, res) => {
      try {
        const body = req.body ?? {};
        if (typeof body.title !== 'string' || body.title.trim().length < 3) {
          return res.status(400).json({ error: 'Exam title (min 3 characters) is required.' });
        }
        const saved = await adminCreateOrUpdateExam({
          actor: toAuditActor(req),
          title: body.title,
          slug: typeof body.slug === 'string' ? body.slug : undefined,
          category: typeof body.category === 'string' ? body.category : 'school',
          examinationSlug: typeof body.examinationSlug === 'string' ? body.examinationSlug : 'see',
          academicLevel: typeof body.academicLevel === 'string' ? body.academicLevel : 'Secondary / SEE',
          subjectScope: typeof body.subjectScope === 'string' ? body.subjectScope : 'All Subjects',
          totalMarks: Number(body.totalMarks || 100),
          durationMinutes: Number(body.durationMinutes || 60),
          negativeEnabled: Boolean(body.negativeEnabled),
          deductionPerWrong: Number(body.deductionPerWrong || 0.25),
          randomizeQuestions: Boolean(body.randomizeQuestions),
          randomizeOptions: Boolean(body.randomizeOptions),
          startWindow: typeof body.startWindow === 'string' ? body.startWindow : null,
          endWindow: typeof body.endWindow === 'string' ? body.endWindow : null,
          attemptLimit: Number(body.attemptLimit || 5),
          status: ['draft', 'published', 'archived'].includes(body.status) ? body.status : 'draft',
          instructions: typeof body.instructions === 'string' ? body.instructions : undefined,
        });
        return res.status(201).json({ exam: saved });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create exam.';
        return res.status(400).json({ error: message });
      }
    },
  );

  app.patch(
    '/api/admin/exams/:id',
    requireAuth,
    requireAdminModule('exams'),
    async (req: AuthRequest, res) => {
      try {
        const examId = Number(req.params.id);
        if (!Number.isInteger(examId) || examId <= 0) {
          return res.status(400).json({ error: 'Invalid exam ID.' });
        }
        const body = req.body ?? {};
        if (typeof body.title !== 'string' || body.title.trim().length < 3) {
          return res.status(400).json({ error: 'Exam title is required.' });
        }
        const updated = await adminCreateOrUpdateExam({
          actor: toAuditActor(req),
          examId,
          title: body.title,
          category: typeof body.category === 'string' ? body.category : 'school',
          examinationSlug: typeof body.examinationSlug === 'string' ? body.examinationSlug : 'see',
          academicLevel: typeof body.academicLevel === 'string' ? body.academicLevel : 'Secondary / SEE',
          subjectScope: typeof body.subjectScope === 'string' ? body.subjectScope : 'All Subjects',
          totalMarks: Number(body.totalMarks || 100),
          durationMinutes: Number(body.durationMinutes || 60),
          negativeEnabled: Boolean(body.negativeEnabled),
          deductionPerWrong: Number(body.deductionPerWrong || 0.25),
          randomizeQuestions: Boolean(body.randomizeQuestions),
          randomizeOptions: Boolean(body.randomizeOptions),
          startWindow: typeof body.startWindow === 'string' ? body.startWindow : null,
          endWindow: typeof body.endWindow === 'string' ? body.endWindow : null,
          attemptLimit: Number(body.attemptLimit || 5),
          status: ['draft', 'published', 'archived'].includes(body.status) ? body.status : 'published',
          instructions: typeof body.instructions === 'string' ? body.instructions : undefined,
        });
        if (!updated) {
          return res.status(404).json({ error: 'Exam not found.' });
        }
        return res.json({ exam: updated });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update exam.';
        return res.status(400).json({ error: message });
      }
    },
  );

  app.get(
    '/api/admin/exams/:id/results',
    requireAuth,
    requireAdminModule('exams'),
    async (req: AuthRequest, res) => {
      try {
        const examId = Number(req.params.id);
        if (!Number.isInteger(examId) || examId <= 0) {
          return res.status(400).json({ error: 'Invalid exam ID.' });
        }
        const results = await adminGetExamResults(examId);
        return res.json({ results });
      } catch (error) {
        console.error('Admin exam results error:', error);
        return res.status(500).json({ error: 'Failed to load exam attempt results.' });
      }
    },
  );

  // Admin Entrance & Explorer Catalog Management
  app.get(
    '/api/admin/explorer',
    requireAuth,
    async (req: AuthRequest, res) => {
      if (!hasAdminModuleAccess(req, 'entrance') && !hasAdminModuleAccess(req, 'explorer')) {
        return res.status(403).json({ error: 'Entrance or Career Explorer management access required.' });
      }
      try {
        const data = await adminGetExplorerCatalog();
        return res.json(data);
      } catch (error) {
        console.error('Admin explorer catalog error:', error);
        return res.status(500).json({ error: 'Failed to load explorer catalog.' });
      }
    },
  );

  app.post(
    '/api/admin/explorer/entrance',
    requireAuth,
    requireAdminModule('entrance'),
    async (req: AuthRequest, res) => {
      try {
        const body = req.body ?? {};
        if (!body.slug || !body.code || !body.name || !body.conductingBody || !body.source || !body.lastVerifiedDate) {
          return res.status(400).json({ error: 'slug, code, name, conductingBody, source, and lastVerifiedDate are required.' });
        }
        const saved = await adminUpsertEntranceExamRecord({
          actor: toAuditActor(req),
          slug: String(body.slug),
          code: String(body.code),
          name: String(body.name),
          conductingBody: String(body.conductingBody),
          academicCategory: String(body.academicCategory || 'Engineering & IT'),
          examPatternSummary: String(body.examPatternSummary || '100 MCQs · 2 Hours'),
          eligibilitySummary: String(body.eligibilitySummary || '+2 Science or equivalent'),
          officialUrl: String(body.officialUrl || 'https://tu.edu.np'),
          source: String(body.source),
          lastVerifiedDate: String(body.lastVerifiedDate),
        });
        return res.status(201).json({ entranceExam: saved });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save entrance exam.';
        return res.status(400).json({ error: message });
      }
    },
  );

  app.post(
    '/api/admin/explorer/courses',
    requireAuth,
    requireAdminModule('explorer'),
    async (req: AuthRequest, res) => {
      try {
        const body = req.body ?? {};
        if (!body.slug || !body.code || !body.name || !body.universityId || !body.source || !body.lastVerifiedDate) {
          return res.status(400).json({ error: 'slug, code, name, universityId, source, and lastVerifiedDate are required.' });
        }
        const saved = await adminCreateCourseRecord({
          actor: toAuditActor(req),
          slug: String(body.slug),
          code: String(body.code),
          name: String(body.name),
          fullForm: String(body.fullForm || body.name),
          category: String(body.category || 'IT & Computer Science'),
          universityId: Number(body.universityId),
          durationYears: Number(body.durationYears || 4),
          eligibility: String(body.eligibility || '+2 or equivalent with minimum required GPA.'),
          admissionProcess: String(body.admissionProcess || 'University Entrance Examination + Merit Counseling'),
          verifiedFeeMinNpr: Number(body.verifiedFeeMinNpr || 350000),
          verifiedFeeMaxNpr: Number(body.verifiedFeeMaxNpr || 850000),
          verifiedFeeNote: String(body.verifiedFeeNote || 'Constituent vs affiliated college fee range'),
          streamRecommendation: String(body.streamRecommendation || '+2 Science / Management'),
          source: String(body.source),
          lastVerifiedDate: String(body.lastVerifiedDate),
        });
        return res.status(201).json({ course: saved });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save course.';
        return res.status(400).json({ error: message });
      }
    },
  );

  app.post(
    '/api/admin/explorer/scholarships',
    requireAuth,
    requireAdminModule('explorer'),
    async (req: AuthRequest, res) => {
      try {
        const body = req.body ?? {};
        if (!body.slug || !body.title || !body.provider || !body.source || !body.lastVerifiedDate) {
          return res.status(400).json({ error: 'slug, title, provider, source, and lastVerifiedDate are required.' });
        }
        const saved = await adminCreateScholarshipRecord({
          actor: toAuditActor(req),
          slug: String(body.slug),
          title: String(body.title),
          provider: String(body.provider),
          category: String(body.category || 'Government Scholarships'),
          eligibility: String(body.eligibility || 'Nepali citizens meeting merit & quota criteria.'),
          financialBenefits: String(body.financialBenefits || 'Full or partial tuition waiver.'),
          applicationDeadline: String(body.applicationDeadline || '2083 Ashwin'),
          officialSourceUrl: String(body.officialSourceUrl || 'https://moest.gov.np'),
          source: String(body.source),
          lastVerifiedDate: String(body.lastVerifiedDate),
        });
        return res.status(201).json({ scholarship: saved });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save scholarship.';
        return res.status(400).json({ error: message });
      }
    },
  );

  // Admin Announcements
  app.get(
    '/api/admin/announcements',
    requireAuth,
    requireAdminModule('announcements'),
    async (_req, res) => {
      try {
        const announcements = await getAnnouncementsFeed(false);
        return res.json({ announcements });
      } catch (error) {
        console.error('Admin announcements list error:', error);
        return res.status(500).json({ error: 'Failed to load announcements.' });
      }
    },
  );

  app.post(
    '/api/admin/announcements',
    requireAuth,
    requireAdminModule('announcements'),
    async (req: AuthRequest, res) => {
      try {
        const { title, message, category, audienceRole, isPublished } = req.body ?? {};
        if (
          typeof title !== 'string' ||
          title.trim().length < 3 ||
          typeof message !== 'string' ||
          message.trim().length < 5
        ) {
          return res.status(400).json({ error: 'Announcement title and message are required.' });
        }
        const announcement = await adminCreateAnnouncement({
          actor: toAuditActor(req),
          title,
          message,
          category: typeof category === 'string' ? category : 'announcement',
          audienceRole: typeof audienceRole === 'string' ? audienceRole : 'all_students',
          isPublished: isPublished !== false,
        });
        return res.status(201).json({ announcement });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to create announcement.';
        return res.status(400).json({ error: msg });
      }
    },
  );

  app.patch(
    '/api/admin/announcements/:id',
    requireAuth,
    requireAdminModule('announcements'),
    async (req: AuthRequest, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json({ error: 'Invalid announcement ID.' });
        }
        const updated = await adminToggleAnnouncementPublished({
          actor: toAuditActor(req),
          id,
          isPublished: Boolean(req.body?.isPublished),
        });
        if (!updated) {
          return res.status(404).json({ error: 'Announcement not found.' });
        }
        return res.json({ announcement: updated });
      } catch (error) {
        console.error('Toggle announcement error:', error);
        return res.status(500).json({ error: 'Failed to update announcement.' });
      }
    },
  );

  // Admin Analytics
  app.get(
    '/api/admin/analytics',
    requireAuth,
    requireAdminModule('analytics'),
    async (_req, res) => {
      try {
        const data = await getAdminAnalyticsBundle();
        return res.json(data);
      } catch (error) {
        console.error('Admin analytics error:', error);
        return res.status(500).json({ error: 'Failed to load platform analytics.' });
      }
    },
  );

  // Admin Nepal-Scoped System Settings
  app.get(
    '/api/admin/settings',
    requireAuth,
    requireAdminModule('settings'),
    async (_req, res) => {
      try {
        const settings = await getNepalSystemSettings();
        return res.json({ settings });
      } catch (error) {
        console.error('Admin settings load error:', error);
        return res.status(500).json({ error: 'Failed to load Nepal system settings.' });
      }
    },
  );

  app.patch(
    '/api/admin/settings',
    requireAuth,
    requireAdminModule('settings'),
    async (req: AuthRequest, res) => {
      try {
        const { settingKey, valueJson } = req.body ?? {};
        if (typeof settingKey !== 'string' || !valueJson || typeof valueJson !== 'object') {
          return res.status(400).json({ error: 'Valid settingKey and valueJson object are required.' });
        }
        const updated = await adminUpdateNepalSetting({
          actor: toAuditActor(req),
          settingKey,
          valueJson,
        });
        if (!updated) {
          return res.status(404).json({ error: 'Setting key not found.' });
        }
        return res.json({ setting: updated });
      } catch (error) {
        console.error('Admin update setting error:', error);
        return res.status(500).json({ error: 'Failed to update system setting.' });
      }
    },
  );

  // Admin Audit Logs
  app.get(
    '/api/admin/audit-logs',
    requireAuth,
    requireAdminModule('audit_logs'),
    async (req: AuthRequest, res) => {
      try {
        const logs = await getAuditLogsList({
          action: typeof req.query.action === 'string' ? req.query.action : undefined,
          targetEntity: typeof req.query.targetEntity === 'string' ? req.query.targetEntity : undefined,
          search: typeof req.query.search === 'string' ? req.query.search : undefined,
        });
        return res.json({ logs });
      } catch (error) {
        console.error('Audit logs load error:', error);
        return res.status(500).json({ error: 'Failed to load audit logs.' });
      }
    },
  );

  // Vite middleware (dev) or static dist serving (production)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Hamro Education server listening on http://0.0.0.0:${port}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start Hamro Education server:', err);
  process.exit(1);
});
