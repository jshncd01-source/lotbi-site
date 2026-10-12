export const DEFAULT_CHAT_BUBBLE_COLOR = '#1f2a44';

export function normalizeChatBubbleColor(value) {
  const color = String(value || '').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/u.test(color) ? color : null;
}

function channel(value) {
  const normalized = value / 255;
  return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
}

export function readableChatTextColor(background) {
  const color = normalizeChatBubbleColor(background) || DEFAULT_CHAT_BUBBLE_COLOR;
  const luminance = .2126 * channel(parseInt(color.slice(1, 3), 16))
    + .7152 * channel(parseInt(color.slice(3, 5), 16))
    + .0722 * channel(parseInt(color.slice(5, 7), 16));
  const whiteContrast = 1.05 / (luminance + .05);
  const darkContrast = (luminance + .05) / .057;
  return whiteContrast >= darkContrast ? '#ffffff' : '#111827';
}

export function applyChatBubbleTheme(value, root = document.documentElement) {
  const color = normalizeChatBubbleColor(value);
  if (!color) {
    root.style.removeProperty('--user-bubble');
    root.style.removeProperty('--user-bubble-foreground');
    return Object.freeze({color: DEFAULT_CHAT_BUBBLE_COLOR, customized: false});
  }
  root.style.setProperty('--user-bubble', color);
  root.style.setProperty('--user-bubble-foreground', readableChatTextColor(color));
  return Object.freeze({color, customized: true});
}
