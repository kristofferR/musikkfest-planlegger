// Concatenated by scripts/build.mjs. Keep files ordered by numeric prefix.
function favoriteListIsSynced(){
  const code=favoriteShareCode();
  return !!(code&&favoriteListSlug&&favoriteListSyncedCode===code&&favoriteListSyncedName===favoriteListName);
}

function updateFavoriteNameUi(){
  const source=currentFavoriteSource();
  const input=document.getElementById("favoriteListName");
  if(input&&document.activeElement!==input) input.value=favoriteListName;
  const title=document.getElementById("favoritesTitle");
  if(title) title.textContent=currentFavoriteListName();
  const kicker=document.querySelector(".favorites-kicker");
  if(kicker) kicker.textContent=source==="shared"?"Mottatt liste":"Min liste";
  const nameWrap=document.querySelector(".favorite-name-wrap");
  if(nameWrap) nameWrap.style.display=source==="shared"?"none":"block";
  const shareTitle=document.getElementById("favoriteShareTitle");
  if(shareTitle) shareTitle.textContent=source==="shared"?"Del mottatt liste":"Del favorittlisten";
  document.querySelectorAll("[data-favorite-source]").forEach(button=>{
    const active=button.dataset.favoriteSource===source;
    button.classList.toggle("active",active);
    button.setAttribute("aria-selected",String(active));
  });
  const sourceTabs=document.getElementById("favoriteSourceTabs");
  sourceTabs?.classList.toggle("visible",hasSharedFavoriteList());
  const banner=document.getElementById("receivedListBanner");
  banner?.classList.toggle("visible",source==="shared");
  const message=document.getElementById("receivedListMessage");
  if(message&&sharedFavoriteList){
    message.textContent=`Du ser ${sharedFavoriteList.name}. Den endrer ikke dine egne favoritter.`;
  }
}

async function syncFavoriteListNow({quiet=false}={}){
  const code=favoriteShareCode();
  if(!code) return null;
  if(favoriteListIsSynced()) return {url:favoriteShareUrl(),slug:favoriteListSlug};
  const requestName=favoriteListName;
  const requestKey=`${requestName}\n${code}`;
  if(favoriteListSyncPromise&&favoriteListSyncRequestKey===requestKey) return favoriteListSyncPromise;
  const seq=++favoriteListSyncSeq;
  if(!quiet) setShareStatus("Lagrer fast URL...");
  favoriteListSyncRequestKey=requestKey;
  favoriteListSyncPromise=fetch(FAVORITE_LIST_API_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({token:favoriteListToken,name:requestName,f:code})
  })
    .then(async response=>{
      const payload=await response.json().catch(()=>null);
      if(!response.ok||!payload?.ok) throw new Error(payload?.error||"save_failed");
      if(requestName!==favoriteListName||code!==favoriteShareCode()){
        scheduleFavoriteListSync(120);
        return payload;
      }
      if(seq<favoriteListSyncSeq) return payload;
      favoriteListToken=payload.token||favoriteListToken;
      favoriteListSlug=payload.slug||favoriteListSlug;
      favoriteListName=cleanFavoriteListName(payload.name||favoriteListName);
      favoriteListSyncedCode=payload.f||code;
      favoriteListSyncedName=favoriteListName;
      saveFavoriteListState();
      updateFavoriteNameUi();
      updateFavoriteShareLinks({skipSync:true});
      requestAnimationFrame(drawFavoriteShareImage);
      if(!quiet) setShareStatus(`Fast URL lagret: ${favoriteShareDisplayUrl()}`);
      return payload;
    })
    .catch(error=>{
      if(!quiet) setShareStatus("Kunne ikke lagre fast URL akkurat nå.");
      throw error;
    })
    .finally(()=>{
      if(favoriteListSyncRequestKey===requestKey){
        favoriteListSyncPromise=null;
        favoriteListSyncRequestKey="";
      }
    });
  return favoriteListSyncPromise;
}

function scheduleFavoriteListSync(delay=800){
  if(!favoriteShareCode()) return;
  if(favoriteListIsSynced()) return;
  clearTimeout(favoriteListSyncTimer);
  favoriteListSyncTimer=setTimeout(()=>syncFavoriteListNow({quiet:true}).catch(()=>{}),delay);
}

function updateFavoriteShareLinks({skipSync=false}={}){
  updateFavoriteNameUi();
  const url=currentFavoriteShareUrl();
  const text=currentFavoriteShareText();
  const message=buildShareMessage(text,url);
  const encodedUrl=encodeURIComponent(url);
  const encodedMessage=encodeURIComponent(message);
  const whatsapp=document.getElementById("shareWhatsApp");
  document.getElementById("favoriteShareUrl").value=url;
  document.getElementById("shareFacebook").href=`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  document.getElementById("shareMessenger").href=`fb-messenger://share/?link=${encodedUrl}&text=${encodedMessage}`;
  whatsapp.href=`https://wa.me/?text=${encodedMessage}`;
  whatsapp.dataset.appUrl=`whatsapp://send?text=${encodedMessage}`;
  document.getElementById("shareSnapchat").href=`https://www.snapchat.com/share?link=${encodedUrl}`;
  document.getElementById("shareEmail").href=`mailto:?subject=${encodeURIComponent("Musikkfest 2026 - favoritter")}&body=${encodedMessage}`;
  document.getElementById("shareSms").href=`sms:?&body=${encodedMessage}`;
  if(!skipSync&&currentFavoriteSource()==="mine") scheduleFavoriteListSync();
}

async function shareFavoriteUrl(target=""){
  await ensureCurrentFavoriteListShareReady({quiet:false}).catch(()=>{});
  const url=currentFavoriteShareUrl();
  const text=currentFavoriteShareText();
  if(navigator.share){
    try{
      await navigator.share({title:"Musikkfest 2026 - favoritter",text,url});
      setShareStatus(target?`Åpnet deling for ${target}.`:"Deling åpnet.");
      return;
    }catch(err){
      if(err?.name==="AbortError") return;
    }
  }
  await copyText(buildShareMessage(text,url));
  setShareStatus(target?`Tekst og lenke kopiert for ${target}.`:"Tekst og lenke kopiert.");
}

function drawRoundRect(ctx,x,y,w,h,r){
  if(ctx.roundRect){
    ctx.beginPath();
    ctx.roundRect(x,y,w,h,r);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.fill();
}

function fitText(ctx,text,maxWidth){
  if(ctx.measureText(text).width<=maxWidth) return text;
  let value=text;
  while(value.length>1&&ctx.measureText(`${value}...`).width>maxWidth){
    value=value.slice(0,-1);
  }
  return `${value}...`;
}

function roundedRectPath(ctx,x,y,w,h,r){
  ctx.beginPath();
  if(ctx.roundRect){
    ctx.roundRect(x,y,w,h,r);
    return;
  }
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
}

let shareMapImage=null;
let shareMapImagePromise=null;
let shareTitleFontRequested=false;
let shareFontsPromise=null;

function loadShareFonts(){
  if(!document.fonts?.load) return Promise.resolve();
  if(!shareFontsPromise){
    shareFontsPromise=Promise.all([
      document.fonts.load(`600 72px ${SHARE_TITLE_FONT}`),
      document.fonts.load("500 40px 'DM Sans'"),
      document.fonts.load("500 34px 'DM Sans'"),
      document.fonts.load("28px 'DM Mono'"),
    ]);
  }
  return shareFontsPromise;
}

function configureShareContext(ctx){
  ctx.imageSmoothingEnabled=true;
  if("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality="high";
  if("fontKerning" in ctx) ctx.fontKerning="normal";
  if("textRendering" in ctx) ctx.textRendering="geometricPrecision";
}

function loadShareMapImage(){
  if(shareMapImage?.complete&&shareMapImage.naturalWidth) return Promise.resolve(shareMapImage);
  if(!shareMapImagePromise){
    shareMapImage=new Image();
    shareMapImage.decoding="async";
    shareMapImagePromise=new Promise((resolve,reject)=>{
      shareMapImage.onload=()=>resolve(shareMapImage);
      shareMapImage.onerror=reject;
    });
    shareMapImage.src=SHARE_MAP_IMAGE_SRC;
  }
  return shareMapImagePromise;
}

function drawImageCover(ctx,img,x,y,w,h){
  const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight);
  const sw=w/scale;
  const sh=h/scale;
  const sx=(img.naturalWidth-sw)/2;
  const sy=(img.naturalHeight-sh)/2;
  ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);
}

function drawShareMapInset(ctx,x,y,w,h){
  ctx.save();
  roundedRectPath(ctx,x,y,w,h,22);
  ctx.clip();
  if(shareMapImage?.complete&&shareMapImage.naturalWidth){
    drawImageCover(ctx,shareMapImage,x,y,w,h);
  }else{
    ctx.fillStyle="#f3efe6";
    ctx.fillRect(x,y,w,h);
    ctx.fillStyle="#dcebd5";
    drawRoundRect(ctx,x+18,y+16,w-36,h-32,18);
    loadShareMapImage().then(()=>requestAnimationFrame(drawFavoriteShareImage)).catch(()=>{});
  }
  ctx.restore();

  ctx.strokeStyle="rgba(26,24,20,.08)";
  ctx.lineWidth=2;
  roundedRectPath(ctx,x,y,w,h,22);
  ctx.stroke();
}

function drawFavoriteShareImage(){
  const canvas=document.getElementById("favoriteShareCanvas");
  if(!canvas) return;
  if(!shareTitleFontRequested){
    shareTitleFontRequested=true;
    loadShareFonts().then(()=>requestAnimationFrame(drawFavoriteShareImage)).catch(()=>{});
  }
  const ctx=canvas.getContext("2d");
  configureShareContext(ctx);
  const events=favoriteEvents(currentFavoriteSource());
  const listName=currentFavoriteListName();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle="#1a1814";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.fillStyle="#f5f3ee";
  drawRoundRect(ctx,48,48,984,1254,30);

  ctx.fillStyle="#1a1814";
  ctx.font=`600 72px ${SHARE_TITLE_FONT}`;
  ctx.fillText("Musikkfest 2026",86,132);
  ctx.font="500 40px 'DM Sans', sans-serif";
  ctx.fillText(fitText(ctx,listName,560),90,188);
  ctx.font="28px 'DM Mono', monospace";
  ctx.fillStyle="#6b6760";
  ctx.fillText(events.length?`${events.length} favoritter`:"Ingen favoritter ennå",90,244);

  drawShareMapInset(ctx,682,82,320,180);

  const visible=events.slice(0,20);
  const startY=326;
  const bottomY=1202;
  const rowGap=8;
  const oneColumnFits=visible.length<=10;
  const columns=oneColumnFits?1:2;
  const rowsPerColumn=Math.ceil(visible.length/columns);
  const rowHeight=Math.floor((bottomY-startY-(rowsPerColumn-1)*rowGap)/Math.max(rowsPerColumn,1));
  const leftX=86;
  const columnGap=36;
  const columnWidth=columns===1?888:426;
  const timeWidth=columns===1?118:96;
  const artistFont=columns===1?32:23;
  const stageFont=columns===1?24:18;
  const timeFont=columns===1?28:18;

  if(!visible.length){
    ctx.fillStyle="#ffffff";
    drawRoundRect(ctx,leftX,startY,888,150,22);
    ctx.fillStyle="#6b6760";
    ctx.font="500 34px 'DM Sans', sans-serif";
    ctx.fillText("Trykk stjerne i programmet for å bygge listen.",116,startY+84);
  }
  visible.forEach((ev,index)=>{
    const col=columns===1?0:index>=rowsPerColumn?1:0;
    const row=columns===1?index:index%rowsPerColumn;
    const x=leftX+col*(columnWidth+columnGap);
    const y=startY+row*(rowHeight+rowGap);
    const mainX=x+timeWidth;
    const mainWidth=columnWidth-timeWidth-18;
    ctx.fillStyle=index%2===0?"#ffffff":"#faf9f7";
    drawRoundRect(ctx,x,y,columnWidth,rowHeight,14);
    ctx.fillStyle="#a8a49e";
    ctx.font=`${timeFont}px 'DM Mono', monospace`;
    ctx.fillText(ev.time,x+16,y+Math.round(rowHeight*.58));
    ctx.fillStyle="#1a1814";
    ctx.font=`500 ${artistFont}px 'DM Sans', sans-serif`;
    ctx.fillText(fitText(ctx,ev.artist,mainWidth),mainX,y+Math.round(rowHeight*.45));
    ctx.fillStyle="#6b6760";
    ctx.font=`${stageFont}px 'DM Sans', sans-serif`;
    ctx.fillText(fitText(ctx,ev.stage,mainWidth),mainX,y+Math.round(rowHeight*.73));
  });
  if(events.length>visible.length){
    ctx.fillStyle="#6b6760";
    ctx.font="500 26px 'DM Sans', sans-serif";
    ctx.fillText(`+ ${events.length-visible.length} til i lenken`,86,1230);
  }

  ctx.fillStyle="#1a1814";
  ctx.font="500 30px 'DM Sans', sans-serif";
  ctx.fillText(fitText(ctx,currentFavoriteShareDisplayUrl(),888),86,1260);
}

function canvasToBlob(canvas){
  return new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
}

async function downloadFavoriteImage(){
  await ensureCurrentFavoriteListShareReady({quiet:false}).catch(()=>{});
  await Promise.all([loadShareMapImage().catch(()=>null),loadShareFonts().catch(()=>null)]);
  drawFavoriteShareImage();
  const canvas=document.getElementById("favoriteShareCanvas");
  const blob=await canvasToBlob(canvas);
  if(!blob) return;
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download="musikkfest-oslo-2026-favoritter.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setShareStatus("Bildet er lastet ned.");
}

async function shareFavoriteImage(){
  await ensureCurrentFavoriteListShareReady({quiet:false}).catch(()=>{});
  await Promise.all([loadShareMapImage().catch(()=>null),loadShareFonts().catch(()=>null)]);
  drawFavoriteShareImage();
  const canvas=document.getElementById("favoriteShareCanvas");
  const blob=await canvasToBlob(canvas);
  if(!blob) return;
  const file=new File([blob],"musikkfest-oslo-2026-favoritter.png",{type:"image/png"});
  if(navigator.canShare?.({files:[file]})){
    try{
      await navigator.share({title:"Musikkfest-favoritter",text:currentFavoriteShareMessage(),files:[file]});
      setShareStatus("Bilde-deling åpnet.");
      return;
    }catch(err){
      if(err?.name==="AbortError") return;
    }
  }
  await downloadFavoriteImage();
}

function renderFavoritesView(){
  const list=document.getElementById("favoritesList");
  if(!list) return;
  const source=currentFavoriteSource();
  const events=favoriteEvents(source);
  document.getElementById("favoritesCount").textContent=events.length
    ? source==="shared"?`${events.length} mottatt`:`${events.length} valgt`
    : "0 valgt";
  list.innerHTML="";
  if(!events.length){
    const empty=document.createElement("div");
    empty.className="favorites-empty";
    empty.textContent=source==="shared"?"Ingen innslag i den mottatte listen.":"Ingen favoritter ennå.";
    list.appendChild(empty);
  }else{
    events.forEach(ev=>{
      const row=document.createElement("div");
      row.className="favorite-share-row";
      row.tabIndex=0;
      row.setAttribute("role","button");
      row.setAttribute("aria-label",`Vis detaljer: ${ev.artist}`);
      const time=document.createElement("div");
      time.className="favorite-share-time";
      time.textContent=ev.time;
      const main=document.createElement("div");
      main.className="favorite-share-main";
      const artist=document.createElement("div");
      artist.className="favorite-share-artist";
      artist.textContent=ev.artist;
      const stage=document.createElement("div");
      stage.className="favorite-share-stage";
      stage.textContent=ev.stage;
      main.appendChild(artist);
      main.appendChild(stage);
      row.appendChild(time);
      row.appendChild(main);
      row.addEventListener("click",()=>openEventDetails(ev));
      row.addEventListener("keydown",e=>{
        if(e.target!==e.currentTarget) return;
        handleKeyboardOpen(e,()=>openEventDetails(ev));
      });
      if(source==="shared"){
        const copy=document.createElement("button");
        const alreadyMine=isFavorite(ev);
        copy.className=`favorite-copy-btn ${alreadyMine?"active":""}`.trim();
        copy.type="button";
        copy.textContent=alreadyMine?"★":"+";
        copy.setAttribute("aria-label",alreadyMine?`Ligger i mine favoritter: ${ev.artist}`:`Legg til mine favoritter: ${ev.artist}`);
        copy.addEventListener("click",e=>{
          e.stopPropagation();
          if(addFavoriteToMine(ev)){
            setShareStatus(`La til ${ev.artist} i mine favoritter.`);
          }
          render();
        });
        row.appendChild(copy);
      }else{
        const fav=document.createElement("button");
        fav.className="favorite-remove-btn";
        fav.type="button";
        fav.textContent="×";
        fav.setAttribute("aria-label",`Fjern favoritt: ${ev.artist}`);
        fav.addEventListener("click",e=>{
          e.stopPropagation();
          toggleFavorite(ev);
        });
        row.appendChild(fav);
      }
      list.appendChild(row);
    });
  }
  updateFavoriteShareLinks();
  requestAnimationFrame(drawFavoriteShareImage);
}
