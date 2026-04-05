import { useContext, useState } from "react";
import {
  PlayerControlKey,
  PlayerControlKeys,
} from "../utils/DefaultDefinitions";
import Control from "./Control";
import settings from "../state/AppSettings";
import Dict from "../lib/dict";
import { AppContext } from "../state/AppState";

export default function PlayerSettings() {
  const { state, setState } = useContext(AppContext)!;

  const controlStates = Dict.fromArray(
    PlayerControlKeys.map((key) => [key, state[key]]),
  );
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
    return <Control controlId={controlStates[controlKey]} key={controlKey} />;
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
