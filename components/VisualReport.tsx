"use client";

import { useMemo, useState } from "react";

export type ReportSection = {
  id: string;
  title: string;
  paragraphScores: number[];
  reasons?: string[];
};

type Props = {
  sections: ReportSection[];
  onSelect?: (sectionId: string, paragraphIndex: number) => void;
};

const color = (n: number) => n >= 70 ? "#ef4444" : n >= 40 ? "#f59e0b" : "#22c55e";
const clamp = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

export default function VisualReport({ sections, onSelect }: Props) {
  const [view, setView] = useState<"heatmap" | "bars" | "surface">("heatmap");
  const [selection, setSelection] = useState<{ id: string; index: number } | null>(null);
  const [tilt, setTilt] = useState(42);
  const normalized = useMemo(() => sections.map(s => ({
    ...s,
    paragraphScores: s.paragraphScores.map(clamp),
    average: s.paragraphScores.length ? Math.round(s.paragraphScores.reduce((a, b) => a + clamp(b), 0) / s.paragraphScores.length) : 0
  })), [sections]);
  const choose = (id: string, index: number) => { setSelection({ id, index }); onSelect?.(id, index); };
  const current = normalized.find(s => s.id === selection?.id);
  const selectedScore = selection && current ? current.paragraphScores[selection.index] : null;
  return (
    <section aria-label="Dokumentum vizuális mintázatelemzése" style={{ background:"#111827", border:"1px solid #2a3445", borderRadius:20, padding:20, color:"#e5efff" }}>
      <h2 style={{margin:"0 0 6px"}}>Dokumentumtérkép</h2>
      <p style={{color:"#94a3b8",fontSize:13}}>A színek a szövegmintázatok eltérését jelzik, nem a bizonyított AI-használat arányát.</p>
      <div role="group" aria-label="Megjelenítés" style={{display:"flex",gap:8,flexWrap:"wrap",margin:"16px 0"}}>
        {([["heatmap","Hőtérkép"],["bars","Diagram"],["surface","3D felszín"]] as const).map(([id,label])=>
          <button key={id} type="button" aria-pressed={view===id} onClick={()=>setView(id)}
            style={{padding:"10px 14px",borderRadius:10,border:"1px solid #3b82f6",background:view===id?"#2563eb":"#172033",color:"white"}}>{label}</button>)}
      </div>
      {view==="surface" && <label style={{display:"flex",gap:12,alignItems:"center",marginBottom:18,fontSize:13}}>
        3D dőlésszög <input aria-label="3D dőlésszög" type="range" min="15" max="65" value={tilt} onChange={e=>setTilt(Number(e.target.value))}/>{tilt}°
      </label>}
      <div style={{overflowX:"auto",padding:view==="surface"?"30px 20px 60px":0}}>
        <div style={{minWidth:360,transform:view==="surface"?`perspective(900px) rotateX(${tilt}deg)`:"none",transformOrigin:"center center",transition:"transform .3s"}}>
          {normalized.map(section=><div key={section.id} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,fontSize:13,marginBottom:6}}>
              <strong>{section.title}</strong><span>{section.average}/100 · átlagos mintázati jelzés</span>
            </div>
            <div style={{display:"flex",gap:4,minHeight:view==="bars"?48:32,alignItems:"end"}}>
              {section.paragraphScores.map((score,i)=><button key={i} type="button" onClick={()=>choose(section.id,i)}
                title={`${section.title}, ${i+1}. bekezdés: ${score}/100`}
                aria-label={`${section.title}, ${i+1}. bekezdés, mintázati pontszám ${score} a 100-ból`}
                style={{flex:"1 0 14px",minWidth:14,height:view==="bars"||view==="surface"?`${Math.max(8,score)}px`:"32px",
                  background:color(score),border:selection?.id===section.id&&selection.index===i?"2px solid white":"1px solid #263244",
                  borderRadius:4,cursor:"pointer",boxShadow:view==="surface"?"3px 6px 0 #0b1220":"none",transition:"height .25s"}}/>)}
            </div>
          </div>)}
        </div>
      </div>
      {selectedScore!==null && current && <div role="status" style={{background:"#172033",borderRadius:12,padding:14,marginTop:12}}>
        <strong>{current.title} · {selection!.index+1}. bekezdés</strong>
        <p style={{margin:"8px 0",color:color(selectedScore)}}>Mintázati jelzés: {selectedScore}/100</p>
        <p style={{margin:0,fontSize:12,color:"#aabbd0"}}>{current.reasons?.join(" · ") || "A konkrét okokért nyisd meg a bekezdés szöveges elemzését."}</p>
      </div>}
      <p style={{fontSize:12,color:"#94a3b8",marginBottom:0}}>A pontszám nem AI-szerzőségi valószínűség és nem használható önmagában szankcióhoz. A 3D nézet ugyanazokat az adatokat ábrázolja, mint a hőtérkép.</p>
    </section>
  );
}
