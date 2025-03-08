import {
  SerializedComposition,
  SerializedCompositionLayer,
  SerializedCompositionToken,
} from "./Serialization";
import { AppSettings, TokenSettings } from "./state/AppSettings";
import { getTokenUIDFromPath } from "./Tokens";
import { KeyMap, NumMIDIChannels, TokenUID } from "./Types";
import {
  buildLfo,
  DefaultPlayerControls,
  LayerControlTypes,
  PlayerControlKeys,
} from "./utils/DefaultDefinitions";

interface LfoV1 {
  type:
    | "sine"
    | "square"
    | "random"
    | "sequence"
    | "sawtooth"
    | "reverse Sawtooth"
    | "midi Control";
  min: number;
  max: number;
  lowPeriod: number;
  hiPeriod: number;
  period: number;
  sequence: any[];
}

interface SerializedCompositionControlV1 {
  key: string;
  id: string;
  currentValueType: "fixed" | "modulate" | "inherit" | "multiply" | "add";
  inherit?: string;
  fixedValue: any;
  lfo: LfoV1;
}

interface SerializedCompositionTokenV1 {
  id: string;
  controls: SerializedCompositionControlV1[];
  path: string;
}

export interface SerializedCompositionTokenV2 {
  id: string;
  controls: SerializedCompositionControlV1[];
  uid: string;
}

interface SerializedCompositionLayerV1 {
  name: string;
  enabled: boolean;
  midiChannel: number;
  key: number;
  transpose: SerializedCompositionControlV1;
  tempo: SerializedCompositionControlV1;
  barLength: SerializedCompositionControlV1;
  velocity: SerializedCompositionControlV1;
  emphasis: SerializedCompositionControlV1;
  tempoSync: boolean;
  noteLength: SerializedCompositionControlV1;
  timeToLive: SerializedCompositionControlV1;
  pulseEvery: SerializedCompositionControlV1;
  tokenIds: string[][];
}
const isSerializedCompositionLayerV1 = (
  value: SerializedCompositionLayerV1 | SerializedCompositionLayer
): value is SerializedCompositionLayerV1 =>
  (value as SerializedCompositionLayer).version !== 2;

interface SerializedCompositionV1 {
  version: number;
  tokens: SerializedCompositionTokenV1[];
  global: {
    key: number;
    transpose: SerializedCompositionControlV1;
    tempo: SerializedCompositionControlV1;
    tempoSync?: boolean;
    barLength: SerializedCompositionControlV1;
    velocity: SerializedCompositionControlV1;
    emphasis: SerializedCompositionControlV1;
    noteLength: SerializedCompositionControlV1;
    timeToLive: SerializedCompositionControlV1;
    pulseEvery: SerializedCompositionControlV1;
  };
  layers: SerializedCompositionLayerV1[];
}

export async function migrateSettings(
  settings: Record<string, any>
): Promise<AppSettings> {
  if (!settings.version) {
    const newTokens: Record<TokenUID, TokenSettings> = {};

    for (const [tokenPath, tokenSettings] of Object.entries(
      settings.tokens as Record<TokenUID, TokenSettings>
    )) {
      const uid = await getTokenUIDFromPath(tokenPath);

      if (uid !== null) {
        newTokens[uid] = {
          shortcut: tokenSettings.shortcut ?? "",
          enabled: true,
        };
      }
    }

    return {
      confirmDelete: settings.confirmDelete,
      playNoteOnClick: settings.playNoteOnClick,
      tokens: newTokens,
      version: 1,
      wrapPlayheads: settings.wrapPlayheads,
      isFirstRun: true,
      midiInputs: [],
      midiOutputs: [],
    };
  }

  return settings as AppSettings;
}

async function migrateSerializedToken(
  serialized: SerializedCompositionTokenV1 | SerializedCompositionToken
): Promise<SerializedCompositionToken | null> {
  if (Object.prototype.hasOwnProperty.call(serialized, "path")) {
    serialized = serialized as SerializedCompositionTokenV1;
    const uid = await getTokenUIDFromPath(serialized.path);
    if (uid === null) return null;
    return {
      controls: serialized.controls,
      id: serialized.id,
      uid: uid,
    };
  }

  return serialized as SerializedCompositionToken;
}

function migrateSerializedLayer(
  global: SerializedComposition["global"] | SerializedCompositionV1["global"],
  serialized: SerializedCompositionLayerV1 | SerializedCompositionLayer
): SerializedCompositionLayer {
  if (isSerializedCompositionLayerV1(serialized)) {
    // v1 //
    let ret: SerializedCompositionLayer = {
      ...serialized,
      version: 2,
      enabled: {
        id: "",
        currentValueType: "fixed",
        key: "enabled",
        lfo: buildLfo("bool"),
        fixedValue: serialized.enabled,
      },
      midiChannel: {
        id: "",
        currentValueType: "fixed",
        key: "midiChannel",
        lfo: buildLfo("int", 1, NumMIDIChannels),
        fixedValue: serialized.midiChannel,
      },
      key: {
        id: "",
        currentValueType: "fixed",
        key: "key",
        lfo: buildLfo(
          "select",
          undefined,
          undefined,
          Object.keys(KeyMap).map((key) => ({ label: key, value: key }))
        ),
        fixedValue: Object.keys(KeyMap)[serialized.key],
      },
      tempoSync: {
        id: "",
        currentValueType: "fixed",
        key: "tempoSync",
        lfo: buildLfo("bool"),
        fixedValue: serialized.tempoSync,
      },
    };

    // ensure inherits are correct
    PlayerControlKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(ret, key)) {
        ret[key].inherit = "global." + key;
      }
    });

    return ret;
  } else {
    if (typeof serialized.tempoSync === "boolean") {
      serialized = {
        ...(serialized as SerializedCompositionLayer),
        tempoSync: {
          id: "",
          currentValueType: "fixed",
          key: "tempoSync",
          lfo: buildLfo("bool"),
          fixedValue: (serialized as SerializedCompositionLayer).tempoSync,
        },
      };
    }

    return serialized as SerializedCompositionLayer;
  }
}

export async function migrateSerializedComposition(
  serialized: SerializedCompositionV1 | SerializedComposition
): Promise<SerializedComposition | null> {
  function inheritFor(ret: SerializedComposition, id: string): string {
    // check global //
    let candidate = PlayerControlKeys.findIndex(
      (key) => ret.global[key].id === id
    );
    if (candidate !== -1) {
      return "global." + ret.global[PlayerControlKeys[candidate]].key;
    }

    // check layers //
    for (let i = 0; i < ret.layers.length; i++) {
      candidate = LayerControlTypes.findIndex(
        (key) => ret.layers[i][key].id === id
      );
      if (candidate !== -1) {
        return "layer." + ret.layers[i][LayerControlTypes[candidate]].key;
      }
    }

    return id; // TODO: error
  }

  const migratedGlobal: SerializedComposition["global"] = {
    ...serialized.global,
    key:
      typeof serialized.global.key === "number"
        ? {
            id: "",
            currentValueType: "fixed",
            key: "tempoSync",
            lfo: buildLfo(
              "select",
              undefined,
              undefined,
              DefaultPlayerControls.key.options
            ),
            fixedValue: serialized.global.key,
          }
        : serialized.global.key,
    tempoSync:
      typeof serialized.global.tempoSync !== "object"
        ? {
            id: "",
            currentValueType: "fixed",
            key: "tempoSync",
            lfo: buildLfo("bool"),
            fixedValue: serialized.global.tempoSync,
          }
        : serialized.global.tempoSync,
  };

  const tokens: SerializedCompositionToken[] = [];

  for (const token of serialized.tokens) {
    const migrated = await migrateSerializedToken(token);
    if (migrated) {
      tokens.push(migrated);
    }
  }

  let ret = {
    version: 2,
    global: migratedGlobal,
    layers: serialized.layers.map((l) =>
      migrateSerializedLayer(migratedGlobal, l)
    ),
    tokens,
  };

  ret = {
    ...ret,
    tokens: ret.tokens.map((t) => ({
      ...t,
      controls: t.controls.map((c) => ({
        ...c,
        inherit: c.inherit
          ? c.inherit.includes(".")
            ? c.inherit
            : inheritFor(ret, c.inherit)
          : undefined,
      })),
    })),
  };

  return ret;
}
