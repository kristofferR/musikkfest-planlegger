// Concatenated by scripts/build.mjs. Keep files ordered by numeric prefix.
// ── CHIPS (active filter summary bar) ──
function createFilterChip(className,label,ariaLabel,onClick){
  const chip=document.createElement("button");
  chip.type="button";
  chip.className=`chip ${className}`.trim();
  const text=document.createElement("span");
  text.textContent=label;
  const close=document.createElement("span");
  close.className="chip-x";
  close.textContent="×";
  close.setAttribute("aria-hidden","true");
  chip.appendChild(text);
  chip.appendChild(close);
  chip.setAttribute("aria-label",ariaLabel);
  chip.onclick=onClick;
  return chip;
}

function renderChips(){
  const chips=document.getElementById("activeChips");
  chips.innerHTML="";
  if(activeView==="map"||activeView==="favorites"){
    chips.classList.remove("visible");
    document.body.classList.remove("chips-visible");
    filterBtn.classList.remove("has-active");
    return;
  }
  let any=false;

  if(activeFavoritesOnly){
    const label=`★ ${currentFavoriteSource()==="shared"?"Mottatt liste":"Mine favoritter"}`;
    const c=createFilterChip("favorite-chip",label,"Fjern favorittfilter",()=>{activeFavoritesOnly=false;render();});
    chips.appendChild(c); any=true;
  }

  if(activeGenresExplicit){
    if(activeGenres.size===0){
      const c=createFilterChip("genre-chip","Ingen sjangre","Nullstill sjangerfilter",()=>{setAllGenres(true);render();});
      chips.appendChild(c); any=true;
    }else{
      activeGenres.forEach(g=>{
        const label=GENRE_LABELS[g]||g;
        const c=createFilterChip("genre-chip",label,`Fjern sjangerfilter: ${label}`,()=>{activeGenres.delete(g);render();});
        chips.appendChild(c); any=true;
      });
    }
  }
  if(activeStagesExplicit){
    if(activeStages.size===0){
      const c=createFilterChip("stage-chip","Ingen scener","Nullstill scenefilter",()=>{setAllStages(true);render();});
      chips.appendChild(c); any=true;
    }else{
      activeStages.forEach(s=>{
        const c=createFilterChip("stage-chip",s,`Fjern scenefilter: ${s}`,()=>{activeStages.delete(s);render();});
        chips.appendChild(c); any=true;
      });
    }
  }
  if(timeFrom||timeTo){
    const label=(timeFrom&&timeTo)?`${timeFrom}–${timeTo}`:timeFrom?`Fra ${timeFrom}`:`Til ${timeTo}`;
    const c=createFilterChip("time-chip",`🕐 ${label}`,"Nullstill tidsfilter",()=>{
      timeFrom="";timeTo="";
      document.getElementById("timeFrom").value="";
      document.getElementById("timeTo").value="";
      updateTimeReset();render();
    });
    chips.appendChild(c); any=true;
  }
  if(searchQuery){
    const c=createFilterChip("","Søk: "+searchQuery,`Fjern søk: ${searchQuery}`,()=>{
      searchQuery="";
      document.getElementById("searchInput").value="";
      render();
    });
    chips.appendChild(c); any=true;
  }

  chips.classList.toggle("visible",any);
  document.body.classList.toggle("chips-visible",any);

  filterBtn.classList.toggle("has-active",hasActiveFilters());
}

let shareToastTimer=null;
function showCopyToast(message){
  const toast=document.getElementById("appToast");
  const text=document.getElementById("appToastText");
  if(!toast||!text) return;
  text.textContent=message;
  toast.classList.add("visible");
  clearTimeout(shareToastTimer);
  shareToastTimer=setTimeout(()=>toast.classList.remove("visible"),2600);
}

function setShareStatus(message){
  const status=document.getElementById("favoriteShareStatus");
  if(status) status.textContent=message;
  if(/\bkopiert\b/i.test(message)) showCopyToast(message);
}

async function copyText(value){
  if(navigator.clipboard?.writeText){
    try{
      await navigator.clipboard.writeText(value);
      return;
    }catch(err){}
  }
  const textarea=document.createElement("textarea");
  textarea.value=value;
  textarea.style.position="fixed";
  textarea.style.left="-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function isMobileShareDevice(){
  const ua=navigator.userAgent||"";
  return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1);
}

function openMobileAppUrl(appUrl,fallbackUrl=""){
  if(!appUrl) return false;
  const started=Date.now();
  window.location.href=appUrl;
  if(fallbackUrl){
    window.setTimeout(()=>{
      if(document.visibilityState==="visible"&&Date.now()-started<2200){
        window.location.href=fallbackUrl;
      }
    },950);
  }
  return true;
}
