import React from "react";
import { ControlChangeMessageEvent } from "webmidi";
import appStateStore from "./AppState";
import { ControlInstanceId } from "../Types";

export interface IControlContext {
  controls: typeof appStateStore.values.controls;
  layers: typeof appStateStore.values.layers;
  tokens: typeof appStateStore.values.tokens;
  selectedLayer: typeof appStateStore.values.selectedHex.layerIndex;
  controlId: ControlInstanceId;
}

export const ControlContext = React.createContext<IControlContext>({
  controls: {},
  layers: [],
  selectedLayer: -1,
  tokens: {},
  controlId: "",
});
