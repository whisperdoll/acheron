import { LayerNote, PerformanceNote, Playhead, Token } from "../Types";
import {
  generateGridNotes,
  getAdjacentHex,
  getNoteParts,
  hexIndexesFromNote,
  noteArray,
  transposeNote,
} from "./elysiumutils";
import {
  array_copy,
  createEmpty2dArray,
  mod,
  objectWithoutKeys,
} from "./utils";
import Midi, { MidiScheduler } from "./midi";
import { LayerControlKey } from "./DefaultDefinitions";
import { AppState, getControlValue, LayerState } from "../state/AppState";
import settings from "../state/AppSettings";
import Dict from "../lib/dict";
import List from "../lib/list";
import { modes, notesForKey } from "./scales";

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
  public state: AppState;
  private initializedTokens: Set<string> = new Set<string>();

  constructor(state: AppState) {
    this.state = state;
  }

  public start() {
    this.state = this.performStartCallbacks(this.state);
  }

  public stop() {
    this.state = this.performStopCallbacks(this.state);
    Midi.allNotesOff();
  }

  public step(ms: number) {
    if (!this.state.isPlaying) return;

    let workingState = this.state;
    const allStartedNotes: LayerNote[][] = List.fromGenerator(
      () => [],
      workingState.layers.length,
    ); // [layerIndex][noteIndex]
    const allStoppedNotes: LayerNote[][] = List.fromGenerator(
      () => [],
      workingState.layers.length,
    ); // [layerIndex][noteIndex]

    for (let i = 0; i < workingState.layers.length; i++) {
      const { resultingState, notesStarted, notesStopped } = this.progressLayer(
        workingState,
        ms,
        i,
      );
      allStartedNotes[i].push(...notesStarted);
      allStoppedNotes[i].push(...notesStopped);
      workingState = resultingState;
    }
    for (let i = 0; i < workingState.layers.length; i++) {
      workingState = this.performTransfers(workingState, i);
    }

    // this.setState(workingState);
    this.state = workingState;

    return {
      notesStarted: allStartedNotes,
      notesStopped: allStoppedNotes,
      resultingState: workingState,
    };
  }

  public static playTriad(opts: {
    state: AppState;
    hexIndex: number;
    triad: number;
    durationMs: number;
    velocity?: number;
    additionalTranspose?: number;
    layerIndex?: number;
  }) {
    const { state, hexIndex, durationMs, additionalTranspose, layerIndex } =
      opts;

    if (hexIndex === -1)
      return [[], []] as [
        Omit<PerformanceNote, "identifier">[],
        Omit<PerformanceNote, "identifier">[],
      ];

    const hexNotes = generateGridNotes(
      state.gridStartingNote,
      state.gridRows,
      state.gridCols,
    );
    let { triad, velocity } = opts;
    let notes: string[] = [hexNotes[hexIndex]];
    triad = mod(triad, 7);

    if (velocity === undefined) {
      velocity = getControlValue<"int">(state, {
        layerControl: "velocity",
        layer: layerIndex || "current",
      });
    }

    if (triad > 0) {
      notes.push(
        hexNotes[
          getAdjacentHex(hexIndex, triad - 1, state.gridRows, state.gridCols)
        ],
      );
      notes.push(
        hexNotes[
          getAdjacentHex(hexIndex, triad, state.gridRows, state.gridCols)
        ],
      );
    }

    const key = getControlValue<"select">(state, {
      layerControl: "keyTonic",
      layer: layerIndex || "current",
    });
    const mode = getControlValue<"select">(state, {
      layerControl: "keyMode",
      layer: layerIndex || "current",
    }) as keyof typeof modes;
    const permittedNotes =
      key === "None"
        ? noteArray
        : notesForKey(noteArray.indexOf(key), mode).map(
            (noteIndex) => noteArray[noteIndex],
          );

    let unpermitted: string[];
    // eslint-disable-next-line prefer-const
    [notes, unpermitted] = List.partition2(notes, (note) =>
      permittedNotes.includes(getNoteParts(note).name),
    );

    const [transposed, transposedUnpermitted] = [notes, unpermitted].map(
      (notes) =>
        notes.map((note) => {
          const finalTranspose =
            getControlValue<"int">(state, {
              layerControl: "transpose",
              layer: layerIndex || "current",
            }) + (additionalTranspose || 0);
          return transposeNote(note, finalTranspose);
        }),
    );

    const channel = getControlValue<"int">(state, {
      layerControl: "midiChannel",
      layer: layerIndex || "current",
    });

    const deviceName = settings.values.midiOutputs;

    const [finalNotes, finalNotesUnpermitted] = [
      transposed,
      transposedUnpermitted,
    ].map((notes) =>
      notes.map((note) => ({
        channel,
        deviceName,
        note,
        velocity,
      })),
    );

    Midi.noteOn(finalNotes);

    if (durationMs) {
      Midi.noteOff(
        transposed.map((note) => ({
          channel,
          deviceName,
          note,
          time: `+${durationMs}`,
        })),
      );
    }

    return [finalNotes, finalNotesUnpermitted].map((notes) =>
      notes.map<Omit<PerformanceNote, "identifier">>((n) => ({
        note: n.note,
        channel: n.channel,
        layer: layerIndex ?? state.selectedHex.layerIndex,
        velocity: n.velocity,
        hexIndex,
        device: n.deviceName,
      })),
    ) as [
      Omit<PerformanceNote, "identifier">[],
      Omit<PerformanceNote, "identifier">[],
    ];
  }

  private buildHelpers(
    state: AppState,
    layerIndex: number,
    currentBeat: number,
    currentMs: number,
    newPlayheads: Playhead[][],
    hexIndex: number,
    token: Token,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const hexNotes = generateGridNotes(
      state.gridStartingNote,
      state.gridRows,
      state.gridCols,
    );

    const helpers = {
      getControlValue(key: string) {
        const controls = token.controlIds.map((id) => state.controls[id]);
        const control = controls.find((c) => c.key === key);

        if (control) {
          return getControlValue(state, control);
        } else {
          return null;
        }
      },
      getControlValues() {
        return Dict.fromArray(
          token.controlIds.map((cid) => [
            state.controls[cid].key,
            getControlValue(state, cid),
          ]),
        );
      },
      getOtherTokenInstances() {
        const ret: Record<string, unknown>[] = [];
        state.layers.forEach((layer, li) => {
          layer.tokenIds.forEach((tidArray, hi) => {
            tidArray.forEach((tid) => {
              const t = state.tokens[tid];
              if (t.uid === token.uid && t.id !== token.id) {
                const toAdd: Record<string, unknown> = {};
                toAdd.hexIndex = hi;
                toAdd.layerIndex = li;
                t.controlIds.forEach((cid) => {
                  toAdd[state.controls[cid].key] = getControlValue(state, cid);
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
        offset: number = 0,
      ) {
        newPlayheads[
          getAdjacentHex(
            hexIndex,
            direction,
            state.gridRows,
            state.gridCols,
            offset,
          )
        ].push({
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
        return state.layers[layerIndex].midiBuffer.some((n) =>
          hexIndexesFromNote(
            n.name,
            generateGridNotes(
              state.gridStartingNote,
              state.gridRows,
              state.gridCols,
            ),
          ).includes(hexIndex),
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
        newLayerIndex?: number,
      ) {
        if (playheadIndex < 0 || playheadIndex >= newPlayheads[hexIndex].length)
          return;
        newLayerIndex ??= layerIndex;
        if (newLayerIndex >= state.layers.length || newLayerIndex < 0) return;

        const existingIndex = self.scheduledForMove.findIndex(
          (m) =>
            m.src.hexIndex === hexIndex &&
            m.src.layerIndex === layerIndex &&
            m.playheadIndex === playheadIndex,
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
        skipAmount: number,
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
            hexIndex: getAdjacentHex(
              hexIndex,
              direction,
              state.gridRows,
              state.gridCols,
              skipAmount,
            ),
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
        transpose: number = 0,
      ) {
        let notes: string[] = [hexNotes[hexIndex]];
        triad = mod(triad, 7);

        if (triad > 0) {
          notes.push(
            hexNotes[
              getAdjacentHex(
                hexIndex,
                triad - 1,
                state.gridRows,
                state.gridCols,
              )
            ],
          );
          notes.push(
            hexNotes[
              getAdjacentHex(hexIndex, triad, state.gridRows, state.gridCols)
            ],
          );
        }

        const key = getControlValue<"select">(state, {
          layerControl: "keyTonic",
          layer: layerIndex || "current",
        });
        const mode = getControlValue<"select">(state, {
          layerControl: "keyMode",
          layer: layerIndex || "current",
        }) as keyof typeof modes;
        const permittedNotes =
          key === "None"
            ? noteArray
            : notesForKey(noteArray.indexOf(key), mode).map(
                (noteIndex) => noteArray[noteIndex],
              );

        notes = notes.filter((note) => {
          return permittedNotes.includes(getNoteParts(note).name);
        });

        const transposed = notes.map((note) => {
          const finalTranspose =
            getControlValue<"int">(state, {
              layerControl: "transpose",
              layer: layerIndex,
            }) + transpose;
          return transposeNote(note, finalTranspose);
        });

        const channel = getControlValue<"int">(state, {
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
              getControlValue<"int">(state, {
                layerControl: "barLength",
                layer: layerIndex,
              })
          : Math.floor(currentBeat);
      },
      getBarLength(): number {
        return getControlValue<"int">(state, {
          layerControl: "barLength",
          layer: layerIndex,
        });
      },
      getLayerValue(key: LayerControlKey) {
        return getControlValue(state, { layerControl: key, layer: layerIndex });
      },
      getLayer(): number {
        return layerIndex;
      },
      getNumLayers(): number {
        return state.layers.length;
      },
      getNumHexes(): number {
        return state.gridCols * state.gridRows;
      },
      getCols(): number {
        return state.gridCols;
      },
      getRows(): number {
        return state.gridRows;
      },
    };

    return helpers;
  }

  private performStartCallbacks(state: AppState): AppState {
    const newLayers = array_copy(state.layers);
    const newTokens = { ...state.tokens };

    state.layers.forEach((layer, layerIndex) => {
      const newPlayheads: Playhead[][] = createEmpty2dArray(
        state.gridRows * state.gridCols,
      );

      // do token stuff //
      layer.tokenIds.forEach((hex, hexIndex) => {
        hex.forEach((tokenId) => {
          if (!settings.values.tokens[state.tokens[tokenId].uid].enabled)
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
              token,
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
      ...state,
      layers: newLayers,
      tokens: newTokens,
    };
  }

  private performStopCallbacks(state: AppState): AppState {
    const newLayers = array_copy(state.layers);
    const newTokens = { ...state.tokens };

    state.layers.forEach((layer, layerIndex) => {
      const newPlayheads: Playhead[][] = createEmpty2dArray(
        state.gridRows * state.gridCols,
      );

      // do token stuff //
      layer.tokenIds.forEach((hex, hexIndex) => {
        hex.forEach((tokenId) => {
          if (!settings.values.tokens[state.tokens[tokenId].uid].enabled)
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
              token,
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
      ...state,
      layers: newLayers,
      tokens: newTokens,
    };
  }

  private performTransfers(state: AppState, layerIndex: number): AppState {
    const newPlayheads = state.layers[layerIndex].playheads.slice(0);
    let changeMade = false;

    for (let i = this.awaitingLayerTransfer.length - 1; i >= 0; i--) {
      const awaiting = this.awaitingLayerTransfer[i];
      if (awaiting.dest.layerIndex === layerIndex) {
        newPlayheads[awaiting.dest.hexIndex].push(
          this.awaitingLayerTransfer.splice(i, 1)[0].playhead,
        );
        changeMade = true;
      }
    }

    if (changeMade) {
      return {
        ...state,
        layers: state.layers.map((l, li) =>
          li !== layerIndex
            ? l
            : {
                ...l,
                playheads: newPlayheads,
              },
        ),
      };
    } else {
      return state;
    }
  }

  private progressLayer(
    state: AppState,
    deltaMs: number,
    layerIndex: number,
  ): {
    resultingState: AppState;
    notesStarted: LayerNote[];
    notesStopped: LayerNote[];
  } {
    if (!state.isPlaying) {
      return {
        resultingState: state,
        notesStarted: [],
        notesStopped: [],
      };
    }

    const newLayers = array_copy(state.layers);
    const newTokens = { ...state.tokens };
    let newPlayheads: Playhead[][] = createEmpty2dArray(
      state.gridRows * state.gridCols,
    );
    const layer = state.layers[layerIndex];
    const bpm = getControlValue<"decimal">(state, layer.tempo);
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
                m.playheadIndex === playheadIndex,
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
              const adj = getAdjacentHex(
                hexIndex,
                playhead.direction,
                state.gridRows,
                state.gridCols,
              );

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
                  if (adj >= state.gridRows * state.gridCols - 12) return;
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
          if (!settings.values.tokens[state.tokens[tokenId].uid].enabled)
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
                token,
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
              token,
            );

            // console.log(token.store);

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const debug = token.callbacks.onTick.bind(null)(
              token.store,
              helpers,
              newPlayheads[hexIndex].map((p) =>
                objectWithoutKeys(p, ["store"]),
              ),
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
      },
    );
    newPlayingNotes ||= [];
    notesStopped ||= [];
    newPlayingNotes.push(...notesStarted);

    notesStarted.forEach((note) => {
      note.id = MidiScheduler.scheduleNoteOn({
        channel: getControlValue<"int">(state, {
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
        ...state,
        layers: newLayers,
        tokens: newTokens,
      },
      notesStarted,
      notesStopped,
    };
  }
}

// export class LookaheadDriver {
//   static state: AppState;
//   static stepMs: number = 2;

//   public static initialize(base: AppState) {
//     this.state = new AppState(base, true);
//   }

//   public static get currentTimeMs(): number | null {
//     return this.state.layers[0]?.currentTimeMs || null;
//   }

//   public static computeChunk(chunkMs: number) {
//     if (!this.state.layers.length) return;
//     const currentTimeMs = this.currentTimeMs!;

//     for (
//       let now = currentTimeMs;
//       now < currentTimeMs + chunkMs;
//       now += this.stepMs
//     ) {
//       for (let i = 0; i < this.state.layers.length; i++) {
//         const { notesStarted, notesStopped, resultingState } = progressLayer(
//           this.state,
//           this.stepMs,
//           i
//         );

//         this.state.dangerouslyReplaceValues(resultingState);
//         notesStarted.forEach((note) => {
//           note.id = MidiScheduler.scheduleNoteOn({
//             channel: this.getControlValue<"int">({state,
//               layerControl: "midiChannel",
//               layer: i,
//             }),
//             deviceName: () => settings.values.midiOutputs,
//             note: note.note,
//             time: this.state.layers[i].currentTimeMs,
//           });
//         });
//         notesStopped.forEach((note) => {
//           MidiScheduler.scheduleNoteOff({
//             id: note.id!,
//             time: this.state.layers[i].currentTimeMs,
//           });
//         });
//       }
//       for (let i = 0; i < this.state.layers.length; i++) {
//         performTransfers(this.state, i);
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
