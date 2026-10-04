// Resolve semantic palette aliases without accepting arbitrary CSS expressions.
export function themeTokenValue(block, token, seen = new Set()) {
  if (seen.has(token)) throw new Error(`cyclic theme token: ${token}`);
  seen.add(token);
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const value = block.match(new RegExp(`(?:^|;)\\s*${escaped}\\s*:\\s*([^;]+);`))?.[1].trim();
  if (/^#[0-9a-f]{6}$/i.test(value || '')) return value.toLowerCase();
  const alias = value?.match(/^var\((--lotbi-[a-z0-9-]+)\)$/)?.[1];
  if (alias) return themeTokenValue(block, alias, seen);
  throw new Error(`missing or unsupported theme token: ${token}`);
}
