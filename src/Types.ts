import { v4 as uuidv4 } from "uuid";
import {
  getControlFromInheritParts,
  getInheritParts,
  noteArray,
} from "./utils/elysiumutils";
import appStateStore, {
  AppState,
  AppStateStore,
  LayerState,
} from "./state/AppState";
import { sliceObject } from "./utils/utils";
import { PlayerControlKey } from "./utils/DefaultDefinitions";
import { randomFloat } from "./lib/utils";
import * as WebMidi from "webmidi";
import Midi from "./utils/midi";

type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

declare global {
  interface ObjectConstructor {
    entries<T extends object>(o: T): Entries<T>;
    keys<T extends object>(o: T): (keyof T)[];
  }
}

export interface WebMidiInput extends WebMidi.Input {
  type: "input";
}

export interface WebMidiOutput extends WebMidi.Output {
  type: "output";
}

export interface WebMidiPortEvent extends WebMidi.Event {
  port: WebMidiInput | WebMidiOutput;
}

export type TokenStore = Record<string, any>;

export type ControlValueType =
  | "fixed"
  | "modulate"
  | "inherit"
  | "multiply"
  | "add"
  | "midi_cc";

export type TokenUID = string;
export type TokenInstanceId = string;
export type ControlInstanceId = string;

export function major(root: number) {
  return [
    root,
    root + 2,
    root + 4,
    root + 5,
    root + 7,
    root + 9,
    root + 11,
  ].map((n) => n % 12);
}

export function harmmajor(root: number) {
  return [
    root,
    root + 2,
    root + 4,
    root + 5,
    root + 7,
    root + 8,
    root + 11,
  ].map((n) => n % 12);
}

export function minor(root: number) {
  return [
    root,
    root + 2,
    root + 3,
    root + 5,
    root + 7,
    root + 8,
    root + 10,
  ].map((n) => n % 12);
}

export function harmminor(root: number) {
  return [
    root,
    root + 2,
    root + 3,
    root + 5,
    root + 7,
    root + 8,
    root + 11,
  ].map((n) => n % 12);
}

export function melominor(root: number) {
  return [
    root,
    root + 2,
    root + 3,
    root + 5,
    root + 7,
    root + 9,
    root + 11,
  ].map((n) => n % 12);
}

export function doubleharmonicminor(root: number) {
  return [
    root,
    root + 2,
    root + 3,
    root + 6,
    root + 7,
    root + 8,
    root + 11,
  ].map((n) => n % 12);
}

export function doubleharmonicmajor(root: number) {
  return [
    root,
    root + 1,
    root + 4,
    root + 5,
    root + 7,
    root + 8,
    root + 11,
  ].map((n) => n % 12);
}

export function enigmatic(root: number) {
  return [
    root,
    root + 1,
    root + 4,
    root + 6,
    root + 8,
    root + 10,
    root + 11,
  ].map((n) => n % 12);
}

export function neapolitanmajor(root: number) {
  return [
    root,
    root + 1,
    root + 3,
    root + 5,
    root + 7,
    root + 9,
    root + 11,
  ].map((n) => n % 12);
}

export function neapolitanminor(root: number) {
  return [
    root,
    root + 1,
    root + 3,
    root + 5,
    root + 7,
    root + 8,
    root + 11,
  ].map((n) => n % 12);
}


export const KeyMap = {
  "None": noteArray.map((n, i) => i),
  "A Major": major(noteArray.indexOf("A")),
  "A# Major": major(noteArray.indexOf("A#")),
  "B Major": major(noteArray.indexOf("B")),
  "C Major": major(noteArray.indexOf("C")),
  "C# Major": major(noteArray.indexOf("C#")),
  "D Major": major(noteArray.indexOf("D")),
  "D# Major": major(noteArray.indexOf("D#")),
  "E Major": major(noteArray.indexOf("E")),
  "F Major": major(noteArray.indexOf("F")),
  "F# Major": major(noteArray.indexOf("F#")),
  "G Major": major(noteArray.indexOf("G")),
  "G# Major": major(noteArray.indexOf("G#")),
  "A Minor": minor(noteArray.indexOf("A")),
  "A# Minor": minor(noteArray.indexOf("A#")),
  "B Minor": minor(noteArray.indexOf("B")),
  "C Minor": minor(noteArray.indexOf("C")),
  "C# Minor": minor(noteArray.indexOf("C#")),
  "D Minor": minor(noteArray.indexOf("D")),
  "D# Minor": minor(noteArray.indexOf("D#")),
  "E Minor": minor(noteArray.indexOf("E")),
  "F Minor": minor(noteArray.indexOf("F")),
  "F# Minor": minor(noteArray.indexOf("F#")),
  "G Minor": minor(noteArray.indexOf("G")),
  "G# Minor": minor(noteArray.indexOf("G#")),
  "A Harmonic Minor": harmminor(noteArray.indexOf("A")),
  "A# Harmonic Minor": harmminor(noteArray.indexOf("A#")),
  "B Harmonic Minor": harmminor(noteArray.indexOf("B")),
  "C Harmonic Minor": harmminor(noteArray.indexOf("C")),
  "C# Harmonic Minor": harmminor(noteArray.indexOf("C#")),
  "D Harmonic Minor": harmminor(noteArray.indexOf("D")),
  "D# Harmonic Minor": harmminor(noteArray.indexOf("D#")),
  "E Harmonic Minor": harmminor(noteArray.indexOf("E")),
  "F Harmonic Minor": harmminor(noteArray.indexOf("F")),
  "F# Harmonic Minor": harmminor(noteArray.indexOf("F#")),
  "G Harmonic Minor": harmminor(noteArray.indexOf("G")),
  "G# Harmonic Minor": harmminor(noteArray.indexOf("G#")),
  "A Harmonic Major": harmmajor(noteArray.indexOf("A")),
  "A# Harmonic Major": harmmajor(noteArray.indexOf("A#")),
  "B Harmonic Major": harmmajor(noteArray.indexOf("B")),
  "C Harmonic Major": harmmajor(noteArray.indexOf("C")),
  "C# Harmonic Major": harmmajor(noteArray.indexOf("C#")),
  "D Harmonic Major": harmmajor(noteArray.indexOf("D")),
  "D# Harmonic Major": harmmajor(noteArray.indexOf("D#")),
  "E Harmonic Major": harmmajor(noteArray.indexOf("E")),
  "F Harmonic Major": harmmajor(noteArray.indexOf("F")),
  "F# Harmonic Major": harmmajor(noteArray.indexOf("F#")),
  "G Harmonic Major": harmmajor(noteArray.indexOf("G")),
  "G# Harmonic Major": harmmajor(noteArray.indexOf("G#")),
  "A Neapolitan Major": neapolitanmajor(noteArray.indexOf("A")),
  "A# Neapolitan Major": neapolitanmajor(noteArray.indexOf("A#")),
  "B Neapolitan Major": neapolitanmajor(noteArray.indexOf("B")),
  "C Neapolitan Major": neapolitanmajor(noteArray.indexOf("C")),
  "C# Neapolitan Major": neapolitanmajor(noteArray.indexOf("C#")),
  "D Neapolitan Major": neapolitanmajor(noteArray.indexOf("D")),
  "D# Neapolitan Major": neapolitanmajor(noteArray.indexOf("D#")),
  "E Neapolitan Major": neapolitanmajor(noteArray.indexOf("E")),
  "F Neapolitan Major": neapolitanmajor(noteArray.indexOf("F")),
  "F# Neapolitan Major": neapolitanmajor(noteArray.indexOf("F#")),
  "G Neapolitan Major": neapolitanmajor(noteArray.indexOf("G")),
  "G# Neapolitan Major": neapolitanmajor(noteArray.indexOf("G#")),
  "A Neapolitan Minor": neapolitanminor(noteArray.indexOf("A")),
  "A# Neapolitan Minor": neapolitanminor(noteArray.indexOf("A#")),
  "B Neapolitan Minor": neapolitanminor(noteArray.indexOf("B")),
  "C Neapolitan Minor": neapolitanminor(noteArray.indexOf("C")),
  "C# Neapolitan Minor": neapolitanminor(noteArray.indexOf("C#")),
  "D Neapolitan Minor": neapolitanminor(noteArray.indexOf("D")),
  "D# Neapolitan Minor": neapolitanminor(noteArray.indexOf("D#")),
  "E Neapolitan Minor": neapolitanminor(noteArray.indexOf("E")),
  "F Neapolitan Minor": neapolitanminor(noteArray.indexOf("F")),
  "F# Neapolitan Minor": neapolitanminor(noteArray.indexOf("F#")),
  "G Neapolitan Minor": neapolitanminor(noteArray.indexOf("G")),
  "G# Neapolitan Minor": neapolitanminor(noteArray.indexOf("G#")),
  "A Melodic Minor": melominor(noteArray.indexOf("A")),
  "A# Melodic Minor": melominor(noteArray.indexOf("A#")),
  "B Melodic Minor": melominor(noteArray.indexOf("B")),
  "C Melodic Minor": melominor(noteArray.indexOf("C")),
  "C# Melodic Minor": melominor(noteArray.indexOf("C#")),
  "D Melodic Minor": melominor(noteArray.indexOf("D")),
  "D# Melodic Minor": melominor(noteArray.indexOf("D#")),
  "E Melodic Minor": melominor(noteArray.indexOf("E")),
  "F Melodic Minor": melominor(noteArray.indexOf("F")),
  "F# Melodic Minor": melominor(noteArray.indexOf("F#")),
  "G Melodic Minor": melominor(noteArray.indexOf("G")),
  "G# Melodic Minor": melominor(noteArray.indexOf("G#")),
  "A Double Harmonic Minor": doubleharmonicminor(noteArray.indexOf("A")),
  "A# Double Harmonic Minor": doubleharmonicminor(noteArray.indexOf("A#")),
  "B Double Harmonic Minor": doubleharmonicminor(noteArray.indexOf("B")),
  "C Double Harmonic Minor": doubleharmonicminor(noteArray.indexOf("C")),
  "C# Double Harmonic Minor": doubleharmonicminor(noteArray.indexOf("C#")),
  "D Double Harmonic Minor": doubleharmonicminor(noteArray.indexOf("D")),
  "D# Double Harmonic Minor": doubleharmonicminor(noteArray.indexOf("D#")),
  "E Double Harmonic Minor": doubleharmonicminor(noteArray.indexOf("E")),
  "F Double Harmonic Minor": doubleharmonicminor(noteArray.indexOf("F")),
  "F# Double Harmonic Minor": doubleharmonicminor(noteArray.indexOf("F#")),
  "G Double Harmonic Minor": doubleharmonicminor(noteArray.indexOf("G")),
  "G# Double Harmonic Minor": doubleharmonicminor(noteArray.indexOf("G#")),
  "A Double Harmonic Major": doubleharmonicmajor(noteArray.indexOf("A")),
  "A# Double Harmonic Major": doubleharmonicmajor(noteArray.indexOf("A#")),
  "B Double Harmonic Major": doubleharmonicmajor(noteArray.indexOf("B")),
  "C Double Harmonic Major": doubleharmonicmajor(noteArray.indexOf("C")),
  "C# Double Harmonic Major": doubleharmonicmajor(noteArray.indexOf("C#")),
  "D Double Harmonic Major": doubleharmonicmajor(noteArray.indexOf("D")),
  "D# Double Harmonic Major": doubleharmonicmajor(noteArray.indexOf("D#")),
  "E Double Harmonic Major": doubleharmonicmajor(noteArray.indexOf("E")),
  "F Double Harmonic Major": doubleharmonicmajor(noteArray.indexOf("F")),
  "F# Double Harmonic Major": doubleharmonicmajor(noteArray.indexOf("F#")),
  "G Double Harmonic Major": doubleharmonicmajor(noteArray.indexOf("G")),
  "G# Double Harmonic Major": doubleharmonicmajor(noteArray.indexOf("G#")),
  "A Enigmatic": enigmatic(noteArray.indexOf("A")),
  "A# Enigmatic": enigmatic(noteArray.indexOf("A#")),
  "B Enigmatic": enigmatic(noteArray.indexOf("B")),
  "C Enigmatic": enigmatic(noteArray.indexOf("C")),
  "C# Enigmatic": enigmatic(noteArray.indexOf("C#")),
  "D Enigmatic": enigmatic(noteArray.indexOf("D")),
  "D# Enigmatic": enigmatic(noteArray.indexOf("D#")),
  "E Enigmatic": enigmatic(noteArray.indexOf("E")),
  "F Enigmatic": enigmatic(noteArray.indexOf("F")),
  "F# Enigmatic": enigmatic(noteArray.indexOf("F#")),
  "G Enigmatic": enigmatic(noteArray.indexOf("G")),
  "G# Enigmatic": enigmatic(noteArray.indexOf("G#")),
};

export const ScaleMap = {
  "None": "None",
  "Major": "Major",
  "Minor": "Minor",
  "Harmonic Major": "Harmonic Major",
  "Harmonic Minor": "Harmonic Minor",
  "Neapolitan Major": "Neapolitan Major",
  "Neapolitan Minor": "Neapolitan Minor",
  "Melodic Minor": "Melodic Minor",
  "Double Harmonic Major": "Double Harmonic Major",
  "Double Harmonic Minor": "Double Harmonic Minor",
  "Enigmatic": "Enigmatic",
};

export type Direction = 0 | 1 | 2 | 3 | 4 | 5;

export type StartCallback<StoreType extends TokenStore = TokenStore> = (
  store: StoreType,
  helpers: Record<string, Function>
) => any;
export type StopCallback<StoreType extends TokenStore = TokenStore> = (
  store: StoreType,
  helpers: Record<string, Function>
) => any;
export type TickCallback<StoreType extends TokenStore = TokenStore> = (
  store: StoreType,
  helpers: Record<string, Function>,
  playheads: Omit<Playhead, "store">[]
) => any;
export const ControlDataTypes = [
  "int",
  "decimal",
  "direction",
  "bool",
  "select",
  "triad",
] as const;
export type ControlDataType = (typeof ControlDataTypes)[number];
export type TypeForControlDataType<T extends ControlDataType> = T extends
  | "int"
  | "decimal"
  | "direction"
  | "triad"
  ? number
  : T extends "select"
  ? string
  : T extends "bool"
  ? boolean
  : never;

export interface SelectOption {
  label: string;
  value: string;
}

export interface Playhead {
  age: number;
  lifespan: number;
  direction: Direction;
  store: Record<TokenUID, Record<string, any>>;
}

export interface ControlDefinition {
  label?: string;
  type?: ControlDataType;
  min?: number;
  max?: number;
  step?: number;
  options?: SelectOption[];
  inherit?: string;
  showIf?: string;
  defaultValue?: any;
  control?: number;
}

export interface ControlState<T extends ControlDataType = ControlDataType> {
  label: string;
  type: T;
  id: string;
  key: string;
  min: number;
  max: number;
  step?: number;
  options?: SelectOption[];
  inherit?: string;
  showIf?: string;
  fixedValue: TypeForControlDataType<T>;
  currentValueType: ControlValueType;
  lfo: Lfo; // for currentValueType === 'modulate'
  // control?: number;
  midiCCNumber?: number; // for currentValueType === 'midi_cc'
}

export type ShallowControlState<T extends ControlDataType = ControlDataType> =
  Pick<
    ControlState<T>,
    "fixedValue" | "inherit" | "max" | "min" | "step" | "type" | "options"
  >;

export function copyControl(control: ControlState): ControlState {
  const ret = {
    ...control,
    id: uuidv4(),
    lfo: { ...control.lfo },
  };

  if (control.options) {
    ret.options = control.options.map((o) => ({ ...o }));
  }

  return ret;
}

export function coerceControlValueFromNumber<
  T extends ControlDataType = ControlDataType
>(value: number, control: ControlState<T>): TypeForControlDataType<T> {
  return (() => {
    switch (control.type) {
      case "bool":
        return Boolean(value);
      case "decimal":
        return +value;
      case "direction":
        return Math.floor(+value) % 6;
      case "int":
        return Math.floor(+value);
      case "select":
        return control.options![Math.floor(+value) % control.options!.length]
          .value;
      case "triad":
        return Math.floor(+value) % 7;
      default:
        throw "no control type..?";
    }
  })() as TypeForControlDataType<T>;
}

export function coerceControlValueToNumber<
  T extends ControlDataType = ControlDataType
>(
  value: TypeForControlDataType<ControlDataType>,
  control: ShallowControlState<T>
): number {
  if (control.type === "select") {
    return control.options!.findIndex((o) => o.value === value);
  } else {
    return +value;
  }
}

const inheritableTypes: ControlValueType[] = ["inherit", "add", "multiply"];

export interface TokenCallbacks<StoreType extends TokenStore = TokenStore> {
  onStart?: StartCallback<Partial<StoreType>>;
  onStop?: StopCallback<StoreType>;
  onTick?: TickCallback<StoreType>;
}

export interface Token<StoreType extends TokenStore = TokenStore>
  extends TokenDefinition {
  controlIds: string[];
  callbacks: TokenCallbacks;
  store: StoreType;
  id: string;
}

export interface TokenDefinition<StoreType extends TokenStore = TokenStore> {
  label: string;
  symbol: string;
  controls: Record<string, ControlDefinition>;
  callbacks: TokenCallbacks<StoreType>;
  uid: TokenUID;
}

export const LfoTypes = [
  "sine",
  "square",
  "triangle",
  "random",
  "sawtooth",
  "reverse Sawtooth",
  "sequence",
  "midi Control",
] as const;
export type LfoType = (typeof LfoTypes)[number];

export interface ModInputInfo {
  modChainId: string;
  modItemId: string;
}

export interface Lfo {
  type: LfoType;
  min: number;
  max: number;
  lowPeriod: number;
  hiPeriod: number;
  period: number;
  sequence: number[];
}
export type LfoConnectableProperty =
  | "min"
  | "max"
  | "lowPeriod"
  | "hiPeriod"
  | "period";

export function findPropertyConnection(
  modChainItemId: ModChainItemID,
  property: LfoConnectableProperty
) {
  Object.values(appStateStore.values.modChains).forEach((modChain) => {
    modChain.connections.forEach((connection) => {
      if (
        connection.to === modChainItemId &&
        connection.property === property
      ) {
        return connection;
      }
    });
  });

  return null;
}

export function getLfoValue(
  lfo: Lfo,
  currentTime: { beat: number; ms: number },
  align: "beat" | "ms"
): number {
  const now =
    align === "ms"
      ? currentTime.ms
      : Math.floor(currentTime.ms / currentTime.beat) * currentTime.ms;

  const lowPeriod = lfo.lowPeriod * 1000;
  const hiPeriod = lfo.hiPeriod * 1000;
  const period = lfo.period * 1000;
  const t = now % (lfo.type === "square" ? lowPeriod + hiPeriod : period);

  switch (lfo.type) {
    case "random": {
      return lfo.min + randomFloat() * (lfo.max - lfo.min);
    }
    case "sawtooth": {
      return lfo.min + (t / period) * (lfo.max - lfo.min);
    }
    case "reverse Sawtooth": {
      return lfo.max - (t / period) * (lfo.max - lfo.min);
    }
    case "triangle": {
      return (
        2 *
        (t / period <= 0.5
          ? lfo.min + (t / period) * (lfo.max - lfo.min)
          : lfo.max - (t / period) * (lfo.max - lfo.min))
      );
    }
    case "sine": {
      const amp = (lfo.max - lfo.min) / 2;
      return lfo.min + amp + amp * Math.sin((t / period) * Math.PI * 2);
    }
    case "square": {
      return t < lowPeriod ? lfo.min : lfo.max;
    }
    case "sequence": {
      return lfo.sequence[Math.floor((t / period) * lfo.sequence.length)] ?? 0;
    }
    default: {
      throw "lfo error";
    }
  }
}

export interface LayerNote {
  end: number;
  note: string;
  type: "beat" | "ms";
  channel: number;
  velocity: number;
  id?: string;
}

export interface PerformanceNote {
  note: string | null; // in case we're dragging off the grid temporarily
  layer: number;
  channel: number;
  velocity: number | null;
  identifier: Touch["identifier"];
  hexIndex: number;
  device: string | string[];
}

export const ModOutput = Symbol("mod output");

export type LFOMod = {
  __type: "lfo";
  type: LfoType;
  min: number;
  max: number;
  lowPeriod: number; // for square wave
  hiPeriod: number; // for square wave
  period: number;
  sequence: number[]; // for sequence ...
};

export type ControlValueMod = {
  __type: "controlValue";
  controlId: string;
};

export type FixedValueMod = {
  __type: "fixedValue";
  value: number;
};

export type FixedControlValueMod = {
  __type: "fixedControlValue";
  value: number;
  controlId: string;
};

type ModChainItemID = string;
export type ModChainItem =
  | LFOMod
  | ControlValueMod
  | FixedValueMod
  | FixedControlValueMod;
export type ModChain = {
  input: ControlInstanceId;
  mods: Record<ModChainItemID, ModChainItem>;
  output: null | ModChainItemID; // null will just connect input -> output
  connections: { from: ModChainItemID; to: ModChainItemID; property: string }[];
};

export function defaultModChain({
  controlId,
  controlValue,
}: {
  controlId: string;
  controlValue: number;
}): ModChain {
  const id = uuidv4();
  return {
    mods: {
      [id]: {
        __type: "fixedControlValue",
        controlId,
        value: controlValue,
      },
    },
    input: controlId,
    output: null,
    connections: [],
  };
}
