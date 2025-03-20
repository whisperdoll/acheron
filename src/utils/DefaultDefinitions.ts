import {
  ControlState,
  ControlDefinition,
  Lfo,
  SelectOption,
  ControlDataType,
  TokenUID,
  TokenInstanceId,
} from "../Types";
import { v4 as uuidv4 } from "uuid";
import { getInheritParts } from "./elysiumutils";
import { NumMIDIChannels } from "../constants";

// ----------------------------------------------------------------
// PLAYER
// ----------------------------------------------------------------

export const PlayerControlKeys = [
  "key",
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

function major(root: number) {
  return [root, root + 2, root + 4, root + 5, root + 7, root + 9, root + 11].map((n) => n % 12);
}

function minor(root: number) {
  return [root, root + 2, root + 3, root + 5, root + 7, root + 8, root + 10].map((n) => n % 12);
}

export type PlayerControlKey = (typeof PlayerControlKeys)[number];

export const playerControlDefs: Record<PlayerControlKey, ControlDefinition> = {
  key: {
    label: "Key",
    type: "select",
    options: Object.keys({
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
    }).map((key) => ({
      label: key,
      value: key,
    })),
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

export const DefaultPlayerControls = buildFromDefs(playerControlDefs);

// ----------------------------------------------------------------
// LAYER
// ----------------------------------------------------------------

export const LayerControlTypes = [
  "enabled",
  "midiChannel",
  "key",
  "barLength",
  "emphasis",
  "tempo",
  "transpose",
  "velocity",
  "noteLength",
  "pulseEvery",
  "timeToLive",
  "tempoSync",
] as const;

export type LayerControlKey = (typeof LayerControlTypes)[number];

function layerControlDefs(): Record<LayerControlKey, ControlDefinition> {
  return {
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
    key: {
      inherit: "global.key",
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
}

export function DefaultLayerControls(): Record<TokenInstanceId, ControlState> {
  return buildFromDefs(layerControlDefs());
}

// ------------------------------

// ----------------------------------------------------------------

export function buildFromDefs<K extends string>(defs: Record<K, ControlDefinition>): Record<K, ControlState> {
  const parts: Record<string, ControlState> = {};

  function getDefaultValue(definition: ControlDefinition) {
    switch (definition.type) {
      case "bool":
        return definition.defaultValue ?? false;
      case "int":
      case "decimal":
      case "direction":
      case "triad":
        return definition.defaultValue ?? 0;
      case "select":
        if (!definition.options) {
          throw "select control without options :(";
        }

        const defaultOption = definition.options.find((o) => o.value === definition.defaultValue);
        if (defaultOption) {
          return defaultOption.value;
        } else {
          return definition.options[0].value;
        }
    }
  }

  function reportError(msg: string) {
    console.error("Error building token control:\n" + msg);
  }

  let _defaultLayerControls: Record<string, ControlState> | null = null;

  const defaultControls = {
    global: () => DefaultPlayerControls,
    layer: () => _defaultLayerControls || (_defaultLayerControls = DefaultLayerControls()),
  };

  for (const key in defs) {
    if (defs[key].inherit) {
      const inheritParts = getInheritParts(defs[key].inherit!);
      if (!inheritParts) {
        reportError("bad inherit key");
      } else {
        let inheritKey = inheritParts[1];
        let defaultControl = Object.entries(defaultControls[inheritParts[0]]()).find(
          (e) => e[1].key === inheritKey
        )![1];
        if (defaultControl === null) {
          reportError("bad");
        } else {
          const id = uuidv4();
          parts[id] = {
            label: defaultControl.label,
            type: defaultControl.type,
            min: defaultControl.min,
            max: defaultControl.max,
            step: defaultControl.step,
            options: defaultControl.options?.slice(0),
            inherit: defs[key].inherit,
            fixedValue: defaultControl.fixedValue,
            currentValueType: "inherit",
            lfo: buildLfo(defaultControl.type, defaultControl.min, defaultControl.max, defaultControl.options),
            id,
            key,
          };
        }
      }
    } else {
      const def = defs[key];

      if (def.label === undefined || def.type === undefined) {
        reportError("bad");
      } else {
        const id = uuidv4();
        parts[id] = {
          label: def.label,
          type: def.type,
          step: def.step,
          options: def.options?.slice(0),
          inherit: undefined,
          currentValueType: "fixed",
          fixedValue: getDefaultValue(defs[key]),
          lfo: buildLfo(def.type, def.min, def.max, def.options),
          id,
          key,
          ...getMinMaxForType(def.type, def.min, def.max, def.options),
          showIf: def.showIf,
        };
      }
    }
  }

  return Object.freeze(parts) as Record<K, ControlState>;
}

function getMinMaxForType(type: ControlDataType, n_min?: number, n_max?: number, options?: SelectOption[]) {
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

export function buildLfo(type: ControlDataType, n_min?: number, n_max?: number, options?: SelectOption[]) {
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
