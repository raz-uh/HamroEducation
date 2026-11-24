import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  Calculator,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  Globe,
  HelpCircle,
  Languages,
  Layers,
  ListChecks,
  NotebookPen,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { canStudentViewResourceStatus } from '../lib/router.ts';
import { AiStudyAssistantDrawer } from './AiStudyAssistantDrawer.tsx';
import type {
  BookmarkItem,
  ChapterContentPayload,
  ChapterLearningBundleResponse,
  PersonalNoteItem,
  SchoolResourceItem,
} from '../types/api.ts';

interface ChapterReaderViewProps {
  gradeSlug: string;
  subjectCode: string;
  chapterKey: string;
  initialTab?: string;
  onNavigate: (path: string) => void;
  onOpenAuth: () => void;
}

type ReaderTabId =
  | 'all'
  | 'overview'
  | 'notes'
  | 'concepts'
  | 'formulas'
  | 'examples'
  | 'practice'
  | 'test'
  | 'revision';

const READER_TABS: Array<{ id: ReaderTabId; label: string }> = [
  { id: 'all', label: 'All Sections' },
  { id: 'overview', label: 'Intro & Objectives' },
  { id: 'notes', label: 'Complete Notes' },
  { id: 'concepts', label: 'Concepts & Definitions' },
  { id: 'formulas', label: 'Formulas & Diagrams' },
  { id: 'examples', label: 'Solved Examples' },
  { id: 'practice', label: 'Practice & Explanations' },
  { id: 'test', label: 'Chapter Test' },
  { id: 'revision', label: 'Revision Sheet' },
];

function mapInitialTab(tab?: string): ReaderTabId {
  if (!tab) return 'all';
  const lower = tab.toLowerCase();
  if (lower === 'notes') return 'notes';
  if (lower === 'practice' || lower === 'mcqs') return 'practice';
  if (lower === 'test') return 'test';
  if (lower === 'revision') return 'revision';
  if (lower === 'formulas') return 'formulas';
  if (lower === 'examples') return 'examples';
  if (lower === 'concepts') return 'concepts';
  if (lower === 'overview') return 'overview';
  return 'all';
}

export function ChapterReaderView({
  gradeSlug,
  subjectCode,
  chapterKey,
  initialTab,
  onNavigate,
  onOpenAuth,
}: ChapterReaderViewProps) {
  const { user, apiFetch } = useAuth();
  const [bundle, setBundle] = useState<ChapterLearningBundleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ReaderTabId>(() => mapInitialTab(initialTab));
  const [lang, setLang] = useState<'en' | 'ne'>('en');

  // Interactive MCQ state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [checkedMcqs, setCheckedMcqs] = useState<Record<string, boolean>>({});
  const [practiceSyncNote, setPracticeSyncNote] = useState<Record<string, string>>({});
  const [revealedGuides, setRevealedGuides] = useState<Record<string, boolean>>({});

  // Interactive Chapter Test timer toggle
  const [chapterTestActive, setChapterTestActive] = useState(false);

  // Bookmark & Personal Notes & AI Assistant drawers
  const [notesDrawerOpen, setNotesDrawerOpen] = useState(false);
  const [bookmarksDrawerOpen, setBookmarksDrawerOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [allUserBookmarks, setAllUserBookmarks] = useState<BookmarkItem[]>([]);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteHighlight, setNoteHighlight] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [drawerFeedback, setDrawerFeedback] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(mapInitialTab(initialTab));
  }, [initialTab]);

  const loadChapter = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/school/chapter/${encodeURIComponent(gradeSlug)}/${encodeURIComponent(subjectCode)}/${encodeURIComponent(chapterKey)}`,
      );
      const json = (await res.json()) as ChapterLearningBundleResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load chapter content.');
      }
      setBundle(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch chapter bundle.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, chapterKey, gradeSlug, subjectCode]);

  const loadAllBookmarks = useCallback(async () => {
    if (!user) {
      setAllUserBookmarks([]);
      return;
    }
    try {
      const res = await apiFetch('/api/school/bookmarks');
      if (res.ok) {
        const json = (await res.json()) as { bookmarks: BookmarkItem[] };
        setAllUserBookmarks(json.bookmarks ?? []);
      }
    } catch (err) {
      console.error('Failed to load user bookmarks:', err);
    }
  }, [apiFetch, user]);

  useEffect(() => {
    setSelectedAnswers({});
    setCheckedMcqs({});
    setRevealedGuides({});
    setChapterTestActive(false);
    void loadChapter();
  }, [loadChapter]);

  useEffect(() => {
    void loadAllBookmarks();
  }, [loadAllBookmarks]);

  const userPermissions = useMemo(
    () => user?.permissions ?? ['curriculum:read'],
    [user],
  );

  // Defense-in-depth visibility filter matching backend rule
  const visibleResources: SchoolResourceItem[] = useMemo(() => {
    if (!bundle?.resources) return [];
    return bundle.resources.filter((r) =>
      canStudentViewResourceStatus(r.status, userPermissions),
    );
  }, [bundle, userPermissions]);

  const primaryBundleResource = useMemo(
    () =>
      visibleResources.find((r) => r.resourceType === 'chapter_bundle') ??
      visibleResources[0] ??
      null,
    [visibleResources],
  );

  const activeContent: ChapterContentPayload | null = useMemo(() => {
    const ver = primaryBundleResource?.latestVersion;
    if (!ver?.contentEn) return null;
    if (lang === 'en' || !ver.contentNe) {
      return ver.contentEn;
    }
    return {
      ...ver.contentEn,
      ...(ver.contentNe.introduction ? { introduction: ver.contentNe.introduction } : {}),
      ...(ver.contentNe.learningObjectives?.length
        ? { learningObjectives: ver.contentNe.learningObjectives }
        : {}),
      ...(ver.contentNe.completeNotes?.length
        ? { completeNotes: ver.contentNe.completeNotes }
        : {}),
      ...(ver.contentNe.revisionSheet?.length
        ? { revisionSheet: ver.contentNe.revisionSheet }
        : {}),
    };
  }, [lang, primaryBundleResource]);

  const isChapterBookmarked = useMemo(
    () =>
      Boolean(
        bundle?.bookmarks.some(
          (b) => b.chapterId === bundle.chapter.id && b.resourceId === null,
        ),
      ),
    [bundle],
  );

  const handleToggleChapterBookmark = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!bundle) return;
    setBookmarkBusy(true);
    try {
      const res = await apiFetch('/api/school/bookmarks', {
        method: 'POST',
        body: JSON.stringify({
          gradeId: bundle.grade.id,
          subjectId: bundle.subject.id,
          chapterId: bundle.chapter.id,
          resourceId: null,
          bookmarkType: 'chapter',
          title: `${bundle.subject.code} Ch ${bundle.chapter.chapterNumber}: ${bundle.chapter.title}`,
        }),
      });
      if (res.ok) {
        await Promise.all([loadChapter(), loadAllBookmarks()]);
      }
    } finally {
      setBookmarkBusy(false);
    }
  };

  const handleToggleResourceBookmark = async (resource: SchoolResourceItem) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!bundle) return;
    const res = await apiFetch('/api/school/bookmarks', {
      method: 'POST',
      body: JSON.stringify({
        gradeId: bundle.grade.id,
        subjectId: bundle.subject.id,
        chapterId: bundle.chapter.id,
        resourceId: resource.id,
        bookmarkType: resource.resourceType,
        title: resource.title,
      }),
    });
    if (res.ok) {
      await Promise.all([loadChapter(), loadAllBookmarks()]);
    }
  };

  const handleDeleteBookmark = async (bookmarkId: number) => {
    const res = await apiFetch(`/api/school/bookmarks/${bookmarkId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await Promise.all([loadChapter(), loadAllBookmarks()]);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!bundle) return;
    setDrawerFeedback(null);
    setNoteSubmitting(true);
    try {
      const res = await apiFetch('/api/school/notes', {
        method: 'POST',
        body: JSON.stringify({
          chapterId: bundle.chapter.id,
          resourceId: primaryBundleResource?.id ?? null,
          title: noteTitle,
          highlightText: noteHighlight || null,
          noteBody,
          languageCode: lang,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Could not save study note.');
      }
      setNoteTitle('');
      setNoteHighlight('');
      setNoteBody('');
      setDrawerFeedback('Study note saved to your PostgreSQL account.');
      await loadChapter();
    } catch (err) {
      setDrawerFeedback(err instanceof Error ? err.message : 'Failed to save note.');
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    const res = await apiFetch(`/api/school/notes/${noteId}`, { method: 'DELETE' });
    if (res.ok) {
      await loadChapter();
    }
  };

  const handleReviewApprove = async (resourceId: number) => {
    const res = await apiFetch(`/api/school/resources/${resourceId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({
        decision: 'approved',
        comments: 'Approved for student visibility via Academic Reviewer panel.',
      }),
    });
    if (res.ok) {
      await loadChapter();
    }
  };

  const handleCheckChapterMcq = async (mcqId: string) => {
    const selectedIndex = selectedAnswers[mcqId];
    if (selectedIndex === undefined) return;
    setCheckedMcqs((prev) => ({ ...prev, [mcqId]: true }));

    if (!user || !primaryBundleResource) {
      setPracticeSyncNote((prev) => ({
        ...prev,
        [mcqId]: 'Sign in to automatically log wrong answers to your Mistake Book.',
      }));
      return;
    }

    try {
      const res = await apiFetch('/api/mistakes/record-practice', {
        method: 'POST',
        body: JSON.stringify({
          resourceId: primaryBundleResource.id,
          mcqId,
          selectedIndex,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          isCorrect: boolean;
          mistakeAction: 'recorded' | 'resolved' | 'none';
          newlyUnlockedBadges?: Array<{ title: string }>;
        };
        const badgeText =
          json.newlyUnlockedBadges && json.newlyUnlockedBadges.length > 0
            ? ` · Badge unlocked: ${json.newlyUnlockedBadges[0].title}`
            : '';
        if (json.mistakeAction === 'recorded') {
          setPracticeSyncNote((prev) => ({
            ...prev,
            [mcqId]: `Saved to Mistake Book for reattempt${badgeText}`,
          }));
        } else if (json.mistakeAction === 'resolved') {
          setPracticeSyncNote((prev) => ({
            ...prev,
            [mcqId]: `Previously missed item marked Resolved${badgeText}`,
          }));
        } else {
          setPracticeSyncNote((prev) => ({
            ...prev,
            [mcqId]: `Topic accuracy synced${badgeText}`,
          }));
        }
      }
    } catch {
      // ignore background sync failure without breaking local check
    }
  };

  const showSection = (sectionId: ReaderTabId) =>
    activeTab === 'all' || activeTab === sectionId;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 space-y-3">
        <div className="flex items-center gap-2 text-red-800 font-semibold">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          <span>{error || 'Chapter learning bundle could not be found.'}</span>
        </div>
        <button
          type="button"
          onClick={() => onNavigate(`/school/${gradeSlug}`)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to Grade Library
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="chapter-reader-heading" className="space-y-6">
      {/* Breadcrumb & Hierarchy Navigation: Class → Subject → Chapter → Topic → Resource */}
      <nav
        aria-label="Chapter hierarchy breadcrumb"
        className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600"
      >
        <button
          type="button"
          onClick={() => onNavigate(`/school/${gradeSlug}`)}
          className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-red-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {bundle.grade.name}
        </button>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        {bundle.stream && (
          <>
            <span>{bundle.stream.name}</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          </>
        )}
        <span className="font-mono font-semibold text-slate-800">{bundle.subject.code}</span>
        <span>·</span>
        <span>{bundle.subject.name}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        <span className="font-semibold text-slate-900">
          Chapter {bundle.chapter.chapterNumber}
        </span>
      </nav>

      {/* Chapter Header Bar */}
      <header className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-red-700">
              {bundle.grade.name} · {bundle.subject.code} · Chapter {bundle.chapter.chapterNumber}
            </p>
            <h1
              id="chapter-reader-heading"
              className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
            >
              {lang === 'ne' && primaryBundleResource?.titleNe
                ? primaryBundleResource.titleNe
                : bundle.chapter.title}
            </h1>
            <p className="max-w-2xl text-sm text-slate-600">{bundle.chapter.summary}</p>
            <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {bundle.chapter.estimatedHours} hrs pacing
              </span>
              <span>·</span>
              <span className="font-mono tabular-nums">{bundle.topics.length} syllabus topics</span>
              <span>·</span>
              <span className="font-mono tabular-nums text-emerald-700">
                {visibleResources.filter((r) => r.status === 'published').length} published resources
              </span>
            </div>
          </div>

          {/* Reader Controls: Language Toggle, Bookmark, Personal Notes */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label="Content language toggle"
              className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
            >
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  lang === 'en' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                English
              </button>
              <button
                type="button"
                onClick={() => setLang('ne')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  lang === 'ne' ? 'bg-red-700 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                नेपाली
              </button>
            </div>

            <button
              type="button"
              disabled={bookmarkBusy}
              onClick={() => void handleToggleChapterBookmark()}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                isChapterBookmarked
                  ? 'border-blue-700 bg-blue-50 text-blue-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <Bookmark
                className={`h-3.5 w-3.5 ${isChapterBookmarked ? 'fill-current' : ''}`}
                aria-hidden="true"
              />
              {isChapterBookmarked ? 'Bookmarked' : 'Bookmark Chapter'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  onOpenAuth();
                } else {
                  setBookmarksDrawerOpen(true);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
            >
              Saved ({user ? allUserBookmarks.length : 0})
            </button>

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  onOpenAuth();
                } else {
                  setNotesDrawerOpen(true);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
              Study Notes ({user ? bundle.personalNotes.length : 0})
            </button>

            <button
              type="button"
              onClick={() => setAiDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              AI Study Assistant
            </button>
          </div>
        </div>

        {/* Sibling Chapter Switcher */}
        {bundle.siblingChapters.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="text-xs font-medium text-slate-500">Chapters in {bundle.subject.code}:</span>
            {bundle.siblingChapters.map((sib) => {
              const active = sib.id === bundle.chapter.id;
              return (
                <button
                  key={sib.id}
                  type="button"
                  onClick={() =>
                    onNavigate(
                      `/school/${gradeSlug}/${encodeURIComponent(bundle.subject.code)}/${sib.chapterNumber}`,
                    )
                  }
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                  }`}
                >
                  Ch {sib.chapterNumber}: {sib.title}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Mobile-First Section Tabs */}
      <div
        role="tablist"
        aria-label="Chapter reader sections"
        className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2"
      >
        {READER_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? 'bg-red-700 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Reader Grid: Left Structured Content + Right Topic/Resource Rail */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {!activeContent ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No published study bundle is available for this chapter yet.
            </div>
          ) : (
            <>
              {/* 1. Introduction & Learning Objectives */}
              {showSection('overview') && (
                <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <BookOpen className="h-4 w-4 text-red-700" aria-hidden="true" />
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Introduction &amp; Learning Objectives
                    </h2>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Introduction
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-700">
                      {activeContent.introduction}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Learning Objectives
                    </h3>
                    <ul className="space-y-2">
                      {activeContent.learningObjectives.map((obj, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                            aria-hidden="true"
                          />
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {/* 2. Complete Notes */}
              {showSection('notes') && (
                <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-red-700" aria-hidden="true" />
                      <h2 className="font-display text-lg font-bold text-slate-900">
                        Complete Notes
                      </h2>
                    </div>
                    <span className="font-mono text-xs text-slate-500">
                      {lang === 'ne' ? 'Medium: नेपाली' : 'Medium: English'}
                    </span>
                  </div>

                  <div className="space-y-5">
                    {activeContent.completeNotes.map((sec, idx) => (
                      <article key={idx} className="space-y-1.5">
                        <h3 className="font-display text-base font-semibold text-slate-900">
                          {sec.heading}
                        </h3>
                        <p className="text-sm leading-relaxed text-slate-700">{sec.body}</p>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* 3. Important Concepts & Definitions */}
              {showSection('concepts') && (
                <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Sparkles className="h-4 w-4 text-red-700" aria-hidden="true" />
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Important Concepts &amp; Definitions
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {activeContent.importantConcepts.map((concept, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1.5"
                      >
                        <h3 className="text-sm font-semibold text-slate-900">{concept.title}</h3>
                        <p className="text-xs leading-relaxed text-slate-600">
                          {concept.explanation}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Definitions
                    </h3>
                    <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {activeContent.definitions.map((def, idx) => (
                        <div key={idx} className="p-3.5 sm:grid sm:grid-cols-3 sm:gap-4">
                          <dt className="text-xs font-semibold text-slate-900">{def.term}</dt>
                          <dd className="mt-1 text-xs leading-relaxed text-slate-600 sm:col-span-2 sm:mt-0">
                            {def.definition}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </section>
              )}

              {/* 4. Formula Sheets & Diagrams */}
              {showSection('formulas') && (
                <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Calculator className="h-4 w-4 text-red-700" aria-hidden="true" />
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Formula Sheets &amp; Diagrams
                    </h2>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Formula Sheets
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      {activeContent.formulaSheets.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="text-xs font-semibold text-slate-700">{item.name}</p>
                          <p className="mt-1 font-mono text-sm font-semibold text-slate-900 break-words">
                            {item.formula}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{item.variables}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Diagrams
                    </h3>
                    {activeContent.diagrams.map((diag, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200 bg-white p-4 space-y-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{diag.title}</p>
                          <p className="text-xs text-slate-600">{diag.caption}</p>
                        </div>

                        {diag.visualType === 'venn_two_set' ? (
                          <div className="overflow-x-auto">
                            <svg
                              viewBox="0 0 360 190"
                              className="mx-auto w-full max-w-sm rounded-lg border border-slate-200 bg-slate-50"
                              role="img"
                              aria-label={diag.title}
                            >
                              <rect
                                x="12"
                                y="12"
                                width="336"
                                height="166"
                                rx="8"
                                fill="#ffffff"
                                stroke="#cbd5e1"
                                strokeWidth="1.5"
                              />
                              <text x="24" y="30" fontSize="11" fontWeight="600" fill="#334155">
                                U = 120
                              </text>
                              <circle
                                cx="145"
                                cy="98"
                                r="56"
                                fill="#fee2e2"
                                fillOpacity="0.65"
                                stroke="#b91c1c"
                                strokeWidth="1.5"
                              />
                              <circle
                                cx="215"
                                cy="98"
                                r="56"
                                fill="#dbeafe"
                                fillOpacity="0.65"
                                stroke="#1d4ed8"
                                strokeWidth="1.5"
                              />
                              <text x="108" y="95" fontSize="11" fontWeight="600" fill="#7f1d1d">
                                n₀(M)=45
                              </text>
                              <text x="167" y="95" fontSize="11" fontWeight="700" fill="#0f172a">
                                30
                              </text>
                              <text x="218" y="95" fontSize="11" fontWeight="600" fill="#1e3a8a">
                                n₀(S)=35
                              </text>
                              <text x="260" y="164" fontSize="10" fill="#475569">
                                Outside = 10
                              </text>
                            </svg>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {diag.elements.map((el, eIdx) => (
                              <div
                                key={eIdx}
                                className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-center text-xs font-medium text-slate-800"
                              >
                                <span className="block font-mono text-[10px] text-slate-400">
                                  0{eIdx + 1}
                                </span>
                                {el}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 5. Solved Examples */}
              {showSection('examples') && (
                <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Layers className="h-4 w-4 text-red-700" aria-hidden="true" />
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Solved Examples
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {activeContent.solvedExamples.map((ex, idx) => (
                      <article
                        key={idx}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          Example {idx + 1}: {ex.problem}
                        </p>
                        <ol className="space-y-1.5 pl-4 list-decimal text-xs leading-relaxed text-slate-700">
                          {ex.steps.map((step, sIdx) => (
                            <li key={sIdx}>{step}</li>
                          ))}
                        </ol>
                        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
                          Answer: {ex.answer}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* 6. Practice Questions (MCQs, Short, Long, Numericals) & Answer Explanations */}
              {showSection('practice') && (
                <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <HelpCircle className="h-4 w-4 text-red-700" aria-hidden="true" />
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Practice Questions &amp; Answer Explanations
                    </h2>
                  </div>

                  {/* Interactive MCQs */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Multiple Choice Questions (MCQs)
                    </h3>
                    {activeContent.mcqs.map((q, qIdx) => {
                      const chosen = selectedAnswers[q.id];
                      const isChecked = Boolean(checkedMcqs[q.id]);
                      const isCorrect = chosen === q.correctIndex;
                      return (
                        <div
                          key={q.id}
                          className="rounded-lg border border-slate-200 p-4 space-y-3"
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            <span className="font-mono text-xs text-slate-400 mr-2">
                              Q{qIdx + 1}
                            </span>
                            {q.question}
                          </p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {q.options.map((opt, optIdx) => {
                              const selected = chosen === optIdx;
                              const showCorrectStyle =
                                isChecked && optIdx === q.correctIndex;
                              const showWrongStyle =
                                isChecked && selected && optIdx !== q.correctIndex;
                              return (
                                <button
                                  key={optIdx}
                                  type="button"
                                  onClick={() =>
                                    setSelectedAnswers((prev) => ({
                                      ...prev,
                                      [q.id]: optIdx,
                                    }))
                                  }
                                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                                    showCorrectStyle
                                      ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-900'
                                      : showWrongStyle
                                        ? 'border-red-600 bg-red-50 font-semibold text-red-900'
                                        : selected
                                          ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                  }`}
                                >
                                  <span className="font-mono text-[11px] opacity-75">
                                    {String.fromCharCode(65 + optIdx)}.
                                  </span>
                                  <span>{opt}</span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              disabled={chosen === undefined}
                              onClick={() => void handleCheckChapterMcq(q.id)}
                              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                            >
                              Check Answer
                            </button>
                            {isChecked && (
                              <span
                                className={`text-xs font-semibold ${
                                  isCorrect ? 'text-emerald-700' : 'text-red-700'
                                }`}
                              >
                                {isCorrect ? 'Correct!' : 'Review Explanation'}
                              </span>
                            )}
                          </div>

                          {isChecked && (
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-xs text-slate-700">
                              <p>
                                <strong className="font-semibold text-slate-900">
                                  Answer Explanation:{' '}
                                </strong>
                                {q.explanation}
                              </p>
                              {practiceSyncNote[q.id] && (
                                <p className="text-[11px] font-medium text-blue-700">
                                  {practiceSyncNote[q.id]}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Short Questions */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Short Questions
                    </h3>
                    {activeContent.shortQuestions.map((sq, idx) => {
                      const key = `short-${idx}`;
                      const open = Boolean(revealedGuides[key]);
                      return (
                        <div key={key} className="rounded-lg border border-slate-200 p-4 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium text-slate-900">{sq.question}</p>
                            <span className="font-mono text-xs text-slate-500 shrink-0 tabular-nums">
                              [{sq.marks} marks]
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedGuides((prev) => ({ ...prev, [key]: !prev[key] }))
                            }
                            className="text-xs font-semibold text-blue-700 hover:underline"
                          >
                            {open ? 'Hide Answer Guide' : 'Show Answer Guide'}
                          </button>
                          {open && (
                            <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200">
                              {sq.answerGuide}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Long Questions */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Long Questions
                    </h3>
                    {activeContent.longQuestions.map((lq, idx) => {
                      const key = `long-${idx}`;
                      const open = Boolean(revealedGuides[key]);
                      return (
                        <div key={key} className="rounded-lg border border-slate-200 p-4 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium text-slate-900">{lq.question}</p>
                            <span className="font-mono text-xs text-slate-500 shrink-0 tabular-nums">
                              [{lq.marks} marks]
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedGuides((prev) => ({ ...prev, [key]: !prev[key] }))
                            }
                            className="text-xs font-semibold text-blue-700 hover:underline"
                          >
                            {open ? 'Hide Marking Scheme' : 'Show Marking Scheme'}
                          </button>
                          {open && (
                            <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200">
                              {lq.answerGuide}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Numericals */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Numerical Problems &amp; Step Solutions
                    </h3>
                    {activeContent.numericals.map((num, idx) => {
                      const key = `num-${idx}`;
                      const open = Boolean(revealedGuides[key]);
                      return (
                        <div key={key} className="rounded-lg border border-slate-200 p-4 space-y-2">
                          <p className="text-sm font-medium text-slate-900">{num.question}</p>
                          <p className="font-mono text-xs text-slate-500">Given: {num.given}</p>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedGuides((prev) => ({ ...prev, [key]: !prev[key] }))
                            }
                            className="text-xs font-semibold text-blue-700 hover:underline"
                          >
                            {open ? 'Hide Step Solution' : 'Reveal Step Solution'}
                          </button>
                          {open && (
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-1 text-xs text-slate-700">
                              <p>{num.solution}</p>
                              <p className="font-mono font-semibold text-emerald-800">
                                Final Answer: {num.finalAnswer}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 7. Chapter Test */}
              {showSection('test') && (
                <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-red-700" aria-hidden="true" />
                      <h2 className="font-display text-lg font-bold text-slate-900">
                        Chapter Test Blueprint
                      </h2>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-xs text-slate-600 tabular-nums">
                      <span>{activeContent.chapterTest.durationMinutes} mins</span>
                      <span>·</span>
                      <span>{activeContent.chapterTest.totalMarks} marks</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600">
                    {activeContent.chapterTest.instructions}
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {activeContent.chapterTest.sections.map((sec, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3.5"
                      >
                        <p className="text-xs font-semibold text-slate-900">{sec.title}</p>
                        <p className="mt-1 font-mono text-xs text-slate-600 tabular-nums">
                          {sec.questionCount} Qs × {sec.marksEach} marks
                        </p>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setChapterTestActive((prev) => !prev);
                      setActiveTab('practice');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
                  >
                    <ListChecks className="h-4 w-4" aria-hidden="true" />
                    {chapterTestActive ? 'Resume Practice Assessment' : 'Start Chapter Test Drill'}
                  </button>
                </section>
              )}

              {/* 8. Revision Sheet */}
              {showSection('revision') && (
                <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Revision Sheet (Last-Minute Board Summary)
                    </h2>
                  </div>

                  <ul className="space-y-2.5">
                    {activeContent.revisionSheet.map((bullet, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800"
                      >
                        <span className="font-mono text-xs font-semibold text-red-700 mt-0.5 tabular-nums">
                          0{idx + 1}
                        </span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>

        {/* Right Column: Syllabus Topics + Published Resources & Student Study Rail */}
        <aside className="space-y-6 lg:col-span-4">
          {/* Syllabus Topics */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-900">
              Syllabus Topics ({bundle.topics.length})
            </h2>
            <ul className="divide-y divide-slate-100">
              {bundle.topics.map((topic) => (
                <li key={topic.id} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-xs font-semibold text-slate-900">
                    <span className="font-mono text-red-700 mr-1.5">{topic.topicNumber}</span>
                    {topic.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">{topic.learningObjectives}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">
                    {topic.difficultyLevel} · {topic.estimatedMinutes} mins
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Chapter Resources List (Strictly Published for Students) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">
                Chapter Resources
              </h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {visibleResources.length}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Showing verified <span className="font-mono">published</span> materials aligned with
              the CDC/NEB specification grid.
            </p>

            <ul className="divide-y divide-slate-100">
              {visibleResources.map((resItem) => {
                const isResBookmarked = bundle.bookmarks.some(
                  (b) => b.resourceId === resItem.id,
                );
                const canReview = userPermissions.includes('curriculum:review');
                return (
                  <li key={resItem.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{resItem.title}</p>
                        <p className="mt-0.5 text-[11px] text-slate-600">{resItem.summary}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleToggleResourceBookmark(resItem)}
                        aria-label={`Bookmark ${resItem.title}`}
                        className={`rounded-md p-1.5 border transition-colors shrink-0 ${
                          isResBookmarked
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        <Bookmark
                          className={`h-3.5 w-3.5 ${isResBookmarked ? 'fill-current' : ''}`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-mono text-slate-500">
                        {resItem.category?.name ?? resItem.resourceType} · v{resItem.currentVersion}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          resItem.status === 'published'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {resItem.status === 'published' ? (
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <Clock className="h-3 w-3" aria-hidden="true" />
                        )}
                        {resItem.status}
                      </span>
                    </div>

                    {canReview && resItem.status !== 'published' && (
                      <button
                        type="button"
                        onClick={() => void handleReviewApprove(resItem.id)}
                        className="rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800"
                      >
                        Approve &amp; Publish
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Inline Personal Notes Quick Summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">
                Your Personal Notes
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    onOpenAuth();
                  } else {
                    setNotesDrawerOpen(true);
                  }
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add Note
              </button>
            </div>
            {!user ? (
              <p className="text-xs text-slate-600">
                Sign in to save personal highlights and study notes directly to your student account.
              </p>
            ) : bundle.personalNotes.length === 0 ? (
              <p className="text-xs text-slate-500">
                No notes saved on this chapter yet. Click Add Note to capture formulas or exam reminders.
              </p>
            ) : (
              <ul className="space-y-2">
                {bundle.personalNotes.slice(0, 3).map((note) => (
                  <li
                    key={note.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1"
                  >
                    <p className="text-xs font-semibold text-slate-900">{note.title}</p>
                    <p className="text-xs text-slate-600 line-clamp-2">{note.noteBody}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* Personal Notes Drawer */}
      {notesDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notes-drawer-title"
        >
          <div className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2
                  id="notes-drawer-title"
                  className="font-display text-lg font-bold text-slate-900"
                >
                  Chapter Study Notes
                </h2>
                <p className="text-xs text-slate-500">
                  {bundle.subject.code} · Chapter {bundle.chapter.chapterNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotesDrawerOpen(false)}
                aria-label="Close notes drawer"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <form onSubmit={handleCreateNote} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Save Highlight &amp; Study Note
                </h3>
                {drawerFeedback && (
                  <p className="text-xs font-medium text-emerald-700">{drawerFeedback}</p>
                )}
                <div>
                  <label htmlFor="note-title-input" className="block text-xs font-medium text-slate-700">
                    Note Title
                  </label>
                  <input
                    id="note-title-input"
                    type="text"
                    required
                    minLength={2}
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="e.g. Three-set Venn sign reminder"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="note-highlight-input" className="block text-xs font-medium text-slate-700">
                    Highlighted Excerpt (Optional)
                  </label>
                  <input
                    id="note-highlight-input"
                    type="text"
                    value={noteHighlight}
                    onChange={(e) => setNoteHighlight(e.target.value)}
                    placeholder="Key quote or formula to remember"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="note-body-input" className="block text-xs font-medium text-slate-700">
                    Study Note
                  </label>
                  <textarea
                    id="note-body-input"
                    required
                    minLength={2}
                    rows={3}
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Write your explanation, memory trick, or exam checklist..."
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={noteSubmitting}
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {noteSubmitting ? 'Saving...' : 'Save Note to Account'}
                </button>
              </form>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Saved Notes ({bundle.personalNotes.length})
                </h3>
                {bundle.personalNotes.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No personal study notes saved for this chapter yet.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {bundle.personalNotes.map((note: PersonalNoteItem) => (
                      <li
                        key={note.id}
                        className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-900">{note.title}</p>
                          <button
                            type="button"
                            onClick={() => void handleDeleteNote(note.id)}
                            aria-label={`Delete note ${note.title}`}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                        {note.highlightText && (
                          <blockquote className="rounded bg-amber-50 px-2.5 py-1.5 text-[11px] italic text-amber-900 border border-amber-200">
                            “{note.highlightText}”
                          </blockquote>
                        )}
                        <p className="text-xs leading-relaxed text-slate-700">{note.noteBody}</p>
                        <p className="font-mono text-[10px] text-slate-400">
                          {note.languageCode.toUpperCase()} ·{' '}
                          {new Date(note.createdAt).toLocaleDateString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bookmarks Drawer */}
      {bookmarksDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reader-bookmarks-drawer-title"
        >
          <div className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2
                  id="reader-bookmarks-drawer-title"
                  className="font-display text-lg font-bold text-slate-900"
                >
                  Saved Bookmarks
                </h2>
                <p className="text-xs text-slate-500">
                  Your saved chapters &amp; learning resources
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBookmarksDrawerOpen(false)}
                aria-label="Close bookmarks drawer"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {allUserBookmarks.length === 0 ? (
                <p className="text-xs text-slate-500">No bookmarks saved yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {allUserBookmarks.map((bm) => (
                    <li key={bm.id} className="flex items-start justify-between gap-3 py-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{bm.title}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {bm.bookmarkType} · {new Date(bm.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteBookmark(bm.id)}
                        aria-label={`Remove bookmark ${bm.title}`}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <AiStudyAssistantDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        defaultLanguage={lang}
        context={{
          mode: 'chapter',
          gradeLevel: bundle.grade.name,
          subjectName: bundle.subject.name,
          chapterName: bundle.chapter.title,
          topicName: bundle.topics[0]?.title,
          chapterSummary:
            activeContent?.introduction ||
            bundle.chapter.summary ||
            `${bundle.subject.name} - ${bundle.chapter.title}`,
        }}
      />
    </section>
  );
}
