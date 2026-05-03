export type ParsedTicketQr =
  | { kind: 'master'; token: string }
  | { kind: 'seat'; token: string }
  | null;

const TOKEN_RE = /^[a-zA-Z0-9-]+$/;

export const parseTicketQr = (raw: string): ParsedTicketQr => {
  if (!raw) return null;
  const trimmed = raw.trim();

  // Try URL form
  try {
    const url = new URL(trimmed);
    const masterMatch = url.pathname.match(/\/t\/m\/([^/]+)\/?$/);
    if (masterMatch) return { kind: 'master', token: masterMatch[1] };
    const seatMatch = url.pathname.match(/\/t\/([^/]+)\/?$/);
    if (seatMatch) return { kind: 'seat', token: seatMatch[1] };
    return null;
  } catch {
    // not a URL — treat as raw token
    if (TOKEN_RE.test(trimmed)) return { kind: 'seat', token: trimmed };
    return null;
  }
};
