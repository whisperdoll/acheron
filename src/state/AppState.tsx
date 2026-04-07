import StateStore from "./state.ts";
import App from "../App.tsx";
import React, { useReducer, FunctionComponent, useState } from "react";
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
} from "../Types.ts";
import {
  DefaultPlayerControls,
  LayerControlKey,
  PlayerControlKey,
  PlayerControlKeys,
} from "../utils/DefaultDefinitions.ts";
import { MidiDevice, MidiNote } from "../utils/midi.ts";
import { buildToken, copyToken, tokenDefinitions } from "../Tokens.ts";
import List from "../lib/list.ts";
import {
  resolveMaybeGenerated,
  MaybeGenerated,
  arrayWithoutIndexes,
  MaybeGeneratedPromise,
} from "../lib/utils.ts";
import appSettingsStore from "./AppSettings.ts";
import AbsorbToken from "../tokens/absorb.ts";
import Dict from "../lib/dict.ts";
import env from "../lib/env.ts";
import {
  getControlFromInheritParts,
  getInheritParts,
} from "../utils/elysiumutils.ts";

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

export const initialState: AppState = {
  selectedHex: { hexIndex: -1, layerIndex: 0 },
  hoveredHex: { hexIndex: -1, layerIndex: 0 },
  controls: { ...DefaultPlayerControls }, // appended to after layer contruction
  tokens: {},
  barLength: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "barLength",
  )![0],
  emphasis: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "emphasis",
  )![0],
  tempoSync: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "tempoSync",
  )![0],
  noteLength: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "noteLength",
  )![0],
  pulseEvery: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "pulseEvery",
  )![0],
  tempo: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "tempo",
  )![0],
  timeToLive: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "timeToLive",
  )![0],
  keyTonic: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "keyTonic",
  )![0],
  keyMode: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "keyMode",
  )![0],
  transpose: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "transpose",
  )![0],
  velocity: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "velocity",
  )![0],
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
  modChains: {},
  modChainControl: undefined,
};

const initialLayer = buildLayer(initialState);

initialState.controls = { ...initialState.controls, ...initialLayer.controls };
initialState.layers = [initialLayer.layerState];

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
    const { tokenState, controls } = buildToken(state, tokenKey);

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
      layers: List.withIndexReplaced(
        state.layers,
        resolveMaybeGenerated(opts, state).layerIndex,
        (layer) => ({
          ...layer,
          tokenIds: List.withIndexReplaced(
            layer.tokenIds,
            resolveMaybeGenerated(opts, state).hexIndex,
            (old) => old.concat([tokenState.id]),
          ),
        }),
      ),
    };
  });
}

export function addTokenToSelected(
  setState: SetState,
  tokenKey: TokenUID,
  why: string,
) {
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
  console.log({ state, tokenId, opts });

  return {
    ...state,
    tokens: objectWithoutKeys(state.tokens, [tokenId]),
    controls: objectWithoutKeys(
      state.controls,
      state.tokens[tokenId].controlIds,
    ),
    layers: List.withIndexReplaced(
      state.layers,
      resolvedOpts.layerIndex,
      (layer) => ({
        ...layer,
        tokenIds: List.withIndexReplaced(
          layer.tokenIds,
          resolvedOpts.hexIndex,
          (old) => old.filter((id) => id !== tokenId),
        ),
      }),
    ),
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
    const { layerState, controls } = buildLayer(state);

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
    const controlsToRemove = tokensToRemove.flatMap(
      (tid) => state.tokens[tid].controlIds,
    );

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

    tokensToCopy.forEach((token) => {
      const { tokenState, controls } = copyToken(state, token);

      newControls = { ...newControls, ...controls };
      newTokens = { ...newTokens, [tokenState.id]: tokenState };
    });

    return {
      ...state,
      controls: { ...state.controls, ...newControls },
      tokens: { ...state.tokens, ...newTokens },
      layers: List.withIndexReplaced(
        state.layers,
        resolvedOpts.destLayerIndex,
        (layer) => ({
          ...layer,
          tokenIds: List.withIndexReplaced(
            layer.tokenIds,
            resolvedOpts.destHexIndex,
            Object.keys(newTokens),
          ),
        }),
      ),
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
    layers = List.withIndexReplaced(
      layers,
      resolvedOpts.destLayerIndex,
      (layer) => ({
        ...layer,
        tokenIds: List.withIndexReplaced(
          layer.tokenIds,
          resolvedOpts.destHexIndex,
          layers[resolvedOpts.srcLayerIndex].tokenIds[
            resolvedOpts.srcHexIndex
          ].slice(0),
        ),
      }),
    );

    // delete src
    layers = List.withIndexReplaced(
      layers,
      resolvedOpts.srcLayerIndex,
      (layer) => ({
        ...layer,
        tokenIds: List.withIndexReplaced(
          layer.tokenIds,
          resolvedOpts.srcHexIndex,
          [],
        ),
      }),
    );

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

    const tokens = state.layers[resolvedOpts.layerIndex].tokenIds[
      resolvedOpts.hexIndex
    ].map((tid) => state.tokens[tid]);

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
      layers: List.withIndexReplaced(
        state.layers,
        resolvedOpts.layerIndex,
        (layer) => ({
          ...layer,
          tokenIds: List.withIndexReplaced(
            layer.tokenIds,
            resolvedOpts.hexIndex,
            [],
          ),
        }),
      ),
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
    const index = buffer.findIndex(
      (n) => n.number === resolvedOpts.note.number,
    );
    if (index === -1) {
      buffer.push(resolvedOpts.note);
    } else {
      buffer[index] = resolvedOpts.note;
    }

    return {
      ...state,
      layers: List.withIndexReplaced(
        state.layers,
        resolvedOpts.layerIndex,
        (layer) => ({ ...layer, midiBuffer: buffer }),
      ),
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
      layers: List.withIndexReplaced(
        state.layers,
        resolvedOpts.layerIndex,
        (layer) => ({
          ...layer,
          midiBuffer: layer.midiBuffer.filter((n) => n.isOn),
        }),
      ),
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
        ? (state.controls[
            resolvedLayer[control.layerControl]
          ] as ControlState<T>)
        : "playerControl" in control
          ? (state.controls[
              playerControls(state)[control.playerControl]
            ] as ControlState<T>)
          : control;

  if (resolvedControl.currentValueType === "fixed") {
    if (state.modChains[resolvedControl.id]) {
      return coerceControlValueFromNumber<T>(
        resolveModChain(state, resolvedControl.id),
        resolvedControl,
      );
    } else {
      return resolvedControl.fixedValue;
    }
  } else {
    const inheritParts = getInheritParts(resolvedControl.inherit);
    if (!inheritParts) {
      console.error("inherit failed", { control });
      throw "inherit fail";
    }

    const inheritedControl = getControlFromInheritParts(
      state.controls,
      playerControls(state),
      resolvedLayer,
      inheritParts,
    );
    let inheritedValue = coerceControlValueToNumber(
      getControlValue(state, inheritedControl),
      inheritedControl,
    );
    return coerceControlValueFromNumber<T>(
      Math.max(
        Math.min(+inheritedValue, resolvedControl.max),
        resolvedControl.min,
      ),
      resolvedControl,
    );
  }
}

export function resolveModItem(
  state: AppState,
  modChain: ModChain,
  modItemId: string,
): number {
  const modItem = modChain.mods[modItemId];

  switch (modItem.__type) {
    case "controlValue":
    case "inheritedControlValue":
      return coerceControlValueToNumber(
        getControlValue(state, state.controls[modItem.controlId]),
        state.controls[modItem.controlId],
      );
    case "fixedControlValue":
      return modItem.value;
    case "fixedValue":
      return modItem.value;
    case "lfo":
      const props = { ...modItem } as Lfo;
      modChain.connections.forEach(({ from, to, property }) => {
        if (to === modItemId) {
          props[property as LfoConnectableProperty] = resolveModItem(
            state,
            modChain,
            from,
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
  }
}

export function resolveModChain(state: AppState, modChainId: string): number {
  const modChain = state.modChains[modChainId];
  const inputValue = state.controls[modChain.input].fixedValue;

  if (modChain.output) {
    return resolveModItem(state, modChain, modChain.output);
  } else {
    return coerceControlValueToNumber(
      inputValue,
      state.controls[modChain.input],
    );
  }
}

export function connectModItems(
  setState: SetState,
  modChainId: string,
  outputItemId: string,
  inputItemId: string | typeof ModOutput,
  inputItemProperty?: string,
) {
  setState((state) => {
    const modChain = state.modChains[modChainId];
    const outputItem = modChain.mods[outputItemId];

    if (inputItemId === ModOutput) {
      return {
        ...state,
        modChains: {
          ...state.modChains,
          [modChainId]: {
            ...modChain,
            output: outputItemId,
          },
        },
      };
    } else {
      if (!inputItemProperty) {
        throw new Error("inputItemProperty is required");
      }

      return {
        ...state,
        modChains: {
          ...state.modChains,
          [modChainId]: {
            ...modChain,
            connections: [
              ...modChain.connections,
              {
                from: outputItemId,
                to: inputItemId,
                property: inputItemProperty,
              },
            ],
          },
        },
      };
    }
  });
}
