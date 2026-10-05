export interface SeparatorPreset {
  char: string;
  name: string;
  code: string;
}

// ccstatusline's powerline separator presets (Nerd Font private-use glyphs).
export const SEPARATOR_PRESETS: SeparatorPreset[] = [
  { char: '', name: 'Triangle Right', code: 'U+E0B0' },
  { char: '', name: 'Triangle Left', code: 'U+E0B2' },
  { char: '', name: 'Round Right', code: 'U+E0B4' },
  { char: '', name: 'Round Left', code: 'U+E0B6' },
  { char: '', name: 'Lower Triangle', code: 'U+E0BA' },
  { char: '', name: 'Diagonal', code: 'U+E0BE' },
];
