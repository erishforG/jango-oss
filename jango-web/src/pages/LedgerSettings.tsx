import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, CircleHelp, GripVertical, Pencil, Pin, Plus, Save, Trash2, X } from 'lucide-react';
import { apiFetch } from '../utils/api';
import {
  createLedgerNote,
  deleteLedgerNote,
  fetchLedgerNotes,
  patchLedgerNote,
  updateLedgerNote,
  type LedgerNote,
} from '../utils/ledgerNotes';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore, type LedgerSummary } from '../stores/useLedgerStore';

type LedgerDetail = {
  ledgerId: number;
  ledgerName: string;
  description?: string | null;
  fiscalStart: number;
  myRole: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
  isDefault: boolean;
};

type LedgerMemberItem = {
  membershipId: number;
  userId: number;
  userEmail: string;
  userDisplayName?: string | null;
  role: string;
};

type LedgerInviteItem = {
  inviteId: number;
  invitedEmail: string;
  role: string;
  status: string;
};

function SortableLedgerItem({
  ledger,
  selectedLedgerId,
  onEdit,
}: {
  ledger: LedgerSummary;
  selectedLedgerId: string;
  onEdit: (ledgerId: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(ledger.ledgerId) });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const active = String(ledger.ledgerId) === selectedLedgerId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border p-3 flex items-center gap-2 ${active ? 'border-primary bg-primary/5' : 'border-border bg-surface-secondary'} ${isDragging ? 'opacity-70 shadow-lg' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="장부 순서 이동"
        className="h-8 w-8 rounded-lg border border-border text-text-tertiary hover:text-text-primary flex items-center justify-center touch-none"
        title="드래그하여 순서 변경"
      >
        <GripVertical size={14} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{ledger.ledgerName}</p>
      </div>
      <button
        type="button"
        onClick={() => onEdit(ledger.ledgerId)}
        className="px-3 h-8 rounded-lg border border-border text-xs text-text-secondary flex items-center gap-1"
      >
        <Pencil size={12} /> 수정
      </button>
    </div>
  );
}

export default function LedgerSettingsPage() {
  const { ledgers, refresh, selectedLedgerId, selectLedger, canManageMembers } = useLedgerStore();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showFiscalHelp, setShowFiscalHelp] = useState(false);
  const [detail, setDetail] = useState<LedgerDetail | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fiscalStart, setFiscalStart] = useState(1);
  const [message, setMessage] = useState('');
  const [members, setMembers] = useState<LedgerMemberItem[]>([]);
  const [invites, setInvites] = useState<LedgerInviteItem[]>([]);
  const [notes, setNotes] = useState<LedgerNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'EDITOR' | 'VIEWER'>('EDITOR');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const load = async () => {
      if (!selectedLedgerId) return;
      setLoading(true);
      setMessage('');
      const res = await apiFetch(`/api/ledgers/${selectedLedgerId}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = (await res.json()) as LedgerDetail;
      setDetail(data);
      setName(data.ledgerName || '');
      setDescription(data.description || '');
      setFiscalStart(data.fiscalStart || 1);
      setLoading(false);
    };

    void load();
  }, [selectedLedgerId]);

  const loadMembersAndInvites = async () => {
    if (!selectedLedgerId) return;
    const [mRes, iRes] = await Promise.all([
      apiFetch(`/api/ledgers/${selectedLedgerId}/members`),
      apiFetch(`/api/ledgers/${selectedLedgerId}/invites`),
    ]);

    if (mRes.ok) setMembers(await mRes.json());
    if (iRes.ok) setInvites(await iRes.json());
  };

  useEffect(() => {
    if (!selectedLedgerId) {
      setMembers([]);
      setInvites([]);
      setNotes([]);
      return;
    }
    void loadMembersAndInvites();
  }, [selectedLedgerId]);

  const loadNotes = async () => {
    if (!selectedLedgerId) return;
    setNotesLoading(true);
    try {
      setNotes(await fetchLedgerNotes(selectedLedgerId, true));
    } finally {
      setNotesLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedLedgerId) {
      setNotes([]);
      return;
    }
    setNoteDraft('');
    setEditingNoteId(null);
    setEditingBody('');
    void loadNotes();
  }, [selectedLedgerId]);

  const sortedLedgers = useMemo(
    () => [...ledgers].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [ledgers],
  );

  const saveOrder = async (orderedIds: number[]) => {
    await apiFetch('/api/ledgers/order', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ledgerIds: orderedIds }),
    });
    await refresh();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedLedgers.findIndex((l) => String(l.ledgerId) === String(active.id));
    const newIndex = sortedLedgers.findIndex((l) => String(l.ledgerId) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(sortedLedgers, oldIndex, newIndex);
    await saveOrder(reordered.map((l) => l.ledgerId));
  };

  const handleCreateLedger = async (ledgerName: string) => {
    if (!ledgerName.trim()) return;
    setCreating(true);
    setMessage('');
    const res = await apiFetch('/api/ledgers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: ledgerName.trim() }),
    });

    if (res.ok) {
      const created = await res.json();
      await refresh();
      if (created?.ledgerId) selectLedger(String(created.ledgerId));
      setMessage('새 장부가 생성되었습니다.');
    } else {
      setMessage('장부 생성에 실패했습니다.');
    }
    setCreating(false);
  };

  const handleSave = async () => {
    if (!selectedLedgerId) return;
    setSaving(true);
    setMessage('');
    const res = await apiFetch(`/api/ledgers/${selectedLedgerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, fiscalStart }),
    });

    if (res.ok) {
      await refresh();
      setMessage('장부 설정이 저장되었습니다.');
    } else {
      setMessage('저장에 실패했습니다.');
    }
    setSaving(false);
  };

  const handleDeleteLedger = async () => {
    if (!selectedLedgerId || !detail) return;
    if (detail.isDefault) return;

    const confirmed = window.confirm(`'${detail.ledgerName}' 장부를 삭제할까요? 삭제 후 복구할 수 없습니다.`);
    if (!confirmed) return;

    setDeleting(true);
    setMessage('');

    const res = await apiFetch(`/api/ledgers/${selectedLedgerId}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      await refresh();
      setMessage('장부가 삭제되었습니다.');
    } else {
      setMessage('장부 삭제에 실패했습니다.');
    }

    setDeleting(false);
  };

  const canEditNotes = !!detail && detail.myRole !== 'VIEWER';
  const canManageNotes = !!detail && (detail.myRole === 'OWNER' || detail.myRole === 'ADMIN');

  const handleCreateNote = async () => {
    if (!selectedLedgerId || !noteDraft.trim()) return;
    setSavingNote(true);
    const created = await createLedgerNote(selectedLedgerId, noteDraft);
    if (created) {
      setNoteDraft('');
      await loadNotes();
    }
    setSavingNote(false);
  };

  const handleUpdateNote = async (noteId: number) => {
    if (!selectedLedgerId || !editingBody.trim()) return;
    setSavingNote(true);
    const updated = await updateLedgerNote(selectedLedgerId, noteId, editingBody);
    if (updated) {
      setEditingNoteId(null);
      setEditingBody('');
      await loadNotes();
    }
    setSavingNote(false);
  };

  const handlePatchNote = async (
    note: LedgerNote,
    patch: Partial<Pick<LedgerNote, 'pinned' | 'resolved'>>
  ) => {
    if (!selectedLedgerId) return;
    const updated = await patchLedgerNote(selectedLedgerId, note.noteId, patch);
    if (updated) await loadNotes();
  };

  const handleDeleteNote = async (note: LedgerNote) => {
    if (!selectedLedgerId) return;
    const confirmed = window.confirm('이 장부 메모를 삭제할까요?');
    if (!confirmed) return;
    const deleted = await deleteLedgerNote(selectedLedgerId, note.noteId);
    if (deleted) await loadNotes();
  };

  const formatNoteDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-5">
      <section className="bg-surface rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 sm:items-center">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-text-primary">장부 관리</h2>
            <p className="text-xs text-text-tertiary">카테고리처럼 드래그로 순서를 조정하고, 수정 버튼으로 설정 편집을 시작하세요.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const promptName = window.prompt('새 장부 이름을 입력하세요.');
              if (!promptName?.trim()) return;
              void handleCreateLedger(promptName);
            }}
            disabled={creating}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-surface-secondary disabled:opacity-50 shrink-0"
            aria-label="새 장부 만들기"
            title="새 장부 만들기"
          >
            <Plus size={14} />
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
          <SortableContext items={sortedLedgers.map((l) => String(l.ledgerId))} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sortedLedgers.map((ledger) => (
                <SortableLedgerItem
                  key={ledger.ledgerId}
                  ledger={ledger}
                  selectedLedgerId={selectedLedgerId}
                  onEdit={(ledgerId) => selectLedger(String(ledgerId))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      <section className="bg-surface rounded-2xl border border-border p-5 space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-text-primary">장부별 설정</h3>
          <p className="text-xs text-text-tertiary">선택한 장부의 이름, 설명, 회계 시작월을 수정합니다.</p>
        </div>

        {loading || !detail ? (
          <p className="text-sm text-text-tertiary">장부 정보를 불러오는 중...</p>
        ) : (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-text-secondary">장부명</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-text-secondary">설명</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm min-h-[88px]"
              />
            </label>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-text-secondary">회계 시작월</span>
                <button
                  type="button"
                  onClick={() => setShowFiscalHelp((v) => !v)}
                  className="text-text-tertiary hover:text-text-primary"
                  aria-label="회계 시작월 도움말"
                >
                  <CircleHelp size={14} />
                </button>
              </div>
              {showFiscalHelp && (
                <p className="text-[11px] text-text-tertiary bg-surface-secondary border border-border rounded-lg p-2.5">
                  회계 시작월은 1년 재무 집계를 시작하는 기준 월입니다. 예: 1월이면 일반 달력연도 기준, 4월이면 4월~다음해 3월 기준으로 리포트가 계산됩니다.
                </p>
              )}
              <select
                value={fiscalStart}
                onChange={(e) => setFiscalStart(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm"
              >
                {Array.from({ length: 12 }).map((_, idx) => (
                  <option key={idx + 1} value={idx + 1}>{idx + 1}월</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50"
              >
                저장
              </button>
              <button
                type="button"
                disabled={deleting || detail.isDefault || detail.myRole !== 'OWNER'}
                onClick={() => void handleDeleteLedger()}
                className="px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                title={detail.isDefault ? '기본 장부는 삭제할 수 없습니다.' : undefined}
              >
                장부 삭제
              </button>
              {message && <p className="text-xs text-text-tertiary">{message}</p>}
            </div>
          </div>
        )}
      </section>

      <section className="bg-surface rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h3 className="text-base font-semibold text-text-primary">장부 메모</h3>
            <p className="text-xs text-text-tertiary">돈 관련 합의, 확인할 일, 월급일 액션을 장부 멤버와 함께 남깁니다.</p>
          </div>
          {notesLoading && <span className="text-xs text-text-tertiary shrink-0">불러오는 중...</span>}
        </div>

        {!selectedLedgerId ? (
          <p className="text-sm text-text-tertiary">선택된 장부가 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {canEditNotes && (
              <div className="flex items-start gap-2">
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="예: 이번 달 외식비는 55만원 안으로 보기"
                  rows={2}
                  className="min-h-[52px] flex-1 resize-none rounded-xl border border-border bg-surface-secondary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateNote()}
                  disabled={savingNote || !noteDraft.trim()}
                  className="h-10 w-10 rounded-lg bg-primary text-white flex items-center justify-center disabled:opacity-40 shrink-0"
                  aria-label="장부 메모 추가"
                  title="장부 메모 추가"
                >
                  {savingNote ? <span className="text-xs">...</span> : <Plus size={16} />}
                </button>
              </div>
            )}

            {!canEditNotes && (
              <p className="text-xs text-text-tertiary">현재 권한에서는 메모를 읽을 수만 있습니다.</p>
            )}

            <div className="space-y-2">
              {notes.length === 0 && !notesLoading ? (
                <p className="text-sm text-text-tertiary text-center py-5 border border-dashed border-border rounded-xl">
                  아직 남겨진 장부 메모가 없습니다.
                </p>
              ) : (
                notes.map((note) => {
                  const isEditing = editingNoteId === note.noteId;
                  const canModifyNote = canManageNotes || note.authorUserId === currentUserId;

                  return (
                    <div
                      key={note.noteId}
                      className={`rounded-xl border p-3 space-y-2 ${note.resolved ? 'border-border bg-surface-secondary/50' : 'border-border bg-surface-secondary'}`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => void handlePatchNote(note, { resolved: !note.resolved })}
                          disabled={!canEditNotes}
                          className={`mt-0.5 h-6 w-6 rounded-full border flex items-center justify-center shrink-0 ${
                            note.resolved
                              ? 'border-primary bg-primary text-white'
                              : 'border-border text-text-tertiary hover:text-primary'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                          aria-label={note.resolved ? '메모 완료 취소' : '메모 완료'}
                          title={note.resolved ? '완료 취소' : '완료'}
                        >
                          <Check size={13} />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary mb-1">
                            {note.pinned && <Pin size={11} className="text-primary fill-primary" />}
                            <span className="truncate">{note.authorDisplayName || note.authorEmail}</span>
                            <span>·</span>
                            <span className="shrink-0">{formatNoteDate(note.createdAt)}</span>
                            {note.resolved && (
                              <>
                                <span>·</span>
                                <span className="shrink-0">완료</span>
                              </>
                            )}
                          </div>

                          {isEditing ? (
                            <textarea
                              value={editingBody}
                              onChange={(event) => setEditingBody(event.target.value)}
                              rows={3}
                              className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                            />
                          ) : (
                            <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${note.resolved ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                              {note.body}
                            </p>
                          )}
                        </div>
                      </div>

                      {canEditNotes && (
                        <div className="flex justify-end gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleUpdateNote(note.noteId)}
                                disabled={savingNote || !editingBody.trim()}
                                className="h-8 w-8 rounded-lg border border-border text-text-secondary flex items-center justify-center disabled:opacity-40"
                                aria-label="메모 저장"
                                title="저장"
                              >
                                <Save size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(null);
                                  setEditingBody('');
                                }}
                                className="h-8 w-8 rounded-lg border border-border text-text-secondary flex items-center justify-center"
                                aria-label="메모 수정 취소"
                                title="취소"
                              >
                                <X size={13} />
                              </button>
                            </>
                          ) : (
                            <>
                              {canManageNotes && (
                                <button
                                  type="button"
                                  onClick={() => void handlePatchNote(note, { pinned: !note.pinned })}
                                  className={`h-8 w-8 rounded-lg border border-border flex items-center justify-center ${note.pinned ? 'text-primary' : 'text-text-secondary'}`}
                                  aria-label={note.pinned ? '메모 고정 해제' : '메모 고정'}
                                  title={note.pinned ? '고정 해제' : '고정'}
                                >
                                  <Pin size={13} />
                                </button>
                              )}
                              {canModifyNote && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingNoteId(note.noteId);
                                      setEditingBody(note.body);
                                    }}
                                    className="h-8 w-8 rounded-lg border border-border text-text-secondary flex items-center justify-center"
                                    aria-label="메모 수정"
                                    title="수정"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteNote(note)}
                                    className="h-8 w-8 rounded-lg border border-border text-expense flex items-center justify-center"
                                    aria-label="메모 삭제"
                                    title="삭제"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </section>

      <section className="bg-surface rounded-2xl border border-border p-5 space-y-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-text-primary">멤버 관리</h3>
          <p className="text-xs text-text-tertiary">선택한 장부의 멤버를 확인하고 초대/회수/제거를 관리합니다.</p>
        </div>

        {!selectedLedgerId ? (
          <p className="text-sm text-text-tertiary">선택된 장부가 없습니다.</p>
        ) : (
          <>
            {!canManageMembers && (
              <p className="text-xs text-text-tertiary">현재 권한으로는 초대/회수가 불가합니다. (OWNER/ADMIN만 가능)</p>
            )}

            {canManageMembers && (
              <div className="flex flex-col gap-2">
                <input
                  type="email"
                  placeholder="초대할 이메일"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border bg-surface-secondary text-sm"
                />
                <div className="flex gap-2 items-center">
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'EDITOR' | 'VIEWER')}
                    className="px-2 py-2 rounded-lg border border-border bg-surface-secondary text-xs"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="EDITOR">EDITOR</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      const normalizedEmail = inviteEmail.trim().toLowerCase();
                      if (!normalizedEmail) return;
                      const res = await apiFetch(`/api/ledgers/${selectedLedgerId}/invites`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: normalizedEmail, role: inviteRole, expiresInDays: 7 }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setInviteLink(data.inviteLink || '');
                        setInviteEmail('');
                        await loadMembersAndInvites();
                      }
                    }}
                    className="px-3 py-2 rounded-lg bg-primary text-white text-xs"
                  >
                    초대 링크 생성
                  </button>
                </div>
              </div>
            )}

            {inviteLink && (
              <input readOnly value={inviteLink} className="w-full px-3 py-2 rounded-lg border border-border bg-surface-secondary text-xs" />
            )}

            <div className="rounded-lg border border-border bg-surface-secondary/50 p-2.5 text-[11px] text-text-tertiary space-y-1">
              <p><span className="font-semibold text-text-secondary">OWNER</span> · 장부 소유자 (전체 권한)</p>
              <p><span className="font-semibold text-text-secondary">ADMIN</span> · 멤버 초대/회수 + 장부 설정/데이터 관리</p>
              <p><span className="font-semibold text-text-secondary">EDITOR</span> · 거래/카테고리 입력·수정 가능</p>
              <p><span className="font-semibold text-text-secondary">VIEWER</span> · 조회 전용</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium">멤버</p>
              {members.map((m) => (
                <div key={m.membershipId} className="text-xs flex items-center justify-between border border-border rounded-lg px-2 py-1.5">
                  <span>{m.userDisplayName || m.userEmail} · {m.role}</span>
                  {canManageMembers && m.role !== 'OWNER' && (
                    <button
                      type="button"
                      className="text-expense"
                      onClick={async () => {
                        await apiFetch(`/api/ledgers/${selectedLedgerId}/members/${m.membershipId}`, { method: 'DELETE' });
                        await loadMembersAndInvites();
                      }}
                    >
                      제거
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium">초대 목록</p>
              {invites.map((inv) => (
                <div key={inv.inviteId} className="text-xs flex items-center justify-between border border-border rounded-lg px-2 py-1.5">
                  <span>{inv.invitedEmail} · {inv.role} · {inv.status}</span>
                  {canManageMembers && inv.status === 'PENDING' && (
                    <button
                      type="button"
                      className="text-expense"
                      onClick={async () => {
                        await apiFetch(`/api/ledgers/${selectedLedgerId}/invites/${inv.inviteId}/revoke`, { method: 'POST' });
                        await loadMembersAndInvites();
                      }}
                    >
                      회수
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
