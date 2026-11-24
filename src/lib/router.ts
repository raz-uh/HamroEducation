export type AppRoute =
  | { kind: 'home'; tab: 'curriculum' | 'rbac' | 'institutions' | 'schema' }
  | { kind: 'school-grade'; gradeSlug: 'class-10' | 'see' | 'class-11' | 'class-12' }
  | {
      kind: 'school-chapter';
      gradeSlug: string;
      subjectCode: string;
      chapterKey: string;
    }
  | { kind: 'entrance-hub' }
  | { kind: 'entrance-detail'; examSlug: string }
  | { kind: 'exams-hub' }
  | { kind: 'question-bank' }
  | { kind: 'exam-runner'; examId: string }
  | { kind: 'exam-result'; examId: string }
  | { kind: 'dashboard' }
  | { kind: 'dashboard-mistakes' }
  | { kind: 'dashboard-flashcards' }
  | { kind: 'dashboard-planner' }
  | { kind: 'daily-practice'; initialSection?: 'challenges' | 'leaderboards' | 'achievements' }
  | { kind: 'explore-courses'; slug?: string; compare?: boolean }
  | { kind: 'explore-colleges' }
  | { kind: 'explore-scholarships' }
  | { kind: 'explore-careers' }
  | { kind: 'explore-opportunities' }
  | { kind: 'community' }
  | { kind: 'admin'; section?: string };

export function parseAppRoute(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';

  if (clean === '/') {
    return { kind: 'home', tab: 'curriculum' };
  }
  if (clean === '/rbac' || clean === '/access-roles') {
    return { kind: 'home', tab: 'rbac' };
  }
  if (clean === '/institutions') {
    return { kind: 'home', tab: 'institutions' };
  }
  if (clean === '/schema') {
    return { kind: 'home', tab: 'schema' };
  }

  if (clean === '/explore' || clean === '/explore/courses') {
    return { kind: 'explore-courses' };
  }
  if (clean === '/explore/courses/compare') {
    return { kind: 'explore-courses', compare: true };
  }
  const courseDetailMatch = clean.match(/^\/explore\/courses\/([^/]+)$/);
  if (courseDetailMatch) {
    return {
      kind: 'explore-courses',
      slug: decodeURIComponent(courseDetailMatch[1]),
    };
  }
  if (clean === '/explore/colleges') {
    return { kind: 'explore-colleges' };
  }
  if (clean === '/explore/scholarships') {
    return { kind: 'explore-scholarships' };
  }
  if (clean === '/explore/careers') {
    return { kind: 'explore-careers' };
  }
  if (clean === '/explore/opportunities') {
    return { kind: 'explore-opportunities' };
  }
  if (clean === '/community') {
    return { kind: 'community' };
  }
  if (clean === '/admin') {
    return { kind: 'admin' };
  }
  const adminMatch = clean.match(/^\/admin\/([^/]+)$/);
  if (adminMatch) {
    return {
      kind: 'admin',
      section: decodeURIComponent(adminMatch[1]),
    };
  }

  if (clean === '/dashboard') {
    return { kind: 'dashboard' };
  }
  if (clean === '/dashboard/mistakes') {
    return { kind: 'dashboard-mistakes' };
  }
  if (clean === '/dashboard/flashcards') {
    return { kind: 'dashboard-flashcards' };
  }
  if (clean === '/dashboard/planner') {
    return { kind: 'dashboard-planner' };
  }
  if (clean === '/practice/daily') {
    return { kind: 'daily-practice', initialSection: 'challenges' };
  }
  if (clean === '/leaderboards') {
    return { kind: 'daily-practice', initialSection: 'leaderboards' };
  }

  if (clean === '/school') {
    return { kind: 'school-grade', gradeSlug: 'class-10' };
  }
  if (clean === '/school/class-10') {
    return { kind: 'school-grade', gradeSlug: 'class-10' };
  }
  if (clean === '/school/see') {
    return { kind: 'school-grade', gradeSlug: 'see' };
  }
  if (clean === '/school/class-11') {
    return { kind: 'school-grade', gradeSlug: 'class-11' };
  }
  if (clean === '/school/class-12') {
    return { kind: 'school-grade', gradeSlug: 'class-12' };
  }

  const chapterMatch = clean.match(/^\/school\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (chapterMatch) {
    return {
      kind: 'school-chapter',
      gradeSlug: decodeURIComponent(chapterMatch[1]),
      subjectCode: decodeURIComponent(chapterMatch[2]),
      chapterKey: decodeURIComponent(chapterMatch[3]),
    };
  }

  if (clean === '/entrance') {
    return { kind: 'entrance-hub' };
  }
  const entranceMatch = clean.match(/^\/entrance\/([^/]+)$/);
  if (entranceMatch) {
    return {
      kind: 'entrance-detail',
      examSlug: decodeURIComponent(entranceMatch[1]),
    };
  }

  if (clean === '/question-bank') {
    return { kind: 'question-bank' };
  }

  if (clean === '/exams') {
    return { kind: 'exams-hub' };
  }
  const examResultMatch = clean.match(/^\/exams\/([^/]+)\/result$/);
  if (examResultMatch) {
    return {
      kind: 'exam-result',
      examId: decodeURIComponent(examResultMatch[1]),
    };
  }
  const examRunnerMatch = clean.match(/^\/exams\/([^/]+)$/);
  if (examRunnerMatch) {
    return {
      kind: 'exam-runner',
      examId: decodeURIComponent(examRunnerMatch[1]),
    };
  }

  return { kind: 'home', tab: 'curriculum' };
}

export function normalizeGradeSlug(slug: string): 'G10' | 'G11' | 'G12' {
  const lower = slug.trim().toLowerCase();
  if (lower === 'class-10' || lower === 'see' || lower === 'g10') {
    return 'G10';
  }
  if (lower === 'class-11' || lower === 'g11') {
    return 'G11';
  }
  if (lower === 'class-12' || lower === 'g12') {
    return 'G12';
  }
  return 'G10';
}

export function canStudentViewResourceStatus(
  status: string,
  userPermissions: string[],
): boolean {
  if (status === 'published') {
    return true;
  }
  return (
    userPermissions.includes('curriculum:write') ||
    userPermissions.includes('curriculum:review') ||
    userPermissions.includes('system:admin')
  );
}
