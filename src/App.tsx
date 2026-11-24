import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthProvider } from './context/AuthContext.tsx';
import { AiCareerAssistantPanel } from './components/AiCareerAssistantPanel.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { CareerOpportunitiesView } from './components/CareerOpportunitiesView.tsx';
import { ChapterReaderView } from './components/ChapterReaderView.tsx';
import { CollegeDirectoryView } from './components/CollegeDirectoryView.tsx';
import { CommunityView } from './components/CommunityView.tsx';
import { CourseDirectoryView } from './components/CourseDirectoryView.tsx';
import { CurriculumWorkspace } from './components/CurriculumWorkspace.tsx';
import { DailyChallengeView } from './components/DailyChallengeView.tsx';
import { EntranceHubView } from './components/EntranceHubView.tsx';
import { ExamResultView } from './components/ExamResultView.tsx';
import { ExamRunnerView } from './components/ExamRunnerView.tsx';
import { ExamsHubView } from './components/ExamsHubView.tsx';
import { FlashcardsView } from './components/FlashcardsView.tsx';
import { InstitutionsView } from './components/InstitutionsView.tsx';
import { MistakeBookView } from './components/MistakeBookView.tsx';
import { QuestionBankView } from './components/QuestionBankView.tsx';
import { RbacGovernanceView } from './components/RbacGovernanceView.tsx';
import { SchemaBlueprintView } from './components/SchemaBlueprintView.tsx';
import { ScholarshipFinderView } from './components/ScholarshipFinderView.tsx';
import { SchoolGradeView } from './components/SchoolGradeView.tsx';
import { StudentDashboardView } from './components/StudentDashboardView.tsx';
import { StudyPlannerView } from './components/StudyPlannerView.tsx';
import { TopBar, type WorkspaceTab } from './components/TopBar.tsx';
import { AdminDashboardView } from './components/admin/AdminDashboardView.tsx';
import { parseAppRoute, type AppRoute } from './lib/router.ts';

function getLocationState(): { pathname: string; search: string } {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '' };
  }
  return {
    pathname: window.location.pathname,
    search: window.location.search,
  };
}

function WorkspaceShell() {
  const [loc, setLoc] = useState(getLocationState);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    const handlePop = () => {
      setLoc(getLocationState());
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = useCallback((path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      setLoc(getLocationState());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const route: AppRoute = useMemo(() => parseAppRoute(loc.pathname), [loc.pathname]);
  const initialTab = useMemo(() => {
    const params = new URLSearchParams(loc.search);
    return params.get('tab') ?? undefined;
  }, [loc.search]);
  const attemptUidParam = useMemo(() => {
    const params = new URLSearchParams(loc.search);
    return params.get('attemptUid') ?? undefined;
  }, [loc.search]);

  const activeTab: WorkspaceTab = useMemo(() => {
    if (
      route.kind === 'dashboard' ||
      route.kind === 'dashboard-mistakes' ||
      route.kind === 'dashboard-flashcards' ||
      route.kind === 'dashboard-planner'
    ) {
      return 'dashboard';
    }
    if (route.kind === 'daily-practice') {
      return 'daily-practice';
    }
    if (route.kind === 'school-grade' || route.kind === 'school-chapter') {
      return 'school';
    }
    if (route.kind === 'entrance-hub' || route.kind === 'entrance-detail') {
      return 'entrance';
    }
    if (
      route.kind === 'exams-hub' ||
      route.kind === 'exam-runner' ||
      route.kind === 'exam-result'
    ) {
      return 'exams';
    }
    if (
      route.kind === 'explore-courses' ||
      route.kind === 'explore-colleges' ||
      route.kind === 'explore-scholarships' ||
      route.kind === 'explore-careers' ||
      route.kind === 'explore-opportunities'
    ) {
      return 'explore';
    }
    if (route.kind === 'community') {
      return 'community';
    }
    if (route.kind === 'question-bank') {
      return 'question-bank';
    }
    if (route.kind === 'admin') {
      return 'admin';
    }
    return route.tab;
  }, [route]);

  const handleSelectTopTab = useCallback(
    (tab: WorkspaceTab) => {
      if (tab === 'dashboard') navigate('/dashboard');
      else if (tab === 'curriculum') navigate('/');
      else if (tab === 'school') navigate('/school/class-10');
      else if (tab === 'entrance') navigate('/entrance');
      else if (tab === 'exams') navigate('/exams');
      else if (tab === 'explore') navigate('/explore/courses');
      else if (tab === 'community') navigate('/community');
      else if (tab === 'daily-practice') navigate('/practice/daily');
      else if (tab === 'question-bank') navigate('/question-bank');
      else if (tab === 'rbac') navigate('/rbac');
      else if (tab === 'institutions') navigate('/institutions');
      else if (tab === 'admin') navigate('/admin');
      else if (tab === 'schema') navigate('/schema');
    },
    [navigate],
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={handleSelectTopTab}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-8 sm:px-6">
        {route.kind === 'home' && route.tab === 'curriculum' && (
          <CurriculumWorkspace onOpenAuth={() => setAuthModalOpen(true)} />
        )}
        {route.kind === 'home' && route.tab === 'rbac' && (
          <RbacGovernanceView onOpenAuth={() => setAuthModalOpen(true)} />
        )}
        {route.kind === 'home' && route.tab === 'institutions' && <InstitutionsView />}
        {route.kind === 'home' && route.tab === 'schema' && <SchemaBlueprintView />}

        {route.kind === 'school-grade' && (
          <SchoolGradeView
            gradeSlug={route.gradeSlug}
            onNavigate={navigate}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {route.kind === 'school-chapter' && (
          <ChapterReaderView
            gradeSlug={route.gradeSlug}
            subjectCode={route.subjectCode}
            chapterKey={route.chapterKey}
            initialTab={initialTab}
            onNavigate={navigate}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {route.kind === 'entrance-hub' && <EntranceHubView onNavigate={navigate} />}
        {route.kind === 'entrance-detail' && (
          <EntranceHubView examSlug={route.examSlug} onNavigate={navigate} />
        )}

        {route.kind === 'question-bank' && (
          <QuestionBankView onOpenAuth={() => setAuthModalOpen(true)} />
        )}

        {route.kind === 'exams-hub' && <ExamsHubView onNavigate={navigate} />}
        {route.kind === 'exam-runner' && (
          <ExamRunnerView
            examId={route.examId}
            onNavigate={navigate}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}
        {route.kind === 'exam-result' && (
          <ExamResultView
            examId={route.examId}
            attemptUid={attemptUidParam}
            onNavigate={navigate}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {route.kind === 'dashboard' && (
          <StudentDashboardView
            onNavigate={navigate}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}
        {route.kind === 'dashboard-mistakes' && (
          <MistakeBookView
            onNavigate={navigate}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}
        {route.kind === 'dashboard-flashcards' && (
          <FlashcardsView
            onNavigate={navigate}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}
        {route.kind === 'dashboard-planner' && (
          <StudyPlannerView
            onNavigate={navigate}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}
        {route.kind === 'daily-practice' && (
          <DailyChallengeView
            initialSection={route.initialSection}
            onNavigate={navigate}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {route.kind === 'community' && (
          <CommunityView onOpenAuth={() => setAuthModalOpen(true)} />
        )}

        {route.kind === 'admin' && (
          <AdminDashboardView
            section={route.section}
            onNavigate={navigate}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {(route.kind === 'explore-courses' ||
          route.kind === 'explore-colleges' ||
          route.kind === 'explore-scholarships' ||
          route.kind === 'explore-careers' ||
          route.kind === 'explore-opportunities') && (
          <div className="space-y-6">
            <AiCareerAssistantPanel onNavigate={navigate} />
            {route.kind === 'explore-courses' && (
              <CourseDirectoryView
                slug={route.slug}
                compareMode={route.compare}
                onNavigate={navigate}
              />
            )}
            {route.kind === 'explore-colleges' && (
              <CollegeDirectoryView onNavigate={navigate} />
            )}
            {route.kind === 'explore-scholarships' && (
              <ScholarshipFinderView onNavigate={navigate} />
            )}
            {route.kind === 'explore-careers' && (
              <CareerOpportunitiesView mode="careers" onNavigate={navigate} />
            )}
            {route.kind === 'explore-opportunities' && (
              <CareerOpportunitiesView mode="opportunities" onNavigate={navigate} />
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-6 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Hamro Education · Nepal-first Digital Learning Ecosystem</span>
          <span>Country-Aware PostgreSQL Schema &amp; Server-Side RBAC</span>
        </div>
      </footer>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceShell />
    </AuthProvider>
  );
}
