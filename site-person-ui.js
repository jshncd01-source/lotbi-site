import {
  closePersonSos, createHumanSighting, createPerson, createPersonSos, deletePerson,
  getPerson, listGuardianNotices, listHumanSightings, listPeople, listPersonIdentityPhotos,
  listPersonSos, personRequestKey, putHumanSightingPhoto, putPersonIdentityPhoto,
  respondGuardianNotice, submitHumanSighting, updatePerson,
} from './site-person.js?v=aset-6c57f1339a92';

const IDENTITY_SLOTS = Object.freeze(['정면 얼굴', '왼쪽 45도', '오른쪽 45도', '왼쪽 옆면', '오른쪽 옆면', '정면 상반신', '정면 전신', '추가 정면', '추가 왼쪽', '추가 오른쪽']);
const el = (tag, className, text = '') => { const node = document.createElement(tag); node.className = className; node.textContent = text; return node; };
const fileDataUri = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('PHOTO_READ_FAILED')); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });

export async function mountPersonCareManager({sessionToken, root, initialSurface = 'home'}) {
  const surface = el('div', 'person-care-surface');
  root.replaceChildren(surface);
  if (!sessionToken) { surface.append(el('p', 'person-empty', '로그인하면 사람 안심케어를 사용할 수 있습니다.')); return {}; }
  const status = el('p', 'person-status'); status.setAttribute('role', 'status');
  const nav = el('div', 'person-tabs');
  const content = el('div', 'person-content');
  surface.append(status, nav, content);
  let people = [], cases = [], notices = [], sightings = [], active = ['home', 'sos', 'sighting', 'notices'].includes(initialSurface) ? initialSurface : 'home', editing = null, pendingSosPersonId = '';
  let identityPhotos = new Map();
  const availability = {sos: true, notices: true, sightings: true};
  const button = (label, action, primary = false) => { const node = el('button', primary ? 'site-button person-primary' : 'site-button site-button-secondary', label); node.type = 'button'; node.addEventListener('click', action); return node; };
  const partialAvailabilityMessage = () => Object.values(availability).every(Boolean)
    ? ''
    : '사람 등록과 사진 관리는 사용할 수 있습니다. 실종 관리와 발견 제보 연결을 준비 중입니다.';
  const refresh = async () => {
    people = await listPeople(sessionToken);
    const optionalResults = await Promise.allSettled([
      listPersonSos(sessionToken),
      listGuardianNotices(sessionToken),
      listHumanSightings(sessionToken),
    ]);
    const [sosResult, noticeResult, sightingResult] = optionalResults;
    availability.sos = sosResult.status === 'fulfilled';
    availability.notices = noticeResult.status === 'fulfilled';
    availability.sightings = sightingResult.status === 'fulfilled';
    cases = availability.sos ? sosResult.value : [];
    notices = availability.notices ? noticeResult.value : [];
    sightings = availability.sightings ? sightingResult.value : [];
    const photoResults = await Promise.allSettled(people.map(async item => [item.personId, await listPersonIdentityPhotos(sessionToken, item.personId)]));
    identityPhotos = new Map(photoResults.map((result, index) => result.status === 'fulfilled' ? result.value : [people[index].personId, []]));
    if (editing) {
      if (!people.some(item => item.personId === editing.personId)) editing = null;
      else {
        try { editing = await getPerson(sessionToken, editing.personId); }
        catch { editing = people.find(item => item.personId === editing.personId) || null; }
      }
    }
    render();
    status.textContent = partialAvailabilityMessage();
  };
  const renderNav = () => { nav.replaceChildren(...[['home', '등록된 사람'], ['sos', '실종 관리'], ['sighting', '발견 제보']].map(([id, label]) => button(label, () => { active = id; render(); }, active === id))); };

  const renderIdentityPhotos = person => {
    const box = el('section', 'person-form');
    const photos = identityPhotos.get(person.personId) || [];
    const renewalText = person.identityPhotoState === 'BIRTH_INFO_REQUIRED' ? '출생 연·월을 입력해야 갱신 주기를 계산하고 SOS를 사용할 수 있습니다.' : person.identityPhotoState === 'EXPIRED' ? '유효기간이 지났습니다. SOS 전에 10장을 갱신해 주세요.' : person.identityPhotoState === 'EXPIRING' ? `사진이 ${person.identityPhotoDaysRemaining ?? 0}일 뒤 만료됩니다. 지금 갱신해 주세요.` : `현재 갱신 주기는 ${person.identityPhotoValidityDays === 180 ? '6개월' : '1년'}이며, SOS 동의 전에는 검색에 사용되지 않습니다.`;
    box.append(el('h4', '', `비공개 식별사진 ${photos.length}/10`), el('p', 'person-consent', renewalText));
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
    const heading = el('div', 'person-section-heading');
    const headingCopy = el('div');
    headingCopy.append(el('h3', 'person-title', '등록된 사람'), el('p', 'person-empty', '보호 대상의 사진 갱신과 실종 상태를 한곳에서 관리합니다.'));
    heading.append(headingCopy, button('새 사람 등록', () => { content.querySelector('[data-person-create]')?.scrollIntoView({behavior: 'smooth', block: 'start'}); }, true));
    content.replaceChildren(heading);
    if (availability.notices && notices.length > 0) {
      const noticeButton = button(`확인할 발견 후보 ${notices.length}건`, () => { active = 'notices'; render(); });
      noticeButton.classList.add('person-notice-button');
      content.append(noticeButton);
    }
    for (const item of people) {
      const card = el('article', 'person-card');
      const activeCase = cases.find(record => record.personId === item.personId && record.status === 'ACTIVE');
      const state = item.identityPhotoState === 'BIRTH_INFO_REQUIRED' ? '출생정보 보완 필요' : item.identityPhotoState === 'EXPIRED' ? '사진 갱신 필요' : item.identityPhotoState === 'EXPIRING' ? `사진 만료 ${item.identityPhotoDaysRemaining ?? 0}일 전` : '사진 최신 상태';
      const head = el('div', 'person-card-head');
      head.append(el('strong', 'person-card-name', item.displayName), el('span', `person-state person-state-${item.identityPhotoState?.toLowerCase() || 'unknown'}`, state));
      const actions = el('div', 'person-card-actions');
      const missingAction = button(activeCase ? '실종 관리' : '실종 상태로 전환', () => { pendingSosPersonId = item.personId; active = 'sos'; render(); }, !activeCase);
      missingAction.disabled = !availability.sos;
      if (!availability.sos) missingAction.title = '실종 관리 연결을 준비 중입니다.';
      actions.append(
        button('사진 갱신·관리', async () => { try { editing = await getPerson(sessionToken, item.personId); renderHome(); queueMicrotask(() => content.querySelector('[data-person-photos]')?.scrollIntoView({behavior: 'smooth', block: 'start'})); } catch { status.textContent = '상세 정보를 불러오지 못했습니다.'; } }),
        missingAction,
      );
      card.append(head, el('p', 'person-card-meta', `${item.nickname || '별명 없음'} · 식별사진 ${item.identityPhotoCount}/10`));
      if (activeCase) card.append(el('p', 'person-active-missing', '실종 상태가 활성화되어 있습니다.'));
      card.append(actions);
      content.append(card);
    }
    if (!people.length) content.append(el('p', 'person-empty person-empty-panel', '아직 등록된 사람이 없습니다. 아래에서 첫 보호 대상을 등록해 주세요.'));
    if (editing) {
      const edit = document.createElement('form'); edit.className = 'person-form';
      const editName = document.createElement('input'); editName.required = true; editName.value = editing.displayName;
      const editNickname = document.createElement('input'); editNickname.value = editing.nickname || '';
      const editBirthYear = document.createElement('input'); editBirthYear.type = 'number'; editBirthYear.min = '1900'; editBirthYear.max = String(new Date().getFullYear()); editBirthYear.required = true; editBirthYear.placeholder = '태어난 연도'; editBirthYear.value = editing.birthYear == null ? '' : String(editing.birthYear);
      const editBirthMonth = document.createElement('input'); editBirthMonth.type = 'number'; editBirthMonth.min = '1'; editBirthMonth.max = '12'; editBirthMonth.required = true; editBirthMonth.placeholder = '태어난 월'; editBirthMonth.value = editing.birthMonth == null ? '' : String(editing.birthMonth);
      const editRelationship = document.createElement('select');
      for (const [value, label] of [['CHILD','자녀'],['PARENT','부모'],['SPOUSE','배우자'],['FAMILY','가족'],['DEPENDENT','돌봄 대상'],['OTHER','기타']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = value === editing.relationship; editRelationship.append(option); }
      const save = button('수정 저장', () => {}, true); save.type = 'submit';
      const editActions = el('div', 'person-form-actions');
      editActions.append(save, button('닫기', () => { editing = null; renderHome(); }));
      const remove = button('등록 삭제', async () => { await deletePerson(sessionToken, editing); editing = null; await refresh(); }); remove.classList.add('person-danger');
      edit.append(el('h4', '', `${editing.displayName} 상세`), editName, editNickname, editBirthYear, editBirthMonth, editRelationship, editActions, remove);
      edit.addEventListener('submit', async event => { event.preventDefault(); try { editing = await updatePerson(sessionToken, {personId: editing.personId, revision: editing.revision, displayName: editName.value.trim(), nickname: editNickname.value.trim(), relationship: editRelationship.value, birthYear: editBirthYear.value, birthMonth: editBirthMonth.value}); await refresh(); } catch { status.textContent = '수정하지 못했습니다. 출생 연·월을 확인해 주세요.'; } });
      const photos = renderIdentityPhotos(editing); photos.dataset.personPhotos = '';
      content.append(edit, photos);
    }
    const form = document.createElement('form'); form.className = 'person-form'; form.dataset.personCreate = '';
    const name = document.createElement('input'); name.required = true; name.placeholder = '이름';
    const birthYear = document.createElement('input'); birthYear.type = 'number'; birthYear.min = '1900'; birthYear.max = String(new Date().getFullYear()); birthYear.required = true; birthYear.placeholder = '태어난 연도 (예: 2017)';
    const birthMonth = document.createElement('input'); birthMonth.type = 'number'; birthMonth.min = '1'; birthMonth.max = '12'; birthMonth.required = true; birthMonth.placeholder = '태어난 월 (1~12)';
    const relationship = document.createElement('select'); for (const [value, label] of [['CHILD','자녀'],['PARENT','부모'],['SPOUSE','배우자'],['FAMILY','가족'],['DEPENDENT','돌봄 대상'],['OTHER','기타']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; relationship.append(option); }
    const submit = button('기본 정보 저장', () => {}, true); submit.type = 'submit';
    form.append(el('h4', '', '새 사람 등록'), name, birthYear, birthMonth, relationship, el('p', 'person-consent', '출생 연·월로 갱신 주기를 계산합니다. 만 12세 이하는 6개월, 만 13세 이상은 1년이며 만료 30일·7일·1일 전에 알려드립니다.'), el('p', 'person-consent', '기본 정보를 저장한 뒤 서로 다른 각도의 사진 10장을 등록합니다.'), submit);
    form.addEventListener('submit', async event => { event.preventDefault(); status.textContent = '저장 중…'; try { editing = await createPerson(sessionToken, {displayName: name.value.trim(), relationship: relationship.value, birthYear: birthYear.value, birthMonth: birthMonth.value, requestKey: personRequestKey('create')}); status.textContent = ''; await refresh(); } catch { status.textContent = '등록하지 못했습니다. 출생 연·월을 확인해 주세요.'; } });
    content.append(form);
  };

  const renderSos = () => {
    content.replaceChildren(el('h3', 'person-title', '실종 관리'), el('p', 'person-consent', '등록한 보호 대상을 선택해 실종 상태를 활성화합니다. 활성화한 동안에만 동의한 사진을 비공개 후보 검색에 사용합니다.'));
    if (!availability.sos) {
      content.append(el('p', 'person-empty person-empty-panel', '사람 등록과 사진 관리는 지금 사용할 수 있습니다. 실종 관리 연결은 준비 중입니다.'));
      return;
    }
    const activeCases = cases.filter(item => item.status === 'ACTIVE');
    for (const item of activeCases) { const card = el('article', 'person-card'); card.append(el('strong', '', item.displayName), el('p', '', item.lastSeenSummary), button('찾았어요 · 실종 상태 종료', async () => { await closePersonSos(sessionToken, item.sosId); await refresh(); })); content.append(card); }
    if (!activeCases.length) content.append(el('p', 'person-empty', '현재 실종 상태로 등록된 사람이 없습니다.'));
    const activePersonIds = new Set(activeCases.map(item => item.personId));
    const eligible = people.filter(item => item.hasPhoto && ['CURRENT', 'EXPIRING'].includes(item.identityPhotoState) && !activePersonIds.has(item.personId));
    const form = document.createElement('form'); form.className = 'person-form';
    const select = document.createElement('select'); for (const item of eligible) { const option = document.createElement('option'); option.value = item.personId; option.textContent = item.displayName; option.selected = item.personId === pendingSosPersonId; select.append(option); }
    const location = document.createElement('input'); location.required = true; location.placeholder = '마지막으로 본 장소';
    const description = document.createElement('textarea'); description.placeholder = '옷차림·특징';
    const consent = document.createElement('label'); consent.className = 'person-consent'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.required = true; consent.append(checkbox, document.createTextNode(' 등록 사진을 활성 SOS 기간 동안만 비공개 후보 검색과 관리자 검토에 사용하는 데 동의합니다.'));
    const submit = button('동의하고 실종 상태로 전환', () => {}, true); submit.type = 'submit'; submit.disabled = eligible.length === 0;
    form.append(el('h4', '', '실종 상태로 전환'), select, location, description, consent, submit);
    form.addEventListener('submit', async event => { event.preventDefault(); try { await createPersonSos(sessionToken, {personId: select.value, lastSeenAt: new Date().toISOString(), lastSeenSummary: location.value.trim(), description: description.value.trim(), matchingConsentConfirmed: checkbox.checked}); pendingSosPersonId = ''; await refresh(); } catch { status.textContent = '사진 10장과 갱신 상태, 동의를 확인해 주세요.'; } });
    if (eligible.length) content.append(form);
    else content.append(el('p', 'person-empty person-empty-panel', people.length ? '실종 상태로 전환하려면 최신 식별사진 10장을 먼저 등록해 주세요.' : '먼저 사람을 등록해 주세요.'));
  };

  const renderSightings = () => {
    content.replaceChildren(el('h3', 'person-title', '사람 발견 제보'), el('p', 'person-consent', '즉시 일치 여부를 답하지 않습니다. 서로 다른 각도의 사진 5장 이상을 받은 뒤 현재 LOTBI의 활성 SOS만 자세히 비교하고 관리자가 검토합니다.'));
    if (!availability.sightings) {
      content.append(el('p', 'person-empty person-empty-panel', '사람 등록과 사진 관리는 지금 사용할 수 있습니다. 발견 제보 연결은 준비 중입니다.'));
      return;
    }
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
  status.textContent = '사람 안심케어 정보를 불러오는 중입니다.'; try { await refresh(); } catch { status.textContent = '사람 등록 정보를 불러오지 못했습니다.'; }
  return {dispose() { root.replaceChildren(); }};
}
