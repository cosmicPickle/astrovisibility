import {
  canonicalizeMaskOperation,
  canonicalizeMaskOperations,
  type VisibilityMaskOperation,
} from './visibilityMask';

export type MaskEditorHistory = Readonly<{
  operations: readonly VisibilityMaskOperation[];
  undoStack: readonly (readonly VisibilityMaskOperation[])[];
  redoStack: readonly (readonly VisibilityMaskOperation[])[];
}>;

function createHistory(
  operations: readonly VisibilityMaskOperation[],
  undoStack: readonly (readonly VisibilityMaskOperation[])[],
  redoStack: readonly (readonly VisibilityMaskOperation[])[],
): MaskEditorHistory {
  return Object.freeze({
    operations,
    undoStack: Object.freeze([...undoStack]),
    redoStack: Object.freeze([...redoStack]),
  });
}

export function createMaskEditorHistory(
  initialOperations: readonly VisibilityMaskOperation[] = [],
): MaskEditorHistory {
  return createHistory(canonicalizeMaskOperations(initialOperations), [], []);
}

function recordEdit(
  history: MaskEditorHistory,
  operations: readonly VisibilityMaskOperation[],
): MaskEditorHistory {
  return createHistory(
    canonicalizeMaskOperations(operations),
    [...history.undoStack, history.operations],
    [],
  );
}

export function addMaskOperation(
  history: MaskEditorHistory,
  operation: VisibilityMaskOperation,
): MaskEditorHistory {
  const canonical = canonicalizeMaskOperation(operation);
  if (history.operations.some(({ id }) => id === canonical.id)) {
    throw new Error(`Mask operation id already exists: ${canonical.id}`);
  }
  const firstCorrectionIndex = history.operations.findIndex(
    ({ kind }) => kind !== 'visiblePolygon',
  );
  const insertionIndex =
    canonical.kind === 'visiblePolygon' && firstCorrectionIndex >= 0
      ? firstCorrectionIndex
      : history.operations.length;
  return recordEdit(history, [
    ...history.operations.slice(0, insertionIndex),
    canonical,
    ...history.operations.slice(insertionIndex),
  ]);
}

export function removeMaskOperation(
  history: MaskEditorHistory,
  operationId: string,
): MaskEditorHistory {
  if (!history.operations.some(({ id }) => id === operationId)) return history;
  return recordEdit(
    history,
    history.operations.filter(({ id }) => id !== operationId),
  );
}

export function resetMaskOperations(
  history: MaskEditorHistory,
): MaskEditorHistory {
  return history.operations.length === 0 ? history : recordEdit(history, []);
}

export function undoMaskEdit(history: MaskEditorHistory): MaskEditorHistory {
  const operations = history.undoStack.at(-1);
  if (!operations) return history;
  return createHistory(operations, history.undoStack.slice(0, -1), [
    ...history.redoStack,
    history.operations,
  ]);
}

export function redoMaskEdit(history: MaskEditorHistory): MaskEditorHistory {
  const operations = history.redoStack.at(-1);
  if (!operations) return history;
  return createHistory(
    operations,
    [...history.undoStack, history.operations],
    history.redoStack.slice(0, -1),
  );
}
