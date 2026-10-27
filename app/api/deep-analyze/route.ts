import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Req = {
  text?: string;
  title?: string;
};

function extractJson(raw: string) {
  const cleaned = raw.replace(/^\s*\`\`\`json\s*/i,"").replace(/\s*\`\`\`\s*$/,"").trim();
  return JSON.parse(cleaned);
}

export async function POST(request: Request) {
  try {
    const { text = "", title = "" } = (await request.json()) as Req;
    if (!text.trim()) return NextResponse.json({ error: "Nincs elemezhető szöveg." }, { status: 400 });

    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) return NextResponse.json({ error: "A Gemini API-kulcs még nincs beállítva." }, { status: 503 });

    const model = process.env.GEMINI_ANALYSIS_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const maxChunk = 14000;
    const chunks: string[] = [];
    let rest = text.trim();
    while (rest.length) {
      let cut = Math.min(maxChunk, rest.length);
      if (cut < rest.length) {
        const para = rest.lastIndexOf("\n\n", cut);
        if (para > maxChunk * 0.6) cut = para;
      }
      chunks.push(rest.slice(0, cut));
      rest = rest.slice(cut).trim();
    }

    const findings: any[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const prompt = [
        "Magyar szakdolgozat szövegét elemzed szerkesztői és stilisztikai szempontból.",
        "Nem szerzőséget bizonyítasz és nem AI-detektort játszol ki.",
        "Vizsgáld: nyelvhelyesség, mondatszerkezet, ismétlés, túl általános/generikus megfogalmazás, logikai ugrás, következetlen terminológia, túl steril/egyenletes stílus, szakmai hang, hivatkozásgyanús állítás, amelyhez forrás kellhet, továbbá minden befejezetlen, értelmetlen, nyelvtanilag széteső, félbemaradt vagy kontextus nélkül maradó mondatot és mondatrészt.",
        "Csak a ténylegesen problémás vagy érdemi részeket jelöld.",
        "Adj vissza KIZÁRÓLAG érvényes JSON-t ebben a formában:",
        '{"summary":"...","items":[{"quote":"rövid idézet max 18 szó","category":"nyelv|mondattöredék|stílus|ismétlés|logika|terminológia|forrás","severity":"alacsony|közepes|magas","reason":"...","suggestion":"..."}]}',
        `Dokumentum: ${title || "névtelen"}`,
        `Rész: ${i+1}/${chunks.length}`,
        "",
        chunks[i]
      ].join("\n");

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method:"POST",
          headers:{"x-goog-api-key":key,"Content-Type":"application/json"},
          body:JSON.stringify({
            contents:[{role:"user",parts:[{text:prompt}]}],
            generationConfig:{temperature:0.2,responseMimeType:"application/json"}
          })
        }
      );
      const data = await response.json();
      if (!response.ok) {
        console.error("Gemini deep analysis error", data);
        return NextResponse.json({ error:"A Gemini mélyelemzés megszakadt." }, { status:502 });
      }
      const raw=(data?.candidates?.[0]?.content?.parts||[]).map((p:any)=>p?.text||"").join("");
      try {
        const parsed=extractJson(raw);
        for (const item of parsed.items || []) findings.push({...item, chunk:i+1});
      } catch {
        findings.push({quote:"",category:"rendszer",severity:"közepes",reason:"Egy rész elemzési válasza nem volt feldolgozható.",suggestion:"Futtasd újra ezt a részt.",chunk:i+1});
      }
    }

    const counts = findings.reduce((acc:any, f:any) => {
      acc[f.category]=(acc[f.category]||0)+1; return acc;
    },{});

    return NextResponse.json({
      chunks: chunks.length,
      findings,
      counts,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error:"Váratlan hiba a mélyelemzés során." }, { status:500 });
  }
}
