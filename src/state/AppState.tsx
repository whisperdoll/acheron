import StateStore from "./state.ts";
import App from "../App.tsx";
import React, { useReducer, FunctionComponent, useState } from "react";
import { getProperty } from "dot-prop";
import { objectWithoutKeys, sliceObject } from "../utils/utils.ts";
import { buildLayer } from "../Layers.ts";
import {
  ControlState,
  Token,
  Playhead,
  Lfo,
  TokenDefinition,
  TokenCallbacks,
  TokenUID,
  TokenInstanceId,
  ControlInstanceId,
  LayerNote,
  ControlDataType,
  TypeForControlDataType,
  PerformanceNote,
  ModChain,
  ModOutput,
  getLfoValue,
  coerceControlValueToNumber,
  LfoConnectableProperty,
  coerceControlValueFromNumber,
  ModChainItem,
  MathMod,
  LerpMod,
  MidiCcMod,
  SequenceMod,
} from "../Types.ts";
import {
  buildFromDefs,
  LayerControlKey,
  LayerControlTypes,
  playerControlDefs,
  PlayerControlKey,
  PlayerControlKeys,
} from "../utils/DefaultDefinitions.ts";
import Midi, { MidiDevice, MidiNote } from "../utils/midi.ts";
import { buildToken, copyToken, tokenDefinitions } from "../Tokens.ts";
import List from "../lib/list.ts";
import {
  resolveMaybeGenerated,
  MaybeGenerated,
  arrayWithoutIndexes,
  MaybeGeneratedPromise,
  mapObject,
  KeysOfUnion,
  roundMod,
  mod,
} from "../lib/utils.ts";
import appSettingsStore from "./AppSettings.ts";
import AbsorbToken from "../tokens/absorb.ts";
import Dict from "../lib/dict.ts";
import env from "../lib/env.ts";
import { getControlFromInheritParts, getInheritParts } from "../utils/elysiumutils.ts";
import { produce } from "immer";

export interface AppState {
  selectedHex: { hexIndex: number; layerIndex: number };
  hoveredHex: { hexIndex: number; layerIndex: number };
  controls: Record<ControlInstanceId, ControlState>;
  tokens: Record<TokenInstanceId, Token>;
  tokenDefinitions: Record<TokenUID, TokenDefinition>;
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
  layers: LayerState[];
  isPlaying: boolean;
  startTime: number;
  currentTime: number;
  allowedOutputs: MidiDevice[];
  allowedInputs: MidiDevice[];
  currentBeat: number;
  pulseSwitch: boolean;
  midiNotes: MidiNote[];
  editingLfo: { controlId: string } | null;
  draggingType: "move" | "copy";
  isDragging: boolean;
  draggingSourceHex: { layerIndex: number; hexIndex: number };
  draggingDestHex: { layerIndex: number; hexIndex: number };
  isShowingInspector: boolean;
  isShowingLeftColumn: boolean;
  leftColumnTab: "player" | "layer";
  isEditingLayerName: boolean;
  isShowingSettings: boolean;
  isShowingTouchModeMenu: boolean;
  isShowingGridSizeMenu: boolean;
  isMultiLayerMode: boolean;
  leftColumnWidth: number;
  inspectorWidth: number;
  modChainWorkspaceHeight: number;
  multiLayerSize: number;
  performingNotes: PerformanceNote[];
  gridRows: number;
  gridCols: number;
  gridStartingNote: string;
  modChainControl?: ControlInstanceId;
  modChains: Record<ControlInstanceId, ModChain>;
  controlLayers: Record<ControlInstanceId, number>; // convenience map control->layer
}

export interface LayerState {
  name: string;
  currentBeat: number;
  currentTimeMs: number;
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
  tokenIds: string[][]; // each hex has an array of tokens
  playheads: Playhead[][]; // each hex has an array of playheads
  midiBuffer: MidiNote[];
  playingNotes: LayerNote[]; // from tokens
}

export function buildControlLayers(appState: AppState): AppState["controlLayers"] {
  const controlLayers: Record<ControlInstanceId, number> = {};
  appState.layers.forEach((layer, layerIndex) => {
    layer.tokenIds.forEach((tokenIds) => {
      tokenIds.forEach((tokenId) => {
        const token = appState.tokens[tokenId];
        token.controlIds.forEach((controlId) => {
          controlLayers[controlId] = layerIndex;
        });
      });
    });

    Object.entries(sliceObject(layer, LayerControlTypes)).forEach(([key, controlId]) => {
      controlLayers[controlId] = layerIndex;
    });
  });

  return controlLayers;
}

const [initialPlayerControls, initialPlayerModChains] = buildFromDefs(playerControlDefs);

export const initialState: AppState = {
  selectedHex: { hexIndex: -1, layerIndex: 0 },
  hoveredHex: { hexIndex: -1, layerIndex: 0 },
  controls: { ...initialPlayerControls }, // appended to after layer contruction
  tokens: {},
  ...mapObject(initialPlayerControls, (k, v) => [v.key as PlayerControlKey, v.id]),
  controlLayers: {},
  layers: [], // appended to after layer contruction
  isPlaying: false,
  startTime: 0,
  currentTime: 0,
  allowedOutputs: [],
  allowedInputs: [],
  currentBeat: 0,
  pulseSwitch: false,
  midiNotes: [],
  editingLfo: null,
  tokenDefinitions: List.indexBy(tokenDefinitions, (token) => token.uid),
  draggingDestHex: { layerIndex: -1, hexIndex: -1 },
  draggingSourceHex: { layerIndex: -1, hexIndex: -1 },
  draggingType: "move",
  isDragging: false,
  isEditingLayerName: false,
  isMultiLayerMode: false,
  isShowingInspector: !env("debug"),
  isShowingLeftColumn: !env("debug"),
  isShowingSettings: false,
  isShowingTouchModeMenu: false,
  isShowingGridSizeMenu: false,
  leftColumnTab: "player",
  multiLayerSize: 2,
  inspectorWidth: 300,
  leftColumnWidth: 300,
  modChainWorkspaceHeight: 400,
  performingNotes: [],
  gridRows: 7,
  gridCols: 12,
  gridStartingNote: "D#7",
  modChains: {
    ...initialPlayerModChains,
  },
  modChainControl: undefined,
};

const initialLayer = buildLayer(initialState);

initialState.controls = { ...initialState.controls, ...initialLayer.controls };
initialState.layers = [initialLayer.layerState];
initialState.modChains = {
  ...initialState.modChains,
  ...initialLayer.modChains,
};
initialState.controlLayers = {
  ...initialState.controlLayers,
  ...mapObject(initialLayer.controls, (k, v) => [v.id, 0]),
};

type SetState = React.Dispatch<React.SetStateAction<AppState>>;
export const AppContext = React.createContext<{
  state: AppState;
  setState: SetState;
} | null>(null);

interface Props {}

export const AppContextProvider: FunctionComponent<Props> = (props) => {
  const [state, setState] = useState(initialState);

  return (
    <AppContext.Provider value={{ state, setState }}>
      <App />
    </AppContext.Provider>
  );
};

export function setLayer(
  setState: SetState,
  index: number | "current",
  layer: MaybeGenerated<LayerState, [LayerState]>,
) {
  setState((state) => ({
    ...state,
    layers: List.withIndexReplaced(
      state.layers,
      typeof index === "number" ? index : state.selectedHex.layerIndex,
      layer,
    ),
  }));
}

export function addTokenToHex(
  setState: SetState,
  tokenKey: TokenUID,
  opts: MaybeGenerated<{ hexIndex: number; layerIndex: number }, [AppState]>,
  why: string,
) {
  setState((state) => {
    const { tokenState, controls, modChains } = buildToken(state, tokenKey);
    const resolvedOpts = resolveMaybeGenerated(opts, state);

    return {
      ...state,
      tokens: {
        ...state.tokens,
        [tokenState.id]: tokenState,
      },
      controls: {
        ...state.controls,
        ...controls,
      },
      modChains: {
        ...state.modChains,
        ...modChains,
      },
      controlLayers: {
        ...state.controlLayers,
        ...mapObject(controls, (key, value) => [value.id, resolvedOpts.layerIndex]),
      },
      layers: List.withIndexReplaced(state.layers, resolvedOpts.layerIndex, (layer) => ({
        ...layer,
        tokenIds: List.withIndexReplaced(layer.tokenIds, resolvedOpts.hexIndex, (old) =>
          old.concat([tokenState.id]),
        ),
      })),
    };
  });
}

export function addTokenToSelected(setState: SetState, tokenKey: TokenUID, why: string) {
  addTokenToHex(
    setState,
    tokenKey,
    (state) => ({
      hexIndex: state.selectedHex.hexIndex,
      layerIndex: state.selectedHex.layerIndex,
    }),
    why,
  );
}

export function removeTokenFromHexStatic(
  state: AppState,
  tokenId: TokenInstanceId,
  opts: MaybeGenerated<{ hexIndex: number; layerIndex: number }, [AppState]>,
): AppState {
  const resolvedOpts = resolveMaybeGenerated(opts, state);

  return {
    ...state,
    tokens: objectWithoutKeys(state.tokens, [tokenId]),
    controls: objectWithoutKeys(state.controls, state.tokens[tokenId].controlIds),
    layers: List.withIndexReplaced(state.layers, resolvedOpts.layerIndex, (layer) => ({
      ...layer,
      tokenIds: List.withIndexReplaced(layer.tokenIds, resolvedOpts.hexIndex, (old) =>
        old.filter((id) => id !== tokenId),
      ),
    })),
  };
}

export function removeTokenFromHex(
  setState: SetState,
  tokenId: string,
  opts: MaybeGenerated<{ hexIndex: number; layerIndex: number }, [AppState]>,
  why: string,
) {
  setState((state) => {
    return removeTokenFromHexStatic(state, tokenId, opts);
  });
}

export function removeToken(setState: SetState, tokenId: string, why: string) {
  setState((state) => {
    let layerIndex, hexIndex;
    state.layers.forEach((layer, layerIndexCursor) => {
      layer.tokenIds.find((tokenIds, hexIndexCursor) => {
        if (tokenIds.includes(tokenId)) {
          hexIndex = hexIndexCursor;
          layerIndex = layerIndexCursor;
          return true;
        }
      });
    });

    if (layerIndex === undefined || hexIndex === undefined) {
      throw new Error("heh woops");
    }

    return removeTokenFromHexStatic(state, tokenId, {
      hexIndex,
      layerIndex,
    });
  });
}

export function togglePlaying(setState: SetState, why: string) {
  setState((state) => ({
    ...state,
    isPlaying: !state.isPlaying,
    layers: state.layers.map((layer) => ({
      ...layer,
      currentBeat: 0,
      currentTimeMs: 0,
      playheads: [],
    })),
    startTime: performance.now(),
  }));
}

export function addLayer(setState: SetState, select: boolean, why: string) {
  setState((state) => {
    const { layerState, controls, modChains } = buildLayer(state);

    return {
      ...state,
      layers: state.layers.concat([layerState]),
      selectedHex: select
        ? { ...state.selectedHex, layerIndex: state.layers.length }
        : state.selectedHex,
      controls: {
        ...state.controls,
        ...controls,
      },
      modChains: {
        ...state.modChains,
        ...modChains,
      },
      controlLayers: {
        ...state.controlLayers,
        ...mapObject(controls, (key, value) => [key, state.layers.length]),
      },
    };
  });
}

export function removeLayer(
  setState: SetState,
  index: MaybeGenerated<number, [AppState]>,
  why: string,
) {
  setState((state) => {
    const resolvedIndex = resolveMaybeGenerated(index, state);
    const tokensToRemove = state.layers[resolvedIndex].tokenIds.flat();
    const controlsToRemove = tokensToRemove.flatMap((tid) => state.tokens[tid].controlIds);

    return {
      ...state,
      layers: arrayWithoutIndexes(state.layers, resolvedIndex),
      tokens: objectWithoutKeys(state.tokens, tokensToRemove),
      controls: objectWithoutKeys(state.controls, controlsToRemove),
      selectedHex: {
        ...state.selectedHex,
        layerIndex: Math.min(state.layers.length - 2, resolvedIndex),
      },
    };
  });
}

export function pulse(setState: SetState, why: string) {
  setState((state) => ({ ...state, pulseSwitch: !state.pulseSwitch }));
}

export function editLfo(setState: SetState, controlId: string, why: string) {
  setState((state) => ({ ...state, editingLfo: { controlId } }));
}

export function stopEditingLfo(setState: SetState, why: string) {
  setState((state) => ({ ...state, editingLfo: null }));
}

export function copyHex(
  setState: SetState,
  opts: MaybeGenerated<
    {
      srcLayerIndex: number;
      srcHexIndex: number;
      destLayerIndex: number;
      destHexIndex: number;
    },
    [AppState]
  >,
  why: string,
) {
  setState((state) => {
    const resolvedOpts = resolveMaybeGenerated(opts, state);
    const tokensToCopy = state.layers[resolvedOpts.srcLayerIndex].tokenIds[
      resolvedOpts.srcHexIndex
    ].map((id) => state.tokens[id]);
    let newControls: Record<string, ControlState> = {};
    let newTokens: Record<string, Token> = {};
    let newModChains: Record<string, ModChain> = {};

    tokensToCopy.forEach((token) => {
      const { tokenState, controls, modChains } = copyToken(state, token);

      newControls = { ...newControls, ...controls };
      newTokens = { ...newTokens, [tokenState.id]: tokenState };
      newModChains = { ...newModChains, ...modChains };
    });

    return {
      ...state,
      controls: { ...state.controls, ...newControls },
      tokens: { ...state.tokens, ...newTokens },
      modChains: { ...state.modChains, ...newModChains },
      layers: List.withIndexReplaced(state.layers, resolvedOpts.destLayerIndex, (layer) => ({
        ...layer,
        tokenIds: List.withIndexReplaced(
          layer.tokenIds,
          resolvedOpts.destHexIndex,
          Object.keys(newTokens),
        ),
      })),
      controlLayers: {
        ...state.controlLayers,
        ...mapObject(newControls, (cid, control) => [cid, resolvedOpts.destLayerIndex]),
      },
    };
  });
}

export function moveHex(
  setState: SetState,
  opts: MaybeGenerated<
    {
      srcLayerIndex: number;
      srcHexIndex: number;
      destLayerIndex: number;
      destHexIndex: number;
    },
    [AppState]
  >,
  why: string,
) {
  setState((state) => {
    const resolvedOpts = resolveMaybeGenerated(opts, state);

    let layers = state.layers;

    // copy
    layers = List.withIndexReplaced(layers, resolvedOpts.destLayerIndex, (layer) => ({
      ...layer,
      tokenIds: List.withIndexReplaced(
        layer.tokenIds,
        resolvedOpts.destHexIndex,
        layers[resolvedOpts.srcLayerIndex].tokenIds[resolvedOpts.srcHexIndex].slice(0),
      ),
    }));

    // delete src
    layers = List.withIndexReplaced(layers, resolvedOpts.srcLayerIndex, (layer) => ({
      ...layer,
      tokenIds: List.withIndexReplaced(layer.tokenIds, resolvedOpts.srcHexIndex, []),
    }));

    return { ...state, layers };
  });
}

export function clearHex(
  setState: SetState,
  opts: MaybeGenerated<
    {
      layerIndex: number;
      hexIndex: number;
    },
    [AppState]
  >,
  why: string,
) {
  setState((state) => {
    const resolvedOpts = resolveMaybeGenerated(opts, state);

    const tokens = state.layers[resolvedOpts.layerIndex].tokenIds[resolvedOpts.hexIndex].map(
      (tid) => state.tokens[tid],
    );

    return {
      ...state,
      controls: objectWithoutKeys(
        state.controls,
        tokens.flatMap((t) => t.controlIds),
      ),
      tokens: objectWithoutKeys(
        state.tokens,
        tokens.map((t) => t.id),
      ),
      layers: List.withIndexReplaced(state.layers, resolvedOpts.layerIndex, (layer) => ({
        ...layer,
        tokenIds: List.withIndexReplaced(layer.tokenIds, resolvedOpts.hexIndex, []),
      })),
    };
  });
}

export function bufferMidi(
  setState: SetState,
  opts: MaybeGenerated<{ layerIndex: number; note: MidiNote }, [AppState]>,
  why: string,
) {
  setState((state) => {
    const resolvedOpts = resolveMaybeGenerated(opts, state);

    const buffer = state.layers[resolvedOpts.layerIndex].midiBuffer.slice(0);
    const index = buffer.findIndex((n) => n.number === resolvedOpts.note.number);
    if (index === -1) {
      buffer.push(resolvedOpts.note);
    } else {
      buffer[index] = resolvedOpts.note;
    }

    return {
      ...state,
      layers: List.withIndexReplaced(state.layers, resolvedOpts.layerIndex, (layer) => ({
        ...layer,
        midiBuffer: buffer,
      })),
    };
  });
}

export function debufferOffNotes(
  setState: SetState,
  opts: MaybeGenerated<{ layerIndex: number }, [AppState]>,
  why: string,
) {
  setState((state) => {
    const resolvedOpts = resolveMaybeGenerated(opts, state);

    return {
      ...state,
      layers: List.withIndexReplaced(state.layers, resolvedOpts.layerIndex, (layer) => ({
        ...layer,
        midiBuffer: layer.midiBuffer.filter((n) => n.isOn),
      })),
    };
  });
}

export function playerControls(state: AppState) {
  return sliceObject(state, PlayerControlKeys);
}

export function currentLayer(state: AppState): LayerState {
  return state.layers[state.selectedHex.layerIndex];
}

export function layerControl<T extends ControlDataType = ControlDataType>(
  state: AppState,
  control: LayerControlKey,
  layer: number | "current" = "current",
): ControlState<T> {
  return (
    layer === "current"
      ? (state.controls[currentLayer(state)[control]] as ControlState<T>)
      : state.controls[state.layers[layer][control]]
  ) as ControlState<T>;
}

export function playerControl<T extends ControlDataType = ControlDataType>(
  state: AppState,
  control: PlayerControlKey,
): ControlState<T> {
  return state.controls[state[control]] as ControlState<T>;
}

export function getControlLayer(
  state: AppState,
  controlId: ControlInstanceId,
): LayerState | null {
  const layerIndex = state.controlLayers[controlId];
  if (layerIndex === undefined) {
    return null;
  }

  return state.layers[layerIndex];
}

export function getControlType(state: AppState, controlId: ControlInstanceId) {
  const control = state.controls[controlId];
  if (control.definition.type) {
    return control.definition.type;
  }

  const inheritParts = getInheritParts(control.definition.inherit);
  if (!inheritParts) throw "something bad happened lol";

  // otherwise, it's inherited
  return getControlFromInheritParts(
    state.controls,
    playerControls(state),
    getControlLayer(state, controlId)!,
    inheritParts,
  ).definition.type!;
}

export function getControlValue<T extends ControlDataType = ControlDataType>(
  state: AppState,
  control:
    | ControlState<T>
    | string
    | {
        layerControl: LayerControlKey;
        layer: LayerState | number | "current";
      }
    | { playerControl: PlayerControlKey },
): TypeForControlDataType<T> {
  const resolveLayer = (layer: LayerState | number | "current" | undefined) => {
    return typeof layer === "number"
      ? state.layers[layer]
      : layer === "current" || layer === undefined
        ? state.layers[state.selectedHex.layerIndex]
        : layer;
  };

  const resolvedLayer =
    typeof control === "object" && "layer" in control
      ? resolveLayer(control.layer)
      : resolveLayer("current");

  const resolvedControl: ControlState<T> =
    typeof control === "string"
      ? (state.controls[control] as ControlState<T>)
      : "layerControl" in control
        ? (state.controls[resolvedLayer[control.layerControl]] as ControlState<T>)
        : "playerControl" in control
          ? (state.controls[playerControls(state)[control.playerControl]] as ControlState<T>)
          : control;

  return coerceControlValueFromNumber<T>(
    resolveModChain(state, resolvedControl.id),
    resolvedControl,
  );
}

export function resolveModItem(
  state: AppState,
  modChain: ModChain,
  modItemId: string,
  outputKey: string | null,
): number {
  const modItem = modChain.mods[modItemId];

  switch (modItem.__type) {
    case "controlValue":
      return coerceControlValueToNumber(
        getControlValue(state, state.controls[modItem.controlId]),
        state.controls[modItem.controlId],
      );
    case "inheritedControlValue":
      const inherit = modItem.inherit;
      const inheritParts = getInheritParts(inherit);
      if (!inheritParts) {
        throw "bad inherit parts";
      }
      const controlLayer = getControlLayer(state, modChain.input);
      if (!controlLayer) {
        throw "bad inherit situation (did you update control layer cache?)";
      }
      const control = getControlFromInheritParts(
        state.controls,
        playerControls(state),
        controlLayer,
        inheritParts,
      );
      return coerceControlValueToNumber(getControlValue(state, control), control);
    case "fixedControlValue":
      return modItem.value;
    case "fixedValue":
      return modItem.value;
    case "lfo":
      const props = { ...modItem } as Lfo;
      modChain.connections.forEach(({ from, to, toProperty, fromOutput }) => {
        if (to === modItemId) {
          props[toProperty as LfoConnectableProperty] = resolveModItem(
            state,
            modChain,
            from,
            fromOutput,
          );
        }
      });
      return getLfoValue(
        props,
        {
          beat: state.layers[0].currentBeat,
          ms: state.layers[0].currentTimeMs,
        },
        "ms",
      );
    case "math": {
      const value1 = resolveInputtableValue<MathMod>(
        state,
        modChain,
        modItemId,
        "value1",
        null,
      );
      const value2 = resolveInputtableValue<MathMod>(
        state,
        modChain,
        modItemId,
        "value2",
        null,
      );
      switch (modItem.operation) {
        case "*":
          return value1 * value2;
        case "**":
          return Math.pow(value1, value2);
        case "+":
          return value1 + value2;
        case "-":
          return value1 - value2;
        case "/":
          return value1 / value2;
        default:
          throw "unexpected math operation";
      }
    }
    case "lerp": {
      const value1 = resolveInputtableValue<LerpMod>(
        state,
        modChain,
        modItemId,
        "value1",
        null,
      );
      const value2 = resolveInputtableValue<LerpMod>(
        state,
        modChain,
        modItemId,
        "value2",
        null,
      );
      const interpol = resolveInputtableValue<LerpMod>(
        state,
        modChain,
        modItemId,
        "interpol",
        null,
      );
      return value1 + (value2 - value1) * interpol;
    }
    case "midiCc": {
      const controller = resolveInputtableValue<MidiCcMod>(
        state,
        modChain,
        modItemId,
        "controllerNumber",
        null,
      );
      return Midi.ccValue(roundMod(controller, 0, 128)) / 127;
    }
    case "sequence": {
      if (outputKey === "lengthOutput") {
        return modItem.values.length;
      }
      const rawIndexPc = resolveInputtableValue<SequenceMod>(
        state,
        modChain,
        modItemId,
        "indexPc",
        null,
      );
      let index;

      if (rawIndexPc === undefined) {
        index = mod(
          Math.floor(
            resolveInputtableValue<SequenceMod>(state, modChain, modItemId, "index", null),
          ),
          modItem.values.length,
        );
      } else {
        const indexPc = mod(rawIndexPc, 1);
        if (rawIndexPc === 1) {
          index = modItem.values.length - 1;
        } else {
          index = Math.floor(indexPc * modItem.values.length);
        }
      }

      const value = resolveInputtableValue(
        state,
        modChain,
        modItemId,
        `values.${index}`,
        null,
      );
      return value;
    }
  }
}

export function resolveInputtableValue<T = Record<string, unknown>>(
  state: AppState,
  modChain: ModChain,
  modChainItemId: string,
  property: KeysOfUnion<T>,
  outputKey: string | null,
): number {
  const connection = getIncomingModChainItemConnection(
    state,
    modChain,
    modChainItemId,
    property as string,
    outputKey,
  );

  if (!connection)
    return getProperty(modChain.mods[modChainItemId], property as string) as number;

  return resolveModItem(state, modChain, connection.from, connection.fromOutput);
}

export function getIncomingModChainItemConnection(
  state: AppState,
  modChain: ModChain,
  to: string,
  property: string,
  fromOutput: string | null,
) {
  return findModChainConnection(modChain, { to, toProperty: property, fromOutput });
}

export function resolveModChain(state: AppState, modChainId: string): number {
  const modChain = state.modChains[modChainId];
  return resolveModItem(state, modChain, modChain.output.from, modChain.output.fromOutput);
}

export function removeModItem(
  state: AppState,
  modChainId: string,
  modChainItemId: string,
): AppState {
  return produce(state, (s) => {
    const modChain = s.modChains[modChainId];

    if (modChain.output.from === modChainItemId) {
      const existingInput = modChain.connections.find((c) => c.to === modChainItemId);
      if (existingInput) {
        modChain.output = { from: existingInput.from, fromOutput: "output" };
      } else {
        const defaultMod = Object.entries(modChain.mods).find(([id, m]) => m.isDefault)![0];
        modChain.output = { from: defaultMod, fromOutput: "output" };
      }
    }

    modChain.connections = modChain.connections.filter(
      (c) => c.from !== modChainItemId && c.to !== modChainItemId,
    );
    delete modChain.mods[modChainItemId];
  });
}

export function findModChainConnection(
  modChain: ModChain,
  opts: { from?: string; to: string; toProperty: string; fromOutput: string | null },
) {
  const { from, to, toProperty, fromOutput } = opts;

  return modChain.connections.find(
    (c) =>
      (!from || c.from === from) &&
      c.to === to &&
      c.toProperty === toProperty &&
      (!fromOutput || c.fromOutput === fromOutput),
  );
}

export function connectModItems(
  setState: SetState,
  modChainId: string,
  opts:
    | {
        from: string;
        to: string;
        fromOutput: string;
        toProperty: string;
      }
    | {
        from: string;
        to: typeof ModOutput;
        fromOutput: string;
      },
) {
  setState((state) => {
    const modChain = state.modChains[modChainId];

    if (opts.to === ModOutput) {
      return {
        ...state,
        modChains: {
          ...state.modChains,
          [modChainId]: {
            ...modChain,
            output: {
              from: opts.from,
              fromOutput: opts.fromOutput,
            },
          },
        },
      };
    } else {
      const existing = findModChainConnection(modChain, opts);
      if (existing) {
        return produce(state, (s) => {
          const conns = s.modChains[modChainId].connections;
          conns.splice(conns.indexOf(existing), 1);
        });
      }

      return {
        ...state,
        modChains: {
          ...state.modChains,
          [modChainId]: {
            ...modChain,
            connections: [
              ...modChain.connections.filter(
                (c) => !(c.to === opts.to && c.toProperty === opts.toProperty),
              ),
              opts,
            ],
          },
        },
      };
    }
  });
}
