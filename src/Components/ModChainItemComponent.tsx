import React, { useCallback, useContext, useMemo } from "react";
import {
  AppContext,
  getControlLayer,
  getControlValue,
  playerControls,
  resolveModItem,
} from "../state/AppState";
import LfoVisualizer from "./LfoVisualizer";
import LfoControls from "./LfoControls";
import * as Control from "./Control";
import { coerceControlValueToNumber, ShallowControlState } from "../Types";
import { ModChainWorkspaceContext } from "../state/ModChainWorkspaceContext";
import ModChainOutputNode from "./ModChainOutputNode";
import {
  getControlFromInheritParts,
  getInheritParts,
} from "../utils/elysiumutils";

interface Props {
  id: string;
  controlId: string;
}

export default React.memo(function ModChainItemComponent(props: Props) {
  const { state, setState } = useContext(AppContext)!;

  const modChainItem = state.modChains[props.controlId].mods[props.id];
  const sourceControl = state.controls[props.controlId];
  const currentTimeMs = state.layers[0].currentTimeMs;
  const inheritedControl = useMemo(() => {
    if (!sourceControl.definition.inherit) return;

    const inheritParts = getInheritParts(sourceControl.definition.inherit!);
    if (!inheritParts) {
      throw "bad inherit parts";
    }
    return getControlFromInheritParts(
      state.controls,
      playerControls(state),
      getControlLayer(state, sourceControl.id)!,
      inheritParts,
    );
  }, [modChainItem, sourceControl]);

  const updateFixedControlValue = useCallback((value: number) => {
    setState((s) => ({
      ...s,
      modChains: {
        ...s.modChains,
        [props.controlId]: {
          ...s.modChains[props.controlId],
          mods: {
            ...s.modChains[props.controlId].mods,
            [props.id]: {
              ...s.modChains[props.controlId].mods[props.id],
              value,
            },
          },
        },
      },
    }));
  }, []);

  return (
    <div className={`modChainItem ${modChainItem.__type}`}>
      <div className="header">
        {modChainItem.__type === "lfo"
          ? "LFO"
          : modChainItem.__type === "fixedControlValue"
            ? `Fixed ${state.controls[modChainItem.controlId].definition.type} value`
            : modChainItem.__type === "fixedValue"
              ? "Fixed value"
              : modChainItem.__type === "controlValue"
                ? state.controls[modChainItem.controlId].definition.label
                : `Inherited value`}
      </div>
      <div className="contents">
        {(() => {
          switch (modChainItem.__type) {
            case "lfo":
              return (
                <>
                  <div className="row">
                    <LfoVisualizer
                      key={props.id}
                      lfo={modChainItem}
                      currentTimeMs={currentTimeMs}
                      resolutionX={300}
                      resolutionY={100}
                      modItemId={props.id}
                    />
                    <ModChainOutputNode modItemId={props.id} />
                  </div>
                  <LfoControls
                    lfo={modChainItem}
                    modItemId={props.id}
                    onUpdate={(newLfo) => {
                      setState((s) => ({
                        ...s,
                        modChains: {
                          ...s.modChains,
                          [props.controlId]: {
                            ...s.modChains[props.controlId],
                            mods: {
                              ...s.modChains[props.controlId].mods,
                              [props.id]: {
                                ...s.modChains[props.controlId].mods[props.id],
                                ...newLfo,
                              },
                            },
                          },
                        },
                      }));
                    }}
                  />
                </>
              );
            case "controlValue":
              return (
                <div className="row">
                  <Control.Container controlId={modChainItem.controlId} bald>
                    <Control.Value />
                  </Control.Container>
                  <ModChainOutputNode modItemId={props.id} />
                </div>
              );
            case "inheritedControlValue":
              return (
                <div className="row">
                  <Control.Container controlId={props.controlId} bald>
                    <Control.ReadOnlyValue
                      type={sourceControl.definition.type!}
                      value={getControlValue(state, inheritedControl!)}
                    />
                  </Control.Container>
                  <ModChainOutputNode modItemId={props.id} />
                </div>
              );
            case "fixedControlValue":
              return (
                <div className="row">
                  <Control.ManualValue
                    onChange={updateFixedControlValue}
                    mod={modChainItem}
                    type={sourceControl.definition.type!}
                    max={sourceControl.definition.max}
                    min={sourceControl.definition.min}
                    selectOptions={sourceControl.definition.options}
                    step={sourceControl.definition.step}
                  />
                  <ModChainOutputNode modItemId={props.id} />
                </div>
              );
          }
        })()}
      </div>
    </div>
  );
});
