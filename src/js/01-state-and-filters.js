// Concatenated by scripts/build.mjs. Keep files ordered by numeric prefix.
const data = RAW.map(([time,artist,genre,stage,objectId])=>({
  id:objectId||eventId(time,artist,genre,stage),
  legacyId:eventId(time,artist,genre,stage),
  objectId,
  time,
  artist,
  genre,
  stage,
}));
const allStages = [...new Set(data.map(d=>d.stage))].sort();
const usedGenres = [...new Set(data.map(d=>d.genre))];
const selectableGenres = Object.keys(GENRE_LABELS).filter(g=>usedGenres.includes(g));
const EVENT_DATE = "2026-06-06";
const EVENT_DATE_LABEL = "6. juni";
const EVENT_NEXT_DATE = "2026-06-07";
const EVENT_TIME_ZONE_OFFSET = "+02:00";
const SET_DURATION_MIN = 45;
const CARTO_VOYAGER_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const CARTO_DARK_MATTER_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const OSLO_CENTER = [10.750721867246659,59.929923983287885];
const FAVORITES_KEY = "musikkfest-oslo-2026-favorites";
const FAVORITE_LIST_NAME_KEY = "musikkfest-oslo-2026-favorite-list-name";
const FAVORITE_LIST_TOKEN_KEY = "musikkfest-oslo-2026-favorite-list-token";
const FAVORITE_LIST_SLUG_KEY = "musikkfest-oslo-2026-favorite-list-slug";
const FAVORITE_LIST_SYNC_CODE_KEY = "musikkfest-oslo-2026-favorite-list-sync-code";
const FAVORITE_LIST_SYNC_NAME_KEY = "musikkfest-oslo-2026-favorite-list-sync-name";
const THEME_KEY = "musikkfest-oslo-2026-manual-theme";
const TEXT_SIZE_KEY = "musikkfest-oslo-2026-text-size";
const PROGRAM_VIEW_MODE_KEY = "musikkfest-oslo-2026-program-view-mode";
const PUBLIC_APP_URL = "https://suboktav.no/musikkfest/";
const PUBLIC_SHARE_URL = `${PUBLIC_APP_URL}del/`;
const FAVORITE_LIST_API_URL = `${PUBLIC_APP_URL}api/list.php`;
const APP_ROUTE_PREFIX = "/musikkfest/";
const FAVORITES_SHARE_PARAM = "f";
const FAVORITES_LIST_PARAM = "liste";
const FAVORITES_LIST_NAME_PARAM = "navn";
const DEFAULT_FAVORITE_LIST_NAME = "Favoritter";
const DEFAULT_PAGE_TITLE = "Musikkfest 2026 - interaktivt program og kart";
const DEFAULT_PAGE_DESCRIPTION = "Interaktivt program og kart for Musikkfest Oslo 2026. Finn scener, favoritter og musikken som spiller nå eller snart.";
const SHARE_MAP_IMAGE_SRC = "/musikkfest/musikkfest-2026-map-thumb.png";
const SHARE_TITLE_FONT = "'Inter', 'SF Pro Display', 'Geist', -apple-system, BlinkMacSystemFont, sans-serif";
const SCREENSHOT_LOCATION_PRESETS = {
  "schous-plass": {lat:59.92031,lng:10.75954,accuracy:20},
};
const SCREENSHOT_LOCATION_PARAMS = ["location","loc"];
const stageEvents = new Map(allStages.map(stage=>[
  stage,
  data.filter(d=>d.stage===stage)
    .map(d=>({...d,min:toMin(d.time)}))
    .sort((a,b)=>a.min-b.min||a.artist.localeCompare(b.artist,"nb"))
]));
const stageSlugByName = new Map();
const stageNameBySlug = new Map();
const eventSlugById = new Map();
const eventByRouteSlug = new Map();

allStages.forEach(stage=>{
  const slug=uniqueRouteSlug(slugifyRouteSegment(stage),stageNameBySlug,stage);
  stageSlugByName.set(stage,slug);
  stageNameBySlug.set(slug,stage);
});

allStages.forEach(stage=>{
  const stageSlug=stageSlugByName.get(stage);
  const usedArtistSlugs=new Map();
  data
    .filter(ev=>ev.stage===stage)
    .sort((a,b)=>a.time.localeCompare(b.time)||a.artist.localeCompare(b.artist,"nb"))
    .forEach(ev=>{
      const base=slugifyRouteSegment(ev.artist)||slugifyRouteSegment(ev.objectId||ev.id)||"artist";
      const artistSlug=uniqueRouteSlug(base,usedArtistSlugs,ev.id);
      eventSlugById.set(ev.id,artistSlug);
      eventSlugById.set(ev.legacyId,artistSlug);
      eventByRouteSlug.set(`${stageSlug}/${artistSlug}`,ev);
    });
});

let activeGenres = new Set();
let activeStages = new Set();
let activeGenresExplicit = false;
let activeStagesExplicit = false;
let timeFrom = "";
let timeTo   = "";
let searchQuery = "";
let activeFavoritesOnly = false;
let programViewMode = loadProgramViewMode();
let favoriteEventIds = loadFavorites();
let favoriteListName = loadFavoriteListName();
let favoriteListToken = safeLocalStorageGetItem(FAVORITE_LIST_TOKEN_KEY);
let favoriteListSlug = safeLocalStorageGetItem(FAVORITE_LIST_SLUG_KEY);
let favoriteListSyncedCode = safeLocalStorageGetItem(FAVORITE_LIST_SYNC_CODE_KEY);
let favoriteListSyncedName = safeLocalStorageGetItem(FAVORITE_LIST_SYNC_NAME_KEY);
let favoriteListSyncTimer = null;
let favoriteListSyncSeq = 0;
let favoriteListSyncPromise = null;
let favoriteListSyncRequestKey = "";
let sharedFavoriteList = null;
let activeFavoriteSource = "mine";
let soonSortMode = "smart";
let activeView = "program";
let venueMap = null;
let mapLoaded = false;
let venueMapStyle = null;
let venueMapStyleLoaded = false;
let venueMapOverlayRefreshTimer = null;
let venueLayerEventsBound = false;
normalizeHashQueryParams();
const screenshotLocation = screenshotLocationFromQuery();
let locationRequested = false;
let locationState = "idle";
let userLocation = null;
let venuePopup = null;
let userPulseFrame = null;
let activeDetailEvent = null;
let eventModalImageLoadSeq = 0;
let pageScrollLockCount = 0;
let pageScrollLockState = null;

function eventId(time,artist,genre,stage){
  return [time,artist,genre,stage].join("||");
}

function slugifyRouteSegment(value){
  return String(value||"")
    .trim()
    .toLowerCase()
    .replace(/[æǽ]/g,"ae")
    .replace(/[øö]/g,"o")
    .replace(/[åä]/g,"a")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,80);
}

function uniqueRouteSlug(base,used,fallback){
  const clean=base||slugifyRouteSegment(fallback)||"x";
  let slug=clean;
  let index=2;
  while(used.has(slug)){
    slug=`${clean}-${index}`;
    index+=1;
  }
  used.set(slug,fallback);
  return slug;
}

function appUrlParams(){
  const params=new URLSearchParams(window.location.search);
  const hashQueryIndex=window.location.hash.indexOf("?");
  if(hashQueryIndex!==-1){
    const hashParams=new URLSearchParams(window.location.hash.slice(hashQueryIndex+1));
    hashParams.forEach((value,key)=>{
      if(!params.has(key)) params.set(key,value);
    });
  }
  return params;
}

function normalizeHashQueryParams(){
  const hash=window.location.hash;
  const hashQueryIndex=hash.indexOf("?");
  if(hashQueryIndex===-1||!window.history?.replaceState) return;
  const hashBase=hash.slice(0,hashQueryIndex);
  const hashParams=new URLSearchParams(hash.slice(hashQueryIndex+1));
  const url=new URL(window.location.href);
  hashParams.forEach((value,key)=>{
    if(!url.searchParams.has(key)) url.searchParams.set(key,value);
  });
  url.hash=hashBase;
  history.replaceState(history.state,"",url.toString());
}

function screenshotLocationFromQuery(){
  const params=appUrlParams();
  const raw=SCREENSHOT_LOCATION_PARAMS
    .map(param=>params.get(param))
    .find(value=>String(value||"").trim());
  if(!raw) return null;

  const normalized=slugifyRouteSegment(raw);
  const preset=SCREENSHOT_LOCATION_PRESETS[normalized];
  if(preset) return {...preset};

  const coordinateMatch=String(raw).match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if(!coordinateMatch) return null;
  const lat=Number(coordinateMatch[1]);
  const lng=Number(coordinateMatch[2]);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)) return null;
  if(lat<-90||lat>90||lng<-180||lng>180) return null;
  return {lat,lng,accuracy:20};
}

function currentTheme(){
  return document.documentElement.dataset.theme==="dark"?"dark":"light";
}

function updateThemeToggle(){
  const button=document.getElementById("themeToggle");
  if(!button) return;
  const dark=currentTheme()==="dark";
  button.textContent=dark?"☀":"☾";
  button.setAttribute("aria-pressed",String(dark));
  button.setAttribute("aria-label",dark?"Bytt til lys modus":"Bytt til mørk modus");
  button.title=dark?"Bytt til lys modus":"Bytt til mørk modus";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content",dark?"#0f0d0a":"#1a1814");
}

function setTheme(theme){
  const next=theme==="dark"?"dark":"light";
  document.documentElement.dataset.theme=next;
  document.documentElement.style.colorScheme=next;
  try{
    localStorage.setItem(THEME_KEY,next);
    localStorage.removeItem("musikkfest-oslo-2026-theme");
  }catch{}
  syncMapTheme();
  updateThemeToggle();
}

function textSizeLarge(){
  return document.documentElement.dataset.textSize==="large";
}

function updateTextSizeToggle(){
  const button=document.getElementById("textSizeToggle");
  if(!button) return;
  const large=textSizeLarge();
  button.setAttribute("aria-pressed",String(large));
  button.setAttribute("aria-label",large?"Bruk normal skriftstørrelse":"Øk skriftstørrelsen");
  button.title=large?"Bruk normal skriftstørrelse":"Øk skriftstørrelsen";
}

function setTextSizeLarge(large){
  if(large) document.documentElement.dataset.textSize="large";
  else delete document.documentElement.dataset.textSize;
  try{
    if(large) localStorage.setItem(TEXT_SIZE_KEY,"large");
    else localStorage.removeItem(TEXT_SIZE_KEY);
  }catch{}
  updateTextSizeToggle();
}

function loadProgramViewMode(){
  try{
    return localStorage.getItem(PROGRAM_VIEW_MODE_KEY)==="time"?"time":"stage";
  }catch{
    return "stage";
  }
}

function setProgramViewMode(mode,{scrollToNow=false}={}){
  programViewMode=mode==="time"?"time":"stage";
  try{localStorage.setItem(PROGRAM_VIEW_MODE_KEY,programViewMode);}catch{}
  render();
  if(programViewMode==="time"){
    requestAnimationFrame(()=>updateProgramNowLine({scroll:scrollToNow}));
  }
}

function syncProgramModeButtons(){
  document.querySelectorAll("[data-program-mode]").forEach(button=>{
    const active=button.dataset.programMode===programViewMode;
    button.classList.toggle("active",active);
    button.setAttribute("aria-selected",String(active));
  });
}

function loadFavorites(){
  try{
    const saved=JSON.parse(localStorage.getItem(FAVORITES_KEY)||"[]");
    return new Set(Array.isArray(saved)?saved:[]);
  }catch{
    return new Set();
  }
}

function safeLocalStorageGetItem(key){
  try{
    return localStorage.getItem(key)||"";
  }catch{
    return "";
  }
}

function cleanFavoriteListName(value){
  const name=String(value||"").replace(/\s+/g," ").trim().slice(0,60);
  return name||DEFAULT_FAVORITE_LIST_NAME;
}

function loadFavoriteListName(){
  try{
    return cleanFavoriteListName(localStorage.getItem(FAVORITE_LIST_NAME_KEY)||DEFAULT_FAVORITE_LIST_NAME);
  }catch{
    return DEFAULT_FAVORITE_LIST_NAME;
  }
}

function saveFavoriteListState(){
  try{
    localStorage.setItem(FAVORITE_LIST_NAME_KEY,favoriteListName);
    if(favoriteListToken) localStorage.setItem(FAVORITE_LIST_TOKEN_KEY,favoriteListToken);
    else localStorage.removeItem(FAVORITE_LIST_TOKEN_KEY);
    if(favoriteListSlug) localStorage.setItem(FAVORITE_LIST_SLUG_KEY,favoriteListSlug);
    else localStorage.removeItem(FAVORITE_LIST_SLUG_KEY);
    if(favoriteListSyncedCode) localStorage.setItem(FAVORITE_LIST_SYNC_CODE_KEY,favoriteListSyncedCode);
    else localStorage.removeItem(FAVORITE_LIST_SYNC_CODE_KEY);
    if(favoriteListSyncedName) localStorage.setItem(FAVORITE_LIST_SYNC_NAME_KEY,favoriteListSyncedName);
    else localStorage.removeItem(FAVORITE_LIST_SYNC_NAME_KEY);
  }catch{}
}

function saveFavorites(){
  try{
    const normalized=data.filter(isFavorite).map(ev=>ev.id);
    favoriteEventIds=new Set(normalized);
    localStorage.setItem(FAVORITES_KEY,JSON.stringify(normalized));
  }catch{}
}

function favoriteKeys(ev){
  return [ev.id,ev.legacyId].filter(Boolean);
}

function eventInIdSet(ev,idSet){
  return favoriteKeys(ev).some(id=>idSet?.has(id));
}

function hasSharedFavoriteList(){
  return Boolean(sharedFavoriteList&&sharedFavoriteList.eventIds?.size);
}

function currentFavoriteSource(){
  return activeFavoriteSource==="shared"&&hasSharedFavoriteList()?"shared":"mine";
}

function isSharedFavorite(ev){
  return eventInIdSet(ev,sharedFavoriteList?.eventIds);
}

function isFavoriteFilterMatch(ev){
  return currentFavoriteSource()==="shared"?isSharedFavorite(ev):isFavorite(ev);
}

function favoriteEvents(source=currentFavoriteSource()){
  const predicate=source==="shared"?isSharedFavorite:isFavorite;
  return data
    .filter(predicate)
    .sort((a,b)=>toMin(a.time)-toMin(b.time)||a.stage.localeCompare(b.stage,"nb")||a.artist.localeCompare(b.artist,"nb"));
}

function favoriteShareCode(){
  return data
    .map((ev,index)=>isFavorite(ev)?index:null)
    .filter(index=>index!==null)
    .map(index=>index.toString(36))
    .join(".");
}

function decodeFavoriteShareCode(raw){
  if(!raw) return [];
  const ids=[];
  raw.split(".").forEach(part=>{
    if(!part) return;
    const index=Number.parseInt(part,36);
    if(Number.isInteger(index)&&data[index]) ids.push(data[index].id);
  });
  return [...new Set(ids)];
}

function sharedFavoriteUrl({code,name,slug}){
  if(slug) return `${PUBLIC_APP_URL}${slug}`;
  const url=new URL(PUBLIC_SHARE_URL);
  if(code) url.searchParams.set(FAVORITES_SHARE_PARAM,code);
  const cleanName=cleanFavoriteListName(name);
  if(cleanName!==DEFAULT_FAVORITE_LIST_NAME) url.searchParams.set(FAVORITES_LIST_NAME_PARAM,cleanName);
  return url.toString();
}

function applySharedFavoritesFromUrl(){
  const params=new URLSearchParams(window.location.search);
  if(!params.has(FAVORITES_SHARE_PARAM)) return;
  const code=params.get(FAVORITES_SHARE_PARAM);
  const incomingName=cleanFavoriteListName(params.get(FAVORITES_LIST_NAME_PARAM)||favoriteListName);
  const incomingSlug=(params.get(FAVORITES_LIST_PARAM)||"").replace(/[^a-z0-9-]/g,"").slice(0,80);
  const eventIds=new Set(decodeFavoriteShareCode(code));
  if(!eventIds.size) return;
  sharedFavoriteList={
    code:code||"",
    name:incomingName,
    slug:incomingSlug,
    eventIds,
    url:sharedFavoriteUrl({code,name:incomingName,slug:incomingSlug}),
  };
  activeFavoriteSource="shared";
}

function favoriteShareUrl(){
  const code=favoriteShareCode();
  if(code&&favoriteListSlug&&favoriteListSyncedCode===code&&favoriteListSyncedName===favoriteListName){
    return `${PUBLIC_APP_URL}${favoriteListSlug}`;
  }
  const url=new URL(PUBLIC_SHARE_URL);
  if(code) url.searchParams.set(FAVORITES_SHARE_PARAM,code);
  if(favoriteListName!==DEFAULT_FAVORITE_LIST_NAME) url.searchParams.set(FAVORITES_LIST_NAME_PARAM,favoriteListName);
  return url.toString();
}

function favoriteShareDisplayUrl(){
  return favoriteShareUrl().replace(/^https?:\/\//,"").replace(/\/$/,"");
}

function buildFavoriteShareText({name,events,source="mine"}){
  if(!events.length){
    return "Sjekk Musikkfest 2026.\n\nInteraktivt program, kart og favoritter.\n\nPerfekt for å bygge en egen rute.";
  }
  const listName=cleanFavoriteListName(name||DEFAULT_FAVORITE_LIST_NAME);
  const intro=source==="shared"
    ? "Sjekk denne Musikkfest-listen."
    : "Jeg har laget en Musikkfest-liste.";
  const nameLine=listName&&listName!==DEFAULT_FAVORITE_LIST_NAME?`\n\n${listName}`:"";
  return `${intro}${nameLine}\n\nÅpne lenken for kart, tider og scener.\n\nDu kan bruke listen uten å overskrive dine egne favoritter.`;
}

function buildShareMessage(text,url){
  return `${text}\n\n${url}`;
}

function favoriteShareText(){
  const events=favoriteEvents("mine");
  return buildFavoriteShareText({name:favoriteListName,events,source:"mine"});
}

function currentFavoriteListName(){
  return currentFavoriteSource()==="shared"
    ? cleanFavoriteListName(sharedFavoriteList?.name||DEFAULT_FAVORITE_LIST_NAME)
    : favoriteListName;
}

function currentFavoriteShareUrl(){
  return currentFavoriteSource()==="shared"
    ? (sharedFavoriteList?.url||PUBLIC_APP_URL)
    : favoriteShareUrl();
}

function currentFavoriteShareDisplayUrl(){
  return currentFavoriteShareUrl().replace(/^https?:\/\//,"").replace(/\/$/,"");
}

function currentFavoriteShareText(){
  const events=favoriteEvents(currentFavoriteSource());
  return buildFavoriteShareText({
    name:currentFavoriteListName(),
    events,
    source:currentFavoriteSource()
  });
}

function currentFavoriteShareMessage(){
  return buildShareMessage(currentFavoriteShareText(),currentFavoriteShareUrl());
}

async function ensureCurrentFavoriteListShareReady({quiet=false}={}){
  if(currentFavoriteSource()==="shared"){
    return {url:currentFavoriteShareUrl(),slug:sharedFavoriteList?.slug||""};
  }
  return syncFavoriteListNow({quiet});
}

function isFavorite(ev){
  return favoriteKeys(ev).some(id=>favoriteEventIds.has(id));
}

function addFavoriteToMine(ev){
  if(isFavorite(ev)) return false;
  favoriteEventIds.add(ev.id);
  saveFavorites();
  favoriteListSyncedCode="";
  saveFavoriteListState();
  scheduleFavoriteListSync();
  return true;
}

function toggleFavorite(ev){
  if(isFavorite(ev)){
    favoriteKeys(ev).forEach(id=>favoriteEventIds.delete(id));
  }else{
    favoriteEventIds.add(ev.id);
  }
  saveFavorites();
  favoriteListSyncedCode="";
  saveFavoriteListState();
  scheduleFavoriteListSync();
  render();
}

function setFavoriteSource(source){
  activeFavoriteSource=source==="shared"&&hasSharedFavoriteList()?"shared":"mine";
  render();
}

function mergeSharedFavoritesIntoMine(){
  if(!hasSharedFavoriteList()) return;
  const before=favoriteEventIds.size;
  favoriteEvents("shared").forEach(ev=>favoriteEventIds.add(ev.id));
  saveFavorites();
  favoriteListSyncedCode="";
  saveFavoriteListState();
  scheduleFavoriteListSync();
  const added=Math.max(0,favoriteEventIds.size-before);
  setShareStatus(added?`La til ${added} i mine favoritter.`:"Alt lå allerede i mine favoritter.");
  render();
}

async function copySharedFavoritesAsOwnList(){
  if(!hasSharedFavoriteList()) return;
  const mineCount=favoriteEvents("mine").length;
  if(mineCount){
    const ok=window.confirm("Dette bytter Min liste til en egen kopi av den mottatte listen. Din nåværende liste lagres først som fast URL hvis mulig. Fortsette?");
    if(!ok) return;
    await syncFavoriteListNow({quiet:true}).catch(()=>{});
  }
  favoriteEventIds=new Set(favoriteEvents("shared").map(ev=>ev.id));
  favoriteListName=cleanFavoriteListName(`Kopi av ${sharedFavoriteList.name}`);
  favoriteListToken="";
  favoriteListSlug="";
  favoriteListSyncedCode="";
  favoriteListSyncedName="";
  saveFavorites();
  saveFavoriteListState();
  activeFavoriteSource="mine";
  updateFavoriteNameUi();
  render();
  await syncFavoriteListNow({quiet:false}).catch(()=>{});
  setShareStatus("Lagret som egen liste.");
}

function useSharedFavoritesOnMap(){
  if(!hasSharedFavoriteList()) return;
  activeFavoriteSource="shared";
  activeFavoritesOnly=true;
  setView("map",{askLocation:true});
  render();
}

function setFavoriteFilter(active){
  activeFavoritesOnly=active;
  render();
}

function syncFavoriteFilterButtons(){
  const source=currentFavoriteSource();
  const noun=source==="shared"?"mottatt liste":"mine favoritter";
  const label=activeFavoritesOnly?`★ Kun ${noun}`:`☆ Kun ${noun}`;
  ["favoriteOnlyBtn"].forEach(id=>{
    const button=document.getElementById(id);
    if(!button) return;
    button.textContent=label;
    button.classList.toggle("active",activeFavoritesOnly);
    button.setAttribute("aria-pressed",String(activeFavoritesOnly));
  });
  const mapFavorite=document.getElementById("mapFavoriteFilter");
  const mapFavoriteWrap=document.getElementById("mapFavoriteFilterWrap");
  if(mapFavorite){
    mapFavorite.checked=activeFavoritesOnly;
  }
  const mapFavoriteLabel=document.getElementById("mapFavoriteFilterLabel");
  if(mapFavoriteLabel) mapFavoriteLabel.textContent=`Kun ${noun}`;
  mapFavoriteWrap?.classList.toggle("active",activeFavoritesOnly);
}

function hasActiveFilters(){
  return Boolean(activeGenresExplicit||activeStagesExplicit||activeFavoritesOnly||timeFrom||timeTo||searchQuery);
}

function hasActiveMapFilters(){
  return Boolean(activeGenresExplicit||activeStagesExplicit||activeFavoritesOnly||searchQuery);
}

function isGenreSelected(genre){
  return !activeGenresExplicit||activeGenres.has(genre);
}

function isStageSelected(stage){
  return !activeStagesExplicit||activeStages.has(stage);
}

function normalizeGenreFilter(){
  // En tom seleksjon finnes ikke: alt valgt eller ingenting valgt betyr begge «alle sjangre».
  if(activeGenresExplicit&&(activeGenres.size===0||selectableGenres.every(g=>activeGenres.has(g)))){
    activeGenres.clear();
    activeGenresExplicit=false;
  }
}

function normalizeStageFilter(){
  // En tom seleksjon finnes ikke: alt valgt eller ingenting valgt betyr begge «alle scener».
  if(activeStagesExplicit&&(activeStages.size===0||allStages.every(stage=>activeStages.has(stage)))){
    activeStages.clear();
    activeStagesExplicit=false;
  }
}

function setGenreSelected(genre,selected){
  if(!activeGenresExplicit){
    activeGenres=new Set(selectableGenres);
    activeGenresExplicit=true;
  }
  selected?activeGenres.add(genre):activeGenres.delete(genre);
  normalizeGenreFilter();
}

function setStageSelected(stage,selected){
  if(!activeStagesExplicit){
    activeStages=new Set(allStages);
    activeStagesExplicit=true;
  }
  selected?activeStages.add(stage):activeStages.delete(stage);
  normalizeStageFilter();
}

function setAllGenres(){
  activeGenres.clear();
  activeGenresExplicit=false;
}

function setAllStages(){
  activeStages.clear();
  activeStagesExplicit=false;
}

function mapGenreSummary(){
  if(!activeGenresExplicit) return "Alle sjangre";
  if(activeGenres.size===1){
    const genre=[...activeGenres][0];
    return GENRE_LABELS[genre]||genre;
  }
  return `${activeGenres.size} sjangre`;
}

function mapStageSummary(){
  if(!activeStagesExplicit) return "Alle scener";
  if(activeStages.size===1) return [...activeStages][0];
  return `${activeStages.size} scener`;
}

function syncDrawerPills(){
  document.querySelectorAll(".dpill[data-g]").forEach(button=>{
    button.classList.toggle("ag",activeGenresExplicit&&activeGenres.has(button.dataset.g));
  });
  document.querySelectorAll(".dpill[data-s]").forEach(button=>{
    button.classList.toggle("as",activeStagesExplicit&&activeStages.has(button.dataset.s));
  });
}

function syncMapCheckboxes(){
  document.querySelectorAll("#mapGenreChecks input[type='checkbox']").forEach(input=>{
    input.checked=isGenreSelected(input.value);
  });
  document.querySelectorAll("#mapStageChecks input[type='checkbox']").forEach(input=>{
    input.checked=isStageSelected(input.value);
  });
}

function syncMapFilterBar(){
  document.getElementById("mapSearchFilter").value=searchQuery;
  document.getElementById("mapGenreSummary").textContent=mapGenreSummary();
  document.getElementById("mapStageSummary").textContent=mapStageSummary();
  syncMapCheckboxes();
  document.getElementById("mapClearFilters").disabled=!hasActiveMapFilters();
}

function clearMapFilters(){
  activeGenres.clear();
  activeStages.clear();
  activeGenresExplicit=false;
  activeStagesExplicit=false;
  activeFavoritesOnly=false;
  searchQuery="";
  document.getElementById("searchInput").value="";
  syncDrawerPills();
  render();
}

function clearAllFilters(){
  activeGenres.clear();
  activeStages.clear();
  activeGenresExplicit=false;
  activeStagesExplicit=false;
  activeFavoritesOnly=false;
  timeFrom="";
  timeTo="";
  searchQuery="";
  document.getElementById("timeFrom").value="";
  document.getElementById("timeTo").value="";
  document.getElementById("searchInput").value="";
  updateTimeReset();
  syncDrawerPills();
  render();
}
