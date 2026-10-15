// PDF pages for Life Wallet, drawn in this browser with the vendored Mozilla pdf.js, so a
// document never leaves the device. The library loads only when a PDF is chosen.
// The vendored folder is versioned by name, so these paths carry no cache token.
const libraryUrl = new URL('./vendor/pdfjs-6.4.299/pdf.min.js', import.meta.url);
const workerUrl = new URL('./vendor/pdfjs-6.4.299/pdf.worker.min.js', import.meta.url);
let loading = null;

function library() {
  loading ??= import(libraryUrl.href).then(pdfjs => {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.href;
    return pdfjs;
  }).catch(error => {
    loading = null;
    throw error;
  });
  return loading;
}

export function isPdfFile(file) {
  return file?.type === 'application/pdf' || /\.pdf$/iu.test(file?.name || '');
}

export async function openPdfDocument(file) {
  let pdfjs;
  try { pdfjs = await library(); } catch { throw new Error('PDF를 여는 도구를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: new URL('cmaps/', libraryUrl).href,
    cMapPacked: true,
    wasmUrl: new URL('wasm/', libraryUrl).href,
    isEvalSupported: false,
    enableXfa: false,
  });
  let pdf;
  try { pdf = await task.promise; } catch (error) {
    if (error?.name === 'PasswordException') throw new Error('암호가 걸린 PDF는 등록할 수 없습니다. 암호를 푼 PDF나 사진으로 선택해 주세요.');
    throw new Error('PDF를 열지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요.');
  }
  return Object.freeze({
    pageCount: pdf.numPages,
    // One page as a white-backed canvas, long side at most `maximumEdge` pixels.
    async renderPage(pageNumber, maximumEdge = 2560) {
      const page = await pdf.getPage(pageNumber);
      const unscaled = page.getViewport({scale: 1});
      const viewport = page.getViewport({scale: Math.min(4, maximumEdge / Math.max(unscaled.width, unscaled.height))});
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({canvas, canvasContext: context, viewport}).promise;
      page.cleanup();
      return canvas;
    },
    destroy() { return task.destroy(); },
  });
}
