const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function orderDocumentCorners(points) {
  if (!Array.isArray(points) || points.length !== 4) throw new TypeError('Four document corners are required.');
  const normalized = points.map(point => ({x: Number(point.x), y: Number(point.y)}));
  if (normalized.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) throw new TypeError('Document corners must be finite coordinates.');
  if (new Set(normalized.map(point => `${point.x}:${point.y}`)).size !== 4) throw new TypeError('Document corners must be unique.');
  const center = normalized.reduce((sum, point) => ({x:sum.x + point.x / 4, y:sum.y + point.y / 4}), {x:0,y:0});
  const clockwise = [...normalized].sort((left, right) => Math.atan2(left.y-center.y,left.x-center.x)-Math.atan2(right.y-center.y,right.x-center.x));
  let first = 0;
  for (let index=1;index<clockwise.length;index+=1) {
    const candidate=clockwise[index]; const current=clockwise[first];
    if (candidate.x+candidate.y<current.x+current.y || (candidate.x+candidate.y===current.x+current.y && candidate.y<current.y)) first=index;
  }
  const ordered=[...clockwise.slice(first),...clockwise.slice(0,first)];
  return {
    topLeft: ordered[0],
    topRight: ordered[1],
    bottomRight: ordered[2],
    bottomLeft: ordered[3],
  };
}

// Uncertain photos start from almost the whole frame, so the preview never cuts content.
export function defaultDocumentCorners(width, height) {
  const insetX = Math.max(1, Math.round(width * 0.02));
  const insetY = Math.max(1, Math.round(height * 0.02));
  return {
    topLeft: {x: insetX, y: insetY},
    topRight: {x: Math.max(insetX + 1, width - insetX - 1), y: insetY},
    bottomRight: {x: Math.max(insetX + 1, width - insetX - 1), y: Math.max(insetY + 1, height - insetY - 1)},
    bottomLeft: {x: insetX, y: Math.max(insetY + 1, height - insetY - 1)},
  };
}

function workingGray(imageData, maximumEdge) {
  const scale = Math.min(1, maximumEdge / Math.max(imageData.width, imageData.height));
  const width = Math.max(8, Math.round(imageData.width * scale));
  const height = Math.max(8, Math.round(imageData.height * scale));
  const gray = new Uint8Array(width * height);
  const color = new Uint8Array(width * height * 3);
  const source = imageData.data;
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(imageData.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(imageData.width - 1, Math.floor(x / scale));
      const offset = (sourceY * imageData.width + sourceX) * 4;
      const colorOffset=(y*width+x)*3;color[colorOffset]=source[offset];color[colorOffset+1]=source[offset+1];color[colorOffset+2]=source[offset+2];
      gray[y * width + x] = Math.round(source[offset] * 0.299 + source[offset + 1] * 0.587 + source[offset + 2] * 0.114);
    }
  }
  return {gray, color, width, height, scale};
}

function boxBlur(gray, width, height) {
  const blurred = new Uint8Array(gray);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let sum = 0;
      for (let row = -1; row <= 1; row += 1) {
        const start = (y + row) * width + x - 1;
        sum += gray[start] + gray[start + 1] + gray[start + 2];
      }
      blurred[y * width + x] = Math.round(sum / 9);
    }
  }
  return blurred;
}

function sobelEdges(gray, width, height) {
  const magnitude = new Uint8Array(gray.length);
  const histogram = new Uint32Array(256);
  let nonzero = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const a = gray[index - width - 1]; const b = gray[index - width]; const c = gray[index - width + 1];
      const d = gray[index - 1]; const f = gray[index + 1];
      const g = gray[index + width - 1]; const h = gray[index + width]; const i = gray[index + width + 1];
      const horizontal = -a + c - (2 * d) + (2 * f) - g + i;
      const vertical = -a - (2 * b) - c + g + (2 * h) + i;
      const value = clamp(Math.round(Math.hypot(horizontal, vertical) / 4), 0, 255);
      magnitude[index] = value;
      if (value > 0) { histogram[value] += 1; nonzero += 1; }
    }
  }
  let remaining = Math.max(1, Math.round(nonzero * 0.14));
  let threshold = 255;
  for (let value = 255; value > 0; value -= 1) {
    remaining -= histogram[value];
    if (remaining <= 0) { threshold = value; break; }
  }
  threshold = Math.max(28, threshold);
  const binary = new Uint8Array(magnitude.length);
  for (let index = 0; index < magnitude.length; index += 1) binary[index] = magnitude[index] >= threshold ? 1 : 0;
  return binary;
}

function colorEdges(color,width,height){
  const magnitude=new Uint8Array(width*height);const histogram=new Uint32Array(256);let nonzero=0;
  for(let y=1;y<height-1;y+=1)for(let x=1;x<width-1;x+=1){
    const center=(y*width+x)*3;let energy=0;
    for(let channel=0;channel<3;channel+=1){
      const a=color[center-(width+1)*3+channel];const b=color[center-width*3+channel];const c=color[center-(width-1)*3+channel];
      const d=color[center-3+channel];const f=color[center+3+channel];const g=color[center+(width-1)*3+channel];const h=color[center+width*3+channel];const i=color[center+(width+1)*3+channel];
      const horizontal=-a+c-(2*d)+(2*f)-g+i;const vertical=-a-(2*b)-c+g+(2*h)+i;energy+=horizontal*horizontal+vertical*vertical;
    }
    const value=clamp(Math.round(Math.sqrt(energy)/7),0,255);const index=y*width+x;magnitude[index]=value;if(value>0){histogram[value]+=1;nonzero+=1}
  }
  let remaining=Math.max(1,Math.round(nonzero*.14));let threshold=255;
  for(let value=255;value>0;value-=1){remaining-=histogram[value];if(remaining<=0){threshold=value;break}}
  threshold=Math.max(24,Math.min(72,Math.round(threshold*.35)));const binary=new Uint8Array(magnitude.length);
  for(let index=0;index<magnitude.length;index+=1)binary[index]=magnitude[index]>=threshold?1:0;
  return binary;
}

function dilate(binary, width, height) {
  const output = new Uint8Array(binary.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (!binary[index]) continue;
      for (let row = -1; row <= 1; row += 1) output.fill(1, index + row * width - 1, index + row * width + 2);
    }
  }
  return output;
}

function erode(binary,width,height){
  const output=new Uint8Array(binary.length);
  for(let y=1;y<height-1;y+=1)for(let x=1;x<width-1;x+=1){
    let neighbors=0;
    for(let row=-1;row<=1;row+=1)for(let column=-1;column<=1;column+=1)neighbors+=binary[(y+row)*width+x+column];
    if(neighbors>=7)output[y*width+x]=1;
  }
  return output;
}

function polygonArea(corners) {
  const points = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    sum += points[index].x * next.y - next.x * points[index].y;
  }
  return Math.abs(sum) / 2;
}

function lineSupport(binary, width, height, start, end) {
  const steps = Math.max(1, Math.round(Math.hypot(end.x - start.x, end.y - start.y)));
  let supported = 0;
  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    const x = Math.round(start.x + (end.x - start.x) * ratio);
    const y = Math.round(start.y + (end.y - start.y) * ratio);
    let found = false;
    for (let row = -3; row <= 3 && !found; row += 1) {
      for (let column = -3; column <= 3; column += 1) {
        const sampleX = x + column; const sampleY = y + row;
        if (sampleX >= 0 && sampleX < width && sampleY >= 0 && sampleY < height && binary[sampleY * width + sampleX]) { found = true; break; }
      }
    }
    if (found) supported += 1;
  }
  return supported / (steps + 1);
}

function boundaryContrast(gray, width, height, start, end) {
  const length=Math.hypot(end.x-start.x,end.y-start.y);
  if (length<1) return 0;
  const normal={x:-(end.y-start.y)/length,y:(end.x-start.x)/length};
  let difference=0; let samples=0;
  for (const ratio of [0.18,0.34,0.5,0.66,0.82]) {
    const center={x:start.x+(end.x-start.x)*ratio,y:start.y+(end.y-start.y)*ratio};
    for (const distance of [10,12,14]) {
      const leftX=Math.round(center.x-normal.x*distance); const leftY=Math.round(center.y-normal.y*distance);
      const rightX=Math.round(center.x+normal.x*distance); const rightY=Math.round(center.y+normal.y*distance);
      if (leftX<0||leftX>=width||leftY<0||leftY>=height||rightX<0||rightX>=width||rightY<0||rightY>=height) continue;
      difference+=Math.abs(gray[leftY*width+leftX]-gray[rightY*width+rightX]); samples+=1;
    }
  }
  return difference/Math.max(1,samples);
}

function colorBoundaryContrast(color,width,height,start,end){
  const length=Math.hypot(end.x-start.x,end.y-start.y);if(length<1)return 0;
  const normal={x:-(end.y-start.y)/length,y:(end.x-start.x)/length};let difference=0;let samples=0;
  for(const ratio of [.18,.34,.5,.66,.82]){
    const center={x:start.x+(end.x-start.x)*ratio,y:start.y+(end.y-start.y)*ratio};
    for(const offset of [10,12,14]){
      const leftX=Math.round(center.x-normal.x*offset);const leftY=Math.round(center.y-normal.y*offset);const rightX=Math.round(center.x+normal.x*offset);const rightY=Math.round(center.y+normal.y*offset);
      if(leftX<0||leftX>=width||leftY<0||leftY>=height||rightX<0||rightX>=width||rightY<0||rightY>=height)continue;
      const left=(leftY*width+leftX)*3;const right=(rightY*width+rightX)*3;let squared=0;
      for(let channel=0;channel<3;channel+=1){const delta=color[left+channel]-color[right+channel];squared+=delta*delta}
      difference+=Math.sqrt(squared)/3;samples+=1;
    }
  }
  return difference/Math.max(1,samples);
}

function nearSourceFrame(corners,width,height,areaRatio,{strict=false}={}){
  if(areaRatio<(strict ? 0.965 : 0.72))return false;
  const inset=Math.min(width,height)*(strict ? 0.015 : 0.065);
  const points = [corners.topLeft,corners.topRight,corners.bottomRight,corners.bottomLeft];
  return points.every(point => point.x <= inset || point.x >= width - 1 - inset)
    && points.every(point => point.y <= inset || point.y >= height - 1 - inset);
}

function containsCorners(outer,inner){
  const polygon=[outer.topLeft,outer.topRight,outer.bottomRight,outer.bottomLeft];
  return [inner.topLeft,inner.topRight,inner.bottomRight,inner.bottomLeft].every(point=>{
    let sign=0;
    for(let index=0;index<polygon.length;index+=1){const start=polygon[index];const end=polygon[(index+1)%polygon.length];const cross=(end.x-start.x)*(point.y-start.y)-(end.y-start.y)*(point.x-start.x);if(Math.abs(cross)<1)continue;const current=Math.sign(cross);if(sign&&current!==sign)return false;sign=current}
    return true;
  });
}

function documentShapeScore(corners) {
  const top=distance(corners.topLeft,corners.topRight); const bottom=distance(corners.bottomLeft,corners.bottomRight);
  const left=distance(corners.topLeft,corners.bottomLeft); const right=distance(corners.topRight,corners.bottomRight);
  const long=Math.max((top+bottom)/2,(left+right)/2); const short=Math.max(1,Math.min((top+bottom)/2,(left+right)/2));
  const ratio=long/short;
  return clamp(1-Math.abs(ratio-1.55)/6,0.18,1);
}

function componentCandidates(binary, width, height) {
  const visited = new Uint8Array(binary.length);
  const queue = new Int32Array(binary.length);
  const candidates = [];
  for (let origin = 0; origin < binary.length; origin += 1) {
    if (!binary[origin] || visited[origin]) continue;
    let head = 0; let tail = 0; let count = 0;
    let minimumSum = Infinity; let maximumSum = -Infinity; let minimumDifference = Infinity; let maximumDifference = -Infinity;
    let topLeft; let topRight; let bottomRight; let bottomLeft;
    visited[origin] = 1; queue[tail++] = origin;
    while (head < tail) {
      const index = queue[head++]; count += 1;
      const x = index % width; const y = Math.floor(index / width); const sum = x + y; const difference = x - y;
      if (sum < minimumSum) { minimumSum = sum; topLeft = {x, y}; }
      if (sum > maximumSum) { maximumSum = sum; bottomRight = {x, y}; }
      if (difference > maximumDifference) { maximumDifference = difference; topRight = {x, y}; }
      if (difference < minimumDifference) { minimumDifference = difference; bottomLeft = {x, y}; }
      for (let row = -1; row <= 1; row += 1) {
        for (let column = -1; column <= 1; column += 1) {
          if (row === 0 && column === 0) continue;
          const nextX = x + column; const nextY = y + row;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (binary[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
        }
      }
    }
    if (count >= Math.max(40, width * height * 0.004)) candidates.push({count, corners:{topLeft,topRight,bottomRight,bottomLeft}});
  }
  return candidates;
}

function colorDistance(color,index,mean){
  const red=color[index]-mean[0];const green=color[index+1]-mean[1];const blue=color[index+2]-mean[2];
  return Math.sqrt(red*red+green*green+blue*blue);
}

function refineMaskBounds(mask,corners,width,height){
  const points=[corners.topLeft,corners.topRight,corners.bottomRight,corners.bottomLeft];
  const minimumX=clamp(Math.floor(Math.min(...points.map(point=>point.x))),1,width-2);const maximumX=clamp(Math.ceil(Math.max(...points.map(point=>point.x))),1,width-2);
  const minimumY=clamp(Math.floor(Math.min(...points.map(point=>point.y))),1,height-2);const maximumY=clamp(Math.ceil(Math.max(...points.map(point=>point.y))),1,height-2);
  const columns=new Uint32Array(maximumX-minimumX+1);const rows=new Uint32Array(maximumY-minimumY+1);
  for(let y=minimumY;y<=maximumY;y+=1)for(let x=minimumX;x<=maximumX;x+=1)if(mask[y*width+x]){columns[x-minimumX]+=1;rows[y-minimumY]+=1}
  const columnThreshold=Math.max(3,Math.max(...columns)*.34);const rowThreshold=Math.max(3,Math.max(...rows)*.34);
  let left=columns.findIndex(value=>value>=columnThreshold);let right=columns.length-1-[...columns].reverse().findIndex(value=>value>=columnThreshold);
  let top=rows.findIndex(value=>value>=rowThreshold);let bottom=rows.length-1-[...rows].reverse().findIndex(value=>value>=rowThreshold);
  if(left<0||right<left||top<0||bottom<top)return null;
  left+=minimumX;right+=minimumX;top+=minimumY;bottom+=minimumY;
  return {topLeft:{x:left,y:top},topRight:{x:right,y:top},bottomRight:{x:right,y:bottom},bottomLeft:{x:left,y:bottom}};
}

function maskBoundarySupport(mask,width,height,corners){
  const offset=Math.max(2,Math.round(Math.min(width,height)*.008));let matched=0;let samples=0;
  const left=corners.topLeft.x;const right=corners.topRight.x;const top=corners.topLeft.y;const bottom=corners.bottomLeft.y;
  for(let step=1;step<=15;step+=1){
    const ratio=step/16;const x=Math.round(left+(right-left)*ratio);const y=Math.round(top+(bottom-top)*ratio);
    const pairs=[[[x,top+offset],[x,top-offset]],[[x,bottom-offset],[x,bottom+offset]],[[left+offset,y],[left-offset,y]],[[right-offset,y],[right+offset,y]]];
    for(const [[insideX,insideY],[outsideX,outsideY]] of pairs){
      if(insideX<0||insideX>=width||insideY<0||insideY>=height||outsideX<0||outsideX>=width||outsideY<0||outsideY>=height)continue;
      samples+=1;if(mask[insideY*width+insideX]&&!mask[outsideY*width+outsideX])matched+=1;
    }
  }
  return matched/Math.max(1,samples);
}

function backgroundSeparatedCandidates(color,edges,width,height){
  const patchSize=Math.max(8,Math.round(Math.min(width,height)*.075));
  const inset=Math.max(2,Math.round(patchSize*.12));
  const origins=[[inset,inset],[width-patchSize-inset,inset],[width-patchSize-inset,height-patchSize-inset],[inset,height-patchSize-inset]];
  const patches=origins.map(([startX,startY])=>{
    const mean=[0,0,0];let count=0;
    for(let y=startY;y<startY+patchSize;y+=1)for(let x=startX;x<startX+patchSize;x+=1){const index=(y*width+x)*3;mean[0]+=color[index];mean[1]+=color[index+1];mean[2]+=color[index+2];count+=1}
    mean[0]/=count;mean[1]/=count;mean[2]/=count;
    const distances=[];
    for(let y=startY;y<startY+patchSize;y+=2)for(let x=startX;x<startX+patchSize;x+=2)distances.push(colorDistance(color,(y*width+x)*3,mean));
    distances.sort((left,right)=>left-right);
    return {mean,variation:distances[Math.floor(distances.length*.9)]||0};
  });
  const maximumVariation=Math.max(...patches.map(patch=>patch.variation));
  let maximumCornerDifference=0;
  for(let left=0;left<patches.length;left+=1)for(let right=left+1;right<patches.length;right+=1){
    const a=patches[left].mean;const b=patches[right].mean;maximumCornerDifference=Math.max(maximumCornerDifference,Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]));
  }
  if(maximumCornerDifference>92)return [];
  const threshold=clamp(maximumVariation*1.25+10,30,90);
  let mask=new Uint8Array(width*height);
  for(let y=1;y<height-1;y+=1)for(let x=1;x<width-1;x+=1){
    const index=(y*width+x)*3;let distance=Infinity;
    for(const patch of patches)distance=Math.min(distance,colorDistance(color,index,patch.mean));
    if(distance>threshold)mask[y*width+x]=1;
  }
  mask=dilate(dilate(erode(erode(mask,width,height),width,height),width,height),width,height);
  const candidates=[];const components=componentCandidates(mask,width,height);
  for(const candidate of components){
    const corners=refineMaskBounds(mask,candidate.corners,width,height);if(!corners)continue;
    const area=polygonArea(corners);const areaRatio=area/(width*height);let filled=0;
    for(let y=corners.topLeft.y;y<=corners.bottomLeft.y;y+=1)for(let x=corners.topLeft.x;x<=corners.topRight.x;x+=1)filled+=mask[y*width+x];
    const fillRatio=filled/Math.max(1,area);
    if(areaRatio<.12||areaRatio>.9||nearSourceFrame(corners,width,height,areaRatio,{strict:true}))continue;
    if(fillRatio<.32)continue;
    const boundarySupport=maskBoundarySupport(mask,width,height,corners);
    const sides=[[corners.topLeft,corners.topRight],[corners.topRight,corners.bottomRight],[corners.bottomRight,corners.bottomLeft],[corners.bottomLeft,corners.topLeft]];
    const support=sides.reduce((sum,[start,end])=>sum+lineSupport(edges,width,height,start,end),0)/4;
    const contrast=sides.reduce((sum,[start,end])=>sum+colorBoundaryContrast(color,width,height,start,end),0)/4;
    const shapeScore=documentShapeScore(corners);
    candidates.push({corners,areaRatio,fillRatio,shapeScore,boundarySupport,support,contrast,confidence:clamp(.69+Math.min(.09,(fillRatio-.32)*.16)+shapeScore*.07+boundarySupport*.06+support*.04+clamp(contrast/45,0,1)*.05,0,.94),source:'background-separation'});
  }
  return candidates.sort((left,right)=>right.confidence-left.confidence);
}

// --- Border-connected surface model ------------------------------------------------
// Four corner patches cannot describe a textured, unevenly lit surface (and are
// contaminated when the card sits close to the frame). Instead a smooth colour
// field is fitted to the whole image border and the background is grown inward
// from that border through pixels that stay close to the field, so lighting drift,
// texture and soft shadows stay background while the card boundary stops growth.
// Card pixels that merely resemble the surface remain foreground unless they are
// actually connected to the border.

function smoothColor(color,width,height,radius,passes){
  let source=Float32Array.from(color);const temp=new Float32Array(source.length);const span=radius*2+1;
  for(let pass=0;pass<passes;pass+=1){
    for(let y=0;y<height;y+=1)for(let channel=0;channel<3;channel+=1){
      let sum=0;for(let k=-radius;k<=radius;k+=1)sum+=source[(y*width+clamp(k,0,width-1))*3+channel];
      for(let x=0;x<width;x+=1){temp[(y*width+x)*3+channel]=sum/span;sum+=source[(y*width+Math.min(width-1,x+radius+1))*3+channel]-source[(y*width+Math.max(0,x-radius))*3+channel]}
    }
    const output=new Float32Array(source.length);
    for(let x=0;x<width;x+=1)for(let channel=0;channel<3;channel+=1){
      let sum=0;for(let k=-radius;k<=radius;k+=1)sum+=temp[(clamp(k,0,height-1)*width+x)*3+channel];
      for(let y=0;y<height;y+=1){output[(y*width+x)*3+channel]=sum/span;sum+=temp[(Math.min(height-1,y+radius+1)*width+x)*3+channel]-temp[(Math.max(0,y-radius)*width+x)*3+channel]}
    }
    source=output;
  }
  return source;
}

function sampleColor(color,width,height,x,y){
  if(x<0||y<0||x>width-1||y>height-1)return null;
  const left=Math.floor(x);const top=Math.floor(y);const right=Math.min(width-1,left+1);const bottom=Math.min(height-1,top+1);const fx=x-left;const fy=y-top;const value=[0,0,0];
  for(let channel=0;channel<3;channel+=1){
    const upper=color[(top*width+left)*3+channel]*(1-fx)+color[(top*width+right)*3+channel]*fx;
    const lower=color[(bottom*width+left)*3+channel]*(1-fx)+color[(bottom*width+right)*3+channel]*fx;
    value[channel]=upper*(1-fy)+lower*fy;
  }
  return value;
}

// Distance (in pixels, capped) from the outside of the domain; the image edge counts as outside.
function domainDepth(width,height,domain,limit){
  const distance=new Uint8Array(width*height).fill(255);const queue=new Int32Array(width*height);let head=0;let tail=0;
  for(let y=0;y<height;y+=1)for(let x=0;x<width;x+=1){
    const index=y*width+x;if(domain&&!domain[index])continue;
    if(x===0||y===0||x===width-1||y===height-1||(domain&&(!domain[index-1]||!domain[index+1]||!domain[index-width]||!domain[index+width]))){distance[index]=0;queue[tail++]=index}
  }
  while(head<tail){
    const index=queue[head++];const next=distance[index]+1;if(next>limit)continue;const x=index%width;
    for(const neighbor of [x>0?index-1:-1,x<width-1?index+1:-1,index-width,index+width]){
      if(neighbor<0||neighbor>=width*height||(domain&&!domain[neighbor])||distance[neighbor]<=next)continue;
      distance[neighbor]=next;queue[tail++]=neighbor;
    }
  }
  return distance;
}

function surfaceModel(smooth,width,height,ring){
  if(ring.length<60)return null;
  let minimumX=Infinity;let maximumX=-Infinity;let minimumY=Infinity;let maximumY=-Infinity;
  for(const index of ring){const x=index%width;const y=(index-x)/width;minimumX=Math.min(minimumX,x);maximumX=Math.max(maximumX,x);minimumY=Math.min(minimumY,y);maximumY=Math.max(maximumY,y)}
  const centerX=(minimumX+maximumX)/2;const centerY=(minimumY+maximumY)/2;const spanX=Math.max(1,(maximumX-minimumX)/2);const spanY=Math.max(1,(maximumY-minimumY)/2);
  const terms=(x,y)=>{const u=(x-centerX)/spanX;const v=(y-centerY)/spanY;return [1,u,v,u*u,u*v,v*v]};
  const step=Math.max(1,Math.floor(ring.length/6000));const samples=[];for(let index=0;index<ring.length;index+=step)samples.push(ring[index]);
  let active=new Uint8Array(samples.length).fill(1);let coefficients=null;let residuals=new Float32Array(samples.length);
  for(let iteration=0;iteration<3;iteration+=1){
    const matrix=Array.from({length:6},()=>new Array(6).fill(0));const values=Array.from({length:3},()=>new Array(6).fill(0));let used=0;
    samples.forEach((index,sample)=>{
      if(!active[sample])return;const x=index%width;const t=terms(x,(index-x)/width);used+=1;
      for(let row=0;row<6;row+=1){for(let column=0;column<6;column+=1)matrix[row][column]+=t[row]*t[column];for(let channel=0;channel<3;channel+=1)values[channel][row]+=t[row]*smooth[index*3+channel]}
    });
    if(used<30)return null;
    for(let row=0;row<6;row+=1)matrix[row][row]+=used*1e-6;
    try{coefficients=values.map(channel=>solveLinearSystem(matrix,channel))}catch{return null}
    samples.forEach((index,sample)=>{const x=index%width;const t=terms(x,(index-x)/width);let squared=0;for(let channel=0;channel<3;channel+=1){let expected=0;for(let term=0;term<6;term+=1)expected+=coefficients[channel][term]*t[term];squared+=(smooth[index*3+channel]-expected)**2}residuals[sample]=Math.sqrt(squared)});
    const sorted=[...residuals].sort((left,right)=>left-right);const median=sorted[Math.floor(sorted.length/2)];
    active=active.map((_,sample)=>residuals[sample]<=Math.max(8,median*2.5)?1:0);
  }
  // Spread of the surface itself: border samples rejected as outliers (a card corner
  // reaching into the border ring) must not inflate the tolerance.
  const sorted=[...residuals].filter((_,sample)=>active[sample]).sort((left,right)=>left-right);if(sorted.length<30)return null;
  const spread=sorted[Math.floor(sorted.length*.85)];
  return {
    spread,
    field(){
      const expected=new Float32Array(width*height*3);
      for(let y=0;y<height;y+=1){
        const v=(y-centerY)/spanY;
        for(let x=0;x<width;x+=1){const u=(x-centerX)/spanX;const offset=(y*width+x)*3;for(let channel=0;channel<3;channel+=1){const c=coefficients[channel];expected[offset+channel]=c[0]+c[1]*u+c[2]*v+c[3]*u*u+c[4]*u*v+c[5]*v*v}}
      }
      return expected;
    },
  };
}

function gradientMagnitude(smooth,width,height){
  const magnitude=new Float32Array(width*height);
  for(let y=1;y<height-1;y+=1)for(let x=1;x<width-1;x+=1){
    const center=(y*width+x)*3;let energy=0;
    for(let channel=0;channel<3;channel+=1){
      const a=smooth[center-(width+1)*3+channel];const b=smooth[center-width*3+channel];const c=smooth[center-(width-1)*3+channel];
      const d=smooth[center-3+channel];const f=smooth[center+3+channel];const g=smooth[center+(width-1)*3+channel];const h=smooth[center+width*3+channel];const i=smooth[center+(width+1)*3+channel];
      const horizontal=-a+c-(2*d)+(2*f)-g+i;const vertical=-a-(2*b)-c+g+(2*h)+i;energy+=horizontal*horizontal+vertical*vertical;
    }
    magnitude[y*width+x]=Math.sqrt(energy)/8;
  }
  return magnitude;
}

// Background-like: close to the reference surface colour, or a darker shadow of it.
function surfaceLike(smooth,index,reference,offset,threshold){
  const red=smooth[index*3];const green=smooth[index*3+1];const blue=smooth[index*3+2];
  const expectedRed=reference[offset];const expectedGreen=reference[offset+1];const expectedBlue=reference[offset+2];
  const deltaRed=red-expectedRed;const deltaGreen=green-expectedGreen;const deltaBlue=blue-expectedBlue;
  if(deltaRed*deltaRed+deltaGreen*deltaGreen+deltaBlue*deltaBlue<=threshold*threshold)return true;
  const energy=expectedRed*expectedRed+expectedGreen*expectedGreen+expectedBlue*expectedBlue;if(energy<1)return false;
  const ratio=(red*expectedRed+green*expectedGreen+blue*expectedBlue)/energy;if(ratio<.5||ratio>1)return false;
  const shadowRed=red-expectedRed*ratio;const shadowGreen=green-expectedGreen*ratio;const shadowBlue=blue-expectedBlue*ratio;
  return shadowRed*shadowRed+shadowGreen*shadowGreen+shadowBlue*shadowBlue<=threshold*threshold*.64;
}

// Inside a nested region the outer few pixels are a blurred mix of both sides, so the
// sampling ring and the grown area start beyond that transition.
function floodSurface(smooth,width,height,domain,{adaptive:adapt=true}={}){
  const thickness=Math.max(3,Math.round(Math.min(width,height)*.012));const inset=domain?6:0;
  const depth=domainDepth(width,height,domain,inset+thickness);
  const inDomain=index=>(!domain||domain[index])&&depth[index]>=inset;
  const ring=[];for(let index=0;index<depth.length;index+=1)if(inDomain(index)&&depth[index]<inset+thickness)ring.push(index);
  const model=surfaceModel(smooth,width,height,ring);if(!model)return null;
  const threshold=clamp(model.spread*1.7+8,14,64);const expected=model.field();
  // Illumination that the smooth model cannot follow (a lamp hotspot, vignetting) changes
  // slowly, so where the local gradient is as calm as the border's own texture the
  // reference colour may adapt step by step. Sharp steps never adapt and must match the
  // fitted model itself. On textured surfaces a real card edge can be locally as soft as
  // the texture, so this adaptation is only used when the strict model finds no document.
  const gradient=gradientMagnitude(smooth,width,height);const ringGradients=ring.map(index=>gradient[index]).sort((left,right)=>left-right);
  const calm=adapt?clamp(ringGradients[Math.floor(ringGradients.length*.9)]*1.5+1,1,12):0;
  const reference=new Float32Array(width*height*3);
  const background=new Uint8Array(width*height);const queue=new Int32Array(width*height);let head=0;let tail=0;
  for(const index of ring)if(!background[index]&&surfaceLike(smooth,index,expected,index*3,threshold)){background[index]=1;queue[tail++]=index;for(let channel=0;channel<3;channel+=1)reference[index*3+channel]=smooth[index*3+channel]}
  while(head<tail){
    const index=queue[head++];const x=index%width;
    for(const neighbor of [x>0?index-1:-1,x<width-1?index+1:-1,index-width,index+width]){
      if(neighbor<0||neighbor>=width*height||background[neighbor]||!inDomain(neighbor))continue;
      const adaptive=adapt&&gradient[neighbor]<=calm&&surfaceLike(smooth,neighbor,reference,index*3,threshold*.75);
      if(!adaptive&&!surfaceLike(smooth,neighbor,expected,neighbor*3,threshold))continue;
      background[neighbor]=1;queue[tail++]=neighbor;
      for(let channel=0;channel<3;channel+=1){const previous=reference[index*3+channel];reference[neighbor*3+channel]=previous+(smooth[neighbor*3+channel]-previous)*.15}
    }
  }
  let foreground=new Uint8Array(width*height);let area=0;for(let index=0;index<foreground.length;index+=1){const inside=inDomain(index);area+=inside?1:0;foreground[index]=inside&&!background[index]?1:0}
  foreground=dilate(erode(foreground,width,height),width,height);
  let content=0;for(let index=0;index<foreground.length;index+=1)content+=foreground[index];
  return {background,foreground,threshold,calm,spread:model.spread,ringCount:ring.length,contentRatio:content/Math.max(1,area)};
}

function labelComponents(mask,width,height,minimumCount){
  const labels=new Int32Array(width*height);const queue=new Int32Array(width*height);const components=[];
  for(let origin=0;origin<mask.length;origin+=1){
    if(!mask[origin]||labels[origin])continue;
    const label=components.length+1;let head=0;let tail=0;queue[tail++]=origin;labels[origin]=label;
    let minimumX=Infinity;let maximumX=-Infinity;let minimumY=Infinity;let maximumY=-Infinity;
    while(head<tail){
      const index=queue[head++];const x=index%width;const y=(index-x)/width;
      if(x<minimumX)minimumX=x;if(x>maximumX)maximumX=x;if(y<minimumY)minimumY=y;if(y>maximumY)maximumY=y;
      for(let row=-1;row<=1;row+=1)for(let column=-1;column<=1;column+=1){
        const nextX=x+column;const nextY=y+row;if(nextX<0||nextY<0||nextX>=width||nextY>=height)continue;
        const next=nextY*width+nextX;if(mask[next]&&!labels[next]){labels[next]=label;queue[tail++]=next}
      }
    }
    components.push({label,count:tail,minimumX,maximumX,minimumY,maximumY});
  }
  return {labels,components:components.filter(component=>component.count>=minimumCount)};
}

function componentBoundary(labels,component,width,height){
  const points=[];const {label}=component;
  for(let y=component.minimumY;y<=component.maximumY;y+=1)for(let x=component.minimumX;x<=component.maximumX;x+=1){
    const index=y*width+x;if(labels[index]!==label)continue;
    if(x===0||y===0||x===width-1||y===height-1||labels[index-1]!==label||labels[index+1]!==label||labels[index-width]!==label||labels[index+width]!==label)points.push({x,y});
  }
  return points;
}

function convexHull(points){
  const sorted=[...points].sort((left,right)=>left.x-right.x||left.y-right.y);if(sorted.length<3)return sorted;
  const cross=(origin,a,b)=>(a.x-origin.x)*(b.y-origin.y)-(a.y-origin.y)*(b.x-origin.x);
  const lower=[];for(const point of sorted){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],point)<=0)lower.pop();lower.push(point)}
  const upper=[];for(let index=sorted.length-1;index>=0;index-=1){const point=sorted[index];while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],point)<=0)upper.pop();upper.push(point)}
  return lower.slice(0,-1).concat(upper.slice(0,-1));
}

function minimumAreaRectangle(hull){
  let best=null;
  for(let index=0;index<hull.length;index+=1){
    const start=hull[index];const end=hull[(index+1)%hull.length];const length=Math.hypot(end.x-start.x,end.y-start.y);if(length<1e-6)continue;
    const axisU={x:(end.x-start.x)/length,y:(end.y-start.y)/length};const axisV={x:-axisU.y,y:axisU.x};
    let minimumU=Infinity;let maximumU=-Infinity;let minimumV=Infinity;let maximumV=-Infinity;
    for(const point of hull){const u=point.x*axisU.x+point.y*axisU.y;const v=point.x*axisV.x+point.y*axisV.y;minimumU=Math.min(minimumU,u);maximumU=Math.max(maximumU,u);minimumV=Math.min(minimumV,v);maximumV=Math.max(maximumV,v)}
    const area=(maximumU-minimumU)*(maximumV-minimumV);
    if(!best||area<best.area)best={area,axisU,axisV,minimumU,maximumU,minimumV,maximumV};
  }
  return best;
}

function fitLine(points){
  let meanX=0;let meanY=0;for(const point of points){meanX+=point.x;meanY+=point.y}meanX/=points.length;meanY/=points.length;
  let xx=0;let xy=0;let yy=0;for(const point of points){const dx=point.x-meanX;const dy=point.y-meanY;xx+=dx*dx;xy+=dx*dy;yy+=dy*dy}
  const angle=.5*Math.atan2(2*xy,xx-yy);
  return {point:{x:meanX,y:meanY},direction:{x:Math.cos(angle),y:Math.sin(angle)}};
}

const lineDistance=(line,point)=>(point.x-line.point.x)*-line.direction.y+(point.y-line.point.y)*line.direction.x;

function intersectLines(first,second){
  const denominator=first.direction.x*second.direction.y-first.direction.y*second.direction.x;if(Math.abs(denominator)<1e-6)return null;
  const scale=((second.point.x-first.point.x)*second.direction.y-(second.point.y-first.point.y)*second.direction.x)/denominator;
  return {x:first.point.x+first.direction.x*scale,y:first.point.y+first.direction.y*scale};
}

// Start from the straight line most contour points agree on (pairs of points spread along
// the side, roughly parallel to it), so an attached blob such as a shadow, unmodelled light
// or the bite a removed hand leaves cannot tilt or turn a side.
function consensusLine(pool,along,tolerance,direction=null){
  const sorted=[...pool].sort((left,right)=>along(left)-along(right));
  const agreeing=line=>{let count=0;for(const point of pool)if(Math.abs(lineDistance(line,point))<=tolerance)count+=1;return count};
  let best=fitLine(pool);let bestCount=agreeing(best);
  if(direction&&Math.abs(best.direction.x*direction.x+best.direction.y*direction.y)<Math.cos(15*Math.PI/180)){best={point:sorted[Math.floor(sorted.length/2)],direction};bestCount=agreeing(best)}
  const half=Math.floor(sorted.length/2);const step=Math.max(1,Math.floor(half/24));
  for(let first=0;first<half;first+=step)for(const fraction of [.35,.5,.65]){
    const start=sorted[first];const end=sorted[Math.min(sorted.length-1,first+Math.floor(sorted.length*fraction))];
    const length=Math.hypot(end.x-start.x,end.y-start.y);if(length<1)continue;
    const line={point:start,direction:{x:(end.x-start.x)/length,y:(end.y-start.y)/length}};
    if(direction&&Math.abs(line.direction.x*direction.x+line.direction.y*direction.y)<Math.cos(15*Math.PI/180))continue;
    const count=agreeing(line);
    if(count>bestCount){best=line;bestCount=count}
  }
  return best;
}

// Long straight sides fitted to the contour; rounded corners never vote because only the
// central part of each side is used, and the corners come from side intersections.
function fitDocumentSides(points,rectangle){
  const project=(point,axis)=>point.x*axis.x+point.y*axis.y;
  const short=Math.min(rectangle.maximumU-rectangle.minimumU,rectangle.maximumV-rectangle.minimumV);
  const band=Math.max(4,short*.14);const tolerance=Math.max(1.5,short*.012);
  const specs=[
    {axis:rectangle.axisU,value:rectangle.minimumU,along:rectangle.axisV,start:rectangle.minimumV,end:rectangle.maximumV},
    {axis:rectangle.axisV,value:rectangle.minimumV,along:rectangle.axisU,start:rectangle.minimumU,end:rectangle.maximumU},
    {axis:rectangle.axisU,value:rectangle.maximumU,along:rectangle.axisV,start:rectangle.minimumV,end:rectangle.maximumV},
    {axis:rectangle.axisV,value:rectangle.maximumV,along:rectangle.axisU,start:rectangle.minimumU,end:rectangle.maximumU},
  ];
  const sides=[];
  for(const spec of specs){
    const span=spec.end-spec.start;const low=spec.start+span*.1;const high=spec.end-span*.1;
    const pool=points.filter(point=>{const along=project(point,spec.along);return Math.abs(project(point,spec.axis)-spec.value)<=band&&along>=low&&along<=high});
    if(pool.length<8)return null;
    let line=consensusLine(pool,point=>project(point,spec.along),tolerance*1.5,spec.along);let inliers=pool;
    for(const limit of [tolerance*2,tolerance*1.5,tolerance]){
      const next=pool.filter(point=>Math.abs(lineDistance(line,point))<=limit);if(next.length<8)return null;
      inliers=next;line=fitLine(inliers);
    }
    const bins=new Uint8Array(20);for(const point of inliers)bins[clamp(Math.floor((project(point,spec.along)-low)/Math.max(1,high-low)*20),0,19)]=1;
    const rms=Math.sqrt(inliers.reduce((sum,point)=>sum+lineDistance(line,point)**2,0)/inliers.length);
    sides.push({line,coverage:bins.reduce((sum,value)=>sum+value,0)/20,rms});
  }
  return {sides,short,tolerance};
}

function quadrilateralFromSides(sides){
  const points=[];
  for(let index=0;index<4;index+=1){const point=intersectLines(sides[index].line,sides[(index+1)%4].line);if(!point)return null;points.push(point)}
  try{return orderDocumentCorners(points)}catch{return null}
}

function outwardNormal(line,center){
  const normal={x:-line.direction.y,y:line.direction.x};
  return (center.x-line.point.x)*normal.x+(center.y-line.point.y)*normal.y>0?{x:-normal.x,y:-normal.y}:normal;
}

// Slide each side along its normal onto the strongest colour step: the grown background
// stops a little outside the true edge because the model works on blurred colour.
function snapSides(sides,corners,light,width,height){
  const ordered=[corners.topLeft,corners.topRight,corners.bottomRight,corners.bottomLeft];
  const center=ordered.reduce((sum,point)=>({x:sum.x+point.x/4,y:sum.y+point.y/4}),{x:0,y:0});
  return sides.map(side=>{
    const normal=outwardNormal(side.line,center);const along=side.line.direction;
    const projections=ordered.map(point=>({distance:Math.abs(lineDistance(side.line,point)),position:(point.x-side.line.point.x)*along.x+(point.y-side.line.point.y)*along.y})).sort((left,right)=>left.distance-right.distance).slice(0,2).map(entry=>entry.position);
    const start=Math.min(...projections);const end=Math.max(...projections);let best={offset:0,score:-1};
    for(let offset=-6;offset<=4;offset+=.5){
      let total=0;let count=0;
      for(let sample=0;sample<32;sample+=1){
        const position=start+(end-start)*(.12+.76*sample/31);
        const x=side.line.point.x+along.x*position+normal.x*offset;const y=side.line.point.y+along.y*position+normal.y*offset;
        const inner=sampleColor(light,width,height,x-normal.x*1.5,y-normal.y*1.5);const outer=sampleColor(light,width,height,x+normal.x*1.5,y+normal.y*1.5);
        if(!inner||!outer)continue;total+=Math.hypot(inner[0]-outer[0],inner[1]-outer[1],inner[2]-outer[2]);count+=1;
      }
      if(count<20)continue;const score=total/count;if(score>best.score)best={offset,score};
    }
    return {...side,snap:best.offset,line:{point:{x:side.line.point.x+normal.x*best.offset,y:side.line.point.y+normal.y*best.offset},direction:along}};
  });
}

// Re-fit each side on the photo's own colour edge: across the contour side, take the
// strongest colour step at evenly spaced positions and fit the line most of them agree on.
// Where an attached blob (unmodelled light, a shadow) hides part of the card edge from the
// contour, the edge is still visible in the image. Falls back to the plain snap.
function refineSidesOnEdges(sides,snapped,corners,light,width,height,short){
  const ordered=[corners.topLeft,corners.topRight,corners.bottomRight,corners.bottomLeft];
  const center=ordered.reduce((sum,point)=>({x:sum.x+point.x/4,y:sum.y+point.y/4}),{x:0,y:0});
  const reach=clamp(short*.05,8,20);
  return sides.map((side,index)=>{
    const normal=outwardNormal(side.line,center);const along=side.line.direction;
    const projections=ordered.map(point=>({distance:Math.abs(lineDistance(side.line,point)),position:(point.x-side.line.point.x)*along.x+(point.y-side.line.point.y)*along.y})).sort((left,right)=>left.distance-right.distance).slice(0,2).map(entry=>entry.position);
    const start=Math.min(...projections);const end=Math.max(...projections);const edges=[];
    for(let sample=0;sample<40;sample+=1){
      const position=start+(end-start)*(.1+.8*sample/39);const baseX=side.line.point.x+along.x*position;const baseY=side.line.point.y+along.y*position;let best=null;
      for(let offset=-reach;offset<=reach;offset+=.5){
        const x=baseX+normal.x*offset;const y=baseY+normal.y*offset;
        const inner=sampleColor(light,width,height,x-normal.x*1.5,y-normal.y*1.5);const outer=sampleColor(light,width,height,x+normal.x*1.5,y+normal.y*1.5);
        if(!inner||!outer)continue;const step=Math.hypot(inner[0]-outer[0],inner[1]-outer[1],inner[2]-outer[2]);
        if(!best||step>best.step)best={step,point:{x,y}};
      }
      if(best)edges.push(best);
    }
    const fallback=snapped[index];if(edges.length<20)return fallback;
    const median=[...edges].map(edge=>edge.step).sort((left,right)=>left-right)[Math.floor(edges.length/2)];
    const strong=edges.filter(edge=>edge.step>=median*.5).map(edge=>edge.point);
    const line=consensusLine(strong,point=>point.x*along.x+point.y*along.y,1.5,along);
    const inliers=strong.filter(point=>Math.abs(lineDistance(line,point))<=1.5);if(inliers.length<edges.length*.5)return fallback;
    const fitted=fitLine(inliers);const alignment=fitted.direction.x*along.x+fitted.direction.y*along.y;
    if(Math.abs(alignment)<Math.cos(8*Math.PI/180))return fallback;
    const direction=alignment<0?{x:-fitted.direction.x,y:-fitted.direction.y}:fitted.direction;
    const middle={x:side.line.point.x+along.x*(start+end)/2,y:side.line.point.y+along.y*(start+end)/2};
    // How far the edge line sits from the contour line, measured outward at mid-side.
    const refined={point:fitted.point,direction};const facing=-direction.y*normal.x+direction.x*normal.y;
    const shift=Math.abs(facing)<1e-6?0:-lineDistance(refined,middle)/facing;
    return {...side,snap:clamp(shift,-reach,reach),line:refined};
  });
}

function sideContrast(smooth,width,height,line,start,end,center){
  const normal=outwardNormal(line,center);let total=0;let count=0;
  for(let sample=0;sample<24;sample+=1){
    const position=start+(end-start)*(.1+.8*sample/23);
    for(const offset of [4,6,8]){
      const x=line.point.x+line.direction.x*position;const y=line.point.y+line.direction.y*position;
      const inner=sampleColor(smooth,width,height,x-normal.x*offset,y-normal.y*offset);const outer=sampleColor(smooth,width,height,x+normal.x*offset,y+normal.y*offset);
      if(!inner||!outer)continue;total+=Math.hypot(inner[0]-outer[0],inner[1]-outer[1],inner[2]-outer[2]);count+=1;
    }
  }
  return count?total/count:0;
}

function insideQuadrilateral(corners,point,margin=0){
  const polygon=[corners.topLeft,corners.topRight,corners.bottomRight,corners.bottomLeft];
  const center=polygon.reduce((sum,value)=>({x:sum.x+value.x/4,y:sum.y+value.y/4}),{x:0,y:0});
  return polygon.every((start,index)=>{
    const end=polygon[(index+1)%4];const length=Math.hypot(end.x-start.x,end.y-start.y)||1;
    const side=((end.x-start.x)*(point.y-start.y)-(end.y-start.y)*(point.x-start.x))/length;
    const reference=((end.x-start.x)*(center.y-start.y)-(end.y-start.y)*(center.x-start.x))/length;
    // A negative margin asks for points at least that far inside every side.
    if(margin<0)return Math.sign(side)===Math.sign(reference)&&Math.abs(side)>=-margin;
    return Math.sign(side)===Math.sign(reference)||Math.abs(side)<=margin;
  });
}

// Rounded card corners: walk from each straight-side intersection along the corner
// bisector to the first card pixel. For a right-angle corner of radius r that distance is
// r(sqrt2 - 1) minus the small outward offset of the grown mask (undone by snapping).
function cornerRadiusEstimate(labels,label,corners,sides,width,height){
  const ordered=[corners.topLeft,corners.topRight,corners.bottomRight,corners.bottomLeft];
  const offset=Math.max(0,-sides.reduce((sum,side)=>sum+side.snap,0)/4);
  const estimates=ordered.map((point,index)=>{
    const previous=ordered[(index+3)%4];const next=ordered[(index+1)%4];
    const a={x:previous.x-point.x,y:previous.y-point.y};const b={x:next.x-point.x,y:next.y-point.y};const lengthA=Math.hypot(a.x,a.y)||1;const lengthB=Math.hypot(b.x,b.y)||1;
    const bisector={x:a.x/lengthA+b.x/lengthB,y:a.y/lengthA+b.y/lengthB};const length=Math.hypot(bisector.x,bisector.y)||1;
    for(let step=0;step<=Math.min(lengthA,lengthB)*.2;step+=.5){
      const x=Math.round(point.x+bisector.x/length*step);const y=Math.round(point.y+bisector.y/length*step);
      if(x>=0&&y>=0&&x<width&&y<height&&labels[y*width+x]===label)return (step+offset)/(Math.SQRT2-1);
    }
    return 0;
  }).sort((left,right)=>left-right);
  const short=Math.min(...ordered.map((point,index)=>distance(point,ordered[(index+1)%4])));
  return clamp((estimates[1]+estimates[2])/2*1.1/Math.max(1,short),0,.12);
}

function surfaceCandidate(component,labels,smooth,light,edges,width,height,threshold,{occluded=false}={}){
  const boundary=componentBoundary(labels,component,width,height);if(boundary.length<40)return {rejected:'small-contour',rectangularity:0};
  const rectangle=minimumAreaRectangle(convexHull(boundary));if(!rectangle)return {rejected:'no-rectangle',rectangularity:0};
  const rectangularity=component.count/Math.max(1,rectangle.area);
  const fitted=fitDocumentSides(boundary,rectangle);if(!fitted)return {rejected:'no-sides',rectangularity};
  let corners=quadrilateralFromSides(fitted.sides);if(!corners)return {rejected:'no-corners',rectangularity};
  const sides=refineSidesOnEdges(fitted.sides,snapSides(fitted.sides,corners,light,width,height),corners,light,width,height,fitted.short);corners=quadrilateralFromSides(sides);if(!corners)return {rejected:'no-corners',rectangularity};
  const ordered=[corners.topLeft,corners.topRight,corners.bottomRight,corners.bottomLeft];
  const lengths=ordered.map((point,index)=>distance(point,ordered[(index+1)%4]));
  const area=polygonArea(corners);const areaRatio=area/(width*height);
  const angles=ordered.map((point,index)=>{const previous=ordered[(index+3)%4];const next=ordered[(index+1)%4];const a={x:previous.x-point.x,y:previous.y-point.y};const b={x:next.x-point.x,y:next.y-point.y};return Math.acos(clamp((a.x*b.x+a.y*b.y)/Math.max(1e-6,Math.hypot(a.x,a.y)*Math.hypot(b.x,b.y)),-1,1))*180/Math.PI});
  const center=ordered.reduce((sum,point)=>({x:sum.x+point.x/4,y:sum.y+point.y/4}),{x:0,y:0});
  const contrasts=ordered.map((point,index)=>{const end=ordered[(index+1)%4];const line={point,direction:{x:(end.x-point.x)/Math.max(1e-6,lengths[index]),y:(end.y-point.y)/Math.max(1e-6,lengths[index])}};return sideContrast(smooth,width,height,line,0,lengths[index],center)});
  const contrast=contrasts.reduce((sum,value)=>sum+value,0)/4;
  const outsideMargin=Math.max(4,fitted.short*.025);const outside=boundary.filter(point=>!insideQuadrilateral(corners,point,outsideMargin)).length/boundary.length;
  const fill=component.count/Math.max(1,area);
  const coverage=Math.min(...sides.map(side=>side.coverage));const straightness=Math.max(...sides.map(side=>side.rms));
  const edgeSupport=ordered.reduce((sum,point,index)=>sum+lineSupport(edges,width,height,point,ordered[(index+1)%4]),0)/4;
  const shapeScore=documentShapeScore(corners);
  const metrics={areaRatio,fill,outside,coverage,straightness:straightness/fitted.tolerance,contrast,minimumContrast:Math.min(...contrasts),contrastToSurface:contrast/threshold,edgeSupport,shapeScore,rectangularity,angles:angles.map(value=>Math.round(value))};
  const fits=ordered.every(point=>point.x>=-width*.02&&point.y>=-height*.02&&point.x<=width*1.02&&point.y<=height*1.02);
  const gates=[
    [areaRatio>=.1&&areaRatio<=.93,'area'],
    [!nearSourceFrame(corners,width,height,areaRatio,{strict:true}),'source-frame'],
    [fits,'outside-image'],
    [Math.min(...lengths)>=Math.min(width,height)*.18,'short-side'],
    [angles.every(value=>value>=60&&value<=120),'angles'],
    [fill>=(occluded?.8:.86)&&fill<=1.25,'fill'],
    [outside<=.08,'protrusion'],
    // A removed hand leaves part of one side without contour; the edge refit still has it.
    [coverage>=(occluded?.35:.55)&&sides.reduce((sum,side)=>sum+side.coverage,0)/4>=(occluded?.6:.7),'coverage'],
    [straightness<=Math.max(1.6,fitted.short*.014),'straightness'],
    [contrast>=Math.max(22,threshold*2)&&metrics.minimumContrast>=Math.max(12,threshold*1.5),'contrast'],
  ];
  const failed=gates.find(([passed])=>!passed);if(failed)return {rejected:failed[1],metrics,area,rectangularity};
  const confidence=clamp(.76+shapeScore*.05+clamp((Math.min(fill,1)-.86)/.12,0,1)*.05+coverage*.04+clamp((contrast-22)/40,0,1)*.04+edgeSupport*.03,0,.97);
  metrics.cornerRadius=cornerRadiusEstimate(labels,component.label,corners,sides,width,height);
  return {corners:Object.fromEntries(Object.entries(corners).map(([name,point])=>[name,{x:clamp(point.x,0,width-1),y:clamp(point.y,0,height-1)}])),confidence,areaRatio,area,metrics,rectangularity,source:'border-surface'};
}

// A hand or arm holding the card enters from the photo edge and joins the card in one
// foreground region. Grow it from where the region meets the photo edge through smooth,
// similar colour; the card boundary is a sharp step and stops it, so the hand (and the
// thumb lying on the card) is removed while the card stays. The outermost pixels are
// darkened by resampling, so growth starts a few pixels inside the frame.
function withoutFrameOccluder(component,labels,smooth,gradient,width,height){
  const {label}=component;const occluder=new Uint8Array(width*height);const reference=new Float32Array(width*height*3);const queue=new Int32Array(component.count);let head=0;let tail=0;
  const rim=4;const inRim=index=>{const x=index%width;const y=(index-x)/width;return x<rim||y<rim||x>=width-rim||y>=height-rim};
  const seed=(index,edge)=>{if(labels[edge]!==label||labels[index]!==label||occluder[index])return;occluder[index]=1;queue[tail++]=index;for(let channel=0;channel<3;channel+=1)reference[index*3+channel]=smooth[index*3+channel]};
  for(let x=Math.max(rim,component.minimumX);x<=Math.min(width-1-rim,component.maximumX);x+=1){seed(rim*width+x,x);seed((height-1-rim)*width+x,(height-1)*width+x)}
  for(let y=Math.max(rim,component.minimumY);y<=Math.min(height-1-rim,component.maximumY);y+=1){seed(y*width+rim,y*width);seed(y*width+width-1-rim,y*width+width-1)}
  if(tail<Math.max(8,Math.min(width,height)*.03))return null;
  while(head<tail){
    const index=queue[head++];const x=index%width;
    for(const neighbor of [x>0?index-1:-1,x<width-1?index+1:-1,index-width,index+width]){
      if(neighbor<0||neighbor>=width*height||labels[neighbor]!==label||occluder[neighbor]||inRim(neighbor)||gradient[neighbor]>8)continue;
      let squared=0;for(let channel=0;channel<3;channel+=1)squared+=(smooth[neighbor*3+channel]-reference[index*3+channel])**2;
      if(squared>18*18)continue;
      occluder[neighbor]=1;queue[tail++]=neighbor;
      for(let channel=0;channel<3;channel+=1){const previous=reference[index*3+channel];reference[neighbor*3+channel]=previous+(smooth[neighbor*3+channel]-previous)*.2}
    }
  }
  if(tail<component.count*.01||tail>component.count*.75)return null;
  // Widen the hand by its shadow and blurred outline, and take the frame rim with it.
  let removed=occluder;for(let step=Math.max(2,Math.round(Math.min(width,height)*.02));step>0;step-=1)removed=dilate(removed,width,height);
  let remaining=new Uint8Array(width*height);
  for(let y=component.minimumY;y<=component.maximumY;y+=1)for(let x=component.minimumX;x<=component.maximumX;x+=1){const index=y*width+x;remaining[index]=labels[index]===label&&!removed[index]&&!inRim(index)?1:0}
  remaining=dilate(dilate(erode(erode(remaining,width,height),width,height),width,height),width,height);
  const parts=labelComponents(remaining,width,height,component.count*.2);
  const card=parts.components.sort((left,right)=>right.count-left.count)[0];if(!card)return null;
  return {component:card,labels:parts.labels,occluderRatio:tail/component.count};
}

// Evaluate a region as a document; a region that reaches the photo edge and fails may be a
// card with the holding hand attached, so evaluate it again without that hand.
function evaluateRegion(component,labels,smooth,light,edges,width,height,threshold,gradientOf){
  const direct={...surfaceCandidate(component,labels,smooth,light,edges,width,height,threshold),component};
  const touchesFrame=component.minimumX===0||component.minimumY===0||component.maximumX===width-1||component.maximumY===height-1;
  if(!direct.rejected||!touchesFrame)return direct;
  const trimmed=withoutFrameOccluder(component,labels,smooth,gradientOf(),width,height);if(!trimmed)return direct;
  const held=surfaceCandidate(trimmed.component,trimmed.labels,smooth,light,edges,width,height,threshold,{occluded:true});
  if(held.rejected)return direct;
  held.metrics.occluder=trimmed.occluderRatio;
  return {...held,component,labels:trimmed.labels,heldComponent:trimmed.component};
}

// A card lying on a wallet, tray or book joins the holder in one irregular region, and the
// region's outline is part holder, part card. Split the region's colours into two groups
// (card and holder contrast strongly) and keep the group pieces that pass as a document.
function splitHolderRegion(component,labels,smooth,light,edges,width,height,threshold,gradientOf){
  const {label}=component;const pixels=[];
  for(let y=component.minimumY;y<=component.maximumY;y+=1)for(let x=component.minimumX;x<=component.maximumX;x+=1){const index=y*width+x;if(labels[index]===label)pixels.push(index)}
  const luminance=index=>smooth[index*3]*.299+smooth[index*3+1]*.587+smooth[index*3+2]*.114;
  const sample=pixels.filter((_,position)=>position%7===0).sort((left,right)=>luminance(left)-luminance(right));if(sample.length<50)return [];
  let centers=[sample[Math.floor(sample.length*.15)],sample[Math.floor(sample.length*.85)]].map(index=>[smooth[index*3],smooth[index*3+1],smooth[index*3+2]]);
  const nearest=index=>{let best=0;let bestDistance=Infinity;centers.forEach((center,group)=>{const value=(smooth[index*3]-center[0])**2+(smooth[index*3+1]-center[1])**2+(smooth[index*3+2]-center[2])**2;if(value<bestDistance){bestDistance=value;best=group}});return best};
  for(let iteration=0;iteration<6;iteration+=1){
    const sums=[[0,0,0,0],[0,0,0,0]];
    for(const index of sample){const group=nearest(index);for(let channel=0;channel<3;channel+=1)sums[group][channel]+=smooth[index*3+channel];sums[group][3]+=1}
    centers=sums.map((sum,group)=>sum[3]?[sum[0]/sum[3],sum[1]/sum[3],sum[2]/sum[3]]:centers[group]);
  }
  if(Math.hypot(centers[0][0]-centers[1][0],centers[0][1]-centers[1][1],centers[0][2]-centers[1][2])<Math.max(40,threshold*2))return [];
  const candidates=[];
  for(let group=0;group<2;group+=1){
    let mask=new Uint8Array(width*height);for(const index of pixels)if(nearest(index)===group)mask[index]=1;
    mask=dilate(dilate(erode(erode(mask,width,height),width,height),width,height),width,height);
    const parts=labelComponents(mask,width,height,width*height*.06);
    for(const part of parts.components.sort((left,right)=>right.count-left.count).slice(0,3)){
      const candidate=evaluateRegion(part,parts.labels,smooth,light,edges,width,height,threshold,gradientOf);
      if(!candidate.rejected&&candidate.areaRatio>=.08)candidates.push({labels:parts.labels,heldComponent:part,...candidate});
    }
  }
  return candidates.sort((left,right)=>right.area-left.area);
}

function surfaceCandidates(smooth,light,edges,width,height,domain,{adaptive=false}={}){
  const flood=floodSurface(smooth,width,height,domain,{adaptive});if(!flood)return {flood:null,valid:[],evaluated:[],adaptive};
  const {labels,components}=labelComponents(flood.foreground,width,height,Math.max(60,width*height*.03));
  let gradient=null;const gradientOf=()=>gradient??=gradientMagnitude(smooth,width,height);
  const evaluated=components.sort((left,right)=>right.count-left.count).slice(0,6).map(component=>domain?{...surfaceCandidate(component,labels,smooth,light,edges,width,height,flood.threshold),component}:evaluateRegion(component,labels,smooth,light,edges,width,height,flood.threshold,gradientOf));
  return {flood,labels,evaluated,adaptive,valid:evaluated.filter(candidate=>!candidate.rejected).sort((left,right)=>right.area-left.area)};
}

// A scanned or photographed page that fills most of the frame leaves no outline to find:
// its paper becomes the "surface" or merges with a strip of table at the sides. When most of
// the frame is paper-like (light, nearly colourless) and printed content covers much of it,
// the page itself is the document: crop to the content with a small margin. Specks, table
// strips and scanner shadows touching the frame are ignored.
function fullPageDocument(smooth,light,width,height){
  let paper=0;let samples=0;
  for(let index=0;index<width*height;index+=5){
    const red=smooth[index*3];const green=smooth[index*3+1];const blue=smooth[index*3+2];samples+=1;
    if(red*.299+green*.587+blue*.114>=150&&Math.max(red,green,blue)-Math.min(red,green,blue)<=40)paper+=1;
  }
  if(paper<samples*.5)return null;
  // The sheet ends where rows and columns stop being paper: a dark table, floor or wall at
  // the frame edge is trimmed from the outside in, so it never widens the crop. Paper is
  // judged against this photo's own paper level, so dim photos still count.
  const levels=[];
  for(let index=0;index<width*height;index+=7){const red=smooth[index*3];const green=smooth[index*3+1];const blue=smooth[index*3+2];if(Math.max(red,green,blue)-Math.min(red,green,blue)<=40)levels.push(red*.299+green*.587+blue*.114)}
  levels.sort((left,right)=>left-right);const paperLevel=levels[Math.floor(levels.length*.8)]||200;
  const rowPaper=new Uint32Array(height);const columnPaper=new Uint32Array(width);
  for(let y=0;y<height;y+=1)for(let x=0;x<width;x+=1){
    const index=y*width+x;const red=smooth[index*3];const green=smooth[index*3+1];const blue=smooth[index*3+2];
    if(red*.299+green*.587+blue*.114>=paperLevel*.72&&Math.max(red,green,blue)-Math.min(red,green,blue)<=40){rowPaper[y]+=1;columnPaper[x]+=1}
  }
  let sheetTop=0;let sheetBottom=height-1;let sheetLeft=0;let sheetRight=width-1;
  while(sheetTop<sheetBottom&&rowPaper[sheetTop]<width*.25)sheetTop+=1;
  while(sheetBottom>sheetTop&&rowPaper[sheetBottom]<width*.25)sheetBottom-=1;
  while(sheetLeft<sheetRight&&columnPaper[sheetLeft]<height*.25)sheetLeft+=1;
  while(sheetRight>sheetLeft&&columnPaper[sheetRight]<height*.25)sheetRight-=1;
  const tolerance=Math.max(2,Math.round(Math.min(width,height)*.005));
  // Printed content is fine detail: where the lightly blurred colour departs from the heavily
  // blurred one. Thin rules and small print stay; smooth shadows and paper tone do not.
  const content=new Uint8Array(width*height);
  for(let index=0;index<content.length;index+=1)content[index]=(light[index*3]-smooth[index*3])**2+(light[index*3+1]-smooth[index*3+1])**2+(light[index*3+2]-smooth[index*3+2])**2>18*18?1:0;
  const {components}=labelComponents(content,width,height,4);
  const kept=components.filter(component=>component.minimumX>1&&component.minimumY>1&&component.maximumX<width-2&&component.maximumY<height-2&&component.count<width*height*.25
    &&component.minimumX>=sheetLeft-tolerance&&component.maximumX<=sheetRight+tolerance&&component.minimumY>=sheetTop-tolerance&&component.maximumY<=sheetBottom+tolerance);
  let total=0;let left=width;let right=0;let top=height;let bottom=0;
  for(const component of kept){total+=component.count;left=Math.min(left,component.minimumX);right=Math.max(right,component.maximumX);top=Math.min(top,component.minimumY);bottom=Math.max(bottom,component.maximumY)}
  if(total<width*height*.01)return null;
  const pad=Math.round(Math.min(width,height)*.02);
  const x0=Math.max(sheetLeft,left-pad);const x1=Math.min(sheetRight,right+pad);const y0=Math.max(sheetTop,top-pad);const y1=Math.min(sheetBottom,bottom+pad);
  const area=(x1-x0+1)*(y1-y0+1);const areaRatio=area/(width*height);
  if(areaRatio<.35||total/area>.5)return null;
  return {corners:{topLeft:{x:x0,y:y0},topRight:{x:x1,y:y0},bottomRight:{x:x1,y:y1},bottomLeft:{x:x0,y:y1}},confidence:.8,areaRatio,area,source:'full-page',metrics:{areaRatio,page:Number((total/area).toFixed(3)),cornerRadius:0}};
}

// Strict surface model first; illumination adaptation only when it finds no document.
function surfaceLevel(smooth,light,edges,width,height,domain){
  const strict=surfaceCandidates(smooth,light,edges,width,height,domain);
  if(strict.valid.length||!strict.flood)return strict;
  const adapted=surfaceCandidates(smooth,light,edges,width,height,domain,{adaptive:true});
  return adapted.valid.length?adapted:{...strict,contentRatioAdapted:adapted.flood?.contentRatio};
}

function borderSurfaceDetection(working,edges){
  const {width,height}=working;
  const smooth=smoothColor(working.color,width,height,2,2);const light=smoothColor(working.color,width,height,1,1);
  const level=surfaceLevel(smooth,light,edges,width,height,null);
  let gradient=null;const gradientOf=()=>gradient??=gradientMagnitude(smooth,width,height);
  const summary={floodThreshold:level.flood?Number(level.flood.threshold.toFixed(1)):null,floodMode:level.adaptive?'adaptive':'strict',calmGradient:level.flood?Number(level.flood.calm.toFixed(2)):null,foregroundRegions:level.evaluated.length,surfaceCandidates:level.valid.length,rejected:level.evaluated.filter(candidate=>candidate.rejected).slice(0,4).map(candidate=>`${candidate.rejected}:${(candidate.component.count/(width*height)).toFixed(2)}`)};
  const result={background:level.flood?.background||null,labels:level.labels||null,components:level.evaluated.map(candidate=>({...candidate.component,rejected:candidate.rejected||null})),summary,smooth,light};
  if(!level.valid.length){
    // A card lying on a wallet, tray or book joins the holder in one irregular region.
    // Peel the holder off from that region's own outline; the card is what is left.
    const holder=level.evaluated.find(candidate=>['protrusion','fill','coverage','angles','straightness','no-sides','no-corners'].includes(candidate.rejected)&&candidate.component.count>=width*height*.12);
    if(holder){
      const cards=splitHolderRegion(holder.component,level.labels,smooth,light,edges,width,height,level.flood.threshold,gradientOf);
      summary.holder=`${(holder.component.count/(width*height)).toFixed(2)}/${cards.map(candidate=>candidate.areaRatio.toFixed(2)).join(',')}`;
      if(cards.length>1&&cards[1].area>=cards[0].area*.35)return {...result,status:'multiple',summary};
      if(cards.length)return {...result,status:'document',candidate:cards[0],summary};
    }
    const page=fullPageDocument(smooth,light,width,height);
    if(page)return {...result,status:'document',candidate:page,summary};
    return {...result,status:'none'};
  }
  const best=level.valid[0];
  // Another large, rectangular foreground region (a second card, even one we could not
  // fit cleanly) makes the choice ambiguous: never crop one of them silently.
  const competing=level.evaluated.filter(candidate=>candidate!==best&&candidate.component.count>=best.component.count*.35&&(!candidate.rejected||candidate.rectangularity>=.8));
  if(competing.length)return {...result,status:'multiple'};
  const frameLike=nearSourceFrame(best.corners,width,height,best.areaRatio);
  const domainLabels=best.labels||level.labels;const domainLabel=(best.heldComponent||best.component).label;
  const domain=new Uint8Array(width*height);for(let index=0;index<domain.length;index+=1)domain[index]=domainLabels[index]===domainLabel?1:0;
  const inner=surfaceLevel(smooth,light,edges,width,height,domain);
  const insideBest=candidate=>candidate.area>=best.area*.18&&candidate.area<=best.area*.86;
  let nested=inner.valid.filter(insideBest);
  const contentRatio=inner.contentRatioAdapted??inner.flood?.contentRatio;
  // Only a large inner region the surface model could not fit is worth splitting by colour.
  if(!nested.length&&inner.evaluated.some(candidate=>candidate.component.count>=(best.heldComponent||best.component).count*.18))nested=splitHolderRegion(best.heldComponent||best.component,domainLabels,smooth,light,edges,width,height,level.flood.threshold,gradientOf).filter(insideBest);
  summary.nested=`${inner.flood?inner.flood.threshold.toFixed(1):'none'}/${inner.flood?contentRatio.toFixed(3):'-'}/${inner.evaluated.map(candidate=>candidate.rejected?`${candidate.rejected}:${(candidate.component.count/(width*height)).toFixed(2)}`:`ok:${candidate.areaRatio.toFixed(2)}`).join(',')}`;
  if(nested.length){
    // A wallet, tray, book or mat under the card is itself rectangular. Cards and papers are
    // lighter than the wallets, trays and tables they lie on, so a clearly lighter inner
    // rectangle is the document; a darker one is a panel printed on the outer document.
    const card=nested[0];let outside=0;let content=0;let innerLight=0;let innerCount=0;let outerLight=0;const margin=Math.max(3,Math.min(width,height)*.02);
    for(let index=0;index<domain.length;index+=2){
      if(!domain[index])continue;const x=index%width;const point={x,y:(index-x)/width};const value=smooth[index*3]*.299+smooth[index*3+1]*.587+smooth[index*3+2]*.114;
      if(insideQuadrilateral(card.corners,point,-margin)){innerLight+=value;innerCount+=1;continue}
      if(insideQuadrilateral(card.corners,point,margin))continue;outside+=1;outerLight+=value;content+=inner.flood?.foreground?.[index]||0;
    }
    const between=content/Math.max(1,outside);const lighter=innerLight/Math.max(1,innerCount)-outerLight/Math.max(1,outside);
    summary.holderContent=Number(between.toFixed(3));summary.innerLighter=Math.round(lighter);
    if(lighter>=25&&!(nested[1]&&nested[1].area>=card.area*.35))return {...result,status:'document',candidate:card,summary};
    if(frameLike)return {...result,status:'nested',candidate:best,summary};
  }
  // A frame-filling region with no content of its own is the surface seen through a
  // photo frame or mat, not a document.
  if(frameLike&&inner.flood&&contentRatio<.01)return {...result,status:'frame',summary};
  return {...result,status:'document',candidate:best};
}

// When the surface model found no clean document, an edge/patch crop is only trusted if
// the surface did not grow into it and it covers essentially the same region the surface
// model separated: not a panel inside a larger foreground region, and not a region whose
// boundary the surface model saw but could not trust (a side too weak to locate, two
// touching cards, a card with a large attached object).
function surfaceConsistent(surface,corners,width,height){
  if(!surface.background)return true;
  const ordered=[corners.topLeft,corners.topRight,corners.bottomRight,corners.bottomLeft];const center=ordered.reduce((sum,point)=>({x:sum.x+point.x/4,y:sum.y+point.y/4}),{x:0,y:0});
  const inner=Object.fromEntries(Object.entries(corners).map(([name,point])=>[name,{x:center.x+(point.x-center.x)*.85,y:center.y+(point.y-center.y)*.85}]));
  let samples=0;let grown=0;
  for(let y=0;y<height;y+=3)for(let x=0;x<width;x+=3){if(!insideQuadrilateral(inner,{x,y}))continue;samples+=1;grown+=surface.background[y*width+x]}
  if(!samples||grown/samples>.25)return false;
  const label=surface.labels?.[Math.round(center.y)*width+Math.round(center.x)];
  const region=surface.components.find(component=>component.label===label);
  if(!region||['contrast','fill','protrusion','coverage','straightness','angles','no-sides','no-corners'].includes(region.rejected))return false;
  let both=0;let either=0;
  for(let y=region.minimumY;y<=region.maximumY;y+=2)for(let x=region.minimumX;x<=region.maximumX;x+=2){const inRegion=surface.labels[y*width+x]===label;const inQuad=insideQuadrilateral(corners,{x,y});both+=inRegion&&inQuad?1:0;either+=inRegion||inQuad?1:0}
  const quadArea=polygonArea(corners);const regionBox=(region.maximumX-region.minimumX+1)*(region.maximumY-region.minimumY+1);
  return quadArea<=regionBox*1.1&&both/Math.max(1,either)>=.85;
}

// Printed text: small dark marks of similar height standing side by side. A row of at least
// five, at least six heights long, counts as a line of text. Cards carry a few such lines,
// pages dozens; pets, faces and rooms produce scattered marks but hardly any rows.
function textLines(working,smooth,light,corners){
  const {width,height}=working;const tone=(values,index)=>values[index*3]*.299+values[index*3+1]*.587+values[index*3+2]*.114;
  const ink=new Uint8Array(width*height);
  for(let index=0;index<ink.length;index+=1){
    const difference=(light[index*3]-smooth[index*3])**2+(light[index*3+1]-smooth[index*3+1])**2+(light[index*3+2]-smooth[index*3+2])**2;
    ink[index]=difference>18*18&&tone(light,index)<tone(smooth,index)-6?1:0;
  }
  const {components}=labelComponents(ink,width,height,3);
  const glyphs=components.filter(component=>{
    const tall=component.maximumY-component.minimumY+1;const wide=component.maximumX-component.minimumX+1;
    if(tall<3||tall>height*.05||wide>width*.15||component.minimumX<=1||component.minimumY<=1||component.maximumX>=width-2||component.maximumY>=height-2)return false;
    return !corners||insideQuadrilateral(corners,{x:(component.minimumX+component.maximumX)/2,y:(component.minimumY+component.maximumY)/2});
  }).map(component=>({left:component.minimumX,right:component.maximumX,middle:(component.minimumY+component.maximumY)/2,tall:component.maximumY-component.minimumY+1})).sort((first,second)=>first.middle-second.middle);
  const parent=glyphs.map((_,index)=>index);const root=index=>parent[index]===index?index:(parent[index]=root(parent[index]));
  for(let index=0;index<glyphs.length;index+=1){
    const glyph=glyphs[index];
    for(let other=index-1;other>=0&&glyph.middle-glyphs[other].middle<=glyph.tall;other-=1){
      const neighbor=glyphs[other];const size=Math.max(glyph.tall,neighbor.tall);
      if(Math.abs(glyph.middle-neighbor.middle)<=size*.5&&Math.max(neighbor.left-glyph.right,glyph.left-neighbor.right)<=size*2.5&&Math.abs(glyph.tall-neighbor.tall)<=size*.6)parent[root(index)]=root(other);
    }
  }
  const rows=new Map();
  glyphs.forEach((glyph,index)=>{const key=root(index);const row=rows.get(key)||{count:0,left:Infinity,right:-Infinity,heights:[]};row.count+=1;row.left=Math.min(row.left,glyph.left);row.right=Math.max(row.right,glyph.right);row.heights.push(glyph.tall);rows.set(key,row)});
  let lines=0;
  for(const row of rows.values()){row.heights.sort((first,second)=>first-second);if(row.count>=5&&row.right-row.left>=6*row.heights[Math.floor(row.heights.length/2)])lines+=1}
  return lines;
}

// Pages are whitened like scans. A page is a full-page crop, or a large, mostly
// paper-coloured rectangle with square corners that is not card-shaped: ID-1 cards are
// 1.59:1 with rounded corners, while A4 is 1.41:1, Letter 1.29:1 and receipts are long strips.
function pageLike(working,corners){
  const {width,height,color}=working;const ordered=[corners.topLeft,corners.topRight,corners.bottomRight,corners.bottomLeft];
  const side=(start,end)=>Math.hypot(end.x-start.x,end.y-start.y);
  const across=(side(ordered[0],ordered[1])+side(ordered[3],ordered[2]))/2;const down=(side(ordered[0],ordered[3])+side(ordered[1],ordered[2]))/2;
  const aspect=Math.max(across,down)/Math.max(1,Math.min(across,down));
  if(polygonArea(corners)<width*height*.3||(aspect>1.5&&aspect<1.9))return false;
  const tones=[];let samples=0;
  for(let y=0;y<height;y+=2)for(let x=0;x<width;x+=2){
    if(!insideQuadrilateral(corners,{x,y}))continue;samples+=1;const index=(y*width+x)*3;
    const red=color[index];const green=color[index+1];const blue=color[index+2];
    if(Math.max(red,green,blue)-Math.min(red,green,blue)<=40)tones.push(red*.299+green*.587+blue*.114);
  }
  if(!samples)return false;tones.sort((left,right)=>left-right);const level=tones[Math.floor(tones.length*.8)]||0;
  return level>=110&&tones.filter(tone=>tone>=level*.72).length>=samples*.55;
}

export function detectDocumentCorners(imageData, {maximumEdge = 720} = {}) {
  if (!imageData || !Number.isInteger(imageData.width) || !Number.isInteger(imageData.height) || !imageData.data) throw new TypeError('Valid image data is required.');
  const working = workingGray(imageData, maximumEdge);
  const blurred=boxBlur(working.gray,working.width,working.height);
  const grayEdges=sobelEdges(blurred,working.width,working.height);const chromaEdges=colorEdges(working.color,working.width,working.height);
  const combined=new Uint8Array(grayEdges.length);for(let index=0;index<combined.length;index+=1)combined[index]=grayEdges[index]||chromaEdges[index]?1:0;
  // The border-connected surface model decides whenever it sees exactly one document;
  // it vetoes crops when several documents compete and defers to the edge/patch
  // pipeline only for frame-like regions (photo of a mat) or when it found nothing.
  const surface=borderSurfaceDetection(working,combined);
  let legacy=null;let reason='automatic-detection-uncertain';let legacyConfidence=0;
  if(surface.status==='nested'||surface.status==='none'){
    const selection=edgeAndPatchSelection(working,blurred,combined);
    legacy=selection.best&&selection.best.confidence>=.75?selection.best:null;reason=selection.uncertainReason;legacyConfidence=selection.best?.confidence||0;
  }
  let chosen=null;
  if(surface.status==='document')chosen=surface.candidate;
  else if(surface.status==='multiple')reason='competing-documents';
  else if(surface.status==='nested'){chosen=legacy;if(!legacy)reason='competing-boundaries'}
  else if(surface.status==='none'&&legacy&&surfaceConsistent(surface,legacy.corners,working.width,working.height))chosen=legacy;
  // Wallet items are cards and documents: they carry printed rows of text. A photo with no
  // such rows (a pet, a person, a room) is not cropped, and the scanner refuses to save it.
  const lines=textLines(working,surface.smooth,surface.light,null);
  if(lines<2){chosen=null;reason='not-a-document'}
  // A whole-frame page must read like a page (documents show dozens of lines; fur, faces and
  // rooms a handful); a card needs a couple of lines of print inside its outline.
  else if(chosen&&textLines(working,surface.smooth,surface.light,chosen.corners)<(chosen.source==='full-page'?12:2)){chosen=null;reason='automatic-detection-uncertain'}
  const diagnostics=scanDiagnostics(working,surface,legacy,chosen);
  diagnostics.textLines=lines;
  if (!chosen) return {corners:defaultDocumentCorners(imageData.width,imageData.height),confidence:legacyConfidence,mode:'manual',reason,diagnostics};
  const scaleBack = 1 / working.scale;
  const scaled = Object.fromEntries(Object.entries(chosen.corners).map(([name,point]) => [name,{x:Math.round(point.x*scaleBack),y:Math.round(point.y*scaleBack)}]));
  return {corners:scaled,confidence:Number(chosen.confidence.toFixed(3)),mode:'automatic',reason:'document-quadrilateral',cornerRadius:Number((chosen.metrics?.cornerRadius||0).toFixed(4)),paper:chosen.source==='full-page'||((chosen.metrics?.cornerRadius||0)<.02&&pageLike(working,chosen.corners)),diagnostics};
}

// Edge-component and corner-patch candidates (the original pipeline).
function edgeAndPatchSelection(working,blurred,combined){
  const binary = dilate(combined, working.width, working.height);
  const candidates=[];
  for (const candidate of componentCandidates(binary, working.width, working.height)) {
    const corners = candidate.corners;
    const points = [corners.topLeft,corners.topRight,corners.bottomRight,corners.bottomLeft];
    if (new Set(points.map(point => `${point.x}:${point.y}`)).size !== 4) continue;
    const areaRatio = polygonArea(corners) / (working.width * working.height);
    const edges = [[corners.topLeft,corners.topRight],[corners.topRight,corners.bottomRight],[corners.bottomRight,corners.bottomLeft],[corners.bottomLeft,corners.topLeft]];
    const shortestEdge = Math.min(...edges.map(([start,end]) => Math.hypot(end.x-start.x,end.y-start.y)));
    const support = edges.reduce((sum,[start,end]) => sum + lineSupport(binary,working.width,working.height,start,end),0) / 4;
    const contrast=edges.reduce((sum,[start,end])=>sum+Math.max(boundaryContrast(blurred,working.width,working.height,start,end),colorBoundaryContrast(working.color,working.width,working.height,start,end)),0)/4;
    if (areaRatio < 0.18 || shortestEdge < Math.min(working.width,working.height) * 0.16 || support < 0.46 || contrast < 7) continue;
    const areaScore = clamp((areaRatio-0.18)/0.7,0,1);
    const shapeScore=documentShapeScore(corners);
    const contrastScore=clamp((contrast-7)/35,0,1);
    const confidence = clamp(0.38 + areaScore * 0.30 + support * 0.18 + shapeScore * 0.14 + contrastScore * 0.08, 0, 0.99);
    candidates.push({corners,confidence,areaRatio});
  }
  const edgeCandidates=[...candidates];
  const separatedCandidates=backgroundSeparatedCandidates(working.color,combined,working.width,working.height);
  candidates.push(...separatedCandidates);
  let best=[...candidates].sort((left,right)=>right.confidence-left.confidence)[0]||null;
  let uncertainReason='automatic-detection-uncertain';
  if(separatedCandidates.length){
    const separated=separatedCandidates[0];const separatedPoints=Object.values(separated.corners);const separatedCenter=separatedPoints.reduce((sum,point)=>({x:sum.x+point.x/4,y:sum.y+point.y/4}),{x:0,y:0});
    const matching=edgeCandidates.filter(candidate=>{
      const ratio=candidate.areaRatio/separated.areaRatio;if(ratio<.72||ratio>1.28)return false;
      const points=Object.values(candidate.corners);const center=points.reduce((sum,point)=>({x:sum.x+point.x/4,y:sum.y+point.y/4}),{x:0,y:0});
      return Math.hypot(center.x-separatedCenter.x,center.y-separatedCenter.y)<=Math.min(working.width,working.height)*.12;
    }).sort((left,right)=>right.confidence-left.confidence);
    const credibleSeparated=separatedCandidates.find(candidate=>candidate.boundarySupport>=.28||candidate.support>=.18||candidate.contrast>=6);
    if(matching.length)best=matching[0];else if(credibleSeparated)best=credibleSeparated;else{best=null;uncertainReason='automatic-detection-uncertain'}
  }else{
    const frameCandidates=candidates.filter(candidate=>nearSourceFrame(candidate.corners,working.width,working.height,candidate.areaRatio)).sort((left,right)=>right.areaRatio-left.areaRatio);
    for(const frame of frameCandidates){
      const nested=candidates.filter(candidate=>candidate!==frame&&candidate.areaRatio<=frame.areaRatio*.86&&containsCorners(frame.corners,candidate.corners)).sort((left,right)=>right.confidence-left.confidence);
      if(!nested.length)continue;
      const inner=nested[0];
      if(inner.confidence-frame.confidence>.08){best=inner;break}
      best=null;uncertainReason='competing-boundaries';break;
    }
  }
  if(best&&nearSourceFrame(best.corners,working.width,working.height,best.areaRatio,{strict:true})&&!candidates.some(candidate=>candidate!==best&&containsCorners(best.corners,candidate.corners)))best=null;
  return {best,uncertainReason};
}

// Non-identifying geometry/statistics only: no pixel values, text or image content.
function scanDiagnostics(working,surface,legacy,chosen){
  const round=value=>typeof value==='number'?Number(value.toFixed(3)):value;
  const diagnostics={working:`${working.width}x${working.height}`,surface:surface.status,legacy:surface.status==='nested'||surface.status==='none'?(legacy?(legacy.source||'edge-components'):'none'):'skipped',source:chosen?(chosen.source||'edge-components'):'none',...surface.summary};
  if(chosen){
    const points=Object.values(chosen.corners);const xs=points.map(point=>point.x);const ys=points.map(point=>point.y);
    diagnostics.bounds=[Math.min(...xs)/working.width,Math.min(...ys)/working.height,Math.max(...xs)/working.width,Math.max(...ys)/working.height].map(round);
    diagnostics.areaRatio=round(chosen.areaRatio);
  }
  if(chosen?.metrics)for(const [name,value] of Object.entries(chosen.metrics))diagnostics[name]=Array.isArray(value)?value:round(value);
  return diagnostics;
}

function distance(left, right) { return Math.hypot(right.x - left.x, right.y - left.y); }

function solveLinearSystem(matrix, values) {
  const size = values.length;
  const rows = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    if (Math.abs(rows[pivot][column]) < 1e-10) throw new Error('문서 모서리를 다시 조정해 주세요.');
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let index = column; index <= size; index += 1) rows[column][index] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let index = column; index <= size; index += 1) rows[row][index] -= factor * rows[column][index];
    }
  }
  return rows.map(row => row[size]);
}

function homography(destination, source) {
  const matrix = []; const values = [];
  for (let index = 0; index < 4; index += 1) {
    const x = destination[index].x; const y = destination[index].y;
    const sourceX = source[index].x; const sourceY = source[index].y;
    matrix.push([x,y,1,0,0,0,-sourceX*x,-sourceX*y]); values.push(sourceX);
    matrix.push([0,0,0,x,y,1,-sourceY*x,-sourceY*y]); values.push(sourceY);
  }
  return solveLinearSystem(matrix, values);
}

function bilinearSample(data, width, height, x, y, channel) {
  const left = clamp(Math.floor(x), 0, width - 1); const right = clamp(left + 1, 0, width - 1);
  const top = clamp(Math.floor(y), 0, height - 1); const bottom = clamp(top + 1, 0, height - 1);
  const horizontal = clamp(x - left, 0, 1); const vertical = clamp(y - top, 0, 1);
  const topValue = data[(top * width + left) * 4 + channel] * (1 - horizontal) + data[(top * width + right) * 4 + channel] * horizontal;
  const bottomValue = data[(bottom * width + left) * 4 + channel] * (1 - horizontal) + data[(bottom * width + right) * 4 + channel] * horizontal;
  return Math.round(topValue * (1 - vertical) + bottomValue * vertical);
}

function sourceImageData(source) {
  const width = source.naturalWidth || source.videoWidth || source.width;
  const height = source.naturalHeight || source.videoHeight || source.height;
  if (!width || !height || typeof document === 'undefined') throw new TypeError('A decoded browser image source is required.');
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', {willReadFrequently:true}); context.drawImage(source,0,0,width,height);
  return context.getImageData(0,0,width,height);
}

function enhancePixels(imageData) {
  const source = imageData.data; const width = imageData.width; const height = imageData.height;
  const channelMeans = [0,0,0]; let luminanceMean = 0;
  for (let index = 0; index < source.length; index += 4) {
    channelMeans[0] += source[index]; channelMeans[1] += source[index+1]; channelMeans[2] += source[index+2];
    luminanceMean += source[index]*0.299+source[index+1]*0.587+source[index+2]*0.114;
  }
  const pixels = width * height;
  channelMeans.forEach((value,index) => { channelMeans[index] = value / pixels; }); luminanceMean /= pixels;
  const exposure = clamp(136 / Math.max(1,luminanceMean),0.88,1.12);
  const neutral = (channelMeans[0]+channelMeans[1]+channelMeans[2])/3;
  const balance = channelMeans.map(value => clamp(neutral/Math.max(1,value),0.92,1.08));
  const softened = new Uint8ClampedArray(source);
  for (let y=1;y<height-1;y+=1) for (let x=1;x<width-1;x+=1) {
    const offset=(y*width+x)*4;
    for (let channel=0;channel<3;channel+=1) {
      const average=(source[offset-width*4+channel]+source[offset-4+channel]+source[offset+channel]+source[offset+4+channel]+source[offset+width*4+channel])/5;
      softened[offset+channel]=Math.round(source[offset+channel]*0.92+average*0.08);
    }
  }
  const output = new ImageData(width,height);
  for (let y=0;y<height;y+=1) for (let x=0;x<width;x+=1) {
    const offset=(y*width+x)*4;
    for (let channel=0;channel<3;channel+=1) {
      let blurred=softened[offset+channel];
      if (x>0&&x<width-1&&y>0&&y<height-1) blurred=(softened[offset-width*4+channel]+softened[offset-4+channel]+softened[offset+channel]+softened[offset+4+channel]+softened[offset+width*4+channel])/5;
      const sharpened=softened[offset+channel]+(softened[offset+channel]-blurred)*0.24;
      output.data[offset+channel]=clamp(Math.round(((sharpened-128)*1.06+128)*exposure*balance[channel]),0,255);
    }
    output.data[offset+3]=255;
  }
  return output;
}

// Pages (contracts, certificates): even out the light so the paper reads white and print
// stays dark, like a document scanner. The local paper level is the brightest tone in each
// small cell, spread and smoothed; every colour is scaled by it, so stamps and signatures
// keep their hue. Gain is capped, so a dark photo or table stays dark instead of turning white.
function whitenPaper(imageData){
  const {data,width,height}=imageData;const cell=Math.max(4,Math.round(Math.min(width,height)/96));
  const columns=Math.ceil(width/cell);const rows=Math.ceil(height/cell);let peak=new Float32Array(columns*rows);
  for(let y=0;y<height;y+=1)for(let x=0;x<width;x+=1){const offset=(y*width+x)*4;const value=data[offset]*.299+data[offset+1]*.587+data[offset+2]*.114;const index=Math.floor(y/cell)*columns+Math.floor(x/cell);if(value>peak[index])peak[index]=value}
  const spread=(values,reduce)=>{
    const next=new Float32Array(values.length);
    for(let row=0;row<rows;row+=1)for(let column=0;column<columns;column+=1){
      let maximum=0;let sum=0;let count=0;
      for(let dy=-2;dy<=2;dy+=1)for(let dx=-2;dx<=2;dx+=1){const y=row+dy;const x=column+dx;if(y<0||x<0||y>=rows||x>=columns)continue;const value=values[y*columns+x];maximum=Math.max(maximum,value);sum+=value;count+=1}
      next[row*columns+column]=reduce==='max'?maximum:sum/count;
    }
    return next;
  };
  peak=spread(spread(peak,'max'),'mean');
  const output=new ImageData(width,height);const out=output.data;
  for(let y=0;y<height;y+=1){
    const gridY=clamp((y+.5)/cell-.5,0,rows-1);const row0=Math.floor(gridY);const row1=Math.min(rows-1,row0+1);const fy=gridY-row0;
    for(let x=0;x<width;x+=1){
      const gridX=clamp((x+.5)/cell-.5,0,columns-1);const column0=Math.floor(gridX);const column1=Math.min(columns-1,column0+1);const fx=gridX-column0;
      const level=(peak[row0*columns+column0]*(1-fx)+peak[row0*columns+column1]*fx)*(1-fy)+(peak[row1*columns+column0]*(1-fx)+peak[row1*columns+column1]*fx)*fy;
      const gain=clamp(246/Math.max(1,level),.95,1.6);const offset=(y*width+x)*4;
      for(let channel=0;channel<3;channel+=1)out[offset+channel]=clamp(Math.round(255*Math.pow(clamp(data[offset+channel]*gain,0,255)/255,1.2)),0,255);
      out[offset+3]=255;
    }
  }
  return output;
}

export function assessDocumentQuality(imageData, {corners} = {}) {
  const warnings = [];
  const {data,width,height}=imageData; const pixels=width*height;
  if (Math.min(width,height)<400 || pixels<480_000) warnings.push('low-resolution');
  let glare=0; let laplacian=0; let laplacianSamples=0;
  const luminance = new Float32Array(pixels);
  for (let index=0;index<pixels;index+=1) {
    const offset=index*4; const value=data[offset]*0.299+data[offset+1]*0.587+data[offset+2]*0.114; luminance[index]=value;
    if (value>247 && Math.max(data[offset],data[offset+1],data[offset+2])-Math.min(data[offset],data[offset+1],data[offset+2])<10) glare+=1;
  }
  for (let y=1;y<height-1;y+=1) for (let x=1;x<width-1;x+=1) {
    const index=y*width+x; laplacian+=Math.abs(luminance[index]*4-luminance[index-1]-luminance[index+1]-luminance[index-width]-luminance[index+width]); laplacianSamples+=1;
  }
  if (laplacian/Math.max(1,laplacianSamples)<5.5) warnings.push('blur');
  if (glare/pixels>0.16) warnings.push('glare');
  if (corners) {
    const margin=Math.max(2,Math.min(width,height)*0.006);
    if (Object.values(corners).some(point=>point.x<=margin||point.y<=margin||point.x>=width-1-margin||point.y>=height-1-margin)) warnings.push('edge-clipped');
  }
  return warnings;
}

// Pixels outside a rounded card corner are surface, not card: give them the colour of the
// card just inside the corner arc so the corrected card carries no background wedges.
function fillRoundedCorners(imageData,relativeRadius){
  const {data,width,height}=imageData;const radius=relativeRadius*Math.min(width,height);if(radius<2)return;
  for(const [cornerX,cornerY,signX,signY] of [[0,0,1,1],[width-1,0,-1,1],[width-1,height-1,-1,-1],[0,height-1,1,-1]]){
    const centerX=cornerX+signX*radius;const centerY=cornerY+signY*radius;const color=[0,0,0];let count=0;
    for(let angle=.25;angle<=1.32;angle+=.08){
      for(const ring of [radius-4,radius-2.5]){
        const x=Math.round(centerX-signX*Math.cos(angle)*ring);const y=Math.round(centerY-signY*Math.sin(angle)*ring);
        if(x<0||y<0||x>=width||y>=height)continue;const offset=(y*width+x)*4;color[0]+=data[offset];color[1]+=data[offset+1];color[2]+=data[offset+2];count+=1;
      }
    }
    if(!count)continue;color.forEach((value,index)=>{color[index]=value/count});
    for(let dy=0;dy<=Math.ceil(radius);dy+=1)for(let dx=0;dx<=Math.ceil(radius);dx+=1){
      const x=cornerX+signX*dx;const y=cornerY+signY*dy;if(x<0||y<0||x>=width||y>=height)continue;
      const outside=Math.hypot(centerX-x,centerY-y)-radius;if(outside<=-1||(dx>radius&&dy>radius))continue;
      const weight=clamp((outside+1)/2,0,1);const offset=(y*width+x)*4;
      for(let channel=0;channel<3;channel+=1)data[offset+channel]=Math.round(data[offset+channel]*(1-weight)+color[channel]*weight);
    }
  }
}

export async function rectifyDocument(source, corners, {enhance=true, cornerRadius=0, paper=false} = {}) {
  const sourcePixels=sourceImageData(source); const ordered=orderDocumentCorners(Object.values(corners));
  const estimatedWidth=(distance(ordered.topLeft,ordered.topRight)+distance(ordered.bottomLeft,ordered.bottomRight))/2;
  const estimatedHeight=(distance(ordered.topLeft,ordered.bottomLeft)+distance(ordered.topRight,ordered.bottomRight))/2;
  const sourceMaximum=Math.max(sourcePixels.width,sourcePixels.height);
  const scale=Math.min(1,2048/Math.max(estimatedWidth,estimatedHeight),sourceMaximum/Math.max(estimatedWidth,estimatedHeight));
  const width=Math.max(2,Math.round(estimatedWidth*scale)); const height=Math.max(2,Math.round(estimatedHeight*scale));
  const destination=[{x:0,y:0},{x:width-1,y:0},{x:width-1,y:height-1},{x:0,y:height-1}];
  const sourceCorners=[ordered.topLeft,ordered.topRight,ordered.bottomRight,ordered.bottomLeft];
  const transform=homography(destination,sourceCorners); const corrected=new ImageData(width,height);
  for (let y=0;y<height;y+=1) for (let x=0;x<width;x+=1) {
    const denominator=transform[6]*x+transform[7]*y+1;
    const sourceX=(transform[0]*x+transform[1]*y+transform[2])/denominator;
    const sourceY=(transform[3]*x+transform[4]*y+transform[5])/denominator;
    const offset=(y*width+x)*4;
    for (let channel=0;channel<3;channel+=1) corrected.data[offset+channel]=bilinearSample(sourcePixels.data,sourcePixels.width,sourcePixels.height,sourceX,sourceY,channel);
    corrected.data[offset+3]=255;
  }
  if(cornerRadius>0)fillRoundedCorners(corrected,Math.min(.12,cornerRadius));
  const output=enhance?(paper?whitenPaper(corrected):enhancePixels(corrected)):corrected;
  const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height; canvas.getContext('2d').putImageData(output,0,0);
  // A page that fills the frame is expected to reach its edges, white paper is not glare on a
  // glossy card, and a page's blank margins drag the whole-image sharpness measure down even
  // when the print is crisp: pages are checked for resolution only.
  const warnings=[...new Set([...assessDocumentQuality(output),...assessDocumentQuality(sourcePixels,{corners:paper?null:ordered})])].filter(code=>!paper||code==='low-resolution');
  return {dataUrl:canvas.toDataURL('image/jpeg',0.92),width,height,warnings,enhanced:Boolean(enhance)};
}
