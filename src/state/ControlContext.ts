import React from "react";
import { ControlChangeMessageEvent } from "webmidi";
import { ControlInstanceId } from "../Types";
import { AppState } from "./AppState";

export interface IControlContext {
  controls: AppState["controls"];
  layers: AppState["layers"];
  tokens: AppState["tokens"];
  selectedLayer: AppState["selectedHex"]["layerIndex"];
  controlId: ControlInstanceId;
}

export const ControlContext = React.createContext<IControlContext>({
  controls: {},
  layers: [],
  selectedLayer: -1,
  tokens: {},
  controlId: "",
});
