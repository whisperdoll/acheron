import App from "./App";
import React, { useReducer, FunctionComponent } from "react";
import { array_remove, array_remove_at, boolToSort, capitalize, filesFromDirectoryR, getUserDataPath, objectWithoutKeys } from "./utils/utils";
import { SafeWriter } from "./utils/safewriter";
import * as path from "path";
import * as fs from "fs";
import { buildLayer } from "./Layers";
import { ControlState, Token, ControlDefinition, Playhead, getControlValue, Lfo, TokenDefinition, TokenCallbacks, TokenUID, TokenInstanceId, ControlInstanceId } from "./Types";
import { buildFromDefs, DefaultPlayerControls, LayerControlKey, PlayerControlKey } from "./utils/DefaultDefinitions";
import { MidiOutput } from "./utils/midi";
import { v4 as uuidv4 } from 'uuid';
import { buildToken, copyToken } from "./Tokens";
import { migrateSettings } from "./migrators";

export interface TokenSettings
{
    shortcut: string;
    enabled: boolean;
}

export interface AppSettings
{
    isFirstRun: boolean;
    version: number;
    playNoteOnClick: boolean;
    wrapPlayheads: boolean;
    tokens: Record<TokenUID, TokenSettings>;
    confirmDelete: boolean;
    tokenSearchPaths: string[];
}

export interface LayerState
{
    name: string;
    enabled: string;
    midiChannel: string;
    key: string;
    transpose: string;
    tempo: string;
    barLength: string;
    currentBeat: number;
    velocity: string;
    emphasis: string;
    tempoSync: boolean;
    noteLength: string;
    timeToLive: string;
    pulseEvery: string;
    tokenIds: string[][]; // each hex has an array of tokens
    playheads: Playhead[][]; // each hex has an array of playheads
}

export interface AppState
{
    selectedHex: { hexIndex: number, layerIndex: number };
    controls: Record<ControlInstanceId, ControlState>;
    tokens: Record<TokenInstanceId, Token>;
    tokenDefinitions: Record<TokenUID, TokenDefinition>;
    tokenCallbacks: Record<TokenUID, TokenCallbacks>;
    transpose: ControlInstanceId;
    tempo: ControlInstanceId;
    barLength: ControlInstanceId;
    velocity: ControlInstanceId;
    emphasis: ControlInstanceId;
    noteLength: ControlInstanceId;
    timeToLive: ControlInstanceId;
    pulseEvery: ControlInstanceId;
    layers: LayerState[];
    settings: AppSettings;
    isPlaying: boolean;
    startTime: bigint;
    allowedOutputs: MidiOutput[];
    selectedOutputs: string[];
    currentBeat: number;
    pulseSwitch: boolean;
    editingLfo: { controlId: string } | null;
    draggingType: "move" | "copy";
    isDragging: boolean;
    draggingSourceHex: { layerIndex: number, hexIndex: number };
    draggingDestHex: { layerIndex: number, hexIndex: number };
}

export const initialSettings : AppSettings = {
    isFirstRun: true,
    version: 1,
    playNoteOnClick: true,
    wrapPlayheads: true,
    tokens: {},
    confirmDelete: true,
    tokenSearchPaths: [ path.normalize("./tokens") ]
};

const initialState : AppState = {
    settings: initialSettings,
    selectedHex: { hexIndex: -1, layerIndex: 0 },
    controls: {...DefaultPlayerControls }, // appended to after layer contruction
    tokens: {},
    barLength: Object.entries(DefaultPlayerControls).find(e => e[1].key === "barLength")![0],
    emphasis: Object.entries(DefaultPlayerControls).find(e => e[1].key === "emphasis")![0],
    noteLength: Object.entries(DefaultPlayerControls).find(e => e[1].key === "noteLength")![0],
    pulseEvery: Object.entries(DefaultPlayerControls).find(e => e[1].key === "pulseEvery")![0],
    tempo: Object.entries(DefaultPlayerControls).find(e => e[1].key === "tempo")![0],
    timeToLive: Object.entries(DefaultPlayerControls).find(e => e[1].key === "timeToLive")![0],
    transpose: Object.entries(DefaultPlayerControls).find(e => e[1].key === "transpose")![0],
    velocity: Object.entries(DefaultPlayerControls).find(e => e[1].key === "velocity")![0],
    layers: [], // appended to after layer contruction
    isPlaying: false,
    startTime: 0n,
    allowedOutputs: [],
    selectedOutputs: [],
    currentBeat: 0,
    pulseSwitch: false,
    editingLfo: null,
    tokenCallbacks: {},
    tokenDefinitions: {},
    draggingDestHex: { layerIndex: -1, hexIndex: -1 },
    draggingSourceHex: { layerIndex: -1, hexIndex: -1 },
    draggingType: "move",
    isDragging: false
};

const initialLayer = buildLayer(initialState);

initialState.controls = { ...initialState.controls, ...initialLayer.controls };
initialState.layers = [ initialLayer.layerState ];

function saveSettings(state: AppState)
{
    const settings: AppSettings = {...initialSettings};
    for (const key in initialSettings)
    {
        (settings as any)[key] = (state.settings as any)[key];
    }
    
    SafeWriter.write(path.join(getUserDataPath(), "settings.json"), JSON.stringify(settings));
}

export function loadSettings(): AppSettings
{
    const newSettings: AppSettings = {...initialSettings};
    let loadedSettings: AppSettings = {...initialSettings};

    try
    {
        loadedSettings = migrateSettings(JSON.parse(fs.readFileSync(path.join(getUserDataPath(), "settings.json"), "utf8")));
    }
    catch
    {
        // whatever i didnt want to load them anyway
    }
    
    for (const key in initialSettings)
    {
        if (Object.prototype.hasOwnProperty.call(loadedSettings, key))
        {
            (newSettings as any)[key] = (loadedSettings as any)[key];
        }
    }

    return newSettings;
}

type Action = (
    | { type: "setAppState", payload: AppState }
    | { type: "setSettings", payload: AppSettings }
    | { type: "setSelectedHex", payload: { hexIndex: number, layerIndex: number } }
    | { type: "setControl", payload: { id: string, controlState: ControlState }}
    | { type: "setToken", payload: { id: string, newToken: Token }}
    | { type: "setLayer", payload: { layerIndex: number, layerState: LayerState }}
    | { type: "addTokenToSelected", payload: { tokenKey: string }}
    | { type: "addTokenToHex", payload: { tokenUid: TokenUID, hexIndex: number, layerIndex: number }}
    | { type: "removeTokenFromSelected", payload: { tokenIndex: number }}
    | { type: "removeTokenFromHex", payload: { tokenId: string, hexIndex: number, layerIndex: number }}
    | { type: "toggleIsPlaying" }
    | { type: "addLayer", payload?: { select: boolean }}
    | { type: "setCurrentLayerName", payload: string }
    | { type: "removeCurrentLayer" }
    | { type: "setLayers", payload: LayerState[] }
    | { type: "setPlayheads", payload: { layerIndex: number, playheads: Playhead[][] } }
    | { type: "setAllowedOutputs", payload: MidiOutput[] }
    | { type: "setSelectedOutputs", payload: string[] }
    | { type: "pulse" }
    | { type: "editLfo", payload: { controlId: string } }
    | { type: "stopEditingLfo" }
    | { type: "setLfo", payload: { controlId: string, lfo: Lfo }}
    | { type: "setTokenDefinition", payload: { definition: TokenDefinition, callbacks: TokenCallbacks, enabled?: boolean } }
    | { type: "removeTokenDefinition", payload: TokenUID }
    | { type: "setTokenShortcut", payload: { uid: TokenUID, shortcut: string }}
    | { type: "clearTokenShortcut", payload: TokenUID }
    | { type: "copyHex", payload: { srcLayerIndex: number, destLayerIndex: number, srcHexIndex: number, destHexIndex: number }}
    | { type: "moveHex", payload: { srcLayerIndex: number, destLayerIndex: number, srcHexIndex: number, destHexIndex: number }}
    | { type: "clearHex", payload: { layerIndex: number, hexIndex: number }}
    | { type: "setDraggingSourceHex", payload: { hexIndex: number, layerIndex: number } }
    | { type: "setDraggingDestHex", payload: { hexIndex: number, layerIndex: number } }
    | { type: "setDraggingType", payload: "move" | "copy" }
    | { type: "setIsDragging", payload: boolean }
    | { type: "toggleTokenEnabled", payload: TokenUID }
    | { type: "setTokenSearchPath", payload: { index: number, value: string, normalize: boolean }}
    | { type: "removeTokenSearchPath", payload: number }
    | { type: "addTokenSearchPath", payload: string }
    | { type: "enableAllTokens" }
    | { type: "setFirstRunFalse" }
    | { type: "saveSettings" }
) & {
    saveSettings?: boolean
}
;

export type ActionType = Action["type"];

function reducer(state: AppState, action: Action): AppState
{
    function figureItOut(): AppState
    {
        switch (action.type)
        {
            case "setAppState":
            {
                return action.payload;
            }
            case "saveSettings":
            {
                action = { ...action, saveSettings: true };
                return state;
            }
            case "setSettings":
                return {
                    ...state,
                    settings: action.payload
                };
            case "setLayer":
            {
                const newLayers = state.layers.slice(0);
                newLayers[action.payload.layerIndex] = action.payload.layerState;
                return {
                    ...state,
                    layers: newLayers
                };
            }
            case "setSelectedHex":
                // console.log(state);
                return {
                    ...state,
                    selectedHex: action.payload
                };
            case "addTokenToSelected":
            {
                if (state.selectedHex.hexIndex === -1) return state;
                
                const { tokenState, controls } = buildToken(state, action.payload.tokenKey);

                return {
                    ...state,
                    tokens: {
                        ...state.tokens,
                        [tokenState.id]: tokenState
                    },
                    controls: {
                        ...state.controls,
                        ...controls
                    },
                    layers: state.layers.map((layer, layerIndex) => layerIndex !== state.selectedHex.layerIndex ? layer : ({
                        ...layer,
                        tokenIds: layer.tokenIds.map((tokenIdArray, hexIndex) => hexIndex !== state.selectedHex.hexIndex ? tokenIdArray : (
                            tokenIdArray.concat([ tokenState.id ])
                        ))
                    }))
                };
            }
            case "addTokenToHex":
            {
                const { tokenState, controls } = buildToken(state, action.payload.tokenUid);

                return {
                    ...state,
                    tokens: {
                        ...state.tokens,
                        [tokenState.id]: tokenState
                    },
                    controls: {
                        ...state.controls,
                        ...controls
                    },
                    layers: state.layers.map((layer, layerIndex) => layerIndex !== action.payload.layerIndex ? layer : ({
                        ...layer,
                        tokenIds: layer.tokenIds.map((tokenIdArray, hexIndex) => hexIndex !== action.payload.hexIndex ? tokenIdArray : (
                            tokenIdArray.concat([ tokenState.id ])
                        ))
                    }))
                };
            }
            case "removeTokenFromSelected":
            {
                if (state.selectedHex.hexIndex === -1) return state;

                const tokenId = state.layers[state.selectedHex.layerIndex].tokenIds[state.selectedHex.hexIndex][action.payload.tokenIndex];
                const token = state.tokens[tokenId];
                
                return {
                    ...state,
                    tokens: objectWithoutKeys(state.tokens, [tokenId]),
                    controls: objectWithoutKeys(state.controls, token.controlIds),
                    layers: state.layers.map((layer, layerIndex) => layerIndex !== state.selectedHex.layerIndex ? layer : ({
                        ...layer,
                        tokenIds: layer.tokenIds.map((tokenIdArray, hexIndex) => hexIndex !== state.selectedHex.hexIndex ? tokenIdArray : (
                            tokenIdArray.filter(id => id !== tokenId)
                        )
                    )}))
                };
            }
            case "removeTokenFromHex":
            {
                return {
                    ...state,
                    tokens: objectWithoutKeys(state.tokens, [action.payload.tokenId]),
                    controls: objectWithoutKeys(state.controls, state.tokens[action.payload.tokenId].controlIds),
                    layers: state.layers.map((layer, layerIndex) => layerIndex !== action.payload.layerIndex ? layer : ({
                        ...layer,
                        tokenIds: layer.tokenIds.map((tokenIdArray, hexIndex) => hexIndex !== action.payload.hexIndex ? tokenIdArray : (
                            tokenIdArray.filter(id => id !== action.payload.tokenId)
                        )
                    )}))
                };
            }
            case "setToken":
            {
                return {
                    ...state,
                    tokens: {
                        ...state.tokens,
                        [action.payload.id]: action.payload.newToken
                    }
                };
            }
            case "toggleIsPlaying":
            {
                return {
                    ...state,
                    isPlaying: !state.isPlaying,
                    layers: state.layers.map(l => ({ ...l, currentBeat: 0 })),
                    startTime: process.hrtime.bigint()
                };
            }
            case "addLayer":
            {
                const { layerState, controls } = buildLayer(state);

                return {
                    ...state,
                    layers: state.layers.concat([ layerState ]),
                    selectedHex: action.payload && action.payload.select ? { ...state.selectedHex, layerIndex: state.layers.length } : state.selectedHex,
                    controls: {
                        ...state.controls,
                        ...controls
                    }
                };
            }
            case "setCurrentLayerName":
            {
                const newLayers = state.layers.slice(0);
                newLayers[state.selectedHex.layerIndex] = {
                    ...newLayers[state.selectedHex.layerIndex],
                    name: action.payload
                };

                return {
                    ...state,
                    layers: newLayers
                };
            }
            case "removeCurrentLayer":
            {
                if (state.layers.length === 1)
                {
                    return state;
                }
                
                const tokensToRemove = state.layers[state.selectedHex.layerIndex].tokenIds.reduce((acc, tids) => acc.concat(tids), []);
                const controlsToRemove = tokensToRemove.map(tid => state.tokens[tid].controlIds).reduce((acc, tids) => acc.concat(tids), []);
                
                return {
                    ...state,
                    layers: state.layers.filter((_, li) => li !== state.selectedHex.layerIndex),
                    tokens: objectWithoutKeys(state.tokens, tokensToRemove),
                    controls: objectWithoutKeys(state.controls, controlsToRemove),
                    selectedHex: {...state.selectedHex, layerIndex: Math.min(state.layers.length - 2, state.selectedHex.layerIndex)}
                };
            }
            case "setLayers":
            {
                return {
                    ...state,
                    layers: action.payload
                };
            }
            case "setAllowedOutputs":
            {
                return {
                    ...state,
                    allowedOutputs: action.payload,
                    selectedOutputs: state.selectedOutputs.filter(oid => action.payload.some(o => o.id === oid))
                };
            }
            case "setSelectedOutputs":
            {
                return {
                    ...state,
                    selectedOutputs: action.payload.filter(oid => state.allowedOutputs.some(o => o.id === oid))
                };
            }
            case "pulse":
            {
                return {
                    ...state,
                    pulseSwitch: !state.pulseSwitch
                };
            }
            case "editLfo":
            {
                return {
                    ...state,
                    editingLfo: action.payload
                };
            }
            case "stopEditingLfo":
            {
                return {
                    ...state,
                    editingLfo: null
                };
            }
            case "setLfo":
            {
                return {
                    ...state,
                    controls: {
                        ...state.controls,
                        [action.payload.controlId]: {
                            ...state.controls[action.payload.controlId],
                            lfo: action.payload.lfo
                        }
                    }
                };
            }
            case "setControl":
            {
                return {
                    ...state,
                    controls: {
                        ...state.controls,
                        [action.payload.id]: action.payload.controlState
                    }
                };
            }
            case "setTokenDefinition":
            {
                return {
                    ...state,
                    tokenDefinitions: {
                        ...state.tokenDefinitions,
                        [action.payload.definition.uid]: action.payload.definition
                    },
                    tokenCallbacks: {
                        ...state.tokenCallbacks,
                        [action.payload.definition.uid]: action.payload.callbacks
                    },
                    settings: Object.prototype.hasOwnProperty.call(state.settings.tokens, action.payload.definition.uid) ? {
                        ...state.settings,
                        tokens: {
                            ...state.settings.tokens,
                            [action.payload.definition.uid]: {
                                ...state.settings.tokens[action.payload.definition.uid],
                                enabled: action.payload.enabled ?? state.settings.tokens[action.payload.definition.uid].enabled
                            }
                        }
                     } : {
                        ...state.settings,
                        tokens: {
                            ...state.settings.tokens,
                            [action.payload.definition.uid]: {
                                shortcut: "",
                                enabled: action.payload.enabled ?? false
                            }
                        }
                    }
                };
            }
            case "removeTokenDefinition":
            {
                const tokensToRemove: string[] = [];
                const controlsToRemove: string[] = [];

                state.layers.forEach(layer =>
                {
                    layer.tokenIds.forEach(tokenIdArray =>
                    {
                        const toRemove = tokenIdArray.filter(id => state.tokens[id].uid === action.payload);
                        tokensToRemove.push(...toRemove);
                        toRemove.forEach(tid =>
                        {
                            controlsToRemove.push(...state.tokens[tid].controlIds);
                        });
                    });
                });

                return {
                    ...state,
                    tokenDefinitions: objectWithoutKeys(state.tokenDefinitions, [action.payload]),
                    tokenCallbacks: objectWithoutKeys(state.tokenCallbacks, [action.payload]),
                    settings: {
                        ...state.settings,
                        tokens: objectWithoutKeys(state.settings.tokens, [action.payload])
                    },
                    layers: state.layers.map((layer) =>
                    {
                        return {
                            ...layer,
                            tokenIds: layer.tokenIds.map(tidArray => tidArray.filter(tid => !tokensToRemove.includes(tid)))
                        };
                    }),
                    tokens: objectWithoutKeys(state.tokens, tokensToRemove),
                    controls: objectWithoutKeys(state.controls, controlsToRemove)
                };
            }
            case "setTokenShortcut":
            {
                return {
                    ...state,
                    settings: {
                        ...state.settings,
                        tokens: {
                            ...state.settings.tokens,
                            [action.payload.uid]: {
                                ...state.settings.tokens[action.payload.uid],
                                shortcut: action.payload.shortcut
                            }
                        }
                    }
                };
            }
            case "clearTokenShortcut":
            {
                return {
                    ...state,
                    settings: {
                        ...state.settings,
                        tokens: {
                            ...state.settings.tokens,
                            [action.payload]: {
                                ...state.settings.tokens[action.payload],
                                shortcut: ""
                            }
                        }
                    }
                };
            }
            case "copyHex":
            {
                const tokensToCopy = state.layers[action.payload.srcLayerIndex].tokenIds[action.payload.srcHexIndex].map(id => state.tokens[id]);
                let newControls: Record<string, ControlState> = {};
                let newTokens: Record<string, Token> = {};

                tokensToCopy.forEach((token) =>
                {
                    const { tokenState, controls } = copyToken(state, token);

                    newControls = { ...newControls, ...controls };
                    newTokens = { ...newTokens, [tokenState.id]: tokenState };
                });

                return {
                    ...state,
                    controls: { ...state.controls, ...newControls },
                    tokens: { ...state.tokens, ...newTokens },
                    layers: state.layers.map((layer, li) => li !== action.payload.destLayerIndex ? layer : {
                        ...layer,
                        tokenIds: layer.tokenIds.map((tidArray, hexIndex) => hexIndex !== action.payload.destHexIndex ? tidArray : (
                            Object.keys(newTokens)
                        ))
                    })
                };
            }
            case "moveHex":
            {
                return {
                    ...state,
                    layers: state.layers.map((layer, li) => {
                        let ret = layer;

                        if (li === action.payload.destLayerIndex)
                        {
                            ret = {
                                ...ret,
                                tokenIds: ret.tokenIds.map((tokenIdArray, hexIndex) => hexIndex !== action.payload.destHexIndex ? tokenIdArray : (
                                    state.layers[action.payload.srcLayerIndex].tokenIds[action.payload.srcHexIndex].slice(0)
                                ))
                            };
                        }
                        if (li === action.payload.srcLayerIndex)
                        {
                            ret = {
                                ...ret,
                                tokenIds: ret.tokenIds.map((tokenIdArray, hexIndex) => hexIndex !== action.payload.srcHexIndex ? tokenIdArray : [])
                            };
                        }

                        return ret;
                    })
                };
            }
            case "clearHex":
            {
                const tokens = state.layers[action.payload.layerIndex].tokenIds[action.payload.hexIndex].map(tid => state.tokens[tid]);

                return {
                    ...state,
                    controls: objectWithoutKeys(state.controls, tokens.map(t => t.controlIds).reduce((l, r) => l.concat(r), [])),
                    tokens: objectWithoutKeys(state.tokens, tokens.map(t => t.id)),
                    layers: state.layers.map((layer, layerIndex) => action.payload.layerIndex !== layerIndex ? layer : {
                        ...layer,
                        tokenIds: layer.tokenIds.map((tokenIdArray, hexIndex) => action.payload.hexIndex !== hexIndex ? tokenIdArray : [])
                    })
                }
            }
            case "setDraggingSourceHex":
            {
                return {
                    ...state,
                    draggingSourceHex: action.payload
                };
            }
            case "setDraggingDestHex":
            {
                return {
                    ...state,
                    draggingDestHex: action.payload
                };
            }
            case "setDraggingType":
            {
                return {
                    ...state,
                    draggingType: action.payload
                };
            }
            case "setIsDragging":
            {
                return {
                    ...state,
                    isDragging: action.payload
                }
            }
            case "toggleTokenEnabled":
            {                
                return {
                    ...state,
                    settings: {
                        ...state.settings,
                        tokens: {
                            ...state.settings.tokens,
                            [action.payload]: {
                                ...state.settings.tokens[action.payload],
                                enabled: !state.settings.tokens[action.payload].enabled
                            }
                        }
                    }
                };
            }
            case "setTokenSearchPath":
            {
                let p = action.payload.value;

                if (action.payload.normalize)
                {
                    p = path.normalize(p);
                }

                return {
                    ...state,
                    settings: {
                        ...state.settings,
                        tokenSearchPaths: state.settings.tokenSearchPaths.map((v, i) => i !== action.payload.index ? v : p)
                    }
                };
            }
            case "removeTokenSearchPath":
            {
                return {
                    ...state,
                    settings: {
                        ...state.settings,
                        tokenSearchPaths: state.settings.tokenSearchPaths.filter((_, i) => i !== action.payload)
                    }
                };
            }
            case "addTokenSearchPath":
            {
                return {
                    ...state,
                    settings: {
                        ...state.settings,
                        tokenSearchPaths: state.settings.tokenSearchPaths.concat([ action.payload ])
                    }
                };
            }
            case "enableAllTokens":
            {
                const newTokens = {...state.settings.tokens};

                for (const key in newTokens)
                {
                    newTokens[key].enabled = true;
                }

                return {
                    ...state,
                    settings: {
                        ...state.settings,
                        tokens: newTokens
                    }
                };
            }
            case "setFirstRunFalse":
            {
                return {
                    ...state,
                    settings: {
                        ...state.settings,
                        isFirstRun: false
                    }
                };
            }
            default:
                throw new Error("bad action type: " + (action as any).type);
        }
    }

    const newState = figureItOut();
    action.saveSettings && saveSettings(newState);
    return newState;
}

export const AppContext = React.createContext<{ state: AppState, dispatch: React.Dispatch<Action> } | null>(null);

interface Props
{
}

export const AppContextProvider: FunctionComponent<Props> = (props) =>
{
    const [ state, dispatch ] = useReducer(reducer, initialState);

    return (
        <AppContext.Provider value={{ state, dispatch }}>
            <App />
        </AppContext.Provider>
    )
};