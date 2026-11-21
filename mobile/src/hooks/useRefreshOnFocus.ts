import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Refetches when a screen regains focus (TanStack Query's window-focus refetch does not exist on
 * native). The first focus is skipped because the query has just mounted and fetched.
 */
export function useRefreshOnFocus(refetchers: (() => unknown)[]): void {
  const firstFocus = useRef(true);
  const latest = useRef(refetchers);

  useEffect(() => {
    latest.current = refetchers;
  });

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      latest.current.forEach((refetch) => void refetch());
    }, []),
  );
}
