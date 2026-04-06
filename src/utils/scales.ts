export const modes = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  "Harmonic Major": [0, 2, 4, 5, 7, 8, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11],
  "Melodic Minor": [0, 2, 3, 5, 7, 9, 11],
  "Double Harmonic Minor": [0, 2, 3, 6, 7, 8, 11],
  "Double Harmonic Major": [0, 1, 4, 5, 7, 8, 11],
  Enigmatic: [0, 1, 4, 6, 8, 10, 11],
  "Neapolitan Major": [0, 1, 3, 5, 7, 9, 11],
  "Neapolitan Minor": [0, 1, 3, 5, 7, 8, 11],
};

export function notesForKey(tonic: number, mode: keyof typeof modes): number[] {
  return modes[mode].map((offset) => (tonic + offset) % 12);
}
