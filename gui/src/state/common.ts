import { Draft, produce } from 'immer';
import { atom, SetStateAction, Setter, useSetAtom, WritableAtom } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { useStaticValue } from '../shared';

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

type WriteGetter = Parameters<WritableAtom<unknown, unknown>['write']>[0];

const NOT_YET_MOUNTED = 'Component has not yet mounted.';
const initialGetSet = {
  get: (() => {
    throw new Error(NOT_YET_MOUNTED);
  }) as WriteGetter,
  set: (() => {
    throw new Error(NOT_YET_MOUNTED);
  }) as Setter,
};

const $dispatch = atom(null, (get, set, action: (get: WriteGetter, set: Setter) => void) => action(get, set));

export type ActionsHook<T> = () => T;

export function actions<T>(spec: (get: WriteGetter, set: Setter) => T): ActionsHook<T> {
  return function useActions() {
    const dispatch = useSetAtom($dispatch);
    const ref = useRef(initialGetSet);

    useEffect(() => {
      dispatch((get, set) => (ref.current = { get, set }));
    }, [dispatch]);

    return useStaticValue(() => {
      const get = ((atom) => ref.current.get(atom)) as WriteGetter;
      const set = ((atom, update) => ref.current.set(atom, update)) as Setter;
      return spec(get, set);
    });
  };
}

export type ImmerSetter = <Value>(
  atom: WritableAtom<Value, SetStateAction<Value>>,
  fn: Value | ((draft: Draft<Value>) => void),
) => void;

export function immerSetter(set: Setter): ImmerSetter {
  const setter: ImmerSetter = (atom, update) =>
    set(atom, produce(typeof update === 'function' ? (update as <Value>(draft: Draft<Value>) => void) : () => update));
  return setter;
}
