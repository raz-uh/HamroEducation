import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCourseComparisonMatrix,
  COURSE_CATEGORIES,
  filterColleges,
  filterCourses,
  filterScholarships,
  formatNprRange,
  isSafeHttpUrl,
  SCHOLARSHIP_CATEGORIES,
  validateVerifiedRecord,
  type FilterableCourseItem,
} from './explorer';

const SAMPLE_COURSES: FilterableCourseItem[] = [
  {
    slug: 'bsc-csit',
    code: 'BSc CSIT',
    name: 'BSc CSIT',
    fullForm: 'Bachelor of Science in Computer Science and Information Technology',
    category: 'IT & Computer Science',
    universityShortCode: 'TU',
    universityName: 'Tribhuvan University',
    entranceExamSlug: 'bsc-csit',
    entranceExamName: 'TU IOST BSc CSIT Entrance',
    durationLabel: '4 Years (8 Semesters)',
    eligibility: '+2 Science with Physics & Mathematics (min C)',
    admissionProcess: 'TU IOST 100 MCQ Entrance + College Merit List',
    curriculumModulesSummary: 'C, OOP, DSA, OS, DBMS, AI, Compiler Design',
    verifiedFeeMinNpr: 340000,
    verifiedFeeMaxNpr: 1150000,
    verifiedFeeNote: 'Constituent vs Private Affiliated total 4-year range',
    careerPossibilities: ['Software Engineer', 'Backend Architect', 'Data Scientist'],
    requiredSkills: ['Programming', 'Algorithms', 'SQL'],
    higherStudiesOptions: ['MSc CSIT', 'MCS', 'MS Computer Science'],
    source: 'TU IOST Official Prospectus',
    lastVerifiedDate: '2026-04-10',
  },
  {
    slug: 'bit',
    code: 'BIT',
    name: 'BIT',
    fullForm: 'Bachelor of Information Technology',
    category: 'IT & Computer Science',
    universityShortCode: 'TU',
    universityName: 'Tribhuvan University',
    entranceExamSlug: 'bsc-csit',
    entranceExamName: 'TU IOST BIT Entrance',
    durationLabel: '4 Years (8 Semesters)',
    eligibility: '+2 any stream with Mathematics or Computer Science (min C)',
    admissionProcess: 'TU IOST BIT Entrance + Merit Ranking',
    curriculumModulesSummary: 'Web Tech, Networking, Cloud, Cybersecurity, Java',
    verifiedFeeMinNpr: 320000,
    verifiedFeeMaxNpr: 880000,
    verifiedFeeNote: 'Constituent & affiliated campus 8-semester estimate',
    careerPossibilities: ['Full-Stack Developer', 'Network Engineer', 'Cloud Admin'],
    requiredSkills: ['Web Systems', 'Networking', 'Java'],
    higherStudiesOptions: ['MIT', 'MSc IT', 'MBA Tech'],
    source: 'TU IOST BIT Curriculum Notice',
    lastVerifiedDate: '2026-04-10',
  },
  {
    slug: 'bba',
    code: 'BBA',
    name: 'BBA',
    fullForm: 'Bachelor of Business Administration',
    category: 'Management',
    universityShortCode: 'TU',
    universityName: 'Tribhuvan University',
    entranceExamSlug: 'cmat',
    entranceExamName: 'TU FOM CMAT',
    durationLabel: '4 Years (8 Semesters)',
    eligibility: '+2 any stream with minimum D+ / 1.8 CGPA',
    admissionProcess: 'CMAT Exam + Group Discussion + Personal Interview',
    curriculumModulesSummary: 'Financial Accounting, Marketing, Organizational Behavior, Strategy',
    verifiedFeeMinNpr: 360000,
    verifiedFeeMaxNpr: 950000,
    verifiedFeeNote: 'Constituent vs Private FOM colleges',
    careerPossibilities: ['Financial Analyst', 'Product Manager', 'Banker'],
    requiredSkills: ['Financial Analysis', 'Communication', 'Excel'],
    higherStudiesOptions: ['MBA', 'MBS', 'CFA'],
    source: 'TU FOM CMAT Information Bulletin',
    lastVerifiedDate: '2026-04-12',
  },
];

test('Phase 6 category catalogs cover required categories', () => {
  assert.equal(COURSE_CATEGORIES.length, 11);
  assert.ok(COURSE_CATEGORIES.includes('IT & Computer Science'));
  assert.ok(COURSE_CATEGORIES.includes('Medical & Health'));
  assert.ok(COURSE_CATEGORIES.includes('Emerging Fields'));

  assert.equal(SCHOLARSHIP_CATEGORIES.length, 7);
  assert.ok(SCHOLARSHIP_CATEGORIES.includes('Government Scholarships'));
  assert.ok(SCHOLARSHIP_CATEGORIES.includes('International Scholarships'));
});

test('isSafeHttpUrl accepts https/http URLs and rejects javascript/data URLs', () => {
  assert.equal(isSafeHttpUrl('https://ioe.tu.edu.np/notices'), true);
  assert.equal(isSafeHttpUrl('http://ku.edu.np'), true);
  assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
  assert.equal(isSafeHttpUrl('data:text/html,<script>'), false);
  assert.equal(isSafeHttpUrl(''), false);
});

test('validateVerifiedRecord requires non-empty source and YYYY-MM-DD date', () => {
  assert.equal(
    validateVerifiedRecord({ source: 'TU IOST Official Notice', lastVerifiedDate: '2026-04-10' }).valid,
    true,
  );
  assert.equal(validateVerifiedRecord({ source: '', lastVerifiedDate: '2026-04-10' }).valid, false);
  assert.equal(
    validateVerifiedRecord({ source: 'MEC Nepal', lastVerifiedDate: 'April 2026' }).valid,
    false,
  );
});

test('formatNprRange formats equal, ranged, and zero NPR amounts cleanly', () => {
  assert.equal(formatNprRange(340000, 1150000), 'NPR 3,40,000 – NPR 11,50,000');
  assert.equal(formatNprRange(500000, 500000), 'NPR 5,00,000');
  assert.equal(formatNprRange(0, 0), 'Full Merit / Subsidized');
});

test('filterCourses, filterColleges, and filterScholarships filter accurately', () => {
  const itCourses = filterCourses(SAMPLE_COURSES, { category: 'IT & Computer Science' });
  assert.equal(itCourses.length, 2);

  const searchCsit = filterCourses(SAMPLE_COURSES, { query: 'CSIT' });
  assert.equal(searchCsit.length, 1);
  assert.equal(searchCsit[0].slug, 'bsc-csit');

  const colleges = filterColleges(
    [
      {
        slug: 'pulchowk',
        name: 'IOE Pulchowk Campus',
        province: 'Bagmati Province',
        district: 'Lalitpur',
        city: 'Lalitpur',
        universityShortCode: 'TU',
        institutionType: 'constituent',
        offeredCourseSlugs: ['be-computer', 'be-civil'],
      },
      {
        slug: 'wrc',
        name: 'IOE Pashchimanchal Campus',
        province: 'Gandaki Province',
        district: 'Kaski',
        city: 'Pokhara',
        universityShortCode: 'TU',
        institutionType: 'constituent',
        offeredCourseSlugs: ['be-civil'],
      },
    ],
    { province: 'Gandaki Province', courseSlug: 'be-civil' },
  );
  assert.equal(colleges.length, 1);
  assert.equal(colleges[0].slug, 'wrc');

  const filteredSchol = filterScholarships(
    [
      {
        slug: 'mec',
        title: 'MEC 75% Public Medical Scholarship',
        provider: 'Medical Education Commission',
        category: 'Government Scholarships',
        eligibility: 'MECEE-BL qualifiers',
        targetStreams: ['Science Biology'],
      },
      {
        slug: 'ku-merit',
        title: 'KU Merit Tuition Waiver',
        provider: 'Kathmandu University',
        category: 'University Scholarships',
        eligibility: 'Top 5% semester GPA',
        targetStreams: ['Engineering', 'Management'],
      },
    ],
    { category: 'Government Scholarships' },
  );
  assert.equal(filteredSchol.length, 1);
  assert.equal(filteredSchol[0].slug, 'mec');
});

test('buildCourseComparisonMatrix validates 2-4 courses and aligns dimensions', () => {
  const single = buildCourseComparisonMatrix([SAMPLE_COURSES[0]]);
  assert.equal(single.valid, false);

  const pair = buildCourseComparisonMatrix(SAMPLE_COURSES.slice(0, 3));
  assert.equal(pair.valid, true);
  assert.equal(pair.courses.length, 3);
  assert.equal(pair.rows.length, 11);
  assert.equal(pair.rows[0].dimension, 'Duration');
  assert.equal(pair.rows[0].values.length, 3);
  assert.ok(pair.rows[6].values[0].includes('NPR 3,40,000'));
});
