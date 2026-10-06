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

export function defaultDocumentCorners(width, height) {
  const insetX = Math.max(1, Math.round(width * 0.06));
  const insetY = Math.max(1, Math.round(height * 0.08));
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
  const source = imageData.data;
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(imageData.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(imageData.width - 1, Math.floor(x / scale));
      const offset = (sourceY * imageData.width + sourceX) * 4;
      gray[y * width + x] = Math.round(source[offset] * 0.299 + source[offset + 1] * 0.587 + source[offset + 2] * 0.114);
    }
  }
  return {gray, width, height, scale};
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

export function detectDocumentCorners(imageData, {maximumEdge = 720} = {}) {
  if (!imageData || !Number.isInteger(imageData.width) || !Number.isInteger(imageData.height) || !imageData.data) throw new TypeError('Valid image data is required.');
  const working = workingGray(imageData, maximumEdge);
  const blurred=boxBlur(working.gray,working.width,working.height);
  const binary = dilate(sobelEdges(blurred, working.width, working.height), working.width, working.height);
  let best = null;
  for (const candidate of componentCandidates(binary, working.width, working.height)) {
    const corners = candidate.corners;
    const points = [corners.topLeft,corners.topRight,corners.bottomRight,corners.bottomLeft];
    if (new Set(points.map(point => `${point.x}:${point.y}`)).size !== 4) continue;
    const areaRatio = polygonArea(corners) / (working.width * working.height);
    const edges = [[corners.topLeft,corners.topRight],[corners.topRight,corners.bottomRight],[corners.bottomRight,corners.bottomLeft],[corners.bottomLeft,corners.topLeft]];
    const shortestEdge = Math.min(...edges.map(([start,end]) => Math.hypot(end.x-start.x,end.y-start.y)));
    const support = edges.reduce((sum,[start,end]) => sum + lineSupport(binary,working.width,working.height,start,end),0) / 4;
    const contrast=edges.reduce((sum,[start,end])=>sum+boundaryContrast(blurred,working.width,working.height,start,end),0)/4;
    if (areaRatio < 0.18 || shortestEdge < Math.min(working.width,working.height) * 0.16 || support < 0.46 || contrast < 7) continue;
    const areaScore = clamp((areaRatio - 0.18) / 0.42, 0, 1);
    const confidence = clamp(0.56 + areaScore * 0.24 + support * 0.22, 0, 0.99);
    if (!best || confidence > best.confidence) best = {corners, confidence};
  }
  if (!best || best.confidence < 0.75) return {corners:defaultDocumentCorners(imageData.width,imageData.height),confidence:best?.confidence||0,mode:'manual',reason:'automatic-detection-uncertain'};
  const scaleBack = 1 / working.scale;
  const scaled = Object.fromEntries(Object.entries(best.corners).map(([name,point]) => [name,{x:Math.round(point.x*scaleBack),y:Math.round(point.y*scaleBack)}]));
  return {corners:scaled,confidence:Number(best.confidence.toFixed(3)),mode:'automatic',reason:'document-quadrilateral'};
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
    const margin=Math.max(2,Math.min(width,height)*0.015);
    if (Object.values(corners).some(point=>point.x<=margin||point.y<=margin||point.x>=width-1-margin||point.y>=height-1-margin)) warnings.push('edge-clipped');
  }
  return warnings;
}

export async function rectifyDocument(source, corners, {enhance=true} = {}) {
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
  const output=enhance?enhancePixels(corrected):corrected;
  const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height; canvas.getContext('2d').putImageData(output,0,0);
  const warnings=[...new Set([...assessDocumentQuality(output),...assessDocumentQuality(sourcePixels,{corners:ordered})])];
  return {dataUrl:canvas.toDataURL('image/jpeg',0.92),width,height,warnings,enhanced:Boolean(enhance)};
}
