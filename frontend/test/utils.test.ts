import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  formatFileSize,
  timeAgo,
  initialsOf,
  uid,
  nextId,
  clamp,
  debounce,
  throttle,
} from '../src/utils/index';

describe('formatFileSize', () => {
  it('formats bytes, KB and MB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders relative time buckets', () => {
    expect(timeAgo(new Date('2026-08-19T11:59:50Z').toISOString())).toBe('just now');
    expect(timeAgo(new Date('2026-08-19T11:55:00Z').toISOString())).toBe('5m ago');
    expect(timeAgo(new Date('2026-08-19T10:00:00Z').toISOString())).toBe('2h ago');
    expect(timeAgo(new Date('2026-08-15T12:00:00Z').toISOString())).toBe('4d ago');
  });

  it('falls back to a date for old timestamps', () => {
    expect(timeAgo(new Date('2026-01-01T00:00:00Z').toISOString())).toMatch(/Jan 1|1 Jan/);
  });
});

describe('initialsOf', () => {
  it('produces up to two uppercase initials', () => {
    expect(initialsOf('Pranav Ghodke')).toBe('PG');
    expect(initialsOf('alice')).toBe('A');
    expect(initialsOf('Ada Lovelace Vaughn')).toBe('AL');
    expect(initialsOf('  spaced   name  ')).toBe('SN');
  });
});

describe('uid / nextId', () => {
  it('generates unique prefixed ids', () => {
    const a = uid('el');
    const b = uid('el');
    expect(a).toMatch(/^el_/);
    expect(a).not.toBe(b);
    expect(nextId()).not.toBe(nextId());
  });
});

describe('clamp', () => {
  it('clamps within bounds and passes through inside values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('coalesces rapid calls into one trailing invocation', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    vi.advanceTimersByTime(50);
    d();
    vi.advanceTimersByTime(50);
    d();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs immediately then at most once per window', () => {
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t();
    t();
    t();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(200);
    t();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});