import { COLORS } from '@ccstatus/core';

const all = [...COLORS];
/** '(none)' = unset; then foreground names, then bg* names (stable core order). */
export const NAMED_COLORS: string[] = [
  '(none)',
  ...all.filter((c) => !c.startsWith('bg')),
  ...all.filter((c) => c.startsWith('bg')),
];
