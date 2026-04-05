import { useContext } from "react";
import { LayerControlKey } from "../utils/DefaultDefinitions";
import Control from "./Control";
import settings from "../state/AppSettings";
import { AppContext } from "../state/AppState";

interface Props {
  layerIndex: number;
}

export default function (props: Props) {
  const { state, setState } = useContext(AppContext)!;

  const reactiveSettings = settings.useState();
  const layer = state.layers[props.layerIndex];

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
        controlId={state.layers[props.layerIndex][controlKey]}
        key={controlKey}
      />
    );
  }

  return (
    <div className="layerSettings">
      <div className="layerHeader">{state.layers[props.layerIndex].name}</div>
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
