"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import WriterWorkspace from "@/app/components/WriterWorkspace";
import {
  analyzeText,
  buildSuggestions,
  createStyleProfile,
  type AnalysisResult,
  type StyleProfile
} from "@/lib/analyze";
import {
  Activity, AlertTriangle, Check, ChevronRight, Copy, Download, FileText,
  FolderOpen, Gauge, Layers3, Plus, RefreshCw, Save, Settings, ShieldCheck,
  Sparkles, Trash2, Upload, Wand2
} from "lucide-react";

type Tab = "projektek" | "elemzes" | "aiiro" | "javito" | "szerkezet" | "export" | "beallitasok";

type SavedProject = {
  id: string;
  name: string;
  text: string;
  updatedAt: number;
  versions: { id: string; text: string; createdAt: number }[];
};

type ExportSettings = {
  font: string;
  fontSize: number;
  lineSpacing: number;
  marginCm: number;
  title: string;
};

const PROJECTS_KEY = "ai-tartalom-elemzo-projects-v2";
const PROFILE_KEY = "ai-tartalom-elemzo-style-profile-v2";
const PROFILE_SAMPLE_KEY = "ai-tartalom-elemzo-style-sample-v2";
const EXPORT_KEY = "ai-tartalom-elemzo-export-v2";

const sample = `A mesterséges intelligencia egyre nagyobb szerepet tölt be az oktatásban. Fontos megjegyezni, hogy az AI számos területen képes támogatni a tanulási folyamatot. Továbbá lehetőséget biztosít arra, hogy a tanulók személyre szabott visszajelzést kapjanak.

Ugyanakkor érdemes kiemelni, hogy az AI használata önmagában nem garantál jobb tanulási eredményt. A pedagógus szerepe továbbra is meghatározó, hiszen ő képes a tanulók egyéni szükségleteinek értelmezésére és a tanulási folyamat tudatos irányítására.

A gyakorlatban ezért nem az a kérdés, hogy az AI kiváltja-e a tanárt. Sokkal fontosabb, hogy mikor segít ténylegesen. Például egy rövid javítási körnél gyors visszajelzést adhat, de a végső értékelésnél a tanári döntés marad a biztos pont.`;

const defaultExport: ExportSettings = {
  font: "Times New Roman",
  fontSize: 12,
  lineSpacing: 1.5,
  marginCm: 2.5,
  title: "Elemzett dokumentum"
};

function nowName() {
  return "Új dokumentum " + new Date().toLocaleDateString("hu-HU");
}

export default function Home() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [tab, setTab] = useState<Tab>("elemzes");
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState(nowName());
  const [styleSample, setStyleSample] = useState("");
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(defaultExport);
  const [toast, setToast] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setProjects(JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]"));
      setStyleSample(localStorage.getItem(PROFILE_SAMPLE_KEY) || "");
      setStyleProfile(JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"));
      setExportSettings(JSON.parse(localStorage.getItem(EXPORT_KEY) || JSON.stringify(defaultExport)));
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const selectedParagraph = selected !== null && result ? result.paragraphs[selected] : null;
  const suggestions = useMemo(
    () => (selectedParagraph ? buildSuggestions(selectedParagraph.text) : []),
    [selectedParagraph]
  );

  function persistProjects(next: SavedProject[]) {
    setProjects(next);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(next));
  }

  async function runAnalysis() {
    if (!text.trim()) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 260));
    const r = analyzeText(text, styleProfile);
    setResult(r);
    setSelected(r.paragraphs.length ? 0 : null);
    setBusy(false);
  }

  async function readFile(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      if (file.name.toLowerCase().endsWith(".docx")) {
        const mammoth = await import("mammoth");
        const buffer = await file.arrayBuffer();
        const out = await mammoth.extractRawText({ arrayBuffer: buffer });
        setText(out.value);
      } else {
        setText(await file.text());
      }
      setProjectName(file.name.replace(/\.(docx|txt)$/i, "") || nowName());
      setCurrentProjectId(null);
      setResult(null);
      setSelected(null);
    } finally {
      setBusy(false);
    }
  }

  function loadSample() {
    setText(sample);
    setProjectName("Mintaszöveg");
    setCurrentProjectId(null);
    setResult(null);
    setSelected(null);
  }

  function newProject() {
    setText("");
    setResult(null);
    setSelected(null);
    setCurrentProjectId(null);
    setProjectName(nowName());
    setTab("elemzes");
  }

  function saveProject() {
    if (!text.trim()) return;
    const id = currentProjectId || crypto.randomUUID();
    const old = projects.find((p) => p.id === id);
    const versions = old?.text && old.text !== text
      ? [{ id: crypto.randomUUID(), text: old.text, createdAt: old.updatedAt }, ...old.versions].slice(0, 12)
      : old?.versions || [];
    const saved: SavedProject = {
      id,
      name: projectName.trim() || "Névtelen dokumentum",
      text,
      updatedAt: Date.now(),
      versions
    };
    const next = [saved, ...projects.filter((p) => p.id !== id)];
    persistProjects(next);
    setCurrentProjectId(id);
    setToast("Projekt mentve");
  }

  function openProject(project: SavedProject) {
    setCurrentProjectId(project.id);
    setProjectName(project.name);
    setText(project.text);
    setResult(null);
    setSelected(null);
    setTab("elemzes");
  }

  function deleteProject(id: string) {
    persistProjects(projects.filter((p) => p.id !== id));
    if (currentProjectId === id) newProject();
  }

  function restoreVersion(project: SavedProject, versionText: string) {
    setCurrentProjectId(project.id);
    setProjectName(project.name);
    setText(versionText);
    setResult(null);
    setSelected(null);
    setTab("elemzes");
    setToast("Korábbi változat betöltve");
  }

  function saveStyleProfile() {
    const profile = createStyleProfile(styleSample);
    if (!profile) {
      setToast("Legalább kb. 120 szónyi saját minta kell");
      return;
    }
    setStyleProfile(profile);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(PROFILE_SAMPLE_KEY, styleSample);
    setToast("Saját stílusprofil mentve");
  }

  function clearStyleProfile() {
    setStyleProfile(null);
    setStyleSample("");
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(PROFILE_SAMPLE_KEY);
    setToast("Stílusprofil törölve");
  }

  function updateExport<K extends keyof ExportSettings>(key: K, value: ExportSettings[K]) {
    const next = { ...exportSettings, [key]: value };
    setExportSettings(next);
    localStorage.setItem(EXPORT_KEY, JSON.stringify(next));
  }

  async function exportDocx() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const {
        AlignmentType, Document, Packer, Paragraph, TextRun
      } = await import("docx");

      const margin = Math.round(exportSettings.marginCm * 567);
      const paragraphs = text.split(/\n\s*\n|\n/).filter((p) => p.trim());
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: { top: margin, right: margin, bottom: margin, left: margin }
            }
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 320 },
              children: [new TextRun({
                text: exportSettings.title || projectName,
                bold: true,
                font: exportSettings.font,
                size: (exportSettings.fontSize + 4) * 2
              })]
            }),
            ...paragraphs.map((p) => new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              spacing: {
                line: Math.round(240 * exportSettings.lineSpacing),
                after: 120
              },
              children: [new TextRun({
                text: p.trim(),
                font: exportSettings.font,
                size: exportSettings.fontSize * 2
              })]
            }))
          ]
        }]
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (projectName || "dokumentum").replace(/[^\p{L}\p{N}_-]+/gu, "_") + ".docx";
      a.click();
      URL.revokeObjectURL(url);
      setToast("Word-fájl elkészült");
    } finally {
      setBusy(false);
    }
  }

  async function copySelected() {
    if (!selectedParagraph) return;
    await navigator.clipboard.writeText(selectedParagraph.text);
    setToast("Bekezdés másolva");
  }

  return (
    <main className="app-shell">
      {toast && <div className="toast">{toast}</div>}

      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><Sparkles size={20} /></div>
          <div>
            <strong>AI Tartalom Elemző</strong>
            <span>Javítóasztal · V3</span>
          </div>
        </div>
        <div className="top-actions">
          <button className="top-btn" onClick={saveProject} disabled={!text.trim()}><Save size={15}/> Mentés</button>
          <div className="status"><span className="dot" /> Helyi elemző aktív</div>
        </div>
      </header>

      <nav className="tabs">
        {[
          ["projektek", "Projektek", FolderOpen],
          ["elemzes", "Elemzés", Gauge],
          ["aiiro", "AI Író", Sparkles],
          ["javito", "Javítóasztal", Wand2],
          ["szerkezet", "Szerkezet", Layers3],
          ["export", "Export", FileText],
          ["beallitasok", "Beállítások", Settings]
        ].map(([key, label, Icon]) => (
          <button key={key as string} className={tab === key ? "active" : ""} onClick={() => setTab(key as Tab)}>
            <Icon size={17} /> {label as string}
          </button>
        ))}
      </nav>

      {tab !== "projektek" && (
        <section className="document-bar">
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} aria-label="Dokumentum neve" />
          <span>{text.trim() ? text.trim().split(/\s+/).length : 0} szó</span>
          {currentProjectId && <span className="saved-pill"><Check size={13}/> mentett projekt</span>}
        </section>
      )}

      {tab === "projektek" && (
        <section className="projects-wrap">
          <div className="section-title">
            <div><span className="eyebrow">DOKUMENTUMTÁR</span><h1>Projektek és változatok</h1><p>A mentések ezen az eszközön maradnak meg. A felhőszinkron később kapcsolható hozzá.</p></div>
            <button className="primary" onClick={newProject}><Plus size={17}/> Új dokumentum</button>
          </div>
          <div className="projects-grid">
            {projects.map((p) => (
              <article className="project-card" key={p.id}>
                <div className="project-icon"><FileText size={22}/></div>
                <h3>{p.name}</h3>
                <p>{p.text.slice(0, 150)}{p.text.length > 150 ? "…" : ""}</p>
                <div className="project-meta"><span>{new Date(p.updatedAt).toLocaleString("hu-HU")}</span><span>{p.versions.length} korábbi verzió</span></div>
                <div className="project-actions">
                  <button className="primary" onClick={() => openProject(p)}>Megnyitás</button>
                  <button className="danger-icon" onClick={() => deleteProject(p.id)} aria-label="Törlés"><Trash2 size={17}/></button>
                </div>
                {p.versions.length > 0 && <details className="versions"><summary>Korábbi változatok</summary>{p.versions.map((v) => <button key={v.id} onClick={() => restoreVersion(p, v.text)}>{new Date(v.createdAt).toLocaleString("hu-HU")}</button>)}</details>}
              </article>
            ))}
            {!projects.length && <div className="panel empty-projects"><FolderOpen size={42}/><b>Még nincs mentett projekt</b><span>Nyiss új dokumentumot, elemezd, majd mentsd el.</span></div>}
          </div>
        </section>
      )}

      {tab === "elemzes" && (
        <>
          <section className="hero">
            <div>
              <div className="eyebrow">AI-STÍLUSVIZSGÁLAT</div>
              <h1>Ne csak egy százalékot kapj.<br /><span>Lásd, miért gyanús.</span></h1>
              <p>Bekezdésenkénti kockázattérkép, indoklás, bizonytalansági szint és opcionális saját stílusprofil.</p>
            </div>
            <div className="hero-badge"><ShieldCheck size={34} /><div><b>Nem ítél, hanem jelez</b><small>A pontszám nem szerzőségi bizonyíték.</small></div></div>
          </section>

          <section className="workspace">
            <div className="panel input-panel">
              <div className="panel-head">
                <div><span className="step">1</span><div><b>Szöveg</b><small>Másold be vagy tölts fel DOCX/TXT fájlt.</small></div></div>
                <button className="ghost" onClick={loadSample}>Mintaszöveg</button>
              </div>
              <textarea value={text} onChange={(e) => {setText(e.target.value); setResult(null);}} placeholder="Ide másold a vizsgálandó szöveget…" />
              <div className="input-actions">
                <button className="secondary" onClick={() => inputRef.current?.click()}><Upload size={17} /> Fájl</button>
                <input ref={inputRef} type="file" accept=".txt,.docx" hidden onChange={(e) => readFile(e.target.files?.[0])} />
                <span>{styleProfile ? "Saját stílusprofil: aktív" : "Alap elemzési profil"}</span>
                <button className="primary" disabled={!text.trim() || busy} onClick={runAnalysis}>
                  {busy ? <RefreshCw className="spin" size={17} /> : <Activity size={17} />}
                  {busy ? "Elemzés…" : "Elemzés indítása"}
                </button>
              </div>
            </div>

            <div className="panel result-panel">
              <div className="panel-head">
                <div><span className="step">2</span><div><b>Eredmény</b><small>Összesített jelzés és fő minták.</small></div></div>
              </div>
              {!result ? (
                <div className="empty"><Gauge size={38} /><b>Még nincs elemzés</b><span>A részletes eredmény itt jelenik meg.</span></div>
              ) : (
                <div className="score-wrap">
                  <div className={"score-ring " + (result.score >= 65 ? "risk-high" : result.score >= 35 ? "risk-mid" : "risk-low")}>
                    <strong>{result.score}</strong><span>/100</span>
                  </div>
                  <div className="score-copy">
                    <h3>{result.label}</h3>
                    <p>{result.words} szó · {result.sentences} mondat · bizonyosság: <b>{result.confidence}</b></p>
                    {result.profileMatch !== undefined && <div className="profile-match">Saját stílushoz hasonlóság: <strong>{result.profileMatch}%</strong></div>}
                  </div>
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
                    <button className="secondary wide" onClick={copySelected}><Copy size={16}/> Bekezdés másolása</button>
                    <button className="primary wide" onClick={() => setTab("javito")}><Wand2 size={16} /> Megnyitás a Javítóasztalon</button>
                  </> : <div className="empty mini">Válassz egy bekezdést.</div>}
                </aside>
              </div>
            </section>
          )}
        </>
      )}

      {tab === "aiiro" && (
        <WriterWorkspace
          documentText={text}
          styleSample={styleSample}
          onUseText={(next) => { setText(next); setResult(null); setSelected(null); }}
          onToast={setToast}
        />
      )}

      {tab === "javito" && (
        <section className="panel editor-panel">
          <div className="panel-head"><div><span className="step">J</span><div><b>Javítóasztal</b><small>Javítási irányok, nem automatikus „detektor-kijátszás”.</small></div></div></div>
          {!selectedParagraph ? <div className="empty"><Wand2 size={38}/><b>Előbb futtass elemzést</b><span>Válassz egy bekezdést a kockázattérképen.</span></div> :
          <div className="compare">
            <div className="compare-card"><label>EREDETI</label><p>{selectedParagraph.text}</p></div>
            <div className="compare-card suggestion-card"><label>JAVÍTÁSI IRÁNYOK</label>{suggestions.map((s,i)=><div className="suggestion" key={i}><Sparkles size={16}/><span>{s}</span></div>)}</div>
          </div>}
        </section>
      )}

      {tab === "szerkezet" && (
        <section className="panel editor-panel">
          <div className="panel-head"><div><span className="step">S</span><div><b>Szerkezet</b><small>Bekezdések, kockázati pontok és hossz áttekintése.</small></div></div></div>
          <div className="structure-list">
            {(result?.paragraphs ?? []).map((p,i)=><div key={i}><span>{i+1}.</span><p>{p.text.slice(0,140)}{p.text.length>140?"…":""}</p><b>{p.score}</b></div>)}
            {!result && <div className="empty"><Layers3 size={38}/><b>Nincs feldolgozott szöveg</b><span>Az elemzés után itt jelenik meg a szerkezet.</span></div>}
          </div>
        </section>
      )}

      {tab === "export" && (
        <section className="panel editor-panel">
          <div className="panel-head"><div><span className="step">E</span><div><b>Word export</b><small>A fő formázási beállítások már működnek.</small></div></div></div>
          <div className="export-layout">
            <div className="form-card">
              <label>Cím<input value={exportSettings.title} onChange={(e)=>updateExport("title", e.target.value)}/></label>
              <label>Betűtípus<select value={exportSettings.font} onChange={(e)=>updateExport("font", e.target.value)}><option>Times New Roman</option><option>Arial</option><option>Calibri</option><option>Georgia</option></select></label>
              <div className="form-row">
                <label>Betűméret<input type="number" min="9" max="18" value={exportSettings.fontSize} onChange={(e)=>updateExport("fontSize", Number(e.target.value))}/></label>
                <label>Sorköz<select value={exportSettings.lineSpacing} onChange={(e)=>updateExport("lineSpacing", Number(e.target.value))}><option value={1}>1,0</option><option value={1.15}>1,15</option><option value={1.5}>1,5</option><option value={2}>2,0</option></select></label>
                <label>Margó (cm)<input type="number" min="1" max="5" step=".1" value={exportSettings.marginCm} onChange={(e)=>updateExport("marginCm", Number(e.target.value))}/></label>
              </div>
              <button className="primary export-button" disabled={!text.trim() || busy} onClick={exportDocx}><Download size={17}/> Word-fájl készítése</button>
            </div>
            <div className="paper-preview">
              <div className="paper">
                <h3>{exportSettings.title || projectName}</h3>
                <p style={{fontFamily: exportSettings.font, fontSize: Math.max(10, exportSettings.fontSize - 2), lineHeight: exportSettings.lineSpacing}}>{text.slice(0, 700) || "A dokumentum előnézete itt jelenik meg."}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === "beallitasok" && (
        <section className="settings-wrap">
          <div className="panel settings-card">
            <div className="panel-head"><div><span className="step">A</span><div><b>Saját stílusprofil</b><small>Adj meg olyan szöveget, amelyről biztosan tudod, hogy te írtad.</small></div></div></div>
            <div className="settings-body">
              <p>Az elemző a saját mintád mondathosszát, változatosságát és szókészleti mintáját összeveti a vizsgált szöveggel. Ez nem személyazonosítás, csak helyi stíluskalibráció.</p>
              <textarea value={styleSample} onChange={(e)=>setStyleSample(e.target.value)} placeholder="Másolj ide legalább kb. 120 szónyi saját szöveget…"/>
              <div className="settings-actions">
                <button className="primary" onClick={saveStyleProfile}><Save size={16}/> Profil mentése</button>
                {styleProfile && <button className="secondary" onClick={clearStyleProfile}><Trash2 size={16}/> Profil törlése</button>}
              </div>
              {styleProfile && <div className="profile-stats"><div><span>Átlagos mondathossz</span><b>{styleProfile.avgSentenceLength} szó</b></div><div><span>Mondathossz változása</span><b>{styleProfile.sentenceVariation}</b></div><div><span>Lexikai változatosság</span><b>{Math.round(styleProfile.lexicalDiversity*100)}%</b></div></div>}
            </div>
          </div>
          <div className="panel integrity-card"><ShieldCheck size={30}/><div><b>Használati alapelv</b><p>Az AI-eredmény csak jelzés. Oktatási vagy értékelési döntésnél ne egyetlen százalék döntsön; a szöveg tartalmát, forrásait és keletkezési körülményeit is vizsgálni kell.</p></div></div>
        </section>
      )}

      <footer>AI Tartalom Elemző · V3 fejlesztési ág · A pontszám nem használható önmagában szerzőség bizonyítására.</footer>
    </main>
  );
}
