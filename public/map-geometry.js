// Coordinates are in the image's preview viewBox (not CSS or device pixels).
// Keeping hit testing independent of the SVG element fixes touch/desktop drift.
const EMBEDDED_CITIES = new Set(["台北市","基隆市","新竹市","嘉義市"]);

export function pointInsidePolygon(x,y,points) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if(((a[1]>y)!==(b[1]>y)) &&
       x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}

export function polygonArea(points) {
  let sum=0;
  for(let i=0;i<points.length;i++) {
    const a=points[i],b=points[(i+1)%points.length];
    sum+=a[0]*b[1]-b[0]*a[1];
  }
  return Math.abs(sum)/2;
}

export function distanceToBoundary(x,y,points) {
  let closest=Infinity;
  for(let i=0;i<points.length;i++) {
    const a=points[i],b=points[(i+1)%points.length];
    const dx=b[0]-a[0],dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,
      ((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
    closest=Math.min(closest,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));
  }
  return closest;
}

export function makeRegions(areas,allowedNames) {
  const regions=[];
  for(const [county,polygons] of Object.entries(areas)) {
    if(allowedNames && !allowedNames.has(county))continue;
    for(const points of polygons) {
      if(!Array.isArray(points)||points.length<3)continue;
      const area=polygonArea(points);
      if(!area)continue;
      const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
      regions.push({county,points,area,
        bounds:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]});
    }
  }
  return regions;
}

export function countyAt(x,y,regions,tolerance=7) {
  // Reject taps outside the painted mainland instead of selecting an adjacent
  // county from 12+ image pixels away (especially noticeable on mobile).
  const hits=regions.filter(region=>{
    const [l,t,r,b]=region.bounds;
    return x>=l&&x<=r&&y>=t&&y<=b&&
      pointInsidePolygon(x,y,region.points);
  });
  if(hits.length) {
    // Small cities deliberately sit inside bigger counties.
    const cities=hits.filter(r=>EMBEDDED_CITIES.has(r.county));
    const candidates=cities.length?cities:hits;
    if(candidates.length===1)return candidates[0].county;
    // Large hand-traced regions sometimes overlap. In that seam choose the
    // region whose interior the tap is deepest, not the smallest arbitrary area.
    let best=null,score=-Infinity;
    for(const region of candidates) {
      const depth=distanceToBoundary(x,y,region.points);
      const normalized=depth/Math.sqrt(region.area);
      if(normalized>score){score=normalized;best=region;}
    }
    return best.county;
  }
  let nearest=null,shortest=tolerance;
  for(const region of regions) {
    const [l,t,r,b]=region.bounds;
    if(x<l-tolerance||x>r+tolerance||
       y<t-tolerance||y>b+tolerance)continue;
    const dist=distanceToBoundary(x,y,region.points);
    if(dist<shortest){shortest=dist;nearest=region;}
  }
  return nearest?.county||"";
}

// Uses the actual image rectangle, not the SVG's possibly rounded mobile box.
export function mapPoint(clientX,clientY,rect,viewBox) {
  const [bx,by,bw,bh]=viewBox;
  if(!rect.width||!rect.height)return null;
  if(clientX<rect.left||clientX>rect.right||
     clientY<rect.top||clientY>rect.bottom)return null;
  return [bx+(clientX-rect.left)/rect.width*bw,
          by+(clientY-rect.top)/rect.height*bh];
}
