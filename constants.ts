import { JudgingSection } from './types';

// --- FULL GEOGRAPHICAL DATA ---
// This is considered system data, not mock data, so it remains.
export const KENYAN_GEOGRAPHICAL_DATA: { [region: string]: { [county: string]: { [subCounty: string]: string[] } } } = {
  "Central": {
    "Kiambu": { "Gatundu North": [], "Gatundu South": [], "Githunguri": [], "Juja": [], "Kabete": [], "Kiambaa": [], "Kiambu Town": [], "Kikuyu": [], "Limuru": [], "Lari": [], "Ruiru": [], "Thika Town": [] },
    "Kirinyaga": { "Gichugu": [], "Mwea East": [], "Mwea West": [], "Kirinyaga Central": [], "Ndia": [] },
    "Murang'a": { "Kangema": [], "Mathioya": [], "Kiharu": [], "Kigumo": [], "Maragua": [], "Kandara": [], "Gatanga": [] },
    "Nyandarua": { "Kinangop": [], "Kipipiri": [], "Ndaragwa": [], "Ol Kalou": [], "Ol Jorok": [] },
    "Nyeri": { "Kieni East": [], "Kieni West": [], "Mathira East": [], "Mathira West": [], "Mukureini": [], "Nyeri Central": [], "Tetu": [], "Othaya": [] }
  },
  "Coast": { "Mombasa": { "Changamwe": [], "Jomvu": [], "Kisauni": [], "Nyali": [], "Likoni": [], "Mvita": [] }, "Kwale": { "Kinango": [], "Lungalunga": [], "Matuga": [], "Msambweni": [] }, "Kilifi": { "Kilifi North": [], "Kilifi South": [], "Kaloleni": [], "Rabai": [], "Malindi": [], "Magarini": [] }, "Tana River": { "Bura": [], "Galole": [], "Garsen": [] }, "Lamu": { "Lamu East": [], "Lamu West": [] }, "Taita-Taveta": { "Taveta": [], "Voi": [], "Mwatate": [], "Wundanyi": [] } },
  "Eastern": { "Embu": { "Manyatta": [], "Runyenjes": [], "Mbeere North": [], "Mbeere South": [] }, "Kitui": { "Kitui Central": [], "Kitui East": [], "Kitui Rural": [], "Kitui South": [], "Kitui West": [], "Mwingi Central": [], "Mwingi North": [], "Mwingi West": [] }, "Machakos": { "Kangundo": [], "Kathiani": [], "Machakos Town": [], "Masinga": [], "Matungulu": [], "Mavoko": [], "Mwala": [], "Yatta": [] }, "Makueni": { "Kaiti": [], "Kibwezi East": [], "Kibwezi West": [], "Kilome": [], "Makueni": [], "Mbooni": [] }, "Meru": { "Buuri East": [], "Buuri West": [], "Igembe Central": [], "Igembe North": [], "Igembe South": [], "Imenti Central": [], "Imenti North": [], "Imenti South": [], "Tigania East": [], "Tigania West": [] }, "Tharaka-Nithi": { "Maara": [], "Meru South (Chuka)": [], "Tharaka": [] }, "Isiolo": { "Isiolo": [] }, "Marsabit": { "Laisamis": [], "Moyale": [], "North Horr": [], "Saku": [] } },
  "Nairobi": { "Nairobi City": { "Dagoretti North": [], "Dagoretti South": [], "Embakasi Central": [], "Embakasi East": [], "Embakasi North": [], "Embakasi South": [], "Embakasi West": [], "Kamukunji": [], "Kasarani": [], "Kibra": [], "Lang'ata": [], "Makadara": [], "Mathare": [], "Roysambu": [], "Ruaraka": [], "Starehe": [], "Westlands": [] } },
  "North Eastern": { "Garissa": { "Balambala": [], "Dadaab": [], "Fafi": [], "Garissa Township": [], "Ijara": [], "Lagdera": [] }, "Wajir": { "Eldas": [], "Tarbaj": [], "Wajir East": [], "Wajir North": [], "Wajir South": [], "Wajir West": [] }, "Mandera": { "Banissa": [], "Lafey": [], "Mandera East": [], "Mandera North": [], "Mandera South": [], "Mandera West": [] } },
  "Nyanza": { "Kisumu": { "Kisumu Central": [], "Kisumu East": [], "Kisumu West": [], "Muhoroni": [], "Nyakach": [], "Nyando": [], "Seme": [] }, "Siaya": { "Alego Usonga": [], "Bondo": [], "Gem": [], "Rarieda": [], "Ugenya": [], "Ugunja": [] }, "Homa Bay": { "Homa Bay Town": [], "Kabondo Kasipul": [], "Karachuonyo": [], "Kasipul": [], "Mbita": [], "Ndhiwa": [], "Rangwe": [], "Suba": [] }, "Migori": { "Awendo": [], "Kuria East": [], "Kuria West": [], "Rongo": [], "Suna East": [], "Suna West": [], "Uriri": [] }, "Kisii": { "Bobasi": [], "Bomachoge Borabu": [], "Bomachoge Chache": [], "Bonchari": [], "Kitutu Chache North": [], "Kitutu Chache South": [], "Nyaribari Chache": [], "Nyaribari Masaba": [], "South Mugirango": [] }, "Nyamira": { "Borabu": [], "Kitutu Masaba": [], "North Mugirango": [], "West Mugirango": [] } },
  "Rift Valley": { "Turkana": { "Turkana Central": [], "Turkana East": [], "Turkana North": [], "Turkana South": [], "Turkana West": [], "Loima": [] }, "West Pokot": { "Kapenguria": [], "Kacheliba": [], "Pokot South": [], "Sigor": [] }, "Samburu": { "Samburu East": [], "Samburu North": [], "Samburu West": [] }, "Trans-Nzoia": { "Cherangany": [], "Endebess": [], "Kiminini": [], "Kwanza": [], "Saboti": [] }, "Uasin Gishu": { "Ainabkoi": [], "Kapseret": [], "Kesses": [], "Moiben": [], "Soy": [], "Turbo": [] }, "Elgeyo-Marakwet": { "Keiyo North": [], "Keiyo South": [], "Marakwet East": [], "Marakwet West": [] }, "Nandi": { "Aldai": [], "Chesumei": [], "Emgwen": [], "Mosop": [], "Nandi Hills": [], "Tinderet": [] }, "Baringo": { "Baringo Central": [], "Baringo North": [], "Baringo South": [], "Eldama Ravine": [], "Mogotio": [], "Tiaty": [] }, "Laikipia": { "Laikipia East": [], "Laikipia North": [], "Laikipia West": [] }, "Nakuru": { "Bahati": [], "Gilgil": [], "Kuresoi North": [], "Kuresoi South": [], "Molo": [], "Naivasha": [], "Nakuru Town East": [], "Nakuru Town West": [], "Njoro": [], "Rongai": [], "Subukia": [] }, "Narok": { "Narok East": [], "Narok North": [], "Narok South": [], "Narok West": [], "Emurua Dikirr": [], "Kilgoris": [] }, "Kajiado": { "Kajiado Central": [], "Kajiado East": [], "Kajiado North": [], "Kajiado South": [], "Kajiado West": [] }, "Kericho": { "Ainamoi": [], "Belgut": [], "Bureti": [], "Kipkelion East": [], "Kipkelion West": [], "Sigowet-Soin": [] }, "Bomet": { "Bomet Central": [], "Bomet East": [], "Chepalungu": [], "Konoin": [], "Sotik": [] } },
  "Western": { "Kakamega": { "Butere": [], "Ikolomani": [], "Khwisero": [], "Lugari": [], "Lurambi": [], "Malava": [], "Matungu": [], "Mumias East": [], "Mumias West": [], "Navakholo": [], "Shinyalu": [] }, "Vihiga": { "Emuhaya": [], "Hamisi": [], "Luanda": [], "Sabatia": [], "Vihiga": [] }, "Bungoma": { "Bumula": [], "Kabuchai": [], "Kanduyi": [], "Kimilili": [], "Mt. Elgon": [], "Sirisia": [], "Tongaren": [], "Webuye East": [], "Webuye West": [] }, "Busia": { "Budalangi": [], "Butula": [], "Funyula": [], "Matayos": [], "Nambale": [], "Teso North": [], "Teso South": [] } }
};


// --- SCORE SHEET (Unchanged) ---
// This is system data and not mock data, so it should remain.
export const SCORE_SHEET: JudgingSection[] = [
  {
    id: 'A',
    title: 'PART A: WRITTEN COMMUNICATION (WRITE UP AND POSTERS)',
    description: '(Level of performance: 0=Not done, 0.5=Poor, 1.0=Satisfactory, 1.5=Good, 2.0=Extensive)',
    totalMaxScore: 30,
    criteria: [
      { id: 1, text: 'Write up neatly and logically organized', details: 'Write with clearly labeled sections eg. Abstract, and plagiarism pledge etc', maxScore: 2, step: 0.5, originalSection: 'A' },
      { id: 2, text: 'Evidence of background research & Introduction', details: 'Background info, summarized with articles. Includes focus question/problem statement.', maxScore: 2, step: 0.5, originalSection: 'A' },
      { id: 3, text: 'Written language in write up and on poster', details: 'Legible, correct fonts, scientific, suitable headings, no spelling mistakes', maxScore: 2, step: 0.5, originalSection: 'A' },
      { id: 4, text: 'Aim / hypothesis/ objectives of project', details: 'Reflected in write up and on poster', maxScore: 2, step: 0.5, originalSection: 'A' },
      { id: 5, text: 'Methods (and materials) or technologies used', details: 'Presented in logical order, correct expression, more extensive in report than on poster', maxScore: 2, step: 0.5, originalSection: 'A' },
      { id: 6, text: 'Variables identified', details: 'Dependent and independent variable identified in write up and on poster', maxScore: 2, step: 0.5, originalSection: 'A' },
      { id: 7, text: 'Results', details: 'Full observations, presented in tabular/graph form. Scientifically and mathematically suitable and correct.', maxScore: 2, step: 0.5, originalSection: 'A' },
      { id: 8, text: 'Analysis of results', details: 'Report/findings/graphs explained in words, more extensive in write up than on poster', maxScore: 2, step: 0.5, originalSection: 'A' },
      { id: 9, text: 'Discussion of results', details: 'Pattern and trends are noted and explained, anomalies/unusual results are discussed, limitations noted and clarified', maxScore: 2, step: 0.5, originalSection: 'A' },
      { id: 10, text: 'Future possibilities of research / recommendations', details: 'Future extensions and possibilities are identified', maxScore: 2, step: 0.5, originalSection: 'A' },
      { id: 11, text: 'Conclusions', details: 'Valid, based on findings and linked to objectives.', maxScore: 2, step: 0.5, originalSection: 'A' },
      { id: 12, text: 'Reference in write up', details: 'Reference of books, magazines and internet addresses given in the correct format', maxScore: 2, step: 0.5, originalSection: 'A' },
      { id: 13, text: 'Acknowledgements', details: 'Depth of assistance received and how this assistance has been used', maxScore: 2, step: 0.5, originalSection: 'A' },
      { id: 14, text: 'Display board', details: 'Summaries project and is neatly organized. Correct size and logical flow.', maxScore: 2, step: 0.5, originalSection: 'A' },
      { id: 15, text: 'Project data file', details: 'Research plan/Rough work/original data sheets/plans/diagrams etc.', maxScore: 2, step: 0.5, originalSection: 'A' },
    ],
  },
  {
    id: 'BC',
    title: 'PART B & C: ORAL COMMUNICATION & SCIENTIFIC THOUGHT',
    description: 'This section covers both oral communication skills and the scientific rigor of the project.',
    totalMaxScore: 50, // 15 + 35
    subSectionDetails: {
      'B': { title: 'PART B: ORAL COMMUNICATION (INTERACTION)', description: '(Level of performance varies by item)' },
      'C': { title: 'PART C: SCIENTIFIC THOUGHT, METHOD AND CREATIVITY', description: '(Level of performance varies by item)' }
    },
    criteria: [
        { id: 16, text: 'Capture of interest', details: 'The learners presentation is exciting and stimulating (0=Not done, 0.5=Good, 1.0=Excellent)', maxScore: 1, step: 0.5, originalSection: 'B' },
        { id: 17, text: 'Enthusiasm / effort', details: 'A worthwhile effort was made to explain, lots of enthusiasm (0=Not done, 0.5=Good, 1.0=Excellent)', maxScore: 1, step: 0.5, originalSection: 'B' },
        { id: 18, text: 'Voice / tone', details: 'Totally audible, varying intonation (0=Not done, 0.5=Good, 1.0=Excellent)', maxScore: 1, step: 0.5, originalSection: 'B' },
        { id: 19, text: 'Self-confidence', details: 'Ease of presentation (0=Not done, 0.5=Good, 1.0=Excellent)', maxScore: 1, step: 0.5, originalSection: 'B' },
        { id: 20, text: 'Scientific Language', details: 'Use of appropriate language and vocabulary (0=Not done, 0.5=Good, 1.0=Excellent)', maxScore: 1, step: 0.5, originalSection: 'B' },
        { id: 21, text: 'Response to questions', details: 'Listens carefully, responds clearly and intelligently (0=Not done, 0.5=Poor, 1.0=Satisfactory, 1.5=Good, 2.0=Extensive)', maxScore: 2, step: 0.5, originalSection: 'B' },
        { id: 22, text: 'Presentation of project', details: 'Logical, well organized way (without reciting/reading directly) (0=Not done, 0.5=Poor, 1.0=Satisfactory, 1.5=Good, 2.0=Extensive)', maxScore: 2, step: 0.5, originalSection: 'B' },
        { id: 23, text: 'Limitations / weaknesses and gaps', details: 'The learner is fully aware of limitations and can explain reasons for gaps (0=Not done, 0.5=Poor, 1.0=Satisfactory, 1.5=Good, 2.0=Extensive)', maxScore: 2, step: 0.5, originalSection: 'B' },
        { id: 24, text: 'Possible suggestions or expanding project', details: 'The learner is fully aware of possibilities for expanding the project (0=Not done, 0.5=Poor, 1.0=Satisfactory, 1.5=Good, 2.0=Extensive)', maxScore: 2, step: 0.5, originalSection: 'B' },
        { id: 25, text: 'Authenticity', details: 'The learner takes complete ownership of the project and integrates assistance received. (0=Not done, 0.5=Poor, 1.0=Satisfactory, 1.5=Good, 2.0=Extensive)', maxScore: 2, step: 0.5, originalSection: 'B' },
        { id: 26, text: 'Statement of the problem', details: 'Clear statement of the problem and objectives', maxScore: 2, step: 0.5, originalSection: 'C' },
        { id: 27, text: 'Introduction / Background information', details: 'Relationship between the project and other research done in the same area', maxScore: 2, step: 0.5, originalSection: 'C' },
        { id: 28, text: 'Application of scientific concepts to every day life', details: '', maxScore: 3, step: 1, originalSection: 'C' },
        { id: 29, text: 'Subject mastery', details: 'Demonstration of deep and accurate knowledge of scientific and engineering principles involved', maxScore: 3, step: 1, originalSection: 'C' },
        { id: 30, text: 'Literature review', details: 'Project shows understanding of existing knowledge. (citations)', maxScore: 2, step: 0.5, originalSection: 'C' },
        { id: 31, text: 'Data', details: 'Adequate data obtained to verify conclusions.', maxScore: 3, step: 1, originalSection: 'C' },
        { id: 32, text: 'Variables', details: 'Variables/parameters were clearly defined and recognized, controls used', maxScore: 2, step: 0.5, originalSection: 'C' },
        { id: 33, text: 'Statement of originality', details: 'What inspired the person to come up with the project', maxScore: 2, step: 0.5, originalSection: 'C' },
        { id: 34, text: 'Logical Sequence: Apparatus / requirements', details: 'Experimental design demonstrates understanding of scientific methods of research', maxScore: 2, step: 0.5, originalSection: 'C' },
        { id: 35, text: 'Logical Sequence: Procedure / Method', details: 'Experimental design demonstrates understanding of scientific methods of research', maxScore: 2, step: 0.5, originalSection: 'C' },
        { id: 36, text: 'Logical Sequence: Correct illustrations', details: 'Experimental design demonstrates understanding of scientific methods of research', maxScore: 3, step: 1, originalSection: 'C' },
        { id: 37, text: 'Linkage to emerging issues', details: 'Linking of the innovation with emerging issues or adds value to existing body of knowledge', maxScore: 2, step: 0.5, originalSection: 'C' },
        { id: 38, text: 'Originality', details: 'Is the problem original or does the approach to the problem show originality. Does the construction or design of equipment / project show originality', maxScore: 3, step: 1, originalSection: 'C' },
        { id: 39, text: 'Creativity', details: 'Have materials / equipment been used in an ingenious way, To what extent does the project / exhibit represent the student\'s own effort/skill', maxScore: 2, step: 0.5, originalSection: 'C' },
        { id: 40, text: 'Skill: Was the workmanship of the display skillful?', details: 'Workmanship is neat, well done. Project requires minimum maintenance', maxScore: 2, step: 0.5, originalSection: 'C' },
    ],
  },
];


// --- NEW ROBOTICS SCORE SHEET ---
export const ROBOTICS_SCORE_SHEET: (JudgingSection & { isRoboticsMissions?: boolean; roboticsMissions?: any })[] = [
  {
    id: 'A',
    title: 'PART A: WRITTEN COMMUNICATION (WRITE UP AND POSTERS)',
    description: '(Level of performance: 0=Not done, 0.5=Poor, 1.0=Satisfactory, 1.5=Good, 2.0=Extensive)',
    totalMaxScore: 30,
    criteria: SCORE_SHEET[0].criteria,
  },
  {
    id: 'B',
    title: 'PART B: ORAL COMMUNICATION (INTERACTION)',
    description: "Level of performance for No's 1-4: 0=Not done, 0.5=Good, 1.0=Excellent. Level of performance for No's 5-12: 0=Not done, not present, 0.5=Poor, very weak, 1.0=Satisfactory, 1.5=Good, 2.0=Extensive, well done",
    totalMaxScore: 20,
    criteria: [
        { id: 101, text: 'Capture of interest', details: 'The learners presentation is exciting and stimulating', maxScore: 1, step: 0.5, originalSection: 'B' },
        { id: 102, text: 'Enthusiasm / effort', details: 'A worthwhile effort was made to explain, lots of enthusiasm', maxScore: 1, step: 0.5, originalSection: 'B' },
        { id: 103, text: 'Voice / tone', details: 'Totally audible, varying intonation', maxScore: 1, step: 0.5, originalSection: 'B' },
        { id: 104, text: 'Self-confidence', details: 'Ease of presentation', maxScore: 1, step: 0.5, originalSection: 'B' },
        { id: 105, text: 'Robotics language and principles', details: 'Use of appropriate language and vocabulary', maxScore: 2, step: 0.5, originalSection: 'B' },
        { id: 106, text: 'Response to questions', details: 'Carefully listens to questions, responds clearly and intelligently', maxScore: 2, step: 0.5, originalSection: 'B' },
        { id: 107, text: 'Presentation of project', details: 'Can present the project in a logical, well organized way (without reciting/ reading directly)', maxScore: 2, step: 0.5, originalSection: 'B' },
        { id: 108, text: 'Automation', details: 'The project uses appropriate inputs from sensors to run specific routines and clearly demonstrates automation', maxScore: 2, step: 0.5, originalSection: 'B' },
        { id: 109, text: 'Good Logic', details: 'The programming options used make sense, work reliably and is well designed', maxScore: 2, step: 0.5, originalSection: 'B' },
        { id: 110, text: 'Technical Understanding', details: 'Clear, precise and convincing explanations of the mechanical and programming process.', maxScore: 2, step: 0.5, originalSection: 'B' },
        { id: 111, text: 'Engineering Concepts', details: 'Explain concepts and need for their use. Design / builder choices', maxScore: 2, step: 0.5, originalSection: 'B' },
        { id: 112, text: 'Linking the innovation with Emerging Issues', details: '', maxScore: 2, step: 0.5, originalSection: 'B' }
    ]
  },
  {
    id: 'C',
    title: 'PART C: SCIENTIFIC THOUGHT, METHOD AND CREATIVITY.',
    description: '(Levels of performance: (7-10)-Successful, (4-6)-Partial and (1-3)-Attempted',
    totalMaxScore: 50,
    isRoboticsMissions: true,
    criteria: [], // This is important for the existing CriterionInput loop
    roboticsMissions: {
        compulsory: [
            { id: 201, text: 'Delivering a white cuboid to the school', maxScore: 10 },
            { id: 202, text: 'Delivering a white tank to the residential estate', maxScore: 10 },
        ],
        studentGenerated: [
            { id: 203, text: 'Student Mission 1', maxScore: 10 },
            { id: 204, text: 'Student Mission 2', maxScore: 10 },
            { id: 205, text: 'Student Mission 3', maxScore: 10 },
        ]
    }
  },
];
