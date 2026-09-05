import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Loader2, MessageSquare, Pin, Plus, X } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import type { LocaleCode } from '../../utils/format';
import type { LedgerNote } from '../../utils/ledgerNotes';
import { Card, EmptyState, LoadingIndicator } from './DashboardCards';

interface LedgerNotesCardProps {
  loading: boolean;
  notes: LedgerNote[];
  canEdit: boolean;
  saving: boolean;
  onCreate: (body: string) => Promise<boolean>;
  onResolve: (note: LedgerNote) => void;
}

const DASHBOARD_LEDGER_NOTE_LIMIT = 5;

function formatNoteDate(
  value: string,
  locale: LocaleCode,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localeCode =
    locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : 'en-US';
  return date.toLocaleDateString(localeCode, { month: 'short', day: 'numeric' });
}

export default function LedgerNotesCard({
  loading,
  notes,
  canEdit,
  saving,
  onCreate,
  onResolve,
}: LedgerNotesCardProps) {
  const { locale } = useTranslation();
  const [draft, setDraft] = useState('');
  const [composing, setComposing] = useState(false);
  const visibleNotes = notes.slice(0, DASHBOARD_LEDGER_NOTE_LIMIT);

  const handleCreate = async () => {
    if (!draft.trim()) return;
    const created = await onCreate(draft);
    if (created) {
      setDraft('');
      setComposing(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare size={17} className="text-primary shrink-0" />
          <h3 className="text-base font-semibold text-text-primary truncate">장부 메모</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <button
              type="button"
              onClick={() => setComposing((value) => !value)}
              className="h-8 w-8 rounded-lg border border-border text-text-secondary hover:text-primary flex items-center justify-center"
              aria-label={composing ? '메모 작성 닫기' : '메모 작성'}
              title={composing ? '닫기' : '메모 작성'}
            >
              {composing ? <X size={14} /> : <Plus size={14} />}
            </button>
          )}
          <Link
            to="/settings/ledgers"
            className="flex items-center gap-1 text-sm text-primary hover:opacity-80 transition-opacity font-medium"
          >
            전체 보기
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {canEdit && composing && (
        <div className="flex items-start gap-2 mb-4">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="예: 월급 들어오면 로카365 결제분 먼저 남겨두기"
            rows={2}
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary"
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={saving || !draft.trim()}
            className="h-10 w-10 rounded-lg bg-primary text-white flex items-center justify-center disabled:opacity-40 shrink-0"
            aria-label="장부 메모 추가"
            title="장부 메모 추가"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          </button>
        </div>
      )}

      {loading ? (
        <LoadingIndicator text="메모를 불러오는 중..." />
      ) : visibleNotes.length === 0 ? (
        <EmptyState text="남겨진 장부 메모가 없습니다." />
      ) : (
        <div className="divide-y divide-border-light">
          {visibleNotes.map((note) => (
            <div key={note.noteId} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onResolve(note)}
                  disabled={!canEdit}
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
                    <span className="shrink-0">{formatNoteDate(note.createdAt, locale)}</span>
                  </div>
                  <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${note.resolved ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                    {note.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
