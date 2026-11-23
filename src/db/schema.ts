import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ============================================================================
// 1. Country & Curriculum Hierarchy (Section 15)
// countries -> languages -> curricula -> education_levels -> grades -> streams -> subjects -> chapters -> topics
// ============================================================================

export const countries = pgTable('countries', {
  id: serial('id').primaryKey(),
  isoCode: text('iso_code').notNull().unique(),
  name: text('name').notNull(),
  nativeName: text('native_name').notNull(),
  defaultTimezone: text('default_timezone').notNull(),
  phoneCode: text('phone_code').notNull(),
  currencyCode: text('currency_code').notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const languages = pgTable(
  'languages',
  {
    id: serial('id').primaryKey(),
    countryId: integer('country_id')
      .references(() => countries.id, { onDelete: 'cascade' })
      .notNull(),
    isoCode: text('iso_code').notNull(),
    name: text('name').notNull(),
    nativeName: text('native_name').notNull(),
    script: text('script').notNull().default('Latin'),
    direction: text('direction').notNull().default('ltr'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('languages_country_iso_idx').on(table.countryId, table.isoCode),
  ],
);

export const curricula = pgTable('curricula', {
  id: serial('id').primaryKey(),
  countryId: integer('country_id')
    .references(() => countries.id, { onDelete: 'cascade' })
    .notNull(),
  languageId: integer('language_id')
    .references(() => languages.id, { onDelete: 'restrict' })
    .notNull(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  governingBody: text('governing_body').notNull(),
  academicCalendar: text('academic_calendar').notNull().default('BS'),
  status: text('status').notNull().default('published'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const educationLevels = pgTable(
  'education_levels',
  {
    id: serial('id').primaryKey(),
    curriculumId: integer('curriculum_id')
      .references(() => curricula.id, { onDelete: 'cascade' })
      .notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('education_levels_curriculum_code_idx').on(
      table.curriculumId,
      table.code,
    ),
  ],
);

export const grades = pgTable(
  'grades',
  {
    id: serial('id').primaryKey(),
    educationLevelId: integer('education_level_id')
      .references(() => educationLevels.id, { onDelete: 'cascade' })
      .notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    numericLevel: integer('numeric_level').notNull(),
    sortOrder: integer('sort_order').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('grades_level_code_idx').on(table.educationLevelId, table.code),
  ],
);

export const streams = pgTable(
  'streams',
  {
    id: serial('id').primaryKey(),
    gradeId: integer('grade_id')
      .references(() => grades.id, { onDelete: 'cascade' })
      .notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('streams_grade_code_idx').on(table.gradeId, table.code),
  ],
);

export const subjects = pgTable(
  'subjects',
  {
    id: serial('id').primaryKey(),
    streamId: integer('stream_id')
      .references(() => streams.id, { onDelete: 'cascade' })
      .notNull(),
    languageId: integer('language_id').references(() => languages.id, {
      onDelete: 'set null',
    }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    creditHours: integer('credit_hours').notNull().default(4),
    isCompulsory: boolean('is_compulsory').notNull().default(true),
    status: text('status').notNull().default('published'),
    sortOrder: integer('sort_order').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('subjects_stream_code_idx').on(table.streamId, table.code),
  ],
);

export const chapters = pgTable(
  'chapters',
  {
    id: serial('id').primaryKey(),
    subjectId: integer('subject_id')
      .references(() => subjects.id, { onDelete: 'cascade' })
      .notNull(),
    chapterNumber: integer('chapter_number').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    estimatedHours: integer('estimated_hours').notNull().default(6),
    reviewStatus: text('review_status').notNull().default('approved'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('chapters_subject_number_idx').on(
      table.subjectId,
      table.chapterNumber,
    ),
  ],
);

// ============================================================================
// 2. Identity & RBAC (Sections 15–18)
// users, profiles, roles, permissions, role_permissions, user_roles, institutions
// ============================================================================

export const institutions = pgTable('institutions', {
  id: serial('id').primaryKey(),
  countryId: integer('country_id')
    .references(() => countries.id, { onDelete: 'restrict' })
    .notNull(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  institutionType: text('institution_type').notNull(),
  provinceOrState: text('province_or_state'),
  city: text('city'),
  domain: text('domain'),
  isVerified: boolean('is_verified').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  authProvider: text('auth_provider').notNull().default('email'),
  status: text('status').notNull().default('active'),
  emailVerified: boolean('email_verified').notNull().default(false),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  fullName: text('full_name').notNull(),
  displayName: text('display_name'),
  phone: text('phone'),
  countryId: integer('country_id').references(() => countries.id, {
    onDelete: 'set null',
  }),
  preferredLanguageId: integer('preferred_language_id').references(
    () => languages.id,
    { onDelete: 'set null' },
  ),
  institutionId: integer('institution_id').references(() => institutions.id, {
    onDelete: 'set null',
  }),
  gradeLevel: text('grade_level'),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  hierarchyTier: integer('hierarchy_tier').notNull(),
  scopeType: text('scope_type').notNull().default('global'),
  isSystemRole: boolean('is_system_role').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: serial('id').primaryKey(),
    roleId: integer('role_id')
      .references(() => roles.id, { onDelete: 'cascade' })
      .notNull(),
    permissionId: integer('permission_id')
      .references(() => permissions.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    uniqueIndex('role_permissions_unique_idx').on(
      table.roleId,
      table.permissionId,
    ),
  ],
);

export const userRoles = pgTable(
  'user_roles',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    roleId: integer('role_id')
      .references(() => roles.id, { onDelete: 'cascade' })
      .notNull(),
    institutionId: integer('institution_id').references(() => institutions.id, {
      onDelete: 'cascade',
    }),
    countryId: integer('country_id').references(() => countries.id, {
      onDelete: 'set null',
    }),
    assignedBy: integer('assigned_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    isActive: boolean('is_active').notNull().default(true),
    assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_roles_user_role_inst_idx').on(
      table.userId,
      table.roleId,
      table.institutionId,
    ),
  ],
);

export const topics = pgTable(
  'topics',
  {
    id: serial('id').primaryKey(),
    chapterId: integer('chapter_id')
      .references(() => chapters.id, { onDelete: 'cascade' })
      .notNull(),
    topicNumber: text('topic_number').notNull(),
    title: text('title').notNull(),
    learningObjectives: text('learning_objectives').notNull(),
    difficultyLevel: text('difficulty_level').notNull().default('intermediate'),
    estimatedMinutes: integer('estimated_minutes').notNull().default(45),
    reviewStatus: text('review_status').notNull().default('approved'),
    createdBy: integer('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('topics_chapter_number_idx').on(
      table.chapterId,
      table.topicNumber,
    ),
  ],
);

// ============================================================================
// 3. Drizzle Relations
// ============================================================================

export const countriesRelations = relations(countries, ({ many }) => ({
  languages: many(languages),
  curricula: many(curricula),
  institutions: many(institutions),
}));

export const languagesRelations = relations(languages, ({ one, many }) => ({
  country: one(countries, {
    fields: [languages.countryId],
    references: [countries.id],
  }),
  curricula: many(curricula),
}));

export const curriculaRelations = relations(curricula, ({ one, many }) => ({
  country: one(countries, {
    fields: [curricula.countryId],
    references: [countries.id],
  }),
  language: one(languages, {
    fields: [curricula.languageId],
    references: [languages.id],
  }),
  educationLevels: many(educationLevels),
}));

export const educationLevelsRelations = relations(
  educationLevels,
  ({ one, many }) => ({
    curriculum: one(curricula, {
      fields: [educationLevels.curriculumId],
      references: [curricula.id],
    }),
    grades: many(grades),
  }),
);

export const gradesRelations = relations(grades, ({ one, many }) => ({
  educationLevel: one(educationLevels, {
    fields: [grades.educationLevelId],
    references: [educationLevels.id],
  }),
  streams: many(streams),
}));

export const streamsRelations = relations(streams, ({ one, many }) => ({
  grade: one(grades, {
    fields: [streams.gradeId],
    references: [grades.id],
  }),
  subjects: many(subjects),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  stream: one(streams, {
    fields: [subjects.streamId],
    references: [streams.id],
  }),
  language: one(languages, {
    fields: [subjects.languageId],
    references: [languages.id],
  }),
  chapters: many(chapters),
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [chapters.subjectId],
    references: [subjects.id],
  }),
  topics: many(topics),
}));

export const topicsRelations = relations(topics, ({ one }) => ({
  chapter: one(chapters, {
    fields: [topics.chapterId],
    references: [chapters.id],
  }),
  author: one(users, {
    fields: [topics.createdBy],
    references: [users.id],
  }),
}));

export const institutionsRelations = relations(institutions, ({ one, many }) => ({
  country: one(countries, {
    fields: [institutions.countryId],
    references: [countries.id],
  }),
  profiles: many(profiles),
  userRoles: many(userRoles),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  userRoles: many(userRoles, { relationName: 'userAssignedRoles' }),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
  country: one(countries, {
    fields: [profiles.countryId],
    references: [countries.id],
  }),
  preferredLanguage: one(languages, {
    fields: [profiles.preferredLanguageId],
    references: [languages.id],
  }),
  institution: one(institutions, {
    fields: [profiles.institutionId],
    references: [institutions.id],
  }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
    relationName: 'userAssignedRoles',
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  institution: one(institutions, {
    fields: [userRoles.institutionId],
    references: [institutions.id],
  }),
  country: one(countries, {
    fields: [userRoles.countryId],
    references: [countries.id],
  }),
}));
