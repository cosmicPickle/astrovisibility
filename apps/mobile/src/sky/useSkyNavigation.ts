import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { CanvasSizePixels } from './projection';
import {
  applySkyNavigationGesture,
  type SkyNavigationGesture,
  type SkyViewport,
} from './skyViewport';

type GestureKind = 'pan' | 'pinch';

interface NavigationSession {
  baseline: SkyViewport | null;
  panActive: boolean;
  pinchActive: boolean;
  gesture: SkyNavigationGesture;
}

const createGesture = (canvas: CanvasSizePixels): SkyNavigationGesture => ({
  focalXPixels: canvas.widthPixels / 2,
  focalYPixels: canvas.heightPixels / 2,
  scale: 1,
  translationXPixels: 0,
  translationYPixels: 0,
});

export const useSkyNavigation = ({
  canvas,
  onManualNavigation,
  setViewport,
  viewport,
}: {
  canvas: CanvasSizePixels;
  onManualNavigation: () => void;
  setViewport: Dispatch<SetStateAction<SkyViewport>>;
  viewport: SkyViewport;
}) => {
  const viewportRef = useRef(viewport);
  const sessionRef = useRef<NavigationSession>({
    baseline: null,
    panActive: false,
    pinchActive: false,
    gesture: createGesture(canvas),
  });
  useLayoutEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const begin = useCallback(
    (kind: GestureKind, focalXPixels?: number, focalYPixels?: number) => {
      const session = sessionRef.current;
      if (!session.panActive && !session.pinchActive) {
        session.baseline = viewportRef.current;
        session.gesture = createGesture(canvas);
        onManualNavigation();
      }
      if (kind === 'pan') session.panActive = true;
      if (kind === 'pinch') {
        session.pinchActive = true;
        if (focalXPixels !== undefined) {
          session.gesture.focalXPixels = focalXPixels;
        }
        if (focalYPixels !== undefined) {
          session.gesture.focalYPixels = focalYPixels;
        }
      }
    },
    [canvas, onManualNavigation],
  );

  const updatePan = useCallback(
    (translationXPixels: number, translationYPixels: number) => {
      sessionRef.current.gesture.translationXPixels = translationXPixels;
      sessionRef.current.gesture.translationYPixels = translationYPixels;
    },
    [],
  );

  const updatePinch = useCallback(
    (scale: number, focalXPixels: number, focalYPixels: number) => {
      sessionRef.current.gesture.scale = scale;
      sessionRef.current.gesture.focalXPixels = focalXPixels;
      sessionRef.current.gesture.focalYPixels = focalYPixels;
    },
    [],
  );

  const finish = useCallback(
    (kind: GestureKind) => {
      const session = sessionRef.current;
      if (!session.baseline) return;
      if (kind === 'pan') session.panActive = false;
      if (kind === 'pinch') session.pinchActive = false;
      if (session.panActive || session.pinchActive) return;

      const nextViewport = applySkyNavigationGesture(
        session.baseline,
        canvas,
        session.gesture,
      );
      viewportRef.current = nextViewport;
      session.baseline = null;
      setViewport(nextViewport);
    },
    [canvas, setViewport],
  );

  return useMemo(
    () => ({
      beginPan: () => begin('pan'),
      beginPinch: (focalXPixels: number, focalYPixels: number) =>
        begin('pinch', focalXPixels, focalYPixels),
      finishPan: () => finish('pan'),
      finishPinch: () => finish('pinch'),
      updatePan,
      updatePinch,
    }),
    [begin, finish, updatePan, updatePinch],
  );
};
