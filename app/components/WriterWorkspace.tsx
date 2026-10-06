"use client";

import { useState } from "react";
import { Check, Copy, FilePlus2, RefreshCw, Sparkles, Wand2 } from "lucide-react";

type Mode = "transform" | "generate";

type Props = {
  documentText: string;
  styleSample: string;
  onUseText: (text: string) => void;
  onToast: (message: string) => void;
};

const toneOptions = [
  ["natural", "Természetes"],
  ["professional", "Szakmai"],
  ["academic", "Tudományos"],
  ["simple", "Egyszerű, közérthető"],
  ["concise", "Tömör"],
  ["personal", "Saját hangú"]
];

export default function WriterWorkspace({ documentText, styleSample, onUseText, onToast }: Props) {
  const [mode, setMode] = useState<Mode>("transform");
  const [tone, setTone] = useState("natural");
  const [length, setLength] = useState("same");
  const [strength, setStrength] = useState("medium");
  const [audience, setAudience] = useState("");
  const [purpose, setPurpose] = useState("");
  const [instructions, setInstructions] = useState("");
  const [topic, setTopic] = useState("");
  const [facts, setFacts] = useState("");
  const [useStyle, setUseStyle] = useState(true);
  const [generated, setGenerated] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    const hasInput = mode === "transform" ? documentText.trim() : topic.trim() && facts.trim();
    if (!hasInput) {
      onToast(mode === "transform" ? "Nincs átalakítandó dokumentumszöveg" : "Adj meg témát és alapadatokat");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          sourceText: documentText,
          topic,
          facts,
          tone,
          length,
          strength,
          audience,
          purpose,
          instructions,
          styleSample: useStyle ? styleSample : ""
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Az AI-kérés nem sikerült.");
      setGenerated(data.text || "");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Az AI-kérés nem sikerült");
    } finally {
      setBusy(false);
    }
  }

  async function copyResult() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated);
    onToast("Az új szöveg a vágólapra került");
  }

  function replaceDocument() {
    if (!generated) return;
    onUseText(generated);
    onToast("Az új változat bekerült a dokumentumba");
  }

  function appendDocument() {
    if (!generated) return;
    onUseText(documentText.trim() ? documentText.trim() + "\n\n" + generated : generated);
    onToast("Az új szöveg a dokumentum végére került");
  }

  return (
    <section className="writer-shell">
      <div className="writer-mode-switch">
        <button className={mode === "transform" ? "active" : ""} onClick={() => { setMode("transform"); setGenerated(""); }}>
          <Wand2 size={17}/> Átalakítás
        </button>
        <button className={mode === "generate" ? "active" : ""} onClick={() => { setMode("generate"); setGenerated(""); }}>
          <FilePlus2 size={17}/> Megírás adatokból
        </button>
      </div>

      <div className="writer-grid">
        <div className="panel writer-control">
          <div className="panel-head">
            <div><span className="step">{mode === "transform" ? "Á" : "M"}</span><div>
              <b>{mode === "transform" ? "Meglévő szöveg átalakítása" : "Új szöveg megírása"}</b>
              <small>{mode === "transform" ? "A tartalom megőrzésével változtat a stíluson és szerkezeten." : "A megadott adatokból készít szerkesztett szöveget."}</small>
            </div></div>
          </div>

          <div className="writer-form">
            {mode === "transform" ? (
              <div className="source-preview">
                <label>AKTUÁLIS DOKUMENTUM</label>
                <p>{documentText.trim() || "Még nincs szöveg a dokumentumban."}</p>
              </div>
            ) : (
              <>
                <label>Téma / cím
                  <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Pl. A mesterséges intelligencia szerepe a szakképzésben" />
                </label>
                <label>Megadott adatok, tények, kötelező elemek
                  <textarea value={facts} onChange={(e) => setFacts(e.target.value)} placeholder={"Írd be pontokban vagy folyószövegben.\nAz AI ezeket használja, és nem talál ki hiányzó tényeket."} />
                </label>
              </>
            )}

            <div className="writer-fields">
              <label>Stílus
                <select value={tone} onChange={(e) => setTone(e.target.value)}>
                  {toneOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>Terjedelem
                <select value={length} onChange={(e) => setLength(e.target.value)}>
                  <option value="short">Rövidebb</option>
                  <option value="same">Hasonló hossz</option>
                  <option value="long">Részletesebb</option>
                  <option value="very-long">Kidolgozott</option>
                </select>
              </label>
              {mode === "transform" && <label>Átalakítás erőssége
                <select value={strength} onChange={(e) => setStrength(e.target.value)}>
                  <option value="light">Kíméletes</option>
                  <option value="medium">Közepes</option>
                  <option value="strong">Erősebb</option>
                </select>
              </label>}
            </div>

            <label>Célközönség
              <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Pl. középiskolai tanulók, egyetemi beadandó, szakmai közönség" />
            </label>
            <label>A szöveg célja
              <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Pl. magyarázat, tananyag, bevezetés, összefoglalás" />
            </label>
            <label>Plusz utasítás
              <textarea className="short-area" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Pl. legyen 5 bekezdés, tartsa meg a szakkifejezéseket, ne használjon felsorolást…" />
            </label>

            <label className="check-row">
              <input type="checkbox" checked={useStyle} disabled={!styleSample.trim()} onChange={(e) => setUseStyle(e.target.checked)} />
              <span><b>Saját stílusminta használata</b><small>{styleSample.trim() ? "Az AI figyelembe veszi a Beállításokban megadott saját mintát." : "Előbb adj meg saját mintát a Beállításokban."}</small></span>
            </label>

            <div className="writer-guard"><Check size={15}/><span>A rendszer nem talál ki forrásokat vagy tényeket. Hiányzó lényeges adatnál jelzi, hogy pontosítás kell.</span></div>

            <button className="primary writer-run" onClick={run} disabled={busy}>
              {busy ? <RefreshCw className="spin" size={17}/> : <Sparkles size={17}/>}
              {busy ? "Dolgozik…" : mode === "transform" ? "Új változat készítése" : "Szöveg megírása"}
            </button>
          </div>
        </div>

        <div className="panel writer-result">
          <div className="panel-head">
            <div><span className="step">AI</span><div><b>Új változat</b><small>Szerkeszthető eredmény, az eredeti nem íródik felül automatikusan.</small></div></div>
          </div>

          {!generated ? (
            <div className="empty writer-empty"><Sparkles size={40}/><b>Még nincs elkészült változat</b><span>Állítsd be a kérést, majd indítsd el az AI-írót.</span></div>
          ) : (
            <div className="writer-output">
              <textarea value={generated} onChange={(e) => setGenerated(e.target.value)} />
              <div className="writer-output-actions">
                <button className="secondary" onClick={copyResult}><Copy size={16}/> Másolás</button>
                <button className="secondary" onClick={appendDocument}><FilePlus2 size={16}/> Hozzáfűzés</button>
                <button className="primary" onClick={replaceDocument}><Check size={16}/> Ez legyen a dokumentum</button>
              </div>
              <button className="ghost regenerate" onClick={run} disabled={busy}>Másik változat készítése</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
