// User-visible feature switches that must stay identical across routing and UI.
// LOTBI-BOX-HIDE-02: keep stored data and implementation intact, but expose no
// save controls, list surface, or URL route until the product is enabled again.
// This is deliberately a source flag, not an environment/server setting.
export const LOTBI_BOX_UI_ENABLED = false;

// TRAFFIC-CCTV P0: 실시간 도로 CCTV stays off (owner decision 2026-10-10: the
// code ships; the 지역정보 card, the #traffic-cctv route and the player do not,
// until 국가교통정보센터 permission for commercial re-display is confirmed).
// Showing it also needs Core TRAFFIC_CCTV_ENABLED=true; this flag alone would
// only show "준비 중".
export const TRAFFIC_CCTV_UI_ENABLED = false;

// QA_화면전수_01 H3 (배포총괄방, 2026-10-11, USER_FIRST 13 — hide what is not finished):
// 지역생활정보 is two input fields and a [롯비에게 물어보기] button whose answer lands
// in the conversation, not in the screen. The card stays hidden (a source flag, as
// above) until its result appears inside the screen. The 'life-local' route, the
// form and its example questions are kept as they are; turning the flag on shows
// the card again and the validators run their 지역생활정보 steps again.
export const LIFE_LOCAL_CARD_ENABLED = false;
