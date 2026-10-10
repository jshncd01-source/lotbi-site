// REGIONAL-NEWS-P0 — 지역뉴스 answer cards (Core contract CORE-REGIONAL-NEWS-01).
//
// Core has already de-duplicated the stories: one card per story, with the
// other outlets' reports of it as "관련 보도 N건". A card shows only what the
// NAVER news search returned - headline, outlet (its web address), time and
// the search snippet - and "원문 열기" hands off to the outlet's own article.
// Nothing here is LOTBI's writing, and the search API gives no stable image,
// so a card has no image area at all.

const CONTRACT_ID = 'CORE-REGIONAL-NEWS-01';
const MAX_ITEMS = 5;
const MAX_RELATED = 5;
const CLUSTER_RE = /^nwc_[0-9a-f]{16}$/u;

function clean(value, max = 200) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f<>]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, max) : '';
}

function webUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

function isoTime(value) {
  if (typeof value !== 'string') return '';
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : '';
}

function normalizeArticle(value) {
  if (!value || typeof value !== 'object') return null;
  const title = clean(value.title, 200);
  const url = webUrl(value.url);
  if (!title || !url) return null;
  return {
    title,
    url,
    source_label: clean(value.source_label, 60) || '언론사',
    published_at: isoTime(value.published_at),
  };
}

export function normalizeNewsResult(value) {
  if (!value || typeof value !== 'object' || value.contract_id !== CONTRACT_ID) return null;
  const items = [];
  for (const raw of Array.isArray(value.items) ? value.items.slice(0, MAX_ITEMS) : []) {
    const article = normalizeArticle(raw);
    if (!article) continue;
    const related = (Array.isArray(raw.related) ? raw.related : []).map(normalizeArticle).filter(Boolean).slice(0, MAX_RELATED);
    const count = Number.isInteger(raw.related_count) && raw.related_count >= 0 ? Math.min(raw.related_count, 99) : related.length;
    items.push({
      ...article,
      cluster_id: typeof raw.cluster_id === 'string' && CLUSTER_RE.test(raw.cluster_id) ? raw.cluster_id : '',
      snippet: clean(raw.snippet, 140),
      related_count: count,
      related,
    });
  }
  const region = value.region && typeof value.region === 'object' ? clean(value.region.label, 40) : '';
  return {
    contract_id: CONTRACT_ID,
    region,
    attribution: clean(value.attribution, 60) || '검색: NAVER · 기사: 각 언론사',
    items,
  };
}

// What the conversation keeps for the answer (and stores with it).
export function compactNewsResultMeta(value) {
  const normalized = normalizeNewsResult(value);
  return normalized && normalized.items.length ? normalized : null;
}

export function relativeNewsTime(iso, now = Date.now()) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '';
  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}시간 전`;
  const date = new Date(time);
  const local = new Intl.DateTimeFormat('ko-KR', {timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric'}).formatToParts(date);
  const month = local.find(part => part.type === 'month')?.value;
  const day = local.find(part => part.type === 'day')?.value;
  return month && day ? `${month}월 ${day}일` : '';
}

function element(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function articleLink(doc, className, url, text, label) {
  const link = element(doc, 'a', className, text);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.referrerPolicy = 'no-referrer';
  if (label) link.setAttribute('aria-label', label);
  return link;
}

function metaLine(doc, article, now) {
  const meta = element(doc, 'p', 'lotbi-news-meta');
  meta.append(element(doc, 'span', 'lotbi-news-source', article.source_label));
  const when = relativeNewsTime(article.published_at, now);
  if (when) {
    const time = element(doc, 'time', 'lotbi-news-time', when);
    time.dateTime = article.published_at;
    meta.append(time);
  }
  return meta;
}

function ensureNewsStyles(doc) {
  if (!doc?.head || doc.querySelector('link[data-site-regional-news-styles]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/site-regional-news.css?v=aset-cb1e2d5d19ae';
  link.dataset.siteRegionalNewsStyles = 'true';
  doc.head.appendChild(link);
}

export function createNewsResultCards(value, {document: doc = globalThis.document, now = Date.now()} = {}) {
  const result = normalizeNewsResult(value);
  if (!result || !result.items.length) return null;
  ensureNewsStyles(doc);
  const section = element(doc, 'section', 'lotbi-news-result');
  section.setAttribute('aria-label', `${result.region ? `${result.region} ` : ''}지역뉴스 ${result.items.length}건`);
  const list = element(doc, 'ol', 'lotbi-news-list');
  for (const article of result.items) {
    const card = element(doc, 'li', 'lotbi-news-card');
    if (article.cluster_id) card.dataset.newsCluster = article.cluster_id;
    card.append(element(doc, 'h4', 'lotbi-news-title', article.title), metaLine(doc, article, now));
    if (article.snippet) card.append(element(doc, 'p', 'lotbi-news-snippet', article.snippet));
    const actions = element(doc, 'div', 'lotbi-news-actions');
    actions.append(articleLink(doc, 'lotbi-news-open', article.url, '원문 열기', `${article.title} 원문 열기, 새 창`));
    card.append(actions);
    if (article.related_count > 0) {
      const related = element(doc, 'details', 'lotbi-news-related');
      related.append(element(doc, 'summary', 'lotbi-news-related-toggle', `관련 보도 ${article.related_count}건`));
      if (article.related.length) {
        const others = element(doc, 'ul', 'lotbi-news-related-list');
        for (const other of article.related) {
          const item = element(doc, 'li', 'lotbi-news-related-item');
          item.append(
            articleLink(doc, 'lotbi-news-related-link', other.url, other.title, `${other.source_label} ${other.title} 원문 열기, 새 창`),
            metaLine(doc, other, now),
          );
          others.append(item);
        }
        related.append(others);
      }
      // Sits on the same row as 원문 열기; the list opens below the card text.
      actions.append(related);
    }
    list.append(card);
  }
  section.append(list, element(doc, 'p', 'lotbi-news-attribution', result.attribution));
  return section;
}
