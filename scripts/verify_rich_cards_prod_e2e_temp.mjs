import { chromium } from 'playwright';

const TARGET = 'https://lotbiai.com/';
const QUERY = 'RAD 찾아줘';

const browser = await chromium.launch({headless: true, channel: 'chrome'});
const context = await browser.newContext({viewport: {width: 1280, height: 900}});
const page = await context.newPage();
page.setDefaultTimeout(90000);

await page.goto(TARGET, {waitUntil: 'domcontentloaded'});
await page.locator('#lotbi-prompt').fill(QUERY);
await page.locator('.send-button').click();
await page.locator('.lotbi-rich-card-rail').waitFor({state: 'visible'});
await page.waitForFunction(() => document.querySelectorAll('.lotbi-rich-card').length >= 2);

const product = await page.locator('.lotbi-rich-card').first().evaluate(card => ({
  title: card.querySelector('.lotbi-rich-card-title')?.textContent?.trim() || '',
  price: card.querySelector('.lotbi-rich-card-price')?.textContent?.trim() || '',
  source: card.querySelector('.lotbi-rich-card-source')?.textContent?.trim() || '',
  actions: [...card.querySelectorAll('.lotbi-rich-card-action')].map(x => x.textContent?.trim() || ''),
}));
if (!/RAD/i.test(product.title)) throw new Error('REAL_TITLE_MISSING');
if (!product.price.includes('원')) throw new Error('REAL_PRICE_MISSING');
if (!product.actions.includes('상세보기') || !product.actions.includes('+ 롯비함') || !product.actions.includes('구매하기')) {
  throw new Error('CTA_SET_MISSING');
}

const sizes = [
  ['foldCover340', 340, 740],
  ['mobile390', 390, 844],
  ['unfolded768', 768, 900],
  ['desktop1280', 1280, 900],
];

const results = {};
for (const [name, width, height] of sizes) {
  await page.setViewportSize({width, height});
  await page.waitForTimeout(350);
  const metrics = await page.evaluate(({name, width}) => {
    const rail = document.querySelector('.lotbi-rich-card-rail');
    const cards = [...document.querySelectorAll('.lotbi-rich-card')];
    const card = cards[0];
    const second = cards[1];
    const image = card?.querySelector('.lotbi-rich-card-image');
    const title = card?.querySelector('.lotbi-rich-card-title');
    const actions = [...(card?.querySelectorAll('.lotbi-rich-card-action') || [])];
    const composer = document.querySelector('.chat-composer');
    const avatar = document.querySelector('[data-lotbi-avatar-container]');
    const calendar = document.querySelector('[data-life-calendar-panel]');
    const sidebar = document.querySelector('.chat-sidebar-desktop');
    const thread = document.querySelector('#conversation-thread');

    if (!rail || !card || !thread) return {name, width, error: 'MISSING_RICH_CARD_DOM'};

    rail.scrollLeft = 0;
    const rr = rail.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    const sr = second?.getBoundingClientRect();
    const ir = image?.getBoundingClientRect();
    const tr = title?.getBoundingClientRect();
    const threadRect = thread.getBoundingClientRect();
    const style = getComputedStyle(title);
    const rect = el => el?.getBoundingClientRect();
    const intersects = (a,b) => Boolean(a && b && a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 &&
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
    const visibleSecond = sr ? Math.max(0, Math.min(sr.right, rr.right) - Math.max(sr.left, rr.left)) : 0;

    return {
      name,
      viewport: innerWidth,
      bodyScrollWidth: document.documentElement.scrollWidth,
      cardCount: cards.length,
      railClientWidth: rail.clientWidth,
      railScrollWidth: rail.scrollWidth,
      railScrollable: rail.scrollWidth > rail.clientWidth + 2,
      cardWidth: cr.width,
      cardInsideViewport: cr.left >= -1 && cr.right <= innerWidth + 1,
      railInsideViewport: rr.left >= -1 && rr.right <= innerWidth + 1,
      secondCardPeekPx: visibleSecond,
      secondCardPartialVisible: Boolean(sr && visibleSecond > 1 && visibleSecond < sr.width - 1),
      imageRatio: ir && ir.height ? ir.width / ir.height : null,
      imageRatioOk: Boolean(ir && Math.abs((ir.width / ir.height) - (4/3)) < 0.12),
      titleInsideCard: Boolean(tr && tr.left >= cr.left - 1 && tr.right <= cr.right + 1),
      titleLineClamp: style?.webkitLineClamp || '',
      actionHeights: actions.map(a => a.getBoundingClientRect().height),
      ctaTouchTargetOk: width > 760 || actions.every(a => a.getBoundingClientRect().height >= 43),
      noGlobalHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth + 2,
      conversationAlignmentOk: rr.left >= threadRect.left - 2 && rr.right <= threadRect.right + 2,
      overlapComposer: intersects(rr, rect(composer)),
      overlapAvatar: intersects(rr, rect(avatar)),
      overlapCalendar: calendar && !calendar.hidden ? intersects(rr, rect(calendar)) : false,
      overlapSidebar: sidebar && getComputedStyle(sidebar).display !== 'none' ? intersects(rr, rect(sidebar)) : false,
      compactDesktop: width < 900 || cr.width <= 320,
    };
  }, {name, width});
  results[name] = metrics;
  await page.screenshot({path: `artifacts/${name}.png`, fullPage: true});
}

console.log('PRODUCT', JSON.stringify(product));
console.log('RESPONSIVE_METRICS', JSON.stringify(results, null, 2));

for (const [name, m] of Object.entries(results)) {
  if (m.error) throw new Error(`${name}:${m.error}`);
  if (m.cardCount < 2) throw new Error(`${name}:MULTIPLE_CARDS_MISSING`);
  if (!m.cardInsideViewport || !m.railInsideViewport || !m.noGlobalHorizontalOverflow) throw new Error(`${name}:VIEWPORT_OVERFLOW`);
  if (!m.imageRatioOk || !m.titleInsideCard) throw new Error(`${name}:CARD_CONTENT_LAYOUT`);
  if (!m.ctaTouchTargetOk) throw new Error(`${name}:CTA_TOUCH_TARGET`);
  if (m.overlapComposer || m.overlapAvatar || m.overlapCalendar || m.overlapSidebar) throw new Error(`${name}:OVERLAP`);
  if (!m.conversationAlignmentOk) throw new Error(`${name}:CONVERSATION_ALIGNMENT`);
  if (!m.compactDesktop) throw new Error(`${name}:DESKTOP_CARD_TOO_WIDE`);
  if ((name === 'foldCover340' || name === 'mobile390') && !m.railScrollable) throw new Error(`${name}:HORIZONTAL_SCROLL_MISSING`);
  if ((name === 'foldCover340' || name === 'mobile390') && !m.secondCardPartialVisible) throw new Error(`${name}:NEXT_CARD_PEEK_MISSING`);
}
await browser.close();
console.log('LOTBI PRODUCT RICH CARD PRODUCTION RESPONSIVE E2E PASS');
