import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
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
// 3. School Learning System & Content Storage (Sections 5 & 15.1)
// resource_categories, resources, resource_versions, content_reviews, resource_tags, bookmarks, personal_notes
// ============================================================================

export const resourceCategories = pgTable('resource_categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  sortOrder: integer('sort_order').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const resources = pgTable('resources', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  categoryId: integer('category_id')
    .references(() => resourceCategories.id, { onDelete: 'restrict' })
    .notNull(),
  gradeId: integer('grade_id')
    .references(() => grades.id, { onDelete: 'cascade' })
    .notNull(),
  streamId: integer('stream_id').references(() => streams.id, {
    onDelete: 'set null',
  }),
  subjectId: integer('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  chapterId: integer('chapter_id').references(() => chapters.id, {
    onDelete: 'cascade',
  }),
  topicId: integer('topic_id').references(() => topics.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  titleNe: text('title_ne'),
  summary: text('summary').notNull(),
  resourceType: text('resource_type').notNull().default('chapter_bundle'),
  status: text('status').notNull().default('draft'),
  currentVersion: integer('current_version').notNull().default(1),
  sourceSlug: text('source_slug'),
  createdBy: integer('created_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  publishedAt: timestamp('published_at'),
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export interface ChapterContentPayload {
  introduction: string;
  learningObjectives: string[];
  completeNotes: Array<{ heading: string; body: string }>;
  importantConcepts: Array<{ title: string; explanation: string }>;
  definitions: Array<{ term: string; definition: string }>;
  formulaSheets: Array<{ name: string; formula: string; variables: string }>;
  solvedExamples: Array<{ problem: string; steps: string[]; answer: string }>;
  diagrams: Array<{ title: string; caption: string; visualType: string; elements: string[] }>;
  mcqs: Array<{
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
  shortQuestions: Array<{ question: string; marks: number; answerGuide: string }>;
  longQuestions: Array<{ question: string; marks: number; answerGuide: string }>;
  numericals: Array<{ question: string; given: string; solution: string; finalAnswer: string }>;
  chapterTest: {
    durationMinutes: number;
    totalMarks: number;
    instructions: string;
    sections: Array<{ title: string; questionCount: number; marksEach: number }>;
  };
  revisionSheet: string[];
}

export const resourceVersions = pgTable(
  'resource_versions',
  {
    id: serial('id').primaryKey(),
    resourceId: integer('resource_id')
      .references(() => resources.id, { onDelete: 'cascade' })
      .notNull(),
    versionNumber: integer('version_number').notNull().default(1),
    contentEn: jsonb('content_en').$type<ChapterContentPayload>().notNull(),
    contentNe: jsonb('content_ne').$type<Partial<ChapterContentPayload>>(),
    changelog: text('changelog').notNull().default('Initial release'),
    createdBy: integer('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('resource_versions_res_ver_idx').on(
      table.resourceId,
      table.versionNumber,
    ),
  ],
);

export const contentReviews = pgTable('content_reviews', {
  id: serial('id').primaryKey(),
  resourceId: integer('resource_id')
    .references(() => resources.id, { onDelete: 'cascade' })
    .notNull(),
  versionId: integer('version_id').references(() => resourceVersions.id, {
    onDelete: 'set null',
  }),
  reviewerId: integer('reviewer_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  decision: text('decision').notNull().default('pending'),
  comments: text('comments').notNull(),
  reviewedAt: timestamp('reviewed_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const resourceTags = pgTable(
  'resource_tags',
  {
    id: serial('id').primaryKey(),
    resourceId: integer('resource_id')
      .references(() => resources.id, { onDelete: 'cascade' })
      .notNull(),
    slug: text('slug').notNull(),
    label: text('label').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('resource_tags_res_slug_idx').on(table.resourceId, table.slug),
  ],
);

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    gradeId: integer('grade_id')
      .references(() => grades.id, { onDelete: 'cascade' })
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id, { onDelete: 'cascade' })
      .notNull(),
    chapterId: integer('chapter_id')
      .references(() => chapters.id, { onDelete: 'cascade' })
      .notNull(),
    resourceId: integer('resource_id').references(() => resources.id, {
      onDelete: 'cascade',
    }),
    bookmarkType: text('bookmark_type').notNull().default('chapter'),
    title: text('title').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('bookmarks_user_chap_res_idx').on(
      table.userId,
      table.chapterId,
      table.resourceId,
    ),
  ],
);

export const personalNotes = pgTable('personal_notes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  chapterId: integer('chapter_id')
    .references(() => chapters.id, { onDelete: 'cascade' })
    .notNull(),
  resourceId: integer('resource_id').references(() => resources.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  highlightText: text('highlight_text'),
  noteBody: text('note_body').notNull(),
  languageCode: text('language_code').notNull().default('en'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// 4. Drizzle Relations
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
  resources: many(resources),
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
  bookmarks: many(bookmarks),
  personalNotes: many(personalNotes),
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

export const resourceCategoriesRelations = relations(
  resourceCategories,
  ({ many }) => ({
    resources: many(resources),
  }),
);

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  category: one(resourceCategories, {
    fields: [resources.categoryId],
    references: [resourceCategories.id],
  }),
  grade: one(grades, {
    fields: [resources.gradeId],
    references: [grades.id],
  }),
  stream: one(streams, {
    fields: [resources.streamId],
    references: [streams.id],
  }),
  subject: one(subjects, {
    fields: [resources.subjectId],
    references: [subjects.id],
  }),
  chapter: one(chapters, {
    fields: [resources.chapterId],
    references: [chapters.id],
  }),
  topic: one(topics, {
    fields: [resources.topicId],
    references: [topics.id],
  }),
  versions: many(resourceVersions),
  reviews: many(contentReviews),
  tags: many(resourceTags),
}));

export const resourceVersionsRelations = relations(
  resourceVersions,
  ({ one }) => ({
    resource: one(resources, {
      fields: [resourceVersions.resourceId],
      references: [resources.id],
    }),
  }),
);

export const contentReviewsRelations = relations(contentReviews, ({ one }) => ({
  resource: one(resources, {
    fields: [contentReviews.resourceId],
    references: [resources.id],
  }),
  version: one(resourceVersions, {
    fields: [contentReviews.versionId],
    references: [resourceVersions.id],
  }),
}));

export const resourceTagsRelations = relations(resourceTags, ({ one }) => ({
  resource: one(resources, {
    fields: [resourceTags.resourceId],
    references: [resources.id],
  }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
  chapter: one(chapters, {
    fields: [bookmarks.chapterId],
    references: [chapters.id],
  }),
  resource: one(resources, {
    fields: [bookmarks.resourceId],
    references: [resources.id],
  }),
}));

export const personalNotesRelations = relations(personalNotes, ({ one }) => ({
  user: one(users, {
    fields: [personalNotes.userId],
    references: [users.id],
  }),
  chapter: one(chapters, {
    fields: [personalNotes.chapterId],
    references: [chapters.id],
  }),
  resource: one(resources, {
    fields: [personalNotes.resourceId],
    references: [resources.id],
  }),
}));

// ============================================================================
// 5. Question Bank, Bachelor Entrance & Timed Examination Engine (Phase 4)
// ============================================================================

export type QuestionType =
  | 'single_mcq'
  | 'multiple_mcq'
  | 'true_false'
  | 'short_answer'
  | 'long_answer'
  | 'numerical'
  | 'diagram_based'
  | 'case_based'
  | 'assertion_reason'
  | 'matching';

export type QuestionWorkflowStatus =
  | 'Draft'
  | 'Academic Review'
  | 'Correction'
  | 'Approval'
  | 'Published'
  | 'Archived';

export interface QuestionContentJson {
  prompt: string;
  promptNe?: string;
  passage?: string;
  assertion?: string;
  reason?: string;
  diagramLabel?: string;
  diagramSvg?: string;
  matchingLeft?: string[];
  matchingRight?: string[];
  unitHint?: string;
}

export interface QuestionAnswerJson {
  optionKeys?: string[];
  booleanValue?: boolean;
  numericValue?: number;
  tolerance?: number;
  acceptedText?: string;
  keywords?: string[];
  matchingMap?: Record<string, string>;
}

export interface SnapshotOptionItem {
  optionKey: string;
  optionText: string;
  optionTextNe?: string | null;
}

export interface ImmutableExamQuestionSnapshot {
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
  questionContent: QuestionContentJson;
  options: SnapshotOptionItem[];
  correctAnswer: QuestionAnswerJson;
  explanation: string;
  explanationNe: string | null;
  marks: number;
  negativeMarks: number;
  sortOrder: number;
}

export interface ImmutableExamSnapshot {
  examId: number;
  examSlug: string;
  examTitle: string;
  durationMinutes: number;
  totalMarks: number;
  negativeMarkingEnabled: boolean;
  questions: ImmutableExamQuestionSnapshot[];
}

export interface PerformanceBreakdownBucket {
  key: string;
  label: string;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  maxMarks: number;
  obtainedMarks: number;
  accuracyPercent: number;
}

export const questionSources = pgTable('question_sources', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  sourceType: text('source_type').notNull().default('official_past_paper'),
  yearBs: text('year_bs'),
  verified: boolean('verified').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  questionUid: text('question_id').notNull().unique(),
  countryId: integer('country_id').references(() => countries.id, {
    onDelete: 'set null',
  }),
  curriculumId: integer('curriculum_id').references(() => curricula.id, {
    onDelete: 'set null',
  }),
  academicLevel: text('academic_level').notNull(),
  examination: text('examination').notNull(),
  subjectId: integer('subject_id').references(() => subjects.id, {
    onDelete: 'set null',
  }),
  subjectName: text('subject').notNull(),
  chapterId: integer('chapter_id').references(() => chapters.id, {
    onDelete: 'set null',
  }),
  chapterName: text('chapter').notNull(),
  topicId: integer('topic_id').references(() => topics.id, {
    onDelete: 'set null',
  }),
  topicName: text('topic').notNull(),
  questionType: text('question_type').$type<QuestionType>().notNull(),
  difficulty: text('difficulty').notNull().default('medium'),
  questionContent: jsonb('question_content').$type<QuestionContentJson>().notNull(),
  answerOptions: jsonb('answer_options').$type<SnapshotOptionItem[]>().notNull().default([]),
  correctAnswer: jsonb('correct_answer').$type<QuestionAnswerJson>().notNull(),
  explanation: text('explanation').notNull(),
  marks: doublePrecision('marks').notNull().default(1),
  negativeMarks: doublePrecision('negative_marks').notNull().default(0),
  sourceId: integer('source_id').references(() => questionSources.id, {
    onDelete: 'set null',
  }),
  source: text('source').notNull(),
  language: text('language').notNull().default('en'),
  status: text('status').$type<QuestionWorkflowStatus>().notNull().default('Draft'),
  aiGenerated: boolean('ai_generated').notNull().default(false),
  reviewerId: integer('reviewer_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  reviewer: text('reviewer').notNull().default('Academic Review Board'),
  version: integer('version').notNull().default(1),
  createdBy: integer('created_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const questionOptions = pgTable(
  'question_options',
  {
    id: serial('id').primaryKey(),
    questionId: integer('question_id')
      .references(() => questions.id, { onDelete: 'cascade' })
      .notNull(),
    optionKey: text('option_key').notNull(),
    optionText: text('option_text').notNull(),
    optionTextNe: text('option_text_ne'),
    isCorrect: boolean('is_correct').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(1),
  },
  (table) => [
    uniqueIndex('question_options_q_key_idx').on(table.questionId, table.optionKey),
  ],
);

export const questionAnswers = pgTable('question_answers', {
  id: serial('id').primaryKey(),
  questionId: integer('question_id')
    .references(() => questions.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  correctAnswer: jsonb('correct_answer').$type<QuestionAnswerJson>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const questionExplanations = pgTable('question_explanations', {
  id: serial('id').primaryKey(),
  questionId: integer('question_id')
    .references(() => questions.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  explanation: text('explanation').notNull(),
  explanationNe: text('explanation_ne'),
  referenceNote: text('reference_note'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const questionTags = pgTable(
  'question_tags',
  {
    id: serial('id').primaryKey(),
    questionId: integer('question_id')
      .references(() => questions.id, { onDelete: 'cascade' })
      .notNull(),
    slug: text('slug').notNull(),
    label: text('label').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('question_tags_q_slug_idx').on(table.questionId, table.slug),
  ],
);

export const questionVersions = pgTable(
  'question_versions',
  {
    id: serial('id').primaryKey(),
    questionId: integer('question_id')
      .references(() => questions.id, { onDelete: 'cascade' })
      .notNull(),
    versionNumber: integer('version_number').notNull().default(1),
    snapshotJson: jsonb('snapshot_json').$type<{
      questionContent: QuestionContentJson;
      answerOptions: SnapshotOptionItem[];
      correctAnswer: QuestionAnswerJson;
      explanation: string;
      marks: number;
      negativeMarks: number;
    }>().notNull(),
    changeSummary: text('change_summary').notNull().default('Initial release'),
    createdBy: integer('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('question_versions_q_ver_idx').on(table.questionId, table.versionNumber),
  ],
);

export const exams = pgTable('exams', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  examinationSlug: text('examination_slug').notNull(),
  academicLevel: text('academic_level').notNull(),
  countryId: integer('country_id').references(() => countries.id, {
    onDelete: 'set null',
  }),
  subjectScope: text('subject_scope').notNull(),
  chapterScope: text('chapter_scope'),
  totalMarks: doublePrecision('total_marks').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  negativeMarkingRule: jsonb('negative_marking_rule').$type<{
    enabled: boolean;
    deductionPerWrong: number;
    description: string;
  }>().notNull(),
  randomizeQuestions: boolean('randomize_questions').notNull().default(false),
  randomizeOptions: boolean('randomize_options').notNull().default(false),
  startWindow: timestamp('start_window'),
  endWindow: timestamp('end_window'),
  resultVisibility: text('result_visibility').notNull().default('immediate'),
  attemptLimit: integer('attempt_limit').notNull().default(5),
  instructions: text('instructions').notNull(),
  status: text('status').notNull().default('published'),
  createdBy: integer('created_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const examSections = pgTable('exam_sections', {
  id: serial('id').primaryKey(),
  examId: integer('exam_id')
    .references(() => exams.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  subjectName: text('subject_name').notNull(),
  description: text('description'),
  questionCount: integer('question_count').notNull().default(0),
  sectionMarks: doublePrecision('section_marks').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(1),
});

export const examQuestions = pgTable(
  'exam_questions',
  {
    id: serial('id').primaryKey(),
    examId: integer('exam_id')
      .references(() => exams.id, { onDelete: 'cascade' })
      .notNull(),
    sectionId: integer('section_id').references(() => examSections.id, {
      onDelete: 'set null',
    }),
    questionId: integer('question_id')
      .references(() => questions.id, { onDelete: 'cascade' })
      .notNull(),
    sortOrder: integer('sort_order').notNull().default(1),
    marksOverride: doublePrecision('marks_override'),
    negativeMarksOverride: doublePrecision('negative_marks_override'),
  },
  (table) => [
    uniqueIndex('exam_questions_exam_q_idx').on(table.examId, table.questionId),
  ],
);

export const examAttempts = pgTable('exam_attempts', {
  id: serial('id').primaryKey(),
  attemptUid: text('attempt_uid').notNull().unique(),
  examId: integer('exam_id')
    .references(() => exams.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  attemptNumber: integer('attempt_number').notNull().default(1),
  status: text('status').notNull().default('in_progress'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  submittedAt: timestamp('submitted_at'),
  timeTakenSeconds: integer('time_taken_seconds'),
  immutableSnapshot: jsonb('immutable_snapshot').$type<ImmutableExamSnapshot>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const attemptAnswers = pgTable(
  'attempt_answers',
  {
    id: serial('id').primaryKey(),
    attemptId: integer('attempt_id')
      .references(() => examAttempts.id, { onDelete: 'cascade' })
      .notNull(),
    questionId: integer('question_id').notNull(),
    selectedAnswer: jsonb('selected_answer').$type<{
      optionKeys?: string[];
      booleanValue?: boolean;
      numericValue?: number | null;
      textValue?: string;
      matchingMap?: Record<string, string>;
    } | null>(),
    status: text('status').notNull().default('unvisited'),
    isMarkedForReview: boolean('is_marked_for_review').notNull().default(false),
    isCorrect: boolean('is_correct'),
    marksAwarded: doublePrecision('marks_awarded'),
    savedAt: timestamp('saved_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('attempt_answers_attempt_q_idx').on(table.attemptId, table.questionId),
  ],
);

export const attemptEvents = pgTable('attempt_events', {
  id: serial('id').primaryKey(),
  attemptId: integer('attempt_id')
    .references(() => examAttempts.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown> | null>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const examResults = pgTable('exam_results', {
  id: serial('id').primaryKey(),
  attemptId: integer('attempt_id')
    .references(() => examAttempts.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  examId: integer('exam_id')
    .references(() => exams.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  totalMarks: doublePrecision('total_marks').notNull(),
  obtainedMarks: doublePrecision('obtained_marks').notNull(),
  correctCount: integer('correct_count').notNull(),
  incorrectCount: integer('incorrect_count').notNull(),
  unattemptedCount: integer('unattempted_count').notNull(),
  accuracyPercent: doublePrecision('accuracy_percent').notNull(),
  timeTakenSeconds: integer('time_taken_seconds').notNull(),
  subjectBreakdown: jsonb('subject_breakdown').$type<PerformanceBreakdownBucket[]>().notNull(),
  chapterBreakdown: jsonb('chapter_breakdown').$type<PerformanceBreakdownBucket[]>().notNull(),
  topicBreakdown: jsonb('topic_breakdown').$type<PerformanceBreakdownBucket[]>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Phase 4 Drizzle Relations
export const questionsRelations = relations(questions, ({ one, many }) => ({
  sourceRef: one(questionSources, {
    fields: [questions.sourceId],
    references: [questionSources.id],
  }),
  options: many(questionOptions),
  answerRef: one(questionAnswers, {
    fields: [questions.id],
    references: [questionAnswers.questionId],
  }),
  explanationRef: one(questionExplanations, {
    fields: [questions.id],
    references: [questionExplanations.questionId],
  }),
  tags: many(questionTags),
  versions: many(questionVersions),
}));

export const questionOptionsRelations = relations(questionOptions, ({ one }) => ({
  question: one(questions, {
    fields: [questionOptions.questionId],
    references: [questions.id],
  }),
}));

export const questionTagsRelations = relations(questionTags, ({ one }) => ({
  question: one(questions, {
    fields: [questionTags.questionId],
    references: [questions.id],
  }),
}));

export const questionVersionsRelations = relations(questionVersions, ({ one }) => ({
  question: one(questions, {
    fields: [questionVersions.questionId],
    references: [questions.id],
  }),
}));

export const examsRelations = relations(exams, ({ many }) => ({
  sections: many(examSections),
  examQuestions: many(examQuestions),
  attempts: many(examAttempts),
  results: many(examResults),
}));

export const examSectionsRelations = relations(examSections, ({ one, many }) => ({
  exam: one(exams, {
    fields: [examSections.examId],
    references: [exams.id],
  }),
  questions: many(examQuestions),
}));

export const examQuestionsRelations = relations(examQuestions, ({ one }) => ({
  exam: one(exams, {
    fields: [examQuestions.examId],
    references: [exams.id],
  }),
  section: one(examSections, {
    fields: [examQuestions.sectionId],
    references: [examSections.id],
  }),
  question: one(questions, {
    fields: [examQuestions.questionId],
    references: [questions.id],
  }),
}));

export const examAttemptsRelations = relations(examAttempts, ({ one, many }) => ({
  exam: one(exams, {
    fields: [examAttempts.examId],
    references: [exams.id],
  }),
  user: one(users, {
    fields: [examAttempts.userId],
    references: [users.id],
  }),
  answers: many(attemptAnswers),
  events: many(attemptEvents),
  result: one(examResults, {
    fields: [examAttempts.id],
    references: [examResults.attemptId],
  }),
}));

export const attemptAnswersRelations = relations(attemptAnswers, ({ one }) => ({
  attempt: one(examAttempts, {
    fields: [attemptAnswers.attemptId],
    references: [examAttempts.id],
  }),
}));

export const attemptEventsRelations = relations(attemptEvents, ({ one }) => ({
  attempt: one(examAttempts, {
    fields: [attemptEvents.attemptId],
    references: [examAttempts.id],
  }),
}));

export const examResultsRelations = relations(examResults, ({ one }) => ({
  attempt: one(examAttempts, {
    fields: [examResults.attemptId],
    references: [examAttempts.id],
  }),
  exam: one(exams, {
    fields: [examResults.examId],
    references: [exams.id],
  }),
  user: one(users, {
    fields: [examResults.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// 6. Signature Student Features & Personalized Dashboard (Phase 5 - Section 9 & 15.1)
// mistake_book, learning_progress, achievements, student_goals, study_plans, study_tasks, flashcards
// ============================================================================

export interface MistakeQuestionSnapshot {
  prompt: string;
  promptNe?: string;
  passage?: string;
  assertion?: string;
  reason?: string;
  diagramLabel?: string;
  diagramSvg?: string;
  matchingLeft?: string[];
  matchingRight?: string[];
  unitHint?: string;
  questionType: QuestionType;
  options: SnapshotOptionItem[];
}

export const mistakeBook = pgTable(
  'mistake_book',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    sourceType: text('source_type').notNull().default('exam'),
    sourceRefKey: text('source_ref_key').notNull(),
    questionId: integer('question_id').references(() => questions.id, {
      onDelete: 'set null',
    }),
    resourceId: integer('resource_id').references(() => resources.id, {
      onDelete: 'set null',
    }),
    academicLevel: text('academic_level').notNull().default('School / SEE'),
    subjectName: text('subject_name').notNull(),
    chapterName: text('chapter_name').notNull(),
    topicName: text('topic_name').notNull(),
    difficulty: text('difficulty').notNull().default('medium'),
    questionSnapshot: jsonb('question_snapshot')
      .$type<MistakeQuestionSnapshot>()
      .notNull(),
    studentWrongAnswer: jsonb('student_wrong_answer')
      .$type<Record<string, unknown> | null>(),
    correctAnswer: jsonb('correct_answer').$type<QuestionAnswerJson>().notNull(),
    explanation: text('explanation').notNull(),
    status: text('status').notNull().default('unresolved'),
    attemptCount: integer('attempt_count').notNull().default(1),
    lastAttemptedAt: timestamp('last_attempted_at').defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('mistake_book_user_ref_idx').on(table.userId, table.sourceRefKey),
  ],
);

export const learningProgress = pgTable(
  'learning_progress',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    academicLevel: text('academic_level').notNull().default('SEE / Secondary'),
    subjectName: text('subject_name').notNull(),
    chapterName: text('chapter_name').notNull(),
    topicName: text('topic_name').notNull(),
    totalAttempts: integer('total_attempts').notNull().default(0),
    correctAttempts: integer('correct_attempts').notNull().default(0),
    accuracyPercent: doublePrecision('accuracy_percent').notNull().default(0),
    isWeak: boolean('is_weak').notNull().default(false),
    lastPracticedAt: timestamp('last_practiced_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('learning_progress_user_topic_idx').on(
      table.userId,
      table.subjectName,
      table.chapterName,
      table.topicName,
    ),
  ],
);

export const achievements = pgTable(
  'achievements',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    badgeCode: text('badge_code').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull().default('milestone'),
    metricValue: integer('metric_value').notNull().default(0),
    unlockedAt: timestamp('unlocked_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('achievements_user_badge_idx').on(table.userId, table.badgeCode),
  ],
);

export const studentGoals = pgTable('student_goals', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  targetTrack: text('target_track').notNull().default('SEE Class 10'),
  targetExamSlug: text('target_exam_slug'),
  targetExamName: text('target_exam_name'),
  targetExamDate: timestamp('target_exam_date'),
  dailyStudyMinutes: integer('daily_study_minutes').notNull().default(90),
  dailyQuestionTarget: integer('daily_question_target').notNull().default(15),
  selectedSubjects: jsonb('selected_subjects').$type<string[]>().notNull().default([]),
  careerInterests: jsonb('career_interests').$type<string[]>().notNull().default([]),
  leaderboardPrivacy: text('leaderboard_privacy').notNull().default('masked'),
  leaderboardAlias: text('leaderboard_alias'),
  streakDays: integer('streak_days').notNull().default(0),
  longestStreakDays: integer('longest_streak_days').notNull().default(0),
  lastActiveDate: text('last_active_date'),
  totalQuestionsSolved: integer('total_questions_solved').notNull().default(0),
  dailyChallengesCompleted: integer('daily_challenges_completed').notNull().default(0),
  lastDailyChallengeDate: text('last_daily_challenge_date'),
  improvementScore: doublePrecision('improvement_score').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const studyPlans = pgTable('study_plans', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  goalFocus: text('goal_focus').notNull(),
  subjectName: text('subject_name').notNull(),
  gradeCode: text('grade_code').notNull().default('G10'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const studyTasks = pgTable('study_tasks', {
  id: serial('id').primaryKey(),
  planId: integer('plan_id').references(() => studyPlans.id, {
    onDelete: 'cascade',
  }),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  taskType: text('task_type').notNull().default('chapter_study'),
  subjectName: text('subject_name').notNull(),
  chapterName: text('chapter_name'),
  scheduledDate: text('scheduled_date').notNull(),
  estimatedMinutes: integer('estimated_minutes').notNull().default(30),
  isCompleted: boolean('is_completed').notNull().default(false),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const flashcards = pgTable(
  'flashcards',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    parentCuratedId: integer('parent_curated_id'),
    isCurated: boolean('is_curated').notNull().default(false),
    category: text('category').notNull().default('definition'),
    academicLevel: text('academic_level').notNull().default('SEE / Class 10'),
    subjectName: text('subject_name').notNull(),
    chapterName: text('chapter_name').notNull(),
    frontText: text('front_text').notNull(),
    backText: text('back_text').notNull(),
    hintText: text('hint_text'),
    intervalDays: integer('interval_days').notNull().default(1),
    easeFactor: doublePrecision('ease_factor').notNull().default(2.5),
    repetitions: integer('repetitions').notNull().default(0),
    nextReviewAt: timestamp('next_review_at').defaultNow().notNull(),
    lastReviewedAt: timestamp('last_reviewed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('flashcards_user_curated_idx').on(table.userId, table.parentCuratedId),
  ],
);

export const mistakeBookRelations = relations(mistakeBook, ({ one }) => ({
  user: one(users, {
    fields: [mistakeBook.userId],
    references: [users.id],
  }),
  question: one(questions, {
    fields: [mistakeBook.questionId],
    references: [questions.id],
  }),
}));

export const learningProgressRelations = relations(learningProgress, ({ one }) => ({
  user: one(users, {
    fields: [learningProgress.userId],
    references: [users.id],
  }),
}));

export const achievementsRelations = relations(achievements, ({ one }) => ({
  user: one(users, {
    fields: [achievements.userId],
    references: [users.id],
  }),
}));

export const studentGoalsRelations = relations(studentGoals, ({ one }) => ({
  user: one(users, {
    fields: [studentGoals.userId],
    references: [users.id],
  }),
}));

export const studyPlansRelations = relations(studyPlans, ({ one, many }) => ({
  user: one(users, {
    fields: [studyPlans.userId],
    references: [users.id],
  }),
  tasks: many(studyTasks),
}));

export const studyTasksRelations = relations(studyTasks, ({ one }) => ({
  user: one(users, {
    fields: [studyTasks.userId],
    references: [users.id],
  }),
  plan: one(studyPlans, {
    fields: [studyTasks.planId],
    references: [studyPlans.id],
  }),
}));

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  user: one(users, {
    fields: [flashcards.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// 6. Phase 6: Career, Course, College, and Scholarship Explorer (Section 11 & 15.1)
// entrance_exams, universities, courses, colleges, course_colleges,
// scholarships, career_paths, opportunities, application_deadlines
// ============================================================================

export interface CourseSemesterModuleJson {
  term: string;
  subjects: string[];
}

export interface CollegeVerifiedFactsJson {
  affiliationBody: string;
  institutionCategory: string;
  accreditedSince?: string;
  verifiedIntakeSummary: string;
  feeVerificationNote: string;
}

export interface CareerRoadmapStageJson {
  stageOrder: number;
  stageCode: 'class_10' | 'plus_two' | 'bachelor' | 'skills_internships' | 'career_higher';
  stageLabel: string;
  title: string;
  guidance: string;
  milestones: string[];
  recommendedRoute?: string;
}

export const entranceExams = pgTable('entrance_exams', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  conductingBody: text('conducting_body').notNull(),
  academicCategory: text('academic_category').notNull(),
  examPatternSummary: text('exam_pattern_summary').notNull(),
  eligibilitySummary: text('eligibility_summary').notNull(),
  officialUrl: text('official_url').notNull(),
  source: text('source').notNull(),
  lastVerifiedDate: text('last_verified_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const universities = pgTable('universities', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  shortCode: text('short_code').notNull().unique(),
  name: text('name').notNull(),
  establishedYear: integer('established_year').notNull(),
  universityType: text('university_type').notNull(),
  location: text('location').notNull(),
  officialWebsite: text('official_website').notNull(),
  overview: text('overview').notNull(),
  source: text('source').notNull(),
  lastVerifiedDate: text('last_verified_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  fullForm: text('full_form').notNull(),
  category: text('category').notNull(),
  universityId: integer('university_id')
    .references(() => universities.id, { onDelete: 'restrict' })
    .notNull(),
  entranceExamId: integer('entrance_exam_id').references(() => entranceExams.id, {
    onDelete: 'set null',
  }),
  durationYears: doublePrecision('duration_years').notNull(),
  durationLabel: text('duration_label').notNull(),
  eligibility: text('eligibility').notNull(),
  admissionProcess: text('admission_process').notNull(),
  curriculumModules: jsonb('curriculum_modules')
    .$type<CourseSemesterModuleJson[]>()
    .notNull()
    .default([]),
  verifiedFeeMinNpr: integer('verified_fee_min_npr').notNull(),
  verifiedFeeMaxNpr: integer('verified_fee_max_npr').notNull(),
  verifiedFeeNote: text('verified_fee_note').notNull(),
  careerPossibilities: jsonb('career_possibilities').$type<string[]>().notNull().default([]),
  requiredSkills: jsonb('required_skills').$type<string[]>().notNull().default([]),
  higherStudiesOptions: jsonb('higher_studies_options').$type<string[]>().notNull().default([]),
  streamRecommendation: text('stream_recommendation').notNull(),
  source: text('source').notNull(),
  lastVerifiedDate: text('last_verified_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const colleges = pgTable('colleges', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  universityId: integer('university_id')
    .references(() => universities.id, { onDelete: 'restrict' })
    .notNull(),
  institutionType: text('institution_type').notNull(),
  province: text('province').notNull(),
  district: text('district').notNull(),
  city: text('city').notNull(),
  officialWebsite: text('official_website').notNull(),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone').notNull(),
  admissionRequirements: text('admission_requirements').notNull(),
  facilities: jsonb('facilities').$type<string[]>().notNull().default([]),
  scholarshipHighlights: jsonb('scholarship_highlights').$type<string[]>().notNull().default([]),
  verifiedFacts: jsonb('verified_facts').$type<CollegeVerifiedFactsJson>().notNull(),
  promotionalClaims: jsonb('promotional_claims').$type<string[]>().notNull().default([]),
  source: text('source').notNull(),
  lastVerifiedDate: text('last_verified_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const courseColleges = pgTable(
  'course_colleges',
  {
    id: serial('id').primaryKey(),
    courseId: integer('course_id')
      .references(() => courses.id, { onDelete: 'cascade' })
      .notNull(),
    collegeId: integer('college_id')
      .references(() => colleges.id, { onDelete: 'cascade' })
      .notNull(),
    totalSeats: integer('total_seats').notNull(),
    scholarshipSeats: integer('scholarship_seats').notNull().default(0),
    verifiedFeeMinNpr: integer('verified_fee_min_npr').notNull(),
    verifiedFeeMaxNpr: integer('verified_fee_max_npr').notNull(),
    feeStructureNote: text('fee_structure_note').notNull(),
    admissionNote: text('admission_note').notNull(),
    source: text('source').notNull(),
    lastVerifiedDate: text('last_verified_date').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('course_colleges_course_college_idx').on(table.courseId, table.collegeId),
  ],
);

export const scholarships = pgTable('scholarships', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  provider: text('provider').notNull(),
  category: text('category').notNull(),
  eligibility: text('eligibility').notNull(),
  financialBenefits: text('financial_benefits').notNull(),
  applicationDeadline: text('application_deadline').notNull(),
  deadlineStatus: text('deadline_status').notNull().default('Annual Window'),
  requiredDocuments: jsonb('required_documents').$type<string[]>().notNull().default([]),
  applicationInstructions: jsonb('application_instructions')
    .$type<string[]>()
    .notNull()
    .default([]),
  targetStreams: jsonb('target_streams').$type<string[]>().notNull().default([]),
  officialSourceUrl: text('official_source_url').notNull(),
  source: text('source').notNull(),
  lastVerifiedDate: text('last_verified_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const careerPaths = pgTable('career_paths', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  summary: text('summary').notNull(),
  demandOutlook: text('demand_outlook').notNull(),
  licensingBody: text('licensing_body').notNull(),
  averageSalaryRangeNpr: text('average_salary_range_npr').notNull(),
  roadmapStages: jsonb('roadmap_stages')
    .$type<CareerRoadmapStageJson[]>()
    .notNull()
    .default([]),
  recommendedCourseSlugs: jsonb('recommended_course_slugs')
    .$type<string[]>()
    .notNull()
    .default([]),
  requiredSkills: jsonb('required_skills').$type<string[]>().notNull().default([]),
  source: text('source').notNull(),
  lastVerifiedDate: text('last_verified_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const opportunities = pgTable('opportunities', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  organization: text('organization').notNull(),
  category: text('category').notNull(),
  eligibility: text('eligibility').notNull(),
  benefitOrPrize: text('benefit_or_prize').notNull(),
  deadlineDate: text('deadline_date').notNull(),
  windowLabel: text('window_label').notNull(),
  mode: text('mode').notNull(),
  location: text('location').notNull(),
  routeOrUrl: text('route_or_url').notNull(),
  careerCategories: jsonb('career_categories').$type<string[]>().notNull().default([]),
  source: text('source').notNull(),
  lastVerifiedDate: text('last_verified_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const applicationDeadlines = pgTable('application_deadlines', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  authority: text('authority').notNull(),
  category: text('category').notNull(),
  targetAudience: text('target_audience').notNull(),
  openDate: text('open_date').notNull(),
  deadlineDate: text('deadline_date').notNull(),
  examDate: text('exam_date').notNull(),
  status: text('status').notNull(),
  actionRoute: text('action_route').notNull(),
  officialUrl: text('official_url').notNull(),
  source: text('source').notNull(),
  lastVerifiedDate: text('last_verified_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const entranceExamsRelations = relations(entranceExams, ({ many }) => ({
  courses: many(courses),
}));

export const universitiesRelations = relations(universities, ({ many }) => ({
  courses: many(courses),
  colleges: many(colleges),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  university: one(universities, {
    fields: [courses.universityId],
    references: [universities.id],
  }),
  entranceExam: one(entranceExams, {
    fields: [courses.entranceExamId],
    references: [entranceExams.id],
  }),
  courseColleges: many(courseColleges),
}));

export const collegesRelations = relations(colleges, ({ one, many }) => ({
  university: one(universities, {
    fields: [colleges.universityId],
    references: [universities.id],
  }),
  courseColleges: many(courseColleges),
}));

export const courseCollegesRelations = relations(courseColleges, ({ one }) => ({
  course: one(courses, {
    fields: [courseColleges.courseId],
    references: [courses.id],
  }),
  college: one(colleges, {
    fields: [courseColleges.collegeId],
    references: [colleges.id],
  }),
}));

// ============================================================================
// 7. Phase 7: Student Community & Youth Safety Moderation (Sections 12 & 15.1)
// discussion_groups, discussion_posts, discussion_comments, post_votes, reports, moderation_actions
// ============================================================================

export const discussionGroups = pgTable('discussion_groups', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  groupType: text('group_type').notNull(), // 'class' | 'subject' | 'entrance'
  academicLevel: text('academic_level').notNull(),
  subjectName: text('subject_name').notNull(),
  description: text('description').notNull(),
  memberCount: integer('member_count').notNull().default(0),
  isModerated: boolean('is_moderated').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const discussionPosts = pgTable('discussion_posts', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id')
    .references(() => discussionGroups.id, { onDelete: 'cascade' })
    .notNull(),
  authorId: integer('author_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  postType: text('post_type').notNull().default('question'), // 'question' | 'explanation' | 'resource_tip'
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  upvoteCount: integer('upvote_count').notNull().default(0),
  commentCount: integer('comment_count').notNull().default(0),
  isAnswered: boolean('is_answered').notNull().default(false),
  hasTeacherVerified: boolean('has_teacher_verified').notNull().default(false),
  moderationStatus: text('moderation_status').notNull().default('active'), // 'active' | 'flagged' | 'hidden'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const discussionComments = pgTable('discussion_comments', {
  id: serial('id').primaryKey(),
  postId: integer('post_id')
    .references(() => discussionPosts.id, { onDelete: 'cascade' })
    .notNull(),
  authorId: integer('author_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  body: text('body').notNull(),
  isTeacherVerified: boolean('is_teacher_verified').notNull().default(false),
  verifiedById: integer('verified_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  verifiedByName: text('verified_by_name'),
  verifiedAt: timestamp('verified_at'),
  upvoteCount: integer('upvote_count').notNull().default(0),
  moderationStatus: text('moderation_status').notNull().default('active'), // 'active' | 'flagged' | 'hidden'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const postVotes = pgTable(
  'post_votes',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    targetType: text('target_type').notNull(), // 'post' | 'comment'
    targetKey: text('target_key').notNull(), // e.g. 'post:12' or 'comment:45'
    postId: integer('post_id').references(() => discussionPosts.id, {
      onDelete: 'cascade',
    }),
    commentId: integer('comment_id').references(() => discussionComments.id, {
      onDelete: 'cascade',
    }),
    voteValue: integer('vote_value').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('post_votes_user_target_idx').on(table.userId, table.targetKey),
  ],
);

export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  reporterId: integer('reporter_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  targetType: text('target_type').notNull(), // 'post' | 'comment'
  postId: integer('post_id').references(() => discussionPosts.id, {
    onDelete: 'cascade',
  }),
  commentId: integer('comment_id').references(() => discussionComments.id, {
    onDelete: 'cascade',
  }),
  reason: text('reason').notNull(), // 'profanity' | 'spam' | 'harassment' | 'misinformation' | 'personal_info' | 'other'
  details: text('details').notNull().default(''),
  status: text('status').notNull().default('open'), // 'open' | 'reviewed' | 'dismissed' | 'action_taken'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
});

export const moderationActions = pgTable('moderation_actions', {
  id: serial('id').primaryKey(),
  reportId: integer('report_id').references(() => reports.id, {
    onDelete: 'set null',
  }),
  moderatorId: integer('moderator_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  targetType: text('target_type').notNull(), // 'post' | 'comment'
  targetId: integer('target_id').notNull(),
  actionType: text('action_type').notNull(), // 'approve' | 'hide' | 'restore' | 'flag' | 'dismiss_report'
  reasonNotes: text('reason_notes').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const discussionGroupsRelations = relations(discussionGroups, ({ many }) => ({
  posts: many(discussionPosts),
}));

export const discussionPostsRelations = relations(discussionPosts, ({ one, many }) => ({
  group: one(discussionGroups, {
    fields: [discussionPosts.groupId],
    references: [discussionGroups.id],
  }),
  author: one(users, {
    fields: [discussionPosts.authorId],
    references: [users.id],
  }),
  comments: many(discussionComments),
}));

export const discussionCommentsRelations = relations(discussionComments, ({ one }) => ({
  post: one(discussionPosts, {
    fields: [discussionComments.postId],
    references: [discussionPosts.id],
  }),
  author: one(users, {
    fields: [discussionComments.authorId],
    references: [users.id],
  }),
}));

// ============================================================================
// 8. Phase 8: Platform Governance, Audit Logs, Content Sources & Notifications (Section 14 & 15.1)
// audit_logs, system_settings, content_sources, notifications
// ============================================================================

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorId: integer('actor_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  actorEmail: text('actor_email').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  targetEntity: text('target_entity').notNull(),
  targetId: text('target_id'),
  summary: text('summary').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  settingKey: text('setting_key').notNull().unique(),
  category: text('category').notNull().default('platform'),
  label: text('label').notNull(),
  valueJson: jsonb('value_json').$type<Record<string, unknown>>().notNull(),
  description: text('description').notNull(),
  countryCode: text('country_code').notNull().default('NP'),
  updatedBy: integer('updated_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const contentSources = pgTable('content_sources', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  authorityType: text('authority_type').notNull().default('curriculum_board'),
  countryCode: text('country_code').notNull().default('NP'),
  officialUrl: text('official_url'),
  verificationNotes: text('verification_notes').notNull().default(''),
  isTrusted: boolean('is_trusted').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, {
    onDelete: 'cascade',
  }),
  audienceRole: text('audience_role').notNull().default('all_students'),
  title: text('title').notNull(),
  message: text('message').notNull(),
  category: text('category').notNull().default('announcement'),
  isPublished: boolean('is_published').notNull().default(true),
  createdBy: integer('created_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  author: one(users, {
    fields: [notifications.createdBy],
    references: [users.id],
  }),
}));




