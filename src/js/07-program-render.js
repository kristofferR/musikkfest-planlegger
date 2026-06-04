// Concatenated by scripts/build.mjs. Keep files ordered by numeric prefix.
// ── CONTENT ──
function createProgramEventRow(ev,{showTime=true,showStage=false}={}){
  const row=document.createElement("div");
  row.className=`event-row ${showStage?"time-event-row":""}`.trim();
  row.tabIndex=0;
  row.setAttribute("role","button");
  row.setAttribute("aria-label",`Vis detaljer: ${ev.artist}`);

  if(showTime){
    const time=document.createElement("span");
    time.className="etime";
    time.textContent=ev.time;
    row.appendChild(time);
  }

  const badge=document.createElement("span");
  badge.className=`gbadge g-${ev.genre}`;
  badge.textContent=GENRE_LABELS[ev.genre]||ev.genre;
  row.appendChild(badge);

  if(showStage){
    const main=document.createElement("span");
    main.className="event-main";
    const artist=document.createElement("span");
    artist.className="event-artist";
    artist.textContent=ev.artist;
    const stage=document.createElement("span");
    stage.className="event-stage";
    stage.textContent=ev.stage;
    main.appendChild(artist);
    main.appendChild(stage);
    row.appendChild(main);
  }else{
    const artist=document.createElement("span");
    artist.className="aname";
    artist.textContent=ev.artist;
    row.appendChild(artist);
  }

  row.addEventListener("click",()=>openEventDetails(ev));
  row.addEventListener("keydown",e=>{
    if(e.target!==row) return;
    handleKeyboardOpen(e,()=>openEventDetails(ev));
  });

  const fav=document.createElement("button");
  fav.className=`fav-btn ${isFavorite(ev)?"active":""}`.trim();
  fav.type="button";
  fav.textContent=isFavorite(ev)?"★":"☆";
  fav.setAttribute("aria-label",`${isFavorite(ev)?"Fjern favoritt":"Legg til favoritt"}: ${ev.artist}`);
  fav.addEventListener("click",e=>{
    e.stopPropagation();
    toggleFavorite(ev);
  });
  row.appendChild(fav);
  return row;
}

function sortedProgramEvents(events){
  return events.sort((a,b)=>toMin(a.time)-toMin(b.time)||a.stage.localeCompare(b.stage,"nb")||a.artist.localeCompare(b.artist,"nb"));
}

function programClockTimeLabel(clock){
  const min=((clock.min%1440)+1440)%1440;
  const h=Math.floor(min/60);
  const m=min%60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function programNowLineY(cards,clockMin){
  if(!cards.length) return null;
  const first=cards[0];
  const last=cards[cards.length-1];
  if(clockMin<=first.min) return first.el.offsetTop;

  for(let i=0;i<cards.length-1;i+=1){
    const current=cards[i];
    const next=cards[i+1];
    if(clockMin>=current.min&&clockMin<next.min){
      const span=Math.max(1,next.min-current.min);
      const ratio=(clockMin-current.min)/span;
      return current.el.offsetTop+(next.el.offsetTop-current.el.offsetTop)*ratio;
    }
  }

  const endMin=last.min+SET_DURATION_MIN;
  const ratio=Math.max(0,Math.min(1,(clockMin-last.min)/Math.max(1,endMin-last.min)));
  return last.el.offsetTop+last.el.offsetHeight*ratio;
}

function ensureProgramNowLine(timeline){
  let line=document.getElementById("programNowLine");
  if(line&&line.parentElement!==timeline) line.remove();
  if(!line){
    line=document.createElement("div");
    line.className="program-now-line";
    line.id="programNowLine";
    line.setAttribute("aria-hidden","true");
    line.innerHTML='<span class="program-now-rule"></span><span class="program-now-time"></span>';
    timeline.appendChild(line);
  }
  return line;
}

function updateProgramNowLine({scroll=false,clock=festivalClock()}={}){
  const timeline=document.getElementById("programTimeline");
  const existing=document.getElementById("programNowLine");
  if(!timeline||programViewMode!=="time"||activeView!=="program"||clock.mode!=="live"){
    existing?.remove();
    return;
  }

  const cards=Array.from(timeline.querySelectorAll(".time-card"))
    .map(el=>({el,min:Number(el.dataset.min)}))
    .filter(item=>Number.isFinite(item.min))
    .sort((a,b)=>a.min-b.min);
  const y=programNowLineY(cards,clock.min);
  if(y===null){
    existing?.remove();
    return;
  }

  const line=ensureProgramNowLine(timeline);
  const label=line.querySelector(".program-now-time");
  if(label) label.textContent=programClockTimeLabel(clock);
  line.style.top=`${Math.round(y)}px`;
  if(scroll){
    line.scrollIntoView({
      block:"center",
      behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"
    });
  }
}

function renderProgramByStage(mc){
  const displayStages=activeStagesExplicit?allStages.filter(s=>activeStages.has(s)):allStages;
  let total=0;

  displayStages.forEach(stage=>{
    const visible=data.filter(d=>d.stage===stage&&matches(d))
      .sort((a,b)=>a.time.localeCompare(b.time)||a.artist.localeCompare(b.artist,"nb"));
    if(!visible.length) return;
    total+=visible.length;

    const card=document.createElement("div");
    card.className="stage-card";
    const loc=STAGE_LOCATIONS[stage];

    const hdr=document.createElement("div");
    hdr.className="stage-card-header";
    const mapBtn=loc?'<button class="stage-map-toggle" type="button" aria-expanded="false">Kart</button>':"";
    hdr.innerHTML=`<span class="stage-name-label">${escapeHtml(stage)}</span><span class="stage-header-actions">${mapBtn}<span class="stage-count">${visible.length} stk <span class="chevron">▾</span></span></span>`;
    hdr.addEventListener("click",e=>{
      if(e.target.closest?.(".stage-map-toggle")) return;
      const willCollapse=!card.classList.contains("collapsed");
      card.classList.toggle("collapsed");
      if(willCollapse&&card.classList.contains("map-open")){
        card.classList.remove("map-open");
        const button=hdr.querySelector(".stage-map-toggle");
        button.textContent="Kart";
        button.setAttribute("aria-expanded","false");
      }
    });

    let mapPanel=null;
    if(loc){
      mapPanel=createStageMapPanel(loc);
      hdr.querySelector(".stage-map-toggle").addEventListener("click",e=>{
        e.stopPropagation();
        toggleStageMap(card,mapPanel,e.currentTarget);
      });
    }

    const list=document.createElement("div");
    list.className="event-list";
    visible.forEach(ev=>list.appendChild(createProgramEventRow(ev,{showTime:true,showStage:false})));

    card.appendChild(hdr);
    if(mapPanel) card.appendChild(mapPanel);
    card.appendChild(list);
    mc.appendChild(card);
  });

  return total;
}

function renderProgramByTime(mc){
  const visible=sortedProgramEvents(data.filter(ev=>matches(ev)));
  const byTime=new Map();
  const timeline=document.createElement("div");
  timeline.className="program-timeline";
  timeline.id="programTimeline";
  visible.forEach(ev=>{
    if(!byTime.has(ev.time)) byTime.set(ev.time,[]);
    byTime.get(ev.time).push(ev);
  });

  byTime.forEach((events,time)=>{
    const card=document.createElement("div");
    card.className="time-card";
    card.dataset.min=String(toMin(time));
    const header=document.createElement("div");
    header.className="time-card-header";
    header.innerHTML=`<span class="time-label">${escapeHtml(time)}</span><span class="time-count">${events.length} stk</span>`;
    const list=document.createElement("div");
    list.className="event-list";
    events.forEach(ev=>list.appendChild(createProgramEventRow(ev,{showTime:false,showStage:true})));
    card.appendChild(header);
    card.appendChild(list);
    timeline.appendChild(card);
  });

  mc.appendChild(timeline);
  requestAnimationFrame(()=>updateProgramNowLine());
  return visible.length;
}

function renderContent(){
  const mc=document.getElementById("mainContent");
  mc.innerHTML="";
  syncProgramModeButtons();

  const total=programViewMode==="time"
    ? renderProgramByTime(mc)
    : renderProgramByStage(mc);

  document.getElementById("resultsInfo").textContent=total
    ? programViewMode==="time"?`${total} opptredener kronologisk`:`${total} opptredener`
    : "";
  if(!total) mc.innerHTML=`<div class="empty">${activeFavoritesOnly?"Ingen favoritter matcher filteret.":"Ingen artister matcher filteret."}</div>`;

  // Legend
  const leg=document.getElementById("legend");
  const seen=new Set(data.filter(matches).map(d=>d.genre));
  leg.innerHTML="";
  Object.keys(GENRE_LABELS).filter(g=>seen.has(g)).forEach(g=>{
    const i=document.createElement("div");i.className="leg-item";
    const dot=document.createElement("div");dot.className=`leg-dot g-${g}`;
    i.appendChild(dot);i.appendChild(document.createTextNode(GENRE_LABELS[g]));
    leg.appendChild(i);
  });
}

function render(){
  syncDrawerPills();
  syncFavoriteFilterButtons();
  syncMapFilterBar();
  renderChips();
  renderContent();
  if(activeView==="map") renderMapView();
  if(activeView==="favorites") renderFavoritesView();
}

applySharedFavoritesFromUrl();
render();
applyRouteFromLocation();
setInterval(()=>{
  if(activeView==="map") renderMapView();
  if(activeView==="program"&&programViewMode==="time") updateProgramNowLine();
},60000);
