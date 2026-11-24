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
  resource_categories?: number;
  resources?: number;
  resource_versions?: number;
  content_reviews?: number;
  resource_tags?: number;
  bookmarks?: number;
  personal_notes?: number;
  question_sources?: number;
  questions?: number;
  question_options?: number;
  question_answers?: number;
  question_explanations?: number;
  question_tags?: number;
  question_versions?: number;
  exams?: number;
  exam_sections?: number;
  exam_questions?: number;
  exam_attempts?: number;
  attempt_answers?: number;
  attempt_events?: number;
  exam_results?: number;
  mistake_book?: number;
  learning_progress?: number;
  achievements?: number;
  student_goals?: number;
  study_plans?: number;
  study_tasks?: number;
  flashcards?: number;
  entrance_exams?: number;
  universities?: number;
  courses?: number;
  colleges?: number;
  course_colleges?: number;
  scholarships?: number;
  career_paths?: number;
  opportunities?: number;
  application_deadlines?: number;
  discussion_groups?: number;
  discussion_posts?: number;
  discussion_comments?: number;
  post_votes?: number;
  reports?: number;
  moderation_actions?: number;
  audit_logs?: number;
  system_settings?: number;
  content_sources?: number;
  notifications?: number;
}

export interface BootstrapStatus {
  superAdminExists: boolean;
  passcodeConfigured: boolean;
}

export interface ResourceCategoryItem {
  id: number;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
}

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

export interface SchoolResourceItem {
  id: number;
  slug: string;
  categoryId: number;
  gradeId: number;
  streamId: number | null;
  subjectId: number;
  chapterId: number | null;
  title: string;
  titleNe: string | null;
  summary: string;
  resourceType: string;
  status: string;
  currentVersion: number;
  publishedAt: string | null;
  category: ResourceCategoryItem | null;
  latestVersion?: {
    id: number;
    versionNumber: number;
    contentEn: ChapterContentPayload;
    contentNe: Partial<ChapterContentPayload> | null;
    changelog: string;
  } | null;
  tags?: Array<{ id: number; slug: string; label: string }>;
}

export interface SchoolChapterSummary {
  id: number;
  subjectId: number;
  chapterNumber: number;
  title: string;
  summary: string;
  estimatedHours: number;
  reviewStatus: string;
  topicCount: number;
  publishedResourceCount: number;
  resources: SchoolResourceItem[];
}

export interface SchoolSubjectSummary {
  id: number;
  streamId: number;
  code: string;
  name: string;
  creditHours: number;
  isCompulsory: boolean;
  chapters: SchoolChapterSummary[];
}

export interface SchoolStreamSummary {
  id: number;
  gradeId: number;
  code: string;
  name: string;
  description: string | null;
  subjects: SchoolSubjectSummary[];
}

export interface SchoolGradeOverviewResponse {
  grade: {
    id: number;
    code: string;
    name: string;
    numericLevel: number;
  };
  gradeSlug: string;
  streams: SchoolStreamSummary[];
  categories: ResourceCategoryItem[];
  resources: SchoolResourceItem[];
}

export interface BookmarkItem {
  id: number;
  gradeId: number;
  subjectId: number;
  chapterId: number;
  resourceId: number | null;
  bookmarkType: string;
  title: string;
  createdAt: string;
}

export interface PersonalNoteItem {
  id: number;
  chapterId: number;
  resourceId: number | null;
  title: string;
  highlightText: string | null;
  noteBody: string;
  languageCode: string;
  createdAt: string;
}

export interface ChapterLearningBundleResponse {
  grade: { id: number; code: string; name: string; numericLevel: number };
  stream: { id: number; code: string; name: string } | null;
  subject: { id: number; code: string; name: string; creditHours: number; isCompulsory: boolean };
  chapter: {
    id: number;
    chapterNumber: number;
    title: string;
    summary: string;
    estimatedHours: number;
  };
  siblingChapters: Array<{ id: number; chapterNumber: number; title: string }>;
  topics: Array<{
    id: number;
    topicNumber: string;
    title: string;
    learningObjectives: string;
    difficultyLevel: string;
    estimatedMinutes: number;
  }>;
  resources: SchoolResourceItem[];
  bookmarks: BookmarkItem[];
  personalNotes: PersonalNoteItem[];
}

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

export interface SubmittedAnswerPayload {
  optionKeys?: string[];
  booleanValue?: boolean;
  numericValue?: number | null;
  textValue?: string;
  matchingMap?: Record<string, string>;
}

export interface QuestionSourceItem {
  id: number;
  code: string;
  name: string;
  sourceType: string;
  yearBs: string | null;
  verified: boolean;
}

export interface QuestionBankItem {
  id: number;
  questionUid: string;
  academicLevel: string;
  examination: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  questionType: QuestionType;
  difficulty: string;
  questionContent: QuestionContentJson;
  answerOptions: SnapshotOptionItem[];
  correctAnswer: QuestionAnswerJson;
  explanation: string;
  marks: number;
  negativeMarks: number;
  source: string;
  language: string;
  status: QuestionWorkflowStatus;
  aiGenerated?: boolean;
  reviewer: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  options: Array<{
    id: number;
    optionKey: string;
    optionText: string;
    optionTextNe: string | null;
    isCorrect: boolean;
    sortOrder: number;
  }>;
  tags: Array<{ id: number; slug: string; label: string }>;
  versions: Array<{
    id: number;
    versionNumber: number;
    changeSummary: string;
    createdAt: string;
  }>;
}

export interface QuestionBankResponse {
  canManage: boolean;
  sources: QuestionSourceItem[];
  questions: QuestionBankItem[];
}

export interface ExamSectionItem {
  id: number;
  examId: number;
  title: string;
  subjectName: string;
  description: string | null;
  questionCount: number;
  sectionMarks: number;
  sortOrder: number;
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

export interface ExamResultRow {
  id: number;
  attemptId: number;
  examId: number;
  userId: number;
  totalMarks: number;
  obtainedMarks: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  accuracyPercent: number;
  timeTakenSeconds: number;
  subjectBreakdown: PerformanceBreakdownBucket[];
  chapterBreakdown: PerformanceBreakdownBucket[];
  topicBreakdown: PerformanceBreakdownBucket[];
  createdAt: string;
}

export interface ExamSummaryItem {
  id: number;
  slug: string;
  title: string;
  category: string;
  examinationSlug: string;
  academicLevel: string;
  subjectScope: string;
  chapterScope: string | null;
  totalMarks: number;
  durationMinutes: number;
  negativeMarkingRule: {
    enabled: boolean;
    deductionPerWrong: number;
    description: string;
  };
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  startWindow: string | null;
  endWindow: string | null;
  resultVisibility: string;
  attemptLimit: number;
  instructions: string;
  status: string;
  sections: ExamSectionItem[];
  liveQuestionCount: number;
  liveTotalMarks: number;
  userAttemptCount: number;
  hasActiveAttempt: boolean;
  latestResult: ExamResultRow | null;
}

export interface ExamOverviewResponse {
  exam: ExamSummaryItem;
  sections: ExamSectionItem[];
  userAttemptCount: number;
  activeAttempt: {
    attemptUid: string;
    attemptNumber: number;
    startedAt: string;
    expiresAt: string;
  } | null;
  recentResults: ExamResultRow[];
}

export interface SanitizedExamQuestion {
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
  marks: number;
  negativeMarks: number;
  sortOrder: number;
}

export interface SavedAnswerState {
  questionId: number;
  selectedAnswer: SubmittedAnswerPayload | null;
  status: 'unvisited' | 'answered' | 'not_answered' | 'marked_for_review';
  isMarkedForReview: boolean;
}

export interface ExamAttemptStartResponse {
  resumed: boolean;
  attempt: {
    id: number;
    attemptUid: string;
    attemptNumber: number;
    status: string;
    startedAt: string;
    expiresAt: string;
  };
  examConfig: {
    id: number;
    slug: string;
    title: string;
    category: string;
    academicLevel: string;
    instructions: string;
    negativeMarkingRule: {
      enabled: boolean;
      deductionPerWrong: number;
      description: string;
    };
    resultVisibility: string;
    attemptLimit: number;
  };
  snapshot: {
    examId: number;
    examSlug: string;
    examTitle: string;
    durationMinutes: number;
    totalMarks: number;
    negativeMarkingEnabled: boolean;
    questions: SanitizedExamQuestion[];
  };
  savedAnswers: SavedAnswerState[];
}

export interface GradedQuestionReviewItem {
  questionId: number;
  questionUid: string;
  sectionTitle: string;
  questionType: QuestionType;
  difficulty: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  questionContent: QuestionContentJson;
  options: SnapshotOptionItem[];
  submittedAnswer: SubmittedAnswerPayload | null;
  correctAnswer: QuestionAnswerJson;
  explanation: string;
  explanationNe: string | null;
  status: 'unattempted' | 'correct' | 'incorrect';
  isCorrect: boolean | null;
  maxMarks: number;
  negativeMarks: number;
  marksAwarded: number;
}

export interface ExamResultDetailResponse {
  exam: ExamSummaryItem;
  attempt: {
    id: number;
    attemptUid: string;
    attemptNumber: number;
    status: string;
    startedAt: string;
    submittedAt: string | null;
    timeTakenSeconds: number;
  };
  result: ExamResultRow;
  review: {
    totalMarks: number;
    obtainedMarks: number;
    correctCount: number;
    incorrectCount: number;
    unattemptedCount: number;
    accuracyPercent: number;
    timeTakenSeconds: number;
    subjectBreakdown: PerformanceBreakdownBucket[];
    chapterBreakdown: PerformanceBreakdownBucket[];
    topicBreakdown: PerformanceBreakdownBucket[];
    gradedQuestions: GradedQuestionReviewItem[];
  };
  auditEvents: Array<{
    id: number;
    eventType: string;
    payload: Record<string, unknown> | null;
    createdAt: string;
  }>;
  previousAttempts: Array<{
    attemptId: number;
    attemptUid: string;
    attemptNumber: number;
    status: string;
    obtainedMarks: number;
    totalMarks: number;
    accuracyPercent: number;
    correctCount: number;
    incorrectCount: number;
    timeTakenSeconds: number;
    createdAt: string;
  }>;
}

// ============================================================================
// Phase 5: Signature Student Features & Complete Student Dashboard Types
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

export interface MistakeBookItem {
  id: number;
  sourceType: 'exam' | 'chapter_practice' | 'daily_challenge' | string;
  sourceRefKey: string;
  questionId: number | null;
  resourceId: number | null;
  academicLevel: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  difficulty: string;
  questionSnapshot: MistakeQuestionSnapshot;
  studentWrongAnswer: SubmittedAnswerPayload | Record<string, unknown> | null;
  correctAnswer: QuestionAnswerJson;
  explanation: string;
  status: 'unresolved' | 'resolved' | string;
  attemptCount: number;
  lastAttemptedAt: string;
  resolvedAt: string | null;
  createdAt: string;
}

export interface MistakesSummaryResponse {
  mistakes: MistakeBookItem[];
  counts: {
    total: number;
    unresolved: number;
    resolved: number;
  };
  subjects: string[];
  chapters: string[];
}

export interface WeakTopicItem {
  subjectName: string;
  chapterName: string;
  topicName: string;
  academicLevel: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracyPercent: number;
  severity: 'critical' | 'needs_focus';
  recommendations: {
    chapterNotesLabel: string;
    chapterNotesRoute: string;
    targetedPracticeRoute: string;
    miniTestRoute: string;
    revisionSheetLabel: string;
    retestRoute: string;
  };
}

export interface LearningProgressRow {
  id: number;
  academicLevel: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracyPercent: number;
  isWeak: boolean;
  lastPracticedAt: string;
}

export interface AchievementBadgeItem {
  code: string;
  title: string;
  description: string;
  category: string;
  targetLabel: string;
  unlocked: boolean;
  unlockedAt: string | null;
  metricValue: number;
}

export interface StudentGoalItem {
  id: number;
  targetTrack: string;
  targetExamSlug: string | null;
  targetExamName: string | null;
  targetExamDate: string | null;
  dailyStudyMinutes: number;
  dailyQuestionTarget: number;
  selectedSubjects: string[];
  careerInterests: string[];
  leaderboardPrivacy: 'masked' | 'alias' | 'public_name' | string;
  leaderboardAlias: string | null;
  streakDays: number;
  longestStreakDays: number;
  lastActiveDate: string | null;
  totalQuestionsSolved: number;
  dailyChallengesCompleted: number;
  lastDailyChallengeDate: string | null;
  improvementScore: number;
}

export interface StudyPlanItem {
  id: number;
  title: string;
  goalFocus: string;
  subjectName: string;
  gradeCode: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
}

export interface StudyTaskItem {
  id: number;
  planId: number | null;
  title: string;
  taskType: 'chapter_study' | 'revision' | 'practice' | 'mock_test' | string;
  subjectName: string;
  chapterName: string | null;
  scheduledDate: string;
  estimatedMinutes: number;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface PlannerBundleResponse {
  goal: StudentGoalItem;
  plans: StudyPlanItem[];
  tasks: StudyTaskItem[];
  todayDate: string;
}

export interface FlashcardItem {
  id: number;
  curatedTemplateId: number;
  isCurated: boolean;
  category: 'definition' | 'formula' | 'important_fact' | 'vocabulary' | string;
  academicLevel: string;
  subjectName: string;
  chapterName: string;
  frontText: string;
  backText: string;
  hintText: string | null;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  nextReviewAt: string;
  lastReviewedAt: string | null;
  isDue: boolean;
}

export interface FlashcardsDeckResponse {
  cards: FlashcardItem[];
  counts: {
    total: number;
    due: number;
    custom: number;
  };
}

export interface DailyChallengeResponse {
  todayDate: string;
  mode: string;
  questionOfTheDay: SanitizedExamQuestion | null;
  challengeQuestions: SanitizedExamQuestion[];
  availableSubjects: string[];
  userProgress: {
    streakDays: number;
    dailyChallengesCompleted: number;
    doneToday: boolean;
    totalQuestionsSolved: number;
  } | null;
}

export interface DailyChallengeSubmitResponse {
  mode: string;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  accuracyPercent: number;
  mistakesRecorded: number;
  mistakesResolved: number;
  streakDays: number;
  dailyChallengesCompleted: number;
  newlyUnlockedBadges: Array<{ code: string; title: string; description: string }>;
  gradedItems: Array<{
    questionId: number;
    questionUid: string;
    prompt: string;
    subjectName: string;
    chapterName: string;
    topicName: string;
    isCorrect: boolean;
    submittedAnswer: SubmittedAnswerPayload | null;
    correctAnswer: QuestionAnswerJson;
    explanation: string;
  }>;
}

export interface LeaderboardEntryItem {
  rank: number;
  displayLabel: string;
  isCurrentUser: boolean;
  targetTrack: string;
  scoreMetric: number;
  metricUnit: string;
  accuracyPercent: number;
  streakDays: number;
  questionsSolved: number;
  badgesCount: number;
}

export interface LeaderboardResponse {
  scope: string;
  entries: LeaderboardEntryItem[];
  myPrivacy: {
    leaderboardPrivacy: 'masked' | 'alias' | 'public_name' | string;
    leaderboardAlias: string | null;
  } | null;
  achievementsCatalog: AchievementBadgeItem[];
}

export interface RecommendedNextActionItem {
  priorityType: 'weak_topic' | 'unresolved_mistakes' | 'daily_task' | 'flashcards' | 'daily_challenge' | 'mock_exam';
  title: string;
  reason: string;
  ctaLabel: string;
  route: string;
  metricBadge: string;
}

export interface StudentDashboardResponse {
  todayDate: string;
  recommendedNextAction: RecommendedNextActionItem;
  goal: StudentGoalItem;
  continueLearning: {
    title: string;
    subtitle: string;
    route: string;
    source: string;
  };
  myClasses: Array<{
    slug: string;
    code: string;
    name: string;
    route: string;
    isPrimary: boolean;
  }>;
  mySubjects: Array<{
    name: string;
    attempts: number;
    accuracyPercent: number;
    isWeak: boolean;
  }>;
  dailyStudyPlan: {
    plansCount: number;
    tasksToday: StudyTaskItem[];
    completedTodayCount: number;
    totalTodayCount: number;
  };
  dailyChallenge: {
    doneToday: boolean;
    streakDays: number;
    dailyChallengesCompleted: number;
    questionOfTheDayPrompt: string | null;
    questionOfTheDaySubject: string | null;
  };
  upcomingExamCountdown: {
    examTitle: string;
    examSlug: string | null;
    targetDate: string | null;
    daysRemaining: number | null;
  };
  recentTests: Array<{
    attemptUid: string;
    examSlug: string;
    examTitle: string;
    obtainedMarks: number;
    totalMarks: number;
    accuracyPercent: number;
    submittedAt: string;
  }>;
  performanceOverview: {
    overallAccuracy: number;
    totalQuestionsSolved: number;
    completedMockTests: number;
    topicProgress: LearningProgressRow[];
    weakTopics: WeakTopicItem[];
  };
  mistakeBookSummary: {
    total: number;
    unresolved: number;
    resolved: number;
    recentUnresolved: MistakeBookItem[];
  };
  bookmarks: BookmarkItem[];
  achievements: AchievementBadgeItem[];
  careerInterests: string[];
  opportunities: Array<{
    id: string;
    kind: 'career' | 'scholarship' | 'deadline';
    title: string;
    organization: string;
    track: string;
    windowLabel: string;
    summary: string;
    route: string;
  }>;
  dueFlashcardsCount: number;
}

export interface ExploreUniversityItem {
  id: number;
  slug: string;
  shortCode: string;
  name: string;
  establishedYear: number;
  universityType: string;
  location: string;
  officialWebsite: string;
  overview: string;
  source: string;
  lastVerifiedDate: string;
}

export interface ExploreEntranceRefItem {
  id: number;
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
}

export interface ExploreCourseItem {
  id: number;
  slug: string;
  code: string;
  name: string;
  fullForm: string;
  category: string;
  universityId: number;
  universityShortCode: string;
  universityName: string;
  entranceExamId: number | null;
  entranceExamSlug: string | null;
  entranceExamName: string | null;
  durationYears: number;
  durationLabel: string;
  eligibility: string;
  admissionProcess: string;
  curriculumModules: Array<{ term: string; subjects: string[] }>;
  curriculumModulesSummary: string;
  verifiedFeeMinNpr: number;
  verifiedFeeMaxNpr: number;
  verifiedFeeNote: string;
  careerPossibilities: string[];
  requiredSkills: string[];
  higherStudiesOptions: string[];
  streamRecommendation: string;
  collegesCount: number;
  source: string;
  lastVerifiedDate: string;
}

export interface ExploreCourseOfferingCollege {
  id: number;
  slug: string;
  name: string;
  institutionType: string;
  province: string;
  district: string;
  city: string;
  officialWebsite: string;
  universityShortCode: string;
  totalSeats: number;
  scholarshipSeats: number;
  verifiedFeeMinNpr: number;
  verifiedFeeMaxNpr: number;
  feeStructureNote: string;
  admissionNote: string;
  source: string;
  lastVerifiedDate: string;
}

export interface ExploreScholarshipItem {
  id: number;
  slug: string;
  title: string;
  provider: string;
  category: string;
  eligibility: string;
  financialBenefits: string;
  applicationDeadline: string;
  deadlineStatus: string;
  requiredDocuments: string[];
  applicationInstructions: string[];
  targetStreams: string[];
  officialSourceUrl: string;
  source: string;
  lastVerifiedDate: string;
}

export interface ExploreCourseDetailResponse {
  course: ExploreCourseItem;
  university: ExploreUniversityItem;
  entranceExam: ExploreEntranceRefItem | null;
  colleges: ExploreCourseOfferingCollege[];
  scholarships: ExploreScholarshipItem[];
}

export interface ExploreCollegeItem {
  id: number;
  slug: string;
  name: string;
  institutionType: string;
  province: string;
  district: string;
  city: string;
  officialWebsite: string;
  contactEmail: string;
  contactPhone: string;
  admissionRequirements: string;
  facilities: string[];
  scholarshipHighlights: string[];
  verifiedFacts: {
    affiliationBody: string;
    institutionCategory: string;
    accreditedSince?: string;
    verifiedIntakeSummary: string;
    feeVerificationNote: string;
  };
  promotionalClaims: string[];
  universityShortCode: string;
  universityName: string;
  offeredCourses: Array<{
    courseSlug: string;
    courseName: string;
    courseCode: string;
    totalSeats: number;
    scholarshipSeats: number;
    verifiedFeeMinNpr: number;
    verifiedFeeMaxNpr: number;
    feeStructureNote: string;
  }>;
  offeredCourseSlugs: string[];
  source: string;
  lastVerifiedDate: string;
}

export interface ExploreCareerStage {
  stageOrder: number;
  stageCode: 'class_10' | 'plus_two' | 'bachelor' | 'skills_internships' | 'career_higher';
  stageLabel: string;
  title: string;
  guidance: string;
  milestones: string[];
  recommendedRoute?: string;
}

export interface ExploreCareerPathItem {
  id: number;
  slug: string;
  title: string;
  category: string;
  summary: string;
  demandOutlook: string;
  licensingBody: string;
  averageSalaryRangeNpr: string;
  roadmapStages: ExploreCareerStage[];
  recommendedCourseSlugs: string[];
  recommendedCourses: Array<{
    slug: string;
    name: string;
    durationLabel: string;
    universityShortCode: string;
  }>;
  requiredSkills: string[];
  source: string;
  lastVerifiedDate: string;
}

export interface ExploreOpportunityItem {
  id: number;
  slug: string;
  title: string;
  organization: string;
  category: string;
  eligibility: string;
  benefitOrPrize: string;
  deadlineDate: string;
  windowLabel: string;
  mode: string;
  location: string;
  routeOrUrl: string;
  careerCategories: string[];
  source: string;
  lastVerifiedDate: string;
}

export interface ExploreDeadlineItem {
  id: number;
  slug: string;
  title: string;
  authority: string;
  category: string;
  targetAudience: string;
  openDate: string;
  deadlineDate: string;
  examDate: string;
  status: string;
  actionRoute: string;
  officialUrl: string;
  source: string;
  lastVerifiedDate: string;
}

export interface BachelorBridgeResponse {
  entrances: Array<{
    title: string;
    subtitle: string;
    detail: string;
    metric: string;
    route: string;
    source: string;
    lastVerifiedDate: string;
  }>;
  programs: Array<{
    title: string;
    subtitle: string;
    detail: string;
    metric: string;
    route: string;
    source: string;
    lastVerifiedDate: string;
  }>;
  colleges: Array<{
    title: string;
    subtitle: string;
    detail: string;
    metric: string;
    route: string;
    source: string;
    lastVerifiedDate: string;
  }>;
  scholarships: Array<{
    title: string;
    subtitle: string;
    detail: string;
    metric: string;
    route: string;
    source: string;
    lastVerifiedDate: string;
  }>;
  careers: Array<{
    title: string;
    subtitle: string;
    detail: string;
    metric: string;
    route: string;
    source: string;
    lastVerifiedDate: string;
  }>;
}

// ============================================================================
// Phase 7: AI-Powered Learning Suite & Student Community Types
// ============================================================================

export type AiStudyAction =
  | 'explain_simple'
  | 'solve_numerical'
  | 'summarize_chapter'
  | 'generate_practice_5'
  | 'explain_incorrect'
  | 'custom_chat';

export interface AiStudyPracticeItem {
  prompt: string;
  options: Array<{ key: string; text: string }>;
  correctKey: string;
  explanation: string;
}

export interface AiStudyAssistantResponse {
  answer: string;
  keyTakeaways: string[];
  practiceQuestions: AiStudyPracticeItem[];
  language: 'en' | 'ne';
  model: string;
  rateLimitRemaining: number;
}

export interface AiGeneratedQuestionDraft {
  prompt: string;
  questionType: 'single_mcq' | 'numerical';
  options: Array<{ optionKey: string; optionText: string; isCorrect: boolean }>;
  correctOptionKey?: string;
  numericValue?: number;
  unitHint?: string;
  explanation: string;
  marks: number;
  status: 'Draft';
  sourceLabel: 'AI-Generated — Pending Academic Review';
}

export interface AiQuestionGeneratorResponse {
  questions: AiGeneratedQuestionDraft[];
  savedQuestions: QuestionBankItem[];
  notice: string;
  rateLimitRemaining: number;
}

export interface AiCareerCitation {
  type: 'course' | 'college' | 'entrance' | 'scholarship' | 'career';
  title: string;
  route: string;
  source: string;
  lastVerifiedDate: string;
}

export interface AiCareerAssistantResponse {
  guidance: string;
  keyRecommendations: string[];
  citedRecords: AiCareerCitation[];
  disclaimer: string;
  rateLimitRemaining: number;
}

export interface DiscussionGroupItem {
  id: number;
  slug: string;
  name: string;
  groupType: 'class' | 'subject' | 'entrance';
  academicLevel: string;
  subjectName: string;
  description: string;
  memberCount: number;
  postCount: number;
  unansweredCount: number;
  isModerated: boolean;
}

export interface CommunityAuthorBadge {
  displayHandle: string;
  roleLabel: string;
  isEducator: boolean;
  trackLabel: string;
}

export interface DiscussionCommentItem {
  id: number;
  postId: number;
  body: string;
  author: CommunityAuthorBadge;
  isTeacherVerified: boolean;
  verifiedByName: string | null;
  verifiedAt: string | null;
  upvoteCount: number;
  userHasVoted: boolean;
  moderationStatus: 'active' | 'flagged' | 'hidden';
  createdAt: string;
}

export interface DiscussionPostItem {
  id: number;
  groupId: number;
  groupSlug: string;
  groupName: string;
  title: string;
  body: string;
  postType: 'question' | 'explanation' | 'resource_tip';
  tags: string[];
  author: CommunityAuthorBadge;
  upvoteCount: number;
  commentCount: number;
  isAnswered: boolean;
  hasTeacherVerified: boolean;
  userHasVoted: boolean;
  moderationStatus: 'active' | 'flagged' | 'hidden';
  createdAt: string;
  comments: DiscussionCommentItem[];
}

export interface CommunityModerationReportItem {
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
}

export interface CommunityFeedResponse {
  groups: DiscussionGroupItem[];
  posts: DiscussionPostItem[];
  canVerifyAnswers: boolean;
  canModerate: boolean;
  moderationQueue: CommunityModerationReportItem[];
  youthSafetyRules: string[];
}

// ============================================================================
// Phase 8: Complete Nepal Administration System, RBAC & Content Governance
// ============================================================================

export type AdminModuleId =
  | 'overview'
  | 'users'
  | 'roles'
  | 'curriculum'
  | 'content'
  | 'questions'
  | 'exams'
  | 'entrance'
  | 'explorer'
  | 'moderation'
  | 'announcements'
  | 'analytics'
  | 'settings'
  | 'audit_logs';

export type EditorialLifecycleStage =
  | 'Draft'
  | 'Review'
  | 'Correction'
  | 'Approved'
  | 'Published'
  | 'Archived';

export interface AdminOverviewMetricsResponse {
  allowedModules: AdminModuleId[];
  metrics: {
    registeredStudents: number;
    activeStudents: number;
    newRegistrations7d: number;
    totalUsers: number;
    examinationAttempts: number;
    submittedAttempts: number;
    publishedResources: number;
    contentAwaitingReview: number;
    publishedQuestions: number;
    aiDraftsPendingReview: number;
    openModerationReports: number;
  };
  questionVerificationStatus: Array<{ stage: string; count: number }>;
  resourceLifecycleStatus: Array<{ stage: string; count: number }>;
  popularResources: Array<{
    id: number;
    title: string;
    subjectName: string;
    status: string;
    bookmarkCount: number;
  }>;
  popularSubjects: Array<{
    subjectName: string;
    attemptsCount: number;
    avgAccuracyPercent: number;
  }>;
  recentActivity: AuditLogItem[];
}

export interface ContentSourceItem {
  id: number;
  slug: string;
  name: string;
  authorityType: string;
  countryCode: string;
  officialUrl: string | null;
  verificationNotes: string;
  isTrusted: boolean;
}

export interface AdminContentResourceItem {
  id: number;
  slug: string;
  title: string;
  summary: string;
  resourceType: string;
  status: string;
  lifecycleStage: EditorialLifecycleStage;
  currentVersion: number;
  sourceSlug: string | null;
  gradeName: string;
  subjectName: string;
  chapterTitle: string | null;
  creatorEmail: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
  latestReviewDecision: string | null;
  latestReviewComment: string | null;
}

export interface AdminExamItem {
  id: number;
  slug: string;
  title: string;
  category: string;
  examinationSlug: string;
  academicLevel: string;
  subjectScope: string;
  totalMarks: number;
  durationMinutes: number;
  negativeMarkingRule: {
    enabled: boolean;
    deductionPerWrong: number;
    description: string;
  };
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  startWindow: string | null;
  endWindow: string | null;
  resultVisibility: string;
  attemptLimit: number;
  status: string;
  questionCount: number;
  attemptCount: number;
}

export interface AdminExamResultSummary {
  attemptUid: string;
  userEmail: string;
  studentName: string;
  obtainedMarks: number;
  totalMarks: number;
  accuracyPercent: number;
  correctCount: number;
  incorrectCount: number;
  timeTakenSeconds: number;
  submittedAt: string;
}

export interface AnnouncementItem {
  id: number;
  audienceRole: string;
  title: string;
  message: string;
  category: string;
  isPublished: boolean;
  authorName: string;
  createdAt: string;
}

export interface SystemSettingItem {
  id: number;
  settingKey: string;
  category: string;
  label: string;
  valueJson: Record<string, unknown>;
  description: string;
  countryCode: string;
  updatedAt: string;
}

export interface AuditLogItem {
  id: number;
  actorId: number | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetEntity: string;
  targetId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CsvImportReport {
  totalRows: number;
  importedCount: number;
  skippedDuplicateCount: number;
  errorCount: number;
  importedQuestions: Array<{ id: number; questionUid: string; prompt: string; status: string }>;
  duplicates: Array<{ rowNumber: number; prompt: string; reason: string }>;
  errors: Array<{ rowNumber: number; message: string }>;
}

export interface AdminAnalyticsBundle {
  subjectPerformance: Array<{
    subjectName: string;
    totalAttempts: number;
    avgAccuracy: number;
    weakTopicCount: number;
  }>;
  examCompletion: Array<{
    examTitle: string;
    attemptsCount: number;
    submittedCount: number;
    avgAccuracyPercent: number;
  }>;
  aiGovernance: {
    totalAiDrafts: number;
    approvedAiQuestions: number;
    pendingAiQuestions: number;
  };
  totals: {
    bookmarksCount: number;
    notesCount: number;
    mistakesLogged: number;
    mistakesResolved: number;
  };
}





