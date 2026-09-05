import { useStore } from '../stores/useStore';

export function useIsSimpleMode() {
  return useStore((s) => s.inputMode) === 'simple';
}
