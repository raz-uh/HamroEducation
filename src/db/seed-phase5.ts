import { sql } from 'drizzle-orm';
import { db } from './index.ts';
import { flashcards } from './schema.ts';

interface CuratedFlashcardSeed {
  category: 'definition' | 'formula' | 'important_fact' | 'vocabulary';
  academicLevel: string;
  subjectName: string;
  chapterName: string;
  frontText: string;
  backText: string;
  hintText: string;
}

const CURATED_FLASHCARDS_SEED: CuratedFlashcardSeed[] = [
  {
    category: 'formula',
    academicLevel: 'SEE / Class 10',
    subjectName: 'Compulsory Mathematics',
    chapterName: 'Sets',
    frontText: 'Two-Set Cardinality Identity: n(A ∪ B)',
    backText: 'n(A ∪ B) = n(A) + n(B) − n(A ∩ B) = n₀(A) + n(A ∩ B) + n₀(B)',
    hintText: 'Subtract the intersection once so overlapping elements are not double-counted.',
  },
  {
    category: 'formula',
    academicLevel: 'SEE / Class 10',
    subjectName: 'Compulsory Mathematics',
    chapterName: 'Compound Interest & Depreciation',
    frontText: 'Annual Compound Amount & Interest Formula',
    backText: 'CA = P(1 + R/100)^T and CI = P[(1 + R/100)^T − 1]. For semi-annual compounding, use R/2 and 2T.',
    hintText: 'Depreciation replaces +R with −R.',
  },
  {
    category: 'definition',
    academicLevel: 'SEE / Class 10',
    subjectName: 'Science & Technology',
    chapterName: 'Force & Gravitation',
    frontText: 'Universal Law of Gravitation & Acceleration Due to Gravity',
    backText: 'F = G·m₁·m₂ / d² where G = 6.67 × 10⁻¹¹ N·m²/kg². Surface gravity g = GM/R² (inversely proportional to R²).',
    hintText: 'Earth g ≈ 9.8 m/s² at sea level; slightly higher at poles than the equator.',
  },
  {
    category: 'formula',
    academicLevel: 'Class 12 / IOE Entrance',
    subjectName: 'Physics',
    chapterName: 'Rotational Dynamics',
    frontText: 'Moment of Inertia of Solid Cylinder & Solid Sphere about Central Axis',
    backText: 'Solid Cylinder / Disc: I = ½MR². Solid Sphere: I = ⅖MR². Thin Ring / Hoop: I = MR².',
    hintText: 'Solid sphere has smaller rotational inertia coefficient (0.4 vs 0.5) so it rolls faster down an incline.',
  },
  {
    category: 'formula',
    academicLevel: 'Class 12 / IOE Entrance',
    subjectName: 'Physics',
    chapterName: 'Electrostatics & Capacitance',
    frontText: 'Energy Stored & Dielectric Effect in a Parallel Plate Capacitor',
    backText: 'C = ε₀A/d; with dielectric k, C′ = kC. Energy U = ½CV² = Q²/(2C). Disconnected battery keeps Q constant, so U drops by factor 1/k.',
    hintText: 'Always check whether the battery stays connected (V constant) or disconnected (Q constant).',
  },
  {
    category: 'important_fact',
    academicLevel: 'Class 12 / MECEE-BL',
    subjectName: 'Biology',
    chapterName: 'Cell Cycle & Genetics',
    frontText: 'DNA Replication Phase & Crossing Over Stage',
    backText: 'DNA synthesis (replication) occurs during S-phase of Interphase. Crossing over between non-sister chromatids occurs in Pachytene of Prophase I.',
    hintText: 'Meiosis I is reductional; Pachytene follows Zygotene.',
  },
  {
    category: 'definition',
    academicLevel: 'Class 12 / BSc CSIT',
    subjectName: 'Computer Science',
    chapterName: 'Database Normalization',
    frontText: 'Second Normal Form (2NF) vs Third Normal Form (3NF)',
    backText: '2NF removes partial dependencies on composite primary keys (already in 1NF). 3NF removes transitive dependencies between non-key attributes.',
    hintText: 'Key mnemonic: "The key, the whole key (2NF), and nothing but the key (3NF)."',
  },
  {
    category: 'important_fact',
    academicLevel: 'Class 12 / NEB Management',
    subjectName: 'Accountancy',
    chapterName: 'Cash Flow Statement',
    frontText: 'Financing vs Operating Cash Flows under NFRS',
    backText: 'Issue of shares, debentures, and dividend/loan repayments belong to Financing Activities. Cash receipts from customers and supplier payments belong to Operating Activities.',
    hintText: 'Non-cash depreciation is added back to net profit under indirect Operating Cash Flow.',
  },
  {
    category: 'vocabulary',
    academicLevel: 'CMAT / Bachelor Entrance',
    subjectName: 'Verbal Ability',
    chapterName: 'High-Frequency Academic Vocabulary',
    frontText: 'Ubiquitous (adj.) — Meaning & Usage',
    backText: 'Present, appearing, or found everywhere simultaneously. Antonyms: rare, scarce, localized.',
    hintText: 'Common CMAT/KUUMAT synonym-antonym entry.',
  },
  {
    category: 'vocabulary',
    academicLevel: 'CMAT / BSc CSIT English',
    subjectName: 'Verbal Ability',
    chapterName: 'High-Frequency Academic Vocabulary',
    frontText: 'Mitigate (v.) — Meaning & Usage',
    backText: 'To make less severe, painful, or serious (e.g., "mitigate flood risk in the Terai"). Antonyms: aggravate, exacerbate.',
    hintText: 'Think "mild" or "alleviate".',
  },
  {
    category: 'important_fact',
    academicLevel: 'SEE / Class 10',
    subjectName: 'Social Studies',
    chapterName: 'Constitution & Federalism of Nepal',
    frontText: 'Promulgation Date & Structure of Nepal Constitution 2072 BS',
    backText: 'Promulgated on Ashoj 3, 2072 BS (September 20, 2015 AD). Establishes 7 provinces, 753 local levels, and 3 tiers of federal governance.',
    hintText: 'National Constitution Day is observed every Ashoj 3.',
  },
  {
    category: 'formula',
    academicLevel: 'Class 12 / IOE Entrance',
    subjectName: 'Chemistry',
    chapterName: 'Chemical Kinetics & Equilibrium',
    frontText: 'First-Order Half-Life & Kp–Kc Relation',
    backText: 't₁/₂ = 0.693 / k (independent of initial concentration for 1st order). Kp = Kc(RT)^Δn where Δn = gaseous product moles − gaseous reactant moles.',
    hintText: 'When Δn = 0, Kp equals Kc.',
  },
];

let phase5SeedPromise: Promise<void> | null = null;

export async function ensurePhase5Seeded(): Promise<void> {
  if (!phase5SeedPromise) {
    phase5SeedPromise = runPhase5Seed().catch((err) => {
      phase5SeedPromise = null;
      throw err;
    });
  }
  return phase5SeedPromise;
}

async function runPhase5Seed(): Promise<void> {
  const existing = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(flashcards);

  if ((existing[0]?.count ?? 0) >= CURATED_FLASHCARDS_SEED.length) {
    return;
  }

  const existingFronts = await db
    .select({ frontText: flashcards.frontText })
    .from(flashcards);
  const existingSet = new Set(existingFronts.map((f) => f.frontText));

  const toInsert = CURATED_FLASHCARDS_SEED.filter((c) => !existingSet.has(c.frontText)).map(
    (c) => ({
      userId: null,
      parentCuratedId: null,
      isCurated: true,
      category: c.category,
      academicLevel: c.academicLevel,
      subjectName: c.subjectName,
      chapterName: c.chapterName,
      frontText: c.frontText,
      backText: c.backText,
      hintText: c.hintText,
      intervalDays: 1,
      easeFactor: 2.5,
      repetitions: 0,
      nextReviewAt: new Date(),
    }),
  );

  if (toInsert.length > 0) {
    await db.insert(flashcards).values(toInsert);
  }
}
