import { eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  countries,
  curricula,
  examQuestions,
  examSections,
  exams,
  questionAnswers,
  questionExplanations,
  questionOptions,
  questionSources,
  questionTags,
  questionVersions,
  questions,
  type QuestionAnswerJson,
  type QuestionContentJson,
  type QuestionType,
  type QuestionWorkflowStatus,
  type SnapshotOptionItem,
} from './schema.ts';

interface SeedQuestionSpec {
  questionUid: string;
  academicLevel: string;
  examination: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  questionType: QuestionType;
  difficulty: 'easy' | 'medium' | 'hard';
  questionContent: QuestionContentJson;
  options: Array<SnapshotOptionItem & { isCorrect?: boolean }>;
  correctAnswer: QuestionAnswerJson;
  explanation: string;
  marks: number;
  negativeMarks: number;
  sourceCode: string;
  sourceLabel: string;
  language?: string;
  status: QuestionWorkflowStatus;
  tags: string[];
  examSlugs: Array<{ slug: string; sectionSubject: string }>;
}

const QUESTION_SOURCES_SEED = [
  {
    code: 'SRC-CDC-SEE',
    name: 'CDC SEE Specification Grid & Past Papers',
    sourceType: 'official_past_paper',
    yearBs: '2081 BS',
    verified: true,
  },
  {
    code: 'SRC-NEB-12',
    name: 'NEB Class 12 National Board Archive',
    sourceType: 'official_past_paper',
    yearBs: '2081 BS',
    verified: true,
  },
  {
    code: 'SRC-TU-CSIT',
    name: 'TU IOST B.Sc. CSIT Official Model & Past Bank',
    sourceType: 'official_past_paper',
    yearBs: '2081 BS',
    verified: true,
  },
  {
    code: 'SRC-TU-CMAT',
    name: 'TU FOM CMAT Official Aptitude Bank',
    sourceType: 'official_past_paper',
    yearBs: '2081 BS',
    verified: true,
  },
  {
    code: 'SRC-TU-IOE',
    name: 'TU IOE Pulchowk CBT Engineering Bank',
    sourceType: 'official_past_paper',
    yearBs: '2081 BS',
    verified: true,
  },
  {
    code: 'SRC-MEC-BL',
    name: 'Medical Education Commission MECEE-BL Archive',
    sourceType: 'official_past_paper',
    yearBs: '2081 BS',
    verified: true,
  },
];

const EXAMS_SEED = [
  {
    slug: 'see-compulsory-mock-1',
    title: 'SEE Class 10 Board Readiness Mock Exam (Math, Science & English)',
    category: 'school_board',
    examinationSlug: 'see',
    academicLevel: 'SEE (Class 10)',
    subjectScope: 'Compulsory Mathematics, Science & Technology, English',
    chapterScope: 'Sets, Gravitation, Trigonometry, Grammar',
    totalMarks: 12,
    durationMinutes: 25,
    negativeMarkingRule: {
      enabled: false,
      deductionPerWrong: 0,
      description: 'No negative marking per CDC SEE specification grid.',
    },
    randomizeQuestions: false,
    randomizeOptions: false,
    resultVisibility: 'immediate',
    attemptLimit: 5,
    instructions:
      'Attempt all 6 CDC SEE model items covering Single MCQ, Numerical, Diagram-based Venn analysis, True/False, Assertion & Reason, and Short Answer. No negative marking applies.',
    sections: [
      { title: 'Section A: Compulsory Mathematics', subjectName: 'Mathematics', description: 'Sets, Trigonometry & Compound Interest', sortOrder: 1 },
      { title: 'Section B: Science & English', subjectName: 'Science & Technology', description: 'Gravitation, Pressure & Grammar', sortOrder: 2 },
    ],
  },
  {
    slug: 'class-12-science-mock-1',
    title: 'Class 12 NEB Science Board Full Concept Mock (Phy, Chem, Math, Bio)',
    category: 'school_board',
    examinationSlug: 'class-12-science',
    academicLevel: 'Class 12 (NEB)',
    subjectScope: 'Physics, Chemistry, Mathematics, Biology',
    chapterScope: 'Rotational Dynamics, Kinetics, Integrals, Physiology',
    totalMarks: 12,
    durationMinutes: 30,
    negativeMarkingRule: {
      enabled: false,
      deductionPerWrong: 0,
      description: 'NEB Grade 12 board standard scoring without negative penalty.',
    },
    randomizeQuestions: false,
    randomizeOptions: false,
    resultVisibility: 'immediate',
    attemptLimit: 5,
    instructions:
      'Covers NEB Class 12 Science rotational dynamics, chemical kinetics, antiderivatives, and plant physiology using Multi-MCQ, Matching, Case-based, and Long Answer items.',
    sections: [
      { title: 'Physics & Mathematics', subjectName: 'Physics', description: 'Mechanics, Wave Optics & Calculus', sortOrder: 1 },
      { title: 'Chemistry & Biology', subjectName: 'Chemistry', description: 'Kinetics & Anatomy', sortOrder: 2 },
    ],
  },
  {
    slug: 'class-12-management-mock-1',
    title: 'Class 12 NEB Management Board Mock (Accounting, Economics, Business)',
    category: 'school_board',
    examinationSlug: 'class-12-management',
    academicLevel: 'Class 12 (NEB)',
    subjectScope: 'Corporate Accounting, Macroeconomics, Business Studies',
    chapterScope: 'Share Capital, NRB Monetary Policy, Management Principles',
    totalMarks: 10,
    durationMinutes: 25,
    negativeMarkingRule: {
      enabled: false,
      deductionPerWrong: 0,
      description: 'Standard NEB Management board grading with zero negative deduction.',
    },
    randomizeQuestions: false,
    randomizeOptions: false,
    resultVisibility: 'immediate',
    attemptLimit: 5,
    instructions:
      'Evaluate share forfeiture entries, macroeconomic indicators, and corporate governance across 5 NEB Management items.',
    sections: [
      { title: 'Corporate Accounting & Finance', subjectName: 'Accountancy', description: 'Share Capital & Ratios', sortOrder: 1 },
      { title: 'Economics & Business Studies', subjectName: 'Economics', description: 'Fiscal & Monetary Policy', sortOrder: 2 },
    ],
  },
  {
    slug: 'bsc-csit-mock-1',
    title: 'TU IOST B.Sc. CSIT National Entrance Mock Test',
    category: 'it_entrance',
    examinationSlug: 'bsc-csit',
    academicLevel: 'Bachelor Entrance',
    subjectScope: 'Mathematics, Physics, Chemistry, English, Computer Science',
    chapterScope: 'Calculus, Optics, Logic Gates, DBMS, Grammar',
    totalMarks: 6,
    durationMinutes: 20,
    negativeMarkingRule: {
      enabled: false,
      deductionPerWrong: 0,
      description: 'TU IOST B.Sc. CSIT official rule: 1 mark per correct MCQ, NO negative marking.',
    },
    randomizeQuestions: true,
    randomizeOptions: true,
    resultVisibility: 'immediate',
    attemptLimit: 5,
    instructions:
      'Follows TU IOST B.Sc. CSIT entrance pattern (100 marks / 2 hrs scale, zero negative marking). Questions & options are randomized per attempt.',
    sections: [
      { title: 'Mathematics & Computer Science', subjectName: 'Mathematics', description: 'Integrals, Matrices, DBMS & Binary Logic', sortOrder: 1 },
      { title: 'Physics, Chemistry & English', subjectName: 'Physics', description: 'Optics, Bonding & Grammar', sortOrder: 2 },
    ],
  },
  {
    slug: 'cmat-mock-1',
    title: 'TU FOM CMAT Management Entrance Simulation Test',
    category: 'management_entrance',
    examinationSlug: 'cmat',
    academicLevel: 'Bachelor Entrance',
    subjectScope: 'Verbal Ability, Quantitative Ability, Logical Reasoning, General Awareness',
    chapterScope: 'Percentages, Syllogisms, NRB Policy, Comprehension',
    totalMarks: 5,
    durationMinutes: 15,
    negativeMarkingRule: {
      enabled: false,
      deductionPerWrong: 0,
      description: 'TU FOM CMAT official rule: 1 mark per question, no negative marking.',
    },
    randomizeQuestions: true,
    randomizeOptions: false,
    resultVisibility: 'immediate',
    attemptLimit: 5,
    instructions:
      'Timed CMAT aptitude mock covering Verbal Ability, Quantitative Aptitude, Logical Reasoning, and Nepal Business General Awareness.',
    sections: [
      { title: 'Quantitative & Logical Aptitude', subjectName: 'Quantitative Ability', description: 'Arithmetic & Reasoning', sortOrder: 1 },
      { title: 'Verbal & General Awareness', subjectName: 'Verbal Ability', description: 'Comprehension & Nepal Economy', sortOrder: 2 },
    ],
  },
  {
    slug: 'ioe-be-mock-1',
    title: 'TU IOE Engineering Entrance (CBT) Mock Examination',
    category: 'engineering_entrance',
    examinationSlug: 'ioe',
    academicLevel: 'Bachelor Entrance',
    subjectScope: 'Mathematics, Physics, Chemistry, English',
    chapterScope: 'Rotational Dynamics, Differential Equations, Kinetics, Aptitude',
    totalMarks: 8,
    durationMinutes: 20,
    negativeMarkingRule: {
      enabled: true,
      deductionPerWrong: 0.2,
      description: 'IOE CBT negative marking rule: 10% deduction per wrong answer (-0.1 on 1-mark Qs, -0.2 on 2-mark Qs).',
    },
    randomizeQuestions: true,
    randomizeOptions: true,
    resultVisibility: 'immediate',
    attemptLimit: 5,
    instructions:
      'IOE CBT simulation with strict 10% negative marking on wrong answers. Unattempted items incur 0 penalty.',
    sections: [
      { title: 'Engineering Physics & Mathematics (2-Mark Section)', subjectName: 'Physics', description: 'Analytical & Numerical CBT Items', sortOrder: 1 },
      { title: 'Chemistry & Engineering English', subjectName: 'Chemistry', description: 'Equilibrium & Technical English', sortOrder: 2 },
    ],
  },
  {
    slug: 'mecee-bl-mock-1',
    title: 'MEC MECEE-BL Medical Common Entrance Mock Examination',
    category: 'medical_entrance',
    examinationSlug: 'mecee-bl',
    academicLevel: 'Bachelor Entrance',
    subjectScope: 'Zoology, Botany, Chemistry, Physics, MAT',
    chapterScope: 'Human Physiology, Genetics, Organic Mechanisms, Optics, MAT',
    totalMarks: 6,
    durationMinutes: 20,
    negativeMarkingRule: {
      enabled: true,
      deductionPerWrong: 0.25,
      description: 'MEC official rule: +1 for each correct MCQ and −0.25 negative marking for each incorrect response.',
    },
    randomizeQuestions: true,
    randomizeOptions: false,
    resultVisibility: 'immediate',
    attemptLimit: 5,
    instructions:
      'Medical Education Commission MECEE-BL simulation enforcing −0.25 negative marks per wrong answer across Zoology, Botany, Chemistry, Physics, and MAT.',
    sections: [
      { title: 'Zoology & Botany', subjectName: 'Biology', description: 'Physiology, Vascular Anatomy & Genetics', sortOrder: 1 },
      { title: 'Chemistry, Physics & MAT', subjectName: 'Chemistry', description: 'Buffers, Gravitation & Mental Agility', sortOrder: 2 },
    ],
  },
];

const QUESTIONS_SEED: SeedQuestionSpec[] = [
  // ================= SEE Class 10 (6 Published Questions across diverse types) =================
  {
    questionUid: 'Q-SEE-SET-001',
    academicLevel: 'SEE (Class 10)',
    examination: 'SEE',
    subjectName: 'Mathematics',
    chapterName: 'Sets',
    topicName: 'Two-Set Cardinality',
    questionType: 'diagram_based',
    difficulty: 'medium',
    questionContent: {
      prompt:
        'Using the Venn diagram below of 120 SEE students surveyed on Mathematics (M) and Science (S), determine how many students liked neither subject.',
      diagramLabel: 'Two-Set Venn Survey (U = 120)',
      diagramSvg:
        '<svg viewBox="0 0 320 150" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="308" height="138" rx="6" fill="#f8fafc" stroke="#94a3b8"/><text x="16" y="24" font-size="11" fill="#0f172a">n(U) = 120</text><circle cx="128" cy="80" r="46" fill="#fee2e2" fill-opacity="0.7" stroke="#b91c1c"/><circle cx="192" cy="80" r="46" fill="#dbeafe" fill-opacity="0.7" stroke="#1d4ed8"/><text x="95" y="83" font-size="11" fill="#7f1d1d">45</text><text x="153" y="83" font-size="11" font-weight="bold" fill="#0f172a">30</text><text x="205" y="83" font-size="11" fill="#1e3a8a">35</text><text x="242" y="132" font-size="10" fill="#475569">Outside = ?</text></svg>',
    },
    options: [
      { optionKey: 'A', optionText: '10', optionTextNe: '१०', isCorrect: true },
      { optionKey: 'B', optionText: '15', optionTextNe: '१५', isCorrect: false },
      { optionKey: 'C', optionText: '20', optionTextNe: '२०', isCorrect: false },
      { optionKey: 'D', optionText: '25', optionTextNe: '२५', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['A'] },
    explanation: 'n(M ∪ S) = 45 + 30 + 35 = 110. Therefore outside complement n((M ∪ S)′) = 120 − 110 = 10.',
    marks: 2,
    negativeMarks: 0,
    sourceCode: 'SRC-CDC-SEE',
    sourceLabel: 'CDC SEE Specification Model',
    status: 'Published',
    tags: ['see', 'sets', 'venn-diagram'],
    examSlugs: [{ slug: 'see-compulsory-mock-1', sectionSubject: 'Mathematics' }],
  },
  {
    questionUid: 'Q-SEE-MTH-002',
    academicLevel: 'SEE (Class 10)',
    examination: 'SEE',
    subjectName: 'Mathematics',
    chapterName: 'Trigonometry: Heights and Distances',
    topicName: 'Angles of Elevation',
    questionType: 'numerical',
    difficulty: 'medium',
    questionContent: {
      prompt:
        'An observer spots the top of a Dharahara-height tower 40√3 m away at an angle of elevation of 30°. Calculate the tower height above eye level (in meters).',
      unitHint: 'meters (numeric value only)',
    },
    options: [],
    correctAnswer: { numericValue: 40, tolerance: 0.1 },
    explanation: 'tan 30° = h / (40√3) ⇒ 1/√3 = h / (40√3) ⇒ h = 40 m.',
    marks: 2,
    negativeMarks: 0,
    sourceCode: 'SRC-CDC-SEE',
    sourceLabel: 'SEE Bagmati 2080',
    status: 'Published',
    tags: ['see', 'trigonometry', 'numerical'],
    examSlugs: [{ slug: 'see-compulsory-mock-1', sectionSubject: 'Mathematics' }],
  },
  {
    questionUid: 'Q-SEE-MTH-003',
    academicLevel: 'SEE (Class 10)',
    examination: 'SEE',
    subjectName: 'Mathematics',
    chapterName: 'Compound Interest',
    topicName: 'Annual Compounding',
    questionType: 'true_false',
    difficulty: 'easy',
    questionContent: {
      prompt:
        'True or False: For the same principal, positive interest rate, and time period greater than 1 year, semi-annual compound interest is always strictly greater than annual compound interest.',
    },
    options: [],
    correctAnswer: { booleanValue: true },
    explanation:
      'Compounding twice a year earns interest on the mid-year interest, making (1 + R/200)²ᵀ > (1 + R/100)ᵀ for R > 0 and T ≥ 1.',
    marks: 1,
    negativeMarks: 0,
    sourceCode: 'SRC-CDC-SEE',
    sourceLabel: 'CDC SEE Model Grid',
    status: 'Published',
    tags: ['see', 'compound-interest', 'true-false'],
    examSlugs: [{ slug: 'see-compulsory-mock-1', sectionSubject: 'Mathematics' }],
  },
  {
    questionUid: 'Q-SEE-SCI-004',
    academicLevel: 'SEE (Class 10)',
    examination: 'SEE',
    subjectName: 'Science & Technology',
    chapterName: 'Force, Gravitation, and Motion',
    topicName: 'Variation of Gravity (g)',
    questionType: 'assertion_reason',
    difficulty: 'medium',
    questionContent: {
      prompt: 'Evaluate the Assertion and Reason regarding acceleration due to gravity in Nepal:',
      assertion: 'The weight of a 10 kg object is slightly less at Everest Base Camp than in Birgunj (Terai).',
      reason: 'Acceleration due to gravity g decreases inversely with the square of distance from Earth’s center: g ∝ 1/(R + h)².',
    },
    options: [
      { optionKey: 'A', optionText: 'Both Assertion and Reason are true, and Reason correctly explains Assertion.', isCorrect: true },
      { optionKey: 'B', optionText: 'Both Assertion and Reason are true, but Reason does NOT explain Assertion.', isCorrect: false },
      { optionKey: 'C', optionText: 'Assertion is true, but Reason is false.', isCorrect: false },
      { optionKey: 'D', optionText: 'Assertion is false, but Reason is true.', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['A'] },
    explanation: 'Higher altitude h in the Himalayas increases distance R + h from Earth’s center, lowering g and therefore W = mg.',
    marks: 2,
    negativeMarks: 0,
    sourceCode: 'SRC-CDC-SEE',
    sourceLabel: 'CDC SEE Science 2081',
    status: 'Published',
    tags: ['see', 'gravitation', 'assertion-reason'],
    examSlugs: [{ slug: 'see-compulsory-mock-1', sectionSubject: 'Science & Technology' }],
  },
  {
    questionUid: 'Q-SEE-SCI-005',
    academicLevel: 'SEE (Class 10)',
    examination: 'SEE',
    subjectName: 'Science & Technology',
    chapterName: 'Pressure & Archimedes Principle',
    topicName: 'Hydraulic Law',
    questionType: 'short_answer',
    difficulty: 'medium',
    questionContent: {
      prompt: 'State Pascal’s law of liquid pressure and name one practical hydraulic device used in workshops.',
    },
    options: [],
    correctAnswer: { keywords: ['enclosed', 'equally', 'hydraulic'] },
    explanation:
      'Pascal’s law states that pressure applied to an enclosed incompressible fluid is transmitted equally undiminished in all directions (applied in hydraulic brakes and hydraulic lifts).',
    marks: 3,
    negativeMarks: 0,
    sourceCode: 'SRC-CDC-SEE',
    sourceLabel: 'CDC SEE 2080',
    status: 'Published',
    tags: ['see', 'pressure', 'short-answer'],
    examSlugs: [{ slug: 'see-compulsory-mock-1', sectionSubject: 'Science & Technology' }],
  },
  {
    questionUid: 'Q-SEE-ENG-006',
    academicLevel: 'SEE (Class 10)',
    examination: 'SEE',
    subjectName: 'English',
    chapterName: 'Critical Reading & Textual Interpretation',
    topicName: 'Grammar Transformations',
    questionType: 'single_mcq',
    difficulty: 'easy',
    questionContent: {
      prompt: 'Choose the grammatically accurate question tag: "Everyone attended the morning assembly, _____?"',
    },
    options: [
      { optionKey: 'A', optionText: "didn't they", isCorrect: true },
      { optionKey: 'B', optionText: "wasn't he", isCorrect: false },
      { optionKey: 'C', optionText: 'did they', isCorrect: false },
      { optionKey: 'D', optionText: "don't they", isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['A'] },
    explanation: 'Indefinite pronouns like "everyone" take the plural pronoun "they" and past simple auxiliary "didn’t" for affirmative statements.',
    marks: 2,
    negativeMarks: 0,
    sourceCode: 'SRC-CDC-SEE',
    sourceLabel: 'CDC SEE English Grid',
    status: 'Published',
    tags: ['see', 'english', 'grammar'],
    examSlugs: [{ slug: 'see-compulsory-mock-1', sectionSubject: 'Science & Technology' }],
  },

  // ================= Class 12 Science (5 Published Questions) =================
  {
    questionUid: 'Q-NEB12-PHY-001',
    academicLevel: 'Class 12 (NEB)',
    examination: 'NEB Class 12',
    subjectName: 'Physics',
    chapterName: 'Rotational Dynamics',
    topicName: 'Moment of Inertia',
    questionType: 'multiple_mcq',
    difficulty: 'hard',
    questionContent: {
      prompt: 'Select ALL correct statements regarding a solid sphere and a hollow ring of equal mass M and radius R rolling down an incline without slipping:',
    },
    options: [
      { optionKey: 'A', optionText: 'The solid sphere has smaller moment of inertia (2/5 MR²) than the ring (MR²).', isCorrect: true },
      { optionKey: 'B', optionText: 'The solid sphere reaches the bottom of the incline first.', isCorrect: true },
      { optionKey: 'C', optionText: 'Both have identical translational kinetic energy at the bottom.', isCorrect: false },
      { optionKey: 'D', optionText: 'Friction does zero net work during pure rolling.', isCorrect: true },
    ],
    correctAnswer: { optionKeys: ['A', 'B', 'D'] },
    explanation:
      'Lower k²/R² gives the solid sphere higher linear acceleration a = g sinθ / (1 + I/MR²), and static friction at the instantaneous point of contact does zero work.',
    marks: 3,
    negativeMarks: 0,
    sourceCode: 'SRC-NEB-12',
    sourceLabel: 'NEB Class 12 Physics Model',
    status: 'Published',
    tags: ['class-12', 'physics', 'multiple-mcq'],
    examSlugs: [{ slug: 'class-12-science-mock-1', sectionSubject: 'Physics' }],
  },
  {
    questionUid: 'Q-NEB12-CHM-002',
    academicLevel: 'Class 12 (NEB)',
    examination: 'NEB Class 12',
    subjectName: 'Chemistry',
    chapterName: 'Chemical Kinetics',
    topicName: 'First-Order Half-Life',
    questionType: 'numerical',
    difficulty: 'medium',
    questionContent: {
      prompt: 'A first-order reaction has a rate constant k = 0.0693 min⁻¹. Calculate its half-life (t₁/₂) in minutes.',
      unitHint: 'minutes',
    },
    options: [],
    correctAnswer: { numericValue: 10, tolerance: 0.05 },
    explanation: 'For a first-order reaction, t₁/₂ = 0.693 / k = 0.693 / 0.0693 = 10 minutes.',
    marks: 2,
    negativeMarks: 0,
    sourceCode: 'SRC-NEB-12',
    sourceLabel: 'NEB 2081 Chemistry',
    status: 'Published',
    tags: ['class-12', 'chemistry', 'kinetics'],
    examSlugs: [{ slug: 'class-12-science-mock-1', sectionSubject: 'Chemistry' }],
  },
  {
    questionUid: 'Q-NEB12-BIO-003',
    academicLevel: 'Class 12 (NEB)',
    examination: 'NEB Class 12',
    subjectName: 'Biology',
    chapterName: 'Plant Anatomy & Physiology',
    topicName: 'Vascular Tissue Functions',
    questionType: 'matching',
    difficulty: 'medium',
    questionContent: {
      prompt: 'Match each plant/physiological structure (1–3) with its primary functional role (A–C):',
      matchingLeft: ['1. Xylem vessels', '2. Phloem sieve tubes', '3. Guard cells'],
      matchingRight: ['A. Translocation of sucrose', 'B. Stomatal aperture regulation', 'C. Unidirectional water ascent'],
    },
    options: [],
    correctAnswer: { matchingMap: { '1': 'C', '2': 'A', '3': 'B' } },
    explanation: 'Xylem conducts water & minerals upward (C), phloem translocates sucrose bidirectionally (A), and guard cells regulate transpiration via stomata (B).',
    marks: 3,
    negativeMarks: 0,
    sourceCode: 'SRC-NEB-12',
    sourceLabel: 'NEB Class 12 Botany',
    status: 'Published',
    tags: ['class-12', 'biology', 'matching'],
    examSlugs: [{ slug: 'class-12-science-mock-1', sectionSubject: 'Chemistry' }],
  },
  {
    questionUid: 'Q-NEB12-MAT-004',
    academicLevel: 'Class 12 (NEB)',
    examination: 'NEB Class 12',
    subjectName: 'Mathematics',
    chapterName: 'Antiderivatives and Differential Equations',
    topicName: 'Definite Integrals',
    questionType: 'case_based',
    difficulty: 'medium',
    questionContent: {
      passage:
        'Case Study: An engineering lab models electrical current decay i(t) = 4e^(−2t) A over t ∈ [0, ∞) seconds using first-order differential equations and definite integrals.',
      prompt: 'What is the total electrical charge Q = ∫₀^∞ 4e^(−2t) dt passing through the circuit (in Coulombs)?',
    },
    options: [
      { optionKey: 'A', optionText: '1 C', isCorrect: false },
      { optionKey: 'B', optionText: '2 C', isCorrect: true },
      { optionKey: 'C', optionText: '4 C', isCorrect: false },
      { optionKey: 'D', optionText: '8 C', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['B'] },
    explanation: '∫₀^∞ 4e^(−2t) dt = [−2e^(−2t)]₀^∞ = 0 − (−2) = 2 Coulombs.',
    marks: 2,
    negativeMarks: 0,
    sourceCode: 'SRC-NEB-12',
    sourceLabel: 'NEB Class 12 Math Case Study',
    status: 'Published',
    tags: ['class-12', 'mathematics', 'case-based'],
    examSlugs: [{ slug: 'class-12-science-mock-1', sectionSubject: 'Physics' }],
  },
  {
    questionUid: 'Q-NEB12-PHY-005',
    academicLevel: 'Class 12 (NEB)',
    examination: 'NEB Class 12',
    subjectName: 'Physics',
    chapterName: 'Wave Optics & Interference',
    topicName: 'Young Double Slit',
    questionType: 'long_answer',
    difficulty: 'hard',
    questionContent: {
      prompt:
        'Explain why two independent torchlights cannot produce a sustained interference pattern, and write the formula for fringe width β in Young’s double-slit experiment.',
    },
    options: [],
    correctAnswer: { keywords: ['coherent', 'phase', 'wavelength'] },
    explanation:
      'Independent sources are incoherent because their phase difference fluctuates millions of times per second. Sustained interference requires coherent sources with constant phase difference and identical frequency, yielding β = λD/d.',
    marks: 2,
    negativeMarks: 0,
    sourceCode: 'SRC-NEB-12',
    sourceLabel: 'NEB Class 12 Physics',
    status: 'Published',
    tags: ['class-12', 'physics', 'wave-optics', 'long-answer'],
    examSlugs: [{ slug: 'class-12-science-mock-1', sectionSubject: 'Physics' }],
  },

  // ================= Class 12 Management (5 Published Questions) =================
  {
    questionUid: 'Q-NEB12-ACC-001',
    academicLevel: 'Class 12 (NEB)',
    examination: 'NEB Class 12',
    subjectName: 'Accountancy',
    chapterName: 'Accounting for Share Capital',
    topicName: 'Forfeiture of Shares',
    questionType: 'single_mcq',
    difficulty: 'medium',
    questionContent: {
      prompt:
        'A Nepal company forfeited 200 shares of Rs. 100 each on which Rs. 70 was paid, due to non-payment of Rs. 30 final call. What amount is credited to Share Forfeiture Account?',
    },
    options: [
      { optionKey: 'A', optionText: 'Rs. 6,000', isCorrect: false },
      { optionKey: 'B', optionText: 'Rs. 14,000', isCorrect: true },
      { optionKey: 'C', optionText: 'Rs. 20,000', isCorrect: false },
      { optionKey: 'D', optionText: 'Rs. 10,000', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['B'] },
    explanation: 'Share Forfeiture Account is credited with the actual paid-up amount received: 200 × Rs. 70 = Rs. 14,000.',
    marks: 2,
    negativeMarks: 0,
    sourceCode: 'SRC-NEB-12',
    sourceLabel: 'NEB Class 12 Accountancy 2081',
    status: 'Published',
    tags: ['class-12', 'accountancy', 'share-capital'],
    examSlugs: [{ slug: 'class-12-management-mock-1', sectionSubject: 'Accountancy' }],
  },
  {
    questionUid: 'Q-NEB12-ECO-002',
    academicLevel: 'Class 12 (NEB)',
    examination: 'NEB Class 12',
    subjectName: 'Economics',
    chapterName: 'Macroeconomic Indicators',
    topicName: 'GDP vs GNP',
    questionType: 'single_mcq',
    difficulty: 'easy',
    questionContent: {
      prompt: 'When remittance inflows increase Net Factor Income from Abroad (NFIA) above zero in Nepal, which identity holds?',
    },
    options: [
      { optionKey: 'A', optionText: 'GNP = GDP + NFIA (so GNP > GDP)', isCorrect: true },
      { optionKey: 'B', optionText: 'GNP = GDP − NFIA', isCorrect: false },
      { optionKey: 'C', optionText: 'NNP = GDP + Depreciation', isCorrect: false },
      { optionKey: 'D', optionText: 'GDP = GNP − Taxes', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['A'] },
    explanation: 'Gross National Product equals Gross Domestic Product plus Net Factor Income from Abroad (GNP = GDP + NFIA).',
    marks: 2,
    negativeMarks: 0,
    sourceCode: 'SRC-NEB-12',
    sourceLabel: 'NEB Economics Board',
    status: 'Published',
    tags: ['class-12', 'economics', 'macroeconomics'],
    examSlugs: [{ slug: 'class-12-management-mock-1', sectionSubject: 'Economics' }],
  },
  {
    questionUid: 'Q-NEB12-ACC-003',
    academicLevel: 'Class 12 (NEB)',
    examination: 'NEB Class 12',
    subjectName: 'Accountancy',
    chapterName: 'Financial Ratios',
    topicName: 'Current Ratio',
    questionType: 'numerical',
    difficulty: 'easy',
    questionContent: {
      prompt: 'A Pokhara trading firm reports Current Assets of Rs. 4,50,000 and Current Liabilities of Rs. 1,50,000. Compute its Current Ratio.',
      unitHint: 'ratio value (e.g. 2.5)',
    },
    options: [],
    correctAnswer: { numericValue: 3, tolerance: 0.01 },
    explanation: 'Current Ratio = Current Assets / Current Liabilities = 4,50,000 / 1,50,000 = 3.0.',
    marks: 2,
    negativeMarks: 0,
    sourceCode: 'SRC-NEB-12',
    sourceLabel: 'NEB Management Model',
    status: 'Published',
    tags: ['class-12', 'accountancy', 'ratios'],
    examSlugs: [{ slug: 'class-12-management-mock-1', sectionSubject: 'Accountancy' }],
  },
  {
    questionUid: 'Q-NEB12-BUS-004',
    academicLevel: 'Class 12 (NEB)',
    examination: 'NEB Class 12',
    subjectName: 'Business Studies',
    chapterName: 'Principles of Management',
    topicName: 'Fayol 14 Principles',
    questionType: 'true_false',
    difficulty: 'easy',
    questionContent: {
      prompt:
        'True or False: According to Henri Fayol’s principle of Unity of Command, each employee should receive orders from only one immediate superior.',
    },
    options: [],
    correctAnswer: { booleanValue: true },
    explanation: 'Unity of Command prevents conflicting instructions and clarifies accountability by giving each subordinate one direct supervisor.',
    marks: 2,
    negativeMarks: 0,
    sourceCode: 'SRC-NEB-12',
    sourceLabel: 'NEB Business Studies',
    status: 'Published',
    tags: ['class-12', 'business-studies', 'fayol'],
    examSlugs: [{ slug: 'class-12-management-mock-1', sectionSubject: 'Economics' }],
  },
  {
    questionUid: 'Q-NEB12-ECO-005',
    academicLevel: 'Class 12 (NEB)',
    examination: 'NEB Class 12',
    subjectName: 'Economics',
    chapterName: 'Public Finance',
    topicName: 'Fiscal Deficit',
    questionType: 'short_answer',
    difficulty: 'medium',
    questionContent: {
      prompt: 'Define Fiscal Policy and name its two primary instruments used by the Ministry of Finance.',
    },
    options: [],
    correctAnswer: { keywords: ['taxation', 'expenditure'] },
    explanation: 'Fiscal policy uses government taxation and public expenditure (including public debt) to stabilize output, employment, and inflation.',
    marks: 2,
    negativeMarks: 0,
    sourceCode: 'SRC-NEB-12',
    sourceLabel: 'NEB Economics',
    status: 'Published',
    tags: ['class-12', 'economics', 'fiscal-policy'],
    examSlugs: [{ slug: 'class-12-management-mock-1', sectionSubject: 'Economics' }],
  },

  // ================= BSc CSIT (6 Published Questions, 0 Negative Marking) =================
  {
    questionUid: 'Q-CSIT-CSC-001',
    academicLevel: 'Bachelor Entrance',
    examination: 'BSc CSIT',
    subjectName: 'Computer Science',
    chapterName: 'Database Normalization',
    topicName: '3NF & Transitive Dependency',
    questionType: 'single_mcq',
    difficulty: 'medium',
    questionContent: {
      prompt: 'Which database normal form specifically eliminates transitive functional dependencies among non-prime attributes?',
    },
    options: [
      { optionKey: 'A', optionText: 'First Normal Form (1NF)', isCorrect: false },
      { optionKey: 'B', optionText: 'Second Normal Form (2NF)', isCorrect: false },
      { optionKey: 'C', optionText: 'Third Normal Form (3NF)', isCorrect: true },
      { optionKey: 'D', optionText: 'Zero Normal Form (0NF)', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['C'] },
    explanation: '2NF removes partial dependencies; 3NF removes transitive dependencies where a non-key attribute determines another non-key attribute.',
    marks: 1,
    negativeMarks: 0,
    sourceCode: 'SRC-TU-CSIT',
    sourceLabel: 'TU IOST B.Sc. CSIT 2080',
    status: 'Published',
    tags: ['bsc-csit', 'dbms', 'normalization'],
    examSlugs: [{ slug: 'bsc-csit-mock-1', sectionSubject: 'Mathematics' }],
  },
  {
    questionUid: 'Q-CSIT-MAT-002',
    academicLevel: 'Bachelor Entrance',
    examination: 'BSc CSIT',
    subjectName: 'Mathematics',
    chapterName: 'Limits & Continuity',
    topicName: 'Standard Trigonometric Limits',
    questionType: 'single_mcq',
    difficulty: 'easy',
    questionContent: {
      prompt: 'Evaluate the limit: lim(x → 0) [sin(5x) / x]',
    },
    options: [
      { optionKey: 'A', optionText: '1/5', isCorrect: false },
      { optionKey: 'B', optionText: '1', isCorrect: false },
      { optionKey: 'C', optionText: '5', isCorrect: true },
      { optionKey: 'D', optionText: '0', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['C'] },
    explanation: 'Multiply and divide by 5: 5 · lim(x → 0) [sin(5x)/(5x)] = 5 × 1 = 5.',
    marks: 1,
    negativeMarks: 0,
    sourceCode: 'SRC-TU-CSIT',
    sourceLabel: 'TU IOST CSIT 2081',
    status: 'Published',
    tags: ['bsc-csit', 'calculus', 'limits'],
    examSlugs: [{ slug: 'bsc-csit-mock-1', sectionSubject: 'Mathematics' }],
  },
  {
    questionUid: 'Q-CSIT-CSC-003',
    academicLevel: 'Bachelor Entrance',
    examination: 'BSc CSIT',
    subjectName: 'Computer Science',
    chapterName: 'Digital Logic',
    topicName: 'NAND Universal Gate',
    questionType: 'single_mcq',
    difficulty: 'medium',
    questionContent: {
      prompt: 'What is the decimal equivalent of the binary integer (101101)₂?',
    },
    options: [
      { optionKey: 'A', optionText: '43', isCorrect: false },
      { optionKey: 'B', optionText: '45', isCorrect: true },
      { optionKey: 'C', optionText: '47', isCorrect: false },
      { optionKey: 'D', optionText: '53', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['B'] },
    explanation: '32 + 0 + 8 + 4 + 0 + 1 = 45.',
    marks: 1,
    negativeMarks: 0,
    sourceCode: 'SRC-TU-CSIT',
    sourceLabel: 'TU IOST CSIT Model',
    status: 'Published',
    tags: ['bsc-csit', 'binary', 'computer'],
    examSlugs: [{ slug: 'bsc-csit-mock-1', sectionSubject: 'Mathematics' }],
  },
  {
    questionUid: 'Q-CSIT-PHY-004',
    academicLevel: 'Bachelor Entrance',
    examination: 'BSc CSIT',
    subjectName: 'Physics',
    chapterName: 'Semiconductors & Logic',
    topicName: 'Universal Logic Gates',
    questionType: 'single_mcq',
    difficulty: 'easy',
    questionContent: {
      prompt: 'Which pair of logic gates are known as universal gates because any Boolean function can be implemented using them alone?',
    },
    options: [
      { optionKey: 'A', optionText: 'AND and OR', isCorrect: false },
      { optionKey: 'B', optionText: 'NAND and NOR', isCorrect: true },
      { optionKey: 'C', optionText: 'XOR and XNOR', isCorrect: false },
      { optionKey: 'D', optionText: 'NOT and AND', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['B'] },
    explanation: 'NAND and NOR gates are functionally complete universal gates.',
    marks: 1,
    negativeMarks: 0,
    sourceCode: 'SRC-TU-CSIT',
    sourceLabel: 'TU IOST CSIT 2079',
    status: 'Published',
    tags: ['bsc-csit', 'physics', 'logic-gates'],
    examSlugs: [{ slug: 'bsc-csit-mock-1', sectionSubject: 'Physics' }],
  },
  {
    questionUid: 'Q-CSIT-CHM-005',
    academicLevel: 'Bachelor Entrance',
    examination: 'BSc CSIT',
    subjectName: 'Chemistry',
    chapterName: 'Atomic Structure',
    topicName: 'Orbital Hybridization',
    questionType: 'single_mcq',
    difficulty: 'easy',
    questionContent: {
      prompt: 'What is the hybridization state of the central carbon atom in methane (CH₄)?',
    },
    options: [
      { optionKey: 'A', optionText: 'sp', isCorrect: false },
      { optionKey: 'B', optionText: 'sp²', isCorrect: false },
      { optionKey: 'C', optionText: 'sp³', isCorrect: true },
      { optionKey: 'D', optionText: 'dsp²', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['C'] },
    explanation: 'Methane has 4 sigma bond pairs and 0 lone pairs around carbon, giving tetrahedral sp³ hybridization (109.5°).',
    marks: 1,
    negativeMarks: 0,
    sourceCode: 'SRC-TU-CSIT',
    sourceLabel: 'TU IOST CSIT 2080',
    status: 'Published',
    tags: ['bsc-csit', 'chemistry', 'hybridization'],
    examSlugs: [{ slug: 'bsc-csit-mock-1', sectionSubject: 'Physics' }],
  },
  {
    questionUid: 'Q-CSIT-ENG-006',
    academicLevel: 'Bachelor Entrance',
    examination: 'BSc CSIT',
    subjectName: 'English',
    chapterName: 'Vocabulary & Idioms',
    topicName: 'Prepositions',
    questionType: 'single_mcq',
    difficulty: 'easy',
    questionContent: {
      prompt: 'Choose the correct preposition: "The new campus software is compatible _____ all modern browsers."',
    },
    options: [
      { optionKey: 'A', optionText: 'to', isCorrect: false },
      { optionKey: 'B', optionText: 'with', isCorrect: true },
      { optionKey: 'C', optionText: 'for', isCorrect: false },
      { optionKey: 'D', optionText: 'from', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['B'] },
    explanation: 'The standard collocation in English is "compatible with".',
    marks: 1,
    negativeMarks: 0,
    sourceCode: 'SRC-TU-CSIT',
    sourceLabel: 'TU IOST CSIT English',
    status: 'Published',
    tags: ['bsc-csit', 'english', 'prepositions'],
    examSlugs: [{ slug: 'bsc-csit-mock-1', sectionSubject: 'Physics' }],
  },

  // ================= CMAT (5 Published Questions, 0 Negative Marking) =================
  {
    questionUid: 'Q-CMAT-QNT-001',
    academicLevel: 'Bachelor Entrance',
    examination: 'CMAT',
    subjectName: 'Quantitative Ability',
    chapterName: 'Profit, Loss & Percentage',
    topicName: 'Successive Discounts',
    questionType: 'single_mcq',
    difficulty: 'medium',
    questionContent: {
      prompt: 'A Kathmandu electronics shop offers two successive discounts of 20% and 10%. What is the single equivalent discount?',
    },
    options: [
      { optionKey: 'A', optionText: '28%', isCorrect: true },
      { optionKey: 'B', optionText: '30%', isCorrect: false },
      { optionKey: 'C', optionText: '32%', isCorrect: false },
      { optionKey: 'D', optionText: '26%', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['A'] },
    explanation: 'Equivalent discount = 20 + 10 − (20 × 10)/100 = 30 − 2 = 28%.',
    marks: 1,
    negativeMarks: 0,
    sourceCode: 'SRC-TU-CMAT',
    sourceLabel: 'TU FOM CMAT 2080',
    status: 'Published',
    tags: ['cmat', 'quantitative', 'percentage'],
    examSlugs: [{ slug: 'cmat-mock-1', sectionSubject: 'Quantitative Ability' }],
  },
  {
    questionUid: 'Q-CMAT-LOG-002',
    academicLevel: 'Bachelor Entrance',
    examination: 'CMAT',
    subjectName: 'Logical Reasoning',
    chapterName: 'Number Series',
    topicName: 'Quadratic Differences',
    questionType: 'single_mcq',
    difficulty: 'medium',
    questionContent: {
      prompt: 'Find the next number in the CMAT series: 3, 7, 13, 21, 31, _____',
    },
    options: [
      { optionKey: 'A', optionText: '41', isCorrect: false },
      { optionKey: 'B', optionText: '43', isCorrect: true },
      { optionKey: 'C', optionText: '45', isCorrect: false },
      { optionKey: 'D', optionText: '39', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['B'] },
    explanation: 'Successive differences increase by 2: +4, +6, +8, +10, +12 ⇒ 31 + 12 = 43.',
    marks: 1,
    negativeMarks: 0,
    sourceCode: 'SRC-TU-CMAT',
    sourceLabel: 'TU FOM CMAT 2081',
    status: 'Published',
    tags: ['cmat', 'logical-reasoning', 'series'],
    examSlugs: [{ slug: 'cmat-mock-1', sectionSubject: 'Quantitative Ability' }],
  },
  {
    questionUid: 'Q-CMAT-QNT-003',
    academicLevel: 'Bachelor Entrance',
    examination: 'CMAT',
    subjectName: 'Quantitative Ability',
    chapterName: 'Time & Work',
    topicName: 'Combined Work Rate',
    questionType: 'single_mcq',
    difficulty: 'medium',
    questionContent: {
      prompt: 'Sita completes a project in 12 days and Ram completes it in 24 days. Working together, how many days will they take?',
    },
    options: [
      { optionKey: 'A', optionText: '6 days', isCorrect: false },
      { optionKey: 'B', optionText: '8 days', isCorrect: true },
      { optionKey: 'C', optionText: '9 days', isCorrect: false },
      { optionKey: 'D', optionText: '18 days', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['B'] },
    explanation: 'Combined rate = 1/12 + 1/24 = 3/24 = 1/8 per day ⇒ 8 days.',
    marks: 1,
    negativeMarks: 0,
    sourceCode: 'SRC-TU-CMAT',
    sourceLabel: 'TU FOM CMAT Practice',
    status: 'Published',
    tags: ['cmat', 'quantitative', 'time-work'],
    examSlugs: [{ slug: 'cmat-mock-1', sectionSubject: 'Quantitative Ability' }],
  },
  {
    questionUid: 'Q-CMAT-VRB-004',
    academicLevel: 'Bachelor Entrance',
    examination: 'CMAT',
    subjectName: 'Verbal Ability',
    chapterName: 'Vocabulary',
    topicName: 'Synonyms',
    questionType: 'single_mcq',
    difficulty: 'easy',
    questionContent: {
      prompt: 'Select the closest synonym for "PRAGMATIC":',
    },
    options: [
      { optionKey: 'A', optionText: 'Practical', isCorrect: true },
      { optionKey: 'B', optionText: 'Idealistic', isCorrect: false },
      { optionKey: 'C', optionText: 'Negligent', isCorrect: false },
      { optionKey: 'D', optionText: 'Fictional', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['A'] },
    explanation: 'Pragmatic means dealing with problems sensibly and realistically in a practical manner.',
    marks: 1,
    negativeMarks: 0,
    sourceCode: 'SRC-TU-CMAT',
    sourceLabel: 'TU FOM CMAT 2080',
    status: 'Published',
    tags: ['cmat', 'verbal', 'synonyms'],
    examSlugs: [{ slug: 'cmat-mock-1', sectionSubject: 'Verbal Ability' }],
  },
  {
    questionUid: 'Q-CMAT-GK-005',
    academicLevel: 'Bachelor Entrance',
    examination: 'CMAT',
    subjectName: 'General Awareness',
    chapterName: 'Nepal Banking & Economy',
    topicName: 'Central Bank of Nepal',
    questionType: 'single_mcq',
    difficulty: 'easy',
    questionContent: {
      prompt: 'In which year (Bikram Sambat) was Nepal Rastra Bank established as the central bank of Nepal?',
    },
    options: [
      { optionKey: 'A', optionText: '2007 BS', isCorrect: false },
      { optionKey: 'B', optionText: '2013 BS (Baisakh 14)', isCorrect: true },
      { optionKey: 'C', optionText: '2017 BS', isCorrect: false },
      { optionKey: 'D', optionText: '2022 BS', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['B'] },
    explanation: 'Nepal Rastra Bank was established on Baisakh 14, 2013 BS (April 26, 1956 AD) under the NRB Act 2012 BS.',
    marks: 1,
    negativeMarks: 0,
    sourceCode: 'SRC-TU-CMAT',
    sourceLabel: 'TU FOM CMAT GK',
    status: 'Published',
    tags: ['cmat', 'general-awareness', 'nepal-economy'],
    examSlugs: [{ slug: 'cmat-mock-1', sectionSubject: 'Verbal Ability' }],
  },

  // ================= IOE Engineering (4 Published 2-mark Questions with -0.2 Negative Marking) =================
  {
    questionUid: 'Q-IOE-PHY-001',
    academicLevel: 'Bachelor Entrance',
    examination: 'IOE',
    subjectName: 'Physics',
    chapterName: 'Rotational Dynamics',
    topicName: 'Angular Momentum Conservation',
    questionType: 'single_mcq',
    difficulty: 'hard',
    questionContent: {
      prompt:
        'A horizontal rotating turntable has moment of inertia I and angular speed ω. A lump of clay drops vertically onto it at distance R/2, increasing total moment of inertia to 1.25 I. What is the new angular speed?',
    },
    options: [
      { optionKey: 'A', optionText: '0.75 ω', isCorrect: false },
      { optionKey: 'B', optionText: '0.80 ω', isCorrect: true },
      { optionKey: 'C', optionText: '1.25 ω', isCorrect: false },
      { optionKey: 'D', optionText: '0.64 ω', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['B'] },
    explanation: 'By conservation of angular momentum L = Iω = (1.25 I)ω′ ⇒ ω′ = ω / 1.25 = 0.80 ω.',
    marks: 2,
    negativeMarks: 0.2,
    sourceCode: 'SRC-TU-IOE',
    sourceLabel: 'TU IOE Pulchowk 2080',
    status: 'Published',
    tags: ['ioe', 'physics', 'rotational-dynamics'],
    examSlugs: [{ slug: 'ioe-be-mock-1', sectionSubject: 'Physics' }],
  },
  {
    questionUid: 'Q-IOE-MAT-002',
    academicLevel: 'Bachelor Entrance',
    examination: 'IOE',
    subjectName: 'Mathematics',
    chapterName: 'Differential Equations',
    topicName: 'Order and Degree',
    questionType: 'single_mcq',
    difficulty: 'medium',
    questionContent: {
      prompt: 'Find the order and degree of the differential equation: (d²y/dx²)³ + (dy/dx)⁴ + y = 0.',
    },
    options: [
      { optionKey: 'A', optionText: 'Order 2, Degree 3', isCorrect: true },
      { optionKey: 'B', optionText: 'Order 3, Degree 2', isCorrect: false },
      { optionKey: 'C', optionText: 'Order 2, Degree 4', isCorrect: false },
      { optionKey: 'D', optionText: 'Order 4, Degree 3', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['A'] },
    explanation: 'Highest derivative is d²y/dx² (order 2), and its exponent in polynomial form is 3 (degree 3).',
    marks: 2,
    negativeMarks: 0.2,
    sourceCode: 'SRC-TU-IOE',
    sourceLabel: 'TU IOE 2081 CBT',
    status: 'Published',
    tags: ['ioe', 'mathematics', 'differential-equations'],
    examSlugs: [{ slug: 'ioe-be-mock-1', sectionSubject: 'Physics' }],
  },
  {
    questionUid: 'Q-IOE-CHM-003',
    academicLevel: 'Bachelor Entrance',
    examination: 'IOE',
    subjectName: 'Chemistry',
    chapterName: 'Electrochemistry',
    topicName: 'Faraday Constant',
    questionType: 'single_mcq',
    difficulty: 'medium',
    questionContent: {
      prompt: 'How many Faradays of electricity are required to deposit 1 mole of Aluminum (Al³⁺ → Al) during electrolysis?',
    },
    options: [
      { optionKey: 'A', optionText: '1 F', isCorrect: false },
      { optionKey: 'B', optionText: '2 F', isCorrect: false },
      { optionKey: 'C', optionText: '3 F', isCorrect: true },
      { optionKey: 'D', optionText: '6 F', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['C'] },
    explanation: 'Al³⁺ + 3e⁻ → Al requires 3 moles of electrons per mole of Al, which equals 3 Faradays.',
    marks: 2,
    negativeMarks: 0.2,
    sourceCode: 'SRC-TU-IOE',
    sourceLabel: 'TU IOE Chemistry Bank',
    status: 'Published',
    tags: ['ioe', 'chemistry', 'electrochemistry'],
    examSlugs: [{ slug: 'ioe-be-mock-1', sectionSubject: 'Chemistry' }],
  },
  {
    questionUid: 'Q-IOE-ENG-004',
    academicLevel: 'Bachelor Entrance',
    examination: 'IOE',
    subjectName: 'English',
    chapterName: 'Phonetics & Stress',
    topicName: 'Vowel Sounds',
    questionType: 'single_mcq',
    difficulty: 'medium',
    questionContent: {
      prompt: 'Which word has the primary stress on the SECOND syllable?',
    },
    options: [
      { optionKey: 'A', optionText: 'PHOtograph', isCorrect: false },
      { optionKey: 'B', optionText: 'phoTOGrapher', isCorrect: true },
      { optionKey: 'C', optionText: 'ENgineer', isCorrect: false },
      { optionKey: 'D', optionText: 'DElicate', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['B'] },
    explanation: 'Photographer is stressed on the second syllable (/fəˈtɒɡ.rə.fər/), commonly tested in IOE English.',
    marks: 2,
    negativeMarks: 0.2,
    sourceCode: 'SRC-TU-IOE',
    sourceLabel: 'TU IOE English CBT',
    status: 'Published',
    tags: ['ioe', 'english', 'syllable-stress'],
    examSlugs: [{ slug: 'ioe-be-mock-1', sectionSubject: 'Chemistry' }],
  },

  // ================= MECEE-BL (6 Published 1-mark Questions with -0.25 Negative Marking) =================
  {
    questionUid: 'Q-MEC-ZOO-001',
    academicLevel: 'Bachelor Entrance',
    examination: 'MECEE-BL',
    subjectName: 'Biology',
    chapterName: 'Human Physiology',
    topicName: 'Cardiac Pacemaker',
    questionType: 'single_mcq',
    difficulty: 'easy',
    questionContent: {
      prompt: 'Which specialized cardiac nodal tissue acts as the natural pacemaker of the human heart?',
    },
    options: [
      { optionKey: 'A', optionText: 'Sinoatrial (SA) Node', isCorrect: true },
      { optionKey: 'B', optionText: 'Atrioventricular (AV) Node', isCorrect: false },
      { optionKey: 'C', optionText: 'Bundle of His', isCorrect: false },
      { optionKey: 'D', optionText: 'Purkinje Fibers', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['A'] },
    explanation: 'The SA node in the upper right atrium generates the highest intrinsic action potential rate (70–75 bpm), pacing the heart.',
    marks: 1,
    negativeMarks: 0.25,
    sourceCode: 'SRC-MEC-BL',
    sourceLabel: 'MECEE-BL 2080 Official',
    status: 'Published',
    tags: ['mecee-bl', 'zoology', 'physiology'],
    examSlugs: [{ slug: 'mecee-bl-mock-1', sectionSubject: 'Biology' }],
  },
  {
    questionUid: 'Q-MEC-BOT-002',
    academicLevel: 'Bachelor Entrance',
    examination: 'MECEE-BL',
    subjectName: 'Biology',
    chapterName: 'Plant Genetics',
    topicName: 'Mendelian Dihybrid Cross',
    questionType: 'single_mcq',
    difficulty: 'medium',
    questionContent: {
      prompt: 'In Mendel’s dihybrid cross (RrYy × RrYy), what is the classic F₂ phenotypic ratio?',
    },
    options: [
      { optionKey: 'A', optionText: '3 : 1', isCorrect: false },
      { optionKey: 'B', optionText: '9 : 3 : 3 : 1', isCorrect: true },
      { optionKey: 'C', optionText: '1 : 2 : 1', isCorrect: false },
      { optionKey: 'D', optionText: '9 : 7', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['B'] },
    explanation: 'Independent assortment of two heterozygous traits produces the 9:3:3:1 phenotypic ratio in F₂ progeny.',
    marks: 1,
    negativeMarks: 0.25,
    sourceCode: 'SRC-MEC-BL',
    sourceLabel: 'MECEE-BL Botany 2081',
    status: 'Published',
    tags: ['mecee-bl', 'botany', 'genetics'],
    examSlugs: [{ slug: 'mecee-bl-mock-1', sectionSubject: 'Biology' }],
  },
  {
    questionUid: 'Q-MEC-CHM-003',
    academicLevel: 'Bachelor Entrance',
    examination: 'MECEE-BL',
    subjectName: 'Chemistry',
    chapterName: 'Acids, Bases & Buffers',
    topicName: 'Human Blood Buffer',
    questionType: 'single_mcq',
    difficulty: 'medium',
    questionContent: {
      prompt: 'Which buffer system primarily maintains human arterial blood pH near 7.40?',
    },
    options: [
      { optionKey: 'A', optionText: 'Acetate / Acetic acid buffer', isCorrect: false },
      { optionKey: 'B', optionText: 'Bicarbonate / Carbonic acid buffer (HCO₃⁻ / H₂CO₃)', isCorrect: true },
      { optionKey: 'C', optionText: 'Ammonium / Ammonia buffer', isCorrect: false },
      { optionKey: 'D', optionText: 'Borate buffer', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['B'] },
    explanation: 'The carbonic acid–bicarbonate buffer pair (H₂CO₃ / HCO₃⁻) maintains physiological blood pH between 7.35 and 7.45.',
    marks: 1,
    negativeMarks: 0.25,
    sourceCode: 'SRC-MEC-BL',
    sourceLabel: 'MECEE-BL Chemistry',
    status: 'Published',
    tags: ['mecee-bl', 'chemistry', 'buffers'],
    examSlugs: [{ slug: 'mecee-bl-mock-1', sectionSubject: 'Chemistry' }],
  },
  {
    questionUid: 'Q-MEC-PHY-004',
    academicLevel: 'Bachelor Entrance',
    examination: 'MECEE-BL',
    subjectName: 'Physics',
    chapterName: 'Geometric Optics',
    topicName: 'Myopia Correction',
    questionType: 'single_mcq',
    difficulty: 'easy',
    questionContent: {
      prompt: 'Which corrective lens is prescribed for a medical student diagnosed with myopia (nearsightedness)?',
    },
    options: [
      { optionKey: 'A', optionText: 'Convex (converging) lens', isCorrect: false },
      { optionKey: 'B', optionText: 'Concave (diverging) lens', isCorrect: true },
      { optionKey: 'C', optionText: 'Cylindrical lens', isCorrect: false },
      { optionKey: 'D', optionText: 'Plano glass slab', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['B'] },
    explanation: 'Myopia focuses distant light in front of the retina; a diverging concave lens shifts the image onto the retina.',
    marks: 1,
    negativeMarks: 0.25,
    sourceCode: 'SRC-MEC-BL',
    sourceLabel: 'MECEE-BL Physics',
    status: 'Published',
    tags: ['mecee-bl', 'physics', 'optics'],
    examSlugs: [{ slug: 'mecee-bl-mock-1', sectionSubject: 'Chemistry' }],
  },
  {
    questionUid: 'Q-MEC-MAT-005',
    academicLevel: 'Bachelor Entrance',
    examination: 'MECEE-BL',
    subjectName: 'MAT (Mental Agility)',
    chapterName: 'Analogy & Direction',
    topicName: 'Medical Analogy',
    questionType: 'single_mcq',
    difficulty: 'easy',
    questionContent: {
      prompt: 'Nephron : Kidney :: Neuron : _____',
    },
    options: [
      { optionKey: 'A', optionText: 'Liver', isCorrect: false },
      { optionKey: 'B', optionText: 'Brain / Nervous System', isCorrect: true },
      { optionKey: 'C', optionText: 'Alveoli', isCorrect: false },
      { optionKey: 'D', optionText: 'Pancreas', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['B'] },
    explanation: 'A nephron is the structural/functional unit of the kidney, just as a neuron is the functional unit of the nervous system/brain.',
    marks: 1,
    negativeMarks: 0.25,
    sourceCode: 'SRC-MEC-BL',
    sourceLabel: 'MECEE-BL MAT',
    status: 'Published',
    tags: ['mecee-bl', 'mat', 'analogy'],
    examSlugs: [{ slug: 'mecee-bl-mock-1', sectionSubject: 'Chemistry' }],
  },
  {
    questionUid: 'Q-MEC-ZOO-006',
    academicLevel: 'Bachelor Entrance',
    examination: 'MECEE-BL',
    subjectName: 'Biology',
    chapterName: 'Parasitology',
    topicName: 'Malaria Vector',
    questionType: 'single_mcq',
    difficulty: 'easy',
    questionContent: {
      prompt: 'Which infective stage of Plasmodium is injected into human blood by the female Anopheles mosquito?',
    },
    options: [
      { optionKey: 'A', optionText: 'Merozoite', isCorrect: false },
      { optionKey: 'B', optionText: 'Sporozoite', isCorrect: true },
      { optionKey: 'C', optionText: 'Gametocyte', isCorrect: false },
      { optionKey: 'D', optionText: 'Trophozoite', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['B'] },
    explanation: 'Sporozoites reside in mosquito salivary glands and enter human circulation during a bite.',
    marks: 1,
    negativeMarks: 0.25,
    sourceCode: 'SRC-MEC-BL',
    sourceLabel: 'MECEE-BL Zoology 2079',
    status: 'Published',
    tags: ['mecee-bl', 'zoology', 'parasitology'],
    examSlugs: [{ slug: 'mecee-bl-mock-1', sectionSubject: 'Biology' }],
  },

  // ================= Non-Published Workflow Items (Must NEVER appear in live mock tests!) =================
  {
    questionUid: 'Q-IOE-DRAFT-901',
    academicLevel: 'Bachelor Entrance',
    examination: 'IOE',
    subjectName: 'Physics',
    chapterName: 'Electromagnetism',
    topicName: 'Maxwell Displacement Current',
    questionType: 'single_mcq',
    difficulty: 'hard',
    questionContent: {
      prompt: '[DRAFT INTERNAL] Experimental IOE displacement current problem pending review.',
    },
    options: [
      { optionKey: 'A', optionText: 'ε₀ dΦ_E / dt', isCorrect: true },
      { optionKey: 'B', optionText: 'μ₀ dΦ_B / dt', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['A'] },
    explanation: 'Draft explanation awaiting Academic Reviewer approval.',
    marks: 2,
    negativeMarks: 0.2,
    sourceCode: 'SRC-TU-IOE',
    sourceLabel: 'Internal Draft',
    status: 'Draft',
    tags: ['draft', 'ioe'],
    // Intentionally linked in exam_questions to prove runtime & snapshot filter strips non-Published questions!
    examSlugs: [{ slug: 'ioe-be-mock-1', sectionSubject: 'Physics' }],
  },
  {
    questionUid: 'Q-CSIT-REVIEW-902',
    academicLevel: 'Bachelor Entrance',
    examination: 'BSc CSIT',
    subjectName: 'Computer Science',
    chapterName: 'Operating Systems',
    topicName: 'Deadlock Conditions',
    questionType: 'single_mcq',
    difficulty: 'medium',
    questionContent: {
      prompt: '[ACADEMIC REVIEW] Pending verification question on Coffman deadlock conditions.',
    },
    options: [
      { optionKey: 'A', optionText: 'Mutual exclusion & Circular wait', isCorrect: true },
      { optionKey: 'B', optionText: 'Preemption', isCorrect: false },
    ],
    correctAnswer: { optionKeys: ['A'] },
    explanation: 'Pending reviewer sign-off.',
    marks: 1,
    negativeMarks: 0,
    sourceCode: 'SRC-TU-CSIT',
    sourceLabel: 'Review Queue',
    status: 'Academic Review',
    tags: ['review-queue', 'bsc-csit'],
    examSlugs: [{ slug: 'bsc-csit-mock-1', sectionSubject: 'Mathematics' }],
  },
];

let phase4SeedPromise: Promise<void> | null = null;

export async function ensurePhase4Seeded(): Promise<void> {
  if (!phase4SeedPromise) {
    phase4SeedPromise = runPhase4Seed().catch((err) => {
      phase4SeedPromise = null;
      throw err;
    });
  }
  return phase4SeedPromise;
}

async function runPhase4Seed(): Promise<void> {
  await db
    .insert(questionSources)
    .values(QUESTION_SOURCES_SEED)
    .onConflictDoNothing({ target: questionSources.code });

  const existingExams = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(exams);
  if ((existingExams[0]?.count ?? 0) > 0) {
    return;
  }

  const [nepal] = await db
    .select()
    .from(countries)
    .where(eq(countries.isoCode, 'NP'))
    .limit(1);
  const [cdc] = await db
    .select()
    .from(curricula)
    .where(eq(curricula.code, 'NP-CDC-NEB'))
    .limit(1);

  const allSources = await db.select().from(questionSources);
  const sourceByCode = new Map(allSources.map((s) => [s.code, s]));

  // 1. Insert Exams & Exam Sections
  const examMap = new Map<string, { id: number; sections: Array<{ id: number; subjectName: string }> }>();

  for (const spec of EXAMS_SEED) {
    const existing = await db
      .select()
      .from(exams)
      .where(eq(exams.slug, spec.slug))
      .limit(1);

    let examRow = existing[0];
    if (!examRow) {
      const [inserted] = await db
        .insert(exams)
        .values({
          slug: spec.slug,
          title: spec.title,
          category: spec.category,
          examinationSlug: spec.examinationSlug,
          academicLevel: spec.academicLevel,
          countryId: nepal?.id ?? null,
          subjectScope: spec.subjectScope,
          chapterScope: spec.chapterScope,
          totalMarks: spec.totalMarks,
          durationMinutes: spec.durationMinutes,
          negativeMarkingRule: spec.negativeMarkingRule,
          randomizeQuestions: spec.randomizeQuestions,
          randomizeOptions: spec.randomizeOptions,
          resultVisibility: spec.resultVisibility,
          attemptLimit: spec.attemptLimit,
          instructions: spec.instructions,
          status: 'published',
        })
        .returning();
      examRow = inserted;
    }

    const existingSections = await db
      .select()
      .from(examSections)
      .where(eq(examSections.examId, examRow.id));

    let secs = existingSections;
    if (secs.length === 0) {
      secs = await db
        .insert(examSections)
        .values(
          spec.sections.map((s) => ({
            examId: examRow.id,
            title: s.title,
            subjectName: s.subjectName,
            description: s.description,
            questionCount: 0,
            sectionMarks: 0,
            sortOrder: s.sortOrder,
          })),
        )
        .returning();
    }

    examMap.set(spec.slug, {
      id: examRow.id,
      sections: secs.map((s) => ({ id: s.id, subjectName: s.subjectName })),
    });
  }

  // 2. Insert Questions + Options + Answers + Explanations + Tags + Versions + Exam Links
  let qCounter = 1;
  for (const qSpec of QUESTIONS_SEED) {
    const existingQ = await db
      .select()
      .from(questions)
      .where(eq(questions.questionUid, qSpec.questionUid))
      .limit(1);

    let qRow = existingQ[0];
    if (!qRow) {
      const sourceRef = sourceByCode.get(qSpec.sourceCode);
      const snapshotOpts: SnapshotOptionItem[] = qSpec.options.map((o) => ({
        optionKey: o.optionKey,
        optionText: o.optionText,
        optionTextNe: o.optionTextNe ?? null,
      }));

      const [insertedQ] = await db
        .insert(questions)
        .values({
          questionUid: qSpec.questionUid,
          countryId: nepal?.id ?? null,
          curriculumId: cdc?.id ?? null,
          academicLevel: qSpec.academicLevel,
          examination: qSpec.examination,
          subjectName: qSpec.subjectName,
          chapterName: qSpec.chapterName,
          topicName: qSpec.topicName,
          questionType: qSpec.questionType,
          difficulty: qSpec.difficulty,
          questionContent: qSpec.questionContent,
          answerOptions: snapshotOpts,
          correctAnswer: qSpec.correctAnswer,
          explanation: qSpec.explanation,
          marks: qSpec.marks,
          negativeMarks: qSpec.negativeMarks,
          sourceId: sourceRef?.id ?? null,
          source: qSpec.sourceLabel,
          language: qSpec.language ?? 'en',
          status: qSpec.status,
          reviewer: 'Hamro Academic Review Board',
          version: 1,
        })
        .returning();
      qRow = insertedQ;

      if (qSpec.options.length > 0) {
        await db
          .insert(questionOptions)
          .values(
            qSpec.options.map((opt, idx) => ({
              questionId: qRow.id,
              optionKey: opt.optionKey,
              optionText: opt.optionText,
              optionTextNe: opt.optionTextNe ?? null,
              isCorrect: Boolean(opt.isCorrect),
              sortOrder: idx + 1,
            })),
          )
          .onConflictDoNothing();
      }

      await db
        .insert(questionAnswers)
        .values({
          questionId: qRow.id,
          correctAnswer: qSpec.correctAnswer,
        })
        .onConflictDoNothing();

      await db
        .insert(questionExplanations)
        .values({
          questionId: qRow.id,
          explanation: qSpec.explanation,
          referenceNote: qSpec.sourceLabel,
        })
        .onConflictDoNothing();

      if (qSpec.tags.length > 0) {
        await db
          .insert(questionTags)
          .values(
            qSpec.tags.map((tag) => ({
              questionId: qRow.id,
              slug: tag,
              label: tag,
            })),
          )
          .onConflictDoNothing();
      }

      await db
        .insert(questionVersions)
        .values({
          questionId: qRow.id,
          versionNumber: 1,
          snapshotJson: {
            questionContent: qSpec.questionContent,
            answerOptions: snapshotOpts,
            correctAnswer: qSpec.correctAnswer,
            explanation: qSpec.explanation,
            marks: qSpec.marks,
            negativeMarks: qSpec.negativeMarks,
          },
          changeSummary: `Seeded ${qSpec.status} v1`,
        })
        .onConflictDoNothing();
    }

    for (const link of qSpec.examSlugs) {
      const targetExam = examMap.get(link.slug);
      if (!targetExam) continue;
      const targetSec =
        targetExam.sections.find((s) => s.subjectName === link.sectionSubject) ??
        targetExam.sections[0];

      await db
        .insert(examQuestions)
        .values({
          examId: targetExam.id,
          sectionId: targetSec?.id ?? null,
          questionId: qRow.id,
          sortOrder: qCounter,
        })
        .onConflictDoNothing();
      qCounter += 1;
    }
  }
}
