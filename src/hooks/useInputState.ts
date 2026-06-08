import { useState, type Dispatch, type SetStateAction } from 'react'

/** useState con inizializzatore lazy, tipizzato per evitare la doppia firma. */
export function useInputState<T>(
  init: () => T,
): [T, Dispatch<SetStateAction<T>>] {
  return useState<T>(init)
}
