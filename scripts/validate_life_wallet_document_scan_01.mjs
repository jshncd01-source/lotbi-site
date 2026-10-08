import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fixture = `<!doctype html><html><body><pre id="result">pending</pre><script type="module">
const out = document.getElementById('result');
const point = (x, y) => ({x, y});
try {
  const scan = await import('/site-life-wallet-scan.js?test=1');
  const ordered = scan.orderDocumentCorners([point(440,275), point(70,55), point(50,285), point(420,40)]);
  // Printed rows inside a card or page box, as every wallet item carries (the scanner refuses
  // photos without text). Drawn only in scenes that expect an automatic crop.
  const printRows = (ctx, [x0, y0, x1, y1], rowTops = null) => {
    // Lower part of the item, clear of the bars and panels the scenes already draw.
    const width = x1 - x0, height = y1 - y0; const size = Math.max(6, Math.min(11, Math.round(height / 18)));
    const rows = Math.max(2, Math.min(5, Math.floor(height * .34 / (size * 2.2))));
    const tops = rowTops || Array.from({length: rows}, (_, row) => y0 + height * .58 + row * size * 2.2);
    // Like lettering, marks differ in width and words are separated by wider gaps (identical,
    // evenly spaced boxes read as a made pattern such as a building's windows).
    ctx.fillStyle = '#2a2a2a';
    for (const top of tops) for (let x = x0 + width * .3, index = 0; x < x1 - width * .08 - size; index += 1) {
      const wide = Math.round(size * [.8, .55, .95, .65, .85, .5][index % 6]);
      ctx.fillRect(Math.round(x), Math.round(top), wide, size); x += wide + size * (index % 5 === 4 ? 1.3 : .75);
    }
  };
  const diamond = scan.orderDocumentCorners([point(240,30), point(440,160), point(240,290), point(40,160)]);
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 320;
  const context = canvas.getContext('2d', {willReadFrequently:true});
  context.fillStyle = '#18212d'; context.fillRect(0,0,480,320);
  context.beginPath(); context.moveTo(70,55); context.lineTo(420,40); context.lineTo(440,275); context.lineTo(50,285); context.closePath();
  context.fillStyle = '#e9dcae'; context.fill(); context.lineWidth = 8; context.strokeStyle = '#ffffff'; context.stroke();
  context.fillStyle = '#315c7d'; context.fillRect(150,115,190,18); context.fillRect(150,155,150,12); context.fillRect(150,185,210,12);
  // Printed rows, as on any card or document.
  for(const top of [96,205,228,251]){let x=125;for(let glyph=0;glyph<18;glyph+=1){const wide=[8,5,9,6,8,4][glyph%6];context.fillStyle='#2a2a2a';context.fillRect(x,top,wide,10);x+=wide+(glyph%5===4?11:5)}};
  const automatic = scan.detectDocumentCorners(context.getImageData(0,0,480,320));
  const corrected = await scan.rectifyDocument(canvas, automatic.corners, {enhance:false});
  const correctedImage = new Image(); correctedImage.src = corrected.dataUrl; await correctedImage.decode();
  const correctedCanvas = document.createElement('canvas'); correctedCanvas.width = corrected.width; correctedCanvas.height = corrected.height;
  const correctedContext = correctedCanvas.getContext('2d', {willReadFrequently:true}); correctedContext.drawImage(correctedImage,0,0);
  const correctedPixels = correctedContext.getImageData(0,0,corrected.width,corrected.height);
  const sample = (x,y) => Array.from(correctedPixels.data.slice((y*corrected.width+x)*4,(y*corrected.width+x)*4+3));

  const large = document.createElement('canvas'); large.width=2600; large.height=1600;
  const largeContext=large.getContext('2d'); largeContext.fillStyle='#d8c28b'; largeContext.fillRect(0,0,2600,1600);
  const largeResult=await scan.rectifyDocument(large,{topLeft:point(0,0),topRight:point(2599,0),bottomRight:point(2599,1599),bottomLeft:point(0,1599)},{enhance:false});
  const small = document.createElement('canvas'); small.width=160; small.height=100;
  const smallContext=small.getContext('2d'); smallContext.fillStyle='#d8c28b'; smallContext.fillRect(0,0,160,100);
  const smallResult=await scan.rectifyDocument(small,{topLeft:point(0,0),topRight:point(159,0),bottomRight:point(159,99),bottomLeft:point(0,99)},{enhance:false});

  const qualityCanvas=document.createElement('canvas'); qualityCanvas.width=240; qualityCanvas.height=140;
  const qualityContext=qualityCanvas.getContext('2d',{willReadFrequently:true}); qualityContext.fillStyle='#888'; qualityContext.fillRect(0,0,240,140); qualityContext.fillStyle='#fff'; qualityContext.fillRect(0,0,120,140);
  const quality=scan.assessDocumentQuality(qualityContext.getImageData(0,0,240,140),{corners:{topLeft:point(0,0),topRight:point(239,0),bottomRight:point(239,139),bottomLeft:point(0,139)}});

  const low = document.createElement('canvas'); low.width = 480; low.height = 320;
  const lowContext = low.getContext('2d', {willReadFrequently:true});
  lowContext.fillStyle = '#777'; lowContext.fillRect(0,0,480,320);
  for (let x=0; x<480; x+=16) { lowContext.fillStyle = x % 32 ? '#797979' : '#757575'; lowContext.fillRect(x,0,16,320); }
  const manual = scan.detectDocumentCorners(lowContext.getImageData(0,0,480,320));
  const subtle = document.createElement('canvas'); subtle.width=480; subtle.height=320;
  const subtleContext=subtle.getContext('2d',{willReadFrequently:true}); subtleContext.fillStyle='#777'; subtleContext.fillRect(0,0,480,320);
  subtleContext.fillStyle='#828282'; subtleContext.fillRect(28,24,424,272);
  subtleContext.strokeStyle='#f5f5f5'; subtleContext.lineWidth=7; subtleContext.strokeRect(105,72,270,176);
  subtleContext.fillStyle='#666'; subtleContext.fillRect(145,120,185,12); subtleContext.fillRect(145,150,145,9);
  const internalBorder=scan.detectDocumentCorners(subtleContext.getImageData(0,0,480,320));
  const walletPhoto=document.createElement('canvas'); walletPhoto.width=720; walletPhoto.height=520;
  const walletContext=walletPhoto.getContext('2d',{willReadFrequently:true});
  walletContext.fillStyle='#87936f'; walletContext.fillRect(0,0,720,520);
  for(let y=0;y<520;y+=18){walletContext.fillStyle=y%36===0?'#929d79':'#7f8b68';walletContext.fillRect(0,y,720,4)}
  for(let x=0;x<720;x+=24){walletContext.fillStyle=x%48===0?'rgba(255,255,255,.10)':'rgba(0,0,0,.07)';walletContext.fillRect(x,0,3,520)}
  walletContext.save(); walletContext.shadowColor='rgba(0,0,0,.35)'; walletContext.shadowBlur=14; walletContext.shadowOffsetY=8;
  walletContext.beginPath(); walletContext.moveTo(122,104); walletContext.lineTo(603,80); walletContext.lineTo(625,400); walletContext.lineTo(105,422); walletContext.closePath();
  walletContext.fillStyle='#d9d7b8'; walletContext.fill(); walletContext.restore();
  walletContext.beginPath(); walletContext.moveTo(122,104); walletContext.lineTo(603,80); walletContext.lineTo(625,400); walletContext.lineTo(105,422); walletContext.closePath();
  walletContext.lineWidth=5; walletContext.strokeStyle='#c8c6aa'; walletContext.stroke();
  walletContext.fillStyle='#263a54'; walletContext.fillRect(220,166,280,20); walletContext.fillRect(220,212,220,14); walletContext.fillRect(220,250,255,14);
  walletContext.fillStyle='#6c7a62'; walletContext.fillRect(145,155,58,105);
  printRows(walletContext,[105, 80, 625, 422]);
  const walletDetection=scan.detectDocumentCorners(walletContext.getImageData(0,0,720,520));
  const framedPhoto=document.createElement('canvas');framedPhoto.width=720;framedPhoto.height=520;const framedContext=framedPhoto.getContext('2d',{willReadFrequently:true});framedContext.fillStyle='#31392d';framedContext.fillRect(0,0,720,520);framedContext.fillStyle='#87936f';framedContext.fillRect(22,22,676,476);for(let y=22;y<498;y+=18){framedContext.fillStyle=y%36===0?'#929d79':'#7f8b68';framedContext.fillRect(22,y,676,4)}for(let x=22;x<698;x+=24){framedContext.fillStyle=x%48===0?'rgba(255,255,255,.10)':'rgba(0,0,0,.07)';framedContext.fillRect(x,22,3,476)}framedContext.beginPath();framedContext.moveTo(122,104);framedContext.lineTo(603,80);framedContext.lineTo(625,400);framedContext.lineTo(105,422);framedContext.closePath();framedContext.fillStyle='#d9d7b8';framedContext.fill();framedContext.lineWidth=5;framedContext.strokeStyle='#c8c6aa';framedContext.stroke();framedContext.fillStyle='#263a54';framedContext.fillRect(220,166,280,20);framedContext.fillRect(220,212,220,14);framedContext.fillRect(220,250,255,14);
  printRows(framedContext,[105, 80, 625, 422]);
  const framedDetection=scan.detectDocumentCorners(framedContext.getImageData(0,0,720,520));
  const smallFramedPhoto=document.createElement('canvas');smallFramedPhoto.width=720;smallFramedPhoto.height=520;const smallFramedContext=smallFramedPhoto.getContext('2d',{willReadFrequently:true});smallFramedContext.fillStyle='#31392d';smallFramedContext.fillRect(0,0,720,520);smallFramedContext.fillStyle='#87936f';smallFramedContext.fillRect(22,22,676,476);for(let y=22;y<498;y+=18){smallFramedContext.fillStyle=y%36===0?'#929d79':'#7f8b68';smallFramedContext.fillRect(22,y,676,4)}for(let x=22;x<698;x+=24){smallFramedContext.fillStyle=x%48===0?'rgba(255,255,255,.10)':'rgba(0,0,0,.07)';smallFramedContext.fillRect(x,22,3,476)}smallFramedContext.fillStyle='#d9d7b8';smallFramedContext.fillRect(150,130,420,265);smallFramedContext.strokeStyle='#c8c6aa';smallFramedContext.lineWidth=5;smallFramedContext.strokeRect(150,130,420,265);smallFramedContext.fillStyle='#263a54';smallFramedContext.fillRect(240,195,240,18);smallFramedContext.fillRect(240,238,190,12);
  printRows(smallFramedContext,[150, 130, 570, 395]);
  const smallFramedDetection=scan.detectDocumentCorners(smallFramedContext.getImageData(0,0,720,520));
  const compactFramedPhoto=document.createElement('canvas');compactFramedPhoto.width=720;compactFramedPhoto.height=520;const compactFramedContext=compactFramedPhoto.getContext('2d',{willReadFrequently:true});compactFramedContext.fillStyle='#31392d';compactFramedContext.fillRect(0,0,720,520);compactFramedContext.fillStyle='#87936f';compactFramedContext.fillRect(22,22,676,476);for(let y=22;y<498;y+=18){compactFramedContext.fillStyle=y%36===0?'#929d79':'#7f8b68';compactFramedContext.fillRect(22,y,676,4)}for(let x=22;x<698;x+=24){compactFramedContext.fillStyle=x%48===0?'rgba(255,255,255,.10)':'rgba(0,0,0,.07)';compactFramedContext.fillRect(x,22,3,476)}compactFramedContext.fillStyle='#d9d7b8';compactFramedContext.fillRect(190,150,340,215);compactFramedContext.strokeStyle='#c8c6aa';compactFramedContext.lineWidth=5;compactFramedContext.strokeRect(190,150,340,215);compactFramedContext.fillStyle='#263a54';compactFramedContext.fillRect(245,205,220,16);compactFramedContext.fillRect(245,245,170,11);
  printRows(compactFramedContext,[190, 150, 530, 365]);
  const compactFramedDetection=scan.detectDocumentCorners(compactFramedContext.getImageData(0,0,720,520));
  const texturedPhoto=document.createElement('canvas');texturedPhoto.width=720;texturedPhoto.height=406;const texturedContext=texturedPhoto.getContext('2d',{willReadFrequently:true});texturedContext.fillStyle='#69775a';texturedContext.fillRect(0,0,720,406);for(let y=0;y<406;y+=7){for(let x=(y%14);x<720;x+=13){const shade=(x+y)%39;texturedContext.fillStyle=shade<13?'rgba(255,255,255,.10)':shade<26?'rgba(30,45,28,.12)':'rgba(120,135,100,.13)';texturedContext.fillRect(x,y,7,3)}}texturedContext.fillStyle='rgba(20,26,20,.28)';texturedContext.fillRect(105,55,510,300);texturedContext.beginPath();texturedContext.moveTo(120,60);texturedContext.lineTo(610,65);texturedContext.lineTo(600,350);texturedContext.lineTo(110,345);texturedContext.closePath();texturedContext.fillStyle='#d9d8c4';texturedContext.fill();texturedContext.fillStyle='#a5b8c9';texturedContext.fillRect(125,70,470,72);texturedContext.fillStyle='#c8b9aa';texturedContext.fillRect(125,275,465,60);texturedContext.fillStyle='#2c3f52';texturedContext.fillRect(260,165,265,18);texturedContext.fillRect(260,208,210,12);texturedContext.fillStyle='#79866f';texturedContext.fillRect(145,155,82,125);
  printRows(texturedContext,[110, 60, 610, 350]);
  const texturedDetection=scan.detectDocumentCorners(texturedContext.getImageData(0,0,720,406));
  const blobPhoto=document.createElement('canvas');blobPhoto.width=640;blobPhoto.height=420;const blobContext=blobPhoto.getContext('2d',{willReadFrequently:true});blobContext.fillStyle='#69775a';blobContext.fillRect(0,0,640,420);blobContext.beginPath();blobContext.ellipse(320,210,220,120,0,0,Math.PI*2);blobContext.fillStyle='#d9d8c4';blobContext.fill();blobContext.fillStyle='#2c3f52';blobContext.fillRect(245,180,150,14);blobContext.fillRect(265,220,110,10);
  const blobDetection=scan.detectDocumentCorners(blobContext.getImageData(0,0,640,420));
  const colorPhoto=document.createElement('canvas'); colorPhoto.width=640; colorPhoto.height=420;
  const colorContext=colorPhoto.getContext('2d',{willReadFrequently:true});colorContext.fillStyle='#5f806f';colorContext.fillRect(0,0,640,420);
  colorContext.beginPath();colorContext.moveTo(92,82);colorContext.lineTo(552,66);colorContext.lineTo(570,350);colorContext.lineTo(76,364);colorContext.closePath();colorContext.fillStyle='#a36c57';colorContext.fill();
  colorContext.fillStyle='#20364a';colorContext.fillRect(185,145,275,18);colorContext.fillRect(185,190,220,12);colorContext.fillRect(185,226,250,12);colorContext.fillStyle='#d4b997';colorContext.fillRect(112,132,56,96);
  printRows(colorContext,[76, 66, 570, 364]);
  const colorDetection=scan.detectDocumentCorners(colorContext.getImageData(0,0,640,420));
  const nestedPhoto=document.createElement('canvas');nestedPhoto.width=720;nestedPhoto.height=520;const nestedContext=nestedPhoto.getContext('2d',{willReadFrequently:true});nestedContext.fillStyle='#24313a';nestedContext.fillRect(0,0,720,520);nestedContext.fillStyle='#e4dfc5';nestedContext.fillRect(40,40,640,440);nestedContext.fillStyle='#8a6657';nestedContext.fillRect(120,100,480,320);nestedContext.fillStyle='#27394d';nestedContext.fillRect(80,72,210,14);nestedContext.fillRect(86,450,310,12);nestedContext.fillStyle='#d9c9a8';nestedContext.fillRect(155,135,62,92);nestedContext.fillStyle='#1d3044';nestedContext.fillRect(250,145,250,14);nestedContext.fillRect(250,188,205,11);
  printRows(nestedContext,[40, 40, 680, 480]);
  const nestedDetection=scan.detectDocumentCorners(nestedContext.getImageData(0,0,720,520));
  const narrowPhoto=document.createElement('canvas');narrowPhoto.width=720;narrowPhoto.height=520;const narrowContext=narrowPhoto.getContext('2d',{willReadFrequently:true});narrowContext.fillStyle='#25333c';narrowContext.fillRect(0,0,720,520);narrowContext.fillStyle='#ddd9bd';narrowContext.fillRect(20,20,680,480);narrowContext.fillStyle='#263b52';narrowContext.fillRect(140,120,390,18);narrowContext.fillRect(140,170,310,12);narrowContext.fillRect(140,215,350,12);
  printRows(narrowContext,[20, 20, 700, 500]);
  const narrowDetection=scan.detectDocumentCorners(narrowContext.getImageData(0,0,720,520));
  const narrowPanelPhoto=document.createElement('canvas');narrowPanelPhoto.width=720;narrowPanelPhoto.height=520;const narrowPanelContext=narrowPanelPhoto.getContext('2d',{willReadFrequently:true});narrowPanelContext.fillStyle='#25333c';narrowPanelContext.fillRect(0,0,720,520);narrowPanelContext.fillStyle='#ddd9bd';narrowPanelContext.fillRect(20,20,680,480);narrowPanelContext.fillStyle='#8a6657';narrowPanelContext.fillRect(120,100,480,320);narrowPanelContext.fillStyle='#263b52';narrowPanelContext.fillRect(75,55,250,14);narrowPanelContext.fillRect(82,463,330,12);narrowPanelContext.fillStyle='#d9c9a8';narrowPanelContext.fillRect(155,135,62,92);narrowPanelContext.fillStyle='#1d3044';narrowPanelContext.fillRect(250,145,250,14);narrowPanelContext.fillRect(250,188,205,11);
  const narrowPanelDetection=scan.detectDocumentCorners(narrowPanelContext.getImageData(0,0,720,520));
  const squarePhoto=document.createElement('canvas');squarePhoto.width=460;squarePhoto.height=420;const squareContext=squarePhoto.getContext('2d',{willReadFrequently:true});squareContext.fillStyle='#263640';squareContext.fillRect(0,0,460,420);squareContext.fillStyle='#e2ddc2';squareContext.fillRect(80,55,300,300);squareContext.fillStyle='#284057';squareContext.fillRect(135,125,190,16);squareContext.fillRect(135,170,150,12);
  printRows(squareContext,[80, 55, 380, 355]);
  const squareDetection=scan.detectDocumentCorners(squareContext.getImageData(0,0,460,420));
  const receiptPhoto=document.createElement('canvas');receiptPhoto.width=640;receiptPhoto.height=300;const receiptContext=receiptPhoto.getContext('2d',{willReadFrequently:true});receiptContext.fillStyle='#2c3b42';receiptContext.fillRect(0,0,640,300);receiptContext.fillStyle='#e7e1c9';receiptContext.fillRect(60,85,520,130);receiptContext.fillStyle='#293d50';receiptContext.fillRect(120,115,350,10);receiptContext.fillRect(120,145,280,8);receiptContext.fillRect(120,175,390,8);
  // A low receipt: rows go in the free bands above and below its printed bars.
  printRows(receiptContext,[60, 85, 580, 215],[92, 161, 192]);
  const receiptDetection=scan.detectDocumentCorners(receiptContext.getImageData(0,0,640,300));
  out.textContent = JSON.stringify({ok:true, ordered, diamond, automatic, manual, internalBorder, walletDetection, framedDetection, smallFramedDetection, compactFramedDetection, texturedDetection, blobDetection, colorDetection, nestedDetection, narrowDetection, narrowPanelDetection, squareDetection, receiptDetection, corrected:{...corrected,dataUrl:corrected.dataUrl.slice(0,32),corners:[sample(2,2),sample(corrected.width-3,2),sample(corrected.width-3,corrected.height-3),sample(2,corrected.height-3)],colorSample:sample(Math.round(corrected.width*.75),Math.round(corrected.height*.75))},largeResult:{width:largeResult.width,height:largeResult.height},smallResult:{width:smallResult.width,height:smallResult.height},quality});
} catch (error) { out.textContent = JSON.stringify({ok:false,error:String(error?.stack||error)}); }
</script></body></html>`;

const result = await runFixturePage({
  root: ROOT, fixturePath: '/__life_wallet_document_scan_01.html', fixtureHtml: fixture,
  resultExpression: "(() => { const text = document.getElementById('result')?.textContent || ''; return text === 'pending' ? '' : text; })()",
});
{
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.ordered, {topLeft:{x:70,y:55},topRight:{x:420,y:40},bottomRight:{x:440,y:275},bottomLeft:{x:50,y:285}});
  assert.equal(new Set(Object.values(result.diamond).map(corner=>`${corner.x}:${corner.y}`)).size,4,`diamond ordering duplicated a corner: ${JSON.stringify(result.diamond)}`);
  assert.equal(result.automatic.mode, 'automatic');
  assert.ok(result.automatic.confidence >= 0.75, `automatic confidence ${result.automatic.confidence}`);
  const expected = [{x:70,y:55},{x:420,y:40},{x:440,y:275},{x:50,y:285}];
  const actual = [result.automatic.corners.topLeft,result.automatic.corners.topRight,result.automatic.corners.bottomRight,result.automatic.corners.bottomLeft];
  actual.forEach((corner,index) => assert.ok(Math.hypot(corner.x-expected[index].x,corner.y-expected[index].y)<=12, `corner ${index} is too far: ${JSON.stringify(corner)}`));
  assert.equal(result.manual.mode, 'manual', `low-contrast pattern was misclassified: ${JSON.stringify(result.manual)}`);
  assert.equal(result.internalBorder.mode,'manual',`an internal printed border was misclassified as the document edge: ${JSON.stringify(result.internalBorder)}`);
  assert.equal(result.walletDetection.mode,'automatic',`wallet photo did not auto-detect the card: ${JSON.stringify(result.walletDetection)}`);
  const walletExpected=[{x:122,y:104},{x:603,y:80},{x:625,y:400},{x:105,y:422}];
  const walletActual=[result.walletDetection.corners.topLeft,result.walletDetection.corners.topRight,result.walletDetection.corners.bottomRight,result.walletDetection.corners.bottomLeft];
  walletActual.forEach((corner,index)=>assert.ok(Math.hypot(corner.x-walletExpected[index].x,corner.y-walletExpected[index].y)<=24,`wallet photo corner ${index} kept background: ${JSON.stringify(corner)}`));
  assert.equal(result.colorDetection.mode,'automatic',`equal-luminance color boundary was missed: ${JSON.stringify(result.colorDetection)}`);
  const colorExpected=[{x:92,y:82},{x:552,y:66},{x:570,y:350},{x:76,y:364}];
  const colorActual=[result.colorDetection.corners.topLeft,result.colorDetection.corners.topRight,result.colorDetection.corners.bottomRight,result.colorDetection.corners.bottomLeft];
  colorActual.forEach((corner,index)=>assert.ok(Math.hypot(corner.x-colorExpected[index].x,corner.y-colorExpected[index].y)<=24,`color boundary corner ${index} is wrong: ${JSON.stringify(corner)}`));
  const assertCornersNear=(label,detection,expected,tolerance=18)=>{assert.equal(detection.mode,'automatic',`${label} was not automatic: ${JSON.stringify(detection)}`);const actual=[detection.corners.topLeft,detection.corners.topRight,detection.corners.bottomRight,detection.corners.bottomLeft];actual.forEach((corner,index)=>assert.ok(Math.hypot(corner.x-expected[index].x,corner.y-expected[index].y)<=tolerance,`${label} corner ${index} selected internal content or background: ${JSON.stringify(corner)}`))};
  assertCornersNear('framed wallet photo',result.framedDetection,[{x:122,y:104},{x:603,y:80},{x:625,y:400},{x:105,y:422}],30);
  assertCornersNear('smaller document on mat',result.smallFramedDetection,[{x:150,y:130},{x:570,y:130},{x:570,y:395},{x:150,y:395}],30);
  assertCornersNear('compact document on mat',result.compactFramedDetection,[{x:190,y:150},{x:530,y:150},{x:530,y:365},{x:190,y:365}],30);
  assertCornersNear('textured-background identity card',result.texturedDetection,[{x:120,y:60},{x:610,y:65},{x:600,y:350},{x:110,y:345}],24);
  assert.equal(result.blobDetection.mode,'manual',`a non-rectangular foreground object was misclassified as a document: ${JSON.stringify(result.blobDetection)}`);
  assertCornersNear('nested document',result.nestedDetection,[{x:40,y:40},{x:680,y:40},{x:680,y:480},{x:40,y:480}]);
  assertCornersNear('narrow-margin document',result.narrowDetection,[{x:20,y:20},{x:700,y:20},{x:700,y:500},{x:20,y:500}]);
  assert.equal(result.narrowPanelDetection.mode,'manual',`competing document and internal-panel boundaries must require confirmation: ${JSON.stringify(result.narrowPanelDetection)}`);
  assertCornersNear('square document',result.squareDetection,[{x:80,y:55},{x:380,y:55},{x:380,y:355},{x:80,y:355}]);
  // Receipts are not wallet items (user decision 2026-10-07): never saved automatically.
  assert.equal(result.receiptDetection.mode,'manual',`a long receipt must not be registered automatically: ${JSON.stringify(result.receiptDetection)}`);
  assert.equal(result.receiptDetection.reason,'receipt-like');
  for (const corner of Object.values(result.manual.corners)) {
    assert.ok(corner.x > 0 && corner.x < 480 && corner.y > 0 && corner.y < 320, `manual corner outside source: ${JSON.stringify(corner)}`);
  }
  assert.ok(result.corrected.dataUrl.startsWith('data:image/jpeg;base64,'), 'corrected output must be a JPEG data URL');
  assert.ok(Math.abs(result.corrected.width/result.corrected.height-1.584)<0.08, `corrected ratio ${result.corrected.width/result.corrected.height}`);
  assert.ok(Math.max(result.corrected.width,result.corrected.height)<=480, 'a small source must not be enlarged');
  for (const rgb of result.corrected.corners) assert.ok(rgb.reduce((sum,value)=>sum+value,0)>250, `background remained in corrected corner: ${rgb}`);
  assert.ok(Math.abs(result.corrected.colorSample[0]-233)<30 && Math.abs(result.corrected.colorSample[1]-220)<30, `enhance:false changed document colors: ${result.corrected.colorSample}`);
  assert.equal(result.corrected.enhanced,false);
  assert.ok(Math.max(result.largeResult.width,result.largeResult.height)<=2048, `large result exceeded cap: ${JSON.stringify(result.largeResult)}`);
  assert.ok(result.smallResult.width<=160 && result.smallResult.height<=100, `small result was enlarged: ${JSON.stringify(result.smallResult)}`);
  for (const warning of ['blur','glare','low-resolution','edge-clipped']) assert.ok(result.quality.includes(warning), `missing quality warning ${warning}: ${result.quality}`);
  console.log('LIFE_WALLET_DOCUMENT_SCAN_01 PASS');
}
