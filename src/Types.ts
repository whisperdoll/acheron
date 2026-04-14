import { v4 as uuidv4 } from "uuid";
import {
  getControlFromInheritParts,
  getInheritParts,
  noteArray,
} from "./utils/elysiumutils";
import { AppState, LayerState } from "./state/AppState";
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

export type Direction = 0 | 1 | 2 | 3 | 4 | 5;

export type StartCallback<StoreType extends TokenStore = TokenStore> = (
  store: StoreType,
  helpers: Record<string, Function>,
) => any;
export type StopCallback<StoreType extends TokenStore = TokenStore> = (
  store: StoreType,
  helpers: Record<string, Function>,
) => any;
export type TickCallback<StoreType extends TokenStore = TokenStore> = (
  store: StoreType,
  helpers: Record<string, Function>,
  playheads: Omit<Playhead, "store">[],
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

export interface ControlDefinition<
  T extends ControlDataType = ControlDataType,
> {
  label?: string;
  type?: T;
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
  id: string;
  key: string;
  definition: ControlDefinition<T>; // convenience
}

export type ShallowControlState<T extends ControlDataType = ControlDataType> =
  Pick<ControlState<T>, "key" | "definition">;

export function copyControl(control: ControlState): ControlState {
  const ret = {
    ...control,
    id: uuidv4(),
  };

  return ret;
}

export function coerceControlValueFromNumber<
  T extends ControlDataType = ControlDataType,
>(value: number, control: ControlState<T>): TypeForControlDataType<T> {
  return (() => {
    switch (control.definition.type) {
      case "bool":
        return Boolean(value);
      case "decimal":
        return +value;
      case "direction":
        return Math.floor(+value) % 6;
      case "int":
        return Math.floor(+value);
      case "select":
        return control.definition.options![
          Math.floor(+value) % control.definition.options!.length
        ].value;
      case "triad":
        return Math.floor(+value) % 7;
      default:
        throw "no control type..?";
    }
  })() as TypeForControlDataType<T>;
}

export function coerceControlValueToNumber<
  T extends ControlDataType = ControlDataType,
>(
  value: TypeForControlDataType<ControlDataType>,
  control: ShallowControlState<T>,
): number {
  if (control.definition.type === "select") {
    return control.definition.options!.findIndex((o) => o.value === value);
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

export interface Token<
  StoreType extends TokenStore = TokenStore,
> extends TokenDefinition {
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

// export function findPropertyConnection(
//   modChainItemId: ModChainItemID,
//   property: LfoConnectableProperty
// ) {
//   Object.values(appStateStore.values.modChains).forEach((modChain) => {
//     modChain.connections.forEach((connection) => {
//       if (
//         connection.to === modChainItemId &&
//         connection.property === property
//       ) {
//         return connection;
//       }
//     });
//   });

//   return null;
// }

export function getLfoValue(
  lfo: Lfo,
  currentTime: { beat: number; ms: number },
  align: "beat" | "ms",
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

export type InheritedControlValueMod = {
  __type: "inheritedControlValue";
  inherit: string;
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
  | InheritedControlValueMod
  | FixedValueMod
  | FixedControlValueMod;
export type ModChain = {
  input: ControlInstanceId;
  mods: Record<ModChainItemID, ModChainItem>;
  output: ModChainItemID;
  connections: { from: ModChainItemID; to: ModChainItemID; property: string }[];
};
