// HOME-FAVORITES-01 — local, account-scoped shortcuts using the existing
// data-home-prompt handler. No new API, recommended item or popup owner.
export const HOME_FAVORITES_LIMIT = 8;
export const HOME_FAVORITE_NAME_LIMIT = 12;
const DEFAULT_ITEM = Object.freeze({id: 'weekly-calendar', name: '이번 주 일정', question: '이번 주 해야 할 일을 정리해 줘'});
const keyFor = scope => `lotbi.site.home-favorites.v1.${scope}`;
const characters = value => Array.from(String(value || '').normalize('NFC'));

export function normalizeHomeFavorites(value) {
  if (!Array.isArray(value)) return [{...DEFAULT_ITEM}];
  const seen = new Set();
  return value.flatMap(item => {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 100 || seen.has(item.id)
      || typeof item.name !== 'string' || typeof item.question !== 'string') return [];
    const name = item.name.trim().normalize('NFC');
    const question = item.question.trim();
    if (!name || characters(name).length > HOME_FAVORITE_NAME_LIMIT || !question || question.length > 1000) return [];
    seen.add(item.id);
    return [{id: item.id, name, question}];
  }).slice(0, HOME_FAVORITES_LIMIT);
}

export function mountHomeFavorites({element, storage, scope}) {
  if (!element) return null;
  const list = element.querySelector('[data-favorites-list]');
  const count = element.querySelector('[data-favorites-count]');
  const edit = element.querySelector('[data-favorites-edit]');
  const form = element.querySelector('[data-favorites-editor]');
  const nameInput = form.elements.namedItem('name');
  const questionInput = form.elements.namedItem('question');
  const status = element.querySelector('[data-favorites-status]');
  const memory = new Map();
  let currentScope = scope;
  let items = [];
  let editing = false;
  let editingId = null;
  const say = message => { status.textContent = message; status.hidden = !message; };
  const read = () => {
    try {
      const raw = storage?.getItem(keyFor(currentScope));
      if (raw !== null && raw !== undefined) return normalizeHomeFavorites(JSON.parse(raw).items);
    } catch {}
    return memory.get(currentScope) || normalizeHomeFavorites(null);
  };
  const save = () => {
    memory.set(currentScope, items.map(item => ({...item})));
    try {
      if (!storage) throw new Error('storage unavailable');
      storage.setItem(keyFor(currentScope), JSON.stringify({version: 1, items}));
      return true;
    } catch {
      say('이 브라우저에서는 저장할 수 없어요. 창을 닫으면 변경 내용이 사라져요.');
      return false;
    }
  };
  const button = (label, action, id) => {
    const node = document.createElement('button');
    node.type = 'button'; node.textContent = label;
    node.dataset.favoriteAction = action;
    if (id) node.dataset.favoriteId = id;
    return node;
  };
  const closeForm = () => { form.hidden = true; editingId = null; form.reset(); nameInput.setCustomValidity(''); questionInput.setCustomValidity(''); };
  const render = () => {
    list.replaceChildren();
    count.textContent = `${items.length}/${HOME_FAVORITES_LIMIT}`;
    edit.textContent = editing ? '완료' : '편집';
    edit.setAttribute('aria-pressed', String(editing));
    element.dataset.editing = String(editing);
    items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'home-favorite'; row.dataset.favoriteId = item.id;
      const ask = document.createElement('button');
      ask.type = 'button';
      if (editing) {
        ask.dataset.favoriteAction = 'modify'; ask.dataset.favoriteId = item.id;
        ask.setAttribute('aria-label', `${item.name} 수정`);
      } else ask.dataset.homePrompt = item.question;
      if (item.id === 'weekly-calendar') {
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('aria-hidden', 'true'); icon.setAttribute('class', 'nav-icon');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#lotbi-icon-calendar'); icon.append(use); ask.append(icon);
      }
      const label = document.createElement('span'); label.textContent = item.name; ask.append(label); row.append(ask);
      if (editing) {
        const actions = document.createElement('div'); actions.className = 'home-favorite-actions';
        for (const [title, action] of [['앞으로', 'up'], ['뒤로', 'down'], ['삭제', 'remove']]) {
          const control = button(title, action, item.id);
          control.setAttribute('aria-label', `${item.name} ${title}`);
          control.disabled = action === 'up' && index === 0 || action === 'down' && index === items.length - 1;
          actions.append(control);
        }
        row.append(actions);
      }
      list.append(row);
    });
    if (items.length < HOME_FAVORITES_LIMIT) {
      const add = button('+ 즐겨찾기 추가', 'add');
      add.className = 'home-favorites-add'; add.dataset.favoritesAdd = '';
      list.append(add);
    }
  };
  const openForm = id => {
    const item = items.find(item => item.id === id);
    if (!item && items.length >= HOME_FAVORITES_LIMIT) return;
    editingId = item?.id || null;
    form.reset(); nameInput.setCustomValidity(''); questionInput.setCustomValidity('');
    nameInput.value = item?.name || ''; questionInput.value = item?.question || '';
    form.querySelector('[data-favorites-editor-title]').textContent = item ? '즐겨찾기 수정' : '즐겨찾기 추가';
    form.hidden = false; nameInput.focus();
  };
  nameInput.addEventListener('input', () => nameInput.setCustomValidity(
    characters(nameInput.value.trim()).length > HOME_FAVORITE_NAME_LIMIT ? '이름은 최대 12자까지 입력해 주세요.' : ''
  ));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = nameInput.value.trim().normalize('NFC');
    const question = questionInput.value.trim();
    nameInput.setCustomValidity(!name ? '이름을 입력해 주세요.' : characters(name).length > HOME_FAVORITE_NAME_LIMIT ? '이름은 최대 12자까지 입력해 주세요.' : '');
    questionInput.setCustomValidity(question ? '' : '보낼 질문을 입력해 주세요.');
    if (!form.reportValidity()) return;
    const index = items.findIndex(item => item.id === editingId);
    if (index >= 0) items[index] = {...items[index], name, question};
    else {
      if (items.length >= HOME_FAVORITES_LIMIT) return;
      items.push({id: globalThis.crypto?.randomUUID?.() || `favorite-${Date.now()}-${Math.random().toString(36).slice(2)}`, name, question});
    }
    const persisted = save(); closeForm(); render();
    if (persisted) say('즐겨찾기를 저장했어요.');
  });
  questionInput.addEventListener('input', () => questionInput.setCustomValidity(''));
  element.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!target || !element.contains(target)) return;
    if (target.hasAttribute('data-favorites-edit')) {
      editing = !editing; closeForm(); render(); return;
    }
    if (target.hasAttribute('data-favorites-cancel')) { closeForm(); return; }
    const action = target.dataset.favoriteAction;
    if (action === 'add' || target.hasAttribute('data-favorites-add')) { openForm(null); return; }
    const index = items.findIndex(item => item.id === target.dataset.favoriteId);
    if (index < 0) return;
    if (action === 'modify') { openForm(items[index].id); return; }
    if (action === 'remove') { items.splice(index, 1); closeForm(); }
    else if (action === 'up' && index > 0) [items[index - 1], items[index]] = [items[index], items[index - 1]];
    else if (action === 'down' && index < items.length - 1) [items[index + 1], items[index]] = [items[index], items[index + 1]];
    else return;
    const persisted = save(); render(); if (persisted) say('즐겨찾기를 변경했어요.');
  });
  const setScope = next => {
    if (!next || next === currentScope) return;
    currentScope = next; editing = false; closeForm(); say(''); items = read(); render();
  };
  window.addEventListener('storage', event => {
    if (event.key !== keyFor(currentScope) && event.key !== null) return;
    items = read(); editing = false; closeForm(); render();
  });
  items = read(); render();
  return {setScope};
}
