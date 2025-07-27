export const SECRET_PATTERNS = [
  /(?:access|api|secret|token|key)[_-]?key["']?\s*[:=]\s*['"]?[^"']+/gi,
  /(?:password|pwd|secret|token)=['"]?[^"']+/gi,
  /[\w-]{24,}/gi,
  /(?:-----BEGIN.*PRIVATE KEY-----[\s\S]*?-----END.*PRIVATE KEY-----)/gi
];

export function sanitizeDiff(diff = '') {
  return SECRET_PATTERNS.reduce(
    (acc, pattern) => acc.replace(pattern, '[REMOVIDO]'),
    diff
  );
}
