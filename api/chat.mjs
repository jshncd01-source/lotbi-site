import {runtimeConfig, RuntimeConfigError} from '../runtime/config.mjs';
import {callCoreConversation, CoreChatError} from '../runtime/core-chat.mjs';
import {assertTrustedSameOriginPost, jsonResponse, RequestSecurityError} from '../runtime/security.mjs';
import {clearSiteSessionCookie, readCookie, SITE_SESSION_COOKIE, SiteSessionError, unsealSiteSession} from '../runtime/site-session.mjs';

function parseInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== 'text') return null;
  if (typeof value.text !== 'string') return null;
  const text = value.text.trim();
  if (!text || text.length > 1000) return null;
  return {text};
}

function errorBody(code, message, extra = {}) {
  return {error: {code, message, ...extra}};
}

export async function POST(request) {
  let config;
  try {
    config = runtimeConfig();
    assertTrustedSameOriginPost(request, config.siteOrigin);
  } catch (error) {
    if (error instanceof RuntimeConfigError) {
      return jsonResponse(errorBody(error.code, 'LOTBI chat runtime is not configured'), 503);
    }
    if (error instanceof RequestSecurityError) {
      return jsonResponse(errorBody(error.code, error.message), error.status);
    }
    return jsonResponse(errorBody('RUNTIME_FAILURE', 'LOTBI chat runtime rejected the request'), 500);
  }

  let input;
  try {
    input = parseInput(await request.json());
  } catch {
    input = null;
  }
  if (!input) {
    return jsonResponse(errorBody('CHAT_INPUT_INVALID', 'text must be a non-empty string of at most 1000 characters'), 400);
  }

  let siteSession;
  try {
    const envelope = readCookie(request, SITE_SESSION_COOKIE);
    if (!envelope) {
      return jsonResponse(errorBody('AUTH_REQUIRED', 'LOTBI Account login is required', {login_url: `${config.accountOrigin}/`}), 401);
    }
    siteSession = await unsealSiteSession(envelope, config.sessionKey, config.siteOrigin);
  } catch (error) {
    if (error instanceof SiteSessionError) {
      return jsonResponse(
        errorBody(error.code, 'LOTBI site session is invalid or expired', {login_url: `${config.accountOrigin}/`}),
        401,
        {'Set-Cookie': clearSiteSessionCookie()},
      );
    }
    return jsonResponse(errorBody('AUTH_SESSION_INVALID', 'LOTBI site session could not be verified'), 401, {'Set-Cookie': clearSiteSessionCookie()});
  }

  try {
    const body = await callCoreConversation({
      coreOrigin: config.coreOrigin,
      chatPath: config.chatPath,
      token: siteSession.token,
      text: input.text,
    });
    return jsonResponse(body, 200);
  } catch (error) {
    if (error instanceof CoreChatError) {
      const extra = error.correlationId ? {correlation_id: error.correlationId} : {};
      const headers = error.clearSession ? {'Set-Cookie': clearSiteSessionCookie()} : {};
      return jsonResponse(errorBody(error.code, error.message, extra), error.status, headers);
    }
    return jsonResponse(errorBody('CORE_CHAT_UNAVAILABLE', 'LOTBI Core conversation service is unavailable'), 503);
  }
}
