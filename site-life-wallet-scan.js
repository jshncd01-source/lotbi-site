const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function orderDocumentCorners(points) {
  if (!Array.isArray(points) || points.length !== 4) throw new TypeError('Four document corners are required.');
  const normalized = points.map(point => ({x: Number(point.x), y: Number(point.y)}));
  if (normalized.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) throw new TypeError('Document corners must be finite coordinates.');
  const bySum = [...normalized].sort((left, right) => (left.x + left.y) - (right.x + right.y));
  const byDifference = [...normalized].sort((left, right) => (left.x - left.y) - (right.x - right.y));
  return {
    topLeft: bySum[0],
    topRight: byDifference[3],
    bottomRight: bySum[3],
    bottomLeft: byDifference[0],
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
  const binary = dilate(sobelEdges(boxBlur(working.gray, working.width, working.height), working.width, working.height), working.width, working.height);
  let best = null;
  for (const candidate of componentCandidates(binary, working.width, working.height)) {
    const corners = candidate.corners;
    const points = [corners.topLeft,corners.topRight,corners.bottomRight,corners.bottomLeft];
    if (new Set(points.map(point => `${point.x}:${point.y}`)).size !== 4) continue;
    const areaRatio = polygonArea(corners) / (working.width * working.height);
    const edges = [[corners.topLeft,corners.topRight],[corners.topRight,corners.bottomRight],[corners.bottomRight,corners.bottomLeft],[corners.bottomLeft,corners.topLeft]];
    const shortestEdge = Math.min(...edges.map(([start,end]) => Math.hypot(end.x-start.x,end.y-start.y)));
    const support = edges.reduce((sum,[start,end]) => sum + lineSupport(binary,working.width,working.height,start,end),0) / 4;
    if (areaRatio < 0.18 || shortestEdge < Math.min(working.width,working.height) * 0.16 || support < 0.46) continue;
    const areaScore = clamp((areaRatio - 0.18) / 0.42, 0, 1);
    const confidence = clamp(0.56 + areaScore * 0.24 + support * 0.22, 0, 0.99);
    if (!best || confidence > best.confidence) best = {corners, confidence};
  }
  if (!best || best.confidence < 0.75) return {corners:defaultDocumentCorners(imageData.width,imageData.height),confidence:best?.confidence||0,mode:'manual',reason:'automatic-detection-uncertain'};
  const scaleBack = 1 / working.scale;
  const scaled = Object.fromEntries(Object.entries(best.corners).map(([name,point]) => [name,{x:Math.round(point.x*scaleBack),y:Math.round(point.y*scaleBack)}]));
  return {corners:scaled,confidence:Number(best.confidence.toFixed(3)),mode:'automatic',reason:'document-quadrilateral'};
}
