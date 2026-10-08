// CONVERSATION-INTENT-PRODUCT-KNOWLEDGE-01 — product photo comparison cards.
//
// "크록스 클래식과 바야 사진으로 비교해줘" used to get a text table and no
// picture. Core now answers with CORE-PRODUCT-LOOKUP-01: for each product, the
// image its manufacturer's own product page declares, the page it came from,
// and a state saying why there is no picture when there is none. This module
// draws exactly that and nothing more:
//   - a picture only for OFFICIAL_PAGE_IMAGE, always with its official page
//     link and host underneath, so the source is visible next to the photo;
//   - for every other state a plain "확인하지 못했어요" box, never a stock or
//     guessed image;
//   - a picture that fails to load turns into the same plain box with the
//     official page link, so a broken image icon is never left behind.
// The media box has a fixed square ratio, so a late image never shifts the
// conversation under the reader.

const CONTRACT_ID = 'CORE-PRODUCT-LOOKUP-01';
const IMAGE_KIND = 'PRODUCT_IMAGE';
const OFFICIAL_PAGE_IMAGE = 'OFFICIAL_PAGE_IMAGE';
const IMAGE_STATUSES = new Set([
  OFFICIAL_PAGE_IMAGE,
  'PAGE_HAS_NO_IMAGE',
  'MODEL_NOT_MATCHED',
  'PAGE_UNAVAILABLE',
  'NO_OFFICIAL_PAGE',
]);
const MAX_PRODUCTS = 3;

function cleanText(value, limit) {
  if (typeof value !== 'string') return '';
  const text = value.replace(/\s+/gu, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

function httpsUrl(value) {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw || raw.length > 2048) return '';
  let parsed;
  try { parsed = new URL(raw); } catch { return ''; }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) return '';
  return parsed.href;
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./u, ''); } catch { return ''; }
}

function normalizeCard(value) {
  if (!value || typeof value !== 'object') return null;
  const name = cleanText(value.name, 80);
  if (!name) return null;
  const status = IMAGE_STATUSES.has(value.image_status) ? value.image_status : 'NO_OFFICIAL_PAGE';
  const pageUrl = httpsUrl(value.page_url);
  const imageUrl = status === OFFICIAL_PAGE_IMAGE && pageUrl ? httpsUrl(value.image_url) : '';
  return Object.freeze({
    name,
    brand: cleanText(value.brand, 40),
    image_status: imageUrl ? OFFICIAL_PAGE_IMAGE : (status === OFFICIAL_PAGE_IMAGE ? 'PAGE_HAS_NO_IMAGE' : status),
    image_url: imageUrl,
    page_url: pageUrl,
    source_host: pageUrl ? hostOf(pageUrl) : '',
  });
}

// The photo comparison as it is kept in the conversation: snake_case, so the
// same normaliser reads a fresh Core answer and a restored message.
export function compactProductLookupMeta(value) {
  if (!value || typeof value !== 'object' || value.contract_id !== CONTRACT_ID || value.kind !== IMAGE_KIND) return null;
  const products = Array.isArray(value.products)
    ? value.products.slice(0, MAX_PRODUCTS).map(normalizeCard).filter(Boolean)
    : [];
  if (!products.length) return null;
  return Object.freeze({
    contract_id: CONTRACT_ID,
    kind: IMAGE_KIND,
    subject: cleanText(value.subject, 160),
    products: Object.freeze(products),
  });
}

function element(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function missingText(status) {
  if (status === 'NO_OFFICIAL_PAGE') return '공식 제품 페이지를 찾지 못했어요';
  return '공식 이미지를 확인하지 못했어요';
}

function placeholder(doc, text) {
  const box = element(doc, 'span', 'lotbi-product-compare-placeholder', text);
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', text);
  return box;
}

function ensureStyles(doc) {
  if (!doc?.head || doc.querySelector('link[data-site-product-lookup-styles]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/site-product-lookup.css?v=aset-7428e1c042e2';
  link.dataset.siteProductLookupStyles = 'true';
  doc.head.appendChild(link);
}

export function createProductImageComparison(value, {document: doc = globalThis.document} = {}) {
  const result = compactProductLookupMeta(value);
  if (!result || !doc) return null;
  ensureStyles(doc);
  const names = result.products.map(card => card.name).join(' · ');
  const section = element(doc, 'section', 'lotbi-product-compare');
  section.dataset.productCount = String(result.products.length);
  section.setAttribute('aria-label', `${names} 공식 사진`);
  const list = element(doc, 'ul', 'lotbi-product-compare-grid');
  for (const card of result.products) {
    const item = element(doc, 'li', 'lotbi-product-compare-card');
    item.dataset.imageStatus = card.image_status;
    const media = element(doc, 'div', 'lotbi-product-compare-media');
    if (card.image_url) {
      const image = doc.createElement('img');
      image.className = 'lotbi-product-compare-image';
      image.alt = `${card.name} 공식 제품 이미지`;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => {
        item.dataset.imageStatus = 'IMAGE_LOAD_FAILED';
        media.replaceChildren(placeholder(doc, '이미지를 불러오지 못했어요'));
      }, {once: true});
      image.addEventListener('load', () => { image.classList.add('is-ready'); }, {once: true});
      image.src = card.image_url;
      media.appendChild(image);
    } else {
      media.appendChild(placeholder(doc, missingText(card.image_status)));
    }
    const caption = element(doc, 'div', 'lotbi-product-compare-caption');
    caption.appendChild(element(doc, 'strong', 'lotbi-product-compare-name', card.name));
    if (card.page_url) {
      caption.appendChild(element(doc, 'span', 'lotbi-product-compare-host', card.source_host));
      const link = element(doc, 'a', 'lotbi-product-compare-link', card.image_url ? '공식 페이지 열기' : '공식 페이지에서 사진 보기');
      link.href = card.page_url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `${card.name} 공식 페이지 열기, 새 창`);
      caption.appendChild(link);
    }
    item.append(media, caption);
    list.appendChild(item);
  }
  section.appendChild(list);
  const shown = result.products.filter(card => card.image_url).length;
  section.appendChild(element(
    doc,
    'p',
    'lotbi-product-compare-note',
    shown ? '사진 출처: 각 제품 공식 페이지에 게시된 대표 이미지' : '공식 이미지를 확인하지 못해 사진 대신 공식 페이지 링크를 보여드려요',
  ));
  return section;
}
