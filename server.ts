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
import { ensureSeeded } from './src/db/seed.ts';
import { hashPassword, signSessionToken, verifyPassword } from './src/lib/auth-crypto.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import {
  canAssignRole,
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
      if (typeof countryId === 'number' || countryId === null) {
        updates.countryId = countryId;
      }
      if (typeof preferredLanguageId === 'number' || preferredLanguageId === null) {
        updates.preferredLanguageId = preferredLanguageId;
      }
      if (typeof institutionId === 'number' || institutionId === null) {
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

        if (
          assignment.roleSlug === 'super_administrator' &&
          !actorRoleSlugs.includes('super_administrator')
        ) {
          return res.status(403).json({
            error: 'Only a Super Administrator can revoke another Super Administrator.',
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
