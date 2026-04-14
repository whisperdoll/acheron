import { buildLayer } from "./Layers";
import { mapObject, mapToObject } from "./lib/utils";
import { AppState, buildControlLayers, LayerState } from "./state/AppState";
import { tokenDefinitionsMap } from "./Tokens";
import {
  ControlInstanceId,
  ControlState,
  Lfo,
  ModChain,
  ModChainItem,
  Token,
  TokenInstanceId,
  TokenUID,
} from "./Types";
import {
  buildFromDefs,
  LayerControlTypes,
  PlayerControlKey,
  PlayerControlKeys,
} from "./utils/DefaultDefinitions";
import { sliceObject } from "./utils/utils";

export type SerializedCompositionControl = ControlState;

export interface SerializedCompositionToken {
  id: TokenInstanceId;
  uid: TokenUID;
  controlIds: ControlInstanceId[];
}

export interface SerializedCompositionLayer {
  version: 3;
  name: ControlInstanceId;
  enabled: ControlInstanceId;
  midiChannel: ControlInstanceId;
  keyTonic: ControlInstanceId;
  keyMode: ControlInstanceId;
  transpose: ControlInstanceId;
  tempo: ControlInstanceId;
  barLength: ControlInstanceId;
  velocity: ControlInstanceId;
  emphasis: ControlInstanceId;
  tempoSync: ControlInstanceId;
  noteLength: ControlInstanceId;
  timeToLive: ControlInstanceId;
  pulseEvery: ControlInstanceId;
  tokenIds: TokenInstanceId[][];
}

type SerializedModChain = ModChain;

export interface SerializedComposition {
  version: 3;
  controls: SerializedCompositionControl[];
  tokens: SerializedCompositionToken[];
  global: Pick<AppState, PlayerControlKey>;
  layers: SerializedCompositionLayer[];
  modChains: Record<string, SerializedModChain>;
  gridRows: number;
  gridCols: number;
}

function buildTokenFromSerialized(
  serialized: SerializedCompositionToken,
): Token | null {
  const def = tokenDefinitionsMap[serialized.uid];

  if (!def) return null;

  const token: Token = {
    ...serialized,
    ...def,
    store: {},
  };

  return token;
}

function buildControlFromSerialized(
  serialized: SerializedCompositionControl,
): ControlState {
  return serialized;
}

function buildLayerFromSerialized(
  serialized: SerializedCompositionLayer,
): LayerState {
  return {
    ...serialized,
    currentBeat: 0,
    currentTimeMs: 0,
    midiBuffer: [],
    playheads: [],
    playingNotes: [],
  };
}

export function serializeComposition(
  appState: AppState,
): SerializedComposition {
  const tokenMap: SerializedCompositionToken[] = Object.entries(
    appState.tokens,
  ).map((e) => {
    const [tokenId, token] = e;

    return {
      id: tokenId,
      controlIds: token.controlIds,
      uid: token.uid,
    };
  });

  return {
    version: 3,
    tokens: tokenMap,
    global: sliceObject(appState, PlayerControlKeys),
    layers: appState.layers.map((layer) => {
      return {
        version: 3,
        ...sliceObject(layer, [...LayerControlTypes, "name", "tokenIds"]),
      };
    }),
    controls: Object.values(appState.controls),
    modChains: appState.modChains,
    gridCols: appState.gridCols,
    gridRows: appState.gridRows,
  };
}

export function deserializeComposition(
  appState: AppState,
  c: SerializedComposition,
): AppState {
  const newAppState: AppState = {
    ...appState,
    controls: mapToObject(c.controls, (value) => [value.id, value]),
    tokens: mapToObject(
      c.tokens.map(buildTokenFromSerialized).filter(Boolean) as Token[],
      (value) => [value.id, value],
    ),
    ...sliceObject(c.global, PlayerControlKeys),
    modChains: c.modChains,
    layers: c.layers.map(buildLayerFromSerialized),
    currentBeat: 0,
    currentTime: 0,
    gridRows: c.gridRows,
    gridCols: c.gridCols,
    editingLfo: null,
    isPlaying: false,
    midiNotes: [],
    performingNotes: [],
    pulseSwitch: false,
    selectedHex: { hexIndex: -1, layerIndex: 0 },
    hoveredHex: { hexIndex: -1, layerIndex: 0 },
  };

  newAppState.controlLayers = buildControlLayers(newAppState);

  return newAppState;
}
