import {beginSiteHandoff, SiteHandoffClientError} from './site-auth.js';

const statusNode = document.getElementById('auth-start-status');
const retryLink = document.getElementById('auth-start-retry');

function setError(error) {
  if (statusNode) {
    statusNode.textContent = error instanceof SiteHandoffClientError || error instanceof Error
      ? error.message
      : '안전한 LOTBI 계정 연결을 시작하지 못했습니다.';
    statusNode.classList.add('auth-callback-error');
  }
  if (retryLink) retryLink.hidden = false;
}

// This page deliberately owns no returnUrl or bearer state. The Site origin
// creates PKCE S256 state/verifier, then Account uses its host-only HttpOnly
// FULL session to request the one-time Core handoff.
void beginSiteHandoff().catch(setError);
