export const TOAST_PRESETS: { label: string; when: string; text: string }[] = [
  { label: 'Context high', when: 'ctxPct>80', text: 'Context over 80%' },
  { label: 'Context critical', when: 'ctxPct>95', text: 'Context over 95%' },
  { label: 'Session limit near', when: 'fivePct>90', text: 'Session limit near' },
  { label: 'Weekly limit near', when: 'weekPct>80', text: 'Weekly limit near' },
];
