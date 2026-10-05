export type Signal = {
  label: string;
  value: number;
  detail: string;
};

export type ParagraphResult = {
  text: string;
  score: number;
  level: "low" | "medium" | "high";
  reasons: string[];
};

export type AnalysisResult = {
  score: number;
  label: string;
  words: number;
  sentences: number;
  paragraphs: ParagraphResult[];
  signals: Signal[];
  notes: string[];
};

const aiTransitions = [
  "összességében",
  "továbbá",
  "mindemellett",
  "fontos megjegyezni",
  "érdemes kiemelni",
  "ennek megfelelően",
  "ugyanakkor",
  "következésképpen",
  "végeredményben",
  "nem csupán",
  "nemcsak"
];

const sentenceSplit = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

const wordsOf = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

const variance = (values: number[]) => {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
};

function scoreParagraph(text: string): ParagraphResult {
  const sentences = sentenceSplit(text);
  const words = wordsOf(text);
  const lengths = sentences.map((s) => wordsOf(s).length);
  const avg = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const stdev = Math.sqrt(variance(lengths));
  const diversity = words.length ? new Set(words).size / words.length : 1;
  const lower = text.toLowerCase();
  const transitionHits = aiTransitions.filter((t) => lower.includes(t)).length;

  const starters = sentences
    .map((s) => wordsOf(s).slice(0, 2).join(" "))
    .filter(Boolean);
  const repeatedStarters = starters.length - new Set(starters).size;

  let score = 12;
  const reasons: string[] = [];

  if (sentences.length >= 3 && stdev < 5) {
    score += 24;
    reasons.push("A mondathossz szokatlanul egyenletes.");
  }
  if (avg > 17 && avg < 29) {
    score += 12;
    reasons.push("A mondatok hossza végig hasonló, szerkesztett hatású.");
  }
  if (transitionHits >= 2) {
    score += Math.min(20, transitionHits * 6);
    reasons.push("Több sablonos átvezető fordulat ismétlődik.");
  }
  if (words.length > 60 && diversity < 0.55) {
    score += 16;
    reasons.push("A szókészlet változatossága alacsony a rész hosszához képest.");
  }
  if (repeatedStarters >= 2) {
    score += 14;
    reasons.push("Több mondat hasonló nyelvi mintával indul.");
  }
  if (!/[0-9%]/.test(text) && words.length > 90 && !/például|példa|saját|tapasztalat|esetében/i.test(text)) {
    score += 10;
    reasons.push("Kevés konkrétum vagy egyedi példa jelenik meg.");
  }

  score = Math.max(2, Math.min(96, Math.round(score)));
  const level = score >= 65 ? "high" : score >= 35 ? "medium" : "low";

  if (!reasons.length) reasons.push("Nem látszik erős, önmagában kiugró AI-szerű minta.");
  return { text, score, level, reasons };
}

export function analyzeText(text: string): AnalysisResult {
  const paragraphsRaw = text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  const paragraphs = paragraphsRaw.map(scoreParagraph);
  const allWords = wordsOf(text);
  const sentences = sentenceSplit(text);
  const lengths = sentences.map((s) => wordsOf(s).length);
  const stdev = Math.sqrt(variance(lengths));
  const diversity = allWords.length ? new Set(allWords).size / allWords.length : 1;
  const lower = text.toLowerCase();
  const transitions = aiTransitions.filter((t) => lower.includes(t)).length;
  const longParagraphs = paragraphsRaw.filter((p) => wordsOf(p).length > 110).length;

  const weighted = paragraphs.length
    ? paragraphs.reduce((sum, p) => sum + p.score * Math.max(1, wordsOf(p.text).length), 0) /
      paragraphs.reduce((sum, p) => sum + Math.max(1, wordsOf(p.text).length), 0)
    : 0;
  const score = Math.round(weighted);
  const label = score >= 65 ? "Erős AI-szerű mintázat" : score >= 35 ? "Vegyes mintázat" : "Inkább természetes mintázat";

  const regularity = Math.max(0, Math.min(100, Math.round(100 - stdev * 7)));
  const transitionScore = Math.min(100, transitions * 18);
  const lexicalScore = Math.max(0, Math.min(100, Math.round((0.72 - diversity) * 170)));
  const paragraphScore = paragraphs.length ? Math.round((longParagraphs / paragraphs.length) * 100) : 0;

  return {
    score,
    label,
    words: allWords.length,
    sentences: sentences.length,
    paragraphs,
    signals: [
      { label: "Mondat-regularitás", value: regularity, detail: "Az egyenletes mondathossz növelheti a gépies hatást." },
      { label: "Sablonos átvezetések", value: transitionScore, detail: "Gyakori, általános kötő- és átvezető formulák." },
      { label: "Lexikai ismétlődés", value: lexicalScore, detail: "A szókészlet változatosságának közelítő mutatója." },
      { label: "Bekezdés-regularitás", value: paragraphScore, detail: "Hosszú, egységes tömbök aránya." }
    ],
    notes: [
      "Ez valószínűségi stíluselemzés, nem bizonyíték arra, hogy a szöveget AI írta.",
      "Rövid szövegnél és erősen szerkesztett szakmai szövegnél a bizonytalanság nagyobb.",
      "A legjobb döntéshez a kiemelt bekezdéseket és az indokokat együtt érdemes nézni."
    ]
  };
}

export function buildSuggestions(text: string) {
  const result = scoreParagraph(text);
  const suggestions: string[] = [];
  if (result.reasons.some((r) => r.includes("mondathossz"))) {
    suggestions.push("Váltogasd tudatosabban a rövid és hosszabb mondatokat; egy gondolatot akár külön rövid mondatban is emelj ki.");
  }
  if (result.reasons.some((r) => r.includes("átvezető"))) {
    suggestions.push("A sablonos átvezetéseket cseréld tartalmi kapcsolatra vagy hagyd el, ha a gondolat önmagában is követhető.");
  }
  if (result.reasons.some((r) => r.includes("szókészlet"))) {
    suggestions.push("Nézd meg az ismétlődő főneveket és igéket; ahol szakmailag pontos marad, használj természetesebb változatot.");
  }
  if (result.reasons.some((r) => r.includes("konkrétum"))) {
    suggestions.push("Tegyél bele konkrét példát, adatot, saját megfigyelést vagy pontos szakmai esetet.");
  }
  if (!suggestions.length) {
    suggestions.push("A rész stílusa nem mutat erős gépies mintát; csak a tartalmi pontosságot és a saját hangot ellenőrizd.");
  }
  return suggestions;
}
