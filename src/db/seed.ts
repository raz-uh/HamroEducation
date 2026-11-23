import { eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  chapters,
  countries,
  curricula,
  educationLevels,
  grades,
  institutions,
  languages,
  permissions,
  rolePermissions,
  roles,
  streams,
  subjects,
  topics,
} from './schema.ts';
import { PERMISSION_CATALOG, ROLE_CATALOG } from '../lib/rbac.ts';

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  try {
    // 1. Seed Permissions & Roles in bulk
    await db
      .insert(permissions)
      .values(
        PERMISSION_CATALOG.map((perm) => ({
          code: perm.code,
          resource: perm.resource,
          action: perm.action,
          description: perm.description,
        })),
      )
      .onConflictDoNothing({ target: permissions.code });

    await db
      .insert(roles)
      .values(
        ROLE_CATALOG.map((roleDef) => ({
          slug: roleDef.slug,
          name: roleDef.name,
          description: roleDef.description,
          hierarchyTier: roleDef.hierarchyTier,
          scopeType: roleDef.scopeType,
          isSystemRole: true,
        })),
      )
      .onConflictDoNothing({ target: roles.slug });

    const [allRoles, allPerms] = await Promise.all([
      db.select().from(roles),
      db.select().from(permissions),
    ]);
    const roleBySlug = new Map(allRoles.map((r) => [r.slug, r]));
    const permByCode = new Map(allPerms.map((p) => [p.code, p]));

    const rolePermPairs: Array<{ roleId: number; permissionId: number }> = [];
    for (const roleDef of ROLE_CATALOG) {
      const roleRow = roleBySlug.get(roleDef.slug);
      if (!roleRow) continue;
      for (const permCode of roleDef.permissions) {
        const permRow = permByCode.get(permCode);
        if (!permRow) continue;
        rolePermPairs.push({ roleId: roleRow.id, permissionId: permRow.id });
      }
    }

    if (rolePermPairs.length > 0) {
      await db.insert(rolePermissions).values(rolePermPairs).onConflictDoNothing();
    }

    // 2. Check if countries are already seeded
    const existingCountries = await db.select({ count: sql<number>`count(*)::int` }).from(countries);
    if ((existingCountries[0]?.count ?? 0) > 0) {
      return;
    }

    // Seed Countries: Nepal (Primary), India, United Kingdom
    const [nepal] = await db
      .insert(countries)
      .values({
        isoCode: 'NP',
        name: 'Nepal',
        nativeName: 'नेपाल',
        defaultTimezone: 'Asia/Kathmandu',
        phoneCode: '+977',
        currencyCode: 'NPR',
        isPrimary: true,
        isActive: true,
      })
      .returning();

    const [india] = await db
      .insert(countries)
      .values({
        isoCode: 'IN',
        name: 'India',
        nativeName: 'भारत',
        defaultTimezone: 'Asia/Kolkata',
        phoneCode: '+91',
        currencyCode: 'INR',
        isPrimary: false,
        isActive: true,
      })
      .returning();

    const [uk] = await db
      .insert(countries)
      .values({
        isoCode: 'GB',
        name: 'United Kingdom',
        nativeName: 'United Kingdom',
        defaultTimezone: 'Europe/London',
        phoneCode: '+44',
        currencyCode: 'GBP',
        isPrimary: false,
        isActive: true,
      })
      .returning();

    // Seed Languages
    const [npNepali, npEnglish, npMaithili, inEnglish, inHindi, gbEnglish] = await db
      .insert(languages)
      .values([
        {
          countryId: nepal.id,
          isoCode: 'ne',
          name: 'Nepali',
          nativeName: 'नेपाली',
          script: 'Devanagari',
          isDefault: true,
        },
        {
          countryId: nepal.id,
          isoCode: 'en',
          name: 'English (Nepal)',
          nativeName: 'English',
          script: 'Latin',
          isDefault: false,
        },
        {
          countryId: nepal.id,
          isoCode: 'mai',
          name: 'Maithili',
          nativeName: 'मैथिली',
          script: 'Devanagari',
          isDefault: false,
        },
        {
          countryId: india.id,
          isoCode: 'en',
          name: 'English (India)',
          nativeName: 'English',
          script: 'Latin',
          isDefault: true,
        },
        {
          countryId: india.id,
          isoCode: 'hi',
          name: 'Hindi',
          nativeName: 'हिन्दी',
          script: 'Devanagari',
          isDefault: false,
        },
        {
          countryId: uk.id,
          isoCode: 'en',
          name: 'English (UK)',
          nativeName: 'English',
          script: 'Latin',
          isDefault: true,
        },
      ])
      .returning();

    // Seed Institutions
    await db.insert(institutions).values([
      {
        countryId: nepal.id,
        name: 'Budhanilkantha School',
        code: 'NP-BNKS-001',
        institutionType: 'school',
        provinceOrState: 'Bagmati Province',
        city: 'Kathmandu',
        domain: 'bnks.edu.np',
        isVerified: true,
      },
      {
        countryId: nepal.id,
        name: "St. Xavier's College, Maitighar",
        code: 'NP-SXC-002',
        institutionType: 'college',
        provinceOrState: 'Bagmati Province',
        city: 'Kathmandu',
        domain: 'sxc.edu.np',
        isVerified: true,
      },
      {
        countryId: nepal.id,
        name: 'Pokhara Public Secondary School',
        code: 'NP-PPSS-003',
        institutionType: 'school',
        provinceOrState: 'Gandaki Province',
        city: 'Pokhara',
        domain: 'ppss.edu.np',
        isVerified: true,
      },
      {
        countryId: nepal.id,
        name: 'Tribhuvan University Central Campus',
        code: 'NP-TU-004',
        institutionType: 'university',
        provinceOrState: 'Bagmati Province',
        city: 'Kirtipur',
        domain: 'tu.edu.np',
        isVerified: true,
      },
      {
        countryId: india.id,
        name: 'Delhi Public School, R.K. Puram',
        code: 'IN-DPSRKP-001',
        institutionType: 'school',
        provinceOrState: 'Delhi NCR',
        city: 'New Delhi',
        domain: 'dpsrkp.net',
        isVerified: true,
      },
      {
        countryId: uk.id,
        name: 'Westminster Academy',
        code: 'GB-WEST-001',
        institutionType: 'school',
        provinceOrState: 'Greater London',
        city: 'London',
        domain: 'westminsteracademy.org.uk',
        isVerified: true,
      },
    ]);

    // Seed Curricula
    const [npCdc, npCtevt, inCbse, gbGcse] = await db
      .insert(curricula)
      .values([
        {
          countryId: nepal.id,
          languageId: npNepali.id,
          code: 'NP-CDC-NEB',
          name: 'Nepal National Curriculum (CDC / NEB)',
          governingBody: 'Curriculum Development Centre (Sanothimi) & National Examinations Board',
          academicCalendar: 'Bikram Sambat (BS)',
          status: 'published',
        },
        {
          countryId: nepal.id,
          languageId: npEnglish.id,
          code: 'NP-CTEVT',
          name: 'CTEVT Technical & Vocational Track',
          governingBody: 'Council for Technical Education and Vocational Training',
          academicCalendar: 'Bikram Sambat (BS)',
          status: 'published',
        },
        {
          countryId: india.id,
          languageId: inEnglish.id,
          code: 'IN-CBSE',
          name: 'CBSE National Curriculum (NCERT)',
          governingBody: 'Central Board of Secondary Education',
          academicCalendar: 'Gregorian (AD)',
          status: 'published',
        },
        {
          countryId: uk.id,
          languageId: gbEnglish.id,
          code: 'GB-NC-GCSE',
          name: 'UK National Curriculum & GCSE',
          governingBody: 'Department for Education & Ofqual',
          academicCalendar: 'Gregorian (AD)',
          status: 'published',
        },
      ])
      .returning();

    // Seed Education Levels for Nepal CDC/NEB
    const [npBasic, npSecondary, npHigherSec] = await db
      .insert(educationLevels)
      .values([
        {
          curriculumId: npCdc.id,
          code: 'basic',
          name: 'Basic Level (Grades 1–8 / BLE)',
          sortOrder: 1,
        },
        {
          curriculumId: npCdc.id,
          code: 'secondary',
          name: 'Secondary Level (Grades 9–10 / SEE)',
          sortOrder: 2,
        },
        {
          curriculumId: npCdc.id,
          code: 'higher_secondary',
          name: 'Higher Secondary (+2 / NEB Grades 11–12)',
          sortOrder: 3,
        },
      ])
      .returning();

    // CTEVT Level
    const [ctevtDiploma] = await db
      .insert(educationLevels)
      .values([
        {
          curriculumId: npCtevt.id,
          code: 'diploma',
          name: 'Diploma in Engineering (3-Year)',
          sortOrder: 1,
        },
      ])
      .returning();

    // India & UK Levels
    const [inSec] = await db
      .insert(educationLevels)
      .values([
        {
          curriculumId: inCbse.id,
          code: 'senior_secondary',
          name: 'Senior Secondary (Classes 11–12)',
          sortOrder: 1,
        },
      ])
      .returning();

    const [gbKs4] = await db
      .insert(educationLevels)
      .values([
        {
          curriculumId: gbGcse.id,
          code: 'key_stage_4',
          name: 'Key Stage 4 (GCSE)',
          sortOrder: 1,
        },
      ])
      .returning();

    // Seed Grades
    const [g8, g10, g11, g12, gCtevt1, gIn12, gUk11] = await db
      .insert(grades)
      .values([
        { educationLevelId: npBasic.id, code: 'G8', name: 'Grade 8 (BLE)', numericLevel: 8, sortOrder: 1 },
        { educationLevelId: npSecondary.id, code: 'G10', name: 'Grade 10 (SEE)', numericLevel: 10, sortOrder: 1 },
        { educationLevelId: npHigherSec.id, code: 'G11', name: 'Grade 11 (+2 NEB)', numericLevel: 11, sortOrder: 1 },
        { educationLevelId: npHigherSec.id, code: 'G12', name: 'Grade 12 (+2 NEB)', numericLevel: 12, sortOrder: 2 },
        { educationLevelId: ctevtDiploma.id, code: 'Y1', name: 'First Year Diploma', numericLevel: 11, sortOrder: 1 },
        { educationLevelId: inSec.id, code: 'C12', name: 'Class 12 (CBSE Board)', numericLevel: 12, sortOrder: 1 },
        { educationLevelId: gbKs4.id, code: 'Y11', name: 'Year 11 (GCSE)', numericLevel: 11, sortOrder: 1 },
      ])
      .returning();

    // Seed Streams
    const [sG8Gen, sG10Gen, sG11Sci, sG11Mgmt, sG12Sci, sG12Mgmt, sCtevtComp, sInSci, sUkStem] =
      await db
        .insert(streams)
        .values([
          {
            gradeId: g8.id,
            code: 'general',
            name: 'General Compulsory (BLE)',
            description: 'National core foundation prescribed by CDC Sanothimi.',
            sortOrder: 1,
          },
          {
            gradeId: g10.id,
            code: 'see_general',
            name: 'SEE Core & Optional Stream',
            description: 'Secondary Education Examination national board track.',
            sortOrder: 1,
          },
          {
            gradeId: g11.id,
            code: 'science',
            name: 'Science (Physical & Biological)',
            description: 'NEB +2 Science track preparing for Engineering, Medicine, and Pure Sciences.',
            sortOrder: 1,
          },
          {
            gradeId: g11.id,
            code: 'management',
            name: 'Management & Commerce',
            description: 'NEB +2 Accountancy, Economics, and Business Studies.',
            sortOrder: 2,
          },
          {
            gradeId: g12.id,
            code: 'science',
            name: 'Science (Physical & Biological)',
            description: 'Final NEB Board Examination track for Grade 12 Science.',
            sortOrder: 1,
          },
          {
            gradeId: g12.id,
            code: 'management',
            name: 'Management & Finance',
            description: 'Final NEB Board track for Grade 12 Management.',
            sortOrder: 2,
          },
          {
            gradeId: gCtevt1.id,
            code: 'computer_eng',
            name: 'Computer Engineering',
            description: 'Applied technical computing and hardware fundamentals.',
            sortOrder: 1,
          },
          {
            gradeId: gIn12.id,
            code: 'pcm',
            name: 'Science (PCM)',
            description: 'Physics, Chemistry, and Mathematics NCERT track.',
            sortOrder: 1,
          },
          {
            gradeId: gUk11.id,
            code: 'stem',
            name: 'GCSE STEM Core',
            description: 'Key Stage 4 Mathematics and Combined Sciences.',
            sortOrder: 1,
          },
        ])
        .returning();

    // Seed Subjects
    const [
      subG8Math,
      subG10Math,
      subG10Sci,
      subG10Nep,
      subG11Phy,
      subG11Chem,
      subG11Cs,
      subG11Acc,
      subG12Phy,
      subG12Math,
      subG12Acc,
      subCtevtC,
      subInPhy,
      subUkMath,
    ] = await db
      .insert(subjects)
      .values([
        {
          streamId: sG8Gen.id,
          languageId: npNepali.id,
          code: 'MATH-801',
          name: 'Compulsory Mathematics (Grade 8)',
          creditHours: 5,
          isCompulsory: true,
          sortOrder: 1,
        },
        {
          streamId: sG10Gen.id,
          languageId: npEnglish.id,
          code: 'MATH-101',
          name: 'Compulsory Mathematics (SEE)',
          creditHours: 5,
          isCompulsory: true,
          sortOrder: 1,
        },
        {
          streamId: sG10Gen.id,
          languageId: npEnglish.id,
          code: 'SCI-102',
          name: 'Science & Technology (SEE)',
          creditHours: 5,
          isCompulsory: true,
          sortOrder: 2,
        },
        {
          streamId: sG10Gen.id,
          languageId: npNepali.id,
          code: 'NEP-103',
          name: 'अनिवार्य नेपाली (Compulsory Nepali)',
          creditHours: 5,
          isCompulsory: true,
          sortOrder: 3,
        },
        {
          streamId: sG11Sci.id,
          languageId: npEnglish.id,
          code: 'PHY-101',
          name: 'Physics (Grade 11)',
          creditHours: 5,
          isCompulsory: true,
          sortOrder: 1,
        },
        {
          streamId: sG11Sci.id,
          languageId: npEnglish.id,
          code: 'CHM-102',
          name: 'Chemistry (Grade 11)',
          creditHours: 5,
          isCompulsory: true,
          sortOrder: 2,
        },
        {
          streamId: sG11Sci.id,
          languageId: npEnglish.id,
          code: 'CSC-103',
          name: 'Computer Science (Grade 11)',
          creditHours: 4,
          isCompulsory: false,
          sortOrder: 3,
        },
        {
          streamId: sG11Mgmt.id,
          languageId: npEnglish.id,
          code: 'ACC-104',
          name: 'Principles of Accounting (Grade 11)',
          creditHours: 5,
          isCompulsory: true,
          sortOrder: 1,
        },
        {
          streamId: sG12Sci.id,
          languageId: npEnglish.id,
          code: 'PHY-201',
          name: 'Physics (Grade 12 NEB)',
          creditHours: 5,
          isCompulsory: true,
          sortOrder: 1,
        },
        {
          streamId: sG12Sci.id,
          languageId: npEnglish.id,
          code: 'MAT-202',
          name: 'Mathematics (Grade 12 NEB)',
          creditHours: 5,
          isCompulsory: true,
          sortOrder: 2,
        },
        {
          streamId: sG12Mgmt.id,
          languageId: npEnglish.id,
          code: 'ACC-204',
          name: 'Corporate Accounting (Grade 12)',
          creditHours: 5,
          isCompulsory: true,
          sortOrder: 1,
        },
        {
          streamId: sCtevtComp.id,
          languageId: npEnglish.id,
          code: 'CT-110',
          name: 'Structured Programming in C',
          creditHours: 4,
          isCompulsory: true,
          sortOrder: 1,
        },
        {
          streamId: sInSci.id,
          languageId: inEnglish.id,
          code: 'CBSE-PHY-12',
          name: 'Physics Part I & II (NCERT)',
          creditHours: 5,
          isCompulsory: true,
          sortOrder: 1,
        },
        {
          streamId: sUkStem.id,
          languageId: gbEnglish.id,
          code: 'GCSE-MAT-H',
          name: 'GCSE Mathematics (Higher Tier)',
          creditHours: 4,
          isCompulsory: true,
          sortOrder: 1,
        },
      ])
      .returning();

    // Seed Chapters
    const [
      chG8Sets,
      chG10Sets,
      chG10Trig,
      chG10SciForce,
      chG10NepByakaran,
      chG11Kinematics,
      chG11Thermo,
      chG11Atom,
      chG11Dbms,
      chG11Journal,
      chG12Rotational,
      chG12Waves,
      chG12Calculus,
      chG12Shares,
      chCtevtPointers,
      chInElectro,
      chUkAlgebra,
    ] = await db
      .insert(chapters)
      .values([
        {
          subjectId: subG8Math.id,
          chapterNumber: 1,
          title: 'Sets and Number Systems',
          summary: 'Venn diagrams, subsets, and rational number operations for BLE readiness.',
          estimatedHours: 8,
        },
        {
          subjectId: subG10Math.id,
          chapterNumber: 1,
          title: 'Sets (Cardinality & Real-World Problems)',
          summary: 'Two-set and three-set cardinality equations frequently tested in SEE Section A/C.',
          estimatedHours: 10,
        },
        {
          subjectId: subG10Math.id,
          chapterNumber: 2,
          title: 'Trigonometry: Heights and Distances',
          summary: 'Angles of elevation and depression applied to Himalayan terrain and survey problems.',
          estimatedHours: 12,
        },
        {
          subjectId: subG10Sci.id,
          chapterNumber: 1,
          title: 'Force, Gravitation, and Motion',
          summary: 'Newton’s Universal Law of Gravitation, free fall, and weight variations across altitude.',
          estimatedHours: 10,
        },
        {
          subjectId: subG10Nep.id,
          chapterNumber: 1,
          title: 'नेपाली व्याकरण र शब्द निर्माण (Grammar & Morphology)',
          summary: 'उपसर्ग, प्रत्यय, समास र वाक्य संश्लेषणको अभ्यास।',
          estimatedHours: 8,
        },
        {
          subjectId: subG11Phy.id,
          chapterNumber: 1,
          title: 'Vectors and Kinematics',
          summary: 'Vector resolution, projectile trajectories, and relative velocity.',
          estimatedHours: 12,
        },
        {
          subjectId: subG11Phy.id,
          chapterNumber: 2,
          title: 'Heat and Thermodynamics',
          summary: 'Thermal expansion, calorimetry, and laws of thermodynamics.',
          estimatedHours: 14,
        },
        {
          subjectId: subG11Chem.id,
          chapterNumber: 1,
          title: 'Atomic Structure & Chemical Bonding',
          summary: 'Quantum numbers, Bohr atomic model, and hybridization.',
          estimatedHours: 12,
        },
        {
          subjectId: subG11Cs.id,
          chapterNumber: 1,
          title: 'Database Management Systems & Normalization',
          summary: 'Relational schemas, primary/foreign keys, 1NF–3NF, and SQL foundations.',
          estimatedHours: 10,
        },
        {
          subjectId: subG11Acc.id,
          chapterNumber: 1,
          title: 'Double-Entry Bookkeeping & Trial Balance',
          summary: 'Accounting equation, journal entries, ledger posting, and trial balance verification.',
          estimatedHours: 12,
        },
        {
          subjectId: subG12Phy.id,
          chapterNumber: 1,
          title: 'Rotational Dynamics',
          summary: 'Moment of inertia, torque, angular momentum conservation, and rolling motion.',
          estimatedHours: 14,
        },
        {
          subjectId: subG12Phy.id,
          chapterNumber: 2,
          title: 'Wave Optics & Interference',
          summary: 'Huygens principle, Young’s double-slit experiment, and diffraction gratings.',
          estimatedHours: 12,
        },
        {
          subjectId: subG12Math.id,
          chapterNumber: 1,
          title: 'Antiderivatives and Differential Equations',
          summary: 'Integration by parts, definite integrals, and first-order linear differential equations.',
          estimatedHours: 16,
        },
        {
          subjectId: subG12Acc.id,
          chapterNumber: 1,
          title: 'Accounting for Share Capital & Debentures',
          summary: 'Issue, forfeiture, and reissue of shares under Nepal Company Act standards.',
          estimatedHours: 14,
        },
        {
          subjectId: subCtevtC.id,
          chapterNumber: 1,
          title: 'Pointers and Dynamic Memory in C',
          summary: 'Pointer arithmetic, arrays, and malloc/free memory management.',
          estimatedHours: 10,
        },
        {
          subjectId: subInPhy.id,
          chapterNumber: 1,
          title: 'Electric Charges and Fields',
          summary: 'Coulomb’s law, electric flux, and Gauss’s law applications.',
          estimatedHours: 14,
        },
        {
          subjectId: subUkMath.id,
          chapterNumber: 1,
          title: 'Quadratic Equations & Algebraic Proof',
          summary: 'Completing the square, quadratic formula, and algebraic reasoning.',
          estimatedHours: 10,
        },
      ])
      .returning();

    // Seed Topics
    await db.insert(topics).values([
      {
        chapterId: chG8Sets.id,
        topicNumber: '1.1',
        title: 'Subset Enumeration & Venn Representation',
        learningObjectives: 'Construct two-set Venn diagrams and derive proper subset counts.',
        difficultyLevel: 'foundational',
        estimatedMinutes: 40,
      },
      {
        chapterId: chG10Sets.id,
        topicNumber: '1.1',
        title: 'Two-Set & Three-Set Cardinality Identities',
        learningObjectives: 'Solve n(A ∪ B ∪ C) word problems with complements and intersections for SEE.',
        difficultyLevel: 'intermediate',
        estimatedMinutes: 45,
      },
      {
        chapterId: chG10Trig.id,
        topicNumber: '2.1',
        title: 'Clinometer Angles of Elevation & Depression',
        learningObjectives: 'Compute tower and mountain heights using tan θ ratios from dual observation points.',
        difficultyLevel: 'intermediate',
        estimatedMinutes: 50,
      },
      {
        chapterId: chG10SciForce.id,
        topicNumber: '1.1',
        title: 'Variation of Acceleration Due to Gravity (g)',
        learningObjectives: 'Analyze how g changes with planetary radius, altitude from Mount Everest to Terai, and depth.',
        difficultyLevel: 'intermediate',
        estimatedMinutes: 45,
      },
      {
        chapterId: chG10NepByakaran.id,
        topicNumber: '1.1',
        title: 'तत्सम, तद्भव र आगन्तुक शब्द पहिचान',
        learningObjectives: 'नेपाली शब्द भण्डारको वर्गीकरण र उपसर्ग–प्रत्ययद्वारा शब्द निर्माण गर्ने क्षमता विकास।',
        difficultyLevel: 'foundational',
        estimatedMinutes: 40,
      },
      {
        chapterId: chG11Kinematics.id,
        topicNumber: '1.1',
        title: 'Triangle & Parallelogram Law of Vector Addition',
        learningObjectives: 'Derive resultant magnitude and direction analytically and resolve orthogonal components.',
        difficultyLevel: 'intermediate',
        estimatedMinutes: 50,
      },
      {
        chapterId: chG11Kinematics.id,
        topicNumber: '1.2',
        title: 'Projectile Motion on Horizontal & Inclined Planes',
        learningObjectives: 'Derive time of flight, maximum height, horizontal range, and parabolic trajectory equation.',
        difficultyLevel: 'advanced',
        estimatedMinutes: 60,
      },
      {
        chapterId: chG11Thermo.id,
        topicNumber: '2.1',
        title: 'First Law of Thermodynamics & Specific Heats',
        learningObjectives: 'Relate internal energy, work done, and derive Mayer’s relation Cp − Cv = R.',
        difficultyLevel: 'intermediate',
        estimatedMinutes: 55,
      },
      {
        chapterId: chG11Atom.id,
        topicNumber: '1.1',
        title: 'Quantum Numbers & Pauli Exclusion Principle',
        learningObjectives: 'Assign n, l, m, s quantum numbers and write electronic configurations up to Z = 36.',
        difficultyLevel: 'intermediate',
        estimatedMinutes: 45,
      },
      {
        chapterId: chG11Dbms.id,
        topicNumber: '1.1',
        title: 'Entity-Relationship Modeling & Foreign Keys',
        learningObjectives: 'Map real-world educational hierarchies to normalized relational tables with referential integrity.',
        difficultyLevel: 'intermediate',
        estimatedMinutes: 50,
      },
      {
        chapterId: chG11Journal.id,
        topicNumber: '1.1',
        title: 'Golden Rules of Debit & Credit',
        learningObjectives: 'Classify personal, real, and nominal accounts and journalize business transactions.',
        difficultyLevel: 'foundational',
        estimatedMinutes: 45,
      },
      {
        chapterId: chG12Rotational.id,
        topicNumber: '1.1',
        title: 'Moment of Inertia & Parallel/Perpendicular Axis Theorems',
        learningObjectives: 'Compute moment of inertia for uniform rods, discs, rings, and solid spheres.',
        difficultyLevel: 'advanced',
        estimatedMinutes: 60,
      },
      {
        chapterId: chG12Rotational.id,
        topicNumber: '1.2',
        title: 'Conservation of Angular Momentum',
        learningObjectives: 'Apply L = Iω conservation to rotating systems and derive rotational kinetic energy.',
        difficultyLevel: 'intermediate',
        estimatedMinutes: 50,
      },
      {
        chapterId: chG12Waves.id,
        topicNumber: '2.1',
        title: 'Fringe Width in Young’s Double-Slit Experiment',
        learningObjectives: 'Derive path difference and fringe separation β = λD/d for coherent monochromatic sources.',
        difficultyLevel: 'advanced',
        estimatedMinutes: 55,
      },
      {
        chapterId: chG12Calculus.id,
        topicNumber: '1.1',
        title: 'Linear First-Order Differential Equations',
        learningObjectives: 'Compute integrating factors and solve dy/dx + P(x)y = Q(x) initial value problems.',
        difficultyLevel: 'advanced',
        estimatedMinutes: 60,
      },
      {
        chapterId: chG12Shares.id,
        topicNumber: '1.1',
        title: 'Pro-Rata Allotment & Forfeiture of Shares',
        learningObjectives: 'Prepare journal entries for oversubscribed share applications and capital reserve transfers.',
        difficultyLevel: 'intermediate',
        estimatedMinutes: 50,
      },
      {
        chapterId: chCtevtPointers.id,
        topicNumber: '1.1',
        title: 'Call by Reference & Pointer Arithmetic',
        learningObjectives: 'Manipulate memory addresses safely in C functions and array traversal.',
        difficultyLevel: 'intermediate',
        estimatedMinutes: 45,
      },
      {
        chapterId: chInElectro.id,
        topicNumber: '1.1',
        title: 'Gauss’s Law for Spherical & Cylindrical Symmetry',
        learningObjectives: 'Calculate electric field intensity inside and outside charged shells using Gaussian surfaces.',
        difficultyLevel: 'advanced',
        estimatedMinutes: 55,
      },
      {
        chapterId: chUkAlgebra.id,
        topicNumber: '1.1',
        title: 'Turning Points via Completing the Square',
        learningObjectives: 'Transform ax² + bx + c into vertex form to identify parabola extrema.',
        difficultyLevel: 'intermediate',
        estimatedMinutes: 45,
      },
    ]);
  } catch (error) {
    console.error('Database seed failed:', error);
    throw new Error('Failed to initialize curriculum and RBAC seed data.', {
      cause: error,
    });
  }
}
