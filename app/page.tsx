"use client";

import { ChangeEvent, DragEvent, PointerEvent as ReactPointerEvent, useMemo, useRef, useState } from "react";

type Photo = { id:string; file:File; url:string; name:string; x:number; y:number; zoom:number; rotation:number };
type EditorDraft = Pick<Photo,"name"|"x"|"y"|"zoom"|"rotation">;
type View = "setup" | "results" | "caller";
type Output = "cards" | "leader" | "tickets";
type SavedPhoto = Omit<Photo,"file"|"url"> & { fileName:string; fileType:string; lastModified:number; dataUrl:string };
type SavedProject = { format:"fotobingo-project"; version:1; savedAt:string; settings:{title:string;gridSize:number;cardCount:number;captions:boolean;freeCenter:boolean;cardsPerPage:number}; photos:SavedPhoto[]; cards:string[][] };

const gridOptions = [3,4,5];

function Icon({name}:{name:"upload"|"folder"|"save"|"lock"|"trash"|"edit"|"spark"|"photo"|"print"|"back"|"play"|"close"|"rotate"|"reset"|"check"}) {
  const p:Record<string,React.ReactNode> = {
    upload:<><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></>,
    folder:<path d="M3.5 7.5h6l2-2h3a2 2 0 0 1 2 2h4v10a2 2 0 0 1-2 2h-15z"/>,
    save:<><path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></>,
    lock:<><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    trash:<><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5m4-5v5"/></>,
    edit:<><path d="M4 20h4l11-11-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></>,
    spark:<><path d="M12 3l1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3z"/><path d="M5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14z"/></>,
    photo:<><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5L5 20"/></>,
    print:<><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></>,
    back:<path d="M19 12H5m6-6l-6 6 6 6"/>, play:<path d="M8 5l11 7-11 7z"/>, close:<path d="M5 5l14 14M19 5L5 19"/>,
    rotate:<><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 1-2-5"/></>, reset:<><path d="M4 4v6h6"/><path d="M5.5 15a7 7 0 1 0 .5-7"/></>, check:<path d="M5 12l4 4L19 6"/>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{p[name]}</svg>;
}

function cleanName(filename:string){ return filename.replace(/\.[^/.]+$/,"").replace(/[-_]+/g," "); }
function shuffle<T>(values:T[]){ const a=[...values]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function photoId(file:File,index:number){ return `${file.name}-${file.lastModified}-${index}-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function hasEnoughCombinations(total:number,perCard:number,wanted:number){
  if(wanted<=1)return true;
  const steps=Math.min(perCard,total-perCard); let result=1;
  for(let i=1;i<=steps;i++){result=result*(total-steps+i)/i;if(result>=wanted)return true;}
  return result>=wanted;
}
function requiredPhotoCount(perCard:number,cardCount:number){
  let total=perCard;
  while(!hasEnoughCombinations(total,perCard,cardCount))total++;
  return total;
}
function imageStyle(photo:Photo|({url:string}&EditorDraft)){
  return {
    objectPosition:`${photo.x}% ${photo.y}%`,
    transform:`scale(${photo.zoom}) rotate(${photo.rotation}deg)`,
    transformOrigin:`${photo.x}% ${photo.y}%`,
  };
}
function fileAsDataUrl(file:File){
  return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==="string"?resolve(reader.result):reject(new Error("Foto kon niet worden gelezen"));reader.onerror=()=>reject(reader.error||new Error("Foto kon niet worden gelezen"));reader.readAsDataURL(file);});
}
function safeNumber(value:unknown,fallback:number,min:number,max:number){const number=Number(value);return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;}

function BingoCard({ids,photos,title,gridSize,captions,cardNumber,freeCenter}:{ids:string[];photos:Photo[];title:string;gridSize:number;captions:boolean;cardNumber:number;freeCenter:boolean}){
  let pointer=0;
  return <article className={`bingo-card grid-${gridSize}`}>
    <div className="card-heading"><div><span>FOTOBINGO</span><h2>{title || "Fotobingo"}</h2></div><b>Kaart {cardNumber}</b></div>
    <div className="bingo-grid" style={{
      gridTemplateColumns:`repeat(${gridSize}, minmax(0, 1fr))`,
      gridTemplateRows:`repeat(${gridSize}, minmax(0, 1fr))`,
    }}>
      {Array.from({length:gridSize*gridSize}).map((_,index)=>{
        const isCenter=freeCenter&&gridSize%2===1&&index===Math.floor(gridSize*gridSize/2);
        if(isCenter) return <div className="bingo-cell free-cell" key={`free-${index}`}><Icon name="spark"/><b>VRIJ</b></div>;
        const photoId=ids[pointer++];
        const photo=photos.find(p=>p.id===photoId);
        return <div className="bingo-cell" key={`${index}-${photo?.id}`}>{photo&&<><img src={photo.url} alt="" style={imageStyle(photo)}/>{captions&&<span>{photo.name}</span>}</>}</div>;
      })}
    </div>
    <div className="card-footer-mark"><span/><i/><span/></div>
  </article>;
}

export default function Home(){
  const [photos,setPhotos]=useState<Photo[]>([]); const [isDragging,setIsDragging]=useState(false);
  const [title,setTitle]=useState("Onze fotobingo"); const [gridSize,setGridSize]=useState(4); const [cardCount,setCardCount]=useState(24);
  const [captions,setCaptions]=useState(false); const [freeCenter,setFreeCenter]=useState(false); const [cardsPerPage,setCardsPerPage]=useState(2);
  const [editingId,setEditingId]=useState<string|null>(null); const [draft,setDraft]=useState<EditorDraft|null>(null);
  const [view,setView]=useState<View>("setup"); const [output,setOutput]=useState<Output>("cards"); const [cards,setCards]=useState<string[][]>([]);
  const [error,setError]=useState(""); const [drawOrder,setDrawOrder]=useState<string[]>([]); const [drawn,setDrawn]=useState<string[]>([]); const [isDrawing,setIsDrawing]=useState(false);
  const [projectBusy,setProjectBusy]=useState<"saving"|"opening"|null>(null); const [projectMessage,setProjectMessage]=useState("");
  const dragStart=useRef<{x:number;y:number;px:number;py:number}|null>(null);
  const drawTimer=useRef<number|null>(null);
  const projectMessageTimer=useRef<number|null>(null);
  const needed=gridSize*gridSize-(freeCenter&&gridSize%2===1?1:0); const requiredPhotos=requiredPhotoCount(needed,cardCount); const enough=photos.length>=requiredPhotos;
  const editingPhoto=photos.find(p=>p.id===editingId); const currentDraw=drawn.length?photos.find(p=>p.id===drawn[drawn.length-1]):null;
  const status=useMemo(()=>photos.length===0?"Nog geen foto’s gekozen":!enough?`Nog ${requiredPhotos-photos.length} foto${requiredPhotos-photos.length===1?"":"’s"} nodig`:`${photos.length} foto’s klaar voor gebruik`,[photos.length,enough,requiredPhotos]);

  function addFiles(files:FileList|File[]){
    const ok=/\.(jpe?g|png|webp|gif)$/i; const images=Array.from(files).filter(f=>f.type.startsWith("image/")||ok.test(f.name));
    if(!images.length){setError("In deze selectie zijn geen geschikte foto’s gevonden.");return;}
    setError(""); setPhotos(current=>{ const fingerprints=new Set(current.map(p=>`${p.file.name}-${p.file.size}-${p.file.lastModified}`));
      const fresh=images.filter(f=>!fingerprints.has(`${f.name}-${f.size}-${f.lastModified}`));
      return [...current,...fresh.map((file,index)=>({id:photoId(file,index),file,url:URL.createObjectURL(file),name:cleanName(file.name),x:50,y:50,zoom:1,rotation:0}))]; });
  }
  function handleInput(e:ChangeEvent<HTMLInputElement>){if(e.target.files)addFiles(e.target.files);e.target.value="";}
  function handleDrop(e:DragEvent<HTMLDivElement>){e.preventDefault();setIsDragging(false);addFiles(e.dataTransfer.files);}
  function removePhoto(id:string){setPhotos(current=>{const p=current.find(x=>x.id===id);if(p)URL.revokeObjectURL(p.url);return current.filter(x=>x.id!==id);});}
  function openEditor(photo:Photo){setEditingId(photo.id);setDraft({name:photo.name,x:photo.x,y:photo.y,zoom:photo.zoom,rotation:photo.rotation});}
  function saveEditor(){
    if(!editingId||!draft)return;
    setPhotos(current=>current.map(p=>p.id===editingId?{...p,...draft,name:draft.name.trim()||cleanName(p.file.name)}:p));
    setEditingId(null); setDraft(null);
    if(cards.length>0){setView("results");setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),0);}
  }
  function clearProjectMessage(){if(projectMessageTimer.current!==null){window.clearTimeout(projectMessageTimer.current);projectMessageTimer.current=null;}setProjectMessage("");}
  function showProjectMessage(message:string){clearProjectMessage();setProjectMessage(message);projectMessageTimer.current=window.setTimeout(()=>{setProjectMessage("");projectMessageTimer.current=null;},6000);}
  async function saveProject(){
    if(!photos.length||projectBusy)return;
    setProjectBusy("saving");clearProjectMessage();setError("");
    try{
      const savedPhotos:SavedPhoto[]=await Promise.all(photos.map(async p=>({id:p.id,name:p.name,x:p.x,y:p.y,zoom:p.zoom,rotation:p.rotation,fileName:p.file.name,fileType:p.file.type,lastModified:p.file.lastModified,dataUrl:await fileAsDataUrl(p.file)})));
      const project:SavedProject={format:"fotobingo-project",version:1,savedAt:new Date().toISOString(),settings:{title,gridSize,cardCount,captions,freeCenter,cardsPerPage},photos:savedPhotos,cards:view==="setup"?[]:cards};
      const blob=new Blob([JSON.stringify(project)],{type:"application/json"});const url=URL.createObjectURL(blob);const link=document.createElement("a");
      const safeTitle=(title.trim()||"fotobingo").replace(/[^a-z0-9à-ÿ]+/gi,"-").replace(/^-+|-+$/g,"").toLowerCase();
      link.href=url;link.download=`${safeTitle||"fotobingo"}.fotobingo`;document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      showProjectMessage("Project opgeslagen. Bewaar het .fotobingo-bestand op een plek die je terugvindt.");
    }catch{setError("Het project kon niet worden opgeslagen. Probeer het opnieuw met minder of kleinere foto’s.");}
    finally{setProjectBusy(null);}
  }
  async function openProject(e:ChangeEvent<HTMLInputElement>){
    const projectFile=e.target.files?.[0];e.target.value="";if(!projectFile||projectBusy)return;
    setProjectBusy("opening");clearProjectMessage();setError("");
    try{
      const data=JSON.parse(await projectFile.text()) as Partial<SavedProject>;
      if(data.format!=="fotobingo-project"||data.version!==1||!Array.isArray(data.photos)||!data.photos.length||!data.settings)throw new Error("Ongeldig project");
      const ids=new Set<string>();
      const restored:Photo[]=[];
      for(let index=0;index<data.photos.length;index++){
        const stored=data.photos[index];
        if(!stored||typeof stored.dataUrl!=="string"||!stored.dataUrl.startsWith("data:image/"))throw new Error("Ongeldige foto");
        const response=await fetch(stored.dataUrl);const blob=await response.blob();if(!blob.type.startsWith("image/"))throw new Error("Ongeldige foto");
        const fileName=typeof stored.fileName==="string"&&stored.fileName?stored.fileName:`foto-${index+1}`;const file=new File([blob],fileName,{type:stored.fileType||blob.type,lastModified:safeNumber(stored.lastModified,Date.now(),0,Date.now())});
        let id=typeof stored.id==="string"&&stored.id?stored.id:photoId(file,index);while(ids.has(id))id=photoId(file,index);ids.add(id);
        restored.push({id,file,url:URL.createObjectURL(file),name:typeof stored.name==="string"&&stored.name.trim()?stored.name.trim():cleanName(fileName),x:safeNumber(stored.x,50,0,100),y:safeNumber(stored.y,50,0,100),zoom:safeNumber(stored.zoom,1,1,3),rotation:safeNumber(stored.rotation,0,-3600,3600)});
      }
      const loadedGrid=gridOptions.includes(Number(data.settings.gridSize))?Number(data.settings.gridSize):4;const loadedCount=Math.round(safeNumber(data.settings.cardCount,24,1,100));const loadedFree=Boolean(data.settings.freeCenter)&&loadedGrid%2===1;
      const loadedCards=Array.isArray(data.cards)?data.cards.filter((card):card is string[]=>Array.isArray(card)&&card.length>0&&card.every(id=>typeof id==="string"&&ids.has(id))):[];
      photos.forEach(p=>URL.revokeObjectURL(p.url));setPhotos(restored);setTitle(typeof data.settings.title==="string"?data.settings.title:"Onze fotobingo");setGridSize(loadedGrid);setCardCount(loadedCount);setCaptions(Boolean(data.settings.captions));setFreeCenter(loadedFree);setCardsPerPage(Number(data.settings.cardsPerPage)===1?1:2);setCards(loadedCards);setOutput("cards");setDrawOrder([]);setDrawn([]);setEditingId(null);setDraft(null);setView(loadedCards.length?"results":"setup");
      showProjectMessage(`Project geopend: ${restored.length} foto${restored.length===1?"":"’s"}${loadedCards.length?` en ${loadedCards.length} bingokaarten`:""} zijn teruggezet.`);window.setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),0);
    }catch{setError("Dit projectbestand kon niet worden geopend. Kies een geldig .fotobingo-bestand.");setView("setup");}
    finally{setProjectBusy(null);}
  }
  function pointerDown(e:ReactPointerEvent<HTMLDivElement>){if(!draft)return;e.currentTarget.setPointerCapture(e.pointerId);dragStart.current={x:e.clientX,y:e.clientY,px:draft.x,py:draft.y};}
  function pointerMove(e:ReactPointerEvent<HTMLDivElement>){
    if(!dragStart.current||!draft)return;
    const box=e.currentTarget.getBoundingClientRect();
    setDraft({...draft,
      zoom:Math.max(1.08,draft.zoom),
      x:Math.max(0,Math.min(100,dragStart.current.px-(e.clientX-dragStart.current.x)/box.width*100)),
      y:Math.max(0,Math.min(100,dragStart.current.py-(e.clientY-dragStart.current.y)/box.height*100)),
    });
  }
  function generate(){
    if(!enough){setError(`Voor ${cardCount} kaarten van ${gridSize} × ${gridSize} met verschillende fotocombinaties heb je minimaal ${requiredPhotos} foto’s nodig.`);return;}
    const counts=new Map(photos.map(p=>[p.id,0])); const made:string[][]=[]; const signatures=new Set<string>(); const allIds=photos.map(p=>p.id);
    for(let c=0;c<cardCount;c++){
      let selected:string[]|null=null; let selectedSignature=""; let bestScore=Infinity;
      for(let attempt=0;attempt<1500;attempt++){
        const candidate=shuffle(allIds).slice(0,needed); const signature=[...candidate].sort().join("|");
        if(signatures.has(signature))continue;
        const score=candidate.reduce((sum,id)=>sum+(counts.get(id)||0),0)+Math.random()*.01;
        if(score<bestScore){selected=candidate;selectedSignature=signature;bestScore=score;}
      }
      if(!selected){setError("Het lukte niet om genoeg verschillende fotocombinaties te maken. Kies een extra foto of maak minder kaarten.");return;}
      selected.forEach(id=>counts.set(id,(counts.get(id)||0)+1)); signatures.add(selectedSignature); made.push(shuffle(selected));
    }
    setError("");setCards(made);setOutput("cards");setView("results");setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),0);
  }
  function stopDrawTimer(){if(drawTimer.current!==null){window.clearTimeout(drawTimer.current);drawTimer.current=null;}}
  function startCaller(){stopDrawTimer();setIsDrawing(false);setDrawOrder(shuffle(photos.map(p=>p.id)));setDrawn([]);setView("caller");}
  function nextDraw(){
    if(isDrawing||drawn.length>=drawOrder.length)return;
    const nextId=drawOrder[drawn.length];
    setIsDrawing(true);
    drawTimer.current=window.setTimeout(()=>{setDrawn(current=>[...current,nextId]);setIsDrawing(false);drawTimer.current=null;},700);
  }
  function resetCaller(){stopDrawTimer();setIsDrawing(false);setDrawOrder(shuffle(photos.map(p=>p.id)));setDrawn([]);}
  function leaveCaller(){stopDrawTimer();setIsDrawing(false);setView("results");}

  if(view==="caller") return <main className="caller-view">
    <header className="caller-top"><button onClick={leaveCaller}><Icon name="back"/> Terug naar kaarten</button><div className="caller-title"><span>Digitale trekking</span><b>{drawn.length===photos.length?"Alles is geweest":"Welke komt tevoorschijn?"}</b></div><span className="caller-count">{drawn.length} van {photos.length}</span></header>
    <div className="caller-layout">
      <section className="caller-stage" aria-live="polite">
        {isDrawing?<div className="draw-suspense"><div className="shuffle-cards" aria-hidden="true"><i/><i/><i/></div><h1>Even wachten…</h1><p>Welke foto zou het zijn?</p></div>:
        !currentDraw?<div className="caller-empty"><div className="caller-spark"><Icon name="spark"/></div><h1>Zijn jullie er klaar voor?</h1><p>Kijk goed naar het bord. Daar komt de eerste foto!</p><button className="caller-next" onClick={nextDraw}><Icon name="play"/> Trek een foto!</button></div>:
        <><div className="reveal-wrap" key={currentDraw.id}><div className="confetti-burst" aria-hidden="true">{Array.from({length:12}).map((_,index)=><i className={`confetti c${index+1}`} key={index}/>)}</div><div className="called-photo"><img src={currentDraw.url} alt={currentDraw.name} style={imageStyle(currentDraw)}/></div></div><h1>{drawn.length===photos.length?"Bingo! Alles is geweest!":captions?currentDraw.name:"Welke foto zie je?"}</h1><button className="caller-next" onClick={nextDraw} disabled={drawn.length===photos.length||isDrawing}>{drawn.length===photos.length?<><Icon name="check"/> Helemaal klaar!</>:<><Icon name="play"/> Volgende foto!</>}</button></>}
      </section>
      <aside className="drawn-board">
        <div className="drawn-board-head"><div><span>AL GEWEEST</span><h2>Deze hebben we al gezien</h2></div><b>{drawn.length}</b></div>
        {drawn.length===0?<div className="drawn-board-empty"><Icon name="photo"/><p>De getrokken foto’s verschijnen hier.</p></div>:<div className="all-drawn-grid">{drawn.map((id,index)=>{const p=photos.find(x=>x.id===id);return p?<div className={`drawn-thumb ${index===drawn.length-1?"current":""}`} key={id} title={p.name}><img src={p.url} alt={p.name} style={imageStyle(p)}/></div>:null;})}</div>}
      </aside>
    </div>
    <footer className="caller-bottom"><button onClick={resetCaller}><Icon name="reset"/> Opnieuw beginnen</button><div className="progress-track" aria-label={`${drawn.length} van de ${photos.length} foto’s getrokken`}><span style={{width:`${photos.length?drawn.length/photos.length*100:0}%`}}/></div><strong>{drawn.length} / {photos.length}</strong></footer>
  </main>;

  if(view==="results") return <main className={`results-view output-${output}`}>
    <header className="results-top no-print"><button className="back-button" onClick={()=>setView("setup")}><Icon name="back"/> Foto’s of instellingen aanpassen</button><div className="brand"><span className="brand-mark"><span/><span/><span/><span/></span><span>Fotobingo <b>Maker</b></span></div><div className="results-actions"><button className="secondary-button" onClick={saveProject} disabled={projectBusy!==null}><Icon name="save"/> {projectBusy==="saving"?"Bezig…":"Project opslaan"}</button><button className="secondary-button" onClick={startCaller}><Icon name="play"/> Digitale trekking</button><button className="primary-button" onClick={()=>window.print()}><Icon name="print"/> Printen of opslaan als pdf</button></div></header>
    {projectMessage&&<div className="project-toast no-print" role="status"><Icon name="check"/><span>{projectMessage}</span></div>}
    {error&&<div className="project-toast project-toast-error no-print" role="alert"><Icon name="close"/><span>{error}</span></div>}
    <div className="results-shell">
      <div className="results-title no-print"><div><span className="eyebrow"><Icon name="check"/> Kaarten zijn klaar</span><h1>{cards.length} unieke bingokaarten</h1><p>Bekijk de kaarten en kies wat je wilt printen.</p></div></div>
      <nav className="output-tabs no-print"><button className={output==="cards"?"active":""} onClick={()=>setOutput("cards")}>Bingokaarten <span>{cards.length}</span></button><button className={output==="leader"?"active":""} onClick={()=>setOutput("leader")}>Spelleidersblad</button><button className={output==="tickets"?"active":""} onClick={()=>setOutput("tickets")}>Trekkaartjes</button></nav>
      <section className={`cards-output print-area cards-per-page-${cardsPerPage}`}>{cards.map((ids,index)=><BingoCard key={index} ids={ids} photos={photos} title={title} gridSize={gridSize} captions={captions} cardNumber={index+1} freeCenter={freeCenter}/>)}</section>
      <section className="leader-output print-area"><article className="leader-sheet"><div className="sheet-heading"><span>SPELLEIDERSBLAD</span><h1>{title||"Fotobingo"}</h1><p>Streep een foto af zodra deze is getrokken.</p></div><div className="leader-grid">{photos.map(p=><div className="leader-item" key={p.id}><div><img src={p.url} alt="" style={imageStyle(p)}/><i/></div><span>{p.name}</span></div>)}</div></article></section>
      <section className="tickets-output print-area"><article className="tickets-sheet"><div className="sheet-heading"><span>UITKNIPPEN &amp; TREKKEN</span><h1>Trekkaartjes</h1><p>Knip de kaartjes uit, vouw ze dubbel en stop ze in een bak.</p></div><div className="ticket-grid">{photos.map(p=><div className="ticket" key={p.id}><div><img src={p.url} alt="" style={imageStyle(p)}/></div>{captions&&<span>{p.name}</span>}</div>)}</div></article></section>
    </div>
  </main>;

  return <main>
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark"><span/><span/><span/><span/></span><span>Fotobingo <b>Maker</b></span></a><span className="privacy-pill"><Icon name="lock"/><em>Foto’s blijven op dit apparaat</em></span></header>
    {projectMessage&&<div className="project-toast" role="status"><Icon name="check"/><span>{projectMessage}</span></div>}
    <div className="page-shell" id="top">
      <section className="intro"><div><span className="eyebrow"><Icon name="spark"/> Klaar voor de klas</span><h1>Van je eigen foto’s<br/>naar een vrolijke bingo.</h1><p>Kies je afbeeldingen, zet ze goed in beeld en maak in één keer unieke, printklare bingokaarten.</p></div><div className="mini-cards" aria-hidden="true"><div className="mini-card card-one">{Array.from({length:9}).map((_,i)=><i key={i}/>)}</div><div className="mini-card card-two">{Array.from({length:9}).map((_,i)=><i key={i}/>)}</div></div></section>
      <section className="workspace"><div className="panel photos-panel"><div className="panel-heading"><span className="step-number">1</span><div><h2>Kies je foto’s</h2><p>JPG, PNG, WEBP of GIF</p></div><span className={`photo-count ${enough?"ready":""}`}>{status}</span></div>
        <div className={`dropzone ${isDragging?"dragging":""}`} onDragEnter={e=>{e.preventDefault();setIsDragging(true)}} onDragOver={e=>e.preventDefault()} onDragLeave={()=>setIsDragging(false)} onDrop={handleDrop}><div className="upload-icon"><Icon name="upload"/></div><h3>Sleep je foto’s hierheen</h3><p>of kies ze op je computer</p><div className="upload-actions"><label className="primary-button chooser-label"><Icon name="photo"/> Kies foto’s<input type="file" aria-label="Kies foto’s" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleInput}/></label><label className="secondary-button chooser-label"><Icon name="folder"/> Kies een map<input type="file" aria-label="Kies een map" accept="image/*" multiple onChange={handleInput} {...({webkitdirectory:"",directory:""} as React.InputHTMLAttributes<HTMLInputElement>)}/></label></div></div>
        <div className="project-tools"><div className="project-tools-copy"><span><Icon name="save"/></span><div><b>Later verdergaan?</b><small>Bewaar de foto’s, bewerkingen, instellingen en gemaakte kaarten samen.</small></div></div><div className="project-tools-actions"><label className="secondary-button chooser-label"><Icon name="folder"/> {projectBusy==="opening"?"Project openen…":"Project openen"}<input type="file" aria-label="Bewaard fotobingoproject openen" accept=".fotobingo,application/json" onChange={openProject} disabled={projectBusy!==null}/></label><button className="secondary-button" onClick={saveProject} disabled={!photos.length||projectBusy!==null}><Icon name="save"/> {projectBusy==="saving"?"Opslaan…":"Project opslaan"}</button></div></div>
        {photos.length>0&&<div className="photo-section"><div className="photo-section-title"><h3>Gekozen foto’s</h3><span>Klik op een foto om hem aan te passen</span></div><div className="photo-grid">{photos.map(p=><article className="photo-tile" key={p.id}><button className="photo-frame" onClick={()=>openEditor(p)}><img src={p.url} alt={p.name} style={imageStyle(p)}/><span className="edit-photo"><Icon name="edit"/></span></button><button className="delete-photo" onClick={()=>removePhoto(p.id)} aria-label={`${p.name} verwijderen`}><Icon name="trash"/></button><span title={p.name}>{p.name}</span></article>)}</div></div>}
      </div>
      <aside className="panel settings-panel"><div className="panel-heading compact"><span className="step-number coral">2</span><div><h2>Stel je bingo in</h2><p>Pas de kaart aan</p></div></div><label className="field-label">Titel op de kaart<input value={title} maxLength={55} onChange={e=>setTitle(e.target.value)}/></label><fieldset><legend>Formaat</legend><div className="segmented">{gridOptions.map(size=><button type="button" key={size} className={gridSize===size?"active":""} onClick={()=>{setGridSize(size);if(size%2===0)setFreeCenter(false)}}>{size} × {size}</button>)}</div></fieldset>
        <label className="field-label count-label">Aantal kaarten<div className="number-input"><button onClick={()=>setCardCount(Math.max(1,cardCount-1))}>−</button><input type="number" min="1" max="100" value={cardCount} onChange={e=>setCardCount(Math.max(1,Math.min(100,Number(e.target.value)||1)))}/><button onClick={()=>setCardCount(Math.min(100,cardCount+1))}>+</button></div></label>
        <div className="toggle-list"><label><span><b>Namen onder foto’s</b><small>Je kunt iedere naam aanpassen</small></span><input type="checkbox" checked={captions} onChange={e=>setCaptions(e.target.checked)}/><i/></label><label><span><b>Vrij middenvak</b><small>Beschikbaar bij 3 × 3 en 5 × 5</small></span><input type="checkbox" checked={freeCenter} disabled={gridSize%2===0} onChange={e=>setFreeCenter(e.target.checked)}/><i/></label></div>
        <fieldset><legend>Kaarten per A4</legend><div className="segmented two">{[1,2].map(n=><button type="button" key={n} className={cardsPerPage===n?"active":""} onClick={()=>setCardsPerPage(n)}>{n} {n===1?"kaart":"kaarten"}</button>)}</div></fieldset>
        <div className={`need-box ${enough?"success":""}`}><span>{requiredPhotos}</span><p><b>{enough?"Genoeg voor unieke combinaties":`${requiredPhotos} foto’s nodig`}</b><small>voor {cardCount} verschillende {gridSize} × {gridSize}-kaarten{freeCenter?" met vrij middenvak":""}</small></p></div>{error&&<div className="error-box" role="alert">{error}</div>}<button className="make-button" disabled={!enough} onClick={generate}><Icon name="spark"/> Maak {cardCount} bingokaarten</button>
      </aside></section><footer><Icon name="lock"/><span>Je foto’s verlaten je computer niet. Bewaar een projectbestand als je later verder wilt gaan.</span></footer>
    </div>
    {editingPhoto&&draft&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget){setEditingId(null);setDraft(null)}}}><section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title"><div className="modal-heading"><div><span>Foto aanpassen</span><h2 id="editor-title">{draft.name}</h2></div><button onClick={()=>{setEditingId(null);setDraft(null)}} aria-label="Sluiten"><Icon name="close"/></button></div><div className="editor-body"><div className="crop-preview" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={()=>dragStart.current=null}><img src={editingPhoto.url} alt="" style={imageStyle({url:editingPhoto.url,...draft})}/><span>Sleep om de foto te verschuiven</span></div><div className="editor-controls"><label>Naam onder de foto<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label className="range-label"><span>In- of uitzoomen <b>{Math.round(draft.zoom*100)}%</b></span><input type="range" min="1" max="3" step=".05" value={draft.zoom} onChange={e=>setDraft({...draft,zoom:Number(e.target.value)})}/></label><div className="position-sliders"><label><span>Links ↔ rechts</span><input type="range" min="0" max="100" value={draft.x} onChange={e=>setDraft({...draft,x:Number(e.target.value)})}/></label><label><span>Boven ↕ onder</span><input type="range" min="0" max="100" value={draft.y} onChange={e=>setDraft({...draft,y:Number(e.target.value)})}/></label></div><button className="rotate-button" onClick={()=>setDraft({...draft,rotation:(draft.rotation+90)%360})}><Icon name="rotate"/> 90° draaien</button><button className="reset-photo" onClick={()=>setDraft({...draft,x:50,y:50,zoom:1,rotation:0})}><Icon name="reset"/> Beeld herstellen</button></div></div><div className="modal-actions"><button className="secondary-button" onClick={()=>{setEditingId(null);setDraft(null)}}>Annuleren</button><button className="primary-button" onClick={saveEditor}><Icon name="check"/> {cards.length>0?"Opslaan en terug naar kaarten":"Opslaan"}</button></div></section></div>}
  </main>;
}
