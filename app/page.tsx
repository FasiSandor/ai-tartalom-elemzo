"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import VisualReport from "@/components/VisualReport";
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

type Tab = "projektek" | "elemzes" | "javito" | "szerkezet" | "export" | "beallitasok" | "jelentes";

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
  const [fileError, setFileError] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
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
    setFileError("");
    setUploadProgress("Fájl előkészítése…");
    try {
      if (file.size > 45 * 1024 * 1024) throw new Error("A fájl nagyobb 45 MB-nál. Kérlek, kisebb fájlt válassz.");
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
        const pages: string[] = [];
        if (pdf.numPages > 500) throw new Error("A PDF több mint 500 oldalas; oszd több részre az elemzéshez.");
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (pageNum === 1 || pageNum % 5 === 0 || pageNum === pdf.numPages) setUploadProgress(`PDF feldolgozása: ${pageNum}/${pdf.numPages} oldal`);
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent();
          const extracted = content.items.map((item) => ("str" in item ? String(item.str) : "")).join(" ");
          if (extracted.trim()) pages.push(extracted);
          if (pageNum % 12 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
        if (!pages.length || pages.join("").trim().length < 50) throw new Error("A PDF valószínűleg képalapú. Szövegfelismerés (OCR) szükséges.");
        setText(pages.join("\n\n"));
      } else if (file.name.toLowerCase().endsWith(".docx")) {
        const mammoth = await import("mammoth");
        const buffer = await file.arrayBuffer();
        const out = await mammoth.extractRawText({ arrayBuffer: buffer });
        setText(out.value);
      } else if (file.name.toLowerCase().endsWith(".txt")) {
        setText(await file.text());
      } else {
        throw new Error("Csak PDF, DOCX és TXT fájl tölthető fel.");
      }
      setProjectName(file.name.replace(/\.(docx|txt|pdf)$/i, "") || nowName());
      setCurrentProjectId(null);
      setResult(null);
      setSelected(null);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Nem sikerült beolvasni a fájlt.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      setUploadProgress("");
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

  async function exportReportDocx() {
    if (!result) return;
    setBusy(true);
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
      const paragraphs = [
        new Paragraph({ text: projectName, heading: HeadingLevel.TITLE }),
        new Paragraph({ text: "Részletes tanári mintázatelemzési jelentés", heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: `Szavak: ${result.words} | Mondatok: ${result.sentences} | Bekezdések: ${result.paragraphs.length}` }),
        new Paragraph({ text: `Mintázati jelzés: ${result.score}/100 – ${result.label}` }),
        new Paragraph({ text: "Fontos: a pontszám nem az AI-val írt szöveg aránya, nem bizonyít AI-szerzőséget vagy plágiumot." }),
        new Paragraph({ text: "Nyelvi mintázatok", heading: HeadingLevel.HEADING_2 }),
        ...result.signals.map(signal => new Paragraph({ children: [
          new TextRun({ text: `${signal.label} (${signal.value}/100): `, bold: true }),
          new TextRun(signal.detail)
        ] })),
        new Paragraph({ text: "Bekezdésenkénti értékelés", heading: HeadingLevel.HEADING_2 }),
        ...result.paragraphs.flatMap((p, i) => [
          new Paragraph({ text: `${i + 1}. bekezdés – ${p.score}/100`, heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: p.text }),
          ...p.reasons.map(reason => new Paragraph({ text: `Indoklás: ${reason}`, bullet: { indent: 360 } })),
          new Paragraph({ text: "Tanári ellenőrzés: konkrét példák, források és a gondolatmenet saját szavas magyarázata." })
        ]),
        new Paragraph({ text: "Értelmezési korlátok", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: "A vizsgált stílusjegyek emberi szövegekben is előfordulnak. Az elemzés nem validált AI-detektor; önmagában nem használható szankció alapjául." })
      ];
      const doc = new Document({ sections: [{ children: paragraphs }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (projectName || "jelentes").replace(/[^\\p{L}\\p{N}_-]+/gu, "_") + "_tanari_jelentes.docx";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast("Tanári jelentés Word-fájl elkészült");
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Nem sikerült elkészíteni a jelentést.");
      setToast("Nem sikerült exportálni a jelentést");
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
            <span>Dokumentumvizsgálat · tanári műhely</span>
          </div>
        </div>
        <div className="top-actions">
          <button className="top-btn" onClick={saveProject} disabled={!text.trim()}><Save size={15}/> Mentés</button>
          <div className="status"><span className="dot" /> Helyi elemző aktív</div>
        </div>
      </header>

      <nav className="tabs">
        {([
          ["projektek", "Projektek", FolderOpen],
          ["elemzes", "Elemzés", Gauge],
          ["javito", "Javítóasztal", Wand2],
          ["jelentes", "Jelentés", Activity],
          ["szerkezet", "Szerkezet", Layers3],
          ["export", "Export", FileText],
          ["beallitasok", "Beállítások", Settings]
        ] as const).map(([key, label, Icon]) => (
          <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            <Icon size={17} /> {label}
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
              <h1>Tölts fel. Elemezz.<br /><span>Értsd meg a jelzéseket.</span></h1>
              <p>1. Dokumentum feltöltése → 2. Mintázatelemzés → 3. Interaktív térkép és részletes jelentés. A jelzések nem bizonyítanak AI-használatot.</p>
            </div>
            <div className="hero-badge"><ShieldCheck size={34} /><div><b>Nem ítél, hanem jelez</b><small>A pontszám nem szerzőségi bizonyíték.</small></div></div>
          </section>

          <section className="workspace">
            <div className="panel input-panel">
              <div className="panel-head">
                <div><span className="step">1</span><div><b>Szöveg</b><small>Másold be a szöveget, vagy válassz PDF, DOCX vagy TXT fájlt.</small></div></div>
                <button className="ghost" onClick={loadSample}>Mintaszöveg</button>
              </div>
              <textarea value={text} onChange={(e) => {setText(e.target.value); setResult(null);}} placeholder="Ide másold a vizsgálandó szöveget…" />
              <div className="input-actions">
                <button className="secondary" onClick={() => inputRef.current?.click()}><Upload size={17} /> Fájl</button>
                <input ref={inputRef} type="file" accept=".txt,.docx,.pdf" hidden onChange={(e) => readFile(e.target.files?.[0])} />
                <span>{styleProfile ? "Saját stílusprofil: aktív" : "Alap elemzési profil"}</span>
                <button className="primary" disabled={!text.trim() || busy} onClick={runAnalysis}>
                  {busy ? <RefreshCw className="spin" size={17} /> : <Activity size={17} />}
                  {busy ? "Elemzés…" : "Elemzés indítása"}
                </button>
              </div>
              {uploadProgress && <p role="status" style={{color:"#60a5fa",padding:"0 16px 12px",fontSize:13}}>{uploadProgress}</p>}
              {fileError && <p role="alert" style={{color:"#fca5a5",padding:"0 16px 12px",fontSize:13}}>{fileError}</p>}
              {result && <div style={{padding:"0 14px 14px"}}><button className="primary wide" onClick={()=>setTab("jelentes")}><FileText size={17}/> Részletes jelentés és diagramok</button></div>}
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
                    <h3>{result.label}</h3><p>Stílusmintázati pontszám, nem az AI-val írt rész becsült aránya.</p>
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

      {tab === "jelentes" && (
        <section className="settings-wrap">
          {!result ? <div className="panel empty"><FileText size={38}/><b>Előbb elemezz egy dokumentumot</b><span>Feltöltés és elemzés után megjelennek a vizuális és szöveges eredmények.</span><button className="primary" onClick={()=>setTab("elemzes")}>Elemzés megnyitása</button></div> : <>
            <div className="panel" style={{padding:20}}>
              <span className="eyebrow">RÉSZLETES TANÁRI JELENTÉS</span>
              <h1 style={{margin:"6px 0 12px"}}>{projectName}</h1>
              <p style={{color:"#94a3b8"}}>{result.words} szó · {result.paragraphs.length} vizsgált bekezdés · {result.sentences} mondat</p>
              <h2>Mintázati jelzés: {result.score}/100</h2>
              <p>{result.label}. Az érték nem a mesterséges intelligencia által írt szöveg százalékos aránya.</p>
              <p style={{color:"#94a3b8"}}>Az elemzés szöveghossz-alapú bizonyossági besorolása: {result.confidence}. Ez nem validált detektálási pontosság.</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:10}}><button className="primary" onClick={()=>window.print()}><Download size={16}/> PDF-be mentés / nyomtatás</button><button className="secondary" disabled={busy} onClick={exportReportDocx}><FileText size={16}/> Teljes tanári jelentés Wordben</button></div>
            </div>
            <VisualReport sections={[{id:"document",title:"Teljes dokumentum",paragraphScores:result.paragraphs.map(p=>p.score)}]} onSelect={(_,i)=>{setSelected(i);setTab("elemzes");}} />
            <div className="panel" style={{padding:20}}>
              <h2>Azonosított nyelvi mintázatok</h2>
              {result.signals.map(s=><div key={s.label} className="reason"><strong>{s.label}: {s.value}/100</strong> — {s.detail}</div>)}
              <h2>Megjelölt bekezdések és indoklásuk</h2>
              {result.paragraphs.map((p,i)=><article key={i} style={{borderTop:"1px solid #2a3445",padding:"14px 0"}}>
                <b>{i+1}. bekezdés · {p.score}/100</b>
                <p style={{whiteSpace:"pre-wrap",lineHeight:1.6}}>{p.text}</p>
                <ul>{p.reasons.map((r,j)=><li key={j}>{r}</li>)}</ul>
                <p style={{color:"#94a3b8",fontSize:12}}>Tanári ellenőrzés: kérj konkrét példát, a hivatkozott forrás bemutatását és a gondolatmenet saját szavakkal történő magyarázatát.</p>
              </article>)}
              <h2>Értelmezési korlátok</h2>
              <p>Az egyenletes mondathossz, a sablonos kifejezések és a stílusváltások ember által írt szövegben is előfordulnak. A jelentés nem bizonyít AI-szerzőséget, plágiumot vagy szabályszegést. Önálló szankció alapjául nem használható.</p>
            </div>
          </>}
        </section>
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

      <footer>AI Tartalom Elemző · V2 fejlesztési ág · A pontszám nem használható önmagában szerzőség bizonyítására.</footer>
    </main>
  );
}
