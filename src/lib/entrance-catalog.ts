export type EntranceCategoryId =
  | 'management'
  | 'it_cs'
  | 'engineering'
  | 'medical_health'
  | 'science'
  | 'law'
  | 'agriculture'
  | 'humanities';

export interface EntranceCategoryMeta {
  id: EntranceCategoryId;
  label: string;
  description: string;
}

export const ENTRANCE_CATEGORIES: EntranceCategoryMeta[] = [
  {
    id: 'management',
    label: 'Management',
    description: 'CMAT (TU), PUMAT (Pokhara Univ), and KUUMAT (Kathmandu Univ) business & finance admissions.',
  },
  {
    id: 'it_cs',
    label: 'IT & Computer Science',
    description: 'B.Sc. CSIT, BIT, and BCA national computing & software engineering entrance tracks.',
  },
  {
    id: 'engineering',
    label: 'Engineering',
    description: 'IOE BE/B.Arch (TU) and KUCAT-CBT (Kathmandu University) engineering admissions.',
  },
  {
    id: 'medical_health',
    label: 'Medical & Health',
    description: 'MECEE-BL common entrance by Medical Education Commission (MBBS, BDS, Nursing, BPH).',
  },
  {
    id: 'science',
    label: 'Science',
    description: 'B.Sc. Pure & Applied Sciences (TU IOST, KU School of Science).',
  },
  {
    id: 'law',
    label: 'Law',
    description: '5-Year BA LL.B integrated legal education entrance (TU, KU, Pokhara, Purbanchal).',
  },
  {
    id: 'agriculture',
    label: 'Agriculture',
    description: 'AFU & TU IAAS B.Sc. Agriculture, Forestry, and Veterinary Science admissions.',
  },
  {
    id: 'humanities',
    label: 'Humanities',
    description: 'BA, BSW, Journalism, Economics, and Liberal Arts university admissions.',
  },
];

export interface EntranceExamProfile {
  slug: string;
  title: string;
  shortName: string;
  category: EntranceCategoryId;
  authority: string;
  mockExamSlug: string | null;
  overview: string;
  degreePrograms: string[];
  eligibility: string[];
  admissionRequirements: string[];
  officialSyllabus: Array<{
    subject: string;
    weightage: string;
    topics: string[];
  }>;
  examinationPattern: {
    totalMarks: number;
    durationText: string;
    totalQuestions: number;
    negativeMarkingText: string;
    negativeMarkingEnabled: boolean;
    format: string;
  };
  topicNotes: Array<{
    topic: string;
    summary: string;
    schoolBridgeLink?: string;
  }>;
  importantDates: Array<{
    milestone: string;
    window: string;
  }>;
  officialLinks: Array<{
    label: string;
    url: string;
  }>;
}

export const ENTRANCE_EXAM_PROFILES: EntranceExamProfile[] = [
  {
    slug: 'cmat',
    title: 'CMAT — Central Management Admission Test',
    shortName: 'CMAT',
    category: 'management',
    authority: 'Faculty of Management (FOM), Tribhuvan University',
    mockExamSlug: 'cmat-mock-1',
    overview:
      'CMAT is Tribhuvan University’s mandatory national entrance test for bachelor management programs across constituent and affiliated campuses including Shanker Dev, Nepal Commerce Campus, and Public Youth Campus.',
    degreePrograms: ['BBA (Bachelor of Business Administration)', 'BIM (Bachelor of Information Management)', 'BBM', 'BHM', 'BTTM', 'BPA'],
    eligibility: [
      'Minimum D+ grade in each subject in NEB Class 11 & 12 (or minimum CGPA 1.8 / 45% in +2 or equivalent).',
      'Open to students from Management, Science, Humanities, or Education +2 streams.',
    ],
    admissionRequirements: [
      'Online CMAT application form & voucher submission via TU FOM portal.',
      'Minimum 40% score in CMAT written test to qualify for campus-level interview & merit list.',
      'Academic transcript + character certificate + personal interview at target college.',
    ],
    officialSyllabus: [
      {
        subject: 'Verbal Ability',
        weightage: '25 Marks (25 MCQs)',
        topics: ['Reading Comprehension', 'Vocabulary & Synonyms/Antonyms', 'Sentence Correction', 'Idioms & Prepositions'],
      },
      {
        subject: 'Quantitative Ability',
        weightage: '25 Marks (25 MCQs)',
        topics: ['Percentages & Profit/Loss', 'Ratio, Proportion & Mixtures', 'Time, Work & Speed', 'Algebra & Probability'],
      },
      {
        subject: 'Logical Reasoning',
        weightage: '25 Marks (25 MCQs)',
        topics: ['Number & Letter Series', 'Syllogisms & Deductions', 'Blood Relations & Direction', 'Data Interpretation'],
      },
      {
        subject: 'General Awareness',
        weightage: '25 Marks (25 MCQs)',
        topics: ['Nepal Economy & NRB Banking', 'Business & Corporate Affairs', 'National Geography & History', 'Global Institutions'],
      },
    ],
    examinationPattern: {
      totalMarks: 100,
      durationText: '90 Minutes (1.5 Hours)',
      totalQuestions: 100,
      negativeMarkingText: 'No negative marking',
      negativeMarkingEnabled: false,
      format: 'OMR / Objective 4-section aptitude test (25 marks per section)',
    },
    topicNotes: [
      {
        topic: 'Profit, Loss & Discount Shortcuts',
        summary: 'Use successive percentage formula a + b + (ab/100) and ratio multipliers to solve CMAT quantitative questions under 35 seconds.',
        schoolBridgeLink: '/school/class-12/ACC-204/1',
      },
      {
        topic: 'Nepal Rastra Bank & Monetary Policy Essentials',
        summary: 'Review CRR, SLR, Nepal fiscal year budget highlights, and major Nepali commercial banking milestones for General Awareness.',
      },
    ],
    importantDates: [
      { milestone: 'Application Opens (Bhadra)', window: 'Mid-August – Mid-September (Bhadra)' },
      { milestone: 'CMAT Entrance Examination', window: 'Late September (Aswin)' },
      { milestone: 'Campus Interviews & Merit List', window: 'October (Kartik)' },
    ],
    officialLinks: [
      { label: 'TU Faculty of Management Official Portal', url: 'https://www.fomecd.edu.np' },
      { label: 'TU CMAT Registration Notice Portal', url: 'https://www.tudoms.org' },
    ],
  },
  {
    slug: 'pumat',
    title: 'PUMAT — Pokhara University Management Admission Test',
    shortName: 'PUMAT',
    category: 'management',
    authority: 'Faculty of Management Studies, Pokhara University',
    mockExamSlug: 'cmat-mock-1',
    overview:
      'PUMAT evaluates applicants entering Pokhara University constituent and affiliated business schools (Ace, Apex, SAIM, School of Business Pokhara) for BBA, BBA-BI, and BCIS.',
    degreePrograms: ['BBA', 'BBA-BI (Banking & Insurance)', 'BBA-TT', 'BCIS (Bachelor of Computer Information System)', 'BHM'],
    eligibility: [
      'Completed 10+2 or equivalent with minimum second division (45%) or CGPA 1.8 / C grade across subjects.',
    ],
    admissionRequirements: [
      'PUMAT entrance score + NEB +2 marks + Group Discussion / Personal Interview.',
    ],
    officialSyllabus: [
      { subject: 'Verbal Ability', weightage: '25 Marks', topics: ['Grammar Usage', 'Passage Inference', 'Analogies'] },
      { subject: 'Quantitative Reasoning', weightage: '25 Marks', topics: ['Arithmetic', 'Basic Calculus & Matrices (BCIS)', 'Statistics'] },
      { subject: 'Logical Reasoning', weightage: '25 Marks', topics: ['Analytical Puzzles', 'Data Sufficiency'] },
      { subject: 'General & Business Awareness', weightage: '25 Marks', topics: ['Nepalese Commerce', 'Current Economic Events'] },
    ],
    examinationPattern: {
      totalMarks: 100,
      durationText: '90 Minutes',
      totalQuestions: 100,
      negativeMarkingText: 'No negative marking',
      negativeMarkingEnabled: false,
      format: '100 Objective MCQs across 4 aptitude domains',
    },
    topicNotes: [
      {
        topic: 'Data Interpretation & Banking Ratios',
        summary: 'Focus on tabular percentage growth and banking interest problems.',
      },
    ],
    importantDates: [
      { milestone: 'Fall Intake Form Window', window: 'August – September' },
      { milestone: 'PUMAT Written Test', window: 'Late September' },
    ],
    officialLinks: [
      { label: 'Pokhara University Official Portal', url: 'https://pu.edu.np' },
    ],
  },
  {
    slug: 'kuumat',
    title: 'KUUMAT — Kathmandu University Undergraduate Management Admission Test',
    shortName: 'KUUMAT',
    category: 'management',
    authority: 'Kathmandu University School of Management (KUSOM)',
    mockExamSlug: 'cmat-mock-1',
    overview:
      'KUUMAT is the competitive gateway to KUSOM’s autonomous BBA, BBIS, and BHTM programs in Kathmandu and affiliated colleges.',
    degreePrograms: ['BBA (KUSOM)', 'BBIS (Bachelor of Business Information Systems)', 'BHTM'],
    eligibility: [
      'Minimum 50% aggregate or CGPA 2.0 in 10+2 / A-Levels / IB with English and Mathematics.',
    ],
    admissionRequirements: [
      'SAT-style KUUMAT computer/paper test + KUSOM essay writing & panel interview.',
    ],
    officialSyllabus: [
      { subject: 'Quantitative Section', weightage: '40%', topics: ['Algebra', 'Coordinate Geometry', 'Probability', 'Word Problems'] },
      { subject: 'Verbal Section', weightage: '40%', topics: ['Critical Reading', 'Sentence Equivalence', 'Rhetorical Logic'] },
      { subject: 'Data Sufficiency & Reasoning', weightage: '20%', topics: ['Logical Patterns', 'Chart Analysis'] },
    ],
    examinationPattern: {
      totalMarks: 100,
      durationText: '120 Minutes',
      totalQuestions: 100,
      negativeMarkingText: 'No negative marking',
      negativeMarkingEnabled: false,
      format: 'SAT-aligned Verbal + Quantitative aptitude exam',
    },
    topicNotes: [
      {
        topic: 'SAT-Style Data Sufficiency Strategy',
        summary: 'Check Statement 1 and Statement 2 independently before combining conditions.',
      },
    ],
    importantDates: [
      { milestone: 'Application & Test Cycle', window: 'July – August (Shrawan–Bhadra)' },
    ],
    officialLinks: [
      { label: 'KUSOM Kathmandu University', url: 'https://kusom.edu.np' },
    ],
  },
  {
    slug: 'bsc-csit',
    title: 'B.Sc. CSIT — Computer Science & Information Technology Entrance',
    shortName: 'B.Sc. CSIT',
    category: 'it_cs',
    authority: 'Institute of Science & Technology (IOST), Tribhuvan University',
    mockExamSlug: 'bsc-csit-mock-1',
    overview:
      'TU IOST’s flagship 4-year (8-semester) computing degree entrance covering Physics, Chemistry, Mathematics, English, and Computer fundamentals with zero negative marking.',
    degreePrograms: ['B.Sc. Computer Science & Information Technology (126 Credit Hours)'],
    eligibility: [
      'Completed 10+2 Science (Physical or Biological group) or equivalent with minimum Second Division (45%) or minimum C grade in all subjects in Class 11 & 12.',
    ],
    admissionRequirements: [
      'Online registration on IOST CSIT portal.',
      'Score at least 35% (35/100) in TU IOST entrance to appear in the national merit rank.',
      'Priority campus selection across constituent (ASCOL, Patan, Bhaktapur, Prithvi Narayan) and private colleges.',
    ],
    officialSyllabus: [
      { subject: 'Mathematics', weightage: '25 Marks (25 MCQs)', topics: ['Sets & Functions', 'Calculus (Limits, Derivatives, Integrals)', 'Vectors & Matrices', 'Conic Sections'] },
      { subject: 'Physics', weightage: '25 Marks (25 MCQs)', topics: ['Mechanics & Rotational Motion', 'Optics & Waves', 'Electricity & Magnetism', 'Modern Physics & Logic Gates'] },
      { subject: 'Chemistry', weightage: '25 Marks (25 MCQs)', topics: ['Atomic Structure & Bonding', 'Volumetric Analysis & Kinetics', 'Hydrocarbons & Functional Groups'] },
      { subject: 'English', weightage: '15 Marks (15 MCQs)', topics: ['Grammar Transformations', 'Vocabulary & Synonyms', 'Reading Comprehension'] },
      { subject: 'Computer Science', weightage: '10 Marks (10 MCQs)', topics: ['Number Systems & Binary Logic', 'DBMS & SQL', 'C Programming & Networking'] },
    ],
    examinationPattern: {
      totalMarks: 100,
      durationText: '120 Minutes (2 Hours)',
      totalQuestions: 100,
      negativeMarkingText: 'No negative marking',
      negativeMarkingEnabled: false,
      format: '100 Single-Choice MCQs across 5 subjects (1 mark each, pass mark 35)',
    },
    topicNotes: [
      {
        topic: 'Definite Integrals & Symmetry Properties',
        summary: 'Practice King’s property and odd/even integral shortcuts tested every year in CSIT Math.',
        schoolBridgeLink: '/school/class-12/MAT-202/1',
      },
      {
        topic: 'Boolean Logic & DBMS Keys',
        summary: 'Master De Morgan’s laws, 2s complement binary arithmetic, and 1NF–3NF normal forms.',
        schoolBridgeLink: '/school/class-11/CSC-103/1',
      },
    ],
    importantDates: [
      { milestone: 'IOST Online Form Window', window: 'Shrawan – Bhadra (August)' },
      { milestone: 'Central CSIT Entrance Exam', window: 'Late Bhadra / Aswin (September)' },
      { milestone: 'Merit List & Admission Rounds', window: 'Kartik (October)' },
    ],
    officialLinks: [
      { label: 'TU Institute of Science & Technology (IOST)', url: 'https://iost.tu.edu.np' },
    ],
  },
  {
    slug: 'bit',
    title: 'BIT — Bachelor in Information Technology Entrance',
    shortName: 'BIT',
    category: 'it_cs',
    authority: 'TU IOST / Purbanchal University',
    mockExamSlug: 'bsc-csit-mock-1',
    overview:
      'BIT entrance opens seats to applied software engineering, cloud administration, and information systems degrees for +2 graduates with English and Mathematics/Computer background.',
    degreePrograms: ['BIT (Bachelor in Information Technology — 4 Years / 8 Semesters)'],
    eligibility: [
      '10+2 or equivalent from any stream with 100-mark Mathematics or Computer Science (minimum C grade / 45%).',
    ],
    admissionRequirements: [
      'IOST BIT entrance examination (100 marks) with minimum 35% qualifying threshold.',
    ],
    officialSyllabus: [
      { subject: 'Mathematics', weightage: '40 Marks', topics: ['Algebra & Matrices', 'Coordinate Geometry', 'Probability'] },
      { subject: 'English', weightage: '30 Marks', topics: ['Grammar', 'Comprehension', 'Vocabulary'] },
      { subject: 'Information Technology', weightage: '30 Marks', topics: ['Computer Architecture', 'Networking', 'OS & C Programming'] },
    ],
    examinationPattern: {
      totalMarks: 100,
      durationText: '120 Minutes (2 Hours)',
      totalQuestions: 100,
      negativeMarkingText: 'No negative marking',
      negativeMarkingEnabled: false,
      format: '100 Objective MCQs (Math 40, English 30, IT 30)',
    },
    topicNotes: [
      {
        topic: 'OSI Layers & IP Subnetting Basics',
        summary: 'Know protocol ports (HTTP, DNS, TCP/UDP) and OSI 7-layer responsibilities.',
      },
    ],
    importantDates: [
      { milestone: 'Form Submission & Entrance', window: 'August – September' },
    ],
    officialLinks: [
      { label: 'TU IOST BIT Portal', url: 'https://iost.tu.edu.np' },
    ],
  },
  {
    slug: 'bca',
    title: 'BCA — Bachelor of Computer Applications Entrance',
    shortName: 'BCA',
    category: 'it_cs',
    authority: 'Faculty of Humanities & Social Sciences (FOHSS), Tribhuvan University',
    mockExamSlug: 'bsc-csit-mock-1',
    overview:
      'BCA accepts +2 graduates from ALL streams (Science, Management, Humanities, Education) into TU’s 4-year software application development program.',
    degreePrograms: ['BCA (Bachelor of Computer Applications — 4 Years)'],
    eligibility: [
      'Minimum D+ grade in all subjects of Class 11 & 12 (or CGPA 1.8 / 45% in any stream).',
    ],
    admissionRequirements: [
      'TU FOHSS BCA entrance test (100 marks) + college admission merit ranking.',
    ],
    officialSyllabus: [
      { subject: 'English', weightage: '40 Marks', topics: ['Grammar', 'Vocabulary', 'Reading Comprehension'] },
      { subject: 'Mathematics', weightage: '50 Marks', topics: ['Sets & Matrices', 'Percentages & Interest', 'Basic Calculus'] },
      { subject: 'General Knowledge', weightage: '10 Marks', topics: ['IT Milestones', 'Nepal & World GK'] },
    ],
    examinationPattern: {
      totalMarks: 100,
      durationText: '120 Minutes (2 Hours)',
      totalQuestions: 100,
      negativeMarkingText: 'No negative marking',
      negativeMarkingEnabled: false,
      format: '100 Objective MCQs (English 40, Math 50, GK 10)',
    },
    topicNotes: [
      {
        topic: 'Matrices, Determinants & Linear Systems',
        summary: 'Practice Cramer’s rule and inverse matrix computation.',
      },
    ],
    importantDates: [
      { milestone: 'TU FOHSS Online Application', window: 'August – September' },
    ],
    officialLinks: [
      { label: 'TU Faculty of Humanities & Social Sciences', url: 'https://entrance.tufohss.edu.np' },
    ],
  },
  {
    slug: 'ioe',
    title: 'IOE Entrance — BE / B.Arch Engineering Admission Test',
    shortName: 'IOE',
    category: 'engineering',
    authority: 'Institute of Engineering (IOE), Tribhuvan University',
    mockExamSlug: 'ioe-be-mock-1',
    overview:
      'Nepal’s premier engineering Computer-Based Test (CBT) for Pulchowk, Thapathali, WRC Pokhara, ERC Dharan, and affiliated engineering colleges with strict negative marking.',
    degreePrograms: ['BE Civil', 'BE Computer', 'BE Electronics & Communication', 'BE Electrical', 'BE Mechanical', 'BE Aerospace', 'B.Arch'],
    eligibility: [
      'Completed 10+2 Science (Physics, Chemistry, Mathematics) or Diploma in Engineering with minimum 45% / C grade in each subject.',
    ],
    admissionRequirements: [
      'Computer-Based Entrance Test at IOE Pulchowk Examination Control Board.',
      'Score minimum 40% to qualify for regular & full-fee priority campus counseling.',
    ],
    officialSyllabus: [
      { subject: 'Mathematics (1 & 2 Marks)', weightage: '50 Marks', topics: ['Calculus & Differential Equations', 'Vectors & 3D Geometry', 'Complex Numbers', 'Conics'] },
      { subject: 'Physics (1 & 2 Marks)', weightage: '45 Marks', topics: ['Rotational Dynamics', 'Thermodynamics', 'Optics & Interference', 'Current Electricity & Magnetism'] },
      { subject: 'Chemistry (1 & 2 Marks)', weightage: '25 Marks', topics: ['Chemical Kinetics & Equilibrium', 'Electrochemistry', 'Organic Reaction Mechanisms'] },
      { subject: 'English & Engineering Aptitude', weightage: '20 Marks', topics: ['Technical Reading', 'Grammar & Phonetics', 'Spatial Reasoning'] },
    ],
    examinationPattern: {
      totalMarks: 140,
      durationText: '120 Minutes (2 Hours)',
      totalQuestions: 100,
      negativeMarkingText: '10% negative marking per wrong answer (0.1 for 1-mark Q, 0.2 for 2-mark Q)',
      negativeMarkingEnabled: true,
      format: 'Computer-Based Test (CBT): Section I (1-mark Qs) & Section II (2-mark analytical Qs)',
    },
    topicNotes: [
      {
        topic: 'Rotational Dynamics & Moment of Inertia Theorems',
        summary: 'Commit parallel/perpendicular axis formulas and rolling acceleration a = g sin θ / (1 + I/mr²) to memory for 2-mark IOE numericals.',
        schoolBridgeLink: '/school/class-12/PHY-201/1',
      },
      {
        topic: '10% Negative Marking Risk Strategy',
        summary: 'Guessing blindly costs 10% of question weightage; eliminate at least 2 options before attempting uncertain 2-mark items.',
      },
    ],
    importantDates: [
      { milestone: 'IOE CBT Application Window', window: 'Shrawan – Bhadra (August)' },
      { milestone: 'Shift-Based CBT Exam Week', window: 'Bhadra / Aswin (September)' },
      { milestone: 'Campus Priority Counseling', window: 'Aswin – Kartik (October)' },
    ],
    officialLinks: [
      { label: 'IOE Entrance Portal (TU)', url: 'https://entrance.ioe.edu.np' },
    ],
  },
  {
    slug: 'kucat-cbt',
    title: 'KUCAT-CBT — Kathmandu University Common Admission Test',
    shortName: 'KUCAT-CBT',
    category: 'engineering',
    authority: 'School of Engineering & School of Science, Kathmandu University',
    mockExamSlug: 'ioe-be-mock-1',
    overview:
      'Computer-based entrance test in Dhulikhel for BE Computer, Civil, Geomatics, Mechanical, Chemical, and Biotechnology programs at Kathmandu University.',
    degreePrograms: ['BE Computer Engineering', 'BE Civil Engineering', 'BE Electrical & Electronics', 'BE Geomatics', 'B.Tech Biotechnology'],
    eligibility: [
      '10+2 Science (PCM or PCB depending on program) with minimum 50% aggregate or CGPA 2.0.',
    ],
    admissionRequirements: [
      'KUCAT-CBT merit rank + Dhulikhel campus document verification.',
    ],
    officialSyllabus: [
      { subject: 'Physics', weightage: '1/3 Weightage', topics: ['Mechanics', 'Electromagnetism', 'Waves & Optics'] },
      { subject: 'Chemistry', weightage: '1/3 Weightage', topics: ['Stoichiometry', 'Equilibrium', 'Organic Functional Groups'] },
      { subject: 'Mathematics / Biology', weightage: '1/3 Weightage', topics: ['Calculus', 'Vectors', 'Matrices'] },
    ],
    examinationPattern: {
      totalMarks: 120,
      durationText: '120 Minutes',
      totalQuestions: 120,
      negativeMarkingText: 'Subject to KU CBT marking rules',
      negativeMarkingEnabled: true,
      format: 'Computer-Based Test in PCM or PCB track at KU Dhulikhel',
    },
    topicNotes: [
      {
        topic: 'Wave Optics Fringe Width & Diffraction',
        summary: 'Review Young’s double-slit path difference and diffraction minima formulas.',
        schoolBridgeLink: '/school/class-12/PHY-201/2',
      },
    ],
    importantDates: [
      { milestone: 'KU CBT Registration & Slots', window: 'July – August' },
    ],
    officialLinks: [
      { label: 'Kathmandu University Admissions', url: 'https://apply.ku.edu.np' },
    ],
  },
  {
    slug: 'mecee-bl',
    title: 'MECEE-BL — Medical Education Commission Common Entrance (Bachelor Level)',
    shortName: 'MECEE-BL',
    category: 'medical_health',
    authority: 'Medical Education Commission (MEC), Government of Nepal',
    mockExamSlug: 'mecee-bl-mock-1',
    overview:
      'Single national medical entrance exam governing all scholarship and paying seats across MBBS, BDS, B.Sc. Nursing, BASLP, B.Pharm, and BPH at IOM, BPKIHS, PAHS, KU, and private medical colleges.',
    degreePrograms: ['MBBS', 'BDS', 'B.Sc. Nursing', 'B.Pharm (Pharmacy)', 'BPH (Public Health)', 'BPT (Physiotherapy)', 'B.Sc. MLT'],
    eligibility: [
      '10+2 Science (Physics, Chemistry, Biology) with minimum 50% aggregate or GPA 2.4.',
    ],
    admissionRequirements: [
      'MECEE-BL score of minimum 50th percentile (qualifying cutoff).',
      'MEC centralized online matching across scholarship (75% public) and paying quotas.',
    ],
    officialSyllabus: [
      { subject: 'Zoology', weightage: '40 Marks (40 MCQs)', topics: ['Human Physiology', 'Evolution & Ecology', 'Animal Classification & Malaria/Plasmodium'] },
      { subject: 'Botany', weightage: '40 Marks (40 MCQs)', topics: ['Plant Anatomy & Vascular Transport', 'Genetics & Biotechnology', 'Photosynthesis & Respiration'] },
      { subject: 'Chemistry', weightage: '50 Marks (50 MCQs)', topics: ['Physical & Volumetric Chemistry', 'Periodic Trends & Coordination', 'Organic Mechanisms & Biomolecules'] },
      { subject: 'Physics', weightage: '50 Marks (50 MCQs)', topics: ['Mechanics & Gravitation', 'Thermodynamics & Optics', 'Electrostatics & Modern Physics'] },
      { subject: 'MAT (Mental Agility Test)', weightage: '20 Marks (20 MCQs)', topics: ['Verbal Reasoning', 'Numerical Sequences', 'Spatial & Logical Puzzles'] },
    ],
    examinationPattern: {
      totalMarks: 200,
      durationText: '180 Minutes (3 Hours)',
      totalQuestions: 200,
      negativeMarkingText: '0.25 marks deducted for every wrong answer (-25%)',
      negativeMarkingEnabled: true,
      format: '200 Objective MCQs across Zoology, Botany, Chemistry, Physics, and MAT',
    },
    topicNotes: [
      {
        topic: 'Plant Vascular Transport & Human Neural Conduction',
        summary: 'Distinguish xylem cohesion-tension transport from phloem pressure-flow and review action potential depolarization.',
        schoolBridgeLink: '/school/class-12/BIO-205/1',
      },
      {
        topic: 'MECEE-BL -0.25 Negative Marking Discipline',
        summary: 'Each wrong answer deducts 0.25 marks (4 wrongs wipe out 1 correct mark). Prioritize high-confidence NCERT/CDC facts first.',
      },
    ],
    importantDates: [
      { milestone: 'MEC Online Form Submission', window: 'Asar – Shrawan (July)' },
      { milestone: 'MECEE-BL National Exam Day', window: 'Bhadra (August / September)' },
      { milestone: 'MEC Centralized Seat Matching', window: 'Aswin – Kartik (October)' },
    ],
    officialLinks: [
      { label: 'Medical Education Commission (MEC) Entrance Portal', url: 'https://entrance.mec.gov.np' },
      { label: 'MEC Official Website', url: 'https://www.mec.gov.np' },
    ],
  },
  {
    slug: 'bsc-science',
    title: 'B.Sc. Pure & Applied Sciences Entrance',
    shortName: 'B.Sc. Science',
    category: 'science',
    authority: 'TU IOST & Constituent Science Campuses (Tri-Chandra, Amrit Science)',
    mockExamSlug: 'class-12-science-mock-1',
    overview:
      'Undergraduate Physical and Biological Science pathways preparing researchers, physicists, chemists, statisticians, and microbiologists.',
    degreePrograms: ['B.Sc. Physics', 'B.Sc. Chemistry', 'B.Sc. Mathematics & Statistics', 'B.Sc. Microbiology', 'B.Sc. Environmental Science'],
    eligibility: [
      '10+2 Science or equivalent with minimum second division / C+ in core science subjects.',
    ],
    admissionRequirements: [
      'Campus-administered or IOST entrance examination + Class 12 NEB transcripts.',
    ],
    officialSyllabus: [
      { subject: 'Core Science (PCM / PCB)', weightage: '85%', topics: ['NEB Class 11 & 12 Physics, Chemistry, Math/Bio'] },
      { subject: 'English & Aptitude', weightage: '15%', topics: ['Scientific Reading', 'Comprehension'] },
    ],
    examinationPattern: {
      totalMarks: 100,
      durationText: '120 Minutes',
      totalQuestions: 100,
      negativeMarkingText: 'No negative marking',
      negativeMarkingEnabled: false,
      format: '100 Objective MCQs in Physical or Biological track',
    },
    topicNotes: [
      {
        topic: 'Chemical Kinetics & Titration Calculations',
        summary: 'Review first-order half-life t½ = 0.693/k and normality equations N₁V₁ = N₂V₂.',
        schoolBridgeLink: '/school/class-12/CHM-202/1',
      },
    ],
    importantDates: [{ milestone: 'Campus Application Window', window: 'August – October' }],
    officialLinks: [{ label: 'TU IOST Official Portal', url: 'https://iost.tu.edu.np' }],
  },
  {
    slug: 'ballb',
    title: 'BA LL.B — 5-Year Integrated Legal Studies Entrance',
    shortName: 'BA LL.B',
    category: 'law',
    authority: 'Faculty of Law, Tribhuvan University / Kathmandu School of Law / KU',
    mockExamSlug: 'cmat-mock-1',
    overview:
      'Competitive legal entrance covering Constitutional Law of Nepal, Legal Reasoning, English, and Nepali analytical essay composition.',
    degreePrograms: ['BA LL.B (5-Year Integrated Honours Law Degree)'],
    eligibility: ['10+2 or equivalent from any academic stream with minimum D+ / 45%.'],
    admissionRequirements: ['Written Objective + Subjective Legal Reasoning Test + Interview.'],
    officialSyllabus: [
      { subject: 'Constitutional & Legal Awareness', weightage: '40%', topics: ['Constitution of Nepal 2072', 'Fundamental Rights', 'Jurisprudence Basics'] },
      { subject: 'Legal Reasoning & Logic', weightage: '30%', topics: ['Principle-Fact Application', 'Logical Syllogisms'] },
      { subject: 'English & Nepali Writing', weightage: '30%', topics: ['Legal Essay', 'Comprehension'] },
    ],
    examinationPattern: {
      totalMarks: 100,
      durationText: '180 Minutes',
      totalQuestions: 70,
      negativeMarkingText: 'No negative marking',
      negativeMarkingEnabled: false,
      format: 'Objective MCQs + Subjective Analytical Legal Essays',
    },
    topicNotes: [
      {
        topic: 'Principle-Fact Legal Reasoning Method',
        summary: 'Apply only the legal principle stated in the prompt without introducing external assumptions.',
      },
    ],
    importantDates: [{ milestone: 'TU Faculty of Law Entrance', window: 'September – November' }],
    officialLinks: [{ label: 'TU Faculty of Law', url: 'https://www.fol.edu.np' }],
  },
  {
    slug: 'afu-bsc-ag',
    title: 'AFU & IAAS — B.Sc. Agriculture & Veterinary Entrance',
    shortName: 'B.Sc. Ag / BVSc',
    category: 'agriculture',
    authority: 'Agriculture and Forestry University (AFU), Rampur & TU IAAS',
    mockExamSlug: 'mecee-bl-mock-1',
    overview:
      'National entrance test for B.Sc. Agriculture, B.V.Sc. & A.H., and B.Sc. Forestry seats across Chitwan, Lamjung, Paklihawa, and Kaski campuses.',
    degreePrograms: ['B.Sc. (Hons.) Agriculture', 'B.V.Sc. & A.H. (Veterinary)', 'B.Sc. Forestry', 'B.Sc. Fisheries'],
    eligibility: ['10+2 Science (Biology compulsory, Physics, Chemistry) with minimum C+ / 50%.'],
    admissionRequirements: ['AFU/IAAS Entrance Exam + Science +2 merit weightage.'],
    officialSyllabus: [
      { subject: 'Biology (Botany & Zoology)', weightage: '40%', topics: ['Plant Physiology', 'Genetics', 'Animal Husbandry Foundations'] },
      { subject: 'Physics & Chemistry', weightage: '40%', topics: ['Soil Chemistry', 'Thermodynamics & Mechanics'] },
      { subject: 'English, Math & Agriculture GK', weightage: '20%', topics: ['Nepalese Cropping Zones', 'Basic Statistics'] },
    ],
    examinationPattern: {
      totalMarks: 100,
      durationText: '90 Minutes',
      totalQuestions: 100,
      negativeMarkingText: 'No negative marking (AFU)',
      negativeMarkingEnabled: false,
      format: '100 Objective MCQs across PCB + English + Ag GK',
    },
    topicNotes: [
      {
        topic: 'Agro-Ecological Zones of Nepal',
        summary: 'Review Terai, Mid-Hills, and High-Mountain staple crops and soil pH profiles.',
      },
    ],
    importantDates: [{ milestone: 'AFU Rampur Entrance Cycle', window: 'September – October' }],
    officialLinks: [{ label: 'Agriculture & Forestry University (AFU)', url: 'https://www.afu.edu.np' }],
  },
  {
    slug: 'ba-sw-bsw',
    title: 'BA / BSW — Humanities, Journalism & Social Work Admission',
    shortName: 'BA / BSW',
    category: 'humanities',
    authority: 'TU FOHSS, KU School of Arts, and St. Xavier’s / Padma Kanya Campuses',
    mockExamSlug: 'class-12-management-mock-1',
    overview:
      'Bachelor admissions across Sociology, Social Work (BSW), Mass Communication, Economics, and Development Studies.',
    degreePrograms: ['BSW (Bachelor of Social Work)', 'BA Economics', 'BA Journalism & Mass Communication', 'BA Psychology'],
    eligibility: ['10+2 or equivalent in any stream with minimum D+ / 45%.'],
    admissionRequirements: ['College-level written aptitude + personal interview.'],
    officialSyllabus: [
      { subject: 'Social & Civic Awareness', weightage: '40%', topics: ['Nepalese Society & Federalism', 'Development Economics'] },
      { subject: 'English & Critical Writing', weightage: '40%', topics: ['Essay Writing', 'Media Comprehension'] },
      { subject: 'Quantitative & Data Literacy', weightage: '20%', topics: ['Basic Percentages & Survey Interpretation'] },
    ],
    examinationPattern: {
      totalMarks: 100,
      durationText: '90 Minutes',
      totalQuestions: 80,
      negativeMarkingText: 'No negative marking',
      negativeMarkingEnabled: false,
      format: 'Combined Objective + Analytical Essay Screening',
    },
    topicNotes: [
      {
        topic: 'Social Change & Federal Governance',
        summary: 'Connect Grade 12 Sociology concepts to Nepal’s local municipal governance structures.',
        schoolBridgeLink: '/school/class-12/SOC-209/1',
      },
    ],
    importantDates: [{ milestone: 'Undergraduate Admissions', window: 'August – October' }],
    officialLinks: [{ label: 'TU FOHSS Official Portal', url: 'https://tufohss.edu.np' }],
  },
];

export function getEntranceExamBySlug(slug: string): EntranceExamProfile | undefined {
  return ENTRANCE_EXAM_PROFILES.find(
    (e) => e.slug.toLowerCase() === slug.trim().toLowerCase(),
  );
}
