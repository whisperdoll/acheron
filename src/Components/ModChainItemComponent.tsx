import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppContext,
  AppState,
  getControlLayer,
  getControlValue,
  getInheritedControl,
  playerControls,
  removeModItem,
  resolveInputtableValue,
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
  MidiCcMod,
  ModChainItem,
  SequenceMod,
  ShallowControlState,
} from "../Types";
import { ModChainWorkspaceContext } from "../state/ModChainWorkspaceContext";
import ModChainOutputNode from "./ModChainOutputNode";
import NumberInput from "./NumberInput";
import { isFunction, mod, preventDefault, roundMod } from "../lib/utils";
import ModChainInputNode from "./ModChainInputNode";
import InputtableValue from "./InputtableValue";
import GoogleIconButton from "./GoogleIconButton";
import Midi from "../utils/midi";
import useNow from "../Hooks/useNow";
import { produce } from "immer";
import { sliceObject } from "../utils/utils";
import { LayerControlTypes } from "../utils/DefaultDefinitions";
import NonShrinking from "./NonShrinking";

interface Props {
  id: string;
  controlId: string;
}

export default React.memo(function ModChainItemComponent(
  props: Props & React.JSX.IntrinsicElements["div"],
) {
  const { state, setState } = useContext(AppContext)!;
  const { id: modChainItemId, controlId: modChainId, ...rest } = props;

  const workspaceContext = useContext(ModChainWorkspaceContext);
  const now = useNow();
  const modChain = state.modChains[modChainId];
  const modChainItem = modChain.mods[modChainItemId];
  const sourceControl = state.controls[modChainId];
  const currentTimeMs = state.layers[0].currentTimeMs;
  const inheritedControl = useMemo(() => {
    return getInheritedControl(state, sourceControl);
  }, [modChainItem, sourceControl]);

  const [midiCcTrigger, _setMidiCcTrigger] = useState(0);

  const setMidiCcTrigger = useCallback((value: number) => {
    _setMidiCcTrigger(value);

    setState(
      produce<AppState>((s) => {
        s.modChains[modChainId] = {
          ...s.modChains[modChainId],
          mods: {
            ...s.modChains[modChainId].mods,
            [modChainItemId]: { ...s.modChains[modChainId].mods[modChainItemId] },
          },
        };
      }),
    );
  }, []);

  useEffect(() => {
    if (modChainItem.__type !== "midiCc") return;

    const controllerNumber = resolveInputtableValue<MidiCcMod>(
      state,
      modChainId,
      modChainItemId,
      "controllerNumber",
      null,
    );

    setMidiCcTrigger(Midi.ccValue(roundMod(controllerNumber, 0, 128)) / 127);

    const onChange: (typeof Midi.onCC)[number] = ({ number, value }) => {
      if (number !== controllerNumber) return;

      setMidiCcTrigger(value / 127);
    };

    Midi.onCC.push(onChange);

    return () => {
      Midi.onCC.splice(Midi.onCC.indexOf(onChange), 1);
    };
  }, [modChainItem.__type === "midiCc" && now]);

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

  const label = useMemo<string>(() => {
    switch (modChainItem.__type) {
      case "lfo":
        return "LFO";
      case "fixedControlValue":
        return `Fixed ${state.controls[modChainItem.controlId].definition.type} value`;
      case "fixedValue":
        return "Fixed value";
      case "controlValue": {
        const control = state.controls[modChainItem.controlId];
        const base = control.definition.label!;
        if (Object.values(playerControls(state)).includes(control.id)) {
          return `${base} (Global)`;
        }

        const layer = state.layers.find((l) =>
          Object.values(sliceObject(l, LayerControlTypes)).includes(control.id),
        );
        if (layer) {
          return `${base} (${layer.name})`;
        }

        const token = Object.values(state.tokens).find((t) =>
          t.controlIds.includes(control.id),
        );
        if (token) {
          return `${base} (${token.label})`;
        }

        return base;
      }
      case "inheritedControlValue":
        return "Inherited value";
      case "math":
        return "Math";
      case "lerp":
        return "Lerp";
      case "midiCc":
        return "MIDI CC";
      case "sequence":
        return "Sequence";
    }
  }, [modChainItem.__type]);

  const dragging = useRef<boolean>(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const modPosStart = useRef<{ x: number; y: number }>(modChainItem.ui);
  const zoom = workspaceContext.zoom;

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      e.preventDefault();

      if (e.target !== headerRef.current) return;

      dragging.current = true;
      modPosStart.current = modChainItem.ui;
      draggingStart.current = { x: e.clientX, y: e.clientY };
    };

    const onTouch = (e: TouchEvent) => {
      if (e.target !== headerRef.current) return;

      e.preventDefault();
    };

    headerRef.current?.addEventListener("pointerdown", onDown);
    headerRef.current?.addEventListener("touchstart", onTouch);

    return () => {
      headerRef.current?.removeEventListener("pointerdown", onDown);
      headerRef.current?.removeEventListener("touchstart", onTouch);
    };
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
          x: modPosStart.current.x + draggingOffset.x / zoom,
          y: modPosStart.current.y + draggingOffset.y / zoom,
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

    const onWheel = (e: WheelEvent) => {
      e.stopPropagation();
    };

    containerRef.current.addEventListener("wheel", onWheel);
    resizeObserver.observe(containerRef.current);
    document.body.addEventListener("pointermove", onMove);
    document.body.addEventListener("pointerup", onUp);
    document.body.addEventListener("pointercancel", onCancel);

    return () => {
      containerRef.current?.removeEventListener("wheel", onWheel);
      resizeObserver.disconnect();
      document.body.removeEventListener("pointermove", onMove);
      document.body.removeEventListener("pointerup", onUp);
      document.body.removeEventListener("pointercancel", onCancel);
    };
  }, [zoom]);

  return (
    <div ref={containerRef} className={`modChainItem ${modChainItem.__type}`} {...rest}>
      <div className="header" ref={headerRef}>
        <span title={label} className="label">
          {label}
        </span>

        <span className="spacer" />

        {(modChainItem.__type === "controlValue" ||
          modChainItem.__type === "inheritedControlValue") && (
          <GoogleIconButton
            buttonStyle="rounded"
            icon="open_in_new"
            fill
            opticalSize={20}
            title="Goto Control Modchain"
            onPointerDown={(e) => {
              e.stopPropagation();
              console.log("icon");
            }}
            onClick={(e) => {
              setState((s) => ({
                ...s,
                modChainControl:
                  modChainItem.__type === "controlValue"
                    ? modChainItem.controlId
                    : inheritedControl!.id,
              }));
            }}
            className="nostyle"
          />
        )}

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
            className="nostyle"
          />
        )}
      </div>
      <div
        className="contents"
        onScroll={(e) => {
          // force wire refresh
          workspaceContext.set((w) => ({ ...w, containerBounds: { ...w.containerBounds! } }));
        }}
      >
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
                    <ModChainOutputNode modItemId={modChainItemId} outputKey="output" />
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
                  <ModChainOutputNode modItemId={modChainItemId} outputKey="output" />
                </div>
              );
            case "inheritedControlValue":
              return (
                <div className="row">
                  <Control.Container controlId={modChainId} bald>
                    <NonShrinking>
                      <Control.ReadOnlyValue
                        type={sourceControl.definition.type!}
                        value={getControlValue(state, inheritedControl!)}
                      />
                    </NonShrinking>
                  </Control.Container>
                  <ModChainOutputNode modItemId={modChainItemId} outputKey="output" />
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
                  <ModChainOutputNode modItemId={modChainItemId} outputKey="output" />
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
                    <ModChainOutputNode modItemId={modChainItemId} outputKey="output" />
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
                    <ModChainOutputNode modItemId={modChainItemId} outputKey="output" />
                  </div>
                  <InputtableValue<LerpMod>
                    modChainId={modChainId}
                    modChainItemId={modChainItemId}
                    modChainItemProperty="value2"
                  />
                </>
              );
            case "midiCc":
              return (
                <>
                  <div className="row">
                    <InputtableValue<MidiCcMod>
                      modChainId={modChainId}
                      modChainItemId={modChainItemId}
                      modChainItemProperty="controllerNumber"
                      numberInputProps={{
                        max: 127,
                        min: 0,
                        roundPlaces: 0,
                        coerce(value) {
                          return roundMod(value, 0, 128);
                        },
                      }}
                    />
                    <ModChainOutputNode
                      value={midiCcTrigger}
                      modItemId={modChainItemId}
                      outputKey="output"
                    />
                  </div>
                </>
              );
            case "sequence":
              return (
                <>
                  <div className="row gap-1">
                    <div className="col gap-0-5">
                      <InputtableValue<SequenceMod>
                        modChainId={modChainId}
                        modChainItemId={modChainItemId}
                        modChainItemProperty="index"
                        label="Index:"
                        numberInputProps={{
                          min: 0,
                          max: modChainItem.values.length - 1,
                          coerce: (v) => roundMod(v, 0, modChainItem.values.length),
                        }}
                      />
                      <InputtableValue<SequenceMod>
                        modChainId={modChainId}
                        modChainItemId={modChainItemId}
                        modChainItemProperty="indexPc"
                        label="Percent:"
                        numberInputProps={{
                          min: 0,
                          max: 1,
                          step: 0.01,
                          coerce: (v) => (v === undefined ? 0 : mod(v, 1)),
                        }}
                      />
                    </div>
                    <div className="col gap-0-5">
                      <div className="row">
                        Value:{" "}
                        <ModChainOutputNode modItemId={modChainItemId} outputKey="output" />
                      </div>
                      <div className="row">
                        Length:{" "}
                        <ModChainOutputNode
                          modItemId={modChainItemId}
                          outputKey="lengthOutput"
                        />
                      </div>
                    </div>
                  </div>
                  <hr />
                  {modChainItem.values.map((value, i) => {
                    return (
                      <div className="row" key={i}>
                        <InputtableValue<Record<string, number>>
                          modChainId={modChainId}
                          modChainItemId={modChainItemId}
                          modChainItemProperty={`values.${i}`}
                          key={i}
                        />
                        <GoogleIconButton
                          buttonStyle="rounded"
                          icon="close"
                          fill
                          opticalSize={20}
                          title="Remove Node"
                          onClick={(e) => {
                            setState(
                              produce<AppState>((s) => {
                                const values = (
                                  s.modChains[modChainId].mods[modChainItemId] as SequenceMod
                                ).values;

                                if (values.length === 1) return s;

                                values.splice(i, 1);
                              }),
                            );
                          }}
                          className="nostyle remove"
                        />
                      </div>
                    );
                  })}

                  <GoogleIconButton
                    icon="add"
                    fill
                    onClick={(e) => {
                      setState(
                        produce<AppState>((s) => {
                          (
                            s.modChains[modChainId].mods[modChainItemId] as SequenceMod
                          ).values.push(0);
                        }),
                      );
                    }}
                  >
                    Add value
                  </GoogleIconButton>
                </>
              );
          }
        })()}
      </div>
    </div>
  );
});
