import Dict from "./lib/dict";
import { AppState, AppStateStore, LayerState } from "./state/AppState";
import { ControlState } from "./Types";
import {
  DefaultLayerControls,
  LayerControlKey,
} from "./utils/DefaultDefinitions";
import { NumHexes } from "./utils/elysiumutils";
import { createEmpty2dArray, msToS } from "./utils/utils";

export function buildLayer(appState: AppState): {
  layerState: LayerState;
  controls: Record<string, ControlState>;
} {
  const controls = DefaultLayerControls();

  return {
    layerState: {
      ...Dict.fromArray(
        Object.entries(controls).map(([id, value]) => [
          value.key as LayerControlKey,
          id,
        ])
      ),
      tokenIds: createEmpty2dArray(NumHexes),
      playheads: createEmpty2dArray(NumHexes),
      name: "Layer " + (appState.layers.length + 1).toString(),
      currentBeat: appState.layers[0]?.currentBeat || 0,
      midiBuffer: [],
      playingNotes: [],
      currentTimeMs: appState.layers[0]?.currentTimeMs || 0,
    },
    controls,
  };
}
