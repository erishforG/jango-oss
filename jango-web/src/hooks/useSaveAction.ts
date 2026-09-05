import { useState, useCallback, useRef } from 'react';
import { useToast } from '../components/Toast';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface UseSaveActionOptions {
  successMessage?: string;
  errorMessage?: string;
  savedDurationMs?: number;
}

export function useSaveAction(options: UseSaveActionOptions = {}) {
  const { successMessage = '저장되었습니다', errorMessage = '저장에 실패했습니다', savedDurationMs = 2000 } = options;
  const [state, setState] = useState<SaveState>('idle');
  const { toast } = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const execute = useCallback(async (fn: () => Promise<void>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState('saving');
    try {
      await fn();
      setState('saved');
      toast(successMessage, 'success');
      timerRef.current = setTimeout(() => setState('idle'), savedDurationMs);
    } catch (err: any) {
      setState('error');
      toast(err?.message || errorMessage, 'error');
      timerRef.current = setTimeout(() => setState('idle'), savedDurationMs);
    }
  }, [successMessage, errorMessage, savedDurationMs, toast]);

  return {
    state,
    isSaving: state === 'saving',
    isSaved: state === 'saved',
    execute,
    buttonLabel: (defaultLabel: string, savingLabel?: string) => {
      if (state === 'saving') return savingLabel || '저장 중...';
      if (state === 'saved') return '✓ 저장됨';
      return defaultLabel;
    },
    buttonDisabled: state === 'saving',
  };
}
