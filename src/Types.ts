import { ActionType, AppState } from "./AppContext";
import { LayerControlKey, LayerControlTypes, PlayerControlKey, PlayerControlKeys } from "./utils/DefaultDefinitions";
import seedRandom from "seedRandom";
import { v4 as uuidv4 } from 'uuid';
import { noteArray } from "./utils/elysiumutils";
import { NsToMs, NsToS } from "./utils/utils";

export type ControlValueType = "scalar" | "lfo" | "inherit";

export const NumMIDIChannels = 16;

function major(root: number)
{
    return [
        root,
        root + 2,
        root + 4,
        root + 5,
        root + 7,
        root + 9,
        root + 11
    ].map(n => n % 12);
}

function minor(root: number)
{
    return [
        root,
        root + 2,
        root + 3,
        root + 5,
        root + 7,
        root + 8,
        root + 10,
    ].map(n => n % 12);
}

export const KeyMap = {
    "None": noteArray.map((n, i) => i),
    "A major": major(noteArray.indexOf("A")),
    "A minor": minor(noteArray.indexOf("A")),
    "A flat major": major(noteArray.indexOf("G#")),
    "A flat minor": minor(noteArray.indexOf("G#")),
    "A sharp minor": minor(noteArray.indexOf("A#")),
    "B major": major(noteArray.indexOf("B")),
    "B minor": minor(noteArray.indexOf("B")),
    "B flat major": major(noteArray.indexOf("A#")),
    "B flat minor": minor(noteArray.indexOf("A#")),
    "C major": major(noteArray.indexOf("C")),
    "C minor": minor(noteArray.indexOf("C")),
    "C flat major": major(noteArray.indexOf("B")),
    "C sharp major": major(noteArray.indexOf("C#")),
    "C sharp minor": minor(noteArray.indexOf("C#")),
    "D major": major(noteArray.indexOf("D")),
    "D minor": minor(noteArray.indexOf("D")),
    "D flat major": major(noteArray.indexOf("C#")),
    "D flat minor": minor(noteArray.indexOf("C#")),
    "D sharp minor": minor(noteArray.indexOf("D#")),
    "E major": major(noteArray.indexOf("E")),
    "E minor": minor(noteArray.indexOf("E")),
    "E flat major": major(noteArray.indexOf("D#")),
    "E flat minor": minor(noteArray.indexOf("D#")),
    "F major": major(noteArray.indexOf("F")),
    "F minor": minor(noteArray.indexOf("F")),
    "F flat major": major(noteArray.indexOf("E")),
    "F sharp major": major(noteArray.indexOf("F#")),
    "F sharp minor": minor(noteArray.indexOf("F#")),
    "G major": major(noteArray.indexOf("G")),
    "G minor": minor(noteArray.indexOf("G")),
    "G flat minor": minor(noteArray.indexOf("F#")),
    "G sharp minor": minor(noteArray.indexOf("G#"))
};

export type Direction = 0 | 1 | 2 | 3 | 4 | 5;

export type StartCallback = (store: object, helpers: Record<string, Function>) => any;
export type StopCallback = (store: object, helpers: Record<string, Function>) => any;
export type TickCallback = (store: object, helpers: Record<string, Function>, playheads: Playhead[]) => any;
export const ControlDataTypes = [ "int", "decimal", "direction", "bool", "select", "triad" ] as const;
export type ControlDataType = typeof ControlDataTypes[number];

export interface SelectOption
{
    label: string;
    value: string;
}

export interface Playhead
{
    age: number;
    lifespan: number;
    direction: Direction;
}

export interface ControlDefinition
{
    label?: string;
    type?: ControlDataType;
    min?: number;
    max?: number;
    step?: number;
    options?: SelectOption[];
    inherit?: string;
    defaultValue?: any;
}

export interface ControlState
{
    label: string;
    type: ControlDataType;
    id: string;
    key: string;
    min: number;
    max: number;
    step?: number;
    options?: SelectOption[];
    inherit?: string;
    scalarValue: any;
    currentValueType: "scalar" | "lfo" | "inherit";
    lfo: Lfo;
}

export function copyControl(control: ControlState): ControlState
{
    const ret = {
        ...control,
        id: uuidv4(),
        lfo: {...control.lfo},
    };

    if (control.options)
    {
        ret.options = control.options.map(o => ({...o}));
    }

    return ret;
}

export function getControlValue(appState: AppState, controlState: ControlState): any
{
    if (controlState.currentValueType === "inherit" && controlState.inherit)
    {
        const inheritedControl = appState.controls[controlState.inherit];
        if (inheritedControl)
        {
            return getControlValue(appState, inheritedControl);
        }
        else
        {
            console.log("null1");
            return null;
        }
    }
    else if (controlState.currentValueType === "lfo")
    {
        const value = getLfoValue(appState, controlState.lfo) ?? 0;
        switch (controlState.type)
        {
            case "bool":
                return Boolean(value);
            case "decimal":
                return value;
            case "direction":
                return Math.round(value) % 6;
            case "int":
                return Math.round(value);
            case "select":
                return controlState.options![Math.round(value) % controlState.options!.length];
            case "triad":
                return Math.round(value) % 7;
            default:
                console.log("null2");
                return null;
        }
    }
    else if (controlState.currentValueType === "scalar")
    {
        return controlState.scalarValue;
    }
    else
    {
        console.log("null3");
        return null;
    }
}

export interface TokenCallbacks
{
    onStart?: StartCallback;
    onStop?: StopCallback;
    onTick?: TickCallback;
}

export interface Token
{
    label: string;
    symbol: string;
    controlIds: string[];
    callbacks: TokenCallbacks;
    store: object;
    id: string;
    path: string;
}

export interface TokenDefinition
{
    label: string;
    symbol: string;
    controls: Record<string, ControlDefinition>;
}

export const LfoTypes = ["sin","square","random","sequence","sawtooth"] as const;
export type LfoType = typeof LfoTypes[number];

export interface Lfo
{
    type: LfoType;
    min: number;
    max: number;
    lowPeriod: number;
    hiPeriod: number;
    period: number;
    sequence: any[];
}

function getLfoValue(appState: AppState, lfo: Lfo): any
{
    const tempoControl = appState.controls[appState.tempo];
    const bpms = lfo === tempoControl.lfo ? 1 : 60 / getControlValue(appState, tempoControl) * 1000;
    const now = Math.floor(Date.now() / bpms) * bpms;
    const lowPeriod = lfo.lowPeriod * 1000;
    const hiPeriod = lfo.hiPeriod * 1000;
    const period = lfo.period * 1000;
    const t = now % (lfo.type === "square" ? lowPeriod + hiPeriod : period);

    switch (lfo.type)
    {
        case "random":
        {
            return lfo.min + (seedRandom(Math.floor(now / period) * period)() * (lfo.max - lfo.min));
        }
        case "sawtooth":
        {
            return lfo.min + ((t / period) / (lfo.max - lfo.min));
        }
        case "sin":
        {
            const amp = (lfo.max - lfo.min) / 2;
            return (lfo.min + amp) + amp * Math.sin(t/period * Math.PI * 2);
        }
        case "square":
        {
            return t < lowPeriod ? lfo.min : lfo.max;
        }
        case "sequence":
        {
            return lfo.sequence[Math.floor(t / period * lfo.sequence.length)];
        }
    }
}

export interface SerializedCompositionControl
{
    key: string;
    id: string;
    currentValueType: "scalar" | "lfo" | "inherit";
    inherit?: string;
    scalarValue: any;
    lfo: Lfo;
}

export interface SerializedCompositionToken
{
    id: string;
    controls: SerializedCompositionControl[];
    path: string;
}

export interface SerializedCompositionLayer
{
    name: string;
    enabled: boolean;
    midiChannel: number;
    key: number;
    transpose: SerializedCompositionControl;
    tempo: SerializedCompositionControl;
    barLength: SerializedCompositionControl;
    velocity: SerializedCompositionControl;
    emphasis: SerializedCompositionControl;
    tempoSync: boolean;
    noteLength: SerializedCompositionControl;
    timeToLive: SerializedCompositionControl;
    pulseEvery: SerializedCompositionControl;
    tokenIds: string[][];
}

export interface SerializedComposition
{
    version: 1;
    tokens: SerializedCompositionToken[];
    global: {
        transpose: SerializedCompositionControl;
        tempo: SerializedCompositionControl;
        barLength: SerializedCompositionControl;
        velocity: SerializedCompositionControl;
        emphasis: SerializedCompositionControl;
        noteLength: SerializedCompositionControl;
        timeToLive: SerializedCompositionControl;
        pulseEvery: SerializedCompositionControl;
    };
    layers: SerializedCompositionLayer[];
}