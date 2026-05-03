import { describe, it, expect } from 'vitest';
import { parseTicketQr } from './parse-ticket-url';

describe('parseTicketQr', () => {
  it('parses master URL', () => {
    expect(parseTicketQr('https://zerowaiting.app/t/m/abc-123')).toEqual({
      kind: 'master',
      token: 'abc-123',
    });
  });

  it('parses per-seat URL', () => {
    expect(parseTicketQr('https://zerowaiting.app/t/abc-123')).toEqual({
      kind: 'seat',
      token: 'abc-123',
    });
  });

  it('parses raw token as per-seat', () => {
    expect(parseTicketQr('abc-123')).toEqual({ kind: 'seat', token: 'abc-123' });
  });

  it('returns null for unrelated URLs', () => {
    expect(parseTicketQr('https://google.com')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseTicketQr('')).toBeNull();
  });
});
