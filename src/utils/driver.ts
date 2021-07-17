import { AppState, LayerState } from "../AppContext";
import { getControlValue, KeyMap, Playhead, Token } from "../Types";
import { getAdjacentHex, getNoteParts, hexNotes, noteArray, NumHexes, transposeNote } from "./elysiumutils";
import { array_copy, createEmpty2dArray, mod, NsToS } from "./utils";
import Midi from "./midi";

const rows = 12;
const cols = 17;
let scheduledForRemoval: [] = [];
let scheduledForMove: { srcHex: number, destHex: number, playheadIndex: number }[] = [];

function buildHelpers(appState: AppState, layerIndex: number, currentBeat: number, newPlayheads: Playhead[][], hexIndex: number, token: Token): Record<string, Function>
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
        spawnPlayhead(hexIndex: number, timeToLive: number, direction: 0 | 1 | 2 | 3 | 4 | 5, offset: number = 0)
        {
            newPlayheads[getAdjacentHex(hexIndex, direction, offset)].push({
                age: 0,
                direction,
                lifespan: timeToLive,
            });
        },
        getHexIndex()
        {
            return hexIndex;
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
        warpPlayhead(playheadIndex: number, newHexIndex: number)
        {
            if (playheadIndex < 0 || playheadIndex >= newPlayheads[hexIndex].length) return;

            scheduledForMove.push({
                playheadIndex,
                destHex: newHexIndex % NumHexes,
                srcHex: hexIndex
            });
        },
        skipPlayhead(playheadIndex: number, direction: number, skipAmount: number)
        {
            if (playheadIndex < 0 || playheadIndex >= newPlayheads[hexIndex].length) return;

            scheduledForMove.push({
                playheadIndex,
                destHex: getAdjacentHex(hexIndex, direction, skipAmount),
                srcHex: hexIndex
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
        playTriad(hexIndex: number, triad: number, durationMs: number, velocity: number, transpose: number = 0)
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

            Midi.playNotes(transposed, appState.selectedOutputs, getControlValue(appState, layerIndex, appState.controls[appState.layers[layerIndex].midiChannel]), {
                durationMs,
                velocity
            });
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
                console.log(appState.settings, tokenId, appState.tokens[tokenId]);
                if (!appState.settings.tokens[appState.tokens[tokenId].uid].enabled) return;

                const token = {...newTokens[tokenId]};

                if (token.callbacks.onStart)
                {
                    const helpers = buildHelpers(
                        appState,
                        layerIndex,
                        layer.currentBeat,
                        newPlayheads,
                        hexIndex,
                        token
                    );

                    token.callbacks.onStart(token.store, helpers);
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
                        newPlayheads,
                        hexIndex,
                        token
                    );

                    token.callbacks.onStop(token.store, helpers);
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

export function progressLayer(appState: AppState, deltaNs: number, layerIndex: number): AppState
{
    const newLayers = array_copy(appState.layers);
    let newTokens = {...appState.tokens};
    let newPlayheads: Playhead[][] = createEmpty2dArray(NumHexes);
    const layer = appState.layers[layerIndex];
    const beatDelta = NsToS(deltaNs) / (60 / getControlValue(appState, layerIndex, appState.controls[layer.tempo]));
    // console.log(layer.currentBeat, layer.currentBeat === 0, Math.floor(layer.currentBeat + beatDelta) > layer.currentBeat);

    if (appState.isPlaying)
    {
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

                        const moveInfo = scheduledForMove.find(m => m.srcHex === hexIndex && m.playheadIndex === playheadIndex);

                        if (moveInfo)
                        {
                            newPlayheads[moveInfo.destHex].push(newPlayhead);
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

            scheduledForMove = [];
            
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
                                newPlayheads,
                                hexIndex,
                                token
                            );

                            token.callbacks.onStart(token.store, helpers);
                            newTokens[tokenId] = token;
                        }
                    }

                    if (token.callbacks.onTick)
                    {
                        const helpers = buildHelpers(
                            appState,
                            layerIndex,
                            layer.currentBeat + beatDelta,
                            newPlayheads,
                            hexIndex,
                            token
                        );

                        // console.log(token.store);
                        
                        const debug = token.callbacks.onTick(token.store, helpers, newPlayheads[hexIndex]);
                        // console.log(debug);
                        newTokens[tokenId] = token;
                    }
                });
            });
        }
        else
        {
            newPlayheads = layer.playheads;
        }

        newLayers[layerIndex] = {
            ...layer,
            playheads: newPlayheads,
            currentBeat: layer.currentBeat + beatDelta
        };
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