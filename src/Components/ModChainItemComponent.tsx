import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  AppContext,
  getControlLayer,
  getControlValue,
  playerControls,
  removeModItem,
  resolveModItem,
} from "../state/AppState";
import LfoVisualizer from "./LfoVisualizer";
import LfoControls from "./LfoControls";
import * as Control from "./Control";
import {
  coerceControlValueToNumber,
  LerpMod,
  MathMod,
  MathModOperation,
  ModChainItem,
  ShallowControlState,
} from "../Types";
import { ModChainWorkspaceContext } from "../state/ModChainWorkspaceContext";
import ModChainOutputNode from "./ModChainOutputNode";
import { getControlFromInheritParts, getInheritParts } from "../utils/elysiumutils";
import NumberInput from "./NumberInput";
import { isFunction } from "../lib/utils";
import ModChainInputNode from "./ModChainInputNode";
import InputtableValue from "./InputtableValue";
import GoogleIconButton from "./GoogleIconButton";

interface Props {
  id: string;
  controlId: string;
}

export default React.memo(function ModChainItemComponent(
  props: Props & React.JSX.IntrinsicElements["div"],
) {
  const { state, setState } = useContext(AppContext)!;

  const { id: modChainItemId, controlId: modChainId, ...rest } = props;

  const modChainItem = state.modChains[modChainId].mods[modChainItemId];
  const sourceControl = state.controls[modChainId];
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

  const updateMod = useCallback(<T extends ModChainItem>(fn: SetStateAction<T>) => {
    setState((s) => ({
      ...s,
      modChains: {
        ...s.modChains,
        [modChainId]: {
          ...s.modChains[modChainId],
          mods: {
            ...s.modChains[modChainId].mods,
            [modChainItemId]: isFunction(fn)
              ? fn(s.modChains[modChainId].mods[modChainItemId] as T)
              : fn,
          },
        },
      },
    }));
  }, []);

  const updateFixedControlValue = useCallback((value: number) => {
    setState((s) => ({
      ...s,
      modChains: {
        ...s.modChains,
        [modChainId]: {
          ...s.modChains[modChainId],
          mods: {
            ...s.modChains[modChainId].mods,
            [modChainItemId]: {
              ...s.modChains[modChainId].mods[modChainItemId],
              value,
            },
          },
        },
      },
    }));
  }, []);

  const label = useMemo(() => {
    switch (modChainItem.__type) {
      case "lfo":
        return "LFO";
      case "fixedControlValue":
        return `Fixed ${state.controls[modChainItem.controlId].definition.type} value`;
      case "fixedValue":
        return "Fixed value";
      case "controlValue":
        return state.controls[modChainItem.controlId].definition.label;
      case "inheritedControlValue":
        return "Inherited value";
      case "math":
        return "Math";
      case "lerp":
        return "Lerp";
    }
  }, [modChainItem.__type]);

  const dragging = useRef<boolean>(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const modPosStart = useRef<{ x: number; y: number }>(modChainItem.ui);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      modPosStart.current = modChainItem.ui;
      draggingStart.current = { x: e.clientX, y: e.clientY };
    };

    headerRef.current?.addEventListener("pointerdown", onDown);

    return () => headerRef.current?.removeEventListener("pointerdown", onDown);
  }, [modChainItem.ui]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (modChainItem.ui.width) containerRef.current.style.width = `${modChainItem.ui.width}px`;
    if (modChainItem.ui.height)
      containerRef.current.style.height = `${modChainItem.ui.height}px`;

    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;

      e.preventDefault();
      e.stopPropagation();

      const draggingCurrent = { x: e.clientX, y: e.clientY };
      const draggingOffset = {
        x: draggingCurrent.x - draggingStart.current.x,
        y: draggingCurrent.y - draggingStart.current.y,
      };

      updateMod((m) => ({
        ...m,
        ui: {
          ...m.ui,
          x: modPosStart.current.x + draggingOffset.x,
          y: modPosStart.current.y + draggingOffset.y,
        },
      }));
    };

    const onUp = (e: PointerEvent) => {
      if (!dragging.current) return;

      e.preventDefault();
      e.stopPropagation();
      dragging.current = false;
    };

    const onCancel = (e: PointerEvent) => {
      if (!dragging.current) return;

      e.preventDefault();
      e.stopPropagation();
      dragging.current = false;
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (!entry.borderBoxSize) return;

        const size = entry.borderBoxSize[0];
        const width = size.inlineSize;
        const height = size.blockSize;

        updateMod((m) => ({ ...m, ui: { ...m.ui, width, height } }));
      }
    });

    resizeObserver.observe(containerRef.current);
    document.body.addEventListener("pointermove", onMove);
    document.body.addEventListener("pointerup", onUp);
    document.body.addEventListener("pointercancel", onCancel);

    return () => {
      resizeObserver.disconnect();
      document.body.removeEventListener("pointermove", onMove);
      document.body.removeEventListener("pointerup", onUp);
      document.body.removeEventListener("pointercancel", onCancel);
    };
  }, []);

  return (
    <div ref={containerRef} className={`modChainItem ${modChainItem.__type}`} {...rest}>
      <div className="header" ref={headerRef}>
        <span>{label}</span>

        {modChainItem.removeable && (
          <GoogleIconButton
            buttonStyle="rounded"
            icon="close"
            fill
            opticalSize={20}
            title="Remove Node"
            onClick={(e) => {
              setState((s) => removeModItem(s, modChainId, modChainItemId));
            }}
            className="nostyle remove"
          />
        )}
      </div>
      <div className="contents">
        {(() => {
          switch (modChainItem.__type) {
            case "lfo":
              return (
                <>
                  <div className="row">
                    <LfoVisualizer
                      key={modChainItemId}
                      lfo={modChainItem}
                      currentTimeMs={currentTimeMs}
                      resolutionX={300}
                      resolutionY={100}
                      modItemId={modChainItemId}
                    />
                    <ModChainOutputNode modItemId={modChainItemId} />
                  </div>
                  <LfoControls
                    lfo={modChainItem}
                    modItemId={modChainItemId}
                    onUpdate={(newLfo) => {
                      setState((s) => ({
                        ...s,
                        modChains: {
                          ...s.modChains,
                          [modChainId]: {
                            ...s.modChains[modChainId],
                            mods: {
                              ...s.modChains[modChainId].mods,
                              [modChainItemId]: {
                                ...s.modChains[modChainId].mods[modChainItemId],
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
                  <ModChainOutputNode modItemId={modChainItemId} />
                </div>
              );
            case "inheritedControlValue":
              return (
                <div className="row">
                  <Control.Container controlId={modChainId} bald>
                    <Control.ReadOnlyValue
                      type={sourceControl.definition.type!}
                      value={getControlValue(state, inheritedControl!)}
                    />
                  </Control.Container>
                  <ModChainOutputNode modItemId={modChainItemId} />
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
                  <ModChainOutputNode modItemId={modChainItemId} />
                </div>
              );
            case "math":
              return (
                <>
                  <InputtableValue<MathMod>
                    modChainId={modChainId}
                    modChainItemId={modChainItemId}
                    modChainItemProperty="value1"
                  />
                  <div className="row">
                    <select
                      value={modChainItem.operation}
                      onChange={(e) => {
                        const operation = e.currentTarget.value as MathModOperation;
                        updateMod((m) => ({ ...m, operation }));
                      }}
                      className="grow"
                    >
                      <option value="+">+</option>
                      <option value="-">-</option>
                      <option value="*">*</option>
                      <option value="/">/</option>
                      <option value="**">^</option>
                    </select>
                    <ModChainOutputNode modItemId={modChainItemId} />
                  </div>
                  <InputtableValue<MathMod>
                    modChainId={modChainId}
                    modChainItemId={modChainItemId}
                    modChainItemProperty="value2"
                  />
                </>
              );
            case "lerp":
              return (
                <>
                  <InputtableValue<LerpMod>
                    modChainId={modChainId}
                    modChainItemId={modChainItemId}
                    modChainItemProperty="value1"
                  />
                  <div className="row">
                    <InputtableValue<LerpMod>
                      modChainId={modChainId}
                      modChainItemId={modChainItemId}
                      modChainItemProperty="interpol"
                      numberInputProps={{
                        min: 0,
                        max: 1,
                        step: 0.1,
                      }}
                    />
                    <ModChainOutputNode modItemId={modChainItemId} />
                  </div>
                  <InputtableValue<LerpMod>
                    modChainId={modChainId}
                    modChainItemId={modChainItemId}
                    modChainItemProperty="value2"
                  />
                </>
              );
          }
        })()}
      </div>
    </div>
  );
});
