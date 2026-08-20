import { describe, expect, it, beforeEach } from 'vitest';
import { profileNameFor } from '../src/stores/usePresenceStore';
import { useBoardStore } from '../src/stores/useBoardStore';
import type { Board } from '../src/types';

const boardWithMembers = (members: Board['members']): Board => ({
  id: '1',
  title: 'Shared Board',
  ownerId: '1',
  createdAt: '2026-08-19T10:00:00Z',
  updatedAt: '2026-08-19T10:05:00Z',
  elements: [],
  members,
});

describe('profileNameFor', () => {
  beforeEach(() => {
    useBoardStore.setState({ board: null });
  });

  it('returns the real member name for a known user id', () => {
    useBoardStore.setState({
      board: boardWithMembers([
        {
          id: '42',
          name: 'Ada Lovelace',
          email: 'ada@x.com',
          color: '#d9480f',
          initials: 'AL',
          role: 'editor',
        },
      ]),
    });
    expect(profileNameFor(42)).toBe('Ada Lovelace');
    expect(profileNameFor('42')).toBe('Ada Lovelace');
  });

  it('returns null for unknown users so a generic label can be kept', () => {
    useBoardStore.setState({
      board: boardWithMembers([
        {
          id: '7',
          name: 'Grace Hopper',
          email: 'grace@x.com',
          color: '#2f9e44',
          initials: 'GH',
          role: 'editor',
        },
      ]),
    });
    expect(profileNameFor(99)).toBeNull();
    expect(profileNameFor(undefined)).toBeNull();
  });

  it('is defensive when no board is loaded', () => {
    expect(profileNameFor('1')).toBeNull();
  });
});