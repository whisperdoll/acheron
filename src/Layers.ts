import Dict from "./lib/dict";
import { AppState, AppStateStore, LayerState } from "./state/AppState";
import { ControlState } from "./Types";
import {
  DefaultLayerControls,
  LayerControlKey,
} from "./utils/DefaultDefinitions";
import { createEmpty2dArray, msToS } from "./utils/utils";
import settings from "./state/AppSettings";

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
      tokenIds: createEmpty2dArray(appState.gridCols * appState.gridRows),
      playheads: createEmpty2dArray(appState.gridCols * appState.gridRows),
      name: "Layer " + (appState.layers.length + 1).toString(),
      currentBeat: appState.layers[0]?.currentBeat || 0,
      midiBuffer: [],
      playingNotes: [],
      currentTimeMs: appState.layers[0]?.currentTimeMs || 0,
    },
    controls,
  };
}
