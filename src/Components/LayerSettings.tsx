import { useContext } from "react";
import { LayerControlKey } from "../utils/DefaultDefinitions";
import Control from "./Control";
import state from "../state/AppState";
import settings from "../state/AppSettings";

interface Props {
  layerIndex: number;
}

export default function (props: Props) {
  const reactiveState = state.useState();
  const reactiveSettings = settings.useState();
  const layer = reactiveState.layers[props.layerIndex];

  const layerControls: LayerControlKey[] = [
    //        "enabled",
    "midiChannel",
    "key",
  ];

  const noteControls: LayerControlKey[] = [
    "transpose",
    "tempo",
    "barLength",
    "velocity",
    "emphasis",
    "noteLength",
  ];

  const generatorControls: LayerControlKey[] = ["timeToLive", "pulseEvery"];

  function buildControl(controlKey: LayerControlKey) {
    return (
      <Control
        controlId={reactiveState.layers[props.layerIndex][controlKey]}
        key={controlKey}
        layerIndex={props.layerIndex}
      />
    );
  }

  return (
    <div className="layerSettings">
      <div className="layerHeader">
        {reactiveState.layers[props.layerIndex].name}
      </div>
      <div className="layerSettingsInner">
        <div className="header">Layer</div>
        {layerControls.map(buildControl)}
        <div className="header">Notes</div>
        {noteControls.map(buildControl)}
        <div className="header">Generators</div>
        {generatorControls.map(buildControl)}
      </div>
    </div>
  );
}
