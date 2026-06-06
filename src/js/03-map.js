// Concatenated by scripts/build.mjs. Keep files ordered by numeric prefix.
function hasCoords(loc){
  return Boolean(loc)&&Number.isFinite(loc.lat)&&Number.isFinite(loc.lng);
}

const VENUE_POPUP_ZOOM = 14.5;

function venuePopupFlyOffset(){
  const height=venueMap?.getContainer?.().clientHeight||0;
  const offset=Math.round(Math.min(Math.max(height*.36,96),252));
  return [0,-offset];
}

function flyToVenuePopup(loc){
  venueMap.flyTo({
    center:[loc.lng,loc.lat],
    zoom:VENUE_POPUP_ZOOM,
    offset:venuePopupFlyOffset(),
    speed:.8,
    essential:true,
  });
}

function currentMapStyleUrl(){
  return currentTheme()==="dark"?CARTO_DARK_MATTER_STYLE:CARTO_VOYAGER_STYLE;
}

function venueMapStyleReady(){
  return Boolean(venueMap)&&mapLoaded&&venueMapStyleLoaded&&venueMap.isStyleLoaded();
}

function scheduleVenueMapOverlayRefresh(delay=0){
  if(!venueMap||!mapLoaded) return;
  if(venueMapOverlayRefreshTimer) clearTimeout(venueMapOverlayRefreshTimer);
  venueMapOverlayRefreshTimer=setTimeout(()=>{
    venueMapOverlayRefreshTimer=null;
    refreshVenueMapOverlays();
  },delay);
}

function refreshVenueMapOverlays(){
  if(!venueMap||!mapLoaded) return;
  if(!venueMap.isStyleLoaded()){
    venueMapStyleLoaded=false;
    scheduleVenueMapOverlayRefresh(120);
    return;
  }
  venueMapStyleLoaded=true;
  try{
    addVenueLayers();
    updateUserMarker(false);
    renderMapView();
    requestAnimationFrame(()=>venueMap.resize());
  }catch(error){
    scheduleVenueMapOverlayRefresh(160);
  }
}

function syncMapTheme(){
  if(!venueMap) return;
  const next=currentMapStyleUrl();
  if(venueMapStyle===next) return;
  venueMapStyle=next;
  venueMapStyleLoaded=false;
  venueMap.setStyle(next,{diff:false});
  scheduleVenueMapOverlayRefresh(120);
}

function locationQuery(loc){
  return hasCoords(loc)?`${loc.lat},${loc.lng}`:(loc.query||loc.label);
}

function mapsSearchUrl(loc){
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery(loc))}`;
}

function mapsAddressSearchUrl(address){
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function directionsUrl(loc){
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(locationQuery(loc))}`;
}

function mapEmbedUrl(loc){
  return `https://www.google.com/maps?q=${encodeURIComponent(locationQuery(loc))}&z=16&output=embed`;
}

function createMapLink(label,href,className=""){
  const a=document.createElement("a");
  a.className=`stage-map-link ${className}`.trim();
  a.href=href;
  a.target="_blank";
  a.rel="noopener";
  a.textContent=label;
  return a;
}

function createStageMapPanel(loc){
  const panel=document.createElement("div");
  panel.className="stage-map-panel";

  const details=document.createElement("div");
  details.className="stage-map-details";

  const kicker=document.createElement("div");
  kicker.className="stage-map-kicker";
  kicker.textContent="Kart";

  const label=document.createElement("div");
  label.className="stage-map-label";
  label.textContent=loc.label;

  details.appendChild(kicker);
  details.appendChild(label);

  if(loc.query&&!hasCoords(loc)){
    const address=document.createElement("div");
    address.className="stage-map-address";
    address.textContent=loc.query;
    details.appendChild(address);
  }

  const actions=document.createElement("div");
  actions.className="stage-map-actions";
  actions.appendChild(createMapLink("Åpne i Google Maps",mapsSearchUrl(loc),"primary"));
  actions.appendChild(createMapLink("Veibeskrivelse",directionsUrl(loc)));
  details.appendChild(actions);

  const frame=document.createElement("div");
  frame.className="stage-map-frame";

  const iframe=document.createElement("iframe");
  iframe.loading="lazy";
  iframe.referrerPolicy="no-referrer-when-downgrade";
  iframe.title=`Kart: ${loc.label}`;
  iframe.dataset.src=mapEmbedUrl(loc);
  frame.appendChild(iframe);

  panel.appendChild(details);
  panel.appendChild(frame);
  return panel;
}

function toggleStageMap(card,panel,button){
  const opening=!card.classList.contains("map-open");
  card.classList.toggle("map-open",opening);
  button.setAttribute("aria-expanded",String(opening));
  button.textContent=opening?"Skjul kart":"Kart";

  if(opening){
    card.classList.remove("collapsed");
    const iframe=panel.querySelector("iframe");
    if(iframe&&!iframe.src) iframe.src=iframe.dataset.src;
  }
}

function toMin(t){
  if(!t) return null;
  const [h,m]=t.split(":").map(Number);
  return (h<4?h+24:h)*60+m;
}

function matches(ev){
  if(activeFavoritesOnly&&!isFavoriteFilterMatch(ev)) return false;
  if(activeGenresExplicit&&!activeGenres.has(ev.genre)) return false;
  if(activeStagesExplicit&&!activeStages.has(ev.stage)) return false;
  const q=searchQuery.toLowerCase();
  if(q && !ev.artist.toLowerCase().includes(q) && !ev.stage.toLowerCase().includes(q)) return false;
  return true;
}

function localDateKey(date=new Date()){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

// The festival's real-time window: from the first concert (10:00) until the
// post-midnight sets wind down the next morning. before/live/after is decided
// from the real timestamp, NOT the calendar date — otherwise the small hours
// of the festival morning (00:00, hours before anything starts) get misread as
// the post-midnight phase and the app shows concerts as already playing.
const FESTIVAL_STARTS_AT = new Date(`${EVENT_DATE}T10:00:00${EVENT_TIME_ZONE_OFFSET}`).getTime();
const FESTIVAL_ENDS_AT = new Date(`${EVENT_NEXT_DATE}T04:00:00${EVENT_TIME_ZONE_OFFSET}`).getTime();

function festivalClock(date=new Date()){
  const override=appUrlParams().get("now");
  if(/^\d{1,2}:\d{2}$/.test(override||"")){
    const [h,m]=override.split(":").map(Number);
    if(h>=0&&h<24&&m>=0&&m<60){
      const time=`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
      return {
        mode:"live",
        min:toMin(time),
        date:new Date(`${EVENT_DATE}T${time}:00${EVENT_TIME_ZONE_OFFSET}`),
        label:`Kl. ${time}`,
      };
    }
  }
  const now=date.getTime();
  if(now<FESTIVAL_STARTS_AT) return {mode:"before",min:toMin("09:59"),date,label:`Festivalen starter ${EVENT_DATE_LABEL}`};
  if(now>=FESTIVAL_ENDS_AT) return {mode:"after",min:toMin("27:59"),date,label:"Festivaldagen er ferdig"};
  const time=`${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
  return {mode:"live",min:toMin(time),date,label:`Kl. ${time}`};
}

// Show the "festival is over" map modal from 06:00 the morning after the
// festival onward (concerts run past midnight, so we wait until the night
// is fully done). The ?now= time-travel link disables it so the festival
// can still be replayed.
const FESTIVAL_OVER_AT = new Date(`${EVENT_NEXT_DATE}T06:00:00${EVENT_TIME_ZONE_OFFSET}`).getTime();
function festivalIsOver(){
  const override=appUrlParams().get("now");
  if(/^\d{1,2}:\d{2}$/.test(override||"")) return false;
  return Date.now()>=FESTIVAL_OVER_AT;
}
function updateFestivalOverModal(){
  const el=document.getElementById("festivalOver");
  if(!el) return;
  const show=festivalIsOver();
  el.classList.toggle("open",show);
  el.setAttribute("aria-hidden",String(!show));
}

function distanceMeters(from,loc){
  if(!from||!hasCoords(loc)) return null;
  const rad=n=>n*Math.PI/180;
  const r=6371000;
  const dLat=rad(loc.lat-from.lat);
  const dLng=rad(loc.lng-from.lng);
  const a=Math.sin(dLat/2)**2+
    Math.cos(rad(from.lat))*Math.cos(rad(loc.lat))*Math.sin(dLng/2)**2;
  return 2*r*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function formatDistance(meters){
  if(!Number.isFinite(meters)) return "– m";
  if(meters<950) return `${Math.round(meters)} m`;
  return `${(meters/1000).toFixed(meters<9500?1:0)} km`;
}

function eventStartDate(ev){
  const [hour,minute]=ev.time.split(":").map(Number);
  const dateKey=hour<4?EVENT_NEXT_DATE:EVENT_DATE;
  const hh=String(hour).padStart(2,"0");
  const mm=String(minute).padStart(2,"0");
  return new Date(`${dateKey}T${hh}:${mm}:00${EVENT_TIME_ZONE_OFFSET}`);
}

function minutesUntil(ev,clock){
  if(!ev) return 9999;
  if(clock.mode==="before"){
    return Math.max(0,Math.ceil((eventStartDate(ev)-clock.date)/60000));
  }
  return Math.max(0,ev.min-clock.min);
}

function formatStartsIn(ev,clock){
  if(!ev) return "";
  const minutes=minutesUntil(ev,clock);
  if(!Number.isFinite(minutes)||minutes>=9999) return "";
  if(clock.mode==="before"){
    const hours=Math.max(1,Math.ceil(minutes/60));
    return hours===1?"om 1 time":`om ${hours} timer`;
  }
  if(minutes===0) return "nå";
  if(minutes<60) return `om ${minutes} min`;
  const h=Math.floor(minutes/60);
  const m=minutes%60;
  return m?`om ${h}t ${m}m`:`om ${h}t`;
}

function scheduleSnapshots(clock=festivalClock()){
  return allStages.map(stage=>{
    const events=stageEvents.get(stage)||[];
    const loc=STAGE_LOCATIONS[stage];
    let current=null;
    let next=null;

    events.forEach((ev,index)=>{
      const includeEvent=matches(ev);
      // An act runs until the next slot at the same stage; only the last act of
      // the day falls back to a fixed set length.
      const inferredEnd=events[index+1]?.min??ev.min+SET_DURATION_MIN;
      if(includeEvent&&clock.mode==="live"&&clock.min>=ev.min&&clock.min<inferredEnd){
        current={...ev,endMin:inferredEnd};
      }
      if(includeEvent&&!next&&ev.min>clock.min) next=ev;
    });

    if(clock.mode==="before") next=events.find(ev=>matches(ev))||null;
    if(clock.mode==="after") next=null;

    return {
      stage,loc,current,next,
      distance:distanceMeters(userLocation,loc),
    };
  });
}

// Every matching upcoming concert at a stage (not just the next one). Used to
// expand the "soon" list to a stage's full remaining lineup when the user has
// narrowed the map to specific scene(s).
function upcomingStageEvents(stage,clock){
  if(clock.mode==="after") return [];
  return (stageEvents.get(stage)||[]).filter(ev=>{
    if(!matches(ev)) return false;
    return clock.mode==="live"?ev.min>clock.min:true;
  });
}

function sortByDistanceThenTime(a,b,type){
  const ad=a.distance,bd=b.distance;
  if(Number.isFinite(ad)&&Number.isFinite(bd)&&ad!==bd) return ad-bd;
  if(Number.isFinite(ad)&&!Number.isFinite(bd)) return -1;
  if(!Number.isFinite(ad)&&Number.isFinite(bd)) return 1;
  const ae=type==="now"?a.current:a.next;
  const be=type==="now"?b.current:b.next;
  return (ae?.min??9999)-(be?.min??9999)||a.stage.localeCompare(b.stage,"nb");
}

function sortSoonItems(items,clock){
  const timeFirst=(a,b)=>{
    const am=minutesUntil(a.next,clock);
    const bm=minutesUntil(b.next,clock);
    return am-bm||sortByDistanceThenTime(a,b,"soon");
  };

  if(soonSortMode==="upcoming"||!userLocation) return items.sort(timeFirst);

  if(soonSortMode==="distance"){
    return items.sort((a,b)=>sortByDistanceThenTime(a,b,"soon"));
  }

  return items.sort((a,b)=>{
    const aMinutes=minutesUntil(a.next,clock);
    const bMinutes=minutesUntil(b.next,clock);
    const aWalk=Number.isFinite(a.distance)?Math.min(a.distance/80,35):0;
    const bWalk=Number.isFinite(b.distance)?Math.min(b.distance/80,35):0;
    return (aMinutes+aWalk)-(bMinutes+bWalk)||timeFirst(a,b);
  });
}

function syncSoonModeButtons(){
  document.querySelectorAll(".soon-mode-btn").forEach(button=>{
    const isActive=button.dataset.soonMode===soonSortMode;
    button.classList.toggle("active",isActive);
    button.setAttribute("aria-selected",String(isActive));
  });
}

function mobileMapViewportOffset(){
  const headerHeight=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h"))||0;
  const tabsHeight=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tabs-h"))||0;
  return headerHeight+tabsHeight+8;
}

function venueMapAlignedUnderHeader(){
  const mapEl=document.getElementById("venueMap");
  if(!mapEl) return true;
  const rect=mapEl.getBoundingClientRect();
  const top=mobileMapViewportOffset();
  return Math.abs(rect.top-top)<=2;
}

function scrollVenueMapIntoView({force=false}={}){
  if(!window.matchMedia("(max-width: 640px)").matches) return;
  const mapEl=document.getElementById("venueMap");
  if(!mapEl) return;
  if(!force&&venueMapAlignedUnderHeader()) return;
  const rect=mapEl.getBoundingClientRect();
  const behavior=window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth";
  window.scrollTo({
    top:Math.max(0,window.scrollY+rect.top-mobileMapViewportOffset()),
    behavior,
  });
  requestAnimationFrame(()=>venueMap?.resize());
}

function createLiveItem(item,type){
  const ev=type==="now"?item.current:item.next;
  const openStageFromLive=()=>{
    scrollVenueMapIntoView({force:true});
    focusStage(item.stage);
  };
  const openEventFromLive=()=>{
    scrollVenueMapIntoView({force:true});
    openEventMapPopup(ev);
  };
  const row=document.createElement("div");
  row.className="live-item";
  row.tabIndex=0;
  row.setAttribute("role","button");
  row.dataset.stage=item.stage;
  row.setAttribute("aria-label",`Vis ${ev.artist} på kartet`);

  const time=document.createElement("div");
  time.className="live-time";
  const timeValue=document.createElement("span");
  timeValue.className="live-time-value";
  timeValue.textContent=ev.time;
  time.appendChild(timeValue);
  // On mobile "om X min" sits under the time (CSS shows this one, hides the meta
  // copy) so "spiller snart" rows stay as compact as "spiller nå" rows. Desktop
  // shows the meta copy instead, so it looks exactly as before.
  if(type==="soon"&&item.startsInLabel){
    const startsTime=document.createElement("span");
    startsTime.className="live-starts live-starts-time";
    startsTime.textContent=item.startsInLabel;
    time.appendChild(startsTime);
  }

  const main=document.createElement("div");
  main.className="live-main";

  const artist=document.createElement("div");
  artist.className="live-artist";
  artist.textContent=ev.artist;

  const stage=document.createElement("button");
  stage.className="live-stage";
  stage.type="button";
  stage.textContent=item.stage;
  stage.setAttribute("aria-label",`Vis ${item.stage} på kartet`);
  stage.addEventListener("click",e=>{
    e.stopPropagation();
    openStageFromLive();
  });

  main.appendChild(artist);
  main.appendChild(stage);

  const meta=document.createElement("div");
  meta.className="live-meta";

  if(type==="soon"&&item.startsInLabel){
    const starts=document.createElement("div");
    starts.className="live-starts live-starts-meta";
    starts.textContent=item.startsInLabel;
    meta.appendChild(starts);
  }

  const distance=document.createElement("div");
  distance.className=`live-distance ${Number.isFinite(item.distance)?"":"pending"}`;
  distance.textContent=formatDistance(item.distance);

  const badge=document.createElement("span");
  badge.className=`gbadge g-${ev.genre}`;
  badge.textContent=GENRE_LABELS[ev.genre]||ev.genre;

  meta.appendChild(distance);
  meta.appendChild(badge);

  row.appendChild(time);
  row.appendChild(main);
  row.appendChild(meta);
  row.addEventListener("click",openEventFromLive);
  row.addEventListener("keydown",e=>{
    if(e.target!==row) return;
    handleKeyboardOpen(e,openEventFromLive);
  });
  return row;
}

function renderLiveList(listId,countId,items,type){
  const list=document.getElementById(listId);
  const count=document.getElementById(countId);
  list.innerHTML="";
  count.textContent=items.length?`${items.length}`:"0";

  if(!items.length){
    const empty=document.createElement("div");
    empty.className="live-empty";
    if(activeFavoritesOnly){
      empty.textContent="Ingen favoritter i denne listen.";
    }else if(type==="now"&&festivalClock().mode==="before"){
      empty.innerHTML='Festivalen har ikke startet enda, ønsker du å se hvordan det vil se ut underveis i festivalen? <a class="live-empty-link" href="?now=13:46&amp;location=schous-plass#kart">Trykk her</a>';
    }else{
      empty.textContent=type==="now"
        ? "Ingen registrerte innslag akkurat nå."
        : "Ingen kommende innslag i programmet.";
    }
    list.appendChild(empty);
    return;
  }

  items.forEach(item=>list.appendChild(createLiveItem(item,type)));
}

function updateLocationStatus(){
  syncMapFab();
  const status=document.getElementById("locationStatus");
  const button=document.getElementById("locateBtn");
  button.disabled=locationState==="loading";
  status.hidden=false;

  if(locationState==="loading"){
    button.textContent="Henter posisjon";
    status.textContent="Ber nettleseren om lokasjonstillatelse.";
  }else if(locationState==="granted"){
    button.textContent="Oppdater posisjon";
    status.textContent="";
    status.hidden=true;
  }else if(locationState==="denied"){
    button.textContent="Prøv igjen";
    status.textContent="Lokasjon ble ikke tillatt. Listene sorteres etter tid.";
  }else if(locationState==="error"){
    button.textContent="Prøv igjen";
    status.textContent="Kunne ikke hente posisjon. Listene sorteres etter tid.";
  }else{
    button.textContent="Bruk min posisjon";
    status.textContent="";
    status.hidden=true;
  }
}

function applyUserLocation(loc,{fly=true}={}){
  userLocation={
    lat:loc.lat,
    lng:loc.lng,
    accuracy:loc.accuracy,
  };
  locationState="granted";
  updateUserMarker(fly);
  renderMapView();
}

function requestUserLocation(){
  locationRequested=true;
  if(screenshotLocation){
    locationState="loading";
    renderMapView();
    const applyFakeLocation=()=>applyUserLocation(screenshotLocation,{fly:false});
    if(venueMap&&!mapLoaded) venueMap.once("load",applyFakeLocation);
    else requestAnimationFrame(applyFakeLocation);
    return;
  }

  if(!navigator.geolocation){
    locationState="error";
    renderMapView();
    return;
  }

  locationState="loading";
  renderMapView();
  navigator.geolocation.getCurrentPosition(pos=>{
    applyUserLocation({
      lat:pos.coords.latitude,
      lng:pos.coords.longitude,
      accuracy:pos.coords.accuracy,
    });
  },err=>{
    locationState=err.code===1?"denied":"error";
    renderMapView();
  },{
    enableHighAccuracy:true,
    timeout:12000,
    maximumAge:30000,
  });
}

function locateAndCenter(){
  // A manual tap on the locate button should always recenter the map on the
  // user. Recenter on the known position immediately (this also covers preview/
  // ?location mode, where a fresh request deliberately doesn't fly), then refresh.
  if(userLocation) updateUserMarker(true);
  requestUserLocation();
}

function initVenueMap(){
  if(venueMap) return;
  const mapEl=document.getElementById("venueMap");
  if(!window.maplibregl){
    mapEl.innerHTML='<div class="empty">Kartbiblioteket kunne ikke lastes.</div>';
    return;
  }

  venueMapStyle=currentMapStyleUrl();
  venueMap=new maplibregl.Map({
    container:mapEl,
    style:venueMapStyle,
    center:OSLO_CENTER,
    zoom:11,
    attributionControl:false,
  });
  window.musikkfestMap=venueMap;
  venueMap.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-right");
  venueMap.on("load",()=>{
    mapLoaded=true;
    venueMapStyleLoaded=true;
    refreshVenueMapOverlays();
  });
  venueMap.on("style.load",()=>{
    venueMapStyleLoaded=true;
    scheduleVenueMapOverlayRefresh();
  });
  venueMap.on("idle",()=>{
    if(!venueMap.getSource("venues")||!venueMap.getLayer("venue-dots")){
      scheduleVenueMapOverlayRefresh();
    }
    if(userLocation&&!venueMap.getLayer("user-dot")){
      updateUserMarker(false);
    }
  });
}

function stagePopupHtml(stage,snapshot){
  const current=snapshot?.current;
  const next=snapshot?.next;
  const eventLine=(label,ev)=>ev
    ? `<div class="popup-event-line"><span class="popup-prefix">${label}:</span><span class="popup-event-time">${escapeHtml(ev.time)}</span><button class="popup-event-artist" type="button" data-event-detail-id="${escapeHtml(ev.id)}">${escapeHtml(ev.artist)}</button></div>`
    : `<div class="popup-line"><span class="popup-prefix">${label}:</span> ${label==="Nå"?"ingen registrert":"ingen flere"}</div>`;
  const distanceText=Number.isFinite(snapshot?.distance)?`Avstand: ${formatDistance(snapshot.distance)}`:"";
  return `<div class="popup-stage-card"><div class="popup-stage">${escapeHtml(stage)}</div>${stageMapInfoHtml(stage)}${eventLine("Nå",current)}${eventLine("Snart",next)}${distanceText?`<div class="popup-line">${distanceText}</div>`:""}</div>`;
}

function popupTextWithBreaks(value){
  return escapeHtml(value).replace(/\n/g,"<br>");
}

function stageMapInfoHtml(stage){
  const loc=STAGE_LOCATIONS[stage]||{};
  const meta=STAGE_MAP_INFO[stage]||{};
  const address=String(meta.address||loc.query||"").trim();
  const info=String(meta.info||"").trim();
  if(!address&&!info) return "";
  return `<div class="popup-stage-meta">${
    address?`<div class="popup-stage-address"><span class="popup-stage-address-label">Adresse:</span> <a class="popup-stage-address-link" href="${mapsAddressSearchUrl(address)}" target="_blank" rel="noopener">${escapeHtml(address)}</a></div>`:""
  }${
    info?`<div class="popup-stage-info-wrap"><div class="popup-stage-info">${popupTextWithBreaks(info)}</div><span class="popup-stage-scrollbar" aria-hidden="true"><span class="popup-stage-scrollbar-thumb"></span></span></div>`:""
  }</div>`;
}

function venueFeatureCollection(snapshots=scheduleSnapshots()){
  const snapshotsByStage=new Map(snapshots.map(item=>[item.stage,item]));
  return {
    type:"FeatureCollection",
    features:allStages.map(stage=>{
      const loc=STAGE_LOCATIONS[stage];
      const snapshot=snapshotsByStage.get(stage);
      if(!snapshot?.current&&!snapshot?.next) return null;
      if(!hasCoords(loc)) return null;
      return {
        type:"Feature",
        geometry:{type:"Point",coordinates:[loc.lng,loc.lat]},
        properties:{
          stage,
          status:snapshot?.current?"now":snapshot?.next?"soon":"idle",
        },
      };
    }).filter(Boolean),
  };
}

function addVenueLayers(){
  if(!venueMapStyleReady()) return;

  if(!venueMap.getSource("venues")){
    venueMap.addSource("venues",{type:"geojson",data:venueFeatureCollection()});
  }
  if(!venueMap.getLayer("venue-halo")){
    venueMap.addLayer({
      id:"venue-halo",
      type:"circle",
      source:"venues",
      paint:{
        "circle-radius":["match",["get","status"],"now",15,"soon",13,11],
        "circle-color":["match",["get","status"],"now","#d4522a","soon","#2a9d64","#2a6dd4"],
        "circle-opacity":["match",["get","status"],"now",0.22,"soon",0.18,0.14],
        "circle-stroke-width":0,
      },
    });
  }
  if(!venueMap.getLayer("venue-dots")){
    venueMap.addLayer({
      id:"venue-dots",
      type:"circle",
      source:"venues",
      paint:{
        "circle-radius":["match",["get","status"],"now",8,"soon",7,6],
        "circle-color":["match",["get","status"],"now","#d4522a","soon","#2a9d64","#2a6dd4"],
        "circle-stroke-color":"#ffffff",
        "circle-stroke-width":2,
        "circle-opacity":0.98,
      },
    });
  }

  // Ring drawn around the stage whose sheet is open (iOS "selected venue").
  if(!venueMap.getLayer("venue-selected")){
    venueMap.addLayer({
      id:"venue-selected",
      type:"circle",
      source:"venues",
      filter:["==",["get","stage"],"__nostage__"],
      paint:{
        "circle-radius":14,
        "circle-color":"rgba(0,0,0,0)",
        "circle-stroke-color":"#d4522a",
        "circle-stroke-width":3.5,
        "circle-stroke-opacity":0.95,
      },
    });
  }
  updateSelectedVenue();

  if(!venueLayerEventsBound){
    venueMap.on("click","venue-dots",e=>{
      const stage=e.features?.[0]?.properties?.stage;
      if(stage) openStagePopup(stage);
    });
    venueMap.on("mouseenter","venue-dots",()=>{venueMap.getCanvas().style.cursor="pointer";});
    venueMap.on("mouseleave","venue-dots",()=>{venueMap.getCanvas().style.cursor="";});
    venueLayerEventsBound=true;
  }

  updateVenueMarkers();
}

function updateVenueMarkers(snapshots=scheduleSnapshots()){
  if(!venueMapStyleReady()) return;
  const source=venueMap.getSource("venues");
  if(source) source.setData(venueFeatureCollection(snapshots));
}

function userFeatureCollection(){
  return {
    type:"FeatureCollection",
    features:userLocation?[{
      type:"Feature",
      geometry:{type:"Point",coordinates:[userLocation.lng,userLocation.lat]},
      properties:{label:"Du er her"},
    }]:[],
  };
}

function addUserLocationLayers(){
  if(!venueMapStyleReady()) return;
  if(!venueMap.getSource("user-location")){
    venueMap.addSource("user-location",{type:"geojson",data:userFeatureCollection()});
  }
  if(!venueMap.getLayer("user-pulse")){
    venueMap.addLayer({
      id:"user-pulse",
      type:"circle",
      source:"user-location",
      paint:{
        "circle-radius":30,
        "circle-color":"#f3b924",
        "circle-opacity":0.22,
        "circle-stroke-color":"#ffffff",
        "circle-stroke-width":2,
      },
    });
  }
  if(!venueMap.getLayer("user-halo")){
    venueMap.addLayer({
      id:"user-halo",
      type:"circle",
      source:"user-location",
      paint:{
        "circle-radius":17,
        "circle-color":"#f3b924",
        "circle-opacity":1,
        "circle-stroke-color":"#ffffff",
        "circle-stroke-width":3,
      },
    });
  }
  if(!venueMap.getLayer("user-dot")){
    venueMap.addLayer({
      id:"user-dot",
      type:"circle",
      source:"user-location",
      paint:{
        "circle-radius":8,
        "circle-color":"#111111",
        "circle-opacity":1,
        "circle-stroke-color":"#ffffff",
        "circle-stroke-width":2,
      },
    });
  }
  if(!venueMap.getLayer("user-label")){
    venueMap.addLayer({
      id:"user-label",
      type:"symbol",
      source:"user-location",
      layout:{
        "text-field":["get","label"],
        "text-size":13,
        "text-offset":[0,-2.2],
        "text-anchor":"bottom",
        "text-allow-overlap":true,
        "text-ignore-placement":true,
      },
      paint:{
        "text-color":"#111111",
        "text-halo-color":"#ffffff",
        "text-halo-width":2,
      },
    });
  }
  startUserPulse();
}

function startUserPulse(){
  if(userPulseFrame) return;
  const frame=timestamp=>{
    if(!venueMap||!venueMap.getLayer("user-pulse")){
      userPulseFrame=null;
      return;
    }
    // Skip the frame (but keep the loop alive) while the style is momentarily
    // unready, so a transient state never permanently kills the pulse.
    if(venueMapStyleReady()){
      const progress=(timestamp%1800)/1800;
      venueMap.setPaintProperty("user-pulse","circle-radius",24+progress*22);
      venueMap.setPaintProperty("user-pulse","circle-opacity",0.36*(1-progress));
    }
    userPulseFrame=requestAnimationFrame(frame);
  };
  userPulseFrame=requestAnimationFrame(frame);
}

function updateUserMarker(fly=true){
  if(!venueMap||!userLocation) return;
  if(!mapLoaded) return;
  if(!venueMapStyleReady()){
    // Only retry while the dot is still missing. Once it exists, the pulse's
    // per-frame paint updates keep isStyleLoaded() flapping, so rescheduling
    // here would spin a resize/refresh loop that makes the map hard to pan.
    if(!venueMap.getLayer("user-dot")) scheduleVenueMapOverlayRefresh(120);
    return;
  }
  const lngLat=[userLocation.lng,userLocation.lat];
  addUserLocationLayers();
  const source=venueMap.getSource("user-location");
  if(source) source.setData(userFeatureCollection());

  if(fly) venueMap.flyTo({center:lngLat,zoom:12.7,speed:.8,essential:true});
}

// ── STAGE SHEET (mobile) ──
// Full-height iOS-style bottom sheet replacing the map info-box on mobile.
let activeSheetStage=null;

function formatStageDistanceWalk(meters){
  if(!Number.isFinite(meters)) return "";
  const distStr=meters<950?`${Math.round(meters/10)*10} m`:`${(meters/1000).toFixed(1)} km`;
  const walkMin=Math.round(meters/80);
  return walkMin<=1?`${distStr} unna`:`${distStr} · ~${walkMin} min å gå`;
}

function stageEventGroups(stage,clock=festivalClock()){
  const events=(stageEvents.get(stage)||[]).slice().sort((a,b)=>a.min-b.min);
  const now=[],coming=[],done=[];
  events.forEach((ev,index)=>{
    if(clock.mode==="before"){coming.push(ev);return;}
    if(clock.mode==="after"){done.push(ev);return;}
    // Each act stays "now playing" until the next slot at the stage begins; the
    // last act of the day falls back to a fixed set length.
    const inferredEnd=events[index+1]?.min??ev.min+SET_DURATION_MIN;
    if(clock.min>=ev.min&&clock.min<inferredEnd) now.push(ev);
    else if(ev.min>clock.min) coming.push(ev);
    else done.push(ev);
  });
  return {now,coming,done};
}

const SHEET_WALK_ICON='<svg class="sheet-walk-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.6 5.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Zm-4 16.5 1.5-6.6-1.7-1.6L8 17.4l-1.9-.6 2-5.4c.3-.8 1-1.4 1.9-1.5l2.8-.3c.7-.1 1.4.2 1.8.8l1 1.4c.5.7 1.3 1.1 2.2 1.1v1.9c-1.4 0-2.7-.6-3.6-1.6l-.5 2.5 1.8 1.7L18.6 22h-2.1l-2-4.6-1.8-1.4L11.5 22Z"/></svg>';

function stageSheetRowHtml(ev){
  return `<button class="sheet-row" type="button" data-event-detail-id="${escapeHtml(ev.id)}" aria-label="Vis ${escapeHtml(ev.artist)}">`
    +`<span class="sheet-row-time">${escapeHtml(ev.time)}</span>`
    +`<span class="sheet-row-artist">${escapeHtml(ev.artist)}</span>`
    +`<span class="gbadge g-${escapeHtml(ev.genre)}">${escapeHtml(GENRE_LABELS[ev.genre]||ev.genre)}</span>`
    +`</button>`;
}

function stageSheetGroupHtml(title,events,{accent=false,dimmed=false}={}){
  if(!events.length) return "";
  return `<section class="sheet-group${accent?" accent":""}${dimmed?" dimmed":""}">`
    +`<div class="sheet-group-title">${escapeHtml(title)}</div>`
    +`<div class="sheet-group-list">${events.map(stageSheetRowHtml).join("")}</div>`
    +`</section>`;
}

function stageSheetHtml(stage){
  const clock=festivalClock();
  const loc=STAGE_LOCATIONS[stage]||{};
  const meta=STAGE_MAP_INFO[stage]||{};
  const address=String(meta.address||loc.query||"").trim();
  const info=String(meta.info||"").trim();
  const distance=distanceMeters(userLocation,loc);
  const groups=stageEventGroups(stage,clock);
  const navHref=hasCoords(loc)?directionsUrl(loc):(address?mapsAddressSearchUrl(address):"");
  const pinIcon='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.05 6.16 12.1 6.42 12.4a.76.76 0 0 0 1.16 0C13.84 21.1 20 14.05 20 9a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>';
  const arrowIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  const navCard=navHref?`<a class="sheet-nav" href="${escapeHtml(navHref)}" target="_blank" rel="noopener">`
    +`<span class="sheet-nav-icon">${pinIcon}</span>`
    +`<span class="sheet-nav-main"><span class="sheet-nav-address">${escapeHtml(address||"Åpne i kart")}</span><span class="sheet-nav-sub">Naviger hit</span></span>`
    +`<span class="sheet-nav-arrow">${arrowIcon}</span></a>`:"";
  const distHtml=Number.isFinite(distance)?`<div class="sheet-distance">${SHEET_WALK_ICON}<span>${escapeHtml(formatStageDistanceWalk(distance))}</span></div>`:"";
  const infoHtml=info?`<p class="sheet-info">${popupTextWithBreaks(info)}</p>`:"";
  const comingTitle=(!groups.now.length&&!groups.done.length)?"Program":"Kommende";
  const groupsHtml=stageSheetGroupHtml("Spiller nå",groups.now,{accent:true})
    +stageSheetGroupHtml(comingTitle,groups.coming)
    +stageSheetGroupHtml("Ferdig",groups.done,{dimmed:true});
  const emptyHtml=(!groups.now.length&&!groups.coming.length&&!groups.done.length)
    ?`<div class="sheet-empty">Ingen program registrert for denne scenen.</div>`:"";
  return navCard+distHtml+infoHtml+groupsHtml+emptyHtml;
}

function updateSelectedVenue(){
  if(venueMap?.getLayer?.("venue-selected")){
    venueMap.setFilter("venue-selected",["==",["get","stage"],activeSheetStage||"__nostage__"]);
  }
}

// Centre the selected stage in the strip of map left visible above the medium
// sheet, then ring it.
function flyToStageOnSheet(stage){
  const loc=STAGE_LOCATIONS[stage];
  if(!venueMap||!hasCoords(loc)) return;
  if(!mapLoaded){ venueMap.once("load",()=>flyToStageOnSheet(stage)); return; }
  venueMap.flyTo({center:[loc.lng,loc.lat],zoom:14.5,offset:[0,-40],speed:.9,essential:true});
  updateSelectedVenue();
}

// Size the medium sheet so its top edge sits exactly at the map's bottom — read
// from the live element so it's correct across PWA / browser chrome / screens.
function positionStageSheet(){
  const sheet=document.getElementById("stageSheet");
  const panel=sheet?.querySelector(".sheet");
  const map=document.getElementById("venueMap");
  if(!sheet||!panel||!map||!sheet.classList.contains("open")) return;
  if(!isMobileViewport()){ panel.style.height="";panel.style.maxHeight="";return; }
  const mapBottom=map.getBoundingClientRect().bottom;
  const h=Math.max(160,Math.round(window.innerHeight-mapBottom));
  panel.style.height=h+"px";
  panel.style.maxHeight=h+"px";
}

function openStageSheet(stage,{updateUrl=true,replaceUrl=false}={}){
  const sheet=document.getElementById("stageSheet");
  if(!sheet) return;
  if(updateUrl) setStageRoute(stage,{replace:replaceUrl});
  else setStageMeta(stage);
  activeSheetStage=stage;
  document.getElementById("stageSheetTitle").textContent=stage;
  const body=document.getElementById("stageSheetBody");
  body.innerHTML=stageSheetHtml(stage);
  body.scrollTop=0;
  sheet.classList.add("open");
  sheet.setAttribute("aria-hidden","false");
  positionStageSheet();
  requestAnimationFrame(positionStageSheet);
  // Medium-detent sheet: the map stays visible & interactive above it, so we do
  // NOT lock page scroll. Fly to the stage and ring it on the map.
  flyToStageOnSheet(stage);
  document.getElementById("stageSheetClose").focus({preventScroll:true});
}

function refreshStageSheet(){
  const sheet=document.getElementById("stageSheet");
  if(activeSheetStage&&sheet?.classList.contains("open")){
    document.getElementById("stageSheetBody").innerHTML=stageSheetHtml(activeSheetStage);
  }
}

function closeStageSheet({updateUrl=true}={}){
  const sheet=document.getElementById("stageSheet");
  if(!sheet) return;
  sheet.classList.remove("open");
  sheet.setAttribute("aria-hidden","true");
  activeSheetStage=null;
  updateSelectedVenue();
  if(updateUrl){
    setUrl(rootViewUrl(activeView),{replace:true});
    resetMeta();
  }
}

function openStagePopup(stage,{updateUrl=false,replaceUrl=false}={}){
  if(isMobileViewport()){
    openStageSheet(stage,{updateUrl,replaceUrl});
    return;
  }
  const loc=STAGE_LOCATIONS[stage];
  if(!venueMap||!mapLoaded||!hasCoords(loc)) return;
  if(updateUrl) setStageRoute(stage,{replace:replaceUrl});
  else setStageMeta(stage);
  const snapshot=scheduleSnapshots().find(item=>item.stage===stage);
  if(!venuePopup) venuePopup=new maplibregl.Popup({offset:16,maxWidth:"360px"});
  venuePopup
    .setLngLat([loc.lng,loc.lat])
    .setHTML(stagePopupHtml(stage,snapshot))
    .addTo(venueMap);
  labelMapPopupCloseButton();
  syncPopupDescriptionScroll();
}

function focusStage(stage,{updateUrl=true,replaceUrl=false}={}){
  if(isMobileViewport()){
    openStageSheet(stage,{updateUrl,replaceUrl});
    return;
  }
  const loc=STAGE_LOCATIONS[stage];
  if(!venueMap||!hasCoords(loc)) return;
  if(!mapLoaded){
    venueMap.once("load",()=>focusStage(stage,{updateUrl,replaceUrl}));
    return;
  }
  if(updateUrl) setStageRoute(stage,{replace:replaceUrl});
  else setStageMeta(stage);
  scrollVenueMapIntoView({force:true});
  flyToVenuePopup(loc);
  openStagePopup(stage,{updateUrl:false});
}

// ── MOBILE KART CONTROLS ──
// Mobile (≤640px) shows one live list at a time behind a segmented toggle and
// floats glass map controls; desktop ignores all of this (elements are hidden
// by CSS above the breakpoint and these syncs only touch their state).
let mobileLiveTab="now";
function setMobileLiveTab(tab){
  if(tab!=="now"&&tab!=="soon") return;
  mobileLiveTab=tab;
  syncMobileLiveTab();
  syncLiveEmptyState();
}
function syncMobileLiveTab(){
  const scroll=document.querySelector(".live-scroll");
  if(scroll) scroll.dataset.liveTab=mobileLiveTab;
  document.querySelectorAll(".live-toggle-btn").forEach(button=>{
    const active=button.dataset.liveTab===mobileLiveTab;
    button.classList.toggle("active",active);
    button.setAttribute("aria-selected",String(active));
  });
}
// On mobile the Kart tab scrolls as the normal document. When the active live
// list is empty (only the placeholder shows) we tag the body so CSS can stop
// the short content from leaving a tall phantom scroll area under the map.
function syncLiveEmptyState(){
  const scroll=document.querySelector(".live-scroll");
  if(!scroll){document.body.classList.remove("live-empty-mobile");return;}
  const listId=scroll.dataset.liveTab==="soon"?"soonList":"nowList";
  const list=document.getElementById(listId);
  const empty=!!list&&!!list.querySelector(".live-empty");
  document.body.classList.toggle("live-empty-mobile",empty);
}
function syncMapFab(){
  const stack=document.getElementById("mapFabStack");
  if(stack) stack.classList.toggle("has-active",hasActiveFilters());
  const locate=document.getElementById("mapLocateFab");
  if(locate){
    locate.classList.toggle("is-loading",locationState==="loading");
    locate.classList.toggle("is-active",locationState==="granted");
    locate.disabled=locationState==="loading";
  }
}

function renderMapView(){
  const clock=festivalClock();
  syncSoonModeButtons();
  syncMobileLiveTab();
  updateFestivalOverModal();
  document.getElementById("mapClock").textContent=clock.label;
  updateLocationStatus();

  const snapshots=scheduleSnapshots(clock);
  const nowItems=snapshots
    .filter(item=>item.current)
    .sort((a,b)=>sortByDistanceThenTime(a,b,"now"));
  // With specific scene(s) selected, show every upcoming concert at those
  // scenes; otherwise keep the one-per-stage "next up near me" overview.
  const soonSource=activeStagesExplicit
    ? snapshots.flatMap(item=>
        upcomingStageEvents(item.stage,clock).map(ev=>({...item,next:ev})))
    : snapshots.filter(item=>item.next);
  const soonItems=sortSoonItems(soonSource
    .map(item=>({
      ...item,
      startsIn:minutesUntil(item.next,clock),
      startsInLabel:formatStartsIn(item.next,clock),
    })),clock);

  renderLiveList("nowList","nowCount",nowItems,"now");
  renderLiveList("soonList","soonCount",soonItems,"soon");
  syncLiveEmptyState();
  updateVenueMarkers(snapshots);
  updateUserMarker(false);
  refreshStageSheet();
}

function setView(view,{askLocation=false,updateHash=true}={}){
  activeView=view;
  if(updateHash) resetMeta();
  document.body.classList.toggle("map-active",view==="map");
  document.body.classList.toggle("favorites-active",view==="favorites");

  document.querySelectorAll(".view-panel").forEach(panel=>{
    const activePanelId=view==="map"?"mapView":view==="favorites"?"favoritesView":"programView";
    const isActive=panel.id===activePanelId;
    panel.classList.toggle("active",isActive);
  });
  document.querySelectorAll(".view-tab").forEach(tab=>{
    const isActive=tab.dataset.view===view;
    tab.classList.toggle("active",isActive);
    tab.setAttribute("aria-selected",String(isActive));
  });

  if(updateHash){
    setUrl(rootViewUrl(view),{replace:true});
  }

  if(view==="map"){
    document.body.classList.remove("chips-visible");
    initVenueMap();
    if(screenshotLocation&&!userLocation&&!locationRequested) requestUserLocation();
    renderMapView();
    requestAnimationFrame(()=>venueMap?.resize());
    if(askLocation&&!locationRequested) requestUserLocation();
  }else if(view==="favorites"){
    document.body.classList.remove("chips-visible");
    renderFavoritesView();
  }else{
    renderChips();
    if(programViewMode==="time") requestAnimationFrame(()=>updateProgramNowLine({scroll:true}));
  }
}
