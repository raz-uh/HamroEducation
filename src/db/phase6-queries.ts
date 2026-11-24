import { asc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  applicationDeadlines,
  careerPaths,
  colleges,
  courseColleges,
  courses,
  entranceExams,
  opportunities,
  scholarships,
  universities,
} from './schema.ts';
import { ensureSeeded } from './seed.ts';
import {
  buildCourseComparisonMatrix,
  COURSE_CATEGORIES,
  formatNprRange,
  NEPAL_PROVINCES,
  OPPORTUNITY_CATEGORIES,
  SCHOLARSHIP_CATEGORIES,
} from '../lib/explorer.ts';
import type {
  BachelorBridgeResponse,
  ExploreCareerPathItem,
  ExploreCollegeItem,
  ExploreCourseDetailResponse,
  ExploreCourseItem,
} from '../types/api.ts';

function summarizeModules(modules: Array<{ term: string; subjects: string[] }>): string {
  const flat = modules.flatMap((m) => m.subjects).slice(0, 6);
  return flat.length > 0 ? flat.join(', ') : 'Core discipline modules';
}

export async function getCoursesDirectory() {
  await ensureSeeded();

  const [courseRows, uniRows, examRows, ccRows] = await Promise.all([
    db.select().from(courses).orderBy(asc(courses.id)),
    db.select().from(universities).orderBy(asc(universities.id)),
    db.select().from(entranceExams).orderBy(asc(entranceExams.id)),
    db.select().from(courseColleges),
  ]);

  const uniMap = new Map(uniRows.map((u) => [u.id, u]));
  const examMap = new Map(examRows.map((e) => [e.id, e]));
  const collegeCountByCourse = new Map<number, number>();
  for (const row of ccRows) {
    collegeCountByCourse.set(row.courseId, (collegeCountByCourse.get(row.courseId) ?? 0) + 1);
  }

  const mapped: ExploreCourseItem[] = courseRows.map((c) => {
    const uni = uniMap.get(c.universityId);
    const exam = c.entranceExamId ? examMap.get(c.entranceExamId) : null;
    return {
      id: c.id,
      slug: c.slug,
      code: c.code,
      name: c.name,
      fullForm: c.fullForm,
      category: c.category,
      universityId: c.universityId,
      universityShortCode: uni?.shortCode ?? 'TU',
      universityName: uni?.name ?? 'Tribhuvan University',
      entranceExamId: c.entranceExamId,
      entranceExamSlug: exam?.slug ?? null,
      entranceExamName: exam?.name ?? null,
      durationYears: c.durationYears,
      durationLabel: c.durationLabel,
      eligibility: c.eligibility,
      admissionProcess: c.admissionProcess,
      curriculumModules: c.curriculumModules,
      curriculumModulesSummary: summarizeModules(c.curriculumModules),
      verifiedFeeMinNpr: c.verifiedFeeMinNpr,
      verifiedFeeMaxNpr: c.verifiedFeeMaxNpr,
      verifiedFeeNote: c.verifiedFeeNote,
      careerPossibilities: c.careerPossibilities,
      requiredSkills: c.requiredSkills,
      higherStudiesOptions: c.higherStudiesOptions,
      streamRecommendation: c.streamRecommendation,
      collegesCount: collegeCountByCourse.get(c.id) ?? 0,
      source: c.source,
      lastVerifiedDate: c.lastVerifiedDate,
    };
  });

  return {
    courses: mapped,
    categories: COURSE_CATEGORIES,
    universities: uniRows,
  };
}

export async function getCourseDetailBySlug(
  slug: string,
): Promise<ExploreCourseDetailResponse | null> {
  await ensureSeeded();

  const [courseRow] = await db
    .select()
    .from(courses)
    .where(eq(courses.slug, slug.trim().toLowerCase()))
    .limit(1);

  if (!courseRow) return null;

  const [uniRows, examRows, offerings, allScholarships] = await Promise.all([
    db.select().from(universities),
    courseRow.entranceExamId
      ? db.select().from(entranceExams).where(eq(entranceExams.id, courseRow.entranceExamId))
      : Promise.resolve([]),
    db
      .select({
        cc: courseColleges,
        college: colleges,
      })
      .from(courseColleges)
      .innerJoin(colleges, eq(courseColleges.collegeId, colleges.id))
      .where(eq(courseColleges.courseId, courseRow.id))
      .orderBy(asc(colleges.name)),
    db.select().from(scholarships).orderBy(asc(scholarships.id)),
  ]);

  const uniMap = new Map(uniRows.map((u) => [u.id, u]));
  const courseUni = uniMap.get(courseRow.universityId) ?? uniRows[0];
  const exam = examRows[0] ?? null;

  const matchedScholarships = allScholarships.filter((sch) => {
    const hay = `${sch.targetStreams.join(' ')} ${sch.eligibility} ${sch.title}`.toLowerCase();
    return (
      hay.includes(courseRow.code.toLowerCase()) ||
      hay.includes(courseRow.name.toLowerCase()) ||
      hay.includes(courseRow.category.split(' ')[0].toLowerCase()) ||
      sch.category === 'Government Scholarships' ||
      sch.category === 'International Scholarships'
    );
  });

  return {
    course: {
      id: courseRow.id,
      slug: courseRow.slug,
      code: courseRow.code,
      name: courseRow.name,
      fullForm: courseRow.fullForm,
      category: courseRow.category,
      universityId: courseRow.universityId,
      universityShortCode: courseUni?.shortCode ?? 'TU',
      universityName: courseUni?.name ?? 'Tribhuvan University',
      entranceExamId: courseRow.entranceExamId,
      entranceExamSlug: exam?.slug ?? null,
      entranceExamName: exam?.name ?? null,
      durationYears: courseRow.durationYears,
      durationLabel: courseRow.durationLabel,
      eligibility: courseRow.eligibility,
      admissionProcess: courseRow.admissionProcess,
      curriculumModules: courseRow.curriculumModules,
      curriculumModulesSummary: summarizeModules(courseRow.curriculumModules),
      verifiedFeeMinNpr: courseRow.verifiedFeeMinNpr,
      verifiedFeeMaxNpr: courseRow.verifiedFeeMaxNpr,
      verifiedFeeNote: courseRow.verifiedFeeNote,
      careerPossibilities: courseRow.careerPossibilities,
      requiredSkills: courseRow.requiredSkills,
      higherStudiesOptions: courseRow.higherStudiesOptions,
      streamRecommendation: courseRow.streamRecommendation,
      collegesCount: offerings.length,
      source: courseRow.source,
      lastVerifiedDate: courseRow.lastVerifiedDate,
    },
    university: courseUni,
    entranceExam: exam,
    colleges: offerings.map(({ cc, college }) => ({
      id: college.id,
      slug: college.slug,
      name: college.name,
      institutionType: college.institutionType,
      province: college.province,
      district: college.district,
      city: college.city,
      officialWebsite: college.officialWebsite,
      universityShortCode: uniMap.get(college.universityId)?.shortCode ?? 'TU',
      totalSeats: cc.totalSeats,
      scholarshipSeats: cc.scholarshipSeats,
      verifiedFeeMinNpr: cc.verifiedFeeMinNpr,
      verifiedFeeMaxNpr: cc.verifiedFeeMaxNpr,
      feeStructureNote: cc.feeStructureNote,
      admissionNote: cc.admissionNote,
      source: cc.source,
      lastVerifiedDate: cc.lastVerifiedDate,
    })),
    scholarships: matchedScholarships.slice(0, 4),
  };
}

export async function getCourseComparison(slugs: string[]) {
  const dir = await getCoursesDirectory();
  const normalized = slugs.map((s) => s.trim().toLowerCase()).filter(Boolean);
  const selected =
    normalized.length >= 2
      ? normalized
          .map((slug) => dir.courses.find((c) => c.slug === slug))
          .filter((c): c is ExploreCourseItem => Boolean(c))
      : dir.courses.filter((c) => ['bsc-csit', 'bit', 'bca'].includes(c.slug));

  const matrix = buildCourseComparisonMatrix(selected);
  return {
    allCourses: dir.courses,
    selectedSlugs: matrix.courses.map((c) => c.slug),
    matrix,
  };
}

export async function getCollegesDirectory() {
  await ensureSeeded();

  const [collegeRows, uniRows, ccRows, courseRows] = await Promise.all([
    db.select().from(colleges).orderBy(asc(colleges.name)),
    db.select().from(universities),
    db.select().from(courseColleges),
    db.select().from(courses),
  ]);

  const uniMap = new Map(uniRows.map((u) => [u.id, u]));
  const courseMap = new Map(courseRows.map((c) => [c.id, c]));

  const items: ExploreCollegeItem[] = collegeRows.map((col) => {
    const uni = uniMap.get(col.universityId);
    const offerings = ccRows
      .filter((cc) => cc.collegeId === col.id)
      .map((cc) => {
        const course = courseMap.get(cc.courseId);
        if (!course) return null;
        return {
          courseSlug: course.slug,
          courseName: course.name,
          courseCode: course.code,
          totalSeats: cc.totalSeats,
          scholarshipSeats: cc.scholarshipSeats,
          verifiedFeeMinNpr: cc.verifiedFeeMinNpr,
          verifiedFeeMaxNpr: cc.verifiedFeeMaxNpr,
          feeStructureNote: cc.feeStructureNote,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    return {
      id: col.id,
      slug: col.slug,
      name: col.name,
      institutionType: col.institutionType,
      province: col.province,
      district: col.district,
      city: col.city,
      officialWebsite: col.officialWebsite,
      contactEmail: col.contactEmail,
      contactPhone: col.contactPhone,
      admissionRequirements: col.admissionRequirements,
      facilities: col.facilities,
      scholarshipHighlights: col.scholarshipHighlights,
      verifiedFacts: col.verifiedFacts,
      promotionalClaims: col.promotionalClaims,
      universityShortCode: uni?.shortCode ?? 'TU',
      universityName: uni?.name ?? 'Tribhuvan University',
      offeredCourses: offerings,
      offeredCourseSlugs: offerings.map((o) => o.courseSlug),
      source: col.source,
      lastVerifiedDate: col.lastVerifiedDate,
    };
  });

  return {
    colleges: items,
    provinces: NEPAL_PROVINCES,
    universities: uniRows,
    courses: courseRows.map((c) => ({ slug: c.slug, name: c.name })),
  };
}

export async function getScholarshipsDirectory() {
  await ensureSeeded();
  const rows = await db.select().from(scholarships).orderBy(asc(scholarships.id));
  return {
    scholarships: rows,
    categories: SCHOLARSHIP_CATEGORIES,
  };
}

export async function getCareerPathsDirectory() {
  await ensureSeeded();
  const [paths, courseRows, uniRows] = await Promise.all([
    db.select().from(careerPaths).orderBy(asc(careerPaths.id)),
    db.select().from(courses),
    db.select().from(universities),
  ]);

  const uniMap = new Map(uniRows.map((u) => [u.id, u]));
  const courseBySlug = new Map(courseRows.map((c) => [c.slug, c]));

  const items: ExploreCareerPathItem[] = paths.map((p) => ({
    ...p,
    recommendedCourses: p.recommendedCourseSlugs
      .map((slug) => courseBySlug.get(slug))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => ({
        slug: c.slug,
        name: c.name,
        durationLabel: c.durationLabel,
        universityShortCode: uniMap.get(c.universityId)?.shortCode ?? 'TU',
      })),
  }));

  return {
    careers: items,
  };
}

export async function getOpportunitiesAndCalendar() {
  await ensureSeeded();
  const [opps, deadlines] = await Promise.all([
    db.select().from(opportunities).orderBy(asc(opportunities.deadlineDate)),
    db.select().from(applicationDeadlines).orderBy(asc(applicationDeadlines.deadlineDate)),
  ]);

  return {
    opportunities: opps,
    deadlines,
    opportunityCategories: OPPORTUNITY_CATEGORIES,
  };
}

export async function getClass12BachelorBridgeData(): Promise<BachelorBridgeResponse> {
  await ensureSeeded();
  const [examRows, courseRows, collegeRows, schRows, careerRows, uniRows] = await Promise.all([
    db.select().from(entranceExams).orderBy(asc(entranceExams.id)).limit(4),
    db.select().from(courses).orderBy(asc(courses.id)).limit(4),
    db.select().from(colleges).orderBy(asc(colleges.id)).limit(4),
    db.select().from(scholarships).orderBy(asc(scholarships.id)).limit(4),
    db.select().from(careerPaths).orderBy(asc(careerPaths.id)).limit(4),
    db.select().from(universities),
  ]);

  const uniMap = new Map(uniRows.map((u) => [u.id, u]));

  return {
    entrances: examRows.map((e) => ({
      title: e.name,
      subtitle: e.conductingBody,
      detail: e.eligibilitySummary,
      metric: e.code,
      route: `/entrance/${e.slug}`,
      source: e.source,
      lastVerifiedDate: e.lastVerifiedDate,
    })),
    programs: courseRows.map((c) => ({
      title: `${c.name} — ${c.fullForm}`,
      subtitle: `${c.durationLabel} · ${uniMap.get(c.universityId)?.name ?? 'TU'}`,
      detail: c.eligibility,
      metric: formatNprRange(c.verifiedFeeMinNpr, c.verifiedFeeMaxNpr),
      route: `/explore/courses/${c.slug}`,
      source: c.source,
      lastVerifiedDate: c.lastVerifiedDate,
    })),
    colleges: collegeRows.map((col) => ({
      title: col.name,
      subtitle: `${col.city}, ${col.province}`,
      detail: col.verifiedFacts.verifiedIntakeSummary,
      metric: col.institutionType.split(' ')[0],
      route: '/explore/colleges',
      source: col.source,
      lastVerifiedDate: col.lastVerifiedDate,
    })),
    scholarships: schRows.map((s) => ({
      title: s.title,
      subtitle: s.provider,
      detail: s.financialBenefits,
      metric: s.category.replace(' Scholarships', ''),
      route: '/explore/scholarships',
      source: s.source,
      lastVerifiedDate: s.lastVerifiedDate,
    })),
    careers: careerRows.map((cp) => ({
      title: cp.title,
      subtitle: `${cp.category} · ${cp.licensingBody}`,
      detail: cp.summary,
      metric: cp.averageSalaryRangeNpr.split('(')[0].trim(),
      route: '/explore/careers',
      source: cp.source,
      lastVerifiedDate: cp.lastVerifiedDate,
    })),
  };
}
