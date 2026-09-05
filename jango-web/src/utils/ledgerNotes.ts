import { apiFetch } from './api';

export type LedgerNote = {
  noteId: number;
  ledgerId: number;
  authorUserId: number;
  authorDisplayName?: string | null;
  authorEmail: string;
  body: string;
  pinned: boolean;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function fetchLedgerNotes(
  ledgerId: string,
  includeResolved = false
): Promise<LedgerNote[]> {
  const params = new URLSearchParams();
  if (includeResolved) params.set('includeResolved', 'true');
  const query = params.toString();
  const res = await apiFetch(`/api/ledgers/${ledgerId}/notes${query ? `?${query}` : ''}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function createLedgerNote(
  ledgerId: string,
  body: string
): Promise<LedgerNote | null> {
  const res = await apiFetch(`/api/ledgers/${ledgerId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function updateLedgerNote(
  ledgerId: string,
  noteId: number,
  body: string
): Promise<LedgerNote | null> {
  const res = await apiFetch(`/api/ledgers/${ledgerId}/notes/${noteId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function patchLedgerNote(
  ledgerId: string,
  noteId: number,
  patch: Partial<Pick<LedgerNote, 'pinned' | 'resolved'>>
): Promise<LedgerNote | null> {
  const res = await apiFetch(`/api/ledgers/${ledgerId}/notes/${noteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteLedgerNote(
  ledgerId: string,
  noteId: number
): Promise<boolean> {
  const res = await apiFetch(`/api/ledgers/${ledgerId}/notes/${noteId}`, {
    method: 'DELETE',
  });
  return res.ok;
}
