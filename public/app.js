import { makeRegions, countyAt, mapPoint } from "/map-geometry.js";
const $ = (id) => document.getElementById(id);
const MEALS = ["不限","早餐","午餐","晚餐","消夜","點心"];
const CUISINES = ["不限","中式","西式","日式","韓式","泰式","義式","燒烤","排餐","火鍋","小吃","素食","海鮮","咖啡","甜點"];
const ORDER = ["台北市","新北市","基隆市","桃園市","新竹市","新竹縣","苗栗縣","台中市","彰化縣","南投縣","雲林縣","嘉義市","嘉義縣","台南市","高雄市","屏東縣","宜蘭縣","花蓮縣","台東縣","澎湖縣","金門縣","連江縣"];
const state = { county:"",town:"全區",price:"all",meal:"不限",cuisine:"不限",counties:[],timer:null,controller:null,lastKey:"" };

function node(tag,cls,txt) {
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(txt!==undefined)el.textContent=txt;
  return el;
}
function button(text,value,active,onClick) {
  const el=node("button",active?"active":"",text);
  el.type="button";
  el.dataset.value=value;
  el.setAttribute("aria-pressed",String(active));
  el.addEventListener("click",onClick);
  return el;
}
function choices(target,values,selected,callback) {
  const group=$(target);
  group.replaceChildren(...values.map(value=>button(value,value,value===selected,()=>callback(value))));
}
function cleanState() {
  if(state.controller)state.controller.abort();
  if(state.timer)clearTimeout(state.timer);
  state.controller=null;
  state.timer=null;
  state.lastKey="";
}
function showHome() {
  cleanState();
  state.county="";
  $("home-view").hidden=false;
  $("results-view").hidden=true;
  history.replaceState(null,"",location.pathname);
  window.scrollTo({top:0,behavior:"instant"});
}
function showCounty(county) {
  if(!state.counties.some(x=>x.name===county))return;
  cleanState();
  state.county=county;
  state.town="全區"; state.price="all"; state.meal="不限"; state.cuisine="不限";
  $("home-view").hidden=true;
  $("results-view").hidden=false;
  $("county-title").textContent=county;
  const towns=state.counties.find(x=>x.name===county)?.towns||[];
  const select=$("town");
  select.replaceChildren(...["全區",...towns].map(t=>{
    const option=node("option","",t);
    option.value=t;
    return option;
  }));
  choices("prices",[["all","不限"],["low","200 以內"],["mid","200–400"],["high","400 以上"]].map(x=>x[1]),"不限",label=>{
    const key={"不限":"all","200 以內":"low","200–400":"mid","400 以上":"high"}[label];
    state.price=key; renderFilters(); scheduleSearch();
  });
  renderFilters();
  history.replaceState(null,"","#"+encodeURIComponent(county));
  window.scrollTo({top:0,behavior:"instant"});
  scheduleSearch(80);
}
function renderFilters() {
  const prices=[["all","不限"],["low","200 以內"],["mid","200–400"],["high","400 以上"]];
  const group=$("prices");
  group.replaceChildren(...prices.map(([val,label])=>button(label,val,state.price===val,()=>{
    state.price=val;renderFilters();scheduleSearch();
  })));
  choices("meals",MEALS,state.meal,val=>{state.meal=val;renderFilters();scheduleSearch();});
  choices("cuisines",CUISINES,state.cuisine,val=>{state.cuisine=val;renderFilters();scheduleSearch();});
}
function skeleton() {
  const card=node("div","restaurant-card skeleton");
  const photo=node("div","photo-box");
  const body=node("div","restaurant-info");
  body.append(node("div","skeleton-line"),node("div","skeleton-line short"),node("div","skeleton-line"));
  card.append(photo,body);
  return card;
}
function safeGoogle(url) {
  try {
    const value=new URL(url);
    return value.protocol==="https:"&&
      (value.hostname==="google.com"||value.hostname.endsWith(".google.com")||value.hostname==="maps.app.goo.gl") ? value.href : "";
  } catch { return ""; }
}
function restaurantCard(item) {
  const card=node("article","restaurant-card");
  const photo=node("div","photo-box");
  const fallback=node("span","photo-fallback","餐廳照片");
  if(item.photoRef) {
    const img=node("img");
    img.alt=item.name+" 餐廳照片";
    img.loading="lazy";
    img.decoding="async";
    img.src="/api/photo?name="+encodeURIComponent(item.photoRef);
    img.addEventListener("error",()=>{img.remove();photo.prepend(fallback);});
    photo.append(img);
    const photoLink=safeGoogle(item.photoSourceUrl)||safeGoogle(item.mapsUrl);
    if(photoLink){const open=node("a","photo-open");open.href=photoLink;open.target="_blank";open.rel="noopener noreferrer";open.setAttribute("aria-label","在 Google Maps 查看原始照片");photo.append(open);}
    const credit=(item.attribution||[])[0];
    if(credit?.name) {
      const el=credit.url?node("a","photo-credit",credit.name):node("span","photo-credit",credit.name);
      if(credit.url){el.href=credit.url;el.target="_blank";el.rel="noopener noreferrer";}
      photo.append(el);
    }
  } else photo.append(fallback);
  const info=node("div","restaurant-info");
  const top=node("div","card-top");
  const title=node("h3","restaurant-name",item.name);
  const score=node("div","score-box");
  score.setAttribute("aria-label","推薦評分 "+item.score+" 分");
  score.append(node("span","score-number",String(item.score)),node("span","score-label","推薦分"));
  top.append(title,score);
  info.append(top);
  const summary=Array.from(item.feature||"").slice(0,50).join("").trim();
  if(summary && !/(近期獨立|查看最新顧客評論|搭配最新評論|資料不足)/.test(summary)) {
    info.append(node("p","feature",summary));
  }
  const maps=safeGoogle(item.mapsUrl);
  if(maps) {
    const link=node("a","map-link","Google Maps");
    link.setAttribute("translate","no");
    link.href=maps;
    link.target="_blank";
    link.rel="noopener noreferrer";
    info.append(link);
  }
  card.append(photo,info);
  return card;
}
function scheduleSearch(delay=530) {
  if(state.timer)clearTimeout(state.timer);
  if(state.controller)state.controller.abort();
  state.timer=setTimeout(searchRestaurants,delay);
}
async function searchRestaurants() {
  const params=new URLSearchParams({county:state.county,town:state.town,price:state.price,meal:state.meal,cuisine:state.cuisine});
  const key=params.toString();
  if(!state.county||state.lastKey===key)return;
  state.lastKey=key;
  const controller=new AbortController();
  state.controller=controller;
  $("result-count").textContent="";
  $("status").textContent="正在尋找好店";
  $("restaurant-list").replaceChildren(skeleton(),skeleton(),skeleton(),skeleton());
  try {
    const response=await fetch("/api/search?"+key,{signal:controller.signal,cache:"no-store"});
    const body=await response.json();
    if(!response.ok)throw new Error(body.error||"暫時無法取得餐廳");
    if(controller.signal.aborted)return;
    const list=body.restaurants||[];
    $("result-count").textContent=list.length+" 間";
    $("restaurant-list").replaceChildren(...list.map(restaurantCard));
    $("status").textContent=list.length?"":"目前沒有符合條件的餐廳";
  } catch(error) {
    if(controller.signal.aborted)return;
    state.lastKey="";
    $("restaurant-list").replaceChildren();
    $("status").textContent=error.message||"搜尋暫時無法使用";
  } finally {
    if(state.controller===controller)state.controller=null;
  }
}
// The single coordinate system follows the original artwork on every device.
async function setupHomeArt(counties) {
  const img=$("home-image");
  const svg=$("home-image-hotspots");
  const available=new Set(counties.map(x=>x.name));
  const svgNS="http://www.w3.org/2000/svg";
  const response=await fetch("/assets/map-areas.json");
  if(!response.ok)throw new Error("Map polygons not found");
  const data=await response.json();
  if(!Array.isArray(data.viewBox)||data.viewBox.length!==4)throw new Error("Map viewBox missing");
  svg.setAttribute("viewBox",data.viewBox.join(" "));
  svg.setAttribute("preserveAspectRatio","none");
  svg.replaceChildren();
  const regions=makeRegions(data.areas,available);
  for(const {county,points} of regions) {
    const hit=document.createElementNS(svgNS,"polygon");
    hit.setAttribute("points",points.map(point=>point.join(",")).join(" "));
    hit.setAttribute("class","county-hit");
    hit.setAttribute("role","button");
    hit.setAttribute("tabindex","0");
    hit.setAttribute("aria-label",county);
    hit.setAttribute("data-county",county);
    const title=document.createElementNS(svgNS,"title");
    title.textContent=county;
    hit.append(title);
    hit.addEventListener("keydown",event=>{
      if(event.key==="Enter"||event.key===" "){
        event.preventDefault();
        showCounty(county);
      }
    });
    svg.append(hit);
  }
  svg.addEventListener("click",event=>{
    // Measuring the original img instead of the SVG avoids mobile viewport
    // rounding / browser toolbar changes moving a county's touch target.
    const point=mapPoint(event.clientX,event.clientY,
      img.getBoundingClientRect(),data.viewBox);
    if(!point)return;
    const county=countyAt(point[0],point[1],regions,7);
    if(county)showCounty(county);
  });
  img.addEventListener("dragstart",event=>event.preventDefault());
}
async function init() {
  $("brand").addEventListener("click",showHome);
  $("back").addEventListener("click",showHome);
  $("town").addEventListener("change",e=>{state.town=e.target.value;scheduleSearch();});
  try {
    const response=await fetch("/data/taiwan-districts.json");
    if(!response.ok)throw new Error("County list missing");
    const data=await response.json();
    state.counties=ORDER.map(name=>data.find(row=>row.name===name)).filter(Boolean);
    await setupHomeArt(state.counties);
    try {
      const selected=decodeURIComponent(location.hash.slice(1));
      if(state.counties.some(x=>x.name===selected))showCounty(selected);
    }catch{}
  } catch {
    $("home-image-hotspots").setAttribute("aria-label","縣市點擊區域暫時無法載入");
  }
}
init();
