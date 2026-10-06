import { NextResponse } from "next/server";

export const runtime = "nodejs";

type WriteRequest = {
  mode?: "transform" | "generate";
  sourceText?: string;
  topic?: string;
  facts?: string;
  tone?: string;
  length?: string;
  strength?: string;
  audience?: string;
  purpose?: string;
  instructions?: string;
  styleSample?: string;
};

function toneLabel(value?: string) {
  return ({
    natural: "természetes, gördülékeny",
    professional: "szakmai és pontos",
    academic: "tudományos, tárgyilagos",
    simple: "egyszerű, közérthető",
    concise: "tömör és lényegre törő",
    personal: "személyesebb, természetes szerzői hangú"
  } as Record<string, string>)[value || ""] || "természetes";
}

function lengthLabel(value?: string) {
  return ({
    short: "az alapnál rövidebb",
    same: "nagyjából az alap terjedelmével azonos",
    long: "részletesebb",
    "very-long": "alaposan kidolgozott"
  } as Record<string, string>)[value || ""] || "hasonló terjedelmű";
}

function extractText(data: any) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part: any) => typeof part?.text === "string" ? part.text : "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WriteRequest;
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Az AI-író még nincs Gemini API-kulccsal összekötve. A funkció elkészült, de a szerveroldali Gemini-kapcsolatot még konfigurálni kell." },
        { status: 503 }
      );
    }

    const common = [
      "Magyar nyelven írj.",
      "A kapott tényeket, számokat, neveket és szakkifejezéseket pontosan őrizd meg.",
      "Ne találj ki forrást, hivatkozást, adatot vagy eseményt.",
      "Ha lényeges adat hiányzik, ne pótold kitalálással; szükség esetén jelöld röviden: [Pontosítandó: ...].",
      "A cél a jobb minőségű, természetes és hiteles szöveg, nem AI-detektor vagy plágiumellenőrző kijátszása.",
      "Ne írj bevezető magyarázatot a válasz elé; csak a kész szöveget add."
    ];

    let prompt = "";
    if (body.mode === "generate") {
      if (!body.topic?.trim() || !body.facts?.trim()) {
        return NextResponse.json({ error: "A témát és az alapadatokat is add meg." }, { status: 400 });
      }
      prompt = [
        ...common,
        "",
        "FELADAT: írj új szöveget kizárólag a megadott információk alapján.",
        "Téma/cím: " + body.topic.trim(),
        "Stílus: " + toneLabel(body.tone),
        "Terjedelem: " + lengthLabel(body.length),
        body.audience?.trim() ? "Célközönség: " + body.audience.trim() : "",
        body.purpose?.trim() ? "Cél: " + body.purpose.trim() : "",
        body.instructions?.trim() ? "További utasítás: " + body.instructions.trim() : "",
        body.styleSample?.trim() ? "SAJÁT STÍLUSMINTA (csak hangvételi támpont, tényként ne használd):\n" + body.styleSample.trim().slice(0, 8000) : "",
        "",
        "MEGADOTT ADATOK / TÉNYEK:",
        body.facts.trim()
      ].filter(Boolean).join("\n");
    } else {
      if (!body.sourceText?.trim()) {
        return NextResponse.json({ error: "Nincs átalakítandó szöveg." }, { status: 400 });
      }
      const strength = body.strength === "light"
        ? "Csak finoman változtass: javítsd a gördülékenységet és az ismétléseket, a szerkezetet többnyire tartsd meg."
        : body.strength === "strong"
          ? "Határozottabban szerkeszd újra a mondatokat és bekezdéseket, de a jelentést és minden tényt őrizd meg."
          : "Közepes mértékben szerkeszd át: legyen természetesebb és jobban olvasható, a jelentés maradjon azonos.";

      prompt = [
        ...common,
        "",
        "FELADAT: alakítsd át a meglévő szöveget.",
        strength,
        "Kívánt stílus: " + toneLabel(body.tone),
        "Kívánt terjedelem: " + lengthLabel(body.length),
        body.audience?.trim() ? "Célközönség: " + body.audience.trim() : "",
        body.purpose?.trim() ? "Cél: " + body.purpose.trim() : "",
        body.instructions?.trim() ? "További utasítás: " + body.instructions.trim() : "",
        body.styleSample?.trim() ? "SAJÁT STÍLUSMINTA (csak hangvételi támpont, tényként ne használd):\n" + body.styleSample.trim().slice(0, 8000) : "",
        "",
        "ÁTALAKÍTANDÓ SZÖVEG:",
        body.sourceText.trim()
      ].filter(Boolean).join("\n");
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7
          }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini write error", data);
      return NextResponse.json({ error: "Az AI-szolgáltatás most nem tudta elkészíteni a szöveget." }, { status: 502 });
    }

    const text = extractText(data);
    if (!text) {
      return NextResponse.json({ error: "Az AI nem adott vissza használható szöveget." }, { status: 502 });
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Write route error", error);
    return NextResponse.json({ error: "Váratlan hiba történt az AI-írás közben." }, { status: 500 });
  }
}
