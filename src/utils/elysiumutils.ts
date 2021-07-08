import { AppState, LayerState } from "../AppContext";
import { ControlState, Lfo, SerializedComposition, SerializedCompositionControl, SerializedCompositionLayer, SerializedCompositionToken, Token } from "../Types";
import { buildFromDefs, DefaultLayerControls, DefaultPlayerControls } from "./DefaultDefinitions";
import { mod } from "./utils";
import * as npath from "path";

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


export function buildTokenFromSerialized(appState: AppState, serialized: SerializedCompositionToken): { tokenState: Token, controls: Record<string, ControlState> } | null
{
    serialized = {...serialized, path: npath.normalize(serialized.path)};
    const def = appState.tokenDefinitions[serialized.path];

    if (!def) return null;

    const controls = {...buildFromDefs(def.controls)};

    for (const id in controls)
    {
        const serializedControl = serialized.controls.find(c => c.key === controls[id].key);
        if (serializedControl)
        {
            controls[id] = {
                ...controls[id],
                id: serializedControl.id,
                currentValueType: serializedControl.currentValueType,
                inherit: serializedControl.inherit,
                scalarValue: serializedControl.scalarValue,
                lfo: {...serializedControl.lfo}
            };
        }
    }

    const token: Token = {
        id: serialized.id,
        label: def.label,
        path: serialized.path,
        store: {},
        symbol: def.symbol,
        callbacks: {...appState.tokenCallbacks[serialized.path]},
        controlIds: Object.keys(controls)
    };

    return {
        tokenState: token,
        controls
    };
}

function serializeControl(control: ControlState): SerializedCompositionControl
{
    return {
        key: control.key,
        id: control.id,
        currentValueType: control.currentValueType,
        inherit: control.inherit,
        scalarValue: control.scalarValue,
        lfo: control.lfo,
    };
}

export function serializeComposition(appState: AppState): SerializedComposition
{
    const tokenMap = Object.entries(appState.tokens).map((e) =>
    {
        const [ tokenId, token ] = e;

       return {
            id: tokenId,
            controls: token.controlIds.map(cid => serializeControl(appState.controls[cid])),
            path: token.path
        };
    });

    return {
        version: 1,
        tokens: tokenMap,
        global: {
            transpose: serializeControl(appState.controls[appState.transpose]),
            tempo: serializeControl(appState.controls[appState.tempo]),
            barLength: serializeControl(appState.controls[appState.barLength]),
            velocity: serializeControl(appState.controls[appState.velocity]),
            emphasis: serializeControl(appState.controls[appState.emphasis]),
            noteLength: serializeControl(appState.controls[appState.noteLength]),
            timeToLive: serializeControl(appState.controls[appState.timeToLive]),
            pulseEvery: serializeControl(appState.controls[appState.pulseEvery])
        },
        layers: appState.layers.map((layer) =>
        {
            return {
                name: layer.name,
                enabled: layer.enabled,
                midiChannel: layer.midiChannel,
                key: layer.key,
                transpose: serializeControl(appState.controls[layer.transpose]),
                tempo: serializeControl(appState.controls[layer.tempo]),
                barLength: serializeControl(appState.controls[layer.barLength]),
                velocity: serializeControl(appState.controls[layer.velocity]),
                emphasis: serializeControl(appState.controls[layer.emphasis]),
                tempoSync: layer.tempoSync,
                noteLength: serializeControl(appState.controls[layer.noteLength]),
                timeToLive: serializeControl(appState.controls[layer.timeToLive]),
                pulseEvery: serializeControl(appState.controls[layer.pulseEvery]),
                tokenIds: layer.tokenIds
            };
        })
    };
};

export function deserializeComposition(appState: AppState, c: SerializedComposition): AppState
{
    const appTokens: Record<string, Token> = {};
    let appControls: Record<string, ControlState> = {};

    c.tokens.forEach((token) => 
    {
        const res = buildTokenFromSerialized(appState, token);
        if (res)
        {
            const { tokenState, controls } = res;
            appTokens[tokenState.id] = tokenState;
            appControls = { ...appControls, ...controls };
        }
    });
    
    for (const id in DefaultPlayerControls)
    {
        let control = {...DefaultPlayerControls[id]};
        if (Object.prototype.hasOwnProperty.call(c.global, control.key))
        {
            const serializedControl = c.global[control.key as keyof SerializedComposition["global"]];
            control = {
                ...control,
                id: serializedControl.id,
                currentValueType: serializedControl.currentValueType,
                inherit: serializedControl.inherit,
                scalarValue: serializedControl.scalarValue,
                lfo: {...serializedControl.lfo}
            };
            appControls[control.id] = control;
        }
    }

    const layers: LayerState[] = [];

    c.layers.forEach((layer) =>
    {
        const defaultControls = DefaultLayerControls();
        for (const id in defaultControls)
        {
            let control = {...defaultControls[id]};
            if (Object.prototype.hasOwnProperty.call(layer, control.key))
            {
                const serializedControl = layer[control.key as keyof SerializedCompositionLayer] as SerializedCompositionControl;
                control = {
                    ...control,
                    id: serializedControl.id,
                    currentValueType: serializedControl.currentValueType,
                    inherit: serializedControl.inherit,
                    scalarValue: serializedControl.scalarValue,
                    lfo: {...serializedControl.lfo}
                };
                appControls[control.id] = control;
            }
        }

        const newLayer: LayerState = {
            name: layer.name,
            enabled: layer.enabled,
            midiChannel: layer.midiChannel,
            key: layer.key,
            transpose: layer.transpose.id,
            tempo: layer.tempo.id,
            barLength: layer.barLength.id,
            velocity: layer.velocity.id,
            emphasis: layer.emphasis.id,
            tempoSync: layer.tempoSync,
            noteLength: layer.noteLength.id,
            timeToLive: layer.timeToLive.id,
            pulseEvery: layer.pulseEvery.id,
            tokenIds: layer.tokenIds,
            playheads: []
        };

        layers.push(newLayer);
    });

    return {
        ...appState,
        transpose: c.global.transpose.id,
        tempo: c.global.tempo.id,
        barLength: c.global.barLength.id,
        velocity: c.global.velocity.id,
        emphasis: c.global.emphasis.id,
        noteLength: c.global.noteLength.id,
        timeToLive: c.global.timeToLive.id,
        pulseEvery: c.global.pulseEvery.id,
        controls: appControls,
        tokens: appTokens,
        isPlaying: false,
        currentLayerIndex: 0,
        selectedHex: -1,
        layers
    }
}

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