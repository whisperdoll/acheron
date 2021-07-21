import { AppSettings, initialSettings, TokenSettings } from "./AppContext";
import { SerializedComposition, SerializedCompositionLayer, SerializedCompositionToken } from "./Serialization";
import { getTokenUIDFromPath } from "./Tokens";
import { KeyMap, NumMIDIChannels, TokenUID } from "./Types";
import { buildLfo, LayerControlTypes, PlayerControlKeys } from "./utils/DefaultDefinitions";
import { getInheritParts } from "./utils/elysiumutils";

interface LfoV1
{
    type: "sin"|"square"|"random"|"sequence"|"sawtooth";
    min: number;
    max: number;
    lowPeriod: number;
    hiPeriod: number;
    period: number;
    sequence: any[];
}

interface SerializedCompositionControlV1
{
    key: string;
    id: string;
    currentValueType: "scalar" | "lfo" | "inherit";
    inherit?: string;
    scalarValue: any;
    lfo: LfoV1;
}

interface SerializedCompositionTokenV1
{
    id: string;
    controls: SerializedCompositionControlV1[];
    path: string;
}

export interface SerializedCompositionTokenV2
{
    id: string;
    controls: SerializedCompositionControlV1[];
    uid: string;
}

interface SerializedCompositionLayerV1
{
    name: string;
    enabled: boolean;
    midiChannel: number;
    key: number;
    transpose: SerializedCompositionControlV1;
    tempo: SerializedCompositionControlV1;
    barLength: SerializedCompositionControlV1;
    velocity: SerializedCompositionControlV1;
    emphasis: SerializedCompositionControlV1;
    tempoSync: boolean;
    noteLength: SerializedCompositionControlV1;
    timeToLive: SerializedCompositionControlV1;
    pulseEvery: SerializedCompositionControlV1;
    tokenIds: string[][];
}

interface SerializedCompositionV1
{
    version: number;
    tokens: SerializedCompositionTokenV1[];
    global: {
        transpose: SerializedCompositionControlV1;
        tempo: SerializedCompositionControlV1;
        barLength: SerializedCompositionControlV1;
        velocity: SerializedCompositionControlV1;
        emphasis: SerializedCompositionControlV1;
        noteLength: SerializedCompositionControlV1;
        timeToLive: SerializedCompositionControlV1;
        pulseEvery: SerializedCompositionControlV1;
    };
    layers: SerializedCompositionLayerV1[];
}

export function migrateSettings(settings: Record<string, any>): AppSettings
{
    if (!settings.version)
    {
        const newTokens: Record<TokenUID, TokenSettings> = {};

        Object.entries(settings.tokens as Record<TokenUID, TokenSettings>).forEach(([tokenPath, tokenSettings]) =>
        {
            const uid = getTokenUIDFromPath(tokenPath);

            if (uid !== null)
            {
                newTokens[uid] = {
                    shortcut: tokenSettings.shortcut ?? "",
                    enabled: true
                };
            }
        });

        return {
            confirmDelete: settings.confirmDelete,
            playNoteOnClick: settings.playNoteOnClick,
            tokenSearchPaths: initialSettings.tokenSearchPaths.slice(0),
            tokens: newTokens,
            version: 1,
            wrapPlayheads: settings.wrapPlayheads,
            isFirstRun: true,
            midiInputs: [],
            midiOutputs: []
        };
    }

    return settings as AppSettings;
}

function migrateSerializedToken(serialized: SerializedCompositionTokenV1 | SerializedCompositionToken): SerializedCompositionToken | null
{
    if (Object.prototype.hasOwnProperty.call(serialized, "path"))
    {
        serialized = serialized as SerializedCompositionTokenV1;
        const uid = getTokenUIDFromPath(serialized.path);
        if (uid === null) return null;
        return {
            controls: serialized.controls,
            id: serialized.id,
            uid: uid
        };
    }

    return serialized as SerializedCompositionToken;
}

function migrateSerializedLayer(global: SerializedComposition["global"], serialized: SerializedCompositionLayerV1 | SerializedCompositionLayer): SerializedCompositionLayer
{
    if (!(serialized as any).version || (serialized as any).version === 1)
    {
        serialized = serialized as SerializedCompositionLayerV1;
        // v1 //
        let ret: SerializedCompositionLayer = {
            ...serialized,
            version: 2,
            enabled: {
                id: "",
                currentValueType: "scalar",
                key: "enabled",
                lfo: buildLfo("bool"),
                scalarValue: serialized.enabled
            },
            midiChannel: {
                id: "",
                currentValueType: "scalar",
                key: "midiChannel",
                lfo: buildLfo("int", 1, NumMIDIChannels),
                scalarValue: serialized.midiChannel
            },
            key: {
                id: "",
                currentValueType: "scalar",
                key: "key",
                lfo: buildLfo("select", undefined, undefined, Object.keys(KeyMap).map((key) => ({ label: key, value: key }))),
                scalarValue: Object.keys(KeyMap)[serialized.key]
            },
            tempoSync: {
                id: "",
                currentValueType: "scalar",
                key: "tempoSync",
                lfo: buildLfo("bool"),
                scalarValue: serialized.tempoSync
            }
        };

        // ensure inherits are correct
        PlayerControlKeys.forEach((key) =>
        {
            if (Object.prototype.hasOwnProperty.call(ret, key))
            {
                ret[key].inherit = "global." + key;
            }
        });

        return ret;
    }
    else
    {
        if (typeof serialized.tempoSync === "boolean")
        {
            serialized = {
                ...serialized as SerializedCompositionLayer,
                tempoSync: {
                    id: "",
                    currentValueType: "scalar",
                    key: "tempoSync",
                    lfo: buildLfo("bool"),
                    scalarValue: serialized.tempoSync
                }
            };
        }

        return serialized as SerializedCompositionLayer;
    }
}

export function migrateSerializedComposition(serialized: SerializedCompositionV1 | SerializedComposition): SerializedComposition | null
{
    function inheritFor(ret: SerializedComposition, id: string): string
    {
        // check global //
        let candidate = PlayerControlKeys.findIndex(key => ret.global[key].id === id);
        if (candidate !== -1)
        {
            return "global." + ret.global[PlayerControlKeys[candidate]].key;
        }

        // check layers //
        for (let i = 0; i < ret.layers.length; i++)
        {
            candidate = LayerControlTypes.findIndex(key => ret.layers[i][key].id === id);
            if (candidate !== -1)
            {
                return "layer." + ret.layers[i][LayerControlTypes[candidate]].key;
            }
        }
        
        return id; // TODO: error
    }

    let ret = {
        version: 2,
        global: serialized.global,
        layers: serialized.layers.map(l => migrateSerializedLayer(serialized.global, l)),
        tokens: (serialized.tokens.map(migrateSerializedToken).filter(t => t) as SerializedCompositionToken[])
    };

    ret = {
        ...ret,
        tokens: ret.tokens.map(t => ({
            ...t,
            controls: t.controls.map(c => ({
                ...c,
                inherit: c.inherit ? (c.inherit.includes(".") ? c.inherit : inheritFor(ret, c.inherit)) : undefined
            }))
        }))
    };

    return ret;
}