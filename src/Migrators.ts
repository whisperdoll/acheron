import { AppSettings, initialSettings, TokenSettings } from "./AppContext";
import { SerializedComposition, SerializedCompositionToken } from "./Serialization";
import { getTokenUIDFromPath } from "./Tokens";
import { TokenUID } from "./Types";

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
            wrapPlayheads: settings.wrapPlayheads
        };
    }

    return settings as AppSettings;
}

export function migrateSerializedToken(serialized: SerializedCompositionTokenV1 | SerializedCompositionToken): SerializedCompositionToken | null
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

export function migrateSerializedComposition(serialized: SerializedCompositionV1 | SerializedComposition): SerializedComposition | null
{
    return {
        version: 2,
        global: serialized.global,
        layers: serialized.layers,
        tokens: serialized.tokens.map(migrateSerializedToken).filter(t => t) as SerializedCompositionToken[]
    };
}