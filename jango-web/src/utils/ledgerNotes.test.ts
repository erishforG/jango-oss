import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api';
import {
  createLedgerNote,
  deleteLedgerNote,
  fetchLedgerNotes,
  patchLedgerNote,
  updateLedgerNote,
} from './ledgerNotes';

vi.mock('./api', () => ({ apiFetch: vi.fn() }));

const mockedApiFetch = vi.mocked(apiFetch);
const note = {
  noteId: 3,
  ledgerId: 7,
  authorUserId: 11,
  authorEmail: 'eric@example.com',
  body: '확인할 메모',
  pinned: false,
  resolved: false,
  createdAt: '2026-08-08T00:00:00Z',
  updatedAt: '2026-08-08T00:00:00Z',
};

function response(ok: boolean, data?: unknown): Response {
  return { ok, json: vi.fn().mockResolvedValue(data) } as unknown as Response;
}

describe('ledgerNotes API helpers', () => {
  beforeEach(() => mockedApiFetch.mockReset());

  it('fetches unresolved notes by default', async () => {
    mockedApiFetch.mockResolvedValue(response(true, [note]));

    await expect(fetchLedgerNotes('7')).resolves.toEqual([note]);
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/ledgers/7/notes');
  });

  it('adds includeResolved only when requested', async () => {
    mockedApiFetch.mockResolvedValue(response(true, []));

    await fetchLedgerNotes('7', true);

    expect(mockedApiFetch).toHaveBeenCalledWith('/api/ledgers/7/notes?includeResolved=true');
  });

  it('returns an empty list for failed or malformed list responses', async () => {
    mockedApiFetch.mockResolvedValueOnce(response(false));
    await expect(fetchLedgerNotes('7')).resolves.toEqual([]);

    mockedApiFetch.mockResolvedValueOnce(response(true, { notes: [note] }));
    await expect(fetchLedgerNotes('7')).resolves.toEqual([]);
  });

  it('creates a note with JSON content', async () => {
    mockedApiFetch.mockResolvedValue(response(true, note));

    await expect(createLedgerNote('7', '확인할 메모')).resolves.toEqual(note);
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/ledgers/7/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: '확인할 메모' }),
    });
  });

  it('updates note content with PUT', async () => {
    mockedApiFetch.mockResolvedValue(response(true, note));

    await updateLedgerNote('7', 3, '수정된 메모');

    expect(mockedApiFetch).toHaveBeenCalledWith('/api/ledgers/7/notes/3', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: '수정된 메모' }),
    });
  });

  it('patches note state with PATCH', async () => {
    mockedApiFetch.mockResolvedValue(response(true, { ...note, pinned: true }));

    await patchLedgerNote('7', 3, { pinned: true });

    expect(mockedApiFetch).toHaveBeenCalledWith('/api/ledgers/7/notes/3', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: true }),
    });
  });

  it('returns null when a write response fails', async () => {
    mockedApiFetch.mockResolvedValue(response(false));

    await expect(createLedgerNote('7', '메모')).resolves.toBeNull();
    await expect(updateLedgerNote('7', 3, '메모')).resolves.toBeNull();
    await expect(patchLedgerNote('7', 3, { resolved: true })).resolves.toBeNull();
  });

  it('deletes a note and returns the response status', async () => {
    mockedApiFetch.mockResolvedValueOnce(response(true)).mockResolvedValueOnce(response(false));

    await expect(deleteLedgerNote('7', 3)).resolves.toBe(true);
    expect(mockedApiFetch).toHaveBeenLastCalledWith('/api/ledgers/7/notes/3', {
      method: 'DELETE',
    });
    await expect(deleteLedgerNote('7', 3)).resolves.toBe(false);
  });
});
