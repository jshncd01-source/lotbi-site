const prompt = document.getElementById('lotbi-prompt');
const status = document.getElementById('chat-status');

function focusComposer() {
  if (!(prompt instanceof HTMLTextAreaElement)) return;
  prompt.focus({preventScroll: true});
  prompt.scrollIntoView({behavior: 'smooth', block: 'center'});
}

function setExample(text) {
  if (!(prompt instanceof HTMLTextAreaElement)) return;
  if (prompt.value.trim()) {
    focusComposer();
    if (status) status.textContent = '작성 중인 내용을 유지했습니다. 현재 요청을 먼저 확인해 주세요.';
    return;
  }
  prompt.value = text.slice(0, 1000);
  prompt.dispatchEvent(new Event('input', {bubbles: true}));
  focusComposer();
  if (status) status.textContent = '예시 요청을 입력창에 넣었습니다. 내용을 바꾸거나 전송할 수 있습니다.';
}

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('[data-home-composer-focus]')) {
    focusComposer();
    return;
  }
  const example = target?.closest('[data-home-product-prompt]');
  if (example instanceof HTMLButtonElement) setExample(example.dataset.homeProductPrompt || '');
});
