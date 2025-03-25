import {
  ControlDataType,
  ControlState,
  getControlValue,
  KeyMap,
  LayerNote,
  Playhead,
  Token,
} from "../Types";
import {
  getAdjacentHex,
  getNoteParts,
  hexIndexesFromNote,
  hexNotes,
  noteArray,
  NumHexes,
  transposeNote,
} from "./elysiumutils";
import {
  array_copy,
  createEmpty2dArray,
  mod,
  msToS,
  objectWithoutKeys,
} from "./utils";
import Midi, { MidiScheduler, NoteOffOptions } from "./midi";
import { LayerControlKey } from "./DefaultDefinitions";
import { AppState, AppStateStore, LayerState } from "../state/AppState";
import settings from "../state/AppSettings";
import Dict from "../lib/dict";
import List from "../lib/list";
import SimpleAppState from "../state/SimpleAppState";

export class Driver {
  private scheduledForMove: {
    src: { hexIndex: number; layerIndex: number };
    dest: { hexIndex: number; layerIndex: number };
    playheadIndex: number;
  }[] = [];
  private awaitingLayerTransfer: {
    dest: { hexIndex: number; layerIndex: number };
    playhead: Playhead;
  }[] = [];
  private notesToAdd: LayerNote[] = [];
  public state: SimpleAppState;
  private initializedTokens: Set<string> = new Set<string>();

  constructor(state: SimpleAppState) {
    this.state = state;
  }

  public start() {
    this.state.set(
      this.performStartCallbacks(new SimpleAppState(this.state.values))
    );
  }

  public stop() {
    this.state.set(
      this.performStopCallbacks(new SimpleAppState(this.state.values))
    );
  }

  public step(ms: number) {
    if (!this.state.values.isPlaying) return;

    const workingState = new SimpleAppState(this.state.values);
    const allStartedNotes: LayerNote[][] = List.fromGenerator(
      () => [],
      workingState.values.layers.length
    ); // [layerIndex][noteIndex]
    const allStoppedNotes: LayerNote[][] = List.fromGenerator(
      () => [],
      workingState.values.layers.length
    ); // [layerIndex][noteIndex]

    for (let i = 0; i < workingState.values.layers.length; i++) {
      const { resultingState, notesStarted, notesStopped } = this.progressLayer(
        workingState,
        ms,
        i
      );
      allStartedNotes[i].push(...notesStarted);
      allStoppedNotes[i].push(...notesStopped);
      workingState.set(resultingState);
    }
    for (let i = 0; i < workingState.values.layers.length; i++) {
      workingState.set(this.performTransfers(workingState, i));
    }

    this.state.set(workingState.values);

    return {
      notesStarted: allStartedNotes,
      notesStopped: allStoppedNotes,
      resultingState: workingState,
    };
  }

  public static playTriad(opts: {
    state: SimpleAppState;
    hexIndex: number;
    triad: number;
    durationMs: number;
    velocity?: number;
    additionalTranspose?: number;
    layerIndex?: number;
  }) {
    let {
      state,
      hexIndex,
      triad,
      durationMs,
      velocity,
      additionalTranspose,
      layerIndex,
    } = opts;
    let notes: string[] = [hexNotes[hexIndex]];
    triad = mod(triad, 7);

    if (velocity === undefined) {
      velocity = state.getControlValue<"int">({
        layerControl: "velocity",
        layer: layerIndex || "current",
      });
    }

    if (triad > 0) {
      notes.push(hexNotes[getAdjacentHex(hexIndex, triad - 1)]);
      notes.push(hexNotes[getAdjacentHex(hexIndex, triad)]);
    }

    const key = state.getControlValue({
      layerControl: "key",
      layer: layerIndex || "current",
    }) as keyof typeof KeyMap;
    const permittedNotes = KeyMap[key].map((ni) => noteArray[ni]);

    notes = notes.filter((note) => {
      return permittedNotes.includes(getNoteParts(note).name);
    });

    const transposed = notes.map((note) => {
      const finalTranspose =
        state.getControlValue<"int">({
          layerControl: "transpose",
          layer: layerIndex || "current",
        }) + (additionalTranspose || 0);
      return transposeNote(note, finalTranspose);
    });

    const channel = state.getControlValue<"int">({
      layerControl: "midiChannel",
      layer: layerIndex || "current",
    });

    const deviceName = settings.values.midiOutputs;

    Midi.noteOn(
      transposed.map((note) => ({
        channel,
        deviceName,
        note,
        velocity,
      }))
    );

    Midi.noteOff(
      transposed.map((note) => ({
        channel,
        deviceName,
        note,
        time: `+${durationMs}`,
      }))
    );
  }

  private buildHelpers(
    state: SimpleAppState,
    layerIndex: number,
    currentBeat: number,
    currentMs: number,
    newPlayheads: Playhead[][],
    hexIndex: number,
    token: Token
  ) {
    const self = this;

    const helpers = {
      getControlValue(key: string) {
        const controls = token.controlIds.map(
          (id) => state.values.controls[id]
        );
        const control = controls.find((c) => c.key === key);

        if (control) {
          return state.getControlValue(control);
        } else {
          return null;
        }
      },
      getControlValues() {
        return Dict.fromArray(
          token.controlIds.map((cid) => [
            state.values.controls[cid].key,
            state.getControlValue(cid),
          ])
        );
      },
      getOtherTokenInstances() {
        const ret: Record<string, any>[] = [];
        state.values.layers.forEach((layer, li) => {
          layer.tokenIds.forEach((tidArray, hi) => {
            tidArray.forEach((tid) => {
              const t = state.values.tokens[tid];
              if (t.uid === token.uid && t.id !== token.id) {
                const toAdd: Record<string, any> = {};
                toAdd.hexIndex = hi;
                toAdd.layerIndex = li;
                t.controlIds.forEach((cid) => {
                  toAdd[state.values.controls[cid].key] =
                    state.getControlValue(cid);
                });
                ret.push(toAdd);
              }
            });
          });
        });
        return ret;
      },
      spawnPlayhead(
        hexIndex: number,
        timeToLive: number,
        direction: 0 | 1 | 2 | 3 | 4 | 5,
        offset: number = 0
      ) {
        newPlayheads[getAdjacentHex(hexIndex, direction, offset)].push({
          age: 0,
          direction,
          lifespan: timeToLive,
          store: {},
        });
      },
      getHexIndex() {
        return hexIndex;
      },
      isMidiPlaying() {
        return state.values.layers[layerIndex].midiBuffer.some((n) =>
          hexIndexesFromNote(n.name).includes(hexIndex)
        );
      },
      modifyPlayhead(playheadIndex: number, newPlayheadDef: Partial<Playhead>) {
        if (playheadIndex < 0 || playheadIndex >= newPlayheads[hexIndex].length)
          return;

        const newPlayhead: Playhead = {
          ...newPlayheads[hexIndex][playheadIndex],
        };
        if (newPlayheadDef.age !== undefined)
          newPlayhead.age = newPlayheadDef.age;
        if (newPlayheadDef.lifespan !== undefined)
          newPlayhead.lifespan = newPlayheadDef.lifespan;
        if (newPlayheadDef.direction !== undefined)
          newPlayhead.direction = newPlayheadDef.direction;
        newPlayheads[hexIndex][playheadIndex] = newPlayhead;
      },
      getPlayheadStore(playheadIndex: number) {
        if (playheadIndex < 0 || playheadIndex >= newPlayheads[hexIndex].length)
          return {};
        return newPlayheads[hexIndex][playheadIndex].store;
      },
      warpPlayhead(
        playheadIndex: number,
        newHexIndex: number,
        newLayerIndex?: number
      ) {
        if (playheadIndex < 0 || playheadIndex >= newPlayheads[hexIndex].length)
          return;
        newLayerIndex = newLayerIndex ?? layerIndex;
        if (newLayerIndex >= state.values.layers.length || newLayerIndex < 0)
          return;

        const existingIndex = self.scheduledForMove.findIndex(
          (m) =>
            m.src.hexIndex === hexIndex &&
            m.src.layerIndex === layerIndex &&
            m.playheadIndex === playheadIndex
        );

        const newMoveInfo = {
          playheadIndex,
          src: {
            hexIndex,
            layerIndex,
          },
          dest: {
            hexIndex: newHexIndex,
            layerIndex: newLayerIndex,
          },
        };

        if (existingIndex === -1) {
          self.scheduledForMove.push(newMoveInfo);
        } else {
          self.scheduledForMove[existingIndex] = newMoveInfo;
        }
      },
      skipPlayhead(
        playheadIndex: number,
        direction: number,
        skipAmount: number
      ) {
        if (playheadIndex < 0 || playheadIndex >= newPlayheads[hexIndex].length)
          return;

        self.scheduledForMove.push({
          playheadIndex,
          src: {
            hexIndex,
            layerIndex,
          },
          dest: {
            hexIndex: getAdjacentHex(hexIndex, direction, skipAmount),
            layerIndex,
          },
        });
      },
      // removePlayhead(playheadIndex: number)
      // {
      //     if (playheadIndex < 0 || playheadIndex >= newPlayheads[hexIndex].length) return;

      //     scheduledForRemoval.push(playheadIndex);
      // },
      oppositeDirection(direction: number) {
        return (direction + 3) % 6;
      },
      playTriad(
        hexIndex: number,
        triad: number,
        duration: number,
        durationType: "beat" | "ms",
        velocity: number,
        transpose: number = 0
      ) {
        let notes: string[] = [hexNotes[hexIndex]];
        triad = mod(triad, 7);

        if (triad > 0) {
          notes.push(hexNotes[getAdjacentHex(hexIndex, triad - 1)]);
          notes.push(hexNotes[getAdjacentHex(hexIndex, triad)]);
        }

        const key = state.getControlValue({
          layerControl: "key",
          layer: layerIndex,
        }) as keyof typeof KeyMap;
        const permittedNotes = KeyMap[key].map((ni) => noteArray[ni]);

        notes = notes.filter((note) => {
          return permittedNotes.includes(getNoteParts(note).name);
        });

        const transposed = notes.map((note) => {
          const finalTranspose =
            state.getControlValue<"int">({
              layerControl: "transpose",
              layer: layerIndex,
            }) + transpose;
          return transposeNote(note, finalTranspose);
        });

        const channel = state.getControlValue<"int">({
          layerControl: "midiChannel",
          layer: layerIndex,
        });
        const notesToAdd = transposed.map((note) => ({
          end:
            durationType === "beat"
              ? currentBeat + duration
              : currentMs + duration,
          note,
          type: durationType,
          channel,
          velocity,
        }));

        // notesToAdd.forEach((note) => {
        //   console.log("add", {
        //     startBeat: currentBeat,
        //     startTime: currentMs,
        //     end: note.end,
        //     note,
        //   });
        // });
        self.notesToAdd.push(...notesToAdd);
      },
      getCurrentBeat(withinBar: boolean = true): number {
        return withinBar
          ? Math.floor(currentBeat) %
              state.getControlValue<"int">({
                layerControl: "barLength",
                layer: layerIndex,
              })
          : Math.floor(currentBeat);
      },
      getBarLength(): number {
        return state.getControlValue<"int">({
          layerControl: "barLength",
          layer: layerIndex,
        });
      },
      getLayerValue(key: LayerControlKey) {
        return state.getControlValue({ layerControl: key, layer: layerIndex });
      },
      getLayer(): number {
        return layerIndex;
      },
      getNumLayers(): number {
        return state.values.layers.length;
      },
    };

    return helpers;
  }

  private performStartCallbacks(state: SimpleAppState): AppState {
    const newLayers = array_copy(state.values.layers);
    let newTokens = { ...state.values.tokens };

    state.values.layers.forEach((layer, layerIndex) => {
      let newPlayheads: Playhead[][] = createEmpty2dArray(NumHexes);

      // do token stuff //
      layer.tokenIds.forEach((hex, hexIndex) => {
        hex.forEach((tokenId) => {
          if (!settings.values.tokens[state.values.tokens[tokenId].uid].enabled)
            return;

          const token = { ...newTokens[tokenId] };

          if (token.callbacks.onStart) {
            const helpers = this.buildHelpers(
              state,
              layerIndex,
              layer.currentBeat,
              layer.currentTimeMs,
              newPlayheads,
              hexIndex,
              token
            );

            token.callbacks.onStart.bind(null)(token.store, helpers);
            newTokens[tokenId] = token;
          }

          this.initializedTokens.add(tokenId);
        });
      });

      newLayers[layerIndex] = {
        ...layer,
        playheads: newPlayheads,
      };
    });

    return {
      ...state.values,
      layers: newLayers,
      tokens: newTokens,
    };
  }

  private performStopCallbacks(state: SimpleAppState): AppState {
    const newLayers = array_copy(state.values.layers);
    let newTokens = { ...state.values.tokens };

    state.values.layers.forEach((layer, layerIndex) => {
      let newPlayheads: Playhead[][] = createEmpty2dArray(NumHexes);

      // do token stuff //
      layer.tokenIds.forEach((hex, hexIndex) => {
        hex.forEach((tokenId) => {
          if (!settings.values.tokens[state.values.tokens[tokenId].uid].enabled)
            return;

          const token = { ...newTokens[tokenId] };

          if (token.callbacks.onStop) {
            const helpers = this.buildHelpers(
              state,
              layerIndex,
              layer.currentBeat,
              layer.currentTimeMs,
              newPlayheads,
              hexIndex,
              token
            );

            token.callbacks.onStop.bind(null)(token.store, helpers);
            newTokens[tokenId] = token;
          }
        });
      });

      newLayers[layerIndex] = {
        ...layer,
        playheads: newPlayheads,
      };
    });

    this.initializedTokens.clear();

    return {
      ...state.values,
      layers: newLayers,
      tokens: newTokens,
    };
  }

  private performTransfers(
    state: SimpleAppState,
    layerIndex: number
  ): AppState {
    const newPlayheads = state.values.layers[layerIndex].playheads.slice(0);
    let changeMade = false;

    for (let i = this.awaitingLayerTransfer.length - 1; i >= 0; i--) {
      const awaiting = this.awaitingLayerTransfer[i];
      if (awaiting.dest.layerIndex === layerIndex) {
        newPlayheads[awaiting.dest.hexIndex].push(
          this.awaitingLayerTransfer.splice(i, 1)[0].playhead
        );
        changeMade = true;
      }
    }

    if (changeMade) {
      return {
        ...state.values,
        layers: state.values.layers.map((l, li) =>
          li !== layerIndex
            ? l
            : {
                ...l,
                playheads: newPlayheads,
              }
        ),
      };
    } else {
      return state.values;
    }
  }

  private progressLayer(
    state: SimpleAppState,
    deltaMs: number,
    layerIndex: number
  ): {
    resultingState: AppState;
    notesStarted: LayerNote[];
    notesStopped: LayerNote[];
  } {
    if (!state.values.isPlaying) {
      return {
        resultingState: state.values,
        notesStarted: [],
        notesStopped: [],
      };
    }

    const newLayers = array_copy(state.values.layers);
    let newTokens = { ...state.values.tokens };
    let newPlayheads: Playhead[][] = createEmpty2dArray(NumHexes);
    const layer = state.values.layers[layerIndex];
    const bpm = state.getControlValue<"decimal">(layer.tempo, {
      layer,
      controls: state.values.controls,
    });
    const bps = bpm / 60;
    const bpms = bps / 1000;
    // console.log({
    //   now,
    //   currentTime: layer.currentTimeMs,
    //   realDeltaMs,
    //   bpms,
    //   currentBeat: layer.currentBeat,
    // });
    // console.log(layer.currentBeat, layer.currentBeat === 0, Math.floor(layer.currentBeat + beatDelta) > layer.currentBeat);
    let shouldClearMidiBuffer = false;
    const newCurrentTime = layer.currentTimeMs + deltaMs;
    const newCurrentBeat = layer.currentBeat + bpms * deltaMs;

    if (
      layer.enabled &&
      (layer.currentBeat === 0 ||
        Math.floor(newCurrentBeat) > layer.currentBeat)
    ) {
      // move any playheads //
      layer.playheads.forEach((hex, hexIndex) => {
        hex.forEach((playhead, playheadIndex) => {
          if (playhead.age < playhead.lifespan) {
            const newPlayhead = {
              ...playhead,
              age: playhead.age + 1,
            };

            const moveInfoIndex = this.scheduledForMove.findIndex(
              (m) =>
                m.src.layerIndex === layerIndex &&
                m.src.hexIndex === hexIndex &&
                m.playheadIndex === playheadIndex
            );

            if (moveInfoIndex !== -1) {
              const moveInfo = this.scheduledForMove[moveInfoIndex];
              if (moveInfo.dest.layerIndex === layerIndex) {
                newPlayheads[moveInfo.dest.hexIndex].push(newPlayhead);
              } else {
                this.awaitingLayerTransfer.push({
                  dest: moveInfo.dest,
                  playhead: { ...playhead },
                });
              }
              this.scheduledForMove.splice(moveInfoIndex, 1);
            } else {
              const adj = getAdjacentHex(hexIndex, playhead.direction);

              if (!settings.values.wrapPlayheads) {
                if ([1, 2].includes(playhead.direction)) {
                  // right
                  if (adj < 12) return;
                }
                if ([5, 0, 1].includes(playhead.direction)) {
                  // up
                  if ((adj + 1) % 12 === 0) return;
                }
                if ([2, 3, 4].includes(playhead.direction)) {
                  // down
                  if (adj % 12 === 0) return;
                }
                if ([4, 5].includes(playhead.direction)) {
                  // left
                  if (adj >= NumHexes - 12) return;
                }
              }

              newPlayheads[adj].push(newPlayhead);
            }
          }
        });
      });

      // do token stuff //
      layer.tokenIds.forEach((hex, hexIndex) => {
        hex.forEach((tokenId) => {
          if (!settings.values.tokens[state.values.tokens[tokenId].uid].enabled)
            return;

          const token = { ...newTokens[tokenId] };

          if (!this.initializedTokens.has(tokenId)) {
            if (token.callbacks.onStart) {
              const helpers = this.buildHelpers(
                state,
                layerIndex,
                newCurrentBeat,
                newCurrentTime,
                newPlayheads,
                hexIndex,
                token
              );

              token.callbacks.onStart.bind(null)(token.store, helpers);
              newTokens[tokenId] = token;
            }
          }

          if (token.callbacks.onTick) {
            const helpers = this.buildHelpers(
              state,
              layerIndex,
              newCurrentBeat,
              newCurrentTime,
              newPlayheads,
              hexIndex,
              token
            );

            // console.log(token.store);

            const debug = token.callbacks.onTick.bind(null)(
              token.store,
              helpers,
              newPlayheads[hexIndex].map((p) => objectWithoutKeys(p, ["store"]))
            );
            // console.log(debug);
            newTokens[tokenId] = token;
          }
        });
      });

      shouldClearMidiBuffer = true;
    } else {
      newPlayheads = layer.playheads;
    }

    const notesStarted = this.notesToAdd;
    let { newPlayingNotes, notesStopped } = List.partitionBy(
      layer.playingNotes,
      (note) => {
        const cmp = note.type === "beat" ? newCurrentBeat : newCurrentTime;
        if (note.end <= cmp) {
          return "notesStopped";
        }
        return "newPlayingNotes";
      }
    );
    newPlayingNotes ||= [];
    notesStopped ||= [];
    newPlayingNotes.push(...notesStarted);

    notesStarted.forEach((note) => {
      note.id = MidiScheduler.scheduleNoteOn({
        channel: state.getControlValue<"int">({
          layerControl: "midiChannel",
          layer: layerIndex,
        }),
        deviceName: () => settings.values.midiOutputs,
        note: note.note,
        time: performance.now(),
        velocity: note.velocity,
      });
    });
    notesStopped.forEach((note) => {
      MidiScheduler.scheduleNoteOff({
        id: note.id!,
        time: performance.now(),
      });
    });
    MidiScheduler.bufferUpcomingNotesToDevice(100);

    const protoLayer: LayerState = {
      ...layer,
      playheads: newPlayheads,
      currentTimeMs: newCurrentTime,
      currentBeat: newCurrentBeat,
      playingNotes: newPlayingNotes,
    };

    this.notesToAdd = [];

    if (!shouldClearMidiBuffer) {
      newLayers[layerIndex] = protoLayer;
    } else {
      newLayers[layerIndex] = {
        ...protoLayer,
        midiBuffer: [],
      };
    }

    return {
      resultingState: {
        ...state.values,
        layers: newLayers,
        tokens: newTokens,
      },
      notesStarted,
      notesStopped,
    };
  }
}

// export class LookaheadDriver {
//   static state: AppStateStore;
//   static stepMs: number = 2;

//   public static initialize(base: AppState) {
//     this.state = new AppStateStore(base);
//   }

//   public static get currentTimeMs(): number | null {
//     return this.state.values.layers[0]?.currentTimeMs || null;
//   }

//   public static computeChunk(chunkMs: number) {
//     if (!this.state.values.layers.length) return;
//     const currentTimeMs = this.currentTimeMs!;

//     for (
//       let now = currentTimeMs;
//       now < currentTimeMs + chunkMs;
//       now += this.stepMs
//     ) {
//       for (let i = 0; i < this.state.values.layers.length; i++) {
//         const { notesStarted, notesStopped, resultingState } = progressLayer(
//           this.state.values,
//           this.stepMs,
//           i
//         );

//         this.state.dangerouslyReplaceValues(resultingState);
//         notesStarted.forEach((note) => {
//           note.id = MidiScheduler.scheduleNoteOn({
//             channel: this.state.getControlValue<"int">({
//               layerControl: "midiChannel",
//               layer: i,
//             }),
//             deviceName: () => settings.values.midiOutputs,
//             note: note.note,
//             time: this.state.values.layers[i].currentTimeMs,
//           });
//         });
//         notesStopped.forEach((note) => {
//           MidiScheduler.scheduleNoteOff({
//             id: note.id!,
//             time: this.state.values.layers[i].currentTimeMs,
//           });
//         });
//       }
//       for (let i = 0; i < this.state.values.layers.length; i++) {
//         performTransfers(this.state.values, i);
//       }
//     }
//   }

//   public static stop() {
//     const hanging = MidiScheduler.clear();
//     Midi.noteOff(
//       hanging.map<NoteOffOptions>((n) => ({ ...n, time: n.time + 1 }))
//     );
//   }
// }
