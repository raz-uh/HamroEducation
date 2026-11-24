export const COURSE_CATEGORIES = [
  'IT & Computer Science',
  'Management',
  'Engineering',
  'Medical & Health',
  'Science',
  'Law',
  'Agriculture',
  'Humanities',
  'Education',
  'Tourism & Hospitality',
  'Emerging Fields',
] as const;

export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

export const SCHOLARSHIP_CATEGORIES = [
  'Government Scholarships',
  'University Scholarships',
  'College Scholarships',
  'Merit-based',
  'Need-based',
  'Entrance Scholarships',
  'International Scholarships',
] as const;

export type ScholarshipCategory = (typeof SCHOLARSHIP_CATEGORIES)[number];

export const OPPORTUNITY_CATEGORIES = [
  'Olympiad',
  'Hackathon',
  'Workshop',
  'Internship',
  'Competition',
  'Youth Initiative',
] as const;

export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number];

export const DEADLINE_CATEGORIES = [
  'SEE',
  'NEB',
  'Entrance Exam',
  'Scholarship',
  'University Admission',
] as const;

export const NEPAL_PROVINCES = [
  'Koshi Province',
  'Madhesh Province',
  'Bagmati Province',
  'Gandaki Province',
  'Lumbini Province',
  'Karnali Province',
  'Sudurpashchim Province',
] as const;

export function isSafeHttpUrl(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function formatNprAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return 'NPR 0';
  return `NPR ${Math.round(amount).toLocaleString('en-IN')}`;
}

export function formatNprRange(minNpr: number, maxNpr: number): string {
  if (!Number.isFinite(minNpr) || !Number.isFinite(maxNpr)) {
    return 'Verify with official notice';
  }
  const low = Math.min(minNpr, maxNpr);
  const high = Math.max(minNpr, maxNpr);
  if (low === 0 && high === 0) {
    return 'Full Merit / Subsidized';
  }
  if (low === high) {
    return formatNprAmount(low);
  }
  return `${formatNprAmount(low)} – ${formatNprAmount(high)}`;
}

export function validateVerifiedRecord(record: {
  source?: string | null;
  lastVerifiedDate?: string | null;
}): { valid: boolean; reason?: string } {
  const source = record.source?.trim() ?? '';
  const dateStr = record.lastVerifiedDate?.trim() ?? '';
  if (source.length < 3) {
    return { valid: false, reason: 'Mandatory official source attribution is required.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return {
      valid: false,
      reason: 'Mandatory last_verified_date must follow YYYY-MM-DD format.',
    };
  }
  return { valid: true };
}

export interface FilterableCourseItem {
  slug: string;
  code: string;
  name: string;
  fullForm: string;
  category: string;
  universityShortCode: string;
  universityName: string;
  entranceExamSlug: string | null;
  entranceExamName: string | null;
  durationLabel: string;
  eligibility: string;
  admissionProcess: string;
  curriculumModulesSummary: string;
  verifiedFeeMinNpr: number;
  verifiedFeeMaxNpr: number;
  verifiedFeeNote: string;
  careerPossibilities: string[];
  requiredSkills: string[];
  higherStudiesOptions: string[];
  source: string;
  lastVerifiedDate: string;
}

export function filterCourses<T extends FilterableCourseItem>(
  items: T[],
  filters: {
    category?: string;
    universityCode?: string;
    query?: string;
  },
): T[] {
  const cat = (filters.category ?? '').trim().toLowerCase();
  const uni = (filters.universityCode ?? '').trim().toLowerCase();
  const q = (filters.query ?? '').trim().toLowerCase();

  return items.filter((item) => {
    if (cat && cat !== 'all' && item.category.toLowerCase() !== cat) {
      return false;
    }
    if (uni && uni !== 'all' && item.universityShortCode.toLowerCase() !== uni) {
      return false;
    }
    if (q) {
      const hay = `${item.name} ${item.fullForm} ${item.code} ${item.category} ${item.universityName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export interface FilterableCollegeItem {
  slug: string;
  name: string;
  province: string;
  district: string;
  city: string;
  universityShortCode: string;
  institutionType: string;
  offeredCourseSlugs: string[];
}

export function filterColleges<T extends FilterableCollegeItem>(
  items: T[],
  filters: {
    province?: string;
    universityCode?: string;
    courseSlug?: string;
    institutionType?: string;
    query?: string;
  },
): T[] {
  const prov = (filters.province ?? '').trim().toLowerCase();
  const uni = (filters.universityCode ?? '').trim().toLowerCase();
  const course = (filters.courseSlug ?? '').trim().toLowerCase();
  const instType = (filters.institutionType ?? '').trim().toLowerCase();
  const q = (filters.query ?? '').trim().toLowerCase();

  return items.filter((item) => {
    if (prov && prov !== 'all' && item.province.toLowerCase() !== prov) return false;
    if (uni && uni !== 'all' && item.universityShortCode.toLowerCase() !== uni) return false;
    if (instType && instType !== 'all' && item.institutionType.toLowerCase() !== instType) {
      return false;
    }
    if (
      course &&
      course !== 'all' &&
      !item.offeredCourseSlugs.some((s) => s.toLowerCase() === course)
    ) {
      return false;
    }
    if (q) {
      const hay = `${item.name} ${item.city} ${item.district} ${item.province}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export interface FilterableScholarshipItem {
  slug: string;
  title: string;
  provider: string;
  category: string;
  eligibility: string;
  targetStreams: string[];
}

export function filterScholarships<T extends FilterableScholarshipItem>(
  items: T[],
  filters: {
    category?: string;
    query?: string;
  },
): T[] {
  const cat = (filters.category ?? '').trim().toLowerCase();
  const q = (filters.query ?? '').trim().toLowerCase();

  return items.filter((item) => {
    if (cat && cat !== 'all' && item.category.toLowerCase() !== cat) return false;
    if (q) {
      const hay = `${item.title} ${item.provider} ${item.eligibility} ${item.targetStreams.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export interface ComparisonRow {
  dimension: string;
  values: string[];
}

export function buildCourseComparisonMatrix(
  selectedCourses: FilterableCourseItem[],
): {
  valid: boolean;
  error?: string;
  courses: FilterableCourseItem[];
  rows: ComparisonRow[];
} {
  if (selectedCourses.length < 2) {
    return {
      valid: false,
      error: 'Select between 2 and 4 courses to compare side-by-side.',
      courses: selectedCourses,
      rows: [],
    };
  }
  const clamped = selectedCourses.slice(0, 4);
  const rows: ComparisonRow[] = [
    {
      dimension: 'Duration',
      values: clamped.map((c) => c.durationLabel),
    },
    {
      dimension: 'Affiliated University',
      values: clamped.map((c) => `${c.universityName} (${c.universityShortCode})`),
    },
    {
      dimension: 'Eligibility',
      values: clamped.map((c) => c.eligibility),
    },
    {
      dimension: 'Entrance Exam',
      values: clamped.map((c) => c.entranceExamName ?? 'University / Campus Entrance Screening'),
    },
    {
      dimension: 'Admission Process',
      values: clamped.map((c) => c.admissionProcess),
    },
    {
      dimension: 'Core Curriculum',
      values: clamped.map((c) => c.curriculumModulesSummary),
    },
    {
      dimension: 'Verified Fees (Total)',
      values: clamped.map(
        (c) => `${formatNprRange(c.verifiedFeeMinNpr, c.verifiedFeeMaxNpr)} — ${c.verifiedFeeNote}`,
      ),
    },
    {
      dimension: 'Career Pathways',
      values: clamped.map((c) => c.careerPossibilities.join(' · ')),
    },
    {
      dimension: 'Required Skills',
      values: clamped.map((c) => c.requiredSkills.join(', ')),
    },
    {
      dimension: 'Higher Education Options',
      values: clamped.map((c) => c.higherStudiesOptions.join(' · ')),
    },
    {
      dimension: 'Verification Metadata',
      values: clamped.map((c) => `${c.source} · Verified ${c.lastVerifiedDate}`),
    },
  ];

  return {
    valid: true,
    courses: clamped,
    rows,
  };
}
