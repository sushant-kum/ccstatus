// `CCSTATUS_VERSION` is replaced with the package version at build time (tsup) and test time
// (vitest) via each config's `define` block, so no runtime file read is needed.
declare const CCSTATUS_VERSION: string;

/** The published ccstatus version, e.g. "0.4.1". */
export const VERSION: string = CCSTATUS_VERSION;
