export interface BadgeDefinition {
  code:
    | 'first_test'
    | 'seven_day_streak'
    | 'hundred_questions'
    | 'chapter_master'
    | 'ten_mock_tests'
    | 'most_improved'
    | 'consistent_learner';
  title: string;
  description: string;
  category: 'testing' | 'streak' | 'mastery' | 'improvement';
  targetLabel: string;
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  {
    code: 'first_test',
    title: 'First Test',
    description: 'Completed your first timed mock examination or daily challenge.',
    category: 'testing',
    targetLabel: '1 completed test or challenge',
  },
  {
    code: 'seven_day_streak',
    title: 'Seven-Day Streak',
    description: 'Maintained active practice or study check-ins across 7 consecutive days.',
    category: 'streak',
    targetLabel: '7-day study streak',
  },
  {
    code: 'hundred_questions',
    title: '100 Questions Solved',
    description: 'Answered 100 or more questions across mock exams, chapter practice, and daily sets.',
    category: 'mastery',
    targetLabel: '100 questions solved',
  },
  {
    code: 'chapter_master',
    title: 'Chapter Master',
    description: 'Reached at least 85% accuracy across 3 or more syllabus topics.',
    category: 'mastery',
    targetLabel: '3+ topics at ≥85% accuracy',
  },
  {
    code: 'ten_mock_tests',
    title: 'Ten Mock Tests',
    description: 'Completed 10 server-evaluated mock examinations.',
    category: 'testing',
    targetLabel: '10 completed mock exams',
  },
  {
    code: 'most_improved',
    title: 'Most Improved',
    description: 'Raised examination accuracy by +10% or resolved 3+ mistakes in Reattempt Mode.',
    category: 'improvement',
    targetLabel: '+10% score gain or 3 resolved mistakes',
  },
  {
    code: 'consistent_learner',
    title: 'Consistent Learner',
    description: 'Maintained a 3+ day streak and completed at least 3 scheduled study tasks.',
    category: 'streak',
    targetLabel: '3-day streak & 3 study tasks',
  },
];

export interface BadgeEvaluationMetrics {
  completedMockTests: number;
  dailyChallengesCompleted: number;
  streakDays: number;
  totalQuestionsSolved: number;
  masteredTopicsCount: number;
  resolvedMistakesCount: number;
  improvementDeltaPercent: number;
  completedStudyTasks: number;
}

export function evaluateUnlockedBadges(
  metrics: BadgeEvaluationMetrics,
): Array<BadgeDefinition & { metricValue: number }> {
  const earned: Array<BadgeDefinition & { metricValue: number }> = [];
  const byCode = new Map(BADGE_CATALOG.map((b) => [b.code, b]));

  if (metrics.completedMockTests + metrics.dailyChallengesCompleted >= 1) {
    earned.push({
      ...byCode.get('first_test')!,
      metricValue: metrics.completedMockTests + metrics.dailyChallengesCompleted,
    });
  }
  if (metrics.streakDays >= 7) {
    earned.push({
      ...byCode.get('seven_day_streak')!,
      metricValue: metrics.streakDays,
    });
  }
  if (metrics.totalQuestionsSolved >= 100) {
    earned.push({
      ...byCode.get('hundred_questions')!,
      metricValue: metrics.totalQuestionsSolved,
    });
  }
  if (metrics.masteredTopicsCount >= 3) {
    earned.push({
      ...byCode.get('chapter_master')!,
      metricValue: metrics.masteredTopicsCount,
    });
  }
  if (metrics.completedMockTests >= 10) {
    earned.push({
      ...byCode.get('ten_mock_tests')!,
      metricValue: metrics.completedMockTests,
    });
  }
  if (metrics.improvementDeltaPercent >= 10 || metrics.resolvedMistakesCount >= 3) {
    earned.push({
      ...byCode.get('most_improved')!,
      metricValue: Math.max(
        Math.round(metrics.improvementDeltaPercent),
        metrics.resolvedMistakesCount,
      ),
    });
  }
  if (metrics.streakDays >= 3 && metrics.completedStudyTasks >= 3) {
    earned.push({
      ...byCode.get('consistent_learner')!,
      metricValue: metrics.completedStudyTasks,
    });
  }

  return earned;
}

export interface LearningProgressInput {
  id?: number;
  academicLevel: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracyPercent: number;
  lastPracticedAt?: string | Date;
}

export interface WeakTopicRecoveryPlanItem {
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

function inferSchoolRouteForSubject(
  academicLevel: string,
  subjectName: string,
): { notesRoute: string; miniTestRoute: string } {
  const lvl = academicLevel.toLowerCase();
  const sub = subjectName.toLowerCase();

  let gradeSlug = 'class-10';
  let subjectCode = 'MATH-10';
  let miniTestRoute = '/exams/see-compulsory-mock-1';

  if (lvl.includes('12') || lvl.includes('neb') || lvl.includes('entrance') || lvl.includes('ioe') || lvl.includes('mecee')) {
    gradeSlug = 'class-12';
    if (sub.includes('phys')) {
      subjectCode = 'PHY-12';
      miniTestRoute = '/exams/class-12-science-mock-1';
    } else if (sub.includes('chem')) {
      subjectCode = 'CHEM-12';
      miniTestRoute = '/exams/class-12-science-mock-1';
    } else if (sub.includes('bio') || sub.includes('zoo') || sub.includes('bot')) {
      subjectCode = 'BIO-12';
      miniTestRoute = '/exams/mecee-bl-mock-1';
    } else if (sub.includes('acc')) {
      subjectCode = 'ACC-12';
      miniTestRoute = '/exams/class-12-management-mock-1';
    } else if (sub.includes('econ')) {
      subjectCode = 'ECON-12';
      miniTestRoute = '/exams/class-12-management-mock-1';
    } else if (sub.includes('comp')) {
      subjectCode = 'COMP-12';
      miniTestRoute = '/exams/bsc-csit-mock-1';
    } else if (sub.includes('eng')) {
      subjectCode = 'ENG-12';
      miniTestRoute = '/exams/cmat-mock-1';
    } else {
      subjectCode = 'MATH-12';
      miniTestRoute = '/exams/ioe-be-mock-1';
    }
  } else if (lvl.includes('11')) {
    gradeSlug = 'class-11';
    if (sub.includes('phys')) subjectCode = 'PHY-11';
    else if (sub.includes('chem')) subjectCode = 'CHEM-11';
    else if (sub.includes('bio')) subjectCode = 'BIO-11';
    else if (sub.includes('acc')) subjectCode = 'ACC-11';
    else subjectCode = 'MATH-11';
    miniTestRoute = '/exams/class-12-science-mock-1';
  } else {
    gradeSlug = 'class-10';
    if (sub.includes('sci')) subjectCode = 'SCI-10';
    else if (sub.includes('eng')) subjectCode = 'ENG-10';
    else if (sub.includes('nep')) subjectCode = 'NEP-10';
    else if (sub.includes('soc')) subjectCode = 'SOC-10';
    else if (sub.includes('opt')) subjectCode = 'OMATH-10';
    else if (sub.includes('comp')) subjectCode = 'COMP-10';
    else subjectCode = 'MATH-10';
  }

  return {
    notesRoute: `/school/${gradeSlug}/${subjectCode}/1`,
    miniTestRoute,
  };
}

export function detectWeakTopics(
  rows: LearningProgressInput[],
  thresholdPercent = 60,
): WeakTopicRecoveryPlanItem[] {
  return rows
    .filter((row) => row.totalAttempts > 0 && row.accuracyPercent < thresholdPercent)
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent || b.totalAttempts - a.totalAttempts)
    .map((row) => {
      const routes = inferSchoolRouteForSubject(row.academicLevel, row.subjectName);
      return {
        subjectName: row.subjectName,
        chapterName: row.chapterName,
        topicName: row.topicName,
        academicLevel: row.academicLevel,
        totalAttempts: row.totalAttempts,
        correctAttempts: row.correctAttempts,
        accuracyPercent: Math.round(row.accuracyPercent * 10) / 10,
        severity: row.accuracyPercent < 40 ? 'critical' : 'needs_focus',
        recommendations: {
          chapterNotesLabel: `Review ${row.subjectName} — ${row.chapterName} notes`,
          chapterNotesRoute: `${routes.notesRoute}?tab=notes`,
          targetedPracticeRoute: `/question-bank?subject=${encodeURIComponent(row.subjectName)}`,
          miniTestRoute: '/practice/daily',
          revisionSheetLabel: `Open ${row.chapterName} Revision Sheet & Formulas`,
          retestRoute: routes.miniTestRoute,
        },
      };
    });
}

export type SpacedRating = 'again' | 'hard' | 'good' | 'easy';

export interface SpacedReviewInput {
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  rating: SpacedRating;
  now?: Date;
}

export interface SpacedReviewResult {
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  nextReviewAt: Date;
}

export function computeNextSpacedReview(input: SpacedReviewInput): SpacedReviewResult {
  const now = input.now ?? new Date();
  let repetitions = Math.max(0, input.repetitions);
  let easeFactor = Math.max(1.3, input.easeFactor || 2.5);
  let intervalDays = Math.max(1, input.intervalDays || 1);

  if (input.rating === 'again') {
    repetitions = 0;
    intervalDays = 1;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else if (input.rating === 'hard') {
    repetitions += 1;
    intervalDays = repetitions === 1 ? 1 : Math.max(2, Math.round(intervalDays * 1.2));
    easeFactor = Math.max(1.3, easeFactor - 0.14);
  } else if (input.rating === 'good') {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 4;
    else intervalDays = Math.round(intervalDays * easeFactor);
  } else {
    // easy
    repetitions += 1;
    if (repetitions === 1) intervalDays = 3;
    else if (repetitions === 2) intervalDays = 7;
    else intervalDays = Math.round(intervalDays * easeFactor * 1.3);
    easeFactor = Math.min(3.2, easeFactor + 0.15);
  }

  const nextReviewAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return {
    repetitions,
    intervalDays,
    easeFactor: Math.round(easeFactor * 100) / 100,
    nextReviewAt,
  };
}

export type LeaderboardPrivacyMode = 'masked' | 'alias' | 'public_name';

export function formatPrivacySafeName(params: {
  fullName: string;
  displayName?: string | null;
  leaderboardAlias?: string | null;
  privacyMode: LeaderboardPrivacyMode | string;
  userId: number;
}): string {
  const cleanAlias = params.leaderboardAlias?.trim();
  const cleanName = (params.displayName || params.fullName || 'Learner').trim();

  if (params.privacyMode === 'alias') {
    return cleanAlias && cleanAlias.length >= 2 ? cleanAlias : `Scholar #${params.userId}`;
  }

  if (params.privacyMode === 'public_name') {
    // Strip accidental email strings if someone put an email as their name
    return cleanName.includes('@') ? cleanName.split('@')[0] : cleanName;
  }

  // Default: 'masked'
  const base = cleanName.includes('@') ? cleanName.split('@')[0] : cleanName;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const first = parts[0];
    const masked = first.length <= 2 ? `${first[0]}*` : `${first.slice(0, 2)}${'*'.repeat(Math.min(4, first.length - 2))}`;
    return `${masked} · #${params.userId}`;
  }
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() ?? 'S';
  return `${firstName} ${lastInitial}. · #${params.userId}`;
}

export interface RecommendedNextAction {
  priorityType: 'weak_topic' | 'unresolved_mistakes' | 'daily_task' | 'flashcards' | 'daily_challenge' | 'mock_exam';
  title: string;
  reason: string;
  ctaLabel: string;
  route: string;
  metricBadge: string;
}

export function computeRecommendedNextAction(params: {
  weakTopics: WeakTopicRecoveryPlanItem[];
  unresolvedMistakesCount: number;
  pendingTaskTodayTitle: string | null;
  pendingTasksTodayCount: number;
  dueFlashcardsCount: number;
  dailyChallengeDoneToday: boolean;
  targetExamSlug?: string | null;
}): RecommendedNextAction {
  if (params.weakTopics.length > 0) {
    const worst = params.weakTopics[0];
    return {
      priorityType: 'weak_topic',
      title: `Strengthen Weak Topic: ${worst.topicName}`,
      reason: `Accuracy in ${worst.subjectName} (${worst.chapterName}) is ${worst.accuracyPercent}%, below the 60% mastery target.`,
      ctaLabel: 'Open Recovery Notes & Practice',
      route: worst.recommendations.chapterNotesRoute,
      metricBadge: `${worst.accuracyPercent}% accuracy`,
    };
  }

  if (params.unresolvedMistakesCount > 0) {
    return {
      priorityType: 'unresolved_mistakes',
      title: `Clear ${params.unresolvedMistakesCount} Unresolved Mistake${params.unresolvedMistakesCount === 1 ? '' : 's'}`,
      reason: 'Reattempt previously missed questions to lock concepts into long-term memory and move items to Resolved.',
      ctaLabel: 'Launch Mistake Reattempt Mode',
      route: '/dashboard/mistakes',
      metricBadge: `${params.unresolvedMistakesCount} unresolved`,
    };
  }

  if (params.pendingTasksTodayCount > 0 && params.pendingTaskTodayTitle) {
    return {
      priorityType: 'daily_task',
      title: `Complete Today's Task: ${params.pendingTaskTodayTitle}`,
      reason: `You have ${params.pendingTasksTodayCount} scheduled study task${params.pendingTasksTodayCount === 1 ? '' : 's'} remaining on today's planner.`,
      ctaLabel: 'Open Study Planner',
      route: '/dashboard/planner',
      metricBadge: `${params.pendingTasksTodayCount} due today`,
    };
  }

  if (params.dueFlashcardsCount > 0) {
    return {
      priorityType: 'flashcards',
      title: `Review ${params.dueFlashcardsCount} Spaced-Repetition Card${params.dueFlashcardsCount === 1 ? '' : 's'}`,
      reason: 'Scheduled formulas, definitions, and high-yield facts are ready for recall review today.',
      ctaLabel: 'Start Flashcard Review',
      route: '/dashboard/flashcards',
      metricBadge: `${params.dueFlashcardsCount} due now`,
    };
  }

  if (!params.dailyChallengeDoneToday) {
    return {
      priorityType: 'daily_challenge',
      title: 'Complete Today’s Question of the Day & Daily 5',
      reason: 'Keep your active learning streak climbing and earn leaderboard points.',
      ctaLabel: 'Start Daily Challenge',
      route: '/practice/daily',
      metricBadge: 'Daily streak open',
    };
  }

  return {
    priorityType: 'mock_exam',
    title: 'Take a Server-Validated Timed Mock Examination',
    reason: 'All daily targets and weak topics are clear—benchmark exam speed under real negative-marking rules.',
    ctaLabel: 'Open Exam Center',
    route: params.targetExamSlug ? `/exams/${params.targetExamSlug}` : '/exams',
    metricBadge: 'Exam ready',
  };
}

export interface CareerOpportunityItem {
  id: string;
  kind: 'career' | 'scholarship' | 'deadline';
  title: string;
  organization: string;
  track: string;
  windowLabel: string;
  summary: string;
  route: string;
}

export const CAREER_OPPORTUNITIES_CATALOG: CareerOpportunityItem[] = [
  {
    id: 'opp-ioe-scholarship',
    kind: 'scholarship',
    title: 'Pulchowk & IOE Constituent Regular Fee Scholarship',
    organization: 'Tribhuvan University · Institute of Engineering',
    track: 'Engineering',
    windowLabel: 'Bhadra / Shrawan Entrance Cycle',
    summary: 'Top-ranked IOE CBT scorers qualify for heavily subsidized regular tuition seats across Civil, Computer, Electrical, and Electronics.',
    route: '/entrance/ioe',
  },
  {
    id: 'opp-mecee-scholarship',
    kind: 'scholarship',
    title: 'MEC 75% Public Medical Scholarship Seats',
    organization: 'Medical Education Commission (MEC), Nepal',
    track: 'Medical & Health',
    windowLabel: 'MECEE-BL National Merit Matching',
    summary: 'Merit-based full scholarship seats in MBBS, BDS, B.Sc. Nursing, and BPH across government and private medical colleges.',
    route: '/entrance/mecee-bl',
  },
  {
    id: 'opp-csit-career',
    kind: 'career',
    title: 'Software Engineering, AI & Data Science Pathway (B.Sc. CSIT / BIT)',
    organization: 'TU IOST & National Tech Ecosystem',
    track: 'IT & Computer Science',
    windowLabel: 'Class 12 Science / Math Bridge',
    summary: 'Combines theoretical computing, algorithms, and full-stack internships with Nepal software firms and global remote teams.',
    route: '/entrance/bsc-csit',
  },
  {
    id: 'opp-cmat-management',
    kind: 'deadline',
    title: 'CMAT / PUMAT / KUUMAT Management Entrance Readiness',
    organization: 'TU FOM · Pokhara University · Kathmandu University',
    track: 'Management',
    windowLabel: 'Bhadra – Ashwin Admission Window',
    summary: 'Prepares Management and Science +2 graduates for BBA, BIM, BBM, and BHM cohorts with quantitative and verbal aptitude sets.',
    route: '/entrance/cmat',
  },
  {
    id: 'opp-neb-stem-fellowship',
    kind: 'scholarship',
    title: 'Mahatma Gandhi & National Merit (+2 / Bachelor) Grants',
    organization: 'Ministry of Education, Science & Technology (MOEST)',
    track: 'SEE / +2 Merit',
    windowLabel: 'Post-SEE & +2 Result Window',
    summary: 'Need-and-merit scholarships supporting SEE and Grade 12 graduates across Nepal public and community campuses.',
    route: '/school/class-12',
  },
];
