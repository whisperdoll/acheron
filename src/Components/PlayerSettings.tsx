import { useContext } from "react";
import { PlayerControlKey } from "../utils/DefaultDefinitions";
import Control from "./Control";
import state from "../state/AppState";
import settings from "../state/AppSettings";

export default function PlayerSettings() {
  const reactiveState = state.useState();
  const reactiveSettings = settings.useState();
  const layerControls: PlayerControlKey[] = ["key"];

  const noteControls: PlayerControlKey[] = [
    "transpose",
    "tempo",
    "barLength",
    "velocity",
    "emphasis",
    "tempoSync",
    "noteLength",
  ];

  const generatorControls: PlayerControlKey[] = ["timeToLive", "pulseEvery"];

  function buildControl(controlKey: PlayerControlKey) {
    return (
      <Control
        controlId={reactiveState[controlKey]}
        key={controlKey}
        layerIndex={-1}
      />
    );
  }

  return (
    <div className="playerSettings">
      <div className="header">Layers</div>
      {layerControls.map(buildControl)}
      <div className="header">Notes</div>
      {noteControls.map(buildControl)}
      <div className="header">Generators</div>
      {generatorControls.map(buildControl)}
    </div>
  );
}
