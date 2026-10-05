import {
  createPersonProfile, deletePersonProfile, listPersonProfiles,
  personThumbnailUrl, uploadPersonPhoto,
} from './site-person.js?v=aset-21e31ea833e3';

const RELATIONSHIPS = Object.freeze([
  ['CHILD', '자녀'], ['PARENT', '부모'], ['SPOUSE', '배우자'],
  ['FAMILY', '가족'], ['DEPENDENT', '보호 대상'], ['OTHER', '기타'],
]);
const PLAN_LIMITS = Object.freeze({BASIC: 1, PLUS: 5, PRO: 15});

function el(tag, className = '', text = '') {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text) value.textContent = text;
  return value;
}

function button(label, className = '') {
  const value = el('button', className, label); value.type = 'button'; return value;
}

function fileDataUrl(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return Promise.reject(new Error('JPG, PNG 또는 WEBP 사진을 선택해 주세요.'));
  }
  if (file.size > 2 * 1024 * 1024) return Promise.reject(new Error('사진은 2MB 이하로 선택해 주세요.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('사진을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

export async function mountPersonProfileManager({sessionToken, root, subscription, onCountChange} = {}) {
  let disposed = false;
  const objectUrls = new Set();
  const releaseUrls = () => { for (const url of objectUrls) URL.revokeObjectURL(url); objectUrls.clear(); };
  const status = el('p', 'person-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');

  if (!sessionToken) {
    const state = el('section', 'person-empty');
    state.append(el('h3', '', '로그인하고 소중한 사람을 등록하세요'), el('p', '', '등록 정보와 사진은 본인 계정에서만 볼 수 있습니다.'));
    const login = el('a', 'person-primary', '로그인'); login.href = 'https://account.lotbiai.com/login';
    state.append(login); root.replaceChildren(state);
    return {dispose: releaseUrls};
  }

  const shell = el('section', 'person-manager');
  const header = el('div', 'person-header');
  const titleBox = el('div'); titleBox.append(el('h3', '', '등록된 사람'), el('p', 'person-capacity'));
  const add = button('사람 등록', 'person-primary'); header.append(titleBox, add);
  const list = el('div', 'person-list');
  shell.append(header, status, list); root.replaceChildren(shell);

  const limit = PLAN_LIMITS[subscription?.plan] || null;
  let people = [];

  function updateCapacity() {
    const copy = titleBox.querySelector('.person-capacity');
    copy.textContent = limit
      ? `사람 ${people.length}명 · ${subscription.plan} 안심케어 전체 한도 ${limit}개 (사람+반려동물)`
      : `사람 ${people.length}명 · 사람과 반려동물은 같은 안심케어 한도를 사용합니다.`;
    onCountChange?.({people: people.length});
  }

  async function renderList() {
    releaseUrls(); list.replaceChildren(); updateCapacity();
    if (!people.length) {
      const empty = el('div', 'person-empty');
      empty.append(el('h4', '', '아직 등록된 사람이 없습니다'), el('p', '', '가족이나 보호 대상을 먼저 등록해 두면 필요할 때 빠르게 찾을 수 있어요.'));
      list.append(empty); return;
    }
    for (const person of people) {
      const card = el('article', 'person-card');
      const avatar = el('div', 'person-avatar', person.display_name?.slice(0, 1) || '사');
      if (person.has_photo) {
        personThumbnailUrl(sessionToken, person.person_id).then(url => {
          if (disposed) { URL.revokeObjectURL(url); return; }
          objectUrls.add(url); const image = el('img'); image.src = url; image.alt = `${person.display_name} 대표 사진`; avatar.replaceChildren(image);
        }).catch(() => {});
      }
      const detail = el('div', 'person-card-copy');
      detail.append(el('strong', '', person.display_name), el('span', '', RELATIONSHIPS.find(([code]) => code === person.relationship)?.[1] || '가족'));
      const remove = button('삭제', 'person-delete');
      remove.addEventListener('click', async () => {
        if (remove.dataset.confirm !== 'true') {
          remove.dataset.confirm = 'true'; remove.textContent = '한 번 더 눌러 삭제';
          setTimeout(() => { if (!disposed) { remove.dataset.confirm = ''; remove.textContent = '삭제'; } }, 4000); return;
        }
        remove.disabled = true; status.textContent = '삭제하고 있어요.';
        try {
          await deletePersonProfile(sessionToken, person.person_id, person.revision);
          people = people.filter(item => item.person_id !== person.person_id);
          status.textContent = '삭제했습니다.'; await renderList();
        } catch (error) { status.textContent = error?.message || '삭제하지 못했습니다.'; remove.disabled = false; }
      });
      card.append(avatar, detail, remove); list.append(card);
    }
  }

  function openForm() {
    const form = el('form', 'person-form');
    const heading = el('div', 'person-form-heading');
    heading.append(el('h3', '', '사람 등록'), el('p', '', '꼭 필요한 정보만 입력하세요. 대표 사진은 선택 사항이며 본인 계정에 비공개로 보관됩니다.'));
    const nameLabel = el('label', 'person-field', '이름');
    const name = el('input'); name.name = 'display_name'; name.required = true; name.maxLength = 120; name.autocomplete = 'off'; name.placeholder = '예: 김롯비'; nameLabel.append(name);
    const relationLabel = el('label', 'person-field', '관계');
    const relation = el('select'); relation.name = 'relationship';
    for (const [value, label] of RELATIONSHIPS) { const option = el('option', '', label); option.value = value; relation.append(option); }
    relationLabel.append(relation);
    const nicknameLabel = el('label', 'person-field', '부르는 이름 (선택)');
    const nickname = el('input'); nickname.name = 'nickname'; nickname.maxLength = 80; nickname.autocomplete = 'off'; nickname.placeholder = '예: 우리 엄마'; nicknameLabel.append(nickname);
    const photoLabel = el('label', 'person-field person-photo-field', '대표 사진 (선택)');
    const photo = el('input'); photo.type = 'file'; photo.accept = 'image/jpeg,image/png,image/webp'; photoLabel.append(photo, el('small', '', '얼굴이 잘 보이는 JPG·PNG·WEBP, 2MB 이하'));
    const formStatus = el('p', 'person-status'); formStatus.setAttribute('role', 'alert');
    const actions = el('div', 'person-form-actions');
    const cancel = button('취소', 'person-secondary');
    const submit = button('등록하기', 'person-primary'); submit.type = 'submit'; actions.append(cancel, submit);
    form.append(heading, nameLabel, relationLabel, nicknameLabel, photoLabel, formStatus, actions);
    cancel.addEventListener('click', () => { shell.replaceChildren(header, status, list); add.focus(); });
    form.addEventListener('submit', async event => {
      event.preventDefault(); submit.disabled = true; cancel.disabled = true; formStatus.textContent = '안전하게 등록하고 있어요.';
      try {
        let person = await createPersonProfile(sessionToken, {
          display_name: name.value.trim(), relationship: relation.value,
          nickname: nickname.value.trim() || null, birthday_month: null, birthday_day: null,
        });
        if (photo.files?.[0]) person = await uploadPersonPhoto(sessionToken, person.person_id, person.revision, await fileDataUrl(photo.files[0]));
        people.push(person); status.textContent = '사람을 등록했습니다.';
        shell.replaceChildren(header, status, list); await renderList();
      } catch (error) {
        formStatus.textContent = error?.message || '등록하지 못했습니다. 잠시 후 다시 시도해 주세요.';
        submit.disabled = false; cancel.disabled = false;
      }
    });
    shell.replaceChildren(form); name.focus();
  }

  add.addEventListener('click', openForm);
  status.textContent = '등록된 사람을 확인하고 있어요.';
  try {
    people = await listPersonProfiles(sessionToken);
    if (!disposed) { status.textContent = ''; await renderList(); }
  } catch (error) {
    if (!disposed) { status.textContent = error?.message || '사람 정보를 불러오지 못했습니다.'; updateCapacity(); }
  }
  return {dispose() { disposed = true; releaseUrls(); }};
}
