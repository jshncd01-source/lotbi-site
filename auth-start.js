<<<<<<< HEAD
import {beginSiteHandoff, clearSiteLogoutSuppression} from './site-auth.js?v=aset-7fa7de3c1d17';
=======
import {beginSiteHandoff, clearSiteLogoutSuppression} from './site-auth.js?v=aset-ac2a98a2ffa1';
>>>>>>> origin/main

const errorShell = document.getElementById('auth-start-error-shell');
const statusNode = document.getElementById('auth-start-status');
const retryLink = document.getElementById('auth-start-retry');

function setError() {
  if (statusNode) {
    statusNode.textContent = '로그인을 시작하지 못했습니다. 브라우저 설정을 확인한 후 다시 시도해 주세요.';
  }
  if (retryLink) retryLink.hidden = false;
  if (errorShell) errorShell.hidden = false;
}

// Fallback-only route. Normal Home login starts the same PKCE S256 handoff
// directly from the Home document and never loads this page.
clearSiteLogoutSuppression();
void beginSiteHandoff().catch(setError);
