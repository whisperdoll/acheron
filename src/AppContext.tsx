import App from "./App";
import React, { useReducer, FunctionComponent } from "react";
import { array_remove, array_remove_at, boolToSort, capitalize, filesFromDirectoryR, getUserDataPath, objectWithoutKeys } from "./utils/utils";
import { loadSongs } from "./utils/metadata";
import { SafeWriter } from "./utils/safewriter";
import * as path from "path";
import * as fs from "fs";
import { buildLayer } from "./Layers";
import { ControlState, Token, ControlDefinition, Playhead, getControlValue, Lfo, TokenDefinition, TokenCallbacks } from "./Types";
import { buildFromDefs, DefaultPlayerControls, LayerControlKey, PlayerControlKey } from "./utils/DefaultDefinitions";
import { MidiOutput } from "./utils/midi";
import { v4 as uuidv4 } from 'uuid';
import { buildToken, copyToken } from "./Tokens";

export interface TokenSettings
{
    shortcut: string;
}

export interface AppSettings
{
    playNoteOnClick: boolean;
    wrapPlayheads: boolean;
    tokens: Record<string, TokenSettings>;
    confirmDelete: boolean;
}

export interface LayerState
{
    name: string;
    enabled: boolean;
    midiChannel: number;
    key: number;
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
    selectedHex: number;
    controls: Record<string, ControlState>;
    tokens: Record<string, Token>;
    tokenDefinitions: Record<string, TokenDefinition>;
    tokenCallbacks: Record<string, TokenCallbacks>;
    transpose: string;
    tempo: string;
    barLength: string;
    velocity: string;
    emphasis: string;
    noteLength: string;
    timeToLive: string;
    pulseEvery: string;
    layers: LayerState[];
    settings: AppSettings;
    currentLayerIndex: number;
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

const initialSettings : AppSettings = {
    playNoteOnClick: true,
    wrapPlayheads: true,
    tokens: {},
    confirmDelete: true
};

const initialState : AppState = {
    settings: initialSettings,
    selectedHex: -1,
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
    currentLayerIndex: 0,
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
        loadedSettings = JSON.parse(fs.readFileSync(path.join(getUserDataPath(), "settings.json"), "utf8"));
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
    | { type: "setSelectedHex", payload: number }
    | { type: "setControl", payload: { id: string, controlState: ControlState }}
    | { type: "setToken", payload: { id: string, newToken: Token }}
    | { type: "setLayer", payload: { layerIndex: number, layerState: LayerState }}
    | { type: "addTokenToSelected", payload: { tokenKey: string }}
    | { type: "addTokenToHex", payload: { tokenPath: string, hexIndex: number, layerIndex: number }}
    | { type: "removeTokenFromSelected", payload: { tokenIndex: number }}
    | { type: "removeTokenFromHex", payload: { tokenId: string, hexIndex: number, layerIndex: number }}
    | { type: "toggleIsPlaying" }
    | { type: "setCurrentLayerIndex", payload: number }
    | { type: "addLayer" }
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
    | { type: "setTokenDefinition", payload: { path: string, definition: TokenDefinition, callbacks: TokenCallbacks } }
    | { type: "removeTokenDefinition", payload: { path: string } }
    | { type: "setTokenShortcut", payload: { path: string, shortcut: string }}
    | { type: "clearTokenShortcut", payload: { path: string } }
    | { type: "copyHex", payload: { srcLayerIndex: number, destLayerIndex: number, srcHexIndex: number, destHexIndex: number }}
    | { type: "moveHex", payload: { srcLayerIndex: number, destLayerIndex: number, srcHexIndex: number, destHexIndex: number }}
    | { type: "clearHex", payload: { layerIndex: number, hexIndex: number }}
    | { type: "setDraggingSourceHex", payload: { hexIndex: number, layerIndex: number } }
    | { type: "setDraggingDestHex", payload: { hexIndex: number, layerIndex: number } }
    | { type: "setDraggingType", payload: "move" | "copy" }
    | { type: "setIsDragging", payload: boolean }
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
                console.log(state);
                return {
                    ...state,
                    selectedHex: action.payload
                };
            case "addTokenToSelected":
            {
                if (state.selectedHex === -1) return state;
                
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
                    layers: state.layers.map((layer, layerIndex) => layerIndex !== state.currentLayerIndex ? layer : ({
                        ...layer,
                        tokenIds: layer.tokenIds.map((tokenIdArray, hexIndex) => hexIndex !== state.selectedHex ? tokenIdArray : (
                            tokenIdArray.concat([ tokenState.id ])
                        ))
                    }))
                };
            }
            case "addTokenToHex":
            {
                const { tokenState, controls } = buildToken(state, action.payload.tokenPath);

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
                if (state.selectedHex === -1) return state;

                const tokenId = state.layers[state.currentLayerIndex].tokenIds[state.selectedHex][action.payload.tokenIndex];
                const token = state.tokens[tokenId];
                
                return {
                    ...state,
                    tokens: objectWithoutKeys(state.tokens, [tokenId]),
                    controls: objectWithoutKeys(state.controls, token.controlIds),
                    layers: state.layers.map((layer, layerIndex) => layerIndex !== state.currentLayerIndex ? layer : ({
                        ...layer,
                        tokenIds: layer.tokenIds.map((tokenIdArray, hexIndex) => hexIndex !== state.selectedHex ? tokenIdArray : (
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
            case "setCurrentLayerIndex":
            {
                return {
                    ...state,
                    currentLayerIndex: action.payload
                }
            }
            case "addLayer":
            {
                const { layerState, controls } = buildLayer(state);

                return {
                    ...state,
                    layers: state.layers.concat([ layerState ]),
                    currentLayerIndex: state.layers.length,
                    controls: {
                        ...state.controls,
                        ...controls
                    }
                };
            }
            case "setCurrentLayerName":
            {
                const newLayers = state.layers.slice(0);
                newLayers[state.currentLayerIndex] = {
                    ...newLayers[state.currentLayerIndex],
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

                const newLayers = state.layers.slice(0);
                newLayers.splice(state.currentLayerIndex, 1);

                return {
                    ...state,
                    layers: newLayers,
                    currentLayerIndex: Math.max(0, state.currentLayerIndex - 1)
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
                        [action.payload.path]: action.payload.definition
                    },
                    tokenCallbacks: {
                        ...state.tokenCallbacks,
                        [action.payload.path]: action.payload.callbacks
                    },
                    settings: Object.prototype.hasOwnProperty.call(state.settings.tokens, action.payload.path) ? state.settings : {
                        ...state.settings,
                        tokens: {
                            ...state.settings.tokens,
                            [action.payload.path]: {
                                shortcut: ""
                            }
                        }
                    }
                };
            }
            case "removeTokenDefinition":
            {
                const newTokenDefs = { ...state.tokenDefinitions };
                delete newTokenDefs[action.payload.path];

                const newTokenCallbacks = { ...state.tokenCallbacks };
                delete newTokenCallbacks[action.payload.path];

                const newTokenSettings = { ...state.settings.tokens };
                delete newTokenSettings[action.payload.path];

                return {
                    ...state,
                    tokenDefinitions: newTokenDefs,
                    tokenCallbacks: newTokenCallbacks,
                    settings: {
                        ...state.settings,
                        tokens: newTokenSettings
                    }
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
                            [action.payload.path]: {
                                ...state.settings.tokens[action.payload.path],
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
                            [action.payload.path]: {
                                ...state.settings.tokens[action.payload.path],
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