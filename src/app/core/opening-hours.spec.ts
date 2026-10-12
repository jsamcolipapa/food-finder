import { openStatus } from './opening-hours';

// 2026-10-12 is a Monday.
const at = (day: number, time: string) => new Date(`2026-10-${day}T${time}:00`);

describe('openStatus', () => {
  it('is unknown when hours are missing', () => {
    expect(openStatus(undefined)).toBe('unknown');
    expect(openStatus('  ')).toBe('unknown');
  });

  it('handles 24/7', () => {
    expect(openStatus('24/7', at(12, '03:00'))).toBe('open');
  });

  it('evaluates weekday ranges', () => {
    const hours = 'Mo-Fr 09:00-17:00; Sa 10:00-14:00';
    expect(openStatus(hours, at(12, '09:00'))).toBe('open');
    expect(openStatus(hours, at(12, '17:00'))).toBe('closed');
    expect(openStatus(hours, at(17, '13:59'))).toBe('open');
    expect(openStatus(hours, at(18, '12:00'))).toBe('closed');
  });

  it('applies hours without a day selector to every day', () => {
    expect(openStatus('10:00-22:00', at(18, '21:00'))).toBe('open');
  });

  it('handles split shifts and day lists', () => {
    const hours = 'Mo,We 11:00-14:00,17:00-21:00';
    expect(openStatus(hours, at(12, '15:00'))).toBe('closed');
    expect(openStatus(hours, at(14, '18:00'))).toBe('open');
    expect(openStatus(hours, at(13, '18:00'))).toBe('closed');
  });

  it('carries past-midnight hours into the next day', () => {
    const hours = 'Fr-Sa 18:00-02:00';
    expect(openStatus(hours, at(18, '01:30'))).toBe('open');
    expect(openStatus(hours, at(18, '02:00'))).toBe('closed');
    expect(openStatus(hours, at(16, '01:00'))).toBe('closed');
  });

  it('lets later rules override earlier ones', () => {
    expect(openStatus('Mo-Su 08:00-20:00; Mo off', at(12, '12:00'))).toBe('closed');
  });

  it('ignores public-holiday rules', () => {
    expect(openStatus('Mo-Sa 08:00-20:00; PH off', at(12, '12:00'))).toBe('open');
  });

  it('refuses to guess at syntax it does not understand', () => {
    expect(openStatus('sunrise-sunset', at(12, '12:00'))).toBe('unknown');
    expect(openStatus('Dec 25 off; Mo-Fr 09:00-17:00', at(12, '12:00'))).toBe('unknown');
    expect(openStatus('Mo-Fr 09:00-17:00 "by appointment"', at(12, '12:00'))).toBe('unknown');
  });
});
