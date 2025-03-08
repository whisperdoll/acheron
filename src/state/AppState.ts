import StateStore from "./state.ts";
import App from "../App";
import React, { useReducer, FunctionComponent } from "react";
import {
  getUserDataPath,
  objectWithoutKeys,
  sliceObject,
} from "../utils/utils";
import * as path from "@tauri-apps/api/path";
import * as fs from "@tauri-apps/plugin-fs";
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
} from "../Types";
import { DefaultPlayerControls } from "../utils/DefaultDefinitions";
import { MidiDevice, MidiNote } from "../utils/midi";
import { buildToken, copyToken, tokenDefinitions } from "../Tokens";
import { migrateSettings } from "../Migrators";
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

export interface AppState {
  selectedHex: { hexIndex: number; layerIndex: number };
  controls: Record<ControlInstanceId, ControlState>;
  tokens: Record<TokenInstanceId, Token>;
  tokenDefinitions: Record<TokenUID, TokenDefinition>;
  key: ControlInstanceId;
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
}

export interface LayerState {
  name: string;
  currentBeat: number;
  currentTimeMs: number;
  enabled: ControlInstanceId;
  midiChannel: ControlInstanceId;
  key: ControlInstanceId;
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
  transpose: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "transpose"
  )![0],
  velocity: Object.entries(DefaultPlayerControls).find(
    (e) => e[1].key === "velocity"
  )![0],
  layers: [], // appended to after layer contruction
  isPlaying: false,
  startTime: 0,
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
};

const initialLayer = buildLayer(initialState);

initialState.controls = { ...initialState.controls, ...initialLayer.controls };
initialState.layers = [initialLayer.layerState];

class AppStateStore extends StateStore<AppState> {
  constructor() {
    super(() => initialState);
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

  removeTokenFromHex(
    tokenId: string,
    opts: MaybeGenerated<{ hexIndex: number; layerIndex: number }, [AppState]>,
    why: string
  ) {
    this.set((state) => {
      const resolvedOpts = resolveMaybeGenerated(opts, state);

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
    }, why);
  }

  removeTokenFromSelected(tokenId: string, why: string) {
    this.removeTokenFromHex(
      tokenId,
      (state) => ({
        hexIndex: state.selectedHex.hexIndex,
        layerIndex: state.selectedHex.layerIndex,
      }),
      why
    );
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
}

const appStateStore = new AppStateStore();

await appStateStore.initialize();

export default appStateStore;
