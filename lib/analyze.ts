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

export type StyleProfile = {
  avgSentenceLength: number;
  sentenceVariation: number;
  lexicalDiversity: number;
};

export type AnalysisResult = {
  score: number;
  label: string;
  confidence: "alacsony" | "közepes" | "magas";
  words: number;
  sentences: number;
  paragraphs: ParagraphResult[];
  signals: Signal[];
  notes: string[];
  metrics: StyleProfile;
  profileMatch?: number;
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
  "nemcsak",
  "kiemelendő",
  "elengedhetetlen",
  "kulcsfontosságú",
  "számos területen"
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

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

function metricsFor(text: string): StyleProfile {
  const sentences = sentenceSplit(text);
  const words = wordsOf(text);
  const lengths = sentences.map((s) => wordsOf(s).length);
  const avgSentenceLength = lengths.length
    ? lengths.reduce((a, b) => a + b, 0) / lengths.length
    : 0;
  const sentenceVariation = Math.sqrt(variance(lengths));
  const lexicalDiversity = words.length ? new Set(words).size / words.length : 1;
  return {
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    sentenceVariation: Math.round(sentenceVariation * 10) / 10,
    lexicalDiversity: Math.round(lexicalDiversity * 1000) / 1000
  };
}

export function createStyleProfile(text: string): StyleProfile | null {
  if (wordsOf(text).length < 120) return null;
  return metricsFor(text);
}

function compareProfile(metrics: StyleProfile, profile?: StyleProfile | null) {
  if (!profile) return undefined;
  const sentenceDiff = Math.abs(metrics.avgSentenceLength - profile.avgSentenceLength);
  const variationDiff = Math.abs(metrics.sentenceVariation - profile.sentenceVariation);
  const lexicalDiff = Math.abs(metrics.lexicalDiversity - profile.lexicalDiversity) * 100;
  return Math.round(clamp(100 - sentenceDiff * 3 - variationDiff * 4 - lexicalDiff * 2.2));
}

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
  const punctuationVariety = new Set((text.match(/[;:—()]/g) || [])).size;
  const personalMarkers = (lower.match(/\b(szerintem|tapasztalatom|azt láttam|úgy gondolom|nálunk|esetemben|például)\b/g) || []).length;

  let score = 10;
  const reasons: string[] = [];

  if (sentences.length >= 3 && stdev < 4.5) {
    score += 24;
    reasons.push("A mondathossz szokatlanul egyenletes.");
  }
  if (avg > 17 && avg < 30 && sentences.length >= 3) {
    score += 11;
    reasons.push("A mondatok hossza végig hasonló, erősen szerkesztett hatású.");
  }
  if (transitionHits >= 2) {
    score += Math.min(22, transitionHits * 6);
    reasons.push("Több sablonos átvezető fordulat ismétlődik.");
  }
  if (words.length > 60 && diversity < 0.54) {
    score += 15;
    reasons.push("A szókészlet változatossága alacsony a rész hosszához képest.");
  }
  if (repeatedStarters >= 2) {
    score += 13;
    reasons.push("Több mondat hasonló nyelvi mintával indul.");
  }
  if (!/[0-9%]/.test(text) && words.length > 90 && personalMarkers === 0) {
    score += 10;
    reasons.push("Kevés konkrétum, adat vagy egyedi példa jelenik meg.");
  }
  if (words.length > 70 && punctuationVariety === 0 && sentences.length >= 4) {
    score += 7;
    reasons.push("A mondatszerkezetek központozása kevéssé változatos.");
  }

  score = clamp(Math.round(score), 2, 96);
  const level = score >= 65 ? "high" : score >= 35 ? "medium" : "low";
  if (!reasons.length) reasons.push("Nem látszik erős, önmagában kiugró AI-szerű nyelvi minta.");

  return { text, score, level, reasons };
}

export function analyzeText(text: string, styleProfile?: StyleProfile | null): AnalysisResult {
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

  let score = Math.round(weighted);
  const currentMetrics = metricsFor(text);
  const profileMatch = compareProfile(currentMetrics, styleProfile);

  if (profileMatch !== undefined && allWords.length >= 120) {
    if (profileMatch >= 85) score = Math.max(2, score - 8);
    if (profileMatch < 45) score = Math.min(96, score + 6);
  }

  const label =
    score >= 65
      ? "Erős AI-szerű mintázat"
      : score >= 35
        ? "Vegyes mintázat"
        : "Inkább természetes mintázat";

  const confidence: AnalysisResult["confidence"] =
    allWords.length >= 450 ? "magas" : allWords.length >= 180 ? "közepes" : "alacsony";

  const regularity = clamp(Math.round(100 - stdev * 7));
  const transitionScore = clamp(transitions * 18);
  const lexicalScore = clamp(Math.round((0.72 - diversity) * 170));
  const paragraphScore = paragraphs.length
    ? Math.round((longParagraphs / paragraphs.length) * 100)
    : 0;

  return {
    score,
    label,
    confidence,
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
    ],
    metrics: currentMetrics,
    profileMatch
  };
}

export function buildSuggestions(text: string) {
  const result = scoreParagraph(text);
  const suggestions: string[] = [];

  if (result.reasons.some((r) => r.includes("mondathossz"))) {
    suggestions.push("Váltogasd tudatosabban a rövid és hosszabb mondatokat; egy fontos gondolat lehet külön rövid mondat.");
  }
  if (result.reasons.some((r) => r.includes("átvezető"))) {
    suggestions.push("A sablonos átvezetéseket cseréld konkrét tartalmi kapcsolatra, vagy hagyd el őket, ha a gondolat magától is követhető.");
  }
  if (result.reasons.some((r) => r.includes("szókészlet"))) {
    suggestions.push("Nézd meg az ismétlődő főneveket és igéket; ahol szakmailag pontos marad, használj természetesebb változatot.");
  }
  if (result.reasons.some((r) => r.includes("konkrétum"))) {
    suggestions.push("Adj hozzá konkrét példát, adatot, saját megfigyelést vagy pontos szakmai esetet.");
  }
  if (result.reasons.some((r) => r.includes("központozása"))) {
    suggestions.push("Változtasd a mondatszerkezetet: rövidebb mondat, pontosvessző vagy természetes közbevetés csak ott, ahol valóban indokolt.");
  }
  if (!suggestions.length) {
    suggestions.push("A rész stílusa nem mutat erős gépies mintát; inkább a tartalmi pontosságot és a saját hang következetességét ellenőrizd.");
  }

  return suggestions;
}
