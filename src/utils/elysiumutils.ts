import { AppState, LayerState } from "../AppContext";
import { ControlState, Lfo, Token } from "../Types";
import { buildFromDefs, DefaultLayerControls, DefaultPlayerControls } from "./DefaultDefinitions";
import { mod } from "./utils";
import * as npath from "path";
import { buildLayer } from "../Layers";
import { getTokenUIDFromPath } from "../Tokens";
import { migrateSerializedComposition } from "../migrators";

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

export function getNoteParts(note: string): { name: string, octave: number }
{
    if (note[1] === "#")
    {
        return {
            name: note.substr(0, 2),
            octave: parseInt(note.substr(2))
        };
    }
    else
    {
        return {
            name: note.substr(0, 1),
            octave: parseInt(note.substr(1))
        };
    }
}

export function transposeNote(note: string, transpose: number)
{
    const { octave, name } = getNoteParts(note);

    const noteIndex = noteArray.indexOf(name);
    const newNoteIndex = mod(noteIndex + transpose, 12);
    const octaveDelta = Math.floor((transpose + noteIndex) / 12);

    // console.log(note, transpose, noteArray[newNoteIndex] + (octave + octaveDelta).toString());
    return noteArray[newNoteIndex] + (octave + octaveDelta).toString();
}

export const NumHexes = 12 * 17;

export function getAdjacentHex(hexIndex: number, direction: number, offset: number = 1): number
{
    let val = hexIndex;
    direction = mod(direction, 6);
    if (offset < 0)
    {
        offset = -offset;
        direction = (direction + 3) % 6;
    }
    for (let i = 0; i < offset; i++)
    {
        const isLow = Math.floor(val / 12) % 2 === 0;
        const isTop = val % 12 === 0;
        const isBottom = (val + 1) % 12 === 0;
    
        switch (direction)
        {
            case 0: // up
                val = mod(isTop ? val + 11 : val - 1, NumHexes);
                break;
            case 1: // up-right
                val = mod((isTop && !isLow) ? val + 23 : (isLow ? val + 12 : val + 11), NumHexes);
                break;
            case 2: // down-right
                val = mod((isBottom && isLow) ? val + 1 : (isLow ? val + 13 : val + 12), NumHexes);
                break;
            case 3: // down
                val = mod(isBottom ? val - 11 : val + 1, NumHexes);
                break;
            case 4: // down-left
                val = mod((isBottom && isLow) ? val - 23 : (isLow ? val - 11 : val - 12), NumHexes);
                break;
            case 5: // up-left
                val = mod((isTop && !isLow) ? val - 1 : (isLow ? val - 12 : val - 13), NumHexes);
                break;
        }
    }

    return val;
}

export function noteFromIndex(index: number): string
{
    return noteArray[index % noteArray.length] + Math.floor(index / noteArray.length).toString();
}

export function indexFromNote(note: string): number
{
    const { octave, name } = getNoteParts(note);

    return noteArray.length * octave + noteArray.indexOf(name);
}

export const hexNotes = [
    "D#7",
    "G#6",
    "C#6",
    "F#5",
    "B4",
    "E4",
    "A3",
    "D3",
    "G2",
    "C2",
    "F1",
    "A#1",

    "G7",
    "C7",
    "F6",
    "A#5",
    "D#5",
    "G#4",
    "C#4",
    "F#3",
    "B2",
    "E2",
    "A1",
    "D1",

    "E7",
    "A6",
    "D6",
    "G5",
    "C5",
    "F4",
    "A#3",
    "D#3",
    "G#2",
    "C#2",
    "F#1",
    "B1",

    "G#7",
    "C#7",
    "F#6",
    "B5",
    "E5",
    "A4",
    "D4",
    "G3",
    "C3",
    "F2",
    "A#1",
    "D#1",

    "F7",
    "A#6",
    "D#6",
    "G#5",
    "C#5",
    "F#4",
    "B3",
    "E3",
    "A2",
    "D2",
    "G1",
    "C1",

    "A7",
    "D7",
    "G6",
    "C6",
    "F5",
    "A#4",
    "D#4",
    "G#3",
    "C#3",
    "F#2",
    "B1",
    "E1",

    "F#7",
    "B6",
    "E6",
    "A5",
    "D5",
    "G4",
    "C4",
    "F3",
    "A#2",
    "D#2",
    "G#1",
    "C#1",

    "A#7",
    "D#7",
    "G#6",
    "C#6",
    "F#5",
    "B4",
    "E4",
    "A3",
    "D3",
    "G2",
    "C2",
    "F1",

    "G7",
    "C7",
    "F6",
    "A#5",
    "D#5",
    "G#4",
    "C#4",
    "F#3",
    "B2",
    "E2",
    "A1",
    "D1",

    "B7",
    "E7",
    "A6",
    "D6",
    "G5",
    "C5",
    "F4",
    "A#3",
    "D#3",
    "G#2",
    "C#2",
    "F#1",

    "G#7",
    "C#7",
    "F#6",
    "B5",
    "E5",
    "A4",
    "D4",
    "G3",
    "C3",
    "F2",
    "A#1",
    "D#1",

    "C8",
    "F7",
    "A#6",
    "D#6",
    "G#5",
    "C#5",
    "F#4",
    "B3",
    "E3",
    "A2",
    "D2",
    "G1",

    "A7",
    "D7",
    "G6",
    "C6",
    "F5",
    "A#4",
    "D#4",
    "G#3",
    "C#3",
    "F#2",
    "B1",
    "E1",

    "C#6",
    "F#7",
    "B6",
    "E6",
    "A5",
    "D5",
    "G4",
    "C4",
    "F3",
    "A#2",
    "D#2",
    "G#1",

    "A#7",
    "D#7",
    "G#6",
    "C#6",
    "F#5",
    "B4",
    "E4",
    "A3",
    "D3",
    "G2",
    "C2",
    "F1",

    "D8",
    "G7",
    "C7",
    "F6",
    "A#5",
    "D#5",
    "G#4",
    "C#4",
    "F#3",
    "B2",
    "E2",
    "A1",

    "B7",
    "E7",
    "A6",
    "D6",
    "G5",
    "C5",
    "F4",
    "A#3",
    "D#3",
    "G#2",
    "C#2",
    "F#1"
];


/*
-7, -7, -7, -7, -19, +5, -19, +5, -7, -7, -7, -7, */