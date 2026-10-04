import {
  closePersonSos, createHumanSighting, createPerson, createPersonSos, deletePerson,
  listGuardianNotices, listHumanSightings, listPeople, listPersonIdentityPhotos,
  listPersonSos, personRequestKey, putHumanSightingPhoto, putPersonIdentityPhoto,
  respondGuardianNotice, submitHumanSighting, updatePerson,
} from './site-person.js?v=aset-8f7d68845114';

const IDENTITY_SLOTS = Object.freeze(['정면 얼굴', '왼쪽 45도', '오른쪽 45도', '왼쪽 옆면', '오른쪽 옆면', '정면 상반신', '정면 전신', '추가 정면', '추가 왼쪽', '추가 오른쪽']);
const el = (tag, className, text = '') => { const node = document.createElement(tag); node.className = className; node.textContent = text; return node; };
const fileDataUri = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('PHOTO_READ_FAILED')); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });

export async function mountPersonCareManager({sessionToken, root, onOpenPet = () => {}}) {
  const surface = el('div', 'person-care-surface');
  root.replaceChildren(surface);
  if (!sessionToken) { surface.append(el('p', 'person-empty', '로그인하면 사람 안심케어를 사용할 수 있습니다.')); return {}; }
  const status = el('p', 'person-status'); status.setAttribute('role', 'status');
  const nav = el('div', 'person-tabs');
  const content = el('div', 'person-content');
  surface.append(status, nav, content);
  let people = [], cases = [], notices = [], sightings = [], active = 'home', editing = null;
  let identityPhotos = new Map();
  const button = (label, action, primary = false) => { const node = el('button', primary ? 'site-button person-primary' : 'site-button site-button-secondary', label); node.type = 'button'; node.addEventListener('click', action); return node; };
  const refresh = async () => {
    [people, cases, notices, sightings] = await Promise.all([listPeople(sessionToken), listPersonSos(sessionToken), listGuardianNotices(sessionToken), listHumanSightings(sessionToken)]);
    identityPhotos = new Map(await Promise.all(people.map(async item => [item.personId, await listPersonIdentityPhotos(sessionToken, item.personId)])));
    if (editing) editing = people.find(item => item.personId === editing.personId) || null;
    render();
  };
  const renderNav = () => { nav.replaceChildren(...[['sos', 'SOS / 실종 신고'], ['home', '사람'], ['pet', '반려동물'], ['sighting', '발견 제보'], ['notices', '후보 확인']].map(([id, label]) => button(label, () => { if (id === 'pet') { onOpenPet(); return; } active = id; render(); }, active === id))); };

  const renderIdentityPhotos = person => {
    const box = el('section', 'person-form');
    const photos = identityPhotos.get(person.personId) || [];
    box.append(el('h4', '', `비공개 식별사진 ${photos.length}/10`), el('p', 'person-consent', person.identityPhotoState === 'EXPIRED' ? '유효기간이 지났습니다. SOS 전에 10장을 갱신해 주세요.' : '사진은 1년마다 갱신하며, SOS 동의 전에는 검색에 사용되지 않습니다.'));
    IDENTITY_SLOTS.forEach((label, index) => {
      const row = el('label', 'person-photo-slot');
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp';
      row.append(el('span', '', `${photos.some(item => item.slotIndex === index + 1) ? '✓' : '+'} ${index + 1}. ${label}`), input);
      input.addEventListener('change', async () => { const file = input.files?.[0]; if (!file) return; status.textContent = '사진을 안전하게 저장하는 중…'; try { await putPersonIdentityPhoto(sessionToken, person.personId, index + 1, await fileDataUri(file)); status.textContent = ''; await refresh(); } catch { status.textContent = '사진을 저장하지 못했습니다. 같은 사진이 아닌 선명한 다른 각도 사진을 선택해 주세요.'; } });
      box.append(row);
    });
    return box;
  };

  const renderHome = () => {
    content.replaceChildren(el('h3', 'person-title', '등록된 사람'));
    for (const item of people) {
      const card = el('article', 'person-card');
      card.append(el('strong', '', item.displayName), el('p', '', `${item.nickname || '별명 없음'} · 식별사진 ${item.identityPhotoCount}/10${item.identityPhotoState === 'EXPIRED' ? ' · 갱신 필요' : ''}`), button('상세 · 사진 관리', () => { editing = item; renderHome(); }), button('삭제', async () => { await deletePerson(sessionToken, item); await refresh(); }));
      content.append(card);
    }
    if (editing) {
      const edit = document.createElement('form'); edit.className = 'person-form';
      const editName = document.createElement('input'); editName.required = true; editName.value = editing.displayName;
      const editNickname = document.createElement('input'); editNickname.value = editing.nickname || '';
      const editRelationship = document.createElement('select');
      for (const [value, label] of [['CHILD','자녀'],['PARENT','부모'],['SPOUSE','배우자'],['FAMILY','가족'],['DEPENDENT','돌봄 대상'],['OTHER','기타']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = value === editing.relationship; editRelationship.append(option); }
      const save = button('수정 저장', () => {}, true); save.type = 'submit';
      edit.append(el('h4', '', `${editing.displayName} 상세`), editName, editNickname, editRelationship, save, button('닫기', () => { editing = null; renderHome(); }));
      edit.addEventListener('submit', async event => { event.preventDefault(); try { editing = await updatePerson(sessionToken, {personId: editing.personId, revision: editing.revision, displayName: editName.value.trim(), nickname: editNickname.value.trim(), relationship: editRelationship.value}); await refresh(); } catch { status.textContent = '수정하지 못했습니다.'; } });
      content.append(edit, renderIdentityPhotos(editing));
    }
    const form = document.createElement('form'); form.className = 'person-form';
    const name = document.createElement('input'); name.required = true; name.placeholder = '이름';
    const relationship = document.createElement('select'); for (const [value, label] of [['CHILD','자녀'],['PARENT','부모'],['SPOUSE','배우자'],['FAMILY','가족'],['DEPENDENT','돌봄 대상'],['OTHER','기타']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; relationship.append(option); }
    const submit = button('기본 정보 저장', () => {}, true); submit.type = 'submit';
    form.append(el('h4', '', '새 사람 등록'), name, relationship, el('p', 'person-consent', '기본 정보를 저장한 뒤 서로 다른 각도의 사진 10장을 등록합니다.'), submit);
    form.addEventListener('submit', async event => { event.preventDefault(); status.textContent = '저장 중…'; try { editing = await createPerson(sessionToken, {displayName: name.value.trim(), relationship: relationship.value, requestKey: personRequestKey('create')}); status.textContent = ''; await refresh(); } catch { status.textContent = '등록하지 못했습니다.'; } });
    content.append(form);
  };

  const renderSos = () => {
    content.replaceChildren(el('h3', 'person-title', '진행 중 SOS'));
    for (const item of cases) { const card = el('article', 'person-card'); card.append(el('strong', '', item.displayName), el('p', '', item.lastSeenSummary), button('찾았어요 · 종료', async () => { await closePersonSos(sessionToken, item.sosId); await refresh(); })); content.append(card); }
    const eligible = people.filter(item => item.hasPhoto && item.identityPhotoState !== 'EXPIRED');
    const form = document.createElement('form'); form.className = 'person-form';
    const select = document.createElement('select'); for (const item of eligible) { const option = document.createElement('option'); option.value = item.personId; option.textContent = item.displayName; select.append(option); }
    const location = document.createElement('input'); location.required = true; location.placeholder = '마지막으로 본 장소';
    const description = document.createElement('textarea'); description.placeholder = '옷차림·특징';
    const consent = document.createElement('label'); consent.className = 'person-consent'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.required = true; consent.append(checkbox, document.createTextNode(' 등록 사진을 활성 SOS 기간 동안만 비공개 후보 검색과 관리자 검토에 사용하는 데 동의합니다.'));
    const submit = button('동의하고 SOS 등록', () => {}, true); submit.type = 'submit';
    form.append(el('h4', '', 'SOS 등록'), select, location, description, consent, submit);
    form.addEventListener('submit', async event => { event.preventDefault(); try { await createPersonSos(sessionToken, {personId: select.value, lastSeenAt: new Date().toISOString(), lastSeenSummary: location.value.trim(), description: description.value.trim(), matchingConsentConfirmed: checkbox.checked}); await refresh(); } catch { status.textContent = '사진 10장과 갱신 상태, 동의를 확인해 주세요.'; } });
    content.append(form);
  };

  const renderSightings = () => {
    content.replaceChildren(el('h3', 'person-title', '사람 발견 제보'), el('p', 'person-consent', '즉시 일치 여부를 답하지 않습니다. 서로 다른 각도의 사진 5장 이상을 받은 뒤 현재 LOTBI의 활성 SOS만 자세히 비교하고 관리자가 검토합니다.'));
    const form = document.createElement('form'); form.className = 'person-form';
    const location = document.createElement('input'); location.required = true; location.placeholder = '발견 장소';
    const description = document.createElement('textarea'); description.placeholder = '옷차림·특징 (선택)';
    const submit = button('제보 작성 시작', () => {}, true); submit.type = 'submit'; form.append(location, description, submit);
    form.addEventListener('submit', async event => { event.preventDefault(); try { await createHumanSighting(sessionToken, {observedAt: new Date().toISOString(), locationSummary: location.value.trim(), description: description.value.trim()}); await refresh(); } catch { status.textContent = '제보 작성을 시작하지 못했습니다.'; } });
    content.append(form);
    for (const report of sightings) {
      const card = el('article', 'person-card'); card.append(el('strong', '', `사진 ${report.photoCount}/10 · 최소 5장`), el('p', '', report.message));
      if (report.reviewState === 'DRAFT' && report.photoCount < 10) {
        const label = el('label', 'person-photo-slot', '+ 다른 각도의 선명한 사진 추가'); const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; label.append(input);
        input.addEventListener('change', async () => { const file = input.files?.[0]; if (!file) return; try { await putHumanSightingPhoto(sessionToken, report.reportId, report.photoCount + 1, await fileDataUri(file)); await refresh(); } catch { status.textContent = '제보 사진을 저장하지 못했습니다.'; } }); card.append(label);
        const send = button('검토 요청 제출', async () => { try { await submitHumanSighting(sessionToken, report.reportId); await refresh(); } catch { status.textContent = '서로 다른 각도의 사진 5장 이상인지 확인해 주세요.'; } }, true); send.disabled = !report.canSubmit; card.append(send);
      }
      content.append(card);
    }
  };

  const renderNotices = () => { content.replaceChildren(el('h3', 'person-title', '관리자 승인 후보')); for (const item of notices) { const card = el('article', 'person-card'); card.append(el('strong', '', `${item.displayName} 후보`), el('p', '', '점수는 동일인 확률이 아니며 연락처는 공개되지 않습니다.')); if (item.status === 'RESPONDED') card.append(el('p', 'person-result', `응답: ${item.response}`)); else for (const [value, label] of [['LIKELY_MINE','같아요'],['NOT_MINE','아니에요'],['UNSURE','모르겠어요']]) card.append(button(label, async () => { await respondGuardianNotice(sessionToken, item.noticeId, value); await refresh(); })); content.append(card); } if (!notices.length) content.append(el('p', 'person-empty', '확인할 후보가 없습니다.')); };
  const render = () => { renderNav(); if (active === 'home') renderHome(); else if (active === 'sos') renderSos(); else if (active === 'sighting') renderSightings(); else renderNotices(); };
  status.textContent = '사람 안심케어 정보를 불러오는 중입니다.'; try { await refresh(); status.textContent = ''; } catch { status.textContent = '정보를 불러오지 못했습니다.'; }
  return {dispose() { root.replaceChildren(); }};
}
