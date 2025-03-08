import seedRandom from "seedrandom";
import { v4 as uuidv4 } from "uuid";
import {
  getControlFromInheritParts,
  getInheritParts,
  noteArray,
} from "./utils/elysiumutils";
import { AppState } from "./state/AppState";

export type TokenStore = Record<string, any>;

export type ControlValueType =
  | "fixed"
  | "modulate"
  | "inherit"
  | "multiply"
  | "add";

export const NumMIDIChannels = 16;

export type TokenUID = string;
export type TokenInstanceId = string;
export type ControlInstanceId = string;

function major(root: number) {
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

function minor(root: number) {
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

export const KeyMap = {
  None: noteArray.map((n, i) => i),
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
  "G sharp minor": minor(noteArray.indexOf("G#")),
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
  currentValueType: "fixed" | "modulate" | "inherit" | "multiply" | "add";
  lfo: Lfo;
  control?: number;
}

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
        return Math.round(+value) % 6;
      case "int":
        return Math.round(+value);
      case "select":
        return control.options![Math.round(+value) % control.options!.length]
          .value;
      case "triad":
        return Math.round(+value) % 7;
      default:
        throw "no control type..?";
    }
  })() as TypeForControlDataType<T>;
}

export function coerceControlValueToNumber<
  T extends ControlDataType = ControlDataType
>(
  value: TypeForControlDataType<ControlDataType>,
  control: ControlState<T>
): number {
  if (control.type === "select") {
    return control.options!.findIndex((o) => o.value === value);
  } else {
    return +value;
  }
}

export function getControlValue<T extends ControlDataType = ControlDataType>(
  appState: AppState,
  layerIndex: number,
  controlState: ControlState<T>
): TypeForControlDataType<T> {
  if (controlState.inherit) {
    const inheritParts = getInheritParts(controlState.inherit);
    if (!inheritParts) {
      console.error("inherit failed", { controlState, appState });
      throw "inherit fail";
    }

    const inheritedControl = getControlFromInheritParts(
      appState,
      layerIndex,
      inheritParts
    );
    let inheritedValue = coerceControlValueToNumber(
      getControlValue(appState, layerIndex, inheritedControl),
      inheritedControl
    );
    if (controlState.currentValueType === "add") {
      inheritedValue += coerceControlValueToNumber(
        controlState.fixedValue,
        controlState
      );
    } else if (controlState.currentValueType === "multiply") {
      inheritedValue *= coerceControlValueToNumber(
        controlState.fixedValue,
        controlState
      );
    }
    return coerceControlValueFromNumber(
      Math.max(Math.min(+inheritedValue, controlState.max), controlState.min),
      controlState
    );
  } else if (controlState.currentValueType === "modulate") {
    const value = getLfoValue(appState, layerIndex, controlState.lfo);
    return coerceControlValueFromNumber(value, controlState);
  } else if (controlState.currentValueType === "fixed") {
    return controlState.fixedValue;
  } else {
    console.error("invalid control value type", controlState, appState);
    throw "invalid control value type";
  }
}

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

export interface Lfo {
  type: LfoType;
  min: number;
  max: number;
  lowPeriod: number;
  hiPeriod: number;
  period: number;
  sequence: number[];
}

function getLfoValue(appState: AppState, layerIndex: number, lfo: Lfo): number {
  const tempoControl = appState.controls[appState.tempo];
  const bpms =
    lfo === tempoControl.lfo
      ? 1
      : (60 /
          getControlValue(
            appState,
            layerIndex,
            tempoControl as ControlState<"int">
          )) *
        1000;
  const now = Math.floor(Date.now() / bpms) * bpms;
  const lowPeriod = lfo.lowPeriod * 1000;
  const hiPeriod = lfo.hiPeriod * 1000;
  const period = lfo.period * 1000;
  const t = now % (lfo.type === "square" ? lowPeriod + hiPeriod : period);

  switch (lfo.type) {
    case "random": {
      return (
        lfo.min +
        seedRandom((Math.floor(now / period) * period).toString())() *
          (lfo.max - lfo.min)
      );
    }
    case "sawtooth": {
      return lfo.min + (t / period) * (lfo.max - lfo.min);
    }
    case "reverse Sawtooth": {
      return lfo.max - (t / period) * (lfo.max - lfo.min);
    }
    case "triangle": {
      const amp = (lfo.max - lfo.min) / 2;
      return (
        (0 <= t && t <= period / 2
          ? amp - ((4 * amp) / period) * Math.abs(t - period / 4)
          : period / 2 < t && t <= period
          ? ((4 * amp) / period) * Math.abs(t - (3 * period) / 4) - amp
          : 0) +
        amp * 2
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
  notes: string[];
  type: "beat" | "ms";
  outputNames: string[];
  channel: number;
}
