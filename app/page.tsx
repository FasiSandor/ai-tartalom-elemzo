"use client";

import { useMemo, useRef, useState } from "react";
import { analyzeText, buildSuggestions, type AnalysisResult } from "@/lib/analyze";
import {
  Activity, AlertTriangle, Check, ChevronRight, FileText, Gauge, Layers3,
  RefreshCw, ShieldCheck, Sparkles, Upload, Wand2
} from "lucide-react";

const sample = `A mesterséges intelligencia egyre nagyobb szerepet tölt be az oktatásban. Fontos megjegyezni, hogy az AI számos területen képes támogatni a tanulási folyamatot. Továbbá lehetőséget biztosít arra, hogy a tanulók személyre szabott visszajelzést kapjanak.

Ugyanakkor érdemes kiemelni, hogy az AI használata önmagában nem garantál jobb tanulási eredményt. A pedagógus szerepe továbbra is meghatározó, hiszen ő képes a tanulók egyéni szükségleteinek értelmezésére és a tanulási folyamat tudatos irányítására.

A gyakorlatban ezért nem az a kérdés, hogy az AI kiváltja-e a tanárt. Sokkal fontosabb, hogy mikor segít ténylegesen. Például egy rövid javítási körnél gyors visszajelzést adhat, de a végső értékelésnél a tanári döntés marad a biztos pont.`;

type Tab = "elemzes" | "javito" | "szerkezet" | "export";

export default function Home() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [tab, setTab] = useState<Tab>("elemzes");
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedParagraph = selected !== null && result ? result.paragraphs[selected] : null;
  const suggestions = useMemo(
    () => (selectedParagraph ? buildSuggestions(selectedParagraph.text) : []),
    [selectedParagraph]
  );

  async function runAnalysis() {
    if (!text.trim()) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 420));
    const r = analyzeText(text);
    setResult(r);
    setSelected(r.paragraphs.length ? 0 : null);
    setBusy(false);
  }

  async function readFile(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      if (file.name.toLowerCase().endsWith(".docx")) {
        const mammoth = await import("mammoth/mammoth.browser");
        const buffer = await file.arrayBuffer();
        const out = await mammoth.extractRawText({ arrayBuffer: buffer });
        setText(out.value);
      } else {
        setText(await file.text());
      }
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  function loadSample() {
    setText(sample);
    setResult(null);
    setSelected(null);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><Sparkles size={20} /></div>
          <div>
            <strong>AI Tartalom Elemző</strong>
            <span>Javítóasztal</span>
          </div>
        </div>
        <div className="status"><span className="dot" /> Helyi elemző aktív</div>
      </header>

      <nav className="tabs">
        {[
          ["elemzes", "Elemzés", Gauge],
          ["javito", "Javítóasztal", Wand2],
          ["szerkezet", "Szerkezet", Layers3],
          ["export", "Export", FileText]
        ].map(([key, label, Icon]) => (
          <button key={key as string} className={tab === key ? "active" : ""} onClick={() => setTab(key as Tab)}>
            <Icon size={17} /> {label as string}
          </button>
        ))}
      </nav>

      <section className="hero">
        <div>
          <div className="eyebrow">AI-STÍLUSVIZSGÁLAT</div>
          <h1>Ne csak egy százalékot kapj.<br /><span>Lásd, miért gyanús.</span></h1>
          <p>Bekezdésenkénti kockázattérkép, indoklás és javítási javaslat. Az eredmény stílusjelzés, nem bizonyíték az AI-használatra.</p>
        </div>
        <div className="hero-badge"><ShieldCheck size={34} /><div><b>Biztonságos alapelv</b><small>Nem ítél, hanem jelez és indokol.</small></div></div>
      </section>

      {tab === "elemzes" && (
        <>
          <section className="workspace">
            <div className="panel input-panel">
              <div className="panel-head">
                <div><span className="step">1</span><div><b>Szöveg</b><small>Másold be vagy tölts fel DOCX/TXT fájlt.</small></div></div>
                <button className="ghost" onClick={loadSample}>Mintaszöveg</button>
              </div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Ide másold a vizsgálandó szöveget…" />
              <div className="input-actions">
                <button className="secondary" onClick={() => inputRef.current?.click()}><Upload size={17} /> Fájl kiválasztása</button>
                <input ref={inputRef} type="file" accept=".txt,.docx" hidden onChange={(e) => readFile(e.target.files?.[0])} />
                <span>{text.trim() ? text.trim().split(/\s+/).length : 0} szó</span>
                <button className="primary" disabled={!text.trim() || busy} onClick={runAnalysis}>
                  {busy ? <RefreshCw className="spin" size={17} /> : <Activity size={17} />}
                  {busy ? "Elemzés…" : "Elemzés indítása"}
                </button>
              </div>
            </div>

            <div className="panel result-panel">
              <div className="panel-head">
                <div><span className="step">2</span><div><b>Eredmény</b><small>Összesített kockázat és fő jelek.</small></div></div>
              </div>
              {!result ? (
                <div className="empty"><Gauge size={38} /><b>Még nincs elemzés</b><span>A részletes eredmény itt jelenik meg.</span></div>
              ) : (
                <div className="score-wrap">
                  <div className={"score-ring " + (result.score >= 65 ? "risk-high" : result.score >= 35 ? "risk-mid" : "risk-low")}>
                    <strong>{result.score}</strong><span>/100</span>
                  </div>
                  <div className="score-copy"><h3>{result.label}</h3><p>{result.words} szó · {result.sentences} mondat · {result.paragraphs.length} vizsgált bekezdés</p></div>
                  <div className="signals">
                    {result.signals.map((s) => <div className="signal" key={s.label}><div><span>{s.label}</span><b>{s.value}%</b></div><div className="bar"><i style={{ width: s.value + "%" }} /></div><small>{s.detail}</small></div>)}
                  </div>
                </div>
              )}
            </div>
          </section>

          {result && (
            <section className="panel map-panel">
              <div className="panel-head">
                <div><span className="step">3</span><div><b>Kockázattérkép</b><small>Kattints egy bekezdésre az indoklásért.</small></div></div>
                <div className="legend"><span><i className="low" /> természetesebb</span><span><i className="medium" /> vegyes</span><span><i className="high" /> erősebb jel</span></div>
              </div>
              <div className="paragraph-grid">
                <div className="paragraph-list">
                  {result.paragraphs.map((p, i) => (
                    <button key={i} onClick={() => setSelected(i)} className={"paragraph " + p.level + (selected === i ? " selected" : "")}>
                      <span className="p-num">{i + 1}</span><p>{p.text}</p><b>{p.score}</b><ChevronRight size={18} />
                    </button>
                  ))}
                </div>
                <aside className="why">
                  {selectedParagraph ? <>
                    <div className="why-title"><AlertTriangle size={20} /><div><b>Miért kapta ezt?</b><span>{selectedParagraph.score}/100 kockázati pont</span></div></div>
                    {selectedParagraph.reasons.map((r) => <div className="reason" key={r}><Check size={15} />{r}</div>)}
                    <button className="primary wide" onClick={() => setTab("javito")}><Wand2 size={16} /> Megnyitás a Javítóasztalon</button>
                  </> : <div className="empty mini">Válassz egy bekezdést.</div>}
                </aside>
              </div>
            </section>
          )}
        </>
      )}

      {tab === "javito" && (
        <section className="panel editor-panel">
          <div className="panel-head"><div><span className="step">J</span><div><b>Javítóasztal</b><small>Az eredeti szöveg nem íródik felül.</small></div></div></div>
          {!selectedParagraph ? <div className="empty"><Wand2 size={38}/><b>Előbb futtass elemzést</b><span>Válassz egy bekezdést a kockázattérképen.</span></div> :
          <div className="compare">
            <div className="compare-card"><label>EREDETI</label><p>{selectedParagraph.text}</p></div>
            <div className="compare-card suggestion-card"><label>JAVÍTÁSI IRÁNYOK</label>{suggestions.map((s,i)=><div className="suggestion" key={i}><Sparkles size={16}/><span>{s}</span></div>)}</div>
          </div>}
        </section>
      )}

      {tab === "szerkezet" && (
        <section className="panel editor-panel">
          <div className="panel-head"><div><span className="step">S</span><div><b>Szerkezet</b><small>Automatikus fejezet- és bekezdésáttekintés.</small></div></div></div>
          <div className="structure-list">
            {(result?.paragraphs ?? []).map((p,i)=><div key={i}><span>{i+1}.</span><p>{p.text.slice(0,120)}{p.text.length>120?"…":""}</p><b>{p.score}</b></div>)}
            {!result && <div className="empty"><Layers3 size={38}/><b>Nincs feldolgozott szöveg</b><span>Az elemzés után itt jelenik meg a szerkezet.</span></div>}
          </div>
        </section>
      )}

      {tab === "export" && (
        <section className="panel editor-panel">
          <div className="panel-head"><div><span className="step">E</span><div><b>Export</b><small>A részletes DOCX-sablonkezelés a következő fejlesztési körben érkezik.</small></div></div></div>
          <div className="export-card"><FileText size={42}/><h3>Word-formázó előkészítve</h3><p>A Claude-változat papírméret, margó, betűstílus, címsor, oldalszám és tartalomjegyzék funkcióit itt visszük tovább.</p></div>
        </section>
      )}

      <footer>AI Tartalom Elemző · V1 alap · Az eredmény nem használható önmagában szerzőség bizonyítására.</footer>
    </main>
  );
}
