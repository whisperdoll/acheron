import StateStore from "./state.ts";
import App from "../App";
import React, { useReducer, FunctionComponent } from "react";
import { objectWithoutKeys, sliceObject } from "../utils/utils";
import { buildLayer } from "../Layers";
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
} from "../Types";
import {
  DefaultPlayerControls,
  LayerControlKey,
  PlayerControlKey,
  PlayerControlKeys,
} from "../utils/DefaultDefinitions";
import { MidiDevice, MidiNote } from "../utils/midi";
import { buildToken, copyToken, tokenDefinitions } from "../Tokens";
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
  key: ControlInstanceId;
  scale: ControlInstanceId;
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
  key: ControlInstanceId;
  scale: ControlInstanceId;
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

const initialState: AppState = {
  selectedHex: { hexIndex: -1, layerIndex: 0 },
  hoveredHex: { hexIndex: -1, layerIndex: 0 },
  controls: { ...DefaultPlayerControls }, // appended to after layer contruction
  tokens: {},
  barLength: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "barLength"
  )![0],
  emphasis: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "emphasis"
  )![0],
  tempoSync: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "tempoSync"
  )![0],
  noteLength: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "noteLength"
  )![0],
  pulseEvery: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "pulseEvery"
  )![0],
  tempo: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "tempo"
  )![0],
  timeToLive: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "timeToLive"
  )![0],
  key: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "key"
  )![0],
  scale: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "scale"
  )![0],
  transpose: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "transpose"
  )![0],
  velocity: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "velocity"
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

export class AppStateStore extends StateStore<AppState> {
  constructor(initialState: AppState, simple?: boolean) {
    super(initialState, simple);
  }

  setLayer(
    index: number | "current",
    layer: MaybeGenerated<LayerState, [LayerState]>,
    why: string
  ) {
    this.set(
      (state) => ({
        layers: List.withIndexReplaced(
          state.layers,
          typeof index === "number" ? index : state.selectedHex.layerIndex,
          layer
        ),
      }),
      why
    );
  }

  addTokenToHex(
    tokenKey: TokenUID,
    opts: MaybeGenerated<{ hexIndex: number; layerIndex: number }, [AppState]>,
    why: string
  ) {
    this.set((state) => {
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
              (old) => old.concat([tokenState.id])
            ),
          })
        ),
      };
    }, why);
  }

  addTokenToSelected(tokenKey: TokenUID, why: string) {
    this.addTokenToHex(
      tokenKey,
      (state) => ({
        hexIndex: state.selectedHex.hexIndex,
        layerIndex: state.selectedHex.layerIndex,
      }),
      why
    );
  }

  static removeTokenFromHex(
    state: AppState,
    tokenId: TokenInstanceId,
    opts: MaybeGenerated<{ hexIndex: number; layerIndex: number }, [AppState]>
  ): AppState {
    const resolvedOpts = resolveMaybeGenerated(opts, state);
    console.log({ state, tokenId, opts });

    return {
      ...state,
      tokens: objectWithoutKeys(state.tokens, [tokenId]),
      controls: objectWithoutKeys(
        state.controls,
        state.tokens[tokenId].controlIds
      ),
      layers: List.withIndexReplaced(
        state.layers,
        resolvedOpts.layerIndex,
        (layer) => ({
          ...layer,
          tokenIds: List.withIndexReplaced(
            layer.tokenIds,
            resolvedOpts.hexIndex,
            (old) => old.filter((id) => id !== tokenId)
          ),
        })
      ),
    };
  }

  removeTokenFromHex(
    tokenId: string,
    opts: MaybeGenerated<{ hexIndex: number; layerIndex: number }, [AppState]>,
    why: string
  ) {
    this.set((state) => {
      return AppStateStore.removeTokenFromHex(state, tokenId, opts);
    }, why);
  }

  removeToken(tokenId: string, why: string) {
    this.set((state) => {
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

      return AppStateStore.removeTokenFromHex(state, tokenId, {
        hexIndex,
        layerIndex,
      });
    }, "remove token bro");
  }

  togglePlaying(why: string) {
    this.set(
      (state) => ({
        isPlaying: !state.isPlaying,
        layers: state.layers.map((layer) => ({
          ...layer,
          currentBeat: 0,
          currentTimeMs: 0,
        })),
        startTime: performance.now(),
      }),
      why
    );
  }

  addLayer(select: boolean, why: string) {
    this.set((state) => {
      const { layerState, controls } = buildLayer(state);

      return {
        layers: state.layers.concat([layerState]),
        selectedHex: select
          ? { ...state.selectedHex, layerIndex: state.layers.length }
          : state.selectedHex,
        controls: {
          ...state.controls,
          ...controls,
        },
      };
    }, why);
  }

  removeLayer(index: MaybeGenerated<number, [AppState]>, why: string) {
    this.set((state) => {
      const resolvedIndex = resolveMaybeGenerated(index, state);
      const tokensToRemove = state.layers[resolvedIndex].tokenIds.flat();
      const controlsToRemove = tokensToRemove.flatMap(
        (tid) => state.tokens[tid].controlIds
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
    }, why);
  }

  pulse(why: string) {
    this.set((state) => ({ pulseSwitch: !state.pulseSwitch }), why);
  }

  editLfo(controlId: string, why: string) {
    this.set({ editingLfo: { controlId } }, why);
  }

  stopEditingLfo(why: string) {
    this.set({ editingLfo: null }, why);
  }

  copyHex(
    opts: MaybeGenerated<
      {
        srcLayerIndex: number;
        srcHexIndex: number;
        destLayerIndex: number;
        destHexIndex: number;
      },
      [AppState]
    >,
    why: string
  ) {
    this.set((state) => {
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
              Object.keys(newTokens)
            ),
          })
        ),
      };
    }, why);
  }

  moveHex(
    opts: MaybeGenerated<
      {
        srcLayerIndex: number;
        srcHexIndex: number;
        destLayerIndex: number;
        destHexIndex: number;
      },
      [AppState]
    >,
    why: string
  ) {
    this.set((state) => {
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
            ].slice(0)
          ),
        })
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
            []
          ),
        })
      );

      return { layers };
    }, why);
  }

  clearHex(
    opts: MaybeGenerated<
      {
        layerIndex: number;
        hexIndex: number;
      },
      [AppState]
    >,
    why: string
  ) {
    this.set((state) => {
      const resolvedOpts = resolveMaybeGenerated(opts, state);

      const tokens = state.layers[resolvedOpts.layerIndex].tokenIds[
        resolvedOpts.hexIndex
      ].map((tid) => state.tokens[tid]);

      return {
        controls: objectWithoutKeys(
          state.controls,
          tokens.flatMap((t) => t.controlIds)
        ),
        tokens: objectWithoutKeys(
          state.tokens,
          tokens.map((t) => t.id)
        ),
        layers: List.withIndexReplaced(
          state.layers,
          resolvedOpts.layerIndex,
          (layer) => ({
            ...layer,
            tokenIds: List.withIndexReplaced(
              layer.tokenIds,
              resolvedOpts.hexIndex,
              []
            ),
          })
        ),
      };
    }, why);
  }

  bufferMidi(
    opts: MaybeGenerated<{ layerIndex: number; note: MidiNote }, [AppState]>,
    why: string
  ) {
    this.set((state) => {
      const resolvedOpts = resolveMaybeGenerated(opts, state);

      const buffer = state.layers[resolvedOpts.layerIndex].midiBuffer.slice(0);
      const index = buffer.findIndex(
        (n) => n.number === resolvedOpts.note.number
      );
      if (index === -1) {
        buffer.push(resolvedOpts.note);
      } else {
        buffer[index] = resolvedOpts.note;
      }

      return {
        layers: List.withIndexReplaced(
          state.layers,
          resolvedOpts.layerIndex,
          (layer) => ({ ...layer, midiBuffer: buffer })
        ),
      };
    }, why);
  }

  debufferOffNotes(
    opts: MaybeGenerated<{ layerIndex: number }, [AppState]>,
    why: string
  ) {
    this.set((state) => {
      const resolvedOpts = resolveMaybeGenerated(opts, state);

      return {
        layers: List.withIndexReplaced(
          state.layers,
          resolvedOpts.layerIndex,
          (layer) => ({
            ...layer,
            midiBuffer: layer.midiBuffer.filter((n) => n.isOn),
          })
        ),
      };
    }, why);
  }

  get playerControls() {
    return sliceObject(this.values, PlayerControlKeys);
  }

  get currentLayer(): LayerState {
    return this.values.layers[this.values.selectedHex.layerIndex];
  }

  layerControl<T extends ControlDataType = ControlDataType>(
    control: LayerControlKey,
    layer: number | "current" = "current"
  ): ControlState<T> {
    return (
      layer === "current"
        ? (this.values.controls[this.currentLayer[control]] as ControlState<T>)
        : this.values.controls[this.values.layers[layer][control]]
    ) as ControlState<T>;
  }

  playerControl<T extends ControlDataType = ControlDataType>(
    control: PlayerControlKey
  ): ControlState<T> {
    return this.values.controls[this.values[control]] as ControlState<T>;
  }

  getControlValue<T extends ControlDataType = ControlDataType>(
    control:
      | ControlState<T>
      | string
      | {
          layerControl: LayerControlKey;
          layer: LayerState | number | "current";
        }
      | { playerControl: PlayerControlKey }
  ): TypeForControlDataType<T> {
    const resolveLayer = (
      layer: LayerState | number | "current" | undefined
    ) => {
      return typeof layer === "number"
        ? this.values.layers[layer]
        : layer === "current" || layer === undefined
        ? this.values.layers[this.values.selectedHex.layerIndex]
        : layer;
    };

    const resolvedLayer =
      typeof control === "object" && "layer" in control
        ? resolveLayer(control.layer)
        : resolveLayer("current");

    const resolvedControl: ControlState<T> =
      typeof control === "string"
        ? (this.values.controls[control] as ControlState<T>)
        : "layerControl" in control
        ? (this.values.controls[
            resolvedLayer[control.layerControl]
          ] as ControlState<T>)
        : "playerControl" in control
        ? (this.values.controls[
            this.playerControls[control.playerControl]
          ] as ControlState<T>)
        : control;

    if (resolvedControl.currentValueType === "fixed") {
      if (this.values.modChains[resolvedControl.id]) {
        return coerceControlValueFromNumber<T>(
          this.resolveModChain(resolvedControl.id),
          resolvedControl
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
        this.values.controls,
        this.playerControls,
        resolvedLayer,
        inheritParts
      );
      let inheritedValue = coerceControlValueToNumber(
        this.getControlValue(inheritedControl),
        inheritedControl
      );
      return coerceControlValueFromNumber<T>(
        Math.max(
          Math.min(+inheritedValue, resolvedControl.max),
          resolvedControl.min
        ),
        resolvedControl
      );
    }
  }

  resolveModItem(modChain: ModChain, modItemId: string): number {
    const modItem = modChain.mods[modItemId];

    switch (modItem.__type) {
      case "controlValue":
        return coerceControlValueToNumber(
          this.getControlValue(this.values.controls[modItem.controlId]),
          this.values.controls[modItem.controlId]
        );
      case "fixedControlValue":
        return modItem.value;
      case "fixedValue":
        return modItem.value;
      case "lfo":
        const props = { ...modItem } as Lfo;
        modChain.connections.forEach(({ from, to, property }) => {
          if (to === modItemId) {
            props[property as LfoConnectableProperty] = this.resolveModItem(
              modChain,
              from
            );
          }
        });
        return getLfoValue(
          props,
          {
            beat: this.values.layers[0].currentBeat,
            ms: this.values.layers[0].currentTimeMs,
          },
          "ms"
        );
    }
  }

  resolveModChain(modChainId: string): number {
    const modChain = this.values.modChains[modChainId];
    const inputValue = this.values.controls[modChain.input].fixedValue;

    if (modChain.output) {
      return this.resolveModItem(modChain, modChain.output);
    } else {
      return coerceControlValueToNumber(
        inputValue,
        this.values.controls[modChain.input]
      );
    }
  }

  connectModItems(
    modChainId: string,
    outputItemId: string,
    inputItemId: string | typeof ModOutput,
    inputItemProperty?: string
  ) {
    const modChain = this.values.modChains[modChainId];
    const outputItem = modChain.mods[outputItemId];

    if (inputItemId === ModOutput) {
      this.set((prev) => {
        return {
          modChains: {
            ...prev.modChains,
            [modChainId]: {
              ...modChain,
              output: outputItemId,
            },
          },
        };
      }, "connect mod item to output");
    } else {
      if (!inputItemProperty) {
        throw new Error("inputItemProperty is required");
      }

      this.set((prev) => {
        return {
          modChains: {
            ...prev.modChains,
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
      }, "connect mod item to another mod item");
    }
  }
}

const appStateStore = new AppStateStore(initialState);

await appStateStore.initialize();

export default appStateStore;
