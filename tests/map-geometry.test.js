import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {makeRegions,countyAt,mapPoint,pointInsidePolygon} from "../public/map-geometry.js";

const source=JSON.parse(await readFile(
  new URL("../public/assets/map-areas.json",import.meta.url),"utf8"));
const regions=makeRegions(source.areas);
const byCounty=Object.keys(source.areas);
const v=source.viewBox;

test("19 mainland counties have usable drawn polygon tap areas",()=>{
  assert.equal(byCounty.length,19);
  assert(regions.length>=19);
  for(const name of byCounty){
    const shapes=regions.filter(x=>x.county===name);
    let selected=false;
    for(const shape of shapes) {
      const [l,t,r,b]=shape.bounds;
      for(let y=t+2;y<b-2&&!selected;y+=4)
        for(let x=l+2;x<r-2;x+=4)
          if(pointInsidePolygon(x,y,shape.points)&&
             countyAt(x,y,regions)===name){selected=true;break;}
    }
    assert(selected,`${name} cannot be selected`);
  }
});

test("touch points on phones correspond to the same counties as desktop",()=>{
  const samples={
    "台北市":[548,377],
    "基隆市":[625,381],
    "新竹市":[348,475],
    "彰化縣":[216,736],
    "南投縣":[393,734],
    "雲林縣":[185,820],
    "嘉義市":[298,897],
    "屏東縣":[330,1355]
  };
  for(const [county,[x,y]] of Object.entries(samples)){
    assert.equal(countyAt(x,y,regions),county,county);
    for(const width of [360,390,430,768,1280]){
      const h=width*v[3]/v[2];
      const rect={left:0,top:0,width,height:h,right:width,bottom:h};
      const mapped=mapPoint(x/v[2]*width,y/v[3]*h,rect,v);
      assert(mapped,`${county} outside map at ${width}`);
      assert.equal(countyAt(...mapped,regions),county,
        `${county} shifted at ${width}px`);
    }
  }
});

test("off-island taps never select an unrelated nearby county",()=>{
  for(const [x,y] of [[30,200],[700,500],[660,800],[35,1100],[530,1450]])
    assert.equal(countyAt(x,y,regions),"",`invalid hotspot at ${x},${y}`);
});
