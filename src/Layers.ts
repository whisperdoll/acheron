import { AppState, LayerState } from "./AppContext";
import { ControlState, getControlValue } from "./Types";
import { DefaultLayerControls } from "./utils/DefaultDefinitions";
import { NumHexes } from "./utils/elysiumutils";
import { createEmpty2dArray, NsToS } from "./utils/utils";

export function buildLayer(appState: AppState): { layerState: LayerState, controls: Record<string, ControlState> }
{
    const controls = DefaultLayerControls();
    const bpmId = Object.entries(controls).find(e => e[1].key === "tempo")![0];
    const bpm = getControlValue(appState, controls[bpmId]);
    const barLengthId = Object.entries(controls).find(e => e[1].key === "barLength")![0];
    // const barLength = getControlValue(appState, controls[barLengthId]);

    return {
        layerState: {
            enabled: Object.entries(controls).find(e => e[1].key === "enabled")![0],
            key: Object.entries(controls).find(e => e[1].key === "key")![0],
            midiChannel: Object.entries(controls).find(e => e[1].key === "midiChannel")![0],
            tempoSync: false,
            tokenIds: createEmpty2dArray(NumHexes),
            playheads: createEmpty2dArray(NumHexes),
            name: "Layer " + (appState.layers.length + 1).toString(),
            barLength: barLengthId,
            currentBeat: (NsToS(Number(process.hrtime.bigint() - appState.startTime)) / (60 / bpm)),
            emphasis: Object.entries(controls).find(e => e[1].key === "emphasis")![0],
            noteLength: Object.entries(controls).find(e => e[1].key === "noteLength")![0],
            pulseEvery: Object.entries(controls).find(e => e[1].key === "pulseEvery")![0],
            tempo: bpmId,
            timeToLive: Object.entries(controls).find(e => e[1].key === "timeToLive")![0],
            transpose: Object.entries(controls).find(e => e[1].key === "transpose")![0],
            velocity: Object.entries(controls).find(e => e[1].key === "velocity")![0],
        },
        controls
    };
}