import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActivePanorama } from '../storage/panoramaDraftRepository';
import {
  createMaskSelectionSession,
  type MaskBrushStroke,
} from './maskBrushSelection';

export function useMaskBrushSession(
  panorama: ActivePanorama,
  onCommitSelection: (selection: Uint8Array, draw: boolean) => void,
  onProcessingChange: (processing: boolean) => void,
) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = useRef<ReturnType<typeof createMaskSelectionSession> | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        session.current = createMaskSelectionSession();
      } catch {
        setError('Mask painting requires the updated Android app.');
      }
    });
    return () => {
      active = false;
      session.current?.close();
      session.current = null;
    };
  }, [panorama.id]);
  const apply = useCallback(
    async (stroke: MaskBrushStroke, draw: boolean) => {
      const current = session.current;
      if (!current) return;
      setProcessing(true);
      onProcessingChange(true);
      setError(null);
      try {
        const selection = await current.select(panorama, stroke);
        if (session.current === current) onCommitSelection(selection, draw);
      } catch {
        if (session.current === current)
          setError(
            'Could not apply the brush. Try a shorter stroke, a smaller brush or manual painting.',
          );
      } finally {
        if (session.current === current) {
          setProcessing(false);
          onProcessingChange(false);
        }
      }
    },
    [onCommitSelection, onProcessingChange, panorama],
  );
  return { apply, processing, error };
}
