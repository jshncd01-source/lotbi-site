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
