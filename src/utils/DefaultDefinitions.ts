import {
  ControlState,
  ControlDefinition,
  Lfo,
  SelectOption,
  ControlDataType,
  TokenUID,
  TokenInstanceId,
  ModChain,
  FixedControlValueMod,
  coerceControlValueToNumber,
} from "../Types";
import { v4 as uuidv4 } from "uuid";
import { getInheritParts } from "./elysiumutils";
import { NumMIDIChannels } from "../constants";
import { modes } from "./scales";
import { AppState } from "../state/AppState";

// ----------------------------------------------------------------
// PLAYER
// ----------------------------------------------------------------

export const PlayerControlKeys = [
  "keyTonic",
  "keyMode",
  "transpose",
  "barLength",
  "tempo",
  "velocity",
  "emphasis",
  "tempoSync",
  "noteLength",
  "timeToLive",
  "pulseEvery",
] as const satisfies string[];

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

export type PlayerControlKey = (typeof PlayerControlKeys)[number];

const keyModeOptions = Object.keys(modes).map((mode) => ({
  label: mode,
  value: mode,
}));
export const playerControlDefs: Record<PlayerControlKey, ControlDefinition> = {
  keyTonic: {
    label: "Key",
    type: "select",
    options: ["None", ...noteArray].map((note) => ({
      label: note,
      value: note,
    })),
    defaultValue: "None",
  },
  keyMode: {
    label: "Mode",
    type: "select",
    options: keyModeOptions,
    defaultValue: keyModeOptions[0].value,
  },
  transpose: {
    label: "Transpose",
    type: "int",
    min: -36,
    max: 36,
    defaultValue: 0,
  },
  barLength: {
    label: "Bar Length",
    type: "int",
    min: 1,
    max: 128,
    defaultValue: 4,
  },
  tempo: {
    label: "Tempo",
    type: "decimal",
    min: 1,
    max: 960,
    defaultValue: 120,
  },
  velocity: {
    label: "Velocity",
    type: "int",
    min: 0,
    max: 127,
    defaultValue: 90,
  },
  emphasis: {
    label: "Emphasis",
    type: "int",
    min: 1,
    max: 127,
    defaultValue: 120,
  },
  tempoSync: {
    label: "Tempo Sync",
    type: "bool",
    defaultValue: true,
  },
  noteLength: {
    label: "Note Length",
    type: "decimal",
    min: 0.1,
    max: 10,
    defaultValue: 0.5,
    step: 0.1,
  },
  timeToLive: {
    label: "Time to Live",
    type: "int",
    min: 1,
    max: 256,
    defaultValue: 16,
  },
  pulseEvery: {
    label: "Pulse Every",
    type: "int",
    min: 1,
    max: 256,
    defaultValue: 16,
  },
};

// ----------------------------------------------------------------
// LAYER
// ----------------------------------------------------------------

export const LayerControlTypes = [
  "enabled",
  "midiChannel",
  "keyTonic",
  "keyMode",
  "barLength",
  "emphasis",
  "tempo",
  "transpose",
  "velocity",
  "noteLength",
  "pulseEvery",
  "timeToLive",
  "tempoSync",
] as const satisfies string[];

export type LayerControlKey = (typeof LayerControlTypes)[number];

export const layerControlDefs: Record<LayerControlKey, ControlDefinition> = {
  enabled: {
    label: "Enabled",
    type: "bool",
    defaultValue: true,
  },
  midiChannel: {
    label: "MIDI Channel",
    type: "int",
    min: 1,
    max: NumMIDIChannels,
    step: 1,
    defaultValue: 1,
  },
  keyTonic: {
    inherit: "global.keyTonic",
  },
  keyMode: {
    inherit: "global.keyMode",
  },
  barLength: {
    inherit: "global.barLength",
  },
  emphasis: {
    inherit: "global.emphasis",
  },
  tempo: {
    inherit: "global.tempo",
  },
  transpose: {
    inherit: "global.transpose",
  },
  velocity: {
    inherit: "global.velocity",
  },
  tempoSync: {
    inherit: "global.tempoSync",
  },
  noteLength: {
    inherit: "global.noteLength",
  },
  pulseEvery: {
    inherit: "global.pulseEvery",
  },
  timeToLive: {
    inherit: "global.timeToLive",
  },
};

// ------------------------------

// ----------------------------------------------------------------

export function buildFromDefs<K extends string>(
  defs: Record<K, ControlDefinition>,
): [Record<K, ControlState>, Record<K, ModChain>] {
  const parts: Record<string, ControlState> = {};
  const modChains = {} as Record<string, ModChain>;

  function reportError(msg: string) {
    console.error("Error building token control:\n" + msg);
  }

  for (const key in defs) {
    const controlDef = defs[key];
    let parentDef = controlDef;

    const id = uuidv4();
    const modId = uuidv4();

    modChains[id] = {
      connections: [],
      input: id,
      mods: {
        [modId]: {
          __type: "fixedControlValue",
          controlId: id,
          value: 0,
        },
      },
      output: modId,
    };

    if (controlDef.inherit) {
      const inheritParts = getInheritParts(controlDef.inherit!);
      if (!inheritParts) {
        reportError("bad inherit key");
        continue;
      }

      const [inheritSourceKey, inheritKey] = inheritParts;
      parentDef =
        inheritKey in playerControlDefs
          ? playerControlDefs[inheritKey as keyof typeof playerControlDefs]
          : layerControlDefs[inheritKey];

      const inheritModId = uuidv4();
      modChains[id].mods[inheritModId] = {
        __type: "inheritedControlValue",
        inherit: controlDef.inherit!,
      };
      modChains[id].output = inheritModId;
    }

    (modChains[id].mods[modId] as FixedControlValueMod).value =
      coerceControlValueToNumber(parentDef.defaultValue, {
        key,
        definition: parentDef,
      });

    const control: ControlState = {
      id,
      key,
      definition: { ...parentDef, ...controlDef },
    };
    parts[id] = control;
  }

  return [
    Object.freeze(parts) as Record<K, ControlState>,
    Object.freeze(modChains) as Record<K, ModChain>,
  ];
}

function getMinMaxForType(
  type: ControlDataType,
  n_min?: number,
  n_max?: number,
  options?: SelectOption[],
) {
  let max: number, min: number;

  switch (type) {
    case "bool":
      max = 1;
      min = 0;
      break;
    case "decimal":
    case "int":
      max = n_max ?? 16;
      min = n_min ?? 0;
      break;
    case "direction":
      max = 5;
      min = 0;
      break;
    case "triad":
      max = 6;
      min = 0;
      break;
    case "select":
      max = options!.length - 1;
      min = 0;
      break;
  }

  return { min, max };
}

export function buildLfo(
  type: ControlDataType,
  n_min?: number,
  n_max?: number,
  options?: SelectOption[],
) {
  const { min, max } = getMinMaxForType(type, n_min, n_max, options);

  // add an extra 1 for ints cuz 0-5 is actually 6 items
  const lfo: Lfo = {
    period: max - min + +(type !== "decimal"),
    hiPeriod: 1,
    lowPeriod: 1,
    max: max + +(type !== "decimal"),
    min,
    sequence: [],
    type: "sawtooth",
  };

  return lfo;
}
