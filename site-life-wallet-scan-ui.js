import {detectDocumentCorners, framesPrintedItem, rectifyDocument} from './site-life-wallet-scan.js?v=aset-c4bb36809825';
import {isPdfFile, openPdfDocument} from './site-life-wallet-pdf.js?v=aset-c4bb36809825';

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

// What a chosen file really is, read from its first bytes. Camera apps hand over shots with
// temporary names, no extension, an empty or a non-standard type (image/jpg); the bytes decide.
const PHOTO_KINDS = ['jpeg', 'png', 'webp', 'heic', 'avif'];
export async function sniffWalletFile(file) {
  let bytes;
  try { bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer()); } catch { return 'unknown'; }
  const text = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpeg';
  if (bytes[0] === 0x89 && text(1, 4) === 'PNG') return 'png';
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'webp';
  if (text(0, 5) === '%PDF-') return 'pdf';
  if (text(0, 4) === 'GIF8') return 'gif';
  if (text(4, 8) === 'ftyp') {
    const brand = text(8, 12);
    return /^(?:avif|avis)$/u.test(brand) ? 'avif' : /^(?:heic|heix|heim|heis|hevc|hevx|mif1|msf1)$/u.test(brand) ? 'heic' : 'video';
  }
  return 'unknown';
}
export function isWalletPhotoKind(kind) { return PHOTO_KINDS.includes(kind); }

// Pixel size and EXIF orientation from the header (JPEG, PNG) without decoding the photo.
async function imageHeader(file) {
  const bytes=new Uint8Array(await file.slice(0,524288).arrayBuffer());
  if(bytes.length>=24&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71) {
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength); return {width:view.getUint32(16),height:view.getUint32(20),orientation:1};
  }
  const none={width:0,height:0,orientation:1};
  if(bytes.length<4||bytes[0]!==255||bytes[1]!==216)return none;
  let offset=2;let orientation=1;
  while(offset+9<bytes.length){
    if(bytes[offset]!==255){offset+=1;continue}
    const marker=bytes[offset+1];offset+=2;
    if(marker===216||marker===217||marker===1||(marker>=208&&marker<=215))continue;
    if(marker===218)break;
    if(offset+2>bytes.length)break;const length=(bytes[offset]<<8)|bytes[offset+1];if(length<2||offset+length>bytes.length)break;
    if(marker===225)orientation=exifOrientation(bytes,offset+2,length-2)||orientation;
    if((marker>=192&&marker<=195)||(marker>=197&&marker<=199)||(marker>=201&&marker<=203)||(marker>=205&&marker<=207)){
      return {width:(bytes[offset+5]<<8)|bytes[offset+6],height:(bytes[offset+3]<<8)|bytes[offset+4],orientation};
    }
    offset+=length;
  }
  return {...none,orientation};
}

function exifOrientation(bytes,start,length){
  if(length<14||String.fromCharCode(...bytes.slice(start,start+4))!=='Exif')return 0;
  const tiff=start+6;const little=bytes[tiff]===73;
  const read16=position=>little?bytes[position]|(bytes[position+1]<<8):(bytes[position]<<8)|bytes[position+1];
  const read32=position=>little?(bytes[position]|(bytes[position+1]<<8)|(bytes[position+2]<<16)|(bytes[position+3]<<24))>>>0:((bytes[position]<<24)|(bytes[position+1]<<16)|(bytes[position+2]<<8)|bytes[position+3])>>>0;
  const directory=tiff+read32(tiff+4);if(directory+2>bytes.length)return 0;
  for(let entry=0;entry<read16(directory);entry+=1){const position=directory+2+entry*12;if(position+10>bytes.length)return 0;const value=read16(position+8);if(read16(position)===274)return value>=1&&value<=8?value:0}
  return 0;
}

// Whether this browser's decoder ('bitmap' or 'image') turns a photo upright from its EXIF
// orientation (current engines do). Asked only for a mirrored or upside-down photo, whose
// decoded shape cannot tell: decoding a 2x1 JPEG tagged "rotate 90" gives 1x2 when it does.
const EXIF_ROTATE_90=[0xFF,0xE1,0x00,0x22,0x45,0x78,0x69,0x66,0x00,0x00,0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x12,0x01,0x03,0x00,0x01,0x00,0x00,0x00,0x06,0x00,0x00,0x00,0x00,0x00,0x00,0x00];
const orientationSupport={};
function decoderAppliesOrientation(method){
  orientationSupport[method]??=(async()=>{
    try{
      const canvas=document.createElement('canvas');canvas.width=2;canvas.height=1;
      const plain=new Uint8Array(await (await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('encode')),'image/jpeg'))).arrayBuffer());
      const tagged=new Blob([plain.subarray(0,2),new Uint8Array(EXIF_ROTATE_90),plain.subarray(2)],{type:'image/jpeg'});
      if(method==='bitmap'){const bitmap=await createImageBitmap(tagged,{imageOrientation:'from-image'});const applied=bitmap.height>bitmap.width;bitmap.close?.();return applied}
      const url=URL.createObjectURL(tagged);
      try{const image=new Image();image.src=url;await image.decode();return image.naturalHeight>image.naturalWidth}finally{URL.revokeObjectURL(url)}
    }catch{return true}
  })();
  return orientationSupport[method];
}

// Draws a photo upright for EXIF orientation 2-8 (mirrors and quarter turns).
function orientedCanvas(source,orientation){
  const {width,height}=dimensions(source);const turned=orientation>=5;
  const canvas=document.createElement('canvas');canvas.width=turned?height:width;canvas.height=turned?width:height;
  const transforms={2:[-1,0,0,1,width,0],3:[-1,0,0,-1,width,height],4:[1,0,0,-1,0,height],5:[0,1,1,0,0,0],6:[0,1,-1,0,height,0],7:[0,-1,-1,0,height,width],8:[0,-1,1,0,0,width]};
  const context=canvas.getContext('2d');context.setTransform(...transforms[orientation]);context.drawImage(source,0,0);return canvas;
}

// Bounds a photo whose header gave no size (WebP, HEIC) like the decoder's high-quality resize
// does for JPEG and PNG: halving steps with high-quality smoothing.
function scaledCanvas(source,width,height){
  let current=source;let size=dimensions(source);
  while(size.width/2>=width&&size.height/2>=height){
    const step=document.createElement('canvas');step.width=Math.round(size.width/2);step.height=Math.round(size.height/2);
    const context=step.getContext('2d');context.imageSmoothingQuality='high';context.drawImage(current,0,0,step.width,step.height);
    current=step;size={width:step.width,height:step.height};
  }
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.imageSmoothingQuality='high';context.drawImage(current,0,0,width,height);
  return canvas;
}

// Camera shots and gallery files take this one path, whatever their name or reported type:
// header (size, EXIF orientation) -> decode -> pixels made upright -> at most 2560 pixels on
// the long side. Detection, perspective correction and the saved image all start from it.
async function decodeFile(file, resources, kind='') {
  const header=await imageHeader(file).catch(()=>({width:0,height:0,orientation:1}));
  const turned=header.orientation>=5;
  const upright=header.width?{width:turned?header.height:header.width,height:turned?header.width:header.height}:null;
  let decoded=null; let method='';
  if (typeof createImageBitmap === 'function') {
    try {
      const options={imageOrientation:'from-image'};
      // Only the width is given, so the aspect ratio holds even in an engine that would size
      // the stored (unrotated) pixels.
      if(upright&&Math.max(upright.width,upright.height)>2560){options.resizeWidth=Math.round(upright.width*2560/Math.max(upright.width,upright.height));options.resizeQuality='high'}
      decoded=await createImageBitmap(file,options); resources.bitmap=decoded; method='bitmap';
    } catch {}
  }
  if(!decoded){
    try{const url=URL.createObjectURL(file); resources.url=url; const image=new Image(); image.src=url; await image.decode(); decoded=image; method='image'}
    catch{throw new Error(kind==='heic'||/hei[cf]/iu.test(file.type)||/\.hei[cf]$/iu.test(file.name)?'이 브라우저에서는 HEIC 사진을 열 수 없습니다. 카메라 설정에서 JPG(호환성 우선)로 저장하거나 다른 사진을 선택해 주세요.':'사진을 열지 못했습니다. 다른 사진을 선택해 주세요.')}
  }
  // Turned here only when the decoder ignored the tag: a quarter-turn photo shows it in its
  // decoded shape; a mirrored or upside-down one needs the decoder check.
  let photo=decoded;
  if(header.orientation>1){
    const decodedSize=dimensions(decoded);
    const applied=turned&&upright&&upright.width!==upright.height?(decodedSize.width>decodedSize.height)===(upright.width>upright.height):await decoderAppliesOrientation(method);
    if(!applied)photo=orientedCanvas(decoded,header.orientation);
  }
  const size=dimensions(photo);
  if(photo===decoded&&Math.max(size.width,size.height)<=2560)return decoded;
  const scale=Math.min(1,2560/Math.max(size.width,size.height));
  const bounded=scale<1?scaledCanvas(photo,Math.round(size.width*scale),Math.round(size.height*scale)):photo;
  resources.bitmap?.close?.();resources.bitmap=null;if(resources.url){URL.revokeObjectURL(resources.url);resources.url=''}
  return bounded;
}

function dimensions(source) { return {width:source.naturalWidth||source.width,height:source.naturalHeight||source.height}; }

function detectionPixels(source) {
  const original=dimensions(source); const scale=Math.min(1,1200/Math.max(original.width,original.height));
  // One plain resampling step: the print detection is tuned to its crisp strokes (a smoothed
  // multi-step reduction softens thin lettering below the ink threshold).
  const canvas=document.createElement('canvas'); canvas.width=Math.max(8,Math.round(original.width*scale)); canvas.height=Math.max(8,Math.round(original.height*scale));
  const context=canvas.getContext('2d',{willReadFrequently:true}); context.drawImage(source,0,0,canvas.width,canvas.height);
  return {imageData:context.getImageData(0,0,canvas.width,canvas.height),scale};
}

// kind: what the file's bytes are (sniffWalletFile); read here when the caller did not.
export function createWalletDocumentScanner({file,kind='',onConfirm=()=>{},onCancel=()=>{},onReplace=()=>{}}={}) {
  const shell=node('section','wallet-scan-editor'); shell.dataset.scanState='analysing'; shell.dataset.scanEnhanced='true'; shell.dataset.scanAdjusting='false';
  const heading=node('h3',''); heading.hidden=true;
  const status=node('p','wallet-scan-status','확인하고 있습니다'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  const workspace=node('div','wallet-scan-workspace');
  const sourcePane=node('section','wallet-scan-pane wallet-scan-source-pane'); sourcePane.hidden=true; sourcePane.append(node('h4','', '직접 조정'));
  const stage=node('div','wallet-scan-stage'); const canvas=node('canvas','wallet-scan-source'); const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg'); overlay.classList.add('wallet-scan-outline'); overlay.setAttribute('aria-hidden','true');
  const polygon=document.createElementNS('http://www.w3.org/2000/svg','polygon'); overlay.append(polygon); stage.append(canvas,overlay); sourcePane.append(stage);
  const resultPane=node('section','wallet-scan-pane wallet-scan-result-pane');  const resultImage=node('img','wallet-scan-result-image'); resultImage.alt='배경과 여백을 제거한 자료 미리보기'; resultImage.hidden=true; resultPane.append(resultImage);
  workspace.append(sourcePane,resultPane);
  const warnings=node('div','wallet-scan-warnings'); warnings.setAttribute('role','status'); warnings.setAttribute('aria-live','polite');
  const choices=node('div','wallet-scan-choices');
  const adjust=node('button','consumer-action wallet-scan-adjust','직접 조정'); adjust.type='button'; adjust.dataset.walletScanAdjust='';
  const rotate=node('button','consumer-action wallet-scan-rotate','회전'); rotate.type='button'; rotate.dataset.walletScanRotate=''; rotate.setAttribute('aria-label','오른쪽으로 90도 회전');
  choices.append(rotate,adjust);
  const actions=node('div','wallet-scan-actions');
  const cancel=node('button','consumer-action','취소'); cancel.type='button'; const replace=node('button','consumer-action','다시 선택'); replace.type='button'; const confirm=node('button','consumer-action primary','저장'); confirm.type='button'; confirm.disabled=true; confirm.dataset.walletScanConfirm=''; actions.append(cancel,replace,confirm);
  shell.append(heading,status,workspace,warnings,choices,actions);

  const resources={bitmap:null,url:''}; let source=null; let corners=null; let fallbackCorners=null; let detectedCorners=null; let cornerRadius=0; let paperPage=false; let pdfDocument=null; let pdfSource=false; let notDocument=false; let detectionImage=null; let detectionScale=1; let detailImage=null; let manualFramesItem=false; let rotation=0; let latest=''; let enhanced=true; let destroyed=false; let renderVersion=0; let activePointer=null;
  const handles=new Map();

  function releaseResources(){detailImage=null;detectionImage=null;resources.bitmap?.close?.();resources.bitmap=null;if(resources.url){URL.revokeObjectURL(resources.url);resources.url=''}if(pdfDocument){void pdfDocument.destroy();pdfDocument=null}}

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
    if(!source||!corners||destroyed)return; const version=++renderVersion; confirm.disabled=true; status.textContent='확인하고 있습니다';
    try{
      const result=await rectifyDocument(source,corners,{enhance:enhanced,cornerRadius:automaticGeometryKept()?cornerRadius:0,paper:paperPage,rotation}); shell.dataset.scanRotation=String(rotation); if(destroyed||version!==renderVersion)return;
      latest=result.dataUrl; resultImage.src=result.dataUrl; resultImage.hidden=false; shell.dataset.scanEnhanced=String(enhanced);
      const automatic=shell.dataset.scanMode==='automatic';
      // A hand-placed crop is saved only when it frames a printed item (a pet never qualifies).
      const adjusted=!automatic&&manualGeometryChanged();
      const printed=adjusted&&(detailImage?framesPrintedItem(detailImage,corners):framesPrintedItem(detectionImage,Object.fromEntries(Object.entries(corners).map(([name,point])=>[name,{x:point.x*detectionScale,y:point.y*detectionScale}]))));
      manualFramesItem=automatic||printed;
      // Copy follows the outcome: nothing is called "corrected" until an item was found, and
      // photo-quality advice only appears for a found item.
      const receipt=shell.dataset.scanReason==='receipt-like';
      heading.textContent=manualFramesItem?'':notDocument?'등록할 수 없는 사진입니다':'자료를 찾지 못했습니다'; heading.hidden=!heading.textContent;
      warnings.replaceChildren(); if(manualFramesItem&&result.warnings.length){warnings.append(node('strong','', '다시 촬영 권장'));for(const code of result.warnings)warnings.append(node('p','',WARNING_COPY[code]||'사진 상태를 확인해 주세요.'))}
      status.textContent=manualFramesItem?''
        :receipt?'영수증은 등록하지 않습니다. 신분증·자격증·문서 사진을 선택해 주세요.'
        :notDocument?'신분증이나 문서로 보이지 않습니다. 신분증·자격증 사진을 선택해 주세요.'
        :adjusted?'모서리 안에 신분증이나 문서가 보이지 않습니다. 자료에 맞춰 모서리를 조정해 주세요.'
        :'신분증이나 문서를 찾지 못했습니다. 신분증·자격증이 잘 보이게 다시 선택해 주세요. 신분증이 맞다면 직접 조정으로 모서리를 맞출 수 있습니다.';
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
    // The full photo (at most 2560 pixels) is kept for judging the print inside a found or
    // hand-placed outline; the 1200-pixel copy finds the outline.
    const detection=detectionPixels(source); detectionImage=detection.imageData; detectionScale=detection.scale;
    detailImage=detection.scale<1?canvas.getContext('2d').getImageData(0,0,size.width,size.height):null;
    const found=detectDocumentCorners(detection.imageData,{sourceScale:detection.scale,detail:detailImage}); corners=Object.fromEntries(Object.entries(found.corners).map(([name,point])=>[name,{x:point.x/detection.scale,y:point.y/detection.scale}]));
    let mode=found.mode; let reason=found.reason||'';
    // A photo without printed text (a pet, a person) is not a wallet item: no adjusting, no saving.
    notDocument=reason==='not-a-document'||reason==='receipt-like'; adjust.hidden=notDocument; rotate.hidden=notDocument;
    // A card or page found lying on its side is turned upright; the 회전 button corrects it.
    rotation=mode==='automatic'?found.rotation||0:0;
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
      const type=kind||await sniffWalletFile(file);
      if(type==='pdf'||(type==='unknown'&&isPdfFile(file))){
        const opened=await openPdfDocument(file); if(destroyed){void opened.destroy();return}
        // Only the first page of a PDF is shown and saved.
        pdfDocument=opened; pdfSource=true; shell.dataset.scanPdfPages=String(opened.pageCount); status.textContent='확인하고 있습니다';
        const page=await opened.renderPage(1); if(destroyed)return;
        void opened.destroy(); pdfDocument=null;
        await analyse(page); return;
      }
      const decoded=await decodeFile(file,resources,type); if(destroyed){releaseResources();return}
      await analyse(decoded);
    }catch(error){showError(error)}
  }

  function openAdjustment(){sourcePane.hidden=false;shell.dataset.scanAdjusting='true';adjust.textContent='조정 닫기';handles.get('topLeft')?.focus()}
  function closeAdjustment(){sourcePane.hidden=true;shell.dataset.scanAdjusting='false';adjust.textContent='직접 조정';resultImage.focus?.()}
  adjust.addEventListener('click',()=>shell.dataset.scanAdjusting==='true'?closeAdjustment():openAdjustment());
  rotate.addEventListener('click',()=>{if(!source||destroyed)return;rotation=(rotation+90)%360;void renderPreview()});
  confirm.addEventListener('click',()=>{if(!latest||destroyed||notDocument)return;if(!manualFramesItem){confirm.disabled=true;return}onConfirm(latest)});
  cancel.addEventListener('click',()=>{if(!destroyed)onCancel();destroy()}); replace.addEventListener('click',()=>{if(!destroyed)onReplace();destroy()});

  function destroy(){if(destroyed)return;destroyed=true;renderVersion+=1;releaseResources();shell.replaceChildren()}
  void initialize();
  return Object.freeze({element:shell,destroy});
}
