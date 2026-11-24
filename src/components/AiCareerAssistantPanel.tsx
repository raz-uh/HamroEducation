import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Info,
  Send,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type { AiCareerAssistantResponse } from '../types/api.ts';

interface AiCareerAssistantPanelProps {
  onNavigate: (path: string) => void;
}

const SAMPLE_CAREER_PROMPTS = [
  'Compare BSc CSIT vs BCA vs BE Computer fees, eligibility, and entrances in Nepal.',
  'Which scholarships in Nepal support engineering or medical bachelor studies?',
  'I completed Class 12 Management — what courses and career paths fit best?',
];

export function AiCareerAssistantPanel({ onNavigate }: AiCareerAssistantPanelProps) {
  const { apiFetch } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiCareerAssistantResponse | null>(null);

  const submitQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (trimmed.length < 3) return;
    setExpanded(true);
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/ai/career-assistant', {
        method: 'POST',
        body: JSON.stringify({ prompt: trimmed }),
      });
      const json = (await res.json()) as AiCareerAssistantResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'AI Career Assistant failed to respond.');
      }
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach AI Career Assistant.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitQuestion(prompt);
  };

  return (
    <aside
      aria-labelledby="ai-career-assistant-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-red-700">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Section 10.4 · Grounded AI Career &amp; Admissions Advisor
          </p>
          <h2
            id="ai-career-assistant-heading"
            className="font-display text-base font-bold text-slate-900"
          >
            Ask AI About Verified Courses, Fees, Entrances &amp; Scholarships
          </h2>
          <p className="text-xs text-slate-600">
            Answers are grounded in our live verified Nepal university, college, and scholarship
            database—never unverified rumours.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 shrink-0 self-start sm:self-center"
        >
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          {expanded ? 'Collapse AI Advisor' : 'Open AI Career Advisor'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_CAREER_PROMPTS.map((sample) => (
              <button
                key={sample}
                type="button"
                disabled={loading}
                onClick={() => {
                  setPrompt(sample);
                  void submitQuestion(sample);
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-700 hover:bg-white hover:border-slate-300 disabled:opacity-50"
              >
                {sample}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask about TU/KU/PU courses, NPR fee ranges, eligibility, or scholarships..."
              aria-label="Ask AI Career Assistant"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || prompt.trim().length < 3}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              {loading ? 'Analyzing Catalog...' : 'Ask Advisor'}
            </button>
          </form>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-800">
                {result.guidance}
              </div>

              {result.keyRecommendations.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1.5">
                  <p className="text-xs font-semibold text-slate-900">Actionable Steps</p>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {result.keyRecommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.citedRecords.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Verified Catalog Records Cited
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {result.citedRecords.map((cit, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onNavigate(cit.route)}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-left hover:border-slate-400 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {cit.title}
                          </p>
                          <p className="font-mono text-[10px] text-slate-500 truncate">
                            {cit.source} · Verified {cit.lastVerifiedDate}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-red-700" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-950">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-800" aria-hidden="true" />
                <span>{result.disclaimer}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
