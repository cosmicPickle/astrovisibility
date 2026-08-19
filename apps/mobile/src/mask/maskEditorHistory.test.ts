import {
  addMaskOperation,
  createMaskEditorHistory,
  redoMaskEdit,
  removeMaskOperation,
  resetMaskOperations,
  undoMaskEdit,
} from './maskEditorHistory';
import type { VisibilityMaskOperation } from './visibilityMask';

const polygon: VisibilityMaskOperation = {
  id: 'visible-a',
  kind: 'visiblePolygon',
  points: [
    { azimuthDegrees: 10, altitudeDegrees: 10 },
    { azimuthDegrees: 20, altitudeDegrees: 10 },
    { azimuthDegrees: 20, altitudeDegrees: 20 },
  ],
};

const stroke: VisibilityMaskOperation = {
  id: 'blocked-a',
  kind: 'blockedStroke',
  angularRadiusDegrees: 0.05,
  points: [{ azimuthDegrees: 15, altitudeDegrees: 15 }],
};

describe('mask editor history', () => {
  it('adds and removes operations with undo and redo', () => {
    let history = createMaskEditorHistory([polygon]);
    history = addMaskOperation(history, stroke);
    history = removeMaskOperation(history, polygon.id);

    expect(history.operations.map(({ id }) => id)).toEqual(['blocked-a']);
    history = undoMaskEdit(history);
    expect(history.operations.map(({ id }) => id)).toEqual([
      'visible-a',
      'blocked-a',
    ]);
    history = undoMaskEdit(history);
    expect(history.operations.map(({ id }) => id)).toEqual(['visible-a']);
    history = redoMaskEdit(history);
    expect(history.operations.map(({ id }) => id)).toEqual([
      'visible-a',
      'blocked-a',
    ]);
  });

  it('resets atomically, restores the reset with undo, and clears redo after a new edit', () => {
    let history = addMaskOperation(createMaskEditorHistory([polygon]), stroke);
    history = resetMaskOperations(history);
    expect(history.operations).toEqual([]);

    history = undoMaskEdit(history);
    expect(history.operations).toHaveLength(2);
    history = removeMaskOperation(history, stroke.id);
    expect(redoMaskEdit(history)).toBe(history);
  });

  it('does not create history for a missing removal or mutate prior snapshots', () => {
    const initial = createMaskEditorHistory([polygon]);
    const unchanged = removeMaskOperation(initial, 'missing');
    const changed = addMaskOperation(initial, stroke);

    expect(unchanged).toBe(initial);
    expect(initial.operations.map(({ id }) => id)).toEqual(['visible-a']);
    expect(changed.operations.map(({ id }) => id)).toEqual([
      'visible-a',
      'blocked-a',
    ]);
  });

  it('keeps visible polygons before ordered corrections', () => {
    const history = addMaskOperation(
      createMaskEditorHistory([stroke]),
      polygon,
    );
    expect(history.operations.map(({ id }) => id)).toEqual([
      'visible-a',
      'blocked-a',
    ]);
  });
});
