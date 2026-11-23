export interface Country {
  id: number;
  isoCode: string;
  name: string;
  nativeName: string;
  defaultTimezone: string;
  phoneCode: string;
  currencyCode: string;
  isPrimary: boolean;
  isActive: boolean;
}

export interface Language {
  id: number;
  countryId: number;
  isoCode: string;
  name: string;
  nativeName: string;
  script: string;
  direction: string;
  isDefault: boolean;
}

export interface TopicNode {
  id: number;
  chapterId: number;
  topicNumber: string;
  title: string;
  learningObjectives: string;
  difficultyLevel: string;
  estimatedMinutes: number;
  reviewStatus: string;
  createdAt: string;
}

export interface ChapterNode {
  id: number;
  subjectId: number;
  chapterNumber: number;
  title: string;
  summary: string;
  estimatedHours: number;
  reviewStatus: string;
  topics: TopicNode[];
}

export interface SubjectNode {
  id: number;
  streamId: number;
  languageId: number | null;
  code: string;
  name: string;
  creditHours: number;
  isCompulsory: boolean;
  status: string;
  sortOrder: number;
  language: Language | null;
  chapters: ChapterNode[];
}

export interface StreamNode {
  id: number;
  gradeId: number;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  subjects: SubjectNode[];
}

export interface GradeNode {
  id: number;
  educationLevelId: number;
  code: string;
  name: string;
  numericLevel: number;
  sortOrder: number;
  streams: StreamNode[];
}

export interface EducationLevelNode {
  id: number;
  curriculumId: number;
  code: string;
  name: string;
  sortOrder: number;
  grades: GradeNode[];
}

export interface CurriculumNode {
  id: number;
  countryId: number;
  languageId: number;
  code: string;
  name: string;
  governingBody: string;
  academicCalendar: string;
  status: string;
  language: Language | null;
  educationLevels: EducationLevelNode[];
}

export interface CurriculumHierarchyResponse {
  countries: Country[];
  activeCountry: Country | null;
  languages: Language[];
  curricula: CurriculumNode[];
}

export interface UserRoleAssignment {
  assignmentId: number;
  roleId: number;
  slug: string;
  name: string;
  hierarchyTier: number;
  scopeType: string;
  institutionId: number | null;
  institutionName: string | null;
  countryId: number | null;
}

export interface UserContext {
  id: number;
  uid: string;
  email: string;
  authProvider: string;
  status: string;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  profile: {
    fullName: string;
    displayName: string | null;
    countryId: number | null;
    preferredLanguageId: number | null;
    institutionId: number | null;
    gradeLevel: string | null;
    bio: string | null;
  } | null;
  roles: UserRoleAssignment[];
  permissions: string[];
  institutionIds: number[];
}

export interface PermissionItem {
  id: number;
  code: string;
  resource: string;
  action: string;
  description: string;
}

export interface RoleMatrixItem {
  id: number;
  slug: string;
  name: string;
  description: string;
  hierarchyTier: number;
  scopeType: string;
  isSystemRole: boolean;
  permissions: PermissionItem[];
}

export interface DirectoryUserItem {
  id: number;
  email: string;
  authProvider: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  fullName: string;
  countryId: number | null;
  institutionId: number | null;
  roles: Array<{
    assignmentId: number;
    userId: number;
    roleSlug: string;
    roleName: string;
    hierarchyTier: number;
    institutionId: number | null;
    institutionName: string | null;
    isActive: boolean;
  }>;
}

export interface InstitutionItem {
  id: number;
  countryId: number;
  name: string;
  code: string;
  institutionType: string;
  provinceOrState: string | null;
  city: string | null;
  domain: string | null;
  isVerified: boolean;
  country: Country | null;
}

export interface SchemaCounts {
  countries: number;
  languages: number;
  curricula: number;
  education_levels: number;
  grades: number;
  streams: number;
  subjects: number;
  chapters: number;
  topics: number;
  users: number;
  profiles: number;
  roles: number;
  permissions: number;
  role_permissions: number;
  user_roles: number;
  institutions: number;
}

export interface BootstrapStatus {
  superAdminExists: boolean;
  passcodeConfigured: boolean;
}
