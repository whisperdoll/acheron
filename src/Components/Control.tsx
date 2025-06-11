import React, { JSX, useContext, useMemo, useReducer } from "react";
import { ControlState, ControlValueType, getControlValue } from "../Types";
import triad0 from "../../assets/triads/0.png";
import triad1 from "../../assets/triads/1.png";
import triad2 from "../../assets/triads/2.png";
import triad3 from "../../assets/triads/3.png";
import triad4 from "../../assets/triads/4.png";
import triad5 from "../../assets/triads/5.png";
import triad6 from "../../assets/triads/6.png";
import direction0 from "../../assets/directions/0.png";
import direction1 from "../../assets/directions/1.png";
import direction2 from "../../assets/directions/2.png";
import direction3 from "../../assets/directions/3.png";
import direction4 from "../../assets/directions/4.png";
import direction5 from "../../assets/directions/5.png";
import NumberInput from "./NumberInput";
import state from "../state/AppState";
import settings from "../state/AppSettings";
import { pluck, sliceObject } from "../utils/utils";
import { PlayerControlKeys } from "../utils/DefaultDefinitions";
import LfoVisualizer from "./LfoVisualizer";
import LfoControls from "./LfoControls";

const directionIcons = [direction0, direction1, direction2, direction3, direction4, direction5];

const directionOrder = [5, 0, 1, 4, 3, 2];

interface Props {
  controlId: string;
  layerIndex: number;
}

export default React.memo(function Control(props: Props) {
  const reactiveState = state.useState((s) => ({
    controls: s.controls,
    layers: s.layers,
    tokens: s.tokens,
    selectedLayer: s.selectedHex.layerIndex,
  }));
  const [_, forceUpdate] = useReducer((x) => x + 1, 0);
  const controlState = reactiveState.controls[props.controlId];

  if (!controlState) {
    throw "bad control id";
  }

  const layerIndex = useMemo(() => {
    let index = reactiveState.layers.findIndex(
      (l) =>
        pluck(l, PlayerControlKeys).includes(props.controlId) ||
        l.tokenIds.some((tidArray) =>
          tidArray.some((tid) => reactiveState.tokens[tid].controlIds.includes(props.controlId))
        )
    );

    if (index === -1) {
      index = reactiveState.selectedLayer;
    }

    return index;
  }, [props.controlId, reactiveState.selectedLayer]);
  // const tempo = layerIndex === -1 ? getControlValue(reactiveState, reactiveState.controls[reactiveState.tempo]) : getControlValue(reactiveState, reactiveState.controls[reactiveState.layers[layerIndex].tempo]);
  // const bpms = 60 / tempo * 1000;
  // const now = Math.floor(Date.now() / bpms) * bpms;

  const controlValueDeps = [reactiveState.controls[props.controlId], reactiveState.layers[layerIndex].currentBeat];
  const controlValue = useMemo(() => {
    return state.getControlValue(controlState, {
      layer: reactiveState.layers[props.layerIndex],
      controls: reactiveState.controls,
    });
  }, controlValueDeps);

  function handleChange(partial: Partial<ControlState>) {
    state.set(
      (state) => ({
        controls: {
          ...state.controls,
          [props.controlId]: {
            ...state.controls[props.controlId],
            ...partial,
          },
        },
      }),
      "update control"
    );
  }

  const handleValueChanged = (value: any) => {
    let newValue: any = null;

    switch (controlState.type) {
      case "bool":
        newValue = value;
        break;
      case "int":
        newValue = Math.floor(value);
        break;
      case "decimal":
        newValue = value;
        break;
      case "direction":
        newValue = Math.min(Math.max(0, Math.floor(value)), 5);
		break;
	  case "midichannel":
        newValue = Math.min(Math.max(1, Math.floor(value)), 16);
        break;
      default:
        throw "uh oh...";
    }

    if (newValue === null) throw "uh oh...";
    handleChange({ fixedValue: newValue });
  };

  function handleSelectValueChanged(e: React.ChangeEvent<HTMLSelectElement>) {
    handleChange({ fixedValue: e.currentTarget.value });
  }
  
  function handleDirectionChanged(direction: number) {
    handleChange({ fixedValue: direction });
  }
  const handleValueTypeChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleChange({
      currentValueType: e.currentTarget.value as ControlValueType,
    });
  };

  function handleTriadChanged(triad: number) {
    handleChange({ fixedValue: triad });
  }

  let controlPart: JSX.Element;
  if (controlState.currentValueType === "fixed") {
    switch (controlState.type) {
      case "bool":
        controlPart = (
          <input
            type="checkbox"
            onChange={(e) => handleValueChanged(e.currentTarget.checked)}
            checked={(controlValue as boolean) ?? false}
          />
        );
        break;
      case "int":
      case "decimal":
        controlPart = (
          <NumberInput
            onChange={handleValueChanged}
            value={(controlValue as number) ?? 0}
            max={controlState.max}
            min={controlState.min}
            step={controlState.step}
            roundPlaces={controlState.type === "int" ? 0 : 9}
          />
        );
        break;
	  case "midichannel":
        controlPart = (
          <NumberInput
            onChange={handleValueChanged}
            value={(controlValue as number) ?? 0}
            max={16}
            min={1}
            step={controlState.step}
            roundPlaces={controlState.type === "midichannel" ? 0 : 9}
          />
        );
		break;
      case "direction":
        controlPart = (
          <div className="directionRow">
            {directionOrder.map((i, di) => (
              <button
                key={i}
                className={controlValue === i ? "selected" : ""}
                style={{
                  backgroundImage: `url(${directionIcons[i]})`,
                }}
                onClick={() => handleDirectionChanged(i)}
              ></button>
            ))}
          </div>
        );
        break;
      case "select":
        controlPart = (
          <select onChange={handleSelectValueChanged} value={(controlValue as string) ?? ""}>
            {controlState.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
        break;
      case "triad":
        controlPart = (
          <div className="triadRow">
            {[triad0, triad1, triad2, triad3, triad4, triad5, triad6].map((triad, i) => (
              <button
                key={i}
                className={controlValue === i ? "selected" : ""}
                style={{
                  backgroundImage: `url(${triad})`,
                }}
                onClick={() => handleTriadChanged(i)}
              ></button>
            ))}
          </div>
        );
    }
  } // LFO
  else {
    switch (controlState.type) {
      case "bool":
      case "decimal":
      case "int":
      default:
        controlPart = <div>Value: {controlValue}</div>;
        break;
      case "select":
        controlPart = <div>Value: {controlValue}</div>;
        break;
      case "direction":
        controlPart = (
          <div className="directionRow disabled">
            {directionOrder.map((i, di) => (
              <button
                key={i}
                className={controlValue === i ? "selected" : ""}
                style={{
                  backgroundImage: `url(${directionIcons[i]})`,
                }}
                onClick={() => handleDirectionChanged(i)}
              ></button>
            ))}
          </div>
        );
        break;
	  case "midichannel":
	            controlPart = <div>Value: {controlValue}</div>;
        break;
      case "triad":
        controlPart = (
          <div className="triadRow disabled">
            {[triad0, triad1, triad2, triad3, triad4, triad5, triad6].map((triad, i) => (
              <button
                key={i}
                className={controlValue === i ? "selected noclicky" : "noclicky"}
                style={{
                  backgroundImage: `url(${triad})`,
                }}
              ></button>
            ))}
          </div>
        );
        break;
    }
  }

  return (
    <div className="control">
      <div className="labelRow">
        <div className="label">{controlState.label}</div>
        <select value={controlState.currentValueType} onChange={handleValueTypeChanged} className="valueType">
          <option value="fixed">Fixed</option>
          {controlState.inherit && <option value="inherit">Inherit</option>}
          <option value="modulate">Modulate</option>
          {controlState.inherit && <option value="multiply">Multiply</option>}
          {controlState.inherit && <option value="add">Add</option>}
        </select>
      </div>
      <div className="controlRow">{controlPart}</div>
      {controlState.currentValueType === "modulate" && (
        <>
          <LfoControls control={controlState} />
          <LfoVisualizer
            currentTimeMs={reactiveState.layers[0].currentTimeMs}
            lfo={controlState.lfo}
            resolutionX={300}
            resolutionY={100}
          />
        </>
      )}
    </div>
  );
});
