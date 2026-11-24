import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  Plus,
  RotateCw,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type { FlashcardsDeckResponse } from '../types/api.ts';

interface FlashcardsViewProps {
  onNavigate: (path: string) => void;
  onOpenAuth: () => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All Decks' },
  { id: 'definition', label: 'Definitions' },
  { id: 'formula', label: 'Formulas' },
  { id: 'important_fact', label: 'Important Facts' },
  { id: 'vocabulary', label: 'Vocabulary' },
] as const;

export function FlashcardsView({ onNavigate, onOpenAuth }: FlashcardsViewProps) {
  const { user, apiFetch } = useAuth();
  const [deck, setDeck] = useState<FlashcardsDeckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<string>('all');
  const [dueOnly, setDueOnly] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  // Custom card form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCategory, setNewCategory] = useState<'definition' | 'formula' | 'important_fact' | 'vocabulary'>('definition');
  const [newLevel, setNewLevel] = useState('Class 12 / NEB');
  const [newSubject, setNewSubject] = useState('Physics');
  const [newChapter, setNewChapter] = useState('Rotational Dynamics');
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newHint, setNewHint] = useState('');
  const [creating, setCreating] = useState(false);

  const loadDeck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      if (dueOnly) params.set('dueOnly', 'true');
      const res = await apiFetch(`/api/flashcards?${params.toString()}`);
      const json = (await res.json()) as FlashcardsDeckResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not load flashcards.');
      setDeck(json);
      setActiveIndex(0);
      setFlipped(false);
      setShowHint(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load flashcards.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, category, dueOnly]);

  useEffect(() => {
    void loadDeck();
  }, [loadDeck]);

  const cards = deck?.cards ?? [];
  const activeCard = cards[activeIndex] ?? null;

  const handleRateCard = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (!activeCard) return;
    if (!user) {
      onOpenAuth();
      return;
    }
    setReviewBusy(true);
    setReviewNotice(null);
    setError(null);
    try {
      const res = await apiFetch(`/api/flashcards/${activeCard.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ rating }),
      });
      const json = (await res.json()) as {
        intervalDays: number;
        nextReviewAt: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || 'Review scheduling failed.');

      const formattedDate = new Date(json.nextReviewAt).toLocaleDateString();
      setReviewNotice(
        `Scheduled next spaced review in ${json.intervalDays} day${json.intervalDays === 1 ? '' : 's'} (${formattedDate}).`,
      );
      await loadDeck();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save card review.');
    } finally {
      setReviewBusy(false);
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch('/api/flashcards', {
        method: 'POST',
        body: JSON.stringify({
          category: newCategory,
          academicLevel: newLevel,
          subjectName: newSubject,
          chapterName: newChapter,
          frontText: newFront,
          backText: newBack,
          hintText: newHint || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not create flashcard.');

      setNewFront('');
      setNewBack('');
      setNewHint('');
      setShowCreateForm(false);
      setReviewNotice('Custom flashcard added to your spaced-repetition deck.');
      await loadDeck();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save flashcard.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <section aria-labelledby="flashcards-heading" className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Student Dashboard
          </button>
          <p className="text-xs font-medium text-red-700">Section 9.6 · Spaced Repetition Recall</p>
          <h1
            id="flashcards-heading"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            Flashcards &amp; Spaced Revision
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Active recall decks across Definitions, Formulas, Important Facts, and Entrance
            Vocabulary with SM-2 interval scheduling.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!user) {
              onOpenAuth();
            } else {
              setShowCreateForm((v) => !v);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {showCreateForm ? 'Close Custom Card Form' : 'Create Custom Flashcard'}
        </button>
      </div>

      {/* Metrics + Filters */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Cards</p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {deck?.counts.total ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Due for Review</p>
          <p className="mt-1 font-mono text-2xl font-bold text-amber-700 tabular-nums">
            {deck?.counts.due ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Custom Cards</p>
          <p className="mt-1 font-mono text-2xl font-bold text-blue-700 tabular-nums">
            {deck?.counts.custom ?? 0}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Flashcard categories" className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                category === c.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={dueOnly}
            onChange={(e) => setDueOnly(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-slate-900"
          />
          <span>Show Due Now Only</span>
        </label>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {reviewNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-900">
          {reviewNotice}
        </div>
      )}

      {showCreateForm && (
        <form
          onSubmit={(e) => void handleCreateCustom(e)}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <h2 className="font-display text-base font-bold text-slate-900">
            Add Custom Flashcard
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <label className="space-y-1 text-xs font-medium text-slate-700">
              <span>Category</span>
              <select
                value={newCategory}
                onChange={(e) =>
                  setNewCategory(
                    e.target.value as 'definition' | 'formula' | 'important_fact' | 'vocabulary',
                  )
                }
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              >
                <option value="definition">Definition</option>
                <option value="formula">Formula</option>
                <option value="important_fact">Important Fact</option>
                <option value="vocabulary">Vocabulary</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-700">
              <span>Academic Level</span>
              <input
                type="text"
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-700">
              <span>Subject</span>
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-700">
              <span>Chapter</span>
              <input
                type="text"
                value={newChapter}
                onChange={(e) => setNewChapter(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-slate-700">
              <span>Front Prompt / Term</span>
              <textarea
                rows={3}
                value={newFront}
                onChange={(e) => setNewFront(e.target.value)}
                required
                placeholder="e.g., Snell's Law of Refraction"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-700">
              <span>Back Answer / Formula</span>
              <textarea
                rows={3}
                value={newBack}
                onChange={(e) => setNewBack(e.target.value)}
                required
                placeholder="e.g., n₁ sin(θ₁) = n₂ sin(θ₂)"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="flex-1 space-y-1 text-xs font-medium text-slate-700">
              <span>Memory Hint (Optional)</span>
              <input
                type="text"
                value={newHint}
                onChange={(e) => setNewHint(e.target.value)}
                placeholder="Short mnemonic or unit check..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              />
            </label>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-red-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
            >
              {creating ? 'Saving...' : 'Save Flashcard'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : !activeCard ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3">
          <Layers className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-slate-900">
            No flashcards match this filter
          </h2>
          <p className="text-sm text-slate-600">
            You have caught up on all due cards in this category. Switch off &ldquo;Due Now Only&rdquo;
            or create a custom revision card.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Active Flashcard Stage */}
          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 text-xs text-slate-500">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold uppercase text-red-700">
                    {activeCard.category.replace('_', ' ')}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-slate-800">{activeCard.subjectName}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeCard.chapterName}</span>
                </div>
                <span className="font-mono tabular-nums">
                  Card {activeIndex + 1} / {cards.length}
                </span>
              </div>

              <div className="min-h-[180px] flex flex-col justify-center space-y-4 py-4">
                <p className="text-xs font-medium text-slate-400">
                  {flipped ? 'ANSWER / FORMULA / DEFINITION' : 'PROMPT'}
                </p>
                <p className="font-display text-xl font-bold leading-snug text-slate-900">
                  {flipped ? activeCard.backText : activeCard.frontText}
                </p>
                {!flipped && showHint && activeCard.hintText && (
                  <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                    Hint: {activeCard.hintText}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFlipped((f) => !f)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                    {flipped ? 'Show Prompt' : 'Flip Card'}
                  </button>
                  {!flipped && activeCard.hintText && (
                    <button
                      type="button"
                      onClick={() => setShowHint((h) => !h)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {showHint ? 'Hide Hint' : 'Show Hint'}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={activeIndex === 0}
                    onClick={() => {
                      setActiveIndex((i) => Math.max(0, i - 1));
                      setFlipped(false);
                      setShowHint(false);
                    }}
                    aria-label="Previous flashcard"
                    className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={activeIndex >= cards.length - 1}
                    onClick={() => {
                      setActiveIndex((i) => Math.min(cards.length - 1, i + 1));
                      setFlipped(false);
                      setShowHint(false);
                    }}
                    aria-label="Next flashcard"
                    className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Spaced Repetition Scheduler Controls */}
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    Spaced Repetition Rating
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Interval: {activeCard.intervalDays}d · Reps: {activeCard.repetitions}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    type="button"
                    disabled={reviewBusy}
                    onClick={() => void handleRateCard('again')}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                  >
                    Again (1d)
                  </button>
                  <button
                    type="button"
                    disabled={reviewBusy}
                    onClick={() => void handleRateCard('hard')}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                  >
                    Hard
                  </button>
                  <button
                    type="button"
                    disabled={reviewBusy}
                    onClick={() => void handleRateCard('good')}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                  >
                    Good
                  </button>
                  <button
                    type="button"
                    disabled={reviewBusy}
                    onClick={() => void handleRateCard('easy')}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Easy
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Deck Navigator */}
          <aside className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="font-display text-sm font-bold text-slate-900">
              Deck Index ({cards.length})
            </h2>
            <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto pr-1">
              {cards.map((card, idx) => (
                <li key={`${card.id}-${card.isCurated}`} className="py-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveIndex(idx);
                      setFlipped(false);
                      setShowHint(false);
                    }}
                    className={`w-full text-left rounded-lg p-2 transition-colors ${
                      idx === activeIndex ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold line-clamp-1 ${
                        idx === activeIndex ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {card.frontText}
                    </p>
                    <p
                      className={`mt-0.5 text-[11px] ${
                        idx === activeIndex ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {card.subjectName} · {card.isDue ? 'Due now' : `${card.intervalDays}d`}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </section>
  );
}
