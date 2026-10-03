(() => {
  'use strict';

  const status = document.getElementById('return-status');
  const button = document.getElementById('return-button');
  const params = new URLSearchParams(window.location.search);
  const names = Array.from(params.keys());
  const codes = params.getAll('code');
  const states = params.getAll('state');
  const codePattern = /^[A-Za-z0-9_-]{32,256}$/;
  const iosStatePattern = /^IOS_[A-Za-z0-9_-]{43,124}$/;
  const exactShape = names.length === 2 && names.every(name => name === 'code' || name === 'state');

  if (
    !status
    || !(button instanceof HTMLAnchorElement)
    || !exactShape
    || codes.length !== 1
    || states.length !== 1
    || !codePattern.test(codes[0])
    || !iosStatePattern.test(states[0])
  ) {
    if (status) status.textContent = '앱으로 전달할 수 있는 로그인 결과가 아닙니다. LOTBI 앱에서 다시 시도해 주세요.';
    return;
  }

  const callback = new URL('atglife://social-auth-return');
  callback.searchParams.set('code', codes[0]);
  callback.searchParams.set('state', states[0]);
  const callbackUrl = callback.toString();
  button.href = callbackUrl;
  button.hidden = false;
  window.location.replace(callbackUrl);
})();
