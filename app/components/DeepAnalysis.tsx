"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, CheckCircle2, RefreshCw } from "lucide-react";

type Finding={quote:string;category:string;severity:string;reason:string;suggestion:string;chunk:number};
type Props={text:string;title:string;onToast:(s:string)=>void};

export default function DeepAnalysis({text,title,onToast}:Props){
  const [busy,setBusy]=useState(false);
  const [data,setData]=useState<{findings:Finding[];counts:Record<string,number>;chunks:number}|null>(null);
  const [filter,setFilter]=useState("mind");

  async function run(){
    if(!text.trim()){onToast("Nincs elemezhető szöveg");return;}
    setBusy(true);
    try{
      const r=await fetch("/api/deep-analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,title})});
      const j=await r.json();
      if(!r.ok) throw new Error(j?.error||"A mélyelemzés nem sikerült.");
      setData(j);
    }catch(e){onToast(e instanceof Error?e.message:"A mélyelemzés nem sikerült");}
    finally{setBusy(false);}
  }

  const shown=useMemo(()=>data?.findings.filter(f=>filter==="mind"||f.category===filter)||[],[data,filter]);
  const categories=data?Object.keys(data.counts):[];

  return <section className="deep-wrap">
    <div className="deep-hero panel">
      <div>
        <span className="eyebrow">GEMINI MÉLYELEMZÉS</span>
        <h2>Valódi szövegértés, nem csak gyors mintaszámítás.</h2>
        <p>A hosszú dokumentumot részekre bontva elemzi nyelv, stílus, ismétlés, logika, terminológia és forrásigény szempontjából.</p>
      </div>
      <button className="primary deep-run" disabled={busy||!text.trim()} onClick={run}>
        {busy?<RefreshCw className="spin" size={18}/>:<BrainCircuit size={18}/>}
        {busy?"Mélyelemzés folyamatban…":"Gemini mélyelemzés indítása"}
      </button>
    </div>

    {!data?<div className="panel deep-empty"><BrainCircuit size={44}/><b>Még nincs mélyelemzés</b><span>A gyors elemzés marad külön; ez a mód ténylegesen AI-modellel olvassa végig a dokumentumot.</span></div>:
    <>
      <div className="deep-stats">
        <div className="panel"><span>Vizsgált részek</span><b>{data.chunks}</b></div>
        <div className="panel"><span>Találatok</span><b>{data.findings.length}</b></div>
        <div className="panel"><span>Magas súlyú</span><b>{data.findings.filter(f=>f.severity==="magas").length}</b></div>
      </div>
      <div className="deep-filters">
        <button className={filter==="mind"?"active":""} onClick={()=>setFilter("mind")}>Mind</button>
        {categories.map(c=><button key={c} className={filter===c?"active":""} onClick={()=>setFilter(c)}>{c} <span>{data.counts[c]}</span></button>)}
      </div>
      <div className="deep-list">
        {shown.map((f,i)=><article className={"panel deep-item "+f.severity} key={i}>
          <div className="deep-item-head">
            <span className="deep-cat">{f.category}</span>
            <span>Rész {f.chunk}</span>
            <b>{f.severity}</b>
          </div>
          {f.quote&&<blockquote>„{f.quote}”</blockquote>}
          <div className="deep-reason"><AlertTriangle size={16}/><p>{f.reason}</p></div>
          <div className="deep-suggestion"><CheckCircle2 size={16}/><p>{f.suggestion}</p></div>
        </article>)}
      </div>
    </>}
  </section>
}
