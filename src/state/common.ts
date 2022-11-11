import { useEffect, useRef, useState } from 'react';

export type Loadable<Value> =
  | { state: 'loading' }
  | { state: 'hasError'; error: unknown }
  | { state: 'hasData'; data: Awaited<Value> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LOADING_STATE: Loadable<any> = { state: 'loading' };

export function useCachedLoadable<Value>(loadable: Loadable<Value>, initialData: Value): Value {
  const ref = useRef(initialData);
  if (loadable.state === 'hasData') {
    ref.current = loadable.data;
  }
  return ref.current;
}

export function useIsLoading<Value>(loadable: Loadable<Value>, delay = 300): boolean {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (loadable.state !== 'loading') {
      setIsLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      setIsLoading(true);
    }, delay);
    return () => clearTimeout(timeout);
  }, [loadable.state, delay]);

  return isLoading;
}
