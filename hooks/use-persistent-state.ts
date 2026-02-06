"use client";

import { useEffect, useState } from "react";

type SetStateAction<T> = T | ((prev: T) => T);

function resolveNext<T>(previous: T, action: SetStateAction<T>): T {
  if (typeof action === "function") {
    return (action as (prev: T) => T)(previous);
  }
  return action;
}

export function usePersistentState<T>(key: string, initialValue: T): [T, (action: SetStateAction<T>) => void] {
  const [state, setState] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        return;
      }
      setState(JSON.parse(raw) as T);
    } catch {
      setState(initialValue);
    }
  }, [initialValue, key]);

  const setPersistent = (action: SetStateAction<T>) => {
    setState((previous) => {
      const next = resolveNext(previous, action);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // no-op: storage failures should not break runtime behavior.
      }
      return next;
    });
  };

  return [state, setPersistent];
}
