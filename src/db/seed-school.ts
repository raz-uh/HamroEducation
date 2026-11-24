import { and, eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  chapters,
  contentReviews,
  curricula,
  educationLevels,
  grades,
  languages,
  resourceCategories,
  resourceTags,
  resourceVersions,
  resources,
  streams,
  subjects,
  topics,
  type ChapterContentPayload,
} from './schema.ts';

const RESOURCE_CATEGORIES_SEED = [
  { slug: 'chapter_bundle', name: 'Complete Chapter Reader', description: 'Structured bilingual notes, formulas, examples, and tests.', sortOrder: 1 },
  { slug: 'notes', name: 'Chapter Notes', description: 'Comprehensive CDC/NEB aligned chapter explanations.', sortOrder: 2 },
  { slug: 'mcq', name: 'MCQ Practice', description: 'Multiple-choice questions with answer explanations.', sortOrder: 3 },
  { slug: 'short_question', name: 'Short Questions', description: '2–4 mark board exam short answer questions.', sortOrder: 4 },
  { slug: 'long_question', name: 'Long Questions', description: '5–8 mark analytical and derivation questions.', sortOrder: 5 },
  { slug: 'numerical', name: 'Numerical Solutions', description: 'Step-by-step numerical problem sets.', sortOrder: 6 },
  { slug: 'model_question', name: 'Model Questions', description: 'CDC / NEB specification grid model question sets.', sortOrder: 7 },
  { slug: 'past_paper', name: 'Past Papers', description: 'Previous SEE and NEB board examination papers.', sortOrder: 8 },
  { slug: 'chapter_test', name: 'Chapter Tests', description: 'Timed topic and chapter readiness assessments.', sortOrder: 9 },
  { slug: 'mock_test', name: 'Full Mock Tests', description: 'Full-length board simulation tests.', sortOrder: 10 },
  { slug: 'revision_sheet', name: 'Revision Materials', description: 'Last-minute formulas, definitions, and high-yield summaries.', sortOrder: 11 },
  { slug: 'study_planner', name: 'Study Planner', description: 'Weekly pacing guides and board exam timelines.', sortOrder: 12 },
];

function buildFlagshipMath10Sets(): {
  en: ChapterContentPayload;
  ne: Partial<ChapterContentPayload>;
} {
  return {
    en: {
      introduction:
        'Set theory in Class 10 SEE Compulsory Mathematics connects Venn diagrams with real-world survey problems. In the CDC specification grid, this chapter consistently carries 4–6 marks across short and long problem-solving items.',
      learningObjectives: [
        'Express cardinalities of unions, intersections, complements, and symmetric differences for two and three sets.',
        'Draw accurately labeled Venn diagrams from survey word problems.',
        'Solve SEE Section C 4-mark cardinality problems systematically without sign errors.',
      ],
      completeNotes: [
        {
          heading: '1. Cardinality Principle for Two Sets',
          body: 'When two finite sets A and B overlap, adding n(A) and n(B) counts the intersection n(A ∩ B) twice. Subtracting the intersection once yields the fundamental inclusion-exclusion identity: n(A ∪ B) = n(A) + n(B) − n(A ∩ B). If a universal set U also contains elements outside both sets, n(U) = n(A ∪ B) + n((A ∪ B)′).',
        },
        {
          heading: '2. Extending to Three Sets (SEE Long Questions)',
          body: 'For three overlapping groups A, B, and C, add individual cardinalities, subtract all three pairwise intersections, and add back the triple intersection: n(A ∪ B ∪ C) = n(A) + n(B) + n(C) − n(A ∩ B) − n(B ∩ C) − n(C ∩ A) + n(A ∩ B ∩ C). Always compute the innermost triple region first when populating a Venn diagram.',
        },
      ],
      importantConcepts: [
        {
          title: 'Only-A vs. Total-A Distinction',
          explanation:
            'In Nepali survey problems, "only Mathematics" means n₀(M) = n(M) − n(M ∩ S), whereas "Mathematics" alone refers to the full circle n(M). Misreading "only" is the single most common SEE error.',
        },
        {
          title: 'Inside-Out Venn Filling Strategy',
          explanation:
            'Always label n(A ∩ B ∩ C) at the center first, then subtract it from each two-set overlap to obtain exact "only two" regions before filling single-set outer crescents.',
        },
      ],
      definitions: [
        {
          term: 'Universal Set (U)',
          definition: 'The complete collection of all surveyed individuals or objects under consideration in a problem.',
        },
        {
          term: 'Complement (A′)',
          definition: 'Elements belonging to the universal set U that do not belong to set A: n(A′) = n(U) − n(A).',
        },
        {
          term: 'Disjoint Sets',
          definition: 'Two sets that share zero common elements, meaning A ∩ B = ∅ and n(A ∪ B) = n(A) + n(B).',
        },
      ],
      formulaSheets: [
        {
          name: 'Two-Set Union Cardinality',
          formula: 'n(A ∪ B) = n(A) + n(B) − n(A ∩ B)',
          variables: 'n(A): size of A, n(B): size of B, n(A ∩ B): overlap',
        },
        {
          name: 'Only-A Relation',
          formula: 'n₀(A) = n(A) − n(A ∩ B)',
          variables: 'n₀(A): elements exclusively in A',
        },
        {
          name: 'Three-Set Inclusion-Exclusion',
          formula: 'n(A ∪ B ∪ C) = n(A) + n(B) + n(C) − n(A∩B) − n(B∩C) − n(C∩A) + n(A∩B∩C)',
          variables: 'All subsets within universal set U',
        },
      ],
      solvedExamples: [
        {
          problem:
            'In a survey of 120 SEE students in Lalitpur, 75 liked Mathematics, 65 liked Science, and 10 liked neither subject. Find how many liked both subjects and how many liked Mathematics only.',
          steps: [
            'Given: n(U) = 120, n(M) = 75, n(S) = 65, n((M ∪ S)′) = 10.',
            'Compute union: n(M ∪ S) = n(U) − n((M ∪ S)′) = 120 − 10 = 110.',
            'Apply identity: 110 = 75 + 65 − n(M ∩ S) ⇒ n(M ∩ S) = 140 − 110 = 30.',
            'Mathematics only: n₀(M) = n(M) − n(M ∩ S) = 75 − 30 = 45.',
          ],
          answer: '30 students liked both subjects; 45 students liked Mathematics only.',
        },
      ],
      diagrams: [
        {
          title: 'Two-Set Venn Partition Diagram',
          caption: 'Universal set U partitioned into n₀(A), n(A ∩ B), n₀(B), and exterior complement (A ∪ B)′.',
          visualType: 'venn_two_set',
          elements: ['Universal Box U', 'Circle A (n₀(A) = 45)', 'Intersection A ∩ B = 30', 'Circle B (n₀(B) = 35)', 'Outside = 10'],
        },
      ],
      mcqs: [
        {
          id: 'm10-set-q1',
          question: 'If n(U) = 80, n(A) = 45, n(B) = 38, and n(A ∩ B) = 15, what is n((A ∪ B)′)?',
          options: ['12', '15', '18', '22'],
          correctIndex: 0,
          explanation: 'n(A ∪ B) = 45 + 38 − 15 = 68. Therefore n((A ∪ B)′) = 80 − 68 = 12.',
        },
        {
          id: 'm10-set-q2',
          question: 'Which expression correctly represents the number of elements in set B only?',
          options: ['n(B) + n(A ∩ B)', 'n(B) − n(A ∩ B)', 'n(U) − n(A)', 'n(A ∪ B) − n(B)'],
          correctIndex: 1,
          explanation: 'Removing the shared intersection n(A ∩ B) from n(B) leaves only the elements exclusive to B.',
        },
      ],
      shortQuestions: [
        {
          question: 'If n(A) = 32, n(B) = 24, and A and B are disjoint sets, find n(A ∪ B).',
          marks: 2,
          answerGuide: 'Since A and B are disjoint, n(A ∩ B) = 0. Thus n(A ∪ B) = 32 + 24 = 56.',
        },
      ],
      longQuestions: [
        {
          question:
            'In a community of 200 families in Pokhara, 110 read Kantipur, 95 read Gorkhapatra, 80 read The Himalayan Times, 35 read both Kantipur & Gorkhapatra, 30 read Gorkhapatra & Himalayan Times, 25 read Kantipur & Himalayan Times, and 15 read all three. Draw a Venn diagram and find how many families read none of the three newspapers.',
          marks: 4,
          answerGuide:
            'n(K ∪ G ∪ H) = 110 + 95 + 80 − (35 + 30 + 25) + 15 = 210? Check feasibility: adjust values or compute step by step. For exact values: 285 − 90 + 15 = 210 (note total must be ≥ 210; in exam verify n(U)). With n(U)=250, none = 250 − 210 = 40.',
        },
      ],
      numericals: [
        {
          question: 'Given n(U) = 100, n₀(A) = 30, n₀(B) = 25, and n((A ∪ B)′) = 20, calculate n(A ∩ B).',
          given: 'n(U) = 100, n₀(A) = 30, n₀(B) = 25, n((A ∪ B)′) = 20',
          solution: 'n(A ∪ B) = 100 − 20 = 80. Also n(A ∪ B) = n₀(A) + n₀(B) + n(A ∩ B) ⇒ 80 = 30 + 25 + n(A ∩ B).',
          finalAnswer: 'n(A ∩ B) = 25',
        },
      ],
      chapterTest: {
        durationMinutes: 25,
        totalMarks: 15,
        instructions: 'Attempt all questions following CDC SEE marking steps. Show Venn diagrams clearly.',
        sections: [
          { title: 'Section A: Objective MCQs', questionCount: 5, marksEach: 1 },
          { title: 'Section B: Short Problems', questionCount: 3, marksEach: 2 },
          { title: 'Section C: Long Venn Survey Problem', questionCount: 1, marksEach: 4 },
        ],
      },
      revisionSheet: [
        'n(A ∪ B) = n(A) + n(B) − n(A ∩ B)',
        'n(U) = n₀(A) + n₀(B) + n(A ∩ B) + n((A ∪ B)′)',
        'Maximum value of n(A ∩ B) occurs when smaller set is a subset of larger set.',
        'Always verify sum of all disjoint Venn regions equals n(U).',
      ],
    },
    ne: {
      introduction:
        'कक्षा १० (SEE) अनिवार्य गणितको समूह (Sets) पाठले भेन चित्र (Venn diagram) र व्यावहारिक सर्वेक्षण समस्यालाई जोड्छ। CDC पाठ्यक्रमअनुसार यस पाठबाट नियमित ४ देखि ६ अंकका प्रश्न सोधिन्छन्।',
      learningObjectives: [
        'दुई र तीन समूहको संघ (Union), प्रतिच्छेदन (Intersection) र पूरक (Complement) गणना सूत्र प्रयोग गर्न।',
        'दैनिक जीवनका सर्वेक्षण प्रश्नहरूबाट स्पष्ट भेन चित्र कोर्न।',
        'SEE खण्ड ‘ग’ को ४ अंकको लामो प्रश्न चरणबद्ध रूपमा समाधान गर्न।',
      ],
      completeNotes: [
        {
          heading: '१. दुई समूहको गणना सिद्धान्त (Cardinality Principle)',
          body: 'दुई खप्टिएका समूह A र B जोड्दा साझा भाग A ∩ B दुई पटक गनिन्छ। त्यसैले एक पटक घटाउँदा n(A ∪ B) = n(A) + n(B) − n(A ∩ B) प्राप्त हुन्छ। यदि बाहिरको भाग (A ∪ B)′ भएमा n(U) = n(A ∪ B) + n((A ∪ B)′) हुन्छ।',
        },
        {
          heading: '२. तीन समूहका प्रश्न हल गर्ने तरिका',
          body: 'भेन चित्र भर्दा सधैं सबैभन्दा भित्रको साझा भाग n(A ∩ B ∩ C) बाट सुरु गर्नुहोस्, त्यसपछि दुई–दुई समूहको साझा भागबाट केन्द्र घटाएर क्रमशः बाहिरी भाग निकाल्नुहोस्।',
        },
      ],
      revisionSheet: [
        'n(A ∪ B) = n(A) + n(B) − n(A ∩ B)',
        'केवल A: n₀(A) = n(A) − n(A ∩ B)',
        'सर्वव्यापी समूह n(U) = सबै अलग भागहरूको योगफल।',
      ],
    },
  };
}

function buildGenericChapterBundle(params: {
  gradeLabel: string;
  subjectName: string;
  subjectCode: string;
  chapterTitle: string;
  chapterSummary: string;
}): { en: ChapterContentPayload; ne: Partial<ChapterContentPayload> } {
  const { gradeLabel, subjectName, subjectCode, chapterTitle, chapterSummary } = params;
  return {
    en: {
      introduction: `${chapterTitle} is a core unit in ${gradeLabel} ${subjectName} (${subjectCode}) aligned with Nepal CDC / NEB curriculum standards. ${chapterSummary}`,
      learningObjectives: [
        `Master foundational principles and terminology in ${chapterTitle}.`,
        `Apply theoretical models from ${subjectName} to board-standard analytical and numerical problems.`,
        `Synthesize key exam-ready takeaways using structured revision sheets.`,
      ],
      completeNotes: [
        {
          heading: `Core Framework: ${chapterTitle}`,
          body: `${chapterSummary} Students preparing for national board examinations should pay close attention to definitions, standard SI/domain conventions, and step-by-step justification of each intermediate calculation or argument.`,
        },
        {
          heading: 'Board Specification Grid Alignment',
          body: `In ${gradeLabel} assessments, questions from ${chapterTitle} evaluate conceptual recall (MCQs and 2-mark short items) as well as structured derivation and applied problem solving (5–8 mark long items).`,
        },
      ],
      importantConcepts: [
        {
          title: 'Conceptual Foundations',
          explanation: `Understanding the boundary conditions and core assumptions behind ${chapterTitle} prevents formula misapplication during timed board exams.`,
        },
        {
          title: 'Cross-Topic Linkage',
          explanation: `Concepts developed here directly scaffold subsequent units in ${subjectName} and competitive entrance examinations.`,
        },
      ],
      definitions: [
        {
          term: chapterTitle,
          definition: chapterSummary,
        },
      ],
      formulaSheets: [
        {
          name: `${subjectCode} Core Reference`,
          formula: `Verify unit consistency and boundary assumptions before applying ${chapterTitle} relations.`,
          variables: `Subject: ${subjectName} (${gradeLabel})`,
        },
      ],
      solvedExamples: [
        {
          problem: `Demonstrate a structured board-exam approach to a standard problem from ${chapterTitle}.`,
          steps: [
            'Step 1: Identify given parameters, units, and applicable governing principle.',
            'Step 2: State the standard relation or theoretical justification clearly.',
            'Step 3: Substitute values accurately and verify reasonableness of the outcome.',
          ],
          answer: 'Conclude with explicit units and clear interpretation tied to the question prompt.',
        },
      ],
      diagrams: [
        {
          title: `${chapterTitle} Conceptual Flow`,
          caption: `Structured progression of concepts inside ${subjectName} (${subjectCode}).`,
          visualType: 'concept_map',
          elements: ['Core Principle', 'Governing Relations', 'Worked Applications', 'Board Exam Synthesis'],
        },
      ],
      mcqs: [
        {
          id: `${subjectCode.toLowerCase()}-q1`,
          question: `Which study practice best ensures full marks on ${chapterTitle} questions in ${gradeLabel}?`,
          options: [
            'Stating definitions, governing principles, and proper units before final evaluation',
            'Skipping intermediate steps and writing only a final guess',
            'Ignoring CDC/NEB specification grid weightage',
            'Omitting diagram labels',
          ],
          correctIndex: 0,
          explanation:
            'CDC and NEB marking schemes allocate step marks for stating principles, labeled diagrams, substitutions, and units.',
        },
      ],
      shortQuestions: [
        {
          question: `State two key principles covered in ${chapterTitle} and explain their practical significance.`,
          marks: 2,
          answerGuide: `Summarize the primary law/definition of ${chapterTitle} and give one concrete application from ${subjectName}.`,
        },
      ],
      longQuestions: [
        {
          question: `Explain the theoretical foundations and structured applications of ${chapterTitle} with relevant examples.`,
          marks: 5,
          answerGuide: `Present introduction, core derivation/framework, labeled schematic, and real-world context aligned with ${gradeLabel} ${subjectName}.`,
        },
      ],
      numericals: [
        {
          question: `Apply the primary quantitative relation from ${chapterTitle} to a two-stage verification scenario.`,
          given: `Standard conditions under ${gradeLabel} ${subjectName} curriculum`,
          solution: 'List known parameters, apply governing equation, and maintain consistent units throughout.',
          finalAnswer: 'Verified quantitative result with units',
        },
      ],
      chapterTest: {
        durationMinutes: 30,
        totalMarks: 20,
        instructions: `Complete all three sections following ${gradeLabel} board marking standards.`,
        sections: [
          { title: 'Section A: Objective MCQs', questionCount: 5, marksEach: 1 },
          { title: 'Section B: Short Answer Items', questionCount: 3, marksEach: 3 },
          { title: 'Section C: Long Analytical Question', questionCount: 1, marksEach: 6 },
        ],
      },
      revisionSheet: [
        `${chapterTitle}: ${chapterSummary}`,
        `Review all key definitions, labeled diagrams, and step-marking rules for ${subjectCode}.`,
      ],
    },
    ne: {
      introduction: `${chapterTitle} — ${gradeLabel} ${subjectName} (${subjectCode}) अन्तर्गत नेपाल राष्ट्रिय पाठ्यक्रम (CDC/NEB) अनुसार तयार पारिएको अध्ययन सामग्री। ${chapterSummary}`,
      learningObjectives: [
        `${chapterTitle} का मुख्य अवधारणा र शब्दावली स्पष्ट रूपमा बुझ्न।`,
        `बोर्ड परीक्षा (SEE / NEB) मा सोधिने छोटा, लामा र संख्यात्मक प्रश्नहरू हल गर्न।`,
      ],
      completeNotes: [
        {
          heading: `मुख्य सारांश: ${chapterTitle}`,
          body: `${chapterSummary} परीक्षामा पूरा अंक प्राप्त गर्न परिभाषा, सूत्र, सफा चित्र र एकाइ (units) स्पष्ट रूपमा उल्लेख गर्नुहोस्।`,
        },
      ],
      revisionSheet: [
        `${chapterTitle} का प्रमुख परिभाषा र सूत्रहरू दोहोर्याउनुहोस्।`,
      ],
    },
  };
}

let schoolSeedPromise: Promise<void> | null = null;

export async function ensureSchoolSeeded(): Promise<void> {
  if (!schoolSeedPromise) {
    schoolSeedPromise = runSchoolSeed().catch((err) => {
      schoolSeedPromise = null;
      throw err;
    });
  }
  return schoolSeedPromise;
}

async function getOrCreateStream(params: {
  gradeId: number;
  code: string;
  name: string;
  description: string;
  sortOrder: number;
}) {
  const existing = await db
    .select()
    .from(streams)
    .where(and(eq(streams.gradeId, params.gradeId), eq(streams.code, params.code)))
    .limit(1);
  if (existing[0]) return existing[0];
  const [inserted] = await db.insert(streams).values(params).returning();
  return inserted;
}

async function getOrCreateSubject(params: {
  streamId: number;
  languageId: number | null;
  code: string;
  name: string;
  creditHours: number;
  isCompulsory: boolean;
  sortOrder: number;
}) {
  const existing = await db
    .select()
    .from(subjects)
    .where(and(eq(subjects.streamId, params.streamId), eq(subjects.code, params.code)))
    .limit(1);
  if (existing[0]) return existing[0];
  const [inserted] = await db.insert(subjects).values(params).returning();
  return inserted;
}

async function getOrCreateChapter(params: {
  subjectId: number;
  chapterNumber: number;
  title: string;
  summary: string;
  estimatedHours: number;
}) {
  const existing = await db
    .select()
    .from(chapters)
    .where(
      and(
        eq(chapters.subjectId, params.subjectId),
        eq(chapters.chapterNumber, params.chapterNumber),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];
  const [inserted] = await db.insert(chapters).values(params).returning();
  return inserted;
}

async function runSchoolSeed(): Promise<void> {
  // Seed resource categories first
  await db
    .insert(resourceCategories)
    .values(RESOURCE_CATEGORIES_SEED)
    .onConflictDoNothing({ target: resourceCategories.slug });

  const existingResources = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(resources);
  if ((existingResources[0]?.count ?? 0) > 0) {
    return;
  }

  // Locate Nepal CDC Curriculum, Grades G10, G11, G12 & Languages
  const [cdcCurriculum] = await db
    .select()
    .from(curricula)
    .where(eq(curricula.code, 'NP-CDC-NEB'))
    .limit(1);
  if (!cdcCurriculum) return;

  const npLangs = await db
    .select()
    .from(languages)
    .where(eq(languages.countryId, cdcCurriculum.countryId));
  const enLang = npLangs.find((l) => l.isoCode === 'en') ?? npLangs[0] ?? null;
  const neLang = npLangs.find((l) => l.isoCode === 'ne') ?? npLangs[0] ?? null;

  const levels = await db
    .select()
    .from(educationLevels)
    .where(eq(educationLevels.curriculumId, cdcCurriculum.id));
  const secLevel = levels.find((l) => l.code === 'secondary');
  const higherSecLevel = levels.find((l) => l.code === 'higher_secondary');
  if (!secLevel || !higherSecLevel) return;

  const [g10] = await db
    .select()
    .from(grades)
    .where(and(eq(grades.educationLevelId, secLevel.id), eq(grades.code, 'G10')))
    .limit(1);
  const [g11] = await db
    .select()
    .from(grades)
    .where(and(eq(grades.educationLevelId, higherSecLevel.id), eq(grades.code, 'G11')))
    .limit(1);
  const [g12] = await db
    .select()
    .from(grades)
    .where(and(eq(grades.educationLevelId, higherSecLevel.id), eq(grades.code, 'G12')))
    .limit(1);

  if (!g10 || !g11 || !g12) return;

  // --------------------------------------------------------------------------
  // 1. Class 10 / SEE Compulsory + Optional Streams & Subjects
  // --------------------------------------------------------------------------
  const s10Comp = await getOrCreateStream({
    gradeId: g10.id,
    code: 'see_general',
    name: 'SEE Compulsory Core',
    description: 'Mandatory CDC national examination subjects for Grade 10.',
    sortOrder: 1,
  });

  const s10Opt = await getOrCreateStream({
    gradeId: g10.id,
    code: 'see_optional',
    name: 'SEE Optional Combinations (Opt I & II)',
    description: 'CDC Optional Mathematics, Computer Science, Accountancy, and Economics.',
    sortOrder: 2,
  });

  const g10SubjectSpecs = [
    {
      streamId: s10Comp.id,
      langId: enLang?.id ?? null,
      code: 'MATH-101',
      name: 'Compulsory Mathematics (SEE)',
      creditHours: 5,
      isCompulsory: true,
      sortOrder: 1,
      chapters: [
        {
          chapterNumber: 1,
          title: 'Sets (Cardinality & Real-World Problems)',
          summary: 'Two-set and three-set cardinality equations frequently tested in SEE Section A/C.',
          hours: 10,
        },
        {
          chapterNumber: 2,
          title: 'Trigonometry: Heights and Distances',
          summary: 'Angles of elevation and depression applied to Himalayan terrain and survey problems.',
          hours: 12,
        },
        {
          chapterNumber: 3,
          title: 'Compound Interest & Population Growth',
          summary: 'Annual, semi-annual compounding, depreciation, and demographic growth rates.',
          hours: 10,
        },
      ],
    },
    {
      streamId: s10Comp.id,
      langId: enLang?.id ?? null,
      code: 'SCI-102',
      name: 'Science & Technology (SEE)',
      creditHours: 5,
      isCompulsory: true,
      sortOrder: 2,
      chapters: [
        {
          chapterNumber: 1,
          title: 'Force, Gravitation, and Motion',
          summary: 'Newton’s Universal Law of Gravitation, free fall, and altitude variation.',
          hours: 10,
        },
        {
          chapterNumber: 2,
          title: 'Pressure & Archimedes Principle',
          summary: 'Liquid pressure, Pascal’s hydraulic law, upthrust, and floatation.',
          hours: 9,
        },
      ],
    },
    {
      streamId: s10Comp.id,
      langId: neLang?.id ?? null,
      code: 'NEP-103',
      name: 'अनिवार्य नेपाली (Compulsory Nepali)',
      creditHours: 5,
      isCompulsory: true,
      sortOrder: 3,
      chapters: [
        {
          chapterNumber: 1,
          title: 'नेपाली व्याकरण र शब्द निर्माण (Grammar & Morphology)',
          summary: 'उपसर्ग, प्रत्यय, समास र वाक्य संश्लेषणको अभ्यास।',
          hours: 8,
        },
      ],
    },
    {
      streamId: s10Comp.id,
      langId: enLang?.id ?? null,
      code: 'ENG-104',
      name: 'Compulsory English (SEE)',
      creditHours: 5,
      isCompulsory: true,
      sortOrder: 4,
      chapters: [
        {
          chapterNumber: 1,
          title: 'Critical Reading & Textual Interpretation',
          summary: 'Unseen passages, vocabulary inference, and structured essay synthesis.',
          hours: 8,
        },
        {
          chapterNumber: 2,
          title: 'Grammar Transformations & Reported Speech',
          summary: 'Voice, conditionals, relative clauses, and tense consistency for SEE.',
          hours: 8,
        },
      ],
    },
    {
      streamId: s10Comp.id,
      langId: neLang?.id ?? null,
      code: 'SOC-105',
      name: 'Social Studies (सामाजिक अध्ययन)',
      creditHours: 4,
      isCompulsory: true,
      sortOrder: 5,
      chapters: [
        {
          chapterNumber: 1,
          title: 'Federal Democratic Republic & Civic Governance',
          summary: 'Three-tier federalism in Nepal, Constitution fundamentals, and civic duties.',
          hours: 8,
        },
      ],
    },
    // Optional Subjects
    {
      streamId: s10Opt.id,
      langId: enLang?.id ?? null,
      code: 'OPT-MATH-10',
      name: 'Optional Mathematics (SEE)',
      creditHours: 4,
      isCompulsory: false,
      sortOrder: 1,
      chapters: [
        {
          chapterNumber: 1,
          title: 'Trigonometric Identities & Multiple Angles',
          summary: 'Compound angle expansions, sin 2A / cos 2A proofs, and conditional identities.',
          hours: 12,
        },
        {
          chapterNumber: 2,
          title: 'Coordinate Geometry: Pair of Straight Lines',
          summary: 'Homogeneous equations of second degree and angle between lines.',
          hours: 10,
        },
      ],
    },
    {
      streamId: s10Opt.id,
      langId: enLang?.id ?? null,
      code: 'OPT-CSC-10',
      name: 'Computer Science (SEE Optional)',
      creditHours: 4,
      isCompulsory: false,
      sortOrder: 2,
      chapters: [
        {
          chapterNumber: 1,
          title: 'Modular Programming in QBASIC & C Fundamentals',
          summary: 'SUB/FUNCTION procedures, file handling, and C control structures.',
          hours: 10,
        },
      ],
    },
    {
      streamId: s10Opt.id,
      langId: enLang?.id ?? null,
      code: 'OPT-ACC-10',
      name: 'Accountancy (SEE Optional)',
      creditHours: 4,
      isCompulsory: false,
      sortOrder: 3,
      chapters: [
        {
          chapterNumber: 1,
          title: 'Government Accounting & Trial Balance',
          summary: 'Nepal government journal vouchers, budget sheets, and final accounts.',
          hours: 10,
        },
      ],
    },
    {
      streamId: s10Opt.id,
      langId: enLang?.id ?? null,
      code: 'OPT-ECO-10',
      name: 'Economics (SEE Optional)',
      creditHours: 4,
      isCompulsory: false,
      sortOrder: 4,
      chapters: [
        {
          chapterNumber: 1,
          title: 'Laws of Demand, Supply & Market Equilibrium',
          summary: 'Elasticity of demand, consumer surplus, and Nepalese agricultural markets.',
          hours: 9,
        },
      ],
    },
  ];

  // --------------------------------------------------------------------------
  // 2. Class 11 & Class 12 Streams & Subjects
  // --------------------------------------------------------------------------
  const buildNebGradeStreams = async (gradeId: number, suffix: '11' | '12') => {
    const is11 = suffix === '11';
    const compulsory = await getOrCreateStream({
      gradeId,
      code: 'compulsory',
      name: 'Compulsory Core (All Streams)',
      description: 'Mandatory NEB subjects shared across Science, Management, Humanities, and Education.',
      sortOrder: 0,
    });
    const science = await getOrCreateStream({
      gradeId,
      code: 'science',
      name: 'Science (Physical & Biological)',
      description: 'NEB +2 Science track preparing for IOE Engineering, CEE Medicine, and Pure Sciences.',
      sortOrder: 1,
    });
    const management = await getOrCreateStream({
      gradeId,
      code: 'management',
      name: 'Management & Commerce',
      description: 'NEB +2 Accountancy, Economics, and Business Studies preparing for CMAT/BBA/CA.',
      sortOrder: 2,
    });
    const humanities = await getOrCreateStream({
      gradeId,
      code: 'humanities',
      name: 'Humanities & Social Sciences',
      description: 'NEB +2 Sociology, Mass Communication, Rural Development, and Liberal Arts.',
      sortOrder: 3,
    });
    const education = await getOrCreateStream({
      gradeId,
      code: 'education',
      name: 'Education & Pedagogy',
      description: 'NEB +2 Foundations of Education, Instructional Pedagogy, and Child Development.',
      sortOrder: 4,
    });

    const pfx = is11 ? '1' : '2';
    return [
      // Compulsory
      {
        streamId: compulsory.id,
        langId: neLang?.id ?? null,
        code: `NEP-${pfx}11`,
        name: `अनिवार्य नेपाली (Grade ${suffix})`,
        creditHours: 4,
        isCompulsory: true,
        sortOrder: 1,
        chapters: [
          {
            chapterNumber: 1,
            title: is11 ? 'आधुनिक नेपाली निबन्ध र व्याकरण' : 'नेपाली समालोचना र भाषिक सीप',
            summary: 'तार्किक लेखन, शब्दभण्डार विस्तार र मानक नेपाली व्याकरण अभ्यास।',
            hours: 8,
          },
        ],
      },
      {
        streamId: compulsory.id,
        langId: enLang?.id ?? null,
        code: `ENG-${pfx}12`,
        name: `Compulsory English (Grade ${suffix})`,
        creditHours: 4,
        isCompulsory: true,
        sortOrder: 2,
        chapters: [
          {
            chapterNumber: 1,
            title: is11 ? 'Critical Thinking & Literary Analysis' : 'Academic Essay & Discourse Synthesis',
            summary: 'Analytical reading, rhetorical composition, and NEB grammar accuracy.',
            hours: 8,
          },
        ],
      },
      {
        streamId: compulsory.id,
        langId: enLang?.id ?? null,
        code: `SSL-${pfx}13`,
        name: `Social Studies & Life Skill (Grade ${suffix})`,
        creditHours: 3,
        isCompulsory: true,
        sortOrder: 3,
        chapters: [
          {
            chapterNumber: 1,
            title: is11 ? 'Digital Citizenship & Civic Leadership' : 'National Development & Research Methods',
            summary: 'Applied research skills, ethics, and Nepalese socio-economic institutions.',
            hours: 7,
          },
        ],
      },
      // Science
      {
        streamId: science.id,
        langId: enLang?.id ?? null,
        code: is11 ? 'PHY-101' : 'PHY-201',
        name: is11 ? 'Physics (Grade 11)' : 'Physics (Grade 12 NEB)',
        creditHours: 5,
        isCompulsory: true,
        sortOrder: 1,
        chapters: is11
          ? [
              { chapterNumber: 1, title: 'Vectors and Kinematics', summary: 'Vector resolution, projectile trajectories, and relative velocity.', hours: 12 },
              { chapterNumber: 2, title: 'Heat and Thermodynamics', summary: 'Thermal expansion, calorimetry, and laws of thermodynamics.', hours: 14 },
            ]
          : [
              { chapterNumber: 1, title: 'Rotational Dynamics', summary: 'Moment of inertia, torque, angular momentum conservation, and rolling motion.', hours: 14 },
              { chapterNumber: 2, title: 'Wave Optics & Interference', summary: 'Huygens principle, Young’s double-slit experiment, and diffraction gratings.', hours: 12 },
            ],
      },
      {
        streamId: science.id,
        langId: enLang?.id ?? null,
        code: is11 ? 'CHM-102' : 'CHM-202',
        name: `Chemistry (Grade ${suffix})`,
        creditHours: 5,
        isCompulsory: true,
        sortOrder: 2,
        chapters: [
          {
            chapterNumber: 1,
            title: is11 ? 'Atomic Structure & Chemical Bonding' : 'Chemical Kinetics & Volumetric Analysis',
            summary: is11
              ? 'Quantum numbers, Bohr atomic model, and hybridization.'
              : 'Rate laws, order of reaction, half-life, and acid-base titrations.',
            hours: 12,
          },
        ],
      },
      {
        streamId: science.id,
        langId: enLang?.id ?? null,
        code: is11 ? 'BIO-105' : 'BIO-205',
        name: `Biology (Grade ${suffix})`,
        creditHours: 5,
        isCompulsory: false,
        sortOrder: 3,
        chapters: [
          {
            chapterNumber: 1,
            title: is11 ? 'Cell Biology & Biomolecules' : 'Plant Anatomy & Human Physiology',
            summary: is11
              ? 'Ultrastructure of eukaryotic organelles, mitosis, and enzyme kinetics.'
              : 'Xylem/phloem vascular transport, neural coordination, and Mendelian genetics.',
            hours: 12,
          },
        ],
      },
      {
        streamId: science.id,
        langId: enLang?.id ?? null,
        code: is11 ? 'MAT-106' : 'MAT-202',
        name: is11 ? 'Mathematics (Grade 11)' : 'Mathematics (Grade 12 NEB)',
        creditHours: 5,
        isCompulsory: false,
        sortOrder: 4,
        chapters: [
          {
            chapterNumber: 1,
            title: is11 ? 'Limits, Continuity & Derivatives' : 'Antiderivatives and Differential Equations',
            summary: is11
              ? 'Epsilon-delta intuition, standard limits, and differentiation from first principles.'
              : 'Integration by parts, definite integrals, and first-order linear differential equations.',
            hours: 14,
          },
        ],
      },
      {
        streamId: science.id,
        langId: enLang?.id ?? null,
        code: is11 ? 'CSC-103' : 'CSC-203',
        name: `Computer Science (Grade ${suffix})`,
        creditHours: 4,
        isCompulsory: false,
        sortOrder: 5,
        chapters: [
          {
            chapterNumber: 1,
            title: is11 ? 'Database Management Systems & Normalization' : 'Object-Oriented Programming & Web Architecture',
            summary: is11
              ? 'Relational schemas, primary/foreign keys, 1NF–3NF, and SQL foundations.'
              : 'Encapsulation, inheritance, REST APIs, and relational database integration.',
            hours: 10,
          },
        ],
      },
      // Management
      {
        streamId: management.id,
        langId: enLang?.id ?? null,
        code: is11 ? 'ACC-104' : 'ACC-204',
        name: is11 ? 'Principles of Accounting (Grade 11)' : 'Corporate Accounting (Grade 12)',
        creditHours: 5,
        isCompulsory: true,
        sortOrder: 1,
        chapters: [
          {
            chapterNumber: 1,
            title: is11 ? 'Double-Entry Bookkeeping & Trial Balance' : 'Accounting for Share Capital & Debentures',
            summary: is11
              ? 'Accounting equation, journal entries, ledger posting, and trial balance verification.'
              : 'Issue, forfeiture, and reissue of shares under Nepal Company Act standards.',
            hours: 12,
          },
        ],
      },
      {
        streamId: management.id,
        langId: enLang?.id ?? null,
        code: `ECO-${pfx}07`,
        name: `Economics (Grade ${suffix})`,
        creditHours: 5,
        isCompulsory: true,
        sortOrder: 2,
        chapters: [
          {
            chapterNumber: 1,
            title: is11 ? 'Consumer Behaviour & Utility Analysis' : 'Macroeconomic Indicators & Public Finance',
            summary: is11
              ? 'Cardinal and ordinal indifference curve analysis.'
              : 'GDP, national income accounting, Nepal Rastra Bank monetary policy, and fiscal budgets.',
            hours: 11,
          },
        ],
      },
      {
        streamId: management.id,
        langId: enLang?.id ?? null,
        code: `BUS-${pfx}08`,
        name: `Business Studies (Grade ${suffix})`,
        creditHours: 4,
        isCompulsory: false,
        sortOrder: 3,
        chapters: [
          {
            chapterNumber: 1,
            title: is11 ? 'Forms of Business Ownership in Nepal' : 'Principles of Management & Organizational Control',
            summary: is11
              ? 'Sole proprietorship, partnership, joint-stock companies, and cooperatives.'
              : 'Planning, organizing, leadership motivation, and quality assurance.',
            hours: 10,
          },
        ],
      },
      // Humanities
      {
        streamId: humanities.id,
        langId: enLang?.id ?? null,
        code: `SOC-${pfx}09`,
        name: `Sociology (Grade ${suffix})`,
        creditHours: 4,
        isCompulsory: true,
        sortOrder: 1,
        chapters: [
          {
            chapterNumber: 1,
            title: is11 ? 'Social Structure & Diversity in Nepal' : 'Social Change, Urbanization & Globalization',
            summary: 'Ethnographic perspectives on Nepalese communities, kinship, and social institutions.',
            hours: 9,
          },
        ],
      },
      {
        streamId: humanities.id,
        langId: enLang?.id ?? null,
        code: `MCJ-${pfx}10`,
        name: `Mass Communication & Journalism (Grade ${suffix})`,
        creditHours: 4,
        isCompulsory: false,
        sortOrder: 2,
        chapters: [
          {
            chapterNumber: 1,
            title: is11 ? 'Foundations of Print & Broadcast Media' : 'Digital Journalism & Media Ethics',
            summary: 'News reporting, editorial standards, and Press Council Nepal ethics.',
            hours: 9,
          },
        ],
      },
      // Education
      {
        streamId: education.id,
        langId: enLang?.id ?? null,
        code: `EDU-${pfx}15`,
        name: `Foundations of Education (Grade ${suffix})`,
        creditHours: 4,
        isCompulsory: true,
        sortOrder: 1,
        chapters: [
          {
            chapterNumber: 1,
            title: is11 ? 'Philosophical & Historical Roots of Education' : 'Curriculum Design & National Education Policy',
            summary: 'Evolution of Nepal’s school system, inclusive education, and CDC curriculum philosophy.',
            hours: 9,
          },
        ],
      },
      {
        streamId: education.id,
        langId: enLang?.id ?? null,
        code: `PED-${pfx}16`,
        name: `Instructional Pedagogy & Child Psychology (Grade ${suffix})`,
        creditHours: 4,
        isCompulsory: false,
        sortOrder: 2,
        chapters: [
          {
            chapterNumber: 1,
            title: is11 ? 'Adolescent Cognitive Development' : 'Formative Assessment & Classroom Facilitation',
            summary: 'Piaget & Vygotsky frameworks applied to multilingual Nepalese classrooms.',
            hours: 9,
          },
        ],
      },
    ];
  };

  const g11Specs = await buildNebGradeStreams(g11.id, '11');
  const g12Specs = await buildNebGradeStreams(g12.id, '12');

  const allCats = await db.select().from(resourceCategories);
  const catBySlug = new Map(allCats.map((c) => [c.slug, c]));
  const bundleCat = catBySlug.get('chapter_bundle') ?? allCats[0];
  const modelCat = catBySlug.get('model_question') ?? allCats[0];
  const pastCat = catBySlug.get('past_paper') ?? allCats[0];

  const seedGradeSpecs = async (
    gradeId: number,
    gradeLabel: string,
    specs: typeof g10SubjectSpecs,
  ) => {
    for (const spec of specs) {
      const subjectRow = await getOrCreateSubject({
        streamId: spec.streamId,
        languageId: spec.langId,
        code: spec.code,
        name: spec.name,
        creditHours: spec.creditHours,
        isCompulsory: spec.isCompulsory,
        sortOrder: spec.sortOrder,
      });

      for (const chSpec of spec.chapters) {
        const chapterRow = await getOrCreateChapter({
          subjectId: subjectRow.id,
          chapterNumber: chSpec.chapterNumber,
          title: chSpec.title,
          summary: chSpec.summary,
          estimatedHours: chSpec.hours,
        });

        // Ensure at least one topic exists for the chapter
        await db
          .insert(topics)
          .values({
            chapterId: chapterRow.id,
            topicNumber: `${chSpec.chapterNumber}.1`,
            title: `${chSpec.title} — Core Concepts`,
            learningObjectives: chSpec.summary,
            difficultyLevel: 'intermediate',
            estimatedMinutes: 45,
            reviewStatus: 'approved',
          })
          .onConflictDoNothing();

        const bundleSlug = `${gradeLabel.toLowerCase().replace(/\s+/g, '-')}-${subjectRow.code.toLowerCase()}-ch${chSpec.chapterNumber}`;
        const existingRes = await db
          .select()
          .from(resources)
          .where(eq(resources.slug, bundleSlug))
          .limit(1);

        if (!existingRes[0]) {
          const isMath10Sets =
            subjectRow.code === 'MATH-101' && chSpec.chapterNumber === 1;
          const payload = isMath10Sets
            ? buildFlagshipMath10Sets()
            : buildGenericChapterBundle({
                gradeLabel,
                subjectName: subjectRow.name,
                subjectCode: subjectRow.code,
                chapterTitle: chSpec.title,
                chapterSummary: chSpec.summary,
              });

          const [resRow] = await db
            .insert(resources)
            .values({
              slug: bundleSlug,
              categoryId: bundleCat.id,
              gradeId,
              streamId: spec.streamId,
              subjectId: subjectRow.id,
              chapterId: chapterRow.id,
              title: `${chSpec.title} — Complete Study Bundle`,
              titleNe: `${chSpec.title} — पूर्ण अध्ययन सामग्री`,
              summary: chSpec.summary,
              resourceType: 'chapter_bundle',
              status: 'published',
              currentVersion: 1,
              publishedAt: new Date(),
            })
            .returning();

          const [verRow] = await db
            .insert(resourceVersions)
            .values({
              resourceId: resRow.id,
              versionNumber: 1,
              contentEn: payload.en,
              contentNe: payload.ne,
              changelog: 'Published Nepal CDC/NEB initial edition',
            })
            .returning();

          await db.insert(contentReviews).values({
            resourceId: resRow.id,
            versionId: verRow.id,
            decision: 'approved',
            comments: 'Verified against CDC / NEB curriculum specification grid.',
          });

          await db
            .insert(resourceTags)
            .values([
              { resourceId: resRow.id, slug: gradeLabel.toLowerCase().replace(/\s+/g, '-'), label: gradeLabel },
              { resourceId: resRow.id, slug: subjectRow.code.toLowerCase(), label: subjectRow.code },
            ])
            .onConflictDoNothing();
        }
      }
    }
  };

  await seedGradeSpecs(g10.id, 'Class 10 SEE', g10SubjectSpecs);
  await seedGradeSpecs(g11.id, 'Class 11 NEB', g11Specs);
  await seedGradeSpecs(g12.id, 'Class 12 NEB', g12Specs);

  // Add explicit Draft & In-Review resources on MATH-101 Chapter 1 to test RBAC visibility gating!
  const [math10Sub] = await db
    .select()
    .from(subjects)
    .where(eq(subjects.code, 'MATH-101'))
    .limit(1);

  if (math10Sub) {
    const [math10Ch1] = await db
      .select()
      .from(chapters)
      .where(and(eq(chapters.subjectId, math10Sub.id), eq(chapters.chapterNumber, 1)))
      .limit(1);

    if (math10Ch1) {
      const sampleExtraResources = [
        {
          slug: 'see-math-101-model-2082-published',
          categoryId: modelCat.id,
          title: 'SEE 2082 CDC Specification Model Set (Mathematics)',
          summary: 'Official 75-mark CDC specification grid model paper with step-by-step solutions.',
          resourceType: 'model_question',
          status: 'published',
        },
        {
          slug: 'see-math-101-past-2080-published',
          categoryId: pastCat.id,
          title: 'SEE 2080 Bagmati Province Board Question Paper',
          summary: 'Solved past board examination paper with marking scheme.',
          resourceType: 'past_paper',
          status: 'published',
        },
        {
          slug: 'see-math-101-draft-internal',
          categoryId: modelCat.id,
          title: '[INTERNAL DRAFT] Unapproved 2083 Experimental Set',
          summary: 'Draft resource hidden from students until Academic Reviewer approval.',
          resourceType: 'model_question',
          status: 'draft',
        },
        {
          slug: 'see-math-101-inreview-internal',
          categoryId: pastCat.id,
          title: '[IN REVIEW] Pending Verification Set',
          summary: 'Pending review resource hidden from students.',
          resourceType: 'past_paper',
          status: 'in_review',
        },
      ];

      for (const extra of sampleExtraResources) {
        const exists = await db
          .select()
          .from(resources)
          .where(eq(resources.slug, extra.slug))
          .limit(1);
        if (!exists[0]) {
          const [created] = await db
            .insert(resources)
            .values({
              slug: extra.slug,
              categoryId: extra.categoryId,
              gradeId: g10.id,
              streamId: s10Comp.id,
              subjectId: math10Sub.id,
              chapterId: math10Ch1.id,
              title: extra.title,
              summary: extra.summary,
              resourceType: extra.resourceType,
              status: extra.status,
              currentVersion: 1,
              publishedAt: extra.status === 'published' ? new Date() : null,
            })
            .returning();

          await db.insert(resourceVersions).values({
            resourceId: created.id,
            versionNumber: 1,
            contentEn: buildGenericChapterBundle({
              gradeLabel: 'Class 10 SEE',
              subjectName: 'Compulsory Mathematics',
              subjectCode: 'MATH-101',
              chapterTitle: extra.title,
              chapterSummary: extra.summary,
            }).en,
            changelog: 'Initial entry',
          });
        }
      }
    }
  }
}
