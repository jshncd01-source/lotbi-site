import {closePersonSos, createPerson, createPersonSos, deletePerson, listGuardianNotices, listPeople, listPersonSos, personRequestKey, putPersonPhoto, respondGuardianNotice, updatePerson} from './site-person.js?v=aset-8f7d68845114';

const el = (tag, className, text = '') => { const node = document.createElement(tag); node.className = className; node.textContent = text; return node; };
const fileDataUri = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('PHOTO_READ_FAILED')); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });

export async function mountPersonCareManager({sessionToken, root, onOpenPet = () => {}}) {
  const surface = el('div', 'person-care-surface');
  root.replaceChildren(surface);
  if (!sessionToken) { surface.append(el('p', 'person-empty', '로그인하면 사람 안심케어를 사용할 수 있습니다.')); return {}; }
  const status = el('p', 'person-status');
  const nav = el('div', 'person-tabs');
  const content = el('div', 'person-content');
  surface.append(status, nav, content);
  let people = [], cases = [], notices = [], active = 'home', editing = null;
  const refresh = async () => { [people, cases, notices] = await Promise.all([listPeople(sessionToken), listPersonSos(sessionToken), listGuardianNotices(sessionToken)]); render(); };
  const button = (label, action, primary = false) => { const node = el('button', primary ? 'site-button person-primary' : 'site-button site-button-secondary', label); node.type = 'button'; node.addEventListener('click', action); return node; };
  const renderNav = () => { nav.replaceChildren(...[['sos', 'SOS / 실종 신고'], ['home', '사람'], ['pet', '반려동물'], ['notices', '후보 확인']].map(([id, label]) => button(label, () => { if (id === 'pet') { onOpenPet(); return; } active = id; render(); }, active === id))); };
  const renderHome = () => {
    content.replaceChildren(el('h3', 'person-title', '등록된 사람'));
    for (const item of people) { const card = el('article', 'person-card'); card.append(el('strong', '', item.displayName), el('p', '', `${item.nickname || '별명 없음'} · 사진 ${item.hasPhoto ? '등록됨' : '필요'}`), button('상세 · 수정', () => { editing = item; renderHome(); }), button('삭제', async () => { await deletePerson(sessionToken, item); await refresh(); })); content.append(card); }
    if (editing) { const edit = document.createElement('form'); edit.className = 'person-form'; const editName = document.createElement('input'); editName.required = true; editName.value = editing.displayName; const editNickname = document.createElement('input'); editNickname.value = editing.nickname || ''; const editRelationship = document.createElement('select'); for (const [value, label] of [['CHILD','자녀'],['PARENT','부모'],['SPOUSE','배우자'],['FAMILY','가족'],['DEPENDENT','돌봄 대상'],['OTHER','기타']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = value === editing.relationship; editRelationship.append(option); } const save = button('수정 저장', () => {}, true); save.type = 'submit'; edit.append(el('h4', '', `${editing.displayName} 상세`), editName, editNickname, editRelationship, save, button('닫기', () => { editing = null; renderHome(); })); edit.addEventListener('submit', async event => { event.preventDefault(); try { editing = await updatePerson(sessionToken, {personId: editing.personId, revision: editing.revision, displayName: editName.value.trim(), nickname: editNickname.value.trim(), relationship: editRelationship.value}); await refresh(); } catch { status.textContent = '수정하지 못했습니다.'; } }); content.append(edit); }
    const form = document.createElement('form'); form.className = 'person-form';
    const name = document.createElement('input'); name.required = true; name.placeholder = '이름';
    const relationship = document.createElement('select'); for (const [value, label] of [['CHILD','자녀'],['PARENT','부모'],['SPOUSE','배우자'],['FAMILY','가족'],['DEPENDENT','돌봄 대상'],['OTHER','기타']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; relationship.append(option); }
    const photo = document.createElement('input'); photo.type = 'file'; photo.accept = 'image/jpeg,image/png,image/webp'; photo.required = true;
    const submit = button('등록', () => {}, true); submit.type = 'submit';
    form.append(el('h4', '', '새 사람 등록'), name, relationship, photo, submit);
    form.addEventListener('submit', async event => { event.preventDefault(); status.textContent = '저장 중…'; try { let created = await createPerson(sessionToken, {displayName: name.value.trim(), relationship: relationship.value, requestKey: personRequestKey('create')}); created = await putPersonPhoto(sessionToken, {personId: created.personId, revision: created.revision, dataUri: await fileDataUri(photo.files[0]), requestKey: personRequestKey('photo')}); status.textContent = '등록했습니다.'; await refresh(); } catch { status.textContent = '등록하지 못했습니다.'; } });
    content.append(form);
  };
  const renderSos = () => {
    content.replaceChildren(el('h3', 'person-title', '진행 중 SOS'));
    for (const item of cases) { const card = el('article', 'person-card'); card.append(el('strong', '', item.displayName), el('p', '', item.lastSeenSummary), button('찾았어요 · 종료', async () => { await closePersonSos(sessionToken, item.sosId); await refresh(); })); content.append(card); }
    const eligible = people.filter(item => item.hasPhoto);
    const form = document.createElement('form'); form.className = 'person-form'; const select = document.createElement('select'); for (const item of eligible) { const option = document.createElement('option'); option.value = item.personId; option.textContent = item.displayName; select.append(option); } const location = document.createElement('input'); location.required = true; location.placeholder = '마지막으로 본 장소'; const description = document.createElement('textarea'); description.placeholder = '옷차림·특징'; const submit = button('SOS 등록', () => {}, true); submit.type = 'submit'; form.append(el('h4', '', 'SOS 등록'), select, location, description, el('p', 'person-consent', '등록 사진을 활성 SOS 기간 동안 내부 후보 생성과 관리자 비공개 검토에 사용하는 데 동의합니다.'), submit); form.addEventListener('submit', async event => { event.preventDefault(); try { await createPersonSos(sessionToken, {personId: select.value, lastSeenAt: new Date().toISOString(), lastSeenSummary: location.value.trim(), description: description.value.trim()}); await refresh(); } catch { status.textContent = 'SOS를 등록하지 못했습니다.'; } }); content.append(form);
  };
  const renderNotices = () => { content.replaceChildren(el('h3', 'person-title', '관리자 승인 후보')); for (const item of notices) { const card = el('article', 'person-card'); card.append(el('strong', '', `${item.displayName} 후보`), el('p', '', '점수는 동일인 확률이 아니며 연락처는 공개되지 않습니다.')); if (item.status === 'RESPONDED') card.append(el('p', 'person-result', `응답: ${item.response}`)); else for (const [value, label] of [['LIKELY_MINE','같아요'],['NOT_MINE','아니에요'],['UNSURE','모르겠어요']]) card.append(button(label, async () => { await respondGuardianNotice(sessionToken, item.noticeId, value); await refresh(); })); content.append(card); } if (!notices.length) content.append(el('p', 'person-empty', '확인할 후보가 없습니다.')); };
  const render = () => { renderNav(); if (active === 'home') renderHome(); else if (active === 'sos') renderSos(); else renderNotices(); };
  status.textContent = '사람 안심케어 정보를 불러오는 중입니다.'; try { await refresh(); status.textContent = ''; } catch { status.textContent = '정보를 불러오지 못했습니다.'; }
  return {dispose() { root.replaceChildren(); }};
}
