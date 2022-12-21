import { isEqual, noop } from 'lodash';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TFunction, useTranslation } from 'react-i18next';
import { i18nConfig } from '../shared/constants';

export type TFunc = TFunction<typeof i18nConfig.ns, string>;

export function useT(prefix?: string): TFunc {
  const { t, i18n } = useTranslation(i18nConfig.ns, { keyPrefix: prefix });
  return (...args: Parameters<typeof t>) => {
    const key = args[0];
    if (typeof key === 'string' && !i18n.exists(key)) {
      // Trim qualifier prefix on missing resource.
      const result = t(...args);
      const parts = result.split(i18nConfig.keySeparator);
      return parts.at(-1);
    } else {
      return t(...args);
    }
  };
}

/**
 * Imperatively gets a TFunc instance with the given prefix.
 * Useful for effects outside of the render cycle.
 */
export function getT(prefix?: string): TFunc {
  return window.i18n.getFixedT(null, i18nConfig.ns, prefix);
}

/** Similar to `useMemo`, but retains reference for deep-equal values. */
export function useMemoStable<T>(factory: () => T, deps: React.DependencyList): T {
  const ref = useRef<T>();

  return useMemo(() => {
    const value = factory();
    if (isEqual(value, ref.current)) {
      return ref.current as T;
    }

    ref.current = value;
    return value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useStaticValue<T>(factory: () => T): T {
  const [value] = useState(factory);
  return value;
}

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

export type UnmountListener = {
  hasUnmounted: boolean;
  onUnmount: () => void;
};

export function useUnmountListener(): UnmountListener {
  const listener = useStaticValue<UnmountListener>(() => ({
    hasUnmounted: false,
    onUnmount: noop,
  }));

  useEffect(() => {
    return () => {
      listener.hasUnmounted = true;
      listener.onUnmount();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return listener;
}
