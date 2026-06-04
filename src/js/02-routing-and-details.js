// Concatenated by scripts/build.mjs. Keep files ordered by numeric prefix.
function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,ch=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
}

function lockPageScroll(owner){
  if(owner?.dataset.pageScrollLocked==="true") return;
  if(owner) owner.dataset.pageScrollLocked="true";
  if(pageScrollLockCount===0){
    const scrollY=window.scrollY||document.documentElement.scrollTop||0;
    pageScrollLockState={
      scrollY,
      bodyPosition:document.body.style.position,
      bodyTop:document.body.style.top,
      bodyLeft:document.body.style.left,
      bodyRight:document.body.style.right,
      bodyWidth:document.body.style.width,
    };
    document.documentElement.classList.add("page-scroll-locked");
    document.body.classList.add("page-scroll-locked");
    document.body.style.position="fixed";
    document.body.style.top=`-${scrollY}px`;
    document.body.style.left="0";
    document.body.style.right="0";
    document.body.style.width="100%";
  }
  pageScrollLockCount+=1;
}

function unlockPageScroll(owner){
  if(owner&&owner.dataset.pageScrollLocked!=="true") return;
  if(owner) delete owner.dataset.pageScrollLocked;
  pageScrollLockCount=Math.max(0,pageScrollLockCount-1);
  if(pageScrollLockCount>0) return;

  const state=pageScrollLockState;
  document.documentElement.classList.remove("page-scroll-locked");
  document.body.classList.remove("page-scroll-locked");
  document.body.style.position=state?.bodyPosition||"";
  document.body.style.top=state?.bodyTop||"";
  document.body.style.left=state?.bodyLeft||"";
  document.body.style.right=state?.bodyRight||"";
  document.body.style.width=state?.bodyWidth||"";
  window.scrollTo(0,state?.scrollY||0);
  pageScrollLockState=null;
}

function currentAppBasePath(){
  const path=window.location.pathname;
  const index=path.indexOf(APP_ROUTE_PREFIX);
  if(index!==-1) return path.slice(0,index+APP_ROUTE_PREFIX.length);
  if(/\.html?$/i.test(path)) return path;
  return APP_ROUTE_PREFIX;
}

function rootViewUrl(view=activeView){
  const hash=view==="map"?"#kart":view==="favorites"?"#favoritter":"";
  return `${window.location.origin}${currentAppBasePath()}${window.location.search}${hash}`;
}

function publicStageUrl(stage){
  const stageSlug=stageSlugByName.get(stage)||slugifyRouteSegment(stage);
  return `${PUBLIC_APP_URL}${stageSlug}`;
}

function publicEventUrl(ev){
  const stageSlug=stageSlugByName.get(ev.stage)||slugifyRouteSegment(ev.stage);
  const artistSlug=eventSlugById.get(ev.id)||slugifyRouteSegment(ev.artist);
  return `${PUBLIC_APP_URL}${stageSlug}/${artistSlug}`;
}

function localStageUrl(stage){
  const stageSlug=stageSlugByName.get(stage)||slugifyRouteSegment(stage);
  return `${window.location.origin}${currentAppBasePath()}${stageSlug}`;
}

function localEventUrl(ev){
  const stageSlug=stageSlugByName.get(ev.stage)||slugifyRouteSegment(ev.stage);
  const artistSlug=eventSlugById.get(ev.id)||slugifyRouteSegment(ev.artist);
  return `${window.location.origin}${currentAppBasePath()}${stageSlug}/${artistSlug}`;
}

function setUrl(url,{replace=false}={}){
  if(!window.history?.pushState) return;
  const next=new URL(url,window.location.href).toString();
  if(next===window.location.href) return;
  history[replace?"replaceState":"pushState"]({musikkfest:true},"",next);
}

function updateMeta({title=DEFAULT_PAGE_TITLE,description=DEFAULT_PAGE_DESCRIPTION,url=PUBLIC_APP_URL}={}){
  document.title=title;
  const canonical=document.querySelector('link[rel="canonical"]');
  if(canonical) canonical.href=url;
  const values=[
    ['meta[name="description"]',"content",description],
    ['meta[property="og:title"]',"content",title],
    ['meta[property="og:description"]',"content",description],
    ['meta[property="og:url"]',"content",url],
    ['meta[name="twitter:title"]',"content",title],
    ['meta[name="twitter:description"]',"content",description],
  ];
  values.forEach(([selector,attr,value])=>document.querySelector(selector)?.setAttribute(attr,value));
}

function resetMeta(){
  updateMeta();
}

function setStageMeta(stage){
  updateMeta({
    title:`${stage} - Musikkfest 2026`,
    description:`Se kart, adresse og program for ${stage} under Musikkfest 2026.`,
    url:publicStageUrl(stage),
  });
}

function setEventMeta(ev){
  updateMeta({
    title:`${ev.artist} på ${ev.stage} - Musikkfest 2026`,
    description:`${ev.time} spiller ${ev.artist} på ${ev.stage} under Musikkfest 2026.`,
    url:publicEventUrl(ev),
  });
}

function routeSegmentsFromLocation(){
  const path=window.location.pathname;
  const index=path.indexOf(APP_ROUTE_PREFIX);
  if(index===-1) return [];
  const rest=path.slice(index+APP_ROUTE_PREFIX.length).replace(/^\/+|\/+$/g,"");
  if(!rest||rest.includes(".")) return [];
  return rest.split("/").map(part=>decodeURIComponent(part).toLowerCase());
}

function routeFromLocation(){
  const [stageSlug,artistSlug]=routeSegmentsFromLocation();
  if(!stageSlug) return null;
  const stage=stageNameBySlug.get(stageSlug);
  if(!stage) return null;
  if(artistSlug){
    const ev=eventByRouteSlug.get(`${stageSlug}/${artistSlug}`);
    if(ev) return {type:"event",stage,event:ev};
  }
  return {type:"stage",stage};
}

function setStageRoute(stage,{replace=false}={}){
  setUrl(localStageUrl(stage),{replace});
  setStageMeta(stage);
}

function setEventRoute(ev,{replace=false}={}){
  setUrl(localEventUrl(ev),{replace});
  setEventMeta(ev);
}

function eventDetails(ev){
  return EVENT_DETAILS[ev.objectId]||EVENT_DETAILS[ev.id]||{};
}

function eventImageUrl(ev){
  const imageUrl=String(eventDetails(ev).imageUrl||"").trim();
  return imageUrl===DEFAULT_ARTIST_IMAGE_URL?"":imageUrl;
}

function eventSourceUrl(ev){
  return eventDetails(ev).sourceUrl||`https://musikkfest.no/nb/program#slot=${encodeURIComponent(ev.objectId||ev.id)}`;
}

function artistSearchName(artist){
  return String(artist||"")
    .replace(/\s*\((?:live|dj-?set|konsert)\)\s*/ig," ")
    .replace(/\s+/g," ")
    .trim();
}

function googleArtistSearchUrl(artist){
  const requiredName=artistSearchName(artist)||String(artist||"").trim();
  const supportTerms="(spotify OR soundcloud OR bandcamp OR youtube OR instagram OR artist OR norge OR oslo)";
  return `https://www.google.com/search?q=${encodeURIComponent(`"${requiredName}" ${supportTerms}`)}`;
}

function formatDescription(text){
  const clean=String(text||"").trim();
  if(!clean) return '<div class="event-modal-empty">Ingen artisttekst registrert hos Musikkfest ennå.</div>';
  return clean.split(/\n{2,}/)
    .map(part=>`<p>${escapeHtml(part).replace(/\n/g,"<br>")}</p>`)
    .join("");
}

function syncEventModalFavorite(ev){
  const button=document.getElementById("eventModalFavorite");
  if(!button||!ev) return;
  const active=isFavorite(ev);
  button.textContent=active?"★":"☆";
  button.classList.toggle("active",active);
  button.setAttribute("aria-pressed",String(active));
  button.setAttribute("aria-label",`${active?"Fjern favoritt":"Legg til favoritt"}: ${ev.artist}`);
}

function findEventById(id){
  return data.find(item=>item.id===id||item.objectId===id||item.legacyId===id);
}

function openEventDetailsById(id){
  const ev=findEventById(id);
  if(!ev) return;
  if(activeView==="map"){
    openEventMapPopup(ev);
    return;
  }
  openEventDetails(ev);
}

function openEventDetails(ev,{updateUrl=true,replaceUrl=false}={}){
  activeDetailEvent=ev;
  if(updateUrl) setEventRoute(ev,{replace:replaceUrl});
  else setEventMeta(ev);
  const details=eventDetails(ev);
  const modal=document.getElementById("eventModal");
  const media=document.getElementById("eventModalMedia");
  const image=document.getElementById("eventModalImage");
  const stageButton=document.getElementById("eventModalStage");
  const googleButton=document.getElementById("eventModalGoogle");
  const description=document.getElementById("eventModalDescription");
  const imageUrl=eventImageUrl(ev);
  const hasStageMap=hasCoords(STAGE_LOCATIONS[ev.stage]);
  const imageLoadSeq=++eventModalImageLoadSeq;
  image.onload=null;
  image.onerror=null;
  image.removeAttribute("src");
  image.alt="";
  media.classList.remove("is-loading");
  modal.classList.toggle("no-media",!imageUrl);
  document.getElementById("eventModalMeta").textContent=`${ev.time} · ${GENRE_LABELS[ev.genre]||ev.genre}`;
  document.getElementById("eventModalTitle").textContent=ev.artist;
  stageButton.textContent=ev.stage;
  stageButton.disabled=!hasStageMap;
  stageButton.title=hasStageMap?"Vis scene på kartet":"";
  googleButton.href=googleArtistSearchUrl(ev.artist);
  googleButton.setAttribute("aria-label",`Søk på artist: ${ev.artist}`);
  syncEventModalFavorite(ev);
  description.innerHTML=formatDescription(details.description);
  description.scrollTop=0;
  document.getElementById("eventModalMap").style.display=hasStageMap?"inline-flex":"none";
  if(imageUrl){
    image.alt=ev.artist;
    media.style.display="block";
    media.classList.add("is-loading");
    image.onload=()=>{
      if(imageLoadSeq!==eventModalImageLoadSeq) return;
      media.classList.remove("is-loading");
      syncEventModalDescriptionScroll();
    };
    image.onerror=()=>{
      if(imageLoadSeq!==eventModalImageLoadSeq) return;
      media.classList.remove("is-loading");
      image.removeAttribute("src");
      image.alt="";
      media.style.display="none";
      modal.classList.add("no-media");
      syncEventModalDescriptionScroll();
    };
    requestAnimationFrame(()=>{
      if(imageLoadSeq===eventModalImageLoadSeq) image.src=imageUrl;
    });
  }else{
    media.style.display="none";
  }
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
  lockPageScroll(modal);
  syncEventModalDescriptionScroll();
  document.getElementById("eventModalClose").focus();
}

function eventMapPopupHtml(ev,snapshot){
  const details=eventDetails(ev);
  const imageUrl=eventImageUrl(ev);
  const distanceText=Number.isFinite(snapshot?.distance)?` · ${formatDistance(snapshot.distance)}`:"";
  const image=imageUrl?`<img class="popup-detail-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(ev.artist)}">`:"";
  const favoriteActive=isFavorite(ev);
  return `
    <div class="popup-detail">
      ${image}
      <div class="popup-detail-head">
        <div class="popup-detail-main">
          <div class="popup-detail-kicker">${escapeHtml(ev.time)} · ${escapeHtml(GENRE_LABELS[ev.genre]||ev.genre)}${escapeHtml(distanceText)}</div>
          <div class="popup-detail-title">${escapeHtml(ev.artist)}</div>
          <button class="popup-detail-stage" type="button" data-stage-popup-stage="${escapeHtml(ev.stage)}">${escapeHtml(ev.stage)}</button>
        </div>
        <button class="popup-detail-favorite ${favoriteActive?"active":""}" type="button" data-popup-favorite-event="${escapeHtml(ev.id)}" aria-pressed="${favoriteActive?"true":"false"}" aria-label="${favoriteActive?"Fjern favoritt":"Legg til favoritt"}: ${escapeHtml(ev.artist)}">${favoriteActive?"★":"☆"}</button>
      </div>
      <div class="popup-detail-description-wrap">
        <div class="popup-detail-description">${formatDescription(details.description)}</div>
        <span class="popup-detail-scrollbar" aria-hidden="true"><span class="popup-detail-scrollbar-thumb"></span></span>
      </div>
      <div class="popup-detail-actions">
        <button class="popup-detail-action primary" type="button" data-stage-popup-stage="${escapeHtml(ev.stage)}">Scenen</button>
        <a class="popup-detail-action" href="${escapeHtml(googleArtistSearchUrl(ev.artist))}" target="_blank" rel="noopener">Søk på artist</a>
      </div>
    </div>`;
}

const scrollSyncRegistry=new WeakMap();

function syncScrollableDescription(wrap,scroller,thumb,cssPrefix){
  if(!wrap||!scroller||!thumb) return;
  const existingUpdate=scrollSyncRegistry.get(wrap);
  if(existingUpdate){
    existingUpdate();
    return;
  }

  const update=()=>{
    const scrollable=scroller.scrollHeight>scroller.clientHeight+1;
    wrap.classList.toggle("is-scrollable",scrollable);
    if(!scrollable){
      wrap.classList.remove("is-at-bottom");
      wrap.style.removeProperty(`--${cssPrefix}-scrollbar-thumb-h`);
      wrap.style.removeProperty(`--${cssPrefix}-scrollbar-thumb-y`);
      return;
    }
    const trackHeight=Math.max(0,scroller.clientHeight-6);
    const thumbHeight=Math.max(18,Math.round(trackHeight*scroller.clientHeight/scroller.scrollHeight));
    const maxY=Math.max(0,trackHeight-thumbHeight);
    const scrollMax=Math.max(1,scroller.scrollHeight-scroller.clientHeight);
    const thumbY=Math.round(scroller.scrollTop/scrollMax*maxY);
    wrap.style.setProperty(`--${cssPrefix}-scrollbar-thumb-h`,`${thumbHeight}px`);
    wrap.style.setProperty(`--${cssPrefix}-scrollbar-thumb-y`,`${thumbY}px`);
    wrap.classList.toggle("is-at-bottom",scroller.scrollTop+scroller.clientHeight>=scroller.scrollHeight-2);
  };

  scrollSyncRegistry.set(wrap,update);
  const controller=new AbortController();
  let resizeObserver=null;
  let contentObserver=null;
  let lifecycleObserver=null;
  const cleanup=()=>{
    if(document.contains(wrap)) return;
    controller.abort();
    resizeObserver?.disconnect();
    contentObserver?.disconnect();
    lifecycleObserver?.disconnect();
    scrollSyncRegistry.delete(wrap);
  };

  scroller.addEventListener("scroll",update,{passive:true,signal:controller.signal});
  window.addEventListener("resize",update,{passive:true,signal:controller.signal});
  window.addEventListener("orientationchange",update,{passive:true,signal:controller.signal});

  if(typeof ResizeObserver!=="undefined"){
    resizeObserver=new ResizeObserver(update);
    resizeObserver.observe(wrap);
    resizeObserver.observe(scroller);
  }
  if(typeof MutationObserver!=="undefined"){
    contentObserver=new MutationObserver(update);
    contentObserver.observe(scroller,{childList:true,subtree:true,characterData:true});
    lifecycleObserver=new MutationObserver(cleanup);
    lifecycleObserver.observe(document.body,{childList:true,subtree:true});
  }

  update();
}

function syncPopupDescriptionScroll(){
  requestAnimationFrame(()=>{
    document.querySelectorAll(".popup-detail-description-wrap").forEach(wrap=>{
      const scroller=wrap.querySelector(".popup-detail-description");
      const thumb=wrap.querySelector(".popup-detail-scrollbar-thumb");
      syncScrollableDescription(wrap,scroller,thumb,"popup");
    });
  });
}

function syncEventModalDescriptionScroll(){
  requestAnimationFrame(()=>{
    const wrap=document.getElementById("eventModalDescriptionWrap");
    const scroller=document.getElementById("eventModalDescription");
    const thumb=wrap?.querySelector(".event-modal-scrollbar-thumb");
    syncScrollableDescription(wrap,scroller,thumb,"event-modal");
  });
}

function labelMapPopupCloseButton(){
  requestAnimationFrame(()=>{
    const close=document.querySelector(".maplibregl-popup-close-button");
    if(!close) return;
    close.setAttribute("aria-label","Lukk kart-popup");
    close.setAttribute("title","Lukk");
  });
}

function openEventMapPopup(ev,{updateUrl=true,replaceUrl=false}={}){
  const loc=STAGE_LOCATIONS[ev.stage];
  if(!venueMap||!hasCoords(loc)){
    openEventDetails(ev,{updateUrl,replaceUrl});
    return;
  }
  if(!mapLoaded){
    venueMap.once("load",()=>openEventMapPopup(ev,{updateUrl,replaceUrl}));
    return;
  }
  if(updateUrl) setEventRoute(ev,{replace:replaceUrl});
  else setEventMeta(ev);
  const snapshot=scheduleSnapshots().find(item=>item.stage===ev.stage);
  if(!venuePopup) venuePopup=new maplibregl.Popup({offset:16,maxWidth:"360px"});
  flyToVenuePopup(loc);
  venuePopup
    .setLngLat([loc.lng,loc.lat])
    .setHTML(eventMapPopupHtml(ev,snapshot))
    .addTo(venueMap);
  labelMapPopupCloseButton();
  syncPopupDescriptionScroll();
}

function closeEventDetails({updateUrl=true}={}){
  const modal=document.getElementById("eventModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden","true");
  unlockPageScroll(modal);
  activeDetailEvent=null;
  if(updateUrl){
    setUrl(rootViewUrl(activeView),{replace:true});
    resetMeta();
  }
}

function handleKeyboardOpen(event,callback){
  if(event.target.closest?.("button,a,input,select,textarea")) return;
  if(event.key==="Enter"||event.key===" "){
    event.preventDefault();
    callback();
  }
}
