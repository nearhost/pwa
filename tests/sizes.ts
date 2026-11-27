// The sizes every journey runs at (the canvas's), with the band and bottom-inset floors the shell
// takes there when installed, and the two colour schemes.
export const sizes = [
  { name: 'iPad landscape', viewport: { width: 1194, height: 834 }, band: 56, bottom: 20 },
  { name: 'iPad portrait', viewport: { width: 834, height: 1194 }, band: 56, bottom: 20 },
  { name: 'phone portrait', viewport: { width: 390, height: 844 }, band: 92, bottom: 34 },
] as const;

export const schemes = ['dark', 'light'] as const;
