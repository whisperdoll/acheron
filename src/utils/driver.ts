import { AppState, LayerState } from "../AppContext";
import { getControlValue, KeyMap, LayerNote, Playhead, Token } from "../Types";
import { getAdjacentHex, getNoteParts, hexIndexesFromNote, hexNotes, noteArray, NumHexes, transposeNote } from "./elysiumutils";
import { array_copy, createEmpty2dArray, mod, NsToMs, NsToS, objectWithoutKeys } from "./utils";
import Midi, { MidiNote } from "./midi";
import { LayerControlKey } from "./DefaultDefinitions";

const rows = 12;
const cols = 17;
let scheduledForRemoval: [] = [];
let scheduledForMove: { src: { hexIndex: number, layerIndex: number }, dest: { hexIndex: number, layerIndex: number }, playheadIndex: number }[] = [];
let awaitingLayerTransfer: { dest: { hexIndex: number, layerIndex: number }, playhead: Playhead }[] = [];
let notesToAdd: LayerNote[] = [];

function buildHelpers(appState: AppState, layerIndex: number, currentBeat: number, currentMs: number, newPlayheads: Playhead[][], hexIndex: number, token: Token): Record<string, Function>
{
    const helpers = {
        getControlValue(key: string)
        {
            const controls = token.controlIds.map(id => appState.controls[id]);

            if (controls.some(c => c.key === key))
            {
                return getControlValue(appState, layerIndex, controls.find(c => c.key === key)!);
            }
            else
            {
                return null;
            }
        },
        getControlValues()
        {
            const ret: Record<string, any> = {};
            token.controlIds.forEach(id => ret[appState.controls[id].key] = getControlValue(appState, layerIndex, appState.controls[id]));

            return ret;
        },
        getOtherTokenInstances()
        {
            const ret: Record<string, any>[] = [];
            appState.layers.forEach((layer, li) =>
            {
                layer.tokenIds.forEach((tidArray, hi) =>
                {
                    tidArray.forEach((tid) =>
                    {
                        const t = appState.tokens[tid];
                        if (t.uid === token.uid && t.id !== token.id)
                        {
                            const toAdd: Record<string, any> = {};
                            toAdd.hexIndex = hi;
                            toAdd.layerIndex = li;
                            t.controlIds.forEach((cid) =>
                            {
                                toAdd[appState.controls[cid].key] = getControlValue(
                                    appState,
                                    layerIndex,
                                    appState.controls[cid]
                                );
                            });
                            ret.push(toAdd);
                        }
                    });
                });
            });
            return ret;
        },
        spawnPlayhead(hexIndex: number, timeToLive: number, direction: 0 | 1 | 2 | 3 | 4 | 5, offset: number = 0)
        {
            newPlayheads[getAdjacentHex(hexIndex, direction, offset)].push({
                age: 0,
                direction,
                lifespan: timeToLive,
                store: {}
            });
        },
        getHexIndex()
        {
            return hexIndex;
        },
        isMidiPlaying()
        {
            return appState.layers[layerIndex].midiBuffer.some(n => hexIndexesFromNote(n.name).includes(hexIndex));
        },
        modifyPlayhead(playheadIndex: number, newPlayheadDef: Partial<Playhead>)
        {
            if (playheadIndex < 0 || playheadIndex >= newPlayheads[hexIndex].length) return;

            const newPlayhead: Playhead = {...(newPlayheads[hexIndex][playheadIndex])};
            if (newPlayheadDef.age !== undefined) newPlayhead.age = newPlayheadDef.age;
            if (newPlayheadDef.lifespan !== undefined) newPlayhead.lifespan = newPlayheadDef.lifespan;
            if (newPlayheadDef.direction !== undefined) newPlayhead.direction = newPlayheadDef.direction;
            newPlayheads[hexIndex][playheadIndex] = newPlayhead;
        },
        getPlayheadStore(playheadIndex: number)
        {
            if (playheadIndex < 0 || playheadIndex >= newPlayheads[hexIndex].length) return {};
            return newPlayheads[hexIndex][playheadIndex].store;
        },
        warpPlayhead(playheadIndex: number, newHexIndex: number, newLayerIndex?: number)
        {
            if (playheadIndex < 0 || playheadIndex >= newPlayheads[hexIndex].length) return;
            newLayerIndex = newLayerIndex ?? layerIndex;
            if (newLayerIndex >= appState.layers.length || newLayerIndex < 0) return;

            const existingIndex = scheduledForMove.findIndex(m =>
                m.src.hexIndex === hexIndex &&
                m.src.layerIndex === layerIndex &&
                m.playheadIndex === playheadIndex    
            );

            const newMoveInfo = {
                playheadIndex,
                src: {
                    hexIndex,
                    layerIndex
                },
                dest: {
                    hexIndex: newHexIndex,
                    layerIndex: newLayerIndex
                }
            };

            if (existingIndex === -1)
            {
                scheduledForMove.push(newMoveInfo);
            }
            else
            {
                scheduledForMove[existingIndex] = newMoveInfo;
            }

            scheduledForMove.push();
        },
        skipPlayhead(playheadIndex: number, direction: number, skipAmount: number)
        {
            if (playheadIndex < 0 || playheadIndex >= newPlayheads[hexIndex].length) return;

            scheduledForMove.push({
                playheadIndex,
                src: {
                    hexIndex,
                    layerIndex
                },
                dest: { 
                    hexIndex: getAdjacentHex(hexIndex, direction, skipAmount),
                    layerIndex
                }
            });
        },
        // removePlayhead(playheadIndex: number)
        // {
        //     if (playheadIndex < 0 || playheadIndex >= newPlayheads[hexIndex].length) return;

        //     scheduledForRemoval.push(playheadIndex);
        // },
        oppositeDirection(direction: number)
        {
            return (direction + 3) % 6;
        },
        playTriad(hexIndex: number, triad: number, duration: number, durationType: "beat" | "ms", velocity: number, transpose: number = 0)
        {
            let notes: string[] = [hexNotes[hexIndex]];
            triad = mod(triad, 7);

            if (triad > 0)
            {
                notes.push(hexNotes[getAdjacentHex(hexIndex, triad - 1)]);
                notes.push(hexNotes[getAdjacentHex(hexIndex, triad)]);
            }

            const key = getControlValue(appState, layerIndex, appState.controls[appState.layers[layerIndex].key]) as keyof typeof KeyMap;
            const permittedNotes = KeyMap[key].map(ni => noteArray[ni]);
            
            notes = notes.filter((note) =>
            {
                return permittedNotes.includes(getNoteParts(note).name);
            });

            const transposed = notes.map((note) =>
            {
                const finalTranspose = (getControlValue(appState, layerIndex, appState.controls[appState.layers[layerIndex].transpose]) as number) + transpose;
                return transposeNote(note, finalTranspose);
            });

            const channel = getControlValue(
                appState,
                layerIndex,
                appState.controls[appState.layers[layerIndex].midiChannel]
            );

            Midi.noteOn(transposed, appState.settings.midiOutputs, channel, {
                velocity
            });

            notesToAdd.push({
                end: durationType === "beat" ? currentBeat + duration : currentMs + duration,
                notes: transposed,
                type: durationType,
                channel,
                outputNames: appState.settings.midiOutputs
            });

            console.log(notesToAdd, currentBeat, currentMs, duration);
        },
        getCurrentBeat(withinBar: boolean = true): number
        {
            return withinBar ?
                Math.floor(currentBeat) % getControlValue(appState, layerIndex, appState.controls[appState.layers[layerIndex].barLength]) :
                Math.floor(currentBeat);
        },
        getBarLength(): number
        {
            return getControlValue(appState, layerIndex, appState.controls[appState.layers[layerIndex].barLength]);
        },
        getLayerValue(key: LayerControlKey)
        {
            return getControlValue(appState, layerIndex, appState.controls[appState.layers[layerIndex][key]]);
        },
        getLayer(): number
        {
            return layerIndex;
        },
        getNumLayers(): number
        {
            return appState.layers.length;
        }
    };

    return helpers;
}

const initializedTokens: Set<string> = new Set<string>();

export function performStartCallbacks(appState: AppState): AppState
{
    const newLayers = array_copy(appState.layers);
    let newTokens = {...appState.tokens};

    appState.layers.forEach((layer, layerIndex) =>
    {
        let newPlayheads: Playhead[][] = createEmpty2dArray(NumHexes);
        
        // do token stuff //
        layer.tokenIds.forEach((hex, hexIndex) =>
        {
            hex.forEach((tokenId) =>
            {
                if (!appState.settings.tokens[appState.tokens[tokenId].uid].enabled) return;

                const token = {...newTokens[tokenId]};

                if (token.callbacks.onStart)
                {
                    const helpers = buildHelpers(
                        appState,
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

                initializedTokens.add(tokenId);
            });
        });

        newLayers[layerIndex] = {
            ...layer,
            playheads: newPlayheads
        };
    });
    
    return {
        ...appState,
        layers: newLayers,
        tokens: newTokens
    };
}

export function performStopCallbacks(appState: AppState): AppState
{
    const newLayers = array_copy(appState.layers);
    let newTokens = {...appState.tokens};

    appState.layers.forEach((layer, layerIndex) =>
    {
        let newPlayheads: Playhead[][] = createEmpty2dArray(NumHexes);
        
        // do token stuff //
        layer.tokenIds.forEach((hex, hexIndex) =>
        {
            hex.forEach((tokenId) =>
            {
                if (!appState.settings.tokens[appState.tokens[tokenId].uid].enabled) return;
                
                const token = {...newTokens[tokenId]};

                if (token.callbacks.onStop)
                {
                    const helpers = buildHelpers(
                        appState,
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
            playheads: newPlayheads
        };
    });
    
    initializedTokens.clear();

    return {
        ...appState,
        layers: newLayers,
        tokens: newTokens
    };
}

export function performTransfers(appState: AppState, layerIndex: number): AppState
{
    const newPlayheads = appState.layers[layerIndex].playheads.slice(0);
    let changeMade = false;

    for (let i = awaitingLayerTransfer.length - 1; i >= 0; i--)
    {
        const awaiting = awaitingLayerTransfer[i];
        if (awaiting.dest.layerIndex === layerIndex)
        {
            newPlayheads[awaiting.dest.hexIndex].push(awaitingLayerTransfer.splice(i, 1)[0].playhead);
            changeMade = true;
        }
    }

    if (changeMade)
    {
        return {
            ...appState,
            layers: appState.layers.map((l, li) => li !== layerIndex ? l : {
                ...l,
                playheads: newPlayheads
            })
        };
    }
    else
    {
        return appState;
    }
}

export function progressLayer(appState: AppState, deltaNs: number, layerIndex: number): AppState
{
    const newLayers = array_copy(appState.layers);
    let newTokens = {...appState.tokens};
    let newPlayheads: Playhead[][] = createEmpty2dArray(NumHexes);
    const layer = appState.layers[layerIndex];
    const beatDelta = NsToS(deltaNs) / (60 / getControlValue(appState, layerIndex, appState.controls[layer.tempo]));
    const deltaMs = NsToMs(deltaNs);
    // console.log(layer.currentBeat, layer.currentBeat === 0, Math.floor(layer.currentBeat + beatDelta) > layer.currentBeat);

    if (appState.isPlaying)
    {
        let shouldClearMidiBuffer = false;

        if (layer.enabled && (layer.currentBeat === 0 || Math.floor(layer.currentBeat + beatDelta) > layer.currentBeat))
        {
            // move any playheads //
            layer.playheads.forEach((hex, hexIndex) =>
            {
                hex.forEach((playhead, playheadIndex) =>
                {
                    if (playhead.age < playhead.lifespan)
                    {
                        const newPlayhead = {
                            ...playhead,
                            age: playhead.age + 1
                        };

                        const moveInfoIndex = scheduledForMove.findIndex(m =>
                            m.src.layerIndex === layerIndex &&
                            m.src.hexIndex === hexIndex &&
                            m.playheadIndex === playheadIndex
                        );

                        if (moveInfoIndex !== -1)
                        {
                            const moveInfo = scheduledForMove[moveInfoIndex];
                            if (moveInfo.dest.layerIndex === layerIndex)
                            {
                                newPlayheads[moveInfo.dest.hexIndex].push(newPlayhead);
                            }
                            else
                            {
                                awaitingLayerTransfer.push({
                                    dest: moveInfo.dest,
                                    playhead: { ...playhead }
                                });
                            }
                            scheduledForMove.splice(moveInfoIndex, 1);
                        }
                        else
                        {
                            const adj = getAdjacentHex(hexIndex, playhead.direction);
    
                            if (!appState.settings.wrapPlayheads)
                            {
                                if ([1,2].includes(playhead.direction)) // right
                                {
                                    if (adj < 12) return;
                                }
                                if ([5,0,1].includes(playhead.direction)) // up
                                {
                                    if ((adj + 1) % 12 === 0) return;
                                }
                                if ([2,3,4].includes(playhead.direction)) // down
                                {
                                    if (adj % 12 === 0) return;
                                }
                                if ([4,5].includes(playhead.direction)) // left
                                {
                                    if (adj >= NumHexes - 12) return;
                                }
                            }
    
                            newPlayheads[adj].push(newPlayhead);
                        }
                    }
                });
            });
            
            // do token stuff //
            layer.tokenIds.forEach((hex, hexIndex) =>
            {
                hex.forEach((tokenId) =>
                {
                    if (!appState.settings.tokens[appState.tokens[tokenId].uid].enabled) return;

                    const token = {...newTokens[tokenId]};

                    if (!initializedTokens.has(tokenId))
                    {
                        if (token.callbacks.onStart)
                        {
                            const helpers = buildHelpers(
                                appState,
                                layerIndex,
                                layer.currentBeat + beatDelta,
                                layer.currentTimeMs + deltaMs,
                                newPlayheads,
                                hexIndex,
                                token
                            );

                            token.callbacks.onStart.bind(null)(token.store, helpers);
                            newTokens[tokenId] = token;
                        }
                    }

                    if (token.callbacks.onTick)
                    {
                        const helpers = buildHelpers(
                            appState,
                            layerIndex,
                            layer.currentBeat + beatDelta,
                            layer.currentTimeMs + deltaMs,
                            newPlayheads,
                            hexIndex,
                            token
                        );

                        // console.log(token.store);
                        
                        const debug = token.callbacks.onTick.bind(null)(
                            token.store,
                            helpers,
                            newPlayheads[hexIndex].map(p => objectWithoutKeys(p, ["store"]))
                        );
                        // console.log(debug);
                        newTokens[tokenId] = token;
                    }
                });
            });

            shouldClearMidiBuffer = true;
        }
        else
        {
            newPlayheads = layer.playheads;
        }

        const protoLayer: LayerState = {
            ...layer,
            playheads: newPlayheads,
            currentTimeMs: layer.currentTimeMs + deltaMs,
            currentBeat: layer.currentBeat + beatDelta,
            playingNotes:layer.playingNotes === undefined ? []:layer.playingNotes.filter(n => {
                const cmp = n.type === "beat" ? layer.currentBeat + beatDelta : layer.currentTimeMs + deltaMs;
                if (n.end <= cmp)
                {
                    Midi.noteOff(n.notes, n.outputNames, n.channel);
                    return false;
                }
                return true;
            }).concat(notesToAdd)
        };

        notesToAdd = [];

        if (!shouldClearMidiBuffer)
        {
            newLayers[layerIndex] = protoLayer;
        }
        else
        {
            newLayers[layerIndex] = {
                ...protoLayer,
                midiBuffer: []
            };
        }
    }

    return {
        ...appState,
        layers: newLayers,
        tokens: newTokens
    };
}

// export function progressLayers(appState: AppState): AppState
// {
//     const layers = appState.layers;
//     const newLayers = array_copy(layers);
//     let newTokens = {...appState.tokens};

//     layers.forEach((layer, layerIndex) =>
//     {
//         let newPlayheads: Playhead[][] = createEmpty2dArray(NumHexes);
        
//         if (layer.enabled)
//         {
//             // move any playheads //
//             layer.playheads.forEach((hex, hexIndex) =>
//             {
//                 hex.forEach((playhead) =>
//                 {
//                     if (playhead.age < playhead.lifespan)
//                     {
//                         const newPlayhead = {
//                             ...playhead,
//                             age: playhead.age + 1
//                         };

//                         const adj = getAdjacentHex(hexIndex, playhead.direction);

//                         if (!appState.settings.wrapPlayheads)
//                         {
//                             if ([1,2].includes(playhead.direction)) // right
//                             {
//                                 if (adj < 12) return;
//                             }
//                             if ([5,0,1].includes(playhead.direction)) // up
//                             {
//                                 if ((adj + 1) % 12 === 0) return;
//                             }
//                             if ([2,3,4].includes(playhead.direction)) // down
//                             {
//                                 if (adj % 12 === 0) return;
//                             }
//                             if ([4,5].includes(playhead.direction)) // left
//                             {
//                                 if (adj >= NumHexes - 12) return;
//                             }
//                         }

//                         newPlayheads[adj].push(newPlayhead);
//                     }
//                 });
//             });
            
//             // do token stuff //
//             layer.tokenIds.forEach((hex, hexIndex) =>
//             {
//                 hex.forEach((tokenId) =>
//                 {
//                     const token = {...newTokens[tokenId]};

//                     if (!initializedTokens.has(tokenId))
//                     {
//                         if (token.callbacks.onStart)
//                         {
//                             const helpers = buildHelpers(
//                                 appState,
//                                 layerIndex,
//                                 newPlayheads,
//                                 hexIndex,
//                                 token
//                             );

//                             token.callbacks.onStart(token.store, helpers);
//                             newTokens[tokenId] = token;
//                         }
//                     }

//                     scheduledForRemoval = [];
//                     if (token.callbacks.onTick)
//                     {
//                         const helpers = buildHelpers(
//                             appState,
//                             layerIndex,
//                             newPlayheads,
//                             hexIndex,
//                             token
//                         );

//                         // console.log(token.store);
                        
//                         const debug = token.callbacks.onTick(token.store, helpers, newPlayheads[hexIndex]);
//                         // console.log(debug);
//                         newTokens[tokenId] = token;
//                     }
//                     scheduledForRemoval.sort((a, b) => b - a);
//                     scheduledForRemoval.forEach(i => newPlayheads[hexIndex].splice(i, 1));
//                 });
//             });
//         }

//         newLayers[layerIndex] = {
//             ...layer,
//             playheads: newPlayheads
//         };
//     });

//     return {
//         ...appState,
//         layers: newLayers,
//         tokens: newTokens
//     };
// }
