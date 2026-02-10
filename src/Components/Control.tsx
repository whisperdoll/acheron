import React, {
  forwardRef,
  JSX,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import {
  coerceControlValueToNumber,
  ControlState,
  defaultModChain,
  ShallowControlState,
} from "../Types";
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
import { cx, tryParseInt } from "../lib/utils";
import Midi from "../utils/midi";
import List from "../lib/list";
import GoogleIconButton from "./GoogleIconButton";
import { ControlContext, IControlContext } from "../state/ControlContext";

const directionIcons = [
  direction0,
  direction1,
  direction2,
  direction3,
  direction4,
  direction5,
];

const directionOrder = [5, 0, 1, 4, 3, 2];

interface Props {
  controlId: string;
  layerIndex?: number;
  bald?: boolean; // if bald, act as a plain wrapper
}

export const Container = React.memo(
  forwardRef<HTMLDivElement, Props & React.JSX.IntrinsicElements["div"]>(
    function ControlContainer(
      props: React.PropsWithChildren<
        Props & React.JSX.IntrinsicElements["div"]
      >,
      ref
    ) {
      const reactiveState = state.useState((s) => ({
        controls: s.controls,
        layers: s.layers,
        tokens: s.tokens,
        selectedLayer: s.selectedHex.layerIndex,
      }));
      const controlState = reactiveState.controls[props.controlId];

      if (!controlState) {
        throw "bad control id";
      }

      const value = useMemo<IControlContext>(() => {
        return {
          controlId: props.controlId,
          controls: reactiveState.controls,
          layers: reactiveState.layers,
          tokens: reactiveState.tokens,
          selectedLayer: reactiveState.selectedLayer,
        };
      }, [
        props.controlId,
        reactiveState.controls,
        reactiveState.layers,
        reactiveState.tokens,
        reactiveState.selectedLayer,
      ]);

      const children = useMemo(() => {
        return (
          props.children || (
            <Row>
              <Label />
              <Value />
              <EditIcon />
            </Row>
          )
        );
      }, [props.children]);

      return (
        <ControlContext.Provider value={value}>
          <div
            className={cx({ control: !props.bald }, props.className)}
            ref={ref}
          >
            {children}
          </div>
        </ControlContext.Provider>
      );
    }
  )
);

export default Container;

export const Row = React.memo(function ControlRow(
  props: React.PropsWithChildren
) {
  return <div className="row">{props.children}</div>;
});

export const Label = React.memo(function ControlLabel(
  props: { trailingColon?: boolean } = { trailingColon: true }
) {
  const context = useContext(ControlContext);
  const controlState = context.controls[context.controlId];

  return (
    <div className="label">
      {controlState.label}
      {!!props.trailingColon && ":"}
    </div>
  );
});

interface ManualControlValueProps {
  control: ShallowControlState;
  onChange: (newValue: ShallowControlState) => unknown;
}
export const ManualValue = React.memo(function ManualControlValue({
  control,
  onChange,
}: ManualControlValueProps) {
  function handleChange(partial: Partial<ControlState>) {
    onChange({ ...control, ...partial });
  }

  const handleValueChanged = (value: any) => {
    let newValue: any = null;

    switch (control.type) {
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

  function handleTriadChanged(triad: number) {
    handleChange({ fixedValue: triad });
  }

  return (
    <div className="controlRow">
      {(() => {
        switch (control.type) {
          case "bool":
            return (
              <input
                type="checkbox"
                onChange={(e) => handleValueChanged(e.currentTarget.checked)}
                checked={(control.fixedValue as boolean) ?? false}
              />
            );
          case "int":
          case "decimal":
            return (
              <NumberInput
                onChange={handleValueChanged}
                value={(control.fixedValue as number) ?? 0}
                max={control.max}
                min={control.min}
                step={control.step}
                roundPlaces={control.type === "int" ? 0 : 9}
              />
            );
          case "direction":
            return (
              <div className="directionRow">
                {directionOrder.map((i, di) => (
                  <button
                    key={i}
                    className={control.fixedValue === i ? "selected" : ""}
                    style={{
                      backgroundImage: `url(${directionIcons[i]})`,
                    }}
                    onClick={() => handleDirectionChanged(i)}
                  ></button>
                ))}
              </div>
            );
          case "select":
            return (
              <select
                onChange={handleSelectValueChanged}
                value={(control.fixedValue as string) ?? ""}
              >
                {control.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            );
          case "triad":
            return (
              <div className="triadRow">
                {[triad0, triad1, triad2, triad3, triad4, triad5, triad6].map(
                  (triad, i) => (
                    <button
                      key={i}
                      className={control.fixedValue === i ? "selected" : ""}
                      style={{
                        backgroundImage: `url(${triad})`,
                      }}
                      onClick={() => handleTriadChanged(i)}
                    ></button>
                  )
                )}
              </div>
            );
        }
      })()}
    </div>
  );
});

export const ReadOnlyValue = React.memo(function ReadOnlyControlValue({
  control,
}: {
  control: ShallowControlState;
}) {
  switch (control.type) {
    case "bool":
    case "decimal":
    case "int":
    default:
      return <div>{control.fixedValue}</div>;
    case "select":
      return <div>{control.fixedValue}</div>;
    case "direction":
      return (
        <div className="directionRow disabled">
          {directionOrder.map((i, di) => (
            <button
              key={i}
              className={control.fixedValue === i ? "selected" : ""}
              style={{
                backgroundImage: `url(${directionIcons[i]})`,
              }}
            ></button>
          ))}
        </div>
      );
    case "triad":
      return (
        <div className="triadRow disabled">
          {[triad0, triad1, triad2, triad3, triad4, triad5, triad6].map(
            (triad, i) => (
              <button
                key={i}
                className={
                  control.fixedValue === i ? "selected noclicky" : "noclicky"
                }
                style={{
                  backgroundImage: `url(${triad})`,
                }}
              ></button>
            )
          )}
        </div>
      );
  }
});

export const Value = React.memo(function ControlValue() {
  const context = useContext(ControlContext);
  const [_, forceUpdate] = useReducer((x) => x + 1, 0);
  const modChain = state.useState(
    (s) => {
      return s.modChains[context.controlId];
    },
    [context.controlId]
  );
  const now = state.useState((s) => Math.round(s.layers[0].currentTimeMs / 60));
  const controlState = useMemo(() => {
    const controlState = { ...context.controls[context.controlId] };
    if (modChain) {
      controlState.fixedValue = state.resolveModChain(context.controlId);
      if (controlState.type !== "decimal") {
        controlState.fixedValue = Math.round(controlState.fixedValue);
      }
    }
    return controlState;
  }, [context.controls, context.controlId, modChain, now]);

  useEffect(() => {
    const onCC: (typeof Midi.onCC)[number] = ({ number, value }) => {
      forceUpdate();
    };

    Midi.onCC.push(onCC);

    return () => {
      Midi.onCC.splice(Midi.onCC.indexOf(onCC), 1);
    };
  }, []);

  // const tempo = layerIndex === -1 ? getControlValue(context, context.controls[context.tempo]) : getControlValue(context, context.controls[context.layers[layerIndex].tempo]);
  // const bpms = 60 / tempo * 1000;
  // const now = Math.floor(Date.now() / bpms) * bpms;

  function handleChange(partial: Partial<ControlState>) {
    state.set(
      (state) => ({
        controls: {
          ...state.controls,
          [context.controlId]: {
            ...state.controls[context.controlId],
            ...partial,
          },
        },
      }),
      "update control"
    );
  }

  return (
    <div className="controlRow">
      {(() => {
        if (!modChain?.output) {
          return <ManualValue control={controlState} onChange={handleChange} />;
        } else {
          // LFO
          return <ReadOnlyValue control={controlState} />;
        }
      })()}
    </div>
  );
});

export const EditIcon = React.memo(function ControlEditIcon() {
  const context = useContext(ControlContext);
  const controlState = context.controls[context.controlId];

  const layerIndex = useMemo(() => {
    let index = context.layers.findIndex(
      (l) =>
        pluck(l, PlayerControlKeys).includes(context.controlId) ||
        l.tokenIds.some((tidArray) =>
          tidArray.some((tid) =>
            context.tokens[tid].controlIds.includes(context.controlId)
          )
        )
    );

    if (index === -1) {
      index = context.selectedLayer;
    }

    return index;
  }, [context.controlId, context.selectedLayer]);

  const controlValueDeps = [
    controlState,
    context.layers[layerIndex].currentBeat,
    controlState.currentValueType === "midi_cc" &&
      Midi.ccValue(controlState.midiCCNumber || 0),
  ];
  const controlValue = useMemo(() => {
    return coerceControlValueToNumber(
      state.getControlValue(controlState),
      controlState
    );
  }, controlValueDeps);

  return (
    <GoogleIconButton
      icon="adjust"
      buttonStyle="rounded"
      onClick={() => {
        state.set(
          (s) => ({
            modChainControl: context.controlId,
            modChains: {
              ...s.modChains,
              [context.controlId]:
                s.modChains[context.controlId] ||
                defaultModChain({ controlId: context.controlId, controlValue }),
            },
          }),
          "set mod chain control"
        );
      }}
    />
  );
});

export const MidiCC = React.memo(function ControlMIDICC() {
  const context = useContext(ControlContext);
  const controlState = context.controls[context.controlId];

  function handleChange(partial: Partial<ControlState>) {
    state.set(
      (state) => ({
        controls: {
          ...state.controls,
          [context.controlId]: {
            ...state.controls[context.controlId],
            ...partial,
          },
        },
      }),
      "update control"
    );
  }

  return (
    controlState.currentValueType === "midi_cc" && (
      <>
        <div className="labelRow">
          <div>&nbsp;&nbsp;</div>
          <div className="label">CC Number:</div>
          <div className="controlRow">
            <NumberInput
              min={0}
              max={127}
              step={1}
              value={controlState.midiCCNumber || 0}
              onChange={(value) => handleChange({ midiCCNumber: value })}
            />
          </div>
        </div>
      </>
    )
  );
});
