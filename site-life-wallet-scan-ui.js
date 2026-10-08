import {detectDocumentCorners, framesPrintedItem, rectifyDocument} from './site-life-wallet-scan.js?v=aset-9d81fcdb301d';
import {isPdfFile, openPdfDocument} from './site-life-wallet-pdf.js?v=aset-9d81fcdb301d';

const CORNER_NAMES = [
  ['topLeft','왼쪽 위 모서리'],
  ['topRight','오른쪽 위 모서리'],
  ['bottomRight','오른쪽 아래 모서리'],
  ['bottomLeft','왼쪽 아래 모서리'],
];
const WARNING_COPY = {
  blur:'사진이 흔들리거나 흐립니다.',
  glare:'빛 반사가 강한 부분이 있습니다.',
  'low-resolution':'사진 해상도가 낮습니다.',
  'edge-clipped':'자료가 사진 가장자리에 닿아 있습니다.',
};

function node(tag, className='', text='') {
  const element=document.createElement(tag); if(className)element.className=className; if(text)element.textContent=text; return element;
}

async function encodedDimensions(file) {
  const bytes=new Uint8Array(await file.slice(0,262144).arrayBuffer());
  if(bytes.length>=24&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71) {
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength); return {width:view.getUint32(16),height:view.getUint32(20)};
  }
  if(bytes.length<4||bytes[0]!==255||bytes[1]!==216)return null;
  let offset=2;let orientation=1;
  while(offset+9<bytes.length){
    if(bytes[offset]!==255){offset+=1;continue}
    const marker=bytes[offset+1];offset+=2;
    if(marker===216||marker===217||marker===1||(marker>=208&&marker<=215))continue;
    if(offset+2>bytes.length)break;const length=(bytes[offset]<<8)|bytes[offset+1];if(length<2||offset+length>bytes.length)break;
    if(marker===225)orientation=exifOrientation(bytes,offset+2,length-2)||orientation;
    if((marker>=192&&marker<=195)||(marker>=197&&marker<=199)||(marker>=201&&marker<=203)||(marker>=205&&marker<=207)){
      const width=(bytes[offset+5]<<8)|bytes[offset+6];const height=(bytes[offset+3]<<8)|bytes[offset+4];
      // Phones often store portrait photos as landscape pixels plus an EXIF rotation; the
      // decoder rotates before resizing, so the target size must be in the rotated frame.
      return orientation>=5&&orientation<=8?{width:height,height:width}:{width,height};
    }
    offset+=length;
  }
  return null;
}

function exifOrientation(bytes,start,length){
  if(length<14||String.fromCharCode(...bytes.slice(start,start+4))!=='Exif')return 0;
  const tiff=start+6;const little=bytes[tiff]===73;
  const read16=position=>little?bytes[position]|(bytes[position+1]<<8):(bytes[position]<<8)|bytes[position+1];
  const read32=position=>little?(bytes[position]|(bytes[position+1]<<8)|(bytes[position+2]<<16)|(bytes[position+3]<<24))>>>0:((bytes[position]<<24)|(bytes[position+1]<<16)|(bytes[position+2]<<8)|bytes[position+3])>>>0;
  const directory=tiff+read32(tiff+4);if(directory+2>bytes.length)return 0;
  for(let entry=0;entry<read16(directory);entry+=1){const position=directory+2+entry*12;if(position+10>bytes.length)return 0;if(read16(position)===274)return read16(position+8)}
  return 0;
}

async function decodeFile(file, resources) {
  if (typeof createImageBitmap === 'function') {
    try {
      const size=await encodedDimensions(file); const options={imageOrientation:'from-image'};
      if(size&&Math.max(size.width,size.height)>2560){const scale=2560/Math.max(size.width,size.height);options.resizeWidth=Math.round(size.width*scale);options.resizeHeight=Math.round(size.height*scale);options.resizeQuality='high'}
      const bitmap=await createImageBitmap(file,options); resources.bitmap=bitmap; return bitmap;
    } catch {}
  }
  const url=URL.createObjectURL(file); resources.url=url; const image=new Image(); image.src=url; await image.decode(); return image;
}

function dimensions(source) { return {width:source.naturalWidth||source.width,height:source.naturalHeight||source.height}; }

function detectionPixels(source) {
  const original=dimensions(source); const scale=Math.min(1,1200/Math.max(original.width,original.height));
  const canvas=document.createElement('canvas'); canvas.width=Math.max(8,Math.round(original.width*scale)); canvas.height=Math.max(8,Math.round(original.height*scale));
  const context=canvas.getContext('2d',{willReadFrequently:true}); context.drawImage(source,0,0,canvas.width,canvas.height);
  return {imageData:context.getImageData(0,0,canvas.width,canvas.height),scale};
}

export function createWalletDocumentScanner({file,onConfirm=()=>{},onCancel=()=>{},onReplace=()=>{}}={}) {
  const shell=node('section','wallet-scan-editor'); shell.dataset.scanState='analysing'; shell.dataset.scanEnhanced='true'; shell.dataset.scanAdjusting='false';
  const heading=node('h3','', '자료를 자동으로 정리하고 있습니다');
  const privacy=node('p','wallet-scan-privacy','사진 보정은 이 브라우저에서만 처리되며 LOTBI 서버로 전송되지 않습니다.');
  const status=node('p','wallet-scan-status','사진 분석 중'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  const workspace=node('div','wallet-scan-workspace');
  const sourcePane=node('section','wallet-scan-pane wallet-scan-source-pane'); sourcePane.hidden=true; sourcePane.append(node('h4','', '직접 조정'));
  const stage=node('div','wallet-scan-stage'); const canvas=node('canvas','wallet-scan-source'); const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg'); overlay.classList.add('wallet-scan-outline'); overlay.setAttribute('aria-hidden','true');
  const polygon=document.createElementNS('http://www.w3.org/2000/svg','polygon'); overlay.append(polygon); stage.append(canvas,overlay); sourcePane.append(stage);
  const resultPane=node('section','wallet-scan-pane wallet-scan-result-pane'); resultPane.append(node('h4','', '보정된 자료')); const resultImage=node('img','wallet-scan-result-image'); resultImage.alt='배경과 여백을 제거한 자료 미리보기'; resultImage.hidden=true; resultPane.append(resultImage);
  workspace.append(sourcePane,resultPane);
  const warnings=node('div','wallet-scan-warnings'); warnings.setAttribute('role','status'); warnings.setAttribute('aria-live','polite');
  const choices=node('div','wallet-scan-choices');
  const adjust=node('button','consumer-action wallet-scan-adjust','직접 조정'); adjust.type='button'; adjust.dataset.walletScanAdjust=''; choices.append(adjust);
  const actions=node('div','wallet-scan-actions');
  const cancel=node('button','consumer-action','취소'); cancel.type='button'; const replace=node('button','consumer-action','다시 선택'); replace.type='button'; const confirm=node('button','consumer-action primary','저장'); confirm.type='button'; confirm.disabled=true; confirm.dataset.walletScanConfirm=''; actions.append(cancel,replace,confirm);
  shell.append(heading,privacy,status,workspace,warnings,choices,actions);

  const resources={bitmap:null,url:''}; let source=null; let corners=null; let fallbackCorners=null; let detectedCorners=null; let cornerRadius=0; let paperPage=false; let pdfDocument=null; let pdfSource=false; let notDocument=false; let detectionImage=null; let detectionScale=1; let manualFramesItem=false; let latest=''; let enhanced=true; let destroyed=false; let renderVersion=0; let activePointer=null;
  const handles=new Map();

  function releaseResources(){resources.bitmap?.close?.();resources.bitmap=null;if(resources.url){URL.revokeObjectURL(resources.url);resources.url=''}if(pdfDocument){void pdfDocument.destroy();pdfDocument=null}}

  function setCorner(name,x,y) {
    const size=dimensions(source); corners[name]={x:Math.max(0,Math.min(size.width-1,x)),y:Math.max(0,Math.min(size.height-1,y))}; updateOverlay();
  }

  function manualGeometryChanged(){
    if(!fallbackCorners||!corners)return false;
    return CORNER_NAMES.some(([name])=>Math.hypot(corners[name].x-fallbackCorners[name].x,corners[name].y-fallbackCorners[name].y)>1);
  }

  // Rounded-corner cleanup only applies to the exact automatic crop it was measured on.
  function automaticGeometryKept(){
    if(!detectedCorners||!corners)return false;
    return CORNER_NAMES.every(([name])=>Math.hypot(corners[name].x-detectedCorners[name].x,corners[name].y-detectedCorners[name].y)<=1);
  }

  function updateOverlay() {
    if(!source||!corners)return; const size=dimensions(source); const points=[];
    for(const [name] of CORNER_NAMES){const point=corners[name];const handle=handles.get(name);handle.style.left=`${point.x/size.width*100}%`;handle.style.top=`${point.y/size.height*100}%`;handle.dataset.x=String(Math.round(point.x));handle.dataset.y=String(Math.round(point.y));handle.setAttribute('aria-valuetext',`${Math.round(point.x)}, ${Math.round(point.y)}`);points.push(`${point.x/size.width*100},${point.y/size.height*100}`)}
    overlay.setAttribute('viewBox','0 0 100 100');polygon.setAttribute('points',points.join(' '));
  }

  async function renderPreview() {
    if(!source||!corners||destroyed)return; const version=++renderVersion; confirm.disabled=true; status.textContent='보정 결과 만드는 중';
    try{
      const result=await rectifyDocument(source,corners,{enhance:enhanced,cornerRadius:automaticGeometryKept()?cornerRadius:0,paper:paperPage}); if(destroyed||version!==renderVersion)return;
      latest=result.dataUrl; resultImage.src=result.dataUrl; resultImage.hidden=false; shell.dataset.scanEnhanced=String(enhanced);
      warnings.replaceChildren(); if(result.warnings.length){warnings.append(node('strong','', '다시 촬영 권장'));for(const code of result.warnings)warnings.append(node('p','',WARNING_COPY[code]||'사진 상태를 확인해 주세요.'))}
      const automatic=shell.dataset.scanMode==='automatic';
      // A hand-placed crop is saved only when it frames a printed item (a pet never qualifies).
      const adjusted=!automatic&&manualGeometryChanged();
      const printed=adjusted&&framesPrintedItem(detectionImage,Object.fromEntries(Object.entries(corners).map(([name,point])=>[name,{x:point.x*detectionScale,y:point.y*detectionScale}])));
      manualFramesItem=automatic||printed;
      status.textContent=automatic?'배경과 여백을 자동으로 제거했습니다. 결과를 확인해 주세요.':notDocument?'신분증이나 문서로 보이지 않습니다. 신분증이나 문서 사진을 선택해 주세요.':adjusted&&!printed?'모서리 안에 신분증이나 문서가 보이지 않습니다. 자료에 맞춰 모서리를 조정해 주세요.':shell.dataset.scanReason==='receipt-like'?'영수증은 자동으로 등록하지 않습니다. 신분증·카드·문서 사진을 선택해 주세요.':'자료 테두리를 찾지 못했습니다. 다시 선택하거나 직접 조정해 주세요.';
      confirm.disabled=notDocument||!manualFramesItem; shell.dataset.scanState='review';
    }catch(error){if(version===renderVersion&&!destroyed){status.textContent=error instanceof Error?error.message:'사진을 보정하지 못했습니다.';shell.dataset.scanState='error'}}
  }

  function installHandle(name,label) {
    const handle=node('button','wallet-scan-handle'); handle.type='button'; handle.setAttribute('aria-label',label); handle.dataset.corner=name;
    handle.addEventListener('pointerdown',event=>{event.preventDefault();activePointer={id:event.pointerId,name};try{handle.setPointerCapture(event.pointerId)}catch{}});
    handle.addEventListener('pointermove',event=>{if(!activePointer||activePointer.id!==event.pointerId)return;event.preventDefault();const rect=stage.getBoundingClientRect();const size=dimensions(source);setCorner(name,(event.clientX-rect.left)/rect.width*size.width,(event.clientY-rect.top)/rect.height*size.height)});
    const finish=event=>{if(!activePointer||activePointer.id!==event.pointerId)return;event.preventDefault();activePointer=null;void renderPreview()}; handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
    handle.addEventListener('keydown',event=>{const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};const direction=directions[event.key];if(!direction)return;event.preventDefault();const amount=event.shiftKey?10:2;setCorner(name,corners[name].x+direction[0]*amount,corners[name].y+direction[1]*amount);void renderPreview()});
    handles.set(name,handle); stage.append(handle);
  }
  for(const [name,label] of CORNER_NAMES)installHandle(name,label);

  const copy=points=>Object.fromEntries(Object.entries(points).map(([name,point])=>[name,{...point}]));

  // Shows one decoded photo or PDF page: find the document on it and render the preview.
  async function analyse(nextSource) {
    source=nextSource; detectedCorners=null; fallbackCorners=null; cornerRadius=0; paperPage=false; notDocument=false; latest='';
    const size=dimensions(source); shell.dataset.scanSourceWidth=String(size.width); shell.dataset.scanSourceHeight=String(size.height); canvas.width=size.width;canvas.height=size.height;canvas.getContext('2d').drawImage(source,0,0,size.width,size.height);
    const detection=detectionPixels(source); detectionImage=detection.imageData; detectionScale=detection.scale; const found=detectDocumentCorners(detection.imageData); corners=Object.fromEntries(Object.entries(found.corners).map(([name,point])=>[name,{x:point.x/detection.scale,y:point.y/detection.scale}]));
    let mode=found.mode; let reason=found.reason||'';
    // A photo without printed text (a pet, a person) is not a wallet item: no adjusting, no saving.
    notDocument=reason==='not-a-document'; adjust.hidden=notDocument;
    if(mode==='manual'&&pdfSource&&!notDocument&&reason!=='receipt-like'){
      // A PDF page is the document itself: with no outline to find, keep the whole page.
      corners={topLeft:{x:0,y:0},topRight:{x:size.width-1,y:0},bottomRight:{x:size.width-1,y:size.height-1},bottomLeft:{x:0,y:size.height-1}};
      mode='automatic'; reason='pdf-page'; detectedCorners=copy(corners); paperPage=true;
    }else if(mode==='manual')fallbackCorners=copy(corners);
    else{detectedCorners=copy(corners);cornerRadius=found.cornerRadius||0;paperPage=Boolean(found.paper)}
    shell.dataset.scanMode=mode; shell.dataset.scanReason=reason; shell.dataset.scanDiagnostics=JSON.stringify(found.diagnostics||{}); updateOverlay(); await renderPreview();
  }

  function showError(error){if(!destroyed){status.textContent=error instanceof Error?error.message:'사진을 분석하지 못했습니다.';shell.dataset.scanState='error'}}

  async function initialize() {
    try{
      if(isPdfFile(file)){
        const opened=await openPdfDocument(file); if(destroyed){void opened.destroy();return}
        // Only the first page of a PDF is shown and saved.
        pdfDocument=opened; pdfSource=true; shell.dataset.scanPdfPages=String(opened.pageCount); status.textContent='PDF 1쪽 불러오는 중';
        const page=await opened.renderPage(1); if(destroyed)return;
        void opened.destroy(); pdfDocument=null;
        await analyse(page); return;
      }
      const decoded=await decodeFile(file,resources); if(destroyed){releaseResources();return}
      await analyse(decoded);
    }catch(error){showError(error)}
  }

  function openAdjustment(){sourcePane.hidden=false;shell.dataset.scanAdjusting='true';adjust.textContent='조정 닫기';handles.get('topLeft')?.focus()}
  function closeAdjustment(){sourcePane.hidden=true;shell.dataset.scanAdjusting='false';adjust.textContent='직접 조정';resultImage.focus?.()}
  adjust.addEventListener('click',()=>shell.dataset.scanAdjusting==='true'?closeAdjustment():openAdjustment());
  confirm.addEventListener('click',()=>{if(!latest||destroyed||notDocument)return;if(!manualFramesItem){confirm.disabled=true;return}onConfirm(latest)});
  cancel.addEventListener('click',()=>{if(!destroyed)onCancel();destroy()}); replace.addEventListener('click',()=>{if(!destroyed)onReplace();destroy()});

  function destroy(){if(destroyed)return;destroyed=true;renderVersion+=1;releaseResources();shell.replaceChildren()}
  void initialize();
  return Object.freeze({element:shell,destroy});
}
