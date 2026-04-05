import React, { useCallback, useContext, useMemo } from "react";
import { AppContext } from "../state/AppState";
import LfoVisualizer from "./LfoVisualizer";
import LfoControls from "./LfoControls";
import * as Control from "./Control";
import { coerceControlValueToNumber, ShallowControlState } from "../Types";
import { ModChainWorkspaceContext } from "../state/ModChainWorkspaceContext";
import ModChainOutputNode from "./ModChainOutputNode";

interface Props {
  id: string;
  controlId: string;
}

export default React.memo(function ModChainItemComponent(props: Props) {
  const { state, setState } = useContext(AppContext)!;

  const modChainItem = state.modChains[props.controlId].mods[props.id];
  const sourceControl = state.controls[props.controlId];
  const currentTimeMs = state.layers[0].currentTimeMs;
  const shallowControl: ShallowControlState | null = useMemo(
    () =>
      modChainItem.__type === "fixedControlValue"
        ? {
            ...sourceControl,
            fixedValue: modChainItem.value,
          }
        : null,
    [modChainItem, sourceControl],
  );

  const updateFixedControlValue = useCallback(
    (newShallowControl: ShallowControlState) => {
      const value = coerceControlValueToNumber(
        newShallowControl.fixedValue,
        newShallowControl,
      );
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
    },
    [],
  );

  return (
    <div className={`modChainItem ${modChainItem.__type}`}>
      <div className="header">
        {modChainItem.__type === "lfo"
          ? "LFO"
          : modChainItem.__type === "fixedControlValue"
            ? `Fixed ${state.controls[modChainItem.controlId].type} value`
            : modChainItem.__type === "fixedValue"
              ? "Fixed value"
              : state.controls[modChainItem.controlId].label}
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
            case "fixedControlValue":
              return (
                <div className="row">
                  <Control.ManualValue
                    control={shallowControl!}
                    onChange={updateFixedControlValue}
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
