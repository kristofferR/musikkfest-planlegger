// Concatenated by scripts/build.mjs. Keep files ordered by numeric prefix.
// ── DRAWER ──
const overlay = document.getElementById("drawerOverlay");
const filterBtn = document.getElementById("filterBtn");
const infoModal = document.getElementById("infoModal");
const infoToggle = document.getElementById("infoToggle");
const infoModalClose = document.getElementById("infoModalClose");
const themeToggle = document.getElementById("themeToggle");
const textSizeToggle = document.getElementById("textSizeToggle");
themeToggle.addEventListener("click",()=>setTheme(currentTheme()==="dark"?"light":"dark"));
textSizeToggle.addEventListener("click",()=>{
  setTextSizeLarge(!textSizeLarge());
  syncPopupDescriptionScroll();
  syncEventModalDescriptionScroll();
});
updateThemeToggle();
updateTextSizeToggle();
filterBtn.addEventListener("click",()=>overlay.classList.add("open"));
document.getElementById("drawerClose").addEventListener("click",()=>overlay.classList.remove("open"));
overlay.addEventListener("click",e=>{ if(e.target===overlay) overlay.classList.remove("open"); });
document.getElementById("clearAll").addEventListener("click",clearAllFilters);
function openInfoModal(){
  infoModal.classList.add("open");
  infoModal.setAttribute("aria-hidden","false");
  infoModalClose.focus();
}
function closeInfoModal(){
  infoModal.classList.remove("open");
  infoModal.setAttribute("aria-hidden","true");
  infoToggle.focus();
}
infoToggle.addEventListener("click",openInfoModal);
infoModalClose.addEventListener("click",closeInfoModal);
infoModal.addEventListener("click",e=>{ if(e.target===infoModal) closeInfoModal(); });

// ── EVENT DETAILS ──
const eventModal=document.getElementById("eventModal");
document.getElementById("eventModalClose").addEventListener("click",closeEventDetails);
eventModal.addEventListener("click",e=>{ if(e.target===eventModal) closeEventDetails(); });
function openActiveDetailEventOnMap(){
  if(!activeDetailEvent) return;
  const ev=activeDetailEvent;
  if(!hasCoords(STAGE_LOCATIONS[ev.stage])) return;
  closeEventDetails({updateUrl:false});
  setView("map",{askLocation:false,updateHash:false});
  setTimeout(()=>focusStage(ev.stage),140);
}
document.getElementById("eventModalMap").addEventListener("click",openActiveDetailEventOnMap);
document.getElementById("eventModalStage").addEventListener("click",openActiveDetailEventOnMap);
document.getElementById("eventModalFavorite").addEventListener("click",()=>{
  if(!activeDetailEvent) return;
  toggleFavorite(activeDetailEvent);
  syncEventModalFavorite(activeDetailEvent);
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&infoModal.classList.contains("open")) closeInfoModal();
  if(e.key==="Escape"&&eventModal.classList.contains("open")) closeEventDetails();
});
document.addEventListener("click",e=>{
  const trigger=e.target.closest?.("[data-event-detail-id]");
  if(!trigger) return;
  e.preventDefault();
  openEventDetailsById(trigger.dataset.eventDetailId);
});
document.addEventListener("click",e=>{
  const trigger=e.target.closest?.("[data-stage-popup-stage]");
  if(!trigger) return;
  e.preventDefault();
  focusStage(trigger.dataset.stagePopupStage);
});
document.addEventListener("click",e=>{
  const trigger=e.target.closest?.("[data-popup-favorite-event]");
  if(!trigger) return;
  e.preventDefault();
  const ev=findEventById(trigger.dataset.popupFavoriteEvent);
  if(!ev) return;
  toggleFavorite(ev);
  if(venuePopup?.isOpen?.()){
    const snapshot=scheduleSnapshots().find(item=>item.stage===ev.stage);
    venuePopup.setHTML(eventMapPopupHtml(ev,snapshot));
    labelMapPopupCloseButton();
    syncPopupDescriptionScroll();
  }
});

// ── GENRE PILLS ──
const genreContainer = document.getElementById("genrePills");
Object.keys(GENRE_LABELS).filter(g=>usedGenres.includes(g)).forEach(g=>{
  const b=document.createElement("button");
  b.type="button"; b.className="dpill"; b.textContent=GENRE_LABELS[g]; b.dataset.g=g;
  b.onclick=()=>{
    if(!activeGenresExplicit){
      activeGenres=new Set([g]);
      activeGenresExplicit=true;
    }else{
      activeGenres.has(g)?activeGenres.delete(g):activeGenres.add(g);
      normalizeGenreFilter();
    }
    render();
  };
  genreContainer.appendChild(b);
});

// ── STAGE PILLS ──
const stageContainer = document.getElementById("stagePills");
allStages.forEach(s=>{
  const b=document.createElement("button");
  b.type="button"; b.className="dpill"; b.textContent=s; b.dataset.s=s;
  b.onclick=()=>{
    if(!activeStagesExplicit){
      activeStages=new Set([s]);
      activeStagesExplicit=true;
    }else{
      activeStages.has(s)?activeStages.delete(s):activeStages.add(s);
      normalizeStageFilter();
    }
    render();
  };
  stageContainer.appendChild(b);
});

// ── MAP FILTER BAR ──
function createMapCheckRow(value,label,kind){
  const row=document.createElement("label");
  row.className="map-check-row";
  const input=document.createElement("input");
  input.type="checkbox";
  input.value=value;
  input.dataset.kind=kind;
  const text=document.createElement("span");
  text.textContent=label;
  row.appendChild(input);
  row.appendChild(text);
  return row;
}

const mapGenreChecks=document.getElementById("mapGenreChecks");
selectableGenres.forEach(g=>{
  mapGenreChecks.appendChild(createMapCheckRow(g,GENRE_LABELS[g]||g,"genre"));
});
const mapStageChecks=document.getElementById("mapStageChecks");
allStages.forEach(stage=>{
  mapStageChecks.appendChild(createMapCheckRow(stage,stage,"stage"));
});

mapGenreChecks.addEventListener("change",e=>{
  const input=e.target.closest?.("input[data-kind='genre']");
  if(!input) return;
  setGenreSelected(input.value,input.checked);
  syncDrawerPills();
  render();
});
mapStageChecks.addEventListener("change",e=>{
  const input=e.target.closest?.("input[data-kind='stage']");
  if(!input) return;
  setStageSelected(input.value,input.checked);
  syncDrawerPills();
  render();
});
document.getElementById("mapGenreAll").addEventListener("click",()=>{
  setAllGenres(true);
  syncDrawerPills();
  render();
});
document.getElementById("mapGenreNone").addEventListener("click",()=>{
  setAllGenres(false);
  syncDrawerPills();
  render();
});
document.getElementById("mapStageAll").addEventListener("click",()=>{
  setAllStages(true);
  syncDrawerPills();
  render();
});
document.getElementById("mapStageNone").addEventListener("click",()=>{
  setAllStages(false);
  syncDrawerPills();
  render();
});
document.addEventListener("click",e=>{
  if(e.target.closest?.(".map-check-menu")) return;
  document.querySelectorAll(".map-check-menu[open]").forEach(menu=>{menu.open=false;});
});

// ── TIME ──
document.getElementById("timeFrom").addEventListener("change",e=>{
  timeFrom=e.target.value; updateTimeReset(); render();
});
document.getElementById("timeTo").addEventListener("change",e=>{
  timeTo=e.target.value; updateTimeReset(); render();
});
function updateTimeReset(){
  document.getElementById("timeReset").style.display=(timeFrom||timeTo)?"inline":"none";
}
document.getElementById("timeReset").addEventListener("click",()=>{
  timeFrom=""; timeTo="";
  document.getElementById("timeFrom").value="";
  document.getElementById("timeTo").value="";
  updateTimeReset(); render();
});

// ── SEARCH ──
document.getElementById("searchInput").addEventListener("input",e=>{
  searchQuery=e.target.value; render();
});
document.getElementById("favoriteOnlyBtn").addEventListener("click",()=>setFavoriteFilter(!activeFavoritesOnly));
document.getElementById("mapFavoriteFilter").addEventListener("change",e=>setFavoriteFilter(e.target.checked));
document.getElementById("mapSearchFilter").addEventListener("input",e=>{
  searchQuery=e.target.value;
  document.getElementById("searchInput").value=searchQuery;
  render();
});
document.getElementById("mapClearFilters").addEventListener("click",clearMapFilters);
document.getElementById("favoriteListName").addEventListener("input",e=>{
  favoriteListName=cleanFavoriteListName(e.target.value);
  favoriteListSyncedName="";
  saveFavoriteListState();
  updateFavoriteNameUi();
  updateFavoriteShareLinks({skipSync:true});
  scheduleFavoriteListSync();
  requestAnimationFrame(drawFavoriteShareImage);
});
document.querySelectorAll("[data-favorite-source]").forEach(button=>{
  button.addEventListener("click",()=>setFavoriteSource(button.dataset.favoriteSource));
});
document.getElementById("useReceivedOnMap").addEventListener("click",useSharedFavoritesOnMap);
document.getElementById("mergeReceivedFavorites").addEventListener("click",mergeSharedFavoritesIntoMine);
document.getElementById("copyReceivedFavorites").addEventListener("click",()=>copySharedFavoritesAsOwnList());
document.getElementById("copyFavoriteUrl").addEventListener("click",async()=>{
  await ensureCurrentFavoriteListShareReady({quiet:false}).catch(()=>{});
  await copyText(currentFavoriteShareUrl());
  setShareStatus("Lenke kopiert.");
});
document.getElementById("nativeShareFavorites").addEventListener("click",()=>shareFavoriteUrl());
document.getElementById("shareInstagram").addEventListener("click",()=>shareFavoriteUrl("Instagram"));
document.getElementById("shareMessenger").addEventListener("click",async event=>{
  event.preventDefault();
  await ensureCurrentFavoriteListShareReady({quiet:false}).catch(()=>{});
  await copyText(currentFavoriteShareMessage());
  setShareStatus("Tekst og lenke kopiert. Åpner Messenger.");
  window.location.href=document.getElementById("shareMessenger").href;
});
document.querySelectorAll("[data-copy-share]").forEach(button=>{
  button.addEventListener("click",async()=>{
    const target=button.dataset.copyShare;
    await ensureCurrentFavoriteListShareReady({quiet:false}).catch(()=>{});
    await copyText(currentFavoriteShareMessage());
    if(isMobileShareDevice()&&button.dataset.appUrl){
      openMobileAppUrl(button.dataset.appUrl,button.dataset.appFallback||"");
      setShareStatus(`Tekst og lenke kopiert. Åpner ${target}.`);
      return;
    }
    setShareStatus(`Tekst og lenke kopiert for ${target}.`);
  });
});
document.querySelectorAll("[data-mobile-app-share]").forEach(link=>{
  link.addEventListener("click",event=>{
    if(!isMobileShareDevice()) return;
    const appUrl=link.dataset.appUrl;
    if(!appUrl) return;
    event.preventDefault();
    openMobileAppUrl(appUrl,link.href);
  });
});
document.getElementById("downloadFavoriteImage").addEventListener("click",downloadFavoriteImage);
document.getElementById("shareFavoriteImage").addEventListener("click",shareFavoriteImage);
document.querySelectorAll(".soon-mode-btn").forEach(button=>{
  button.addEventListener("click",()=>{
    soonSortMode=button.dataset.soonMode;
    renderMapView();
  });
});
document.querySelectorAll("[data-program-mode]").forEach(button=>{
  button.addEventListener("click",()=>setProgramViewMode(button.dataset.programMode,{
    scrollToNow:button.dataset.programMode==="time"
  }));
});

// ── VIEW TABS ──
document.querySelectorAll(".view-tab").forEach(tab=>{
  tab.addEventListener("click",()=>{
    const view=tab.dataset.view;
    setView(view,{askLocation:view==="map"});
  });
});
document.getElementById("locateBtn").addEventListener("click",requestUserLocation);
function viewFromHash(){
  if(window.location.hash==="#kart") return "map";
  if(window.location.hash==="#favoritter") return "favorites";
  return "program";
}

function applyRouteFromLocation(){
  const route=routeFromLocation();
  if(route?.type==="event"){
    closeEventDetails({updateUrl:false});
    setView("program",{updateHash:false});
    openEventDetails(route.event,{updateUrl:false});
    return true;
  }
  if(route?.type==="stage"){
    closeEventDetails({updateUrl:false});
    setView("map",{askLocation:false,updateHash:false});
    focusStage(route.stage,{updateUrl:false});
    return true;
  }
  closeEventDetails({updateUrl:false});
  resetMeta();
  setView(viewFromHash(),{updateHash:false});
  return false;
}

window.addEventListener("hashchange",()=>{
  applyRouteFromLocation();
});
window.addEventListener("popstate",()=>{
  applyRouteFromLocation();
});
