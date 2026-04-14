import React, {
  forwardRef,
  JSX,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import {
  coerceControlValueToNumber,
  ControlDataType,
  ControlState,
  ControlValueMod,
  FixedControlValueMod,
  FixedValueMod,
  InheritedControlValueMod,
  ModChainItem,
  ShallowControlState,
  TypeForControlDataType,
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
import {
  AppContext,
  getControlType,
  getControlValue,
  resolveModChain,
} from "../state/AppState";

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
  bald?: boolean; // if bald, act as a plain wrapper
}

export const Container = React.memo(
  forwardRef<HTMLDivElement, Props & React.JSX.IntrinsicElements["div"]>(
    function ControlContainer(
      props: React.PropsWithChildren<
        Props & React.JSX.IntrinsicElements["div"]
      >,
      ref,
    ) {
      const { state, setState } = useContext(AppContext)!;
      const controlState = state.controls[props.controlId];

      if (!controlState) {
        throw "bad control id";
      }

      const value = useMemo<IControlContext>(() => {
        return {
          controlId: props.controlId,
          controls: state.controls,
          layers: state.layers,
          tokens: state.tokens,
          selectedLayer: state.selectedHex.layerIndex,
        };
      }, [
        props.controlId,
        state.controls,
        state.layers,
        state.tokens,
        state.selectedHex.layerIndex,
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
    },
  ),
);

export default Container;

export const Row = React.memo(function ControlRow(
  props: React.PropsWithChildren,
) {
  return <div className="row">{props.children}</div>;
});

export const Label = React.memo(function ControlLabel(
  props: { trailingColon?: boolean } = { trailingColon: true },
) {
  const context = useContext(ControlContext);
  const controlState = context.controls[context.controlId];

  return (
    <div className="label">
      {controlState.definition.label}
      {!!props.trailingColon && ":"}
    </div>
  );
});

interface ManualControlValueProps<
  T extends FixedValueMod | FixedControlValueMod,
> {
  mod: T;
  type: ControlDataType;
  onChange: (newValue: number) => unknown;
  max?: number;
  min?: number;
  step?: number;
  selectOptions?: { value: string; label: string }[];
}
export const ManualValue = React.memo(function ManualControlValue<
  T extends FixedValueMod | FixedControlValueMod,
>({
  mod,
  type,
  onChange,
  max,
  min,
  step,
  selectOptions,
}: ManualControlValueProps<T>) {
  const handleValueChanged = (value: number) => {
    let newValue: number;

    switch (type) {
      case "bool":
      case "decimal":
      case "select":
      case "triad":
        newValue = value;
        break;
      case "int":
        newValue = Math.floor(value);
        break;
      case "direction":
        newValue = Math.min(Math.max(0, Math.floor(value)), 5);
        break;
      default:
        throw "uh oh...";
    }

    onChange(newValue);
  };

  return (
    <div className="controlRow">
      {(() => {
        switch (type) {
          case "bool":
            return (
              <input
                type="checkbox"
                onChange={(e) => handleValueChanged(+e.currentTarget.checked)}
                checked={!!mod.value}
              />
            );
          case "int":
          case "decimal":
            return (
              <NumberInput
                onChange={handleValueChanged}
                value={(mod.value as number) ?? 0}
                max={max}
                min={min}
                step={step}
                roundPlaces={type === "int" ? 0 : 9}
              />
            );
          case "direction":
            return (
              <div className="directionRow">
                {directionOrder.map((i, di) => (
                  <button
                    key={i}
                    className={mod.value === i ? "selected" : ""}
                    style={{
                      backgroundImage: `url(${directionIcons[i]})`,
                    }}
                    onClick={() => handleValueChanged(i)}
                  ></button>
                ))}
              </div>
            );
          case "select":
            return (
              <select
                onChange={(e) =>
                  handleValueChanged(
                    selectOptions!.findIndex(
                      (o) => o.value === e.currentTarget.value,
                    ),
                  )
                }
                value={selectOptions![mod.value].value}
              >
                {selectOptions!.map((option) => (
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
                      className={mod.value === i ? "selected" : ""}
                      style={{
                        backgroundImage: `url(${triad})`,
                      }}
                      onClick={() => handleValueChanged(i)}
                    ></button>
                  ),
                )}
              </div>
            );
        }
      })()}
    </div>
  );
});

export const ReadOnlyValue = React.memo(function ReadOnlyControlValue({
  value,
  type,
}: {
  type: ControlDataType;
  value: TypeForControlDataType<typeof type>;
}) {
  switch (type) {
    case "bool":
    case "decimal":
    case "int":
    default:
      return <div>{value}</div>;
    case "select":
      return <div>{value}</div>;
    case "direction":
      return (
        <div className="directionRow disabled">
          {directionOrder.map((i, di) => (
            <button
              key={i}
              className={value === i ? "selected" : ""}
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
                className={value === i ? "selected noclicky" : "noclicky"}
                style={{
                  backgroundImage: `url(${triad})`,
                }}
              ></button>
            ),
          )}
        </div>
      );
  }
});

export const Value = React.memo(function ControlValue() {
  const { state, setState } = useContext(AppContext)!;
  const context = useContext(ControlContext);
  const [_, forceUpdate] = useReducer((x) => x + 1, 0);
  const modChain = state.modChains[context.controlId];
  const outputMod = modChain.mods[modChain.output];
  const now = Math.round(state.layers[0].currentTimeMs / 60);
  const control = state.controls[context.controlId];
  const isFixed =
    outputMod.__type === "fixedValue" ||
    outputMod.__type === "fixedControlValue";
  const value = useMemo(() => {
    return resolveModChain(state, context.controlId);
  }, [modChain, !isFixed && now]);

  const handleUpdate = useCallback((value: number) => {
    setState((s) => ({
      ...s,
      modChains: {
        ...s.modChains,
        [context.controlId]: {
          ...s.modChains[context.controlId],
          mods: {
            ...s.modChains[context.controlId].mods,
            [modChain.output]: {
              ...s.modChains[context.controlId].mods[modChain.output],
              value,
            },
          },
        },
      },
    }));
  }, []);

  return (
    <div className="controlRow">
      {(() => {
        if (isFixed) {
          return (
            <ManualValue
              mod={outputMod}
              onChange={handleUpdate}
              type={getControlType(state, control.id)}
              max={control.definition.max}
              min={control.definition.min}
              selectOptions={control.definition.options}
              step={control.definition.step}
            />
          );
        } else {
          return (
            <ReadOnlyValue
              value={value}
              type={getControlType(state, control.id)}
            />
          );
        }
      })()}
    </div>
  );
});

export const EditIcon = React.memo(function ControlEditIcon() {
  const { state, setState } = useContext(AppContext)!;
  const context = useContext(ControlContext);
  const controlState = context.controls[context.controlId];

  const layerIndex = useMemo(() => {
    let index = context.layers.findIndex(
      (l) =>
        pluck(l, PlayerControlKeys).includes(context.controlId) ||
        l.tokenIds.some((tidArray) =>
          tidArray.some((tid) =>
            context.tokens[tid].controlIds.includes(context.controlId),
          ),
        ),
    );

    if (index === -1) {
      index = context.selectedLayer;
    }

    return index;
  }, [context.controlId, context.selectedLayer]);

  const controlValue = useMemo(() => {
    return coerceControlValueToNumber(
      getControlValue(state, controlState),
      controlState,
    );
  }, [controlState, context.layers[layerIndex].currentBeat]);

  return (
    <GoogleIconButton
      icon="adjust"
      buttonStyle="rounded"
      onClick={() => {
        setState((s) => ({
          ...s,
          modChainControl: context.controlId,
        }));
      }}
    />
  );
});
