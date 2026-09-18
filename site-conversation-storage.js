export const ANONYMOUS_CONVERSATION_NAMESPACE_KEY = 'lotbi.site.ux.v1.anonymous-namespace';

const ANONYMOUS_NAMESPACE_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function optionalBrowserStorage(name) {
  try {
    return window?.[name];
  } catch {
    return undefined;
  }
}

function normalizedAnonymousNamespace(value) {
  const namespace = typeof value === 'string' ? value.trim() : '';
  return ANONYMOUS_NAMESPACE_PATTERN.test(namespace) ? namespace : '';
}

export function ensureDurableAnonymousConversationNamespace({
  durableStorage = optionalBrowserStorage('localStorage'),
  legacySessionStorage = optionalBrowserStorage('sessionStorage'),
  createNamespace = () => `anonymous-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
} = {}) {
  let value = '';

  try {
    value = normalizedAnonymousNamespace(
      durableStorage?.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY),
    );
  } catch {}

  // Only the namespace from the still-live legacy session can be migrated safely.
  // Older orphaned namespace data is intentionally neither enumerated nor merged.
  if (!value) {
    try {
      value = normalizedAnonymousNamespace(
        legacySessionStorage?.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY),
      );
    } catch {}
  }

  if (!value) value = normalizedAnonymousNamespace(createNamespace());
  if (!value) return '';

  try {
    durableStorage?.setItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY, value);
  } catch {}
  try {
    legacySessionStorage?.setItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY, value);
  } catch {}

  return value;
}

if (
  typeof window !== 'undefined'
  && typeof document !== 'undefined'
  && document.getElementById('lotbi-prompt')
) {
  ensureDurableAnonymousConversationNamespace();
}
