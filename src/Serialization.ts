import { AppState, LayerState } from "./AppContext";
import { buildLayer } from "./Layers";
import { migrateSerializedComposition } from "./migrators";
import { ControlState, Lfo, Token } from "./Types";
import { buildFromDefs, DefaultLayerControls, DefaultPlayerControls } from "./utils/DefaultDefinitions";

export interface SerializedCompositionControl
{
    key: string;
    id: string;
    currentValueType: "scalar" | "lfo" | "inherit";
    inherit?: string;
    showIf?: string;
    scalarValue: any;
    lfo: Lfo;
}

export interface SerializedCompositionToken
{
    id: string;
    controls: SerializedCompositionControl[];
    uid: string;
}

export interface SerializedCompositionLayer
{
    version: 2;
    name: string;
    enabled: SerializedCompositionControl;
    midiChannel: SerializedCompositionControl;
    key: SerializedCompositionControl;
    transpose: SerializedCompositionControl;
    tempo: SerializedCompositionControl;
    barLength: SerializedCompositionControl;
    velocity: SerializedCompositionControl;
    emphasis: SerializedCompositionControl;
    tempoSync: boolean;
    noteLength: SerializedCompositionControl;
    timeToLive: SerializedCompositionControl;
    pulseEvery: SerializedCompositionControl;
    tokenIds: string[][];
}

export interface SerializedComposition
{
    version: number;
    tokens: SerializedCompositionToken[];
    global: {
        transpose: SerializedCompositionControl;
        tempo: SerializedCompositionControl;
        barLength: SerializedCompositionControl;
        velocity: SerializedCompositionControl;
        emphasis: SerializedCompositionControl;
        noteLength: SerializedCompositionControl;
        timeToLive: SerializedCompositionControl;
        pulseEvery: SerializedCompositionControl;
    };
    layers: SerializedCompositionLayer[];
}

function buildTokenFromSerialized(appState: AppState, serialized: SerializedCompositionToken): { tokenState: Token, controls: Record<string, ControlState> } | null
{
    const def = appState.tokenDefinitions[serialized.uid];

    if (!def) return null;

    const controls = {...buildFromDefs(def.controls)};

    for (const id in controls)
    {
        const serializedControl = serialized.controls.find(c => c.key === controls[id].key);
        if (serializedControl)
        {
            controls[id] = {
                ...controls[id],
                id: serializedControl.id,
                currentValueType: serializedControl.currentValueType,
                inherit: serializedControl.inherit,
                scalarValue: serializedControl.scalarValue,
                lfo: {...serializedControl.lfo}
            };
        }
    }

    const token: Token = {
        id: serialized.id,
        label: def.label,
        uid: serialized.uid,
        store: {},
        symbol: def.symbol,
        callbacks: {...appState.tokenCallbacks[serialized.uid]},
        controlIds: Object.keys(controls)
    };

    return {
        tokenState: token,
        controls
    };
}

function serializeControl(control: ControlState): SerializedCompositionControl
{
    return {
        key: control.key,
        id: control.id,
        currentValueType: control.currentValueType,
        inherit: control.inherit,
        scalarValue: control.scalarValue,
        lfo: control.lfo,
        showIf: control.showIf,
    };
}

export function serializeComposition(appState: AppState): SerializedComposition
{
    const tokenMap: SerializedCompositionToken[] = Object.entries(appState.tokens).map((e) =>
    {
        const [ tokenId, token ] = e;

       return {
            id: tokenId,
            controls: token.controlIds.map(cid => serializeControl(appState.controls[cid])),
            uid: token.uid
        };
    });

    return {
        version: 2,
        tokens: tokenMap,
        global: {
            transpose: serializeControl(appState.controls[appState.transpose]),
            tempo: serializeControl(appState.controls[appState.tempo]),
            barLength: serializeControl(appState.controls[appState.barLength]),
            velocity: serializeControl(appState.controls[appState.velocity]),
            emphasis: serializeControl(appState.controls[appState.emphasis]),
            noteLength: serializeControl(appState.controls[appState.noteLength]),
            timeToLive: serializeControl(appState.controls[appState.timeToLive]),
            pulseEvery: serializeControl(appState.controls[appState.pulseEvery])
        },
        layers: appState.layers.map((layer) =>
        {
            return {
                version: 2,
                name: layer.name,
                enabled: serializeControl(appState.controls[layer.enabled]),
                midiChannel: serializeControl(appState.controls[layer.midiChannel]),
                key: serializeControl(appState.controls[layer.key]),
                transpose: serializeControl(appState.controls[layer.transpose]),
                tempo: serializeControl(appState.controls[layer.tempo]),
                barLength: serializeControl(appState.controls[layer.barLength]),
                velocity: serializeControl(appState.controls[layer.velocity]),
                emphasis: serializeControl(appState.controls[layer.emphasis]),
                tempoSync: layer.tempoSync,
                noteLength: serializeControl(appState.controls[layer.noteLength]),
                timeToLive: serializeControl(appState.controls[layer.timeToLive]),
                pulseEvery: serializeControl(appState.controls[layer.pulseEvery]),
                tokenIds: layer.tokenIds
            };
        })
    };
};

export function deserializeComposition(appState: AppState, c: SerializedComposition): AppState
{
    const migrated = migrateSerializedComposition(c);
    if (!migrated)
    {
        alert("Error migrating old composition version");
        return appState;
    }
    c = migrated;

    const appTokens: Record<string, Token> = {};
    let appControls: Record<string, ControlState> = {};

    c.tokens.forEach((token) => 
    {
        const res = buildTokenFromSerialized(appState, token);
        if (res)
        {
            const { tokenState, controls } = res;
            appTokens[tokenState.id] = tokenState;
            appControls = { ...appControls, ...controls };
        }
        else
        {
            // TODO: error
        }
    });
    
    for (const id in DefaultPlayerControls)
    {
        let control = {...DefaultPlayerControls[id]};
        if (Object.prototype.hasOwnProperty.call(c.global, control.key))
        {
            const serializedControl = c.global[control.key as keyof SerializedComposition["global"]];
            control = {
                ...control,
                id: serializedControl.id,
                currentValueType: serializedControl.currentValueType,
                inherit: serializedControl.inherit,
                scalarValue: serializedControl.scalarValue,
                lfo: {...serializedControl.lfo}
            };
            appControls[control.id] = control;
        }
        else
        {
            appControls[control.id] = control;
        }
    }

    const layers: LayerState[] = [];

    c.layers.forEach((layer) =>
    {
        const defaultControls = DefaultLayerControls();
        for (const id in defaultControls)
        {
            let control = {...defaultControls[id]};
            if (Object.prototype.hasOwnProperty.call(layer, control.key))
            {
                const serializedControl = layer[control.key as keyof SerializedCompositionLayer] as SerializedCompositionControl;
                control = {
                    ...control,
                    id: serializedControl.id || control.id, // empty id means it was created from a migration and needs to be assigned an id
                    currentValueType: serializedControl.currentValueType,
                    inherit: serializedControl.inherit,
                    scalarValue: serializedControl.scalarValue,
                    lfo: {...serializedControl.lfo}
                };
                (layer[control.key as keyof SerializedCompositionLayer] as SerializedCompositionControl).id = control.id; // see above id comment
                appControls[control.id] = control;
            }
            else
            {
                appControls[control.id] = control;
            }
        }

        const newLayer: LayerState = {
            name: layer.name,
            enabled: layer.enabled.id,
            midiChannel: layer.midiChannel.id,
            key: layer.key.id,
            transpose: layer.transpose.id,
            tempo: layer.tempo.id,
            barLength: layer.barLength.id,
            velocity: layer.velocity.id,
            emphasis: layer.emphasis.id,
            tempoSync: layer.tempoSync,
            noteLength: layer.noteLength.id,
            timeToLive: layer.timeToLive.id,
            pulseEvery: layer.pulseEvery.id,
            tokenIds: layer.tokenIds,
            playheads: [],
            midiBuffer: [],
            currentBeat: 0
        };

        layers.push(newLayer);
    });

    if (layers.length === 0)
    {
        const built = buildLayer(appState);
        appControls = { ...appControls, ...built.controls };
        layers.push(built.layerState);
    }

    return {
        ...appState,
        transpose: c.global.transpose.id,
        tempo: c.global.tempo.id,
        barLength: c.global.barLength.id,
        velocity: c.global.velocity.id,
        emphasis: c.global.emphasis.id,
        noteLength: c.global.noteLength.id,
        timeToLive: c.global.timeToLive.id,
        pulseEvery: c.global.pulseEvery.id,
        controls: appControls,
        tokens: appTokens,
        isPlaying: false,
        selectedHex: { hexIndex: -1, layerIndex: 0 },
        layers
    }
}