import { AppState } from "../state/AppState";
import { LayerState } from "../state/AppState";
import { ControlState, ModChainItem, ModChainItemUIAttributes } from "../Types";
import {
  LayerControlKey,
  LayerControlTypes,
  PlayerControlKey,
  PlayerControlKeys,
} from "./DefaultDefinitions";
import { mod } from "./utils";

export const noteArray: string[] = [
  "C", // 0
  "C#", // 1
  "D", // 2
  "D#", // 3
  "E", // 4
  "F", // 5
  "F#", // 6
  "G", // 7
  "G#", // 8
  "A", // 9
  "A#", // 10
  "B", // 11
];

export function getNoteParts(note: string): { name: string; octave: number } {
  if (note[1] === "#") {
    return {
      name: note.substr(0, 2),
      octave: parseInt(note.substr(2)),
    };
  } else {
    return {
      name: note.substr(0, 1),
      octave: parseInt(note.substr(1)),
    };
  }
}

export function transposeNote(note: string, semitones: number) {
  const { octave, name } = getNoteParts(note);

  const noteIndex = noteArray.indexOf(name);
  const newNoteIndex = mod(noteIndex + semitones, 12);
  const octaveDelta = Math.floor((semitones + noteIndex) / 12);

  // console.log(note, semitones, noteArray[newNoteIndex] + (octave + octaveDelta).toString());
  return noteArray[newNoteIndex] + (octave + octaveDelta).toString();
}

export function getInheritParts(
  str: string | undefined,
): [p1: "global", p2: PlayerControlKey] | [p1: "layer", p2: LayerControlKey] | false {
  if (str === undefined) return false;
  const parts = str.split(".");
  if (parts.length === 2) {
    if (parts[0] === "global") {
      return (
        PlayerControlKeys.includes(parts[1] as (typeof PlayerControlKeys)[number]) &&
        (parts as [p1: "global", p2: PlayerControlKey])
      );
    } else if (parts[0] === "layer") {
      return (
        LayerControlTypes.includes(parts[1] as (typeof PlayerControlKeys)[number]) &&
        (parts as [p1: "layer", p2: LayerControlKey])
      );
    }
  }

  return false;
}

export function getControlFromInheritParts(
  controls: AppState["controls"],
  playerControls: Pick<AppState, PlayerControlKey>,
  layer: LayerState,
  inheritParts: [p1: "global", p2: PlayerControlKey] | [p1: "layer", p2: LayerControlKey],
): ControlState {
  if (inheritParts[0] === "global") {
    return controls[playerControls[inheritParts[1]]];
  } else {
    return controls[layer[inheritParts[1]]];
  }
}

export function getAdjacentHex(
  hexIndex: number,
  direction: number,
  gridRows: number,
  gridColumns: number,
  offset: number = 1,
): number {
  let val = hexIndex;
  direction = mod(direction, 6);
  if (offset < 0) {
    offset = -offset;
    direction = (direction + 3) % 6;
  }
  for (let i = 0; i < offset; i++) {
    const isLow = Math.floor(val / gridRows) % 2 === 0;
    const isTop = val % gridRows === 0;
    const isBottom = (val + 1) % gridRows === 0;

    switch (direction) {
      case 0: // up
        val = mod(isTop ? val + (gridRows - 1) : val - 1, gridRows * gridColumns);
        break;
      case 1: // up-right
        val = mod(
          isTop && !isLow
            ? val + (gridRows * 2 - 1)
            : isLow
              ? val + gridRows
              : val + (gridRows - 1),
          gridRows * gridColumns,
        );
        break;
      case 2: // down-right
        val = mod(
          isBottom && isLow ? val + 1 : isLow ? val + (gridRows + 1) : val + gridRows,
          gridRows * gridColumns,
        );
        break;
      case 3: // down
        val = mod(isBottom ? val - (gridRows - 1) : val + 1, gridRows * gridColumns);
        break;
      case 4: // down-left
        val = mod(
          isBottom && isLow
            ? val - (gridRows * 2 - 1)
            : isLow
              ? val - (gridRows - 1)
              : val - gridRows,
          gridRows * gridColumns,
        );
        break;
      case 5: // up-left
        val = mod(
          isTop && !isLow ? val - 1 : isLow ? val - gridRows : val - (gridRows + 1),
          gridRows * gridColumns,
        );
        break;
    }
  }

  return val;
}

export function noteFromIndex(index: number): string {
  return noteArray[index % noteArray.length] + Math.floor(index / noteArray.length).toString();
}

export function indexFromNote(note: string): number {
  const { octave, name } = getNoteParts(note);

  return noteArray.length * octave + noteArray.indexOf(name);
}

const _hexIndexCache: Record<string, number[]> = {};
export function hexIndexesFromNote(note: string, hexNotes: string[]): number[] {
  if (Object.prototype.hasOwnProperty.call(_hexIndexCache, note)) {
    return _hexIndexCache[note];
  } else {
    const ret: number[] = [];

    for (let i = 0; i < hexNotes.length; i++) {
      if (hexNotes[i] === note) {
        ret.push(i);
      }
    }

    _hexIndexCache[note] = ret;
    return ret;
  }
}

export function generateGridNotes(startingNote: string, rows: number, cols: number) {
  const ret = [];
  let cursor = startingNote;

  for (let x = 0; x < cols; x++) {
    const columnStartingNote = cursor;

    for (let y = 0; y < rows; y++) {
      // going down = subtract a perfect fifth = subtract 7 semitones
      ret.push(cursor);
      cursor = transposeNote(cursor, -7);
    }

    // up-right is +major third (4), down-right is -minor third (3)
    cursor = transposeNote(columnStartingNote, x % 2 === 0 ? 4 : -3);
  }

  return ret;
}

export const noteColors: Record<string, string> = {
  A: "#e6194B",
  "A#": "#3cb44b",
  B: "#ffe119",
  C: "#4363d8",
  "C#": "#f58231",
  D: "#911eb4",
  "D#": "#42d4f4",
  E: "#f032e6",
  F: "#bfef45",
  "F#": "#fabed4",
  G: "#469990",
  "G#": "#dcbeff",
};

/*
-7, -7, -7, -7, -19, +5, -19, +5, -7, -7, -7, -7, */

export function getDefaultModChainItemUI(
  type: ModChainItem["__type"],
): ModChainItemUIAttributes {
  const x = 8;
  const y = 8;

  return { x, y };
}
