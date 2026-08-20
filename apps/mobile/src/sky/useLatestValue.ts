import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns a stable reader for data that event handlers must observe without
 * rebuilding the native gesture which owns those handlers.
 */
export function useLatestValue<Value>(value: Value): () => Value {
  const latestValue = useRef(value);

  useEffect(() => {
    latestValue.current = value;
  }, [value]);

  return useCallback(() => latestValue.current, []);
}
