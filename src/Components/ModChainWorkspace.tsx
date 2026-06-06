import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as Control from "./Control";
import GoogleIconButton from "./GoogleIconButton";
import {
  ControlValueMod,
  LerpMod,
  Lfo,
  LFOMod,
  MathMod,
  MidiCcMod,
  ModChainItem,
  ModOutput,
  SequenceMod,
  SharedModChainItemAttributes,
} from "../Types";
import { v4 as uuidv4 } from "uuid";
import LfoVisualizer from "./LfoVisualizer";
import LfoControls from "./LfoControls";
import ModChainItemComponent from "./ModChainItemComponent";
import {
  IModChainWorkspaceContext,
  IModChainWorkspaceContextProps,
  ModChainWorkspaceContext,
} from "../state/ModChainWorkspaceContext";
import ModChainWorkspaceWires from "./ModChainWorkspaceWires";
import { cx, preventDefault, resolveMaybeGenerated } from "../lib/utils";
import { AppContext, connectModItems, playerControls } from "../state/AppState";
import { getDefaultModChainItemUI } from "../utils/elysiumutils";
import { sliceObject } from "../lib/utils";
import { LayerControlTypes } from "../utils/DefaultDefinitions";
import useEventListener from "../Hooks/useEventListener";

export default function ModChainWorkspace() {
  const { state, setState } = useContext(AppContext)!;
  const containerRef = useRef<HTMLDivElement>(null);
  const mainRowRef = useRef<HTMLDivElement>(null);
  const scrollPartContainerRef = useRef<HTMLDivElement>(null);
  const { modChainControl, control, modChain } = {
    modChainControl: state.modChainControl!,
    control: state.controls[state.modChainControl!],
    modChain: state.modChains[state.modChainControl!],
  };

  function calculateContainerBounds() {
    if (!containerRef.current) return;

    const bounds = containerRef.current.getBoundingClientRect();

    return {
      width: bounds.width,
      height: bounds.height,
      top: bounds.top,
      left: bounds.left,
      scrollHeight: containerRef.current.scrollHeight,
      scrollWidth: containerRef.current.scrollWidth,
      scrollTop: containerRef.current.scrollTop,
      scrollLeft: containerRef.current.scrollLeft,
    };
  }

  const [modChainContext, _setModChainContext] = useState<IModChainWorkspaceContextProps>(
    () => ({
      connectingOutput: undefined,
      modChainId: modChainControl,
      containerRef,
      containerBounds: calculateContainerBounds(),
      offset: { x: 0, y: 0 },
      zoom: 1,
    }),
  );

  const setModChainContext = useCallback<NonNullable<IModChainWorkspaceContext["set"]>>(
    (values) => {
      _setModChainContext((p) => {
        return {
          ...p,
          ...resolveMaybeGenerated(values, p),
        };
      });
    },
    [_setModChainContext],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      setModChainContext({ containerBounds: calculateContainerBounds() });
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [setModChainContext]);

  const modChainContextProviderValue: IModChainWorkspaceContext = useMemo(() => {
    return {
      ...modChainContext,
      set: setModChainContext,
    };
  }, [modChainContext, setModChainContext]);

  const addModChainItem = useCallback(
    <T extends ModChainItem>(item: Omit<T, keyof SharedModChainItemAttributes>) => {
      const id = uuidv4();
      setState((s) => ({
        ...s,
        modChains: {
          ...s.modChains,
          [s.modChainControl!]: {
            ...s.modChains[s.modChainControl!],
            mods: {
              ...s.modChains[s.modChainControl!].mods,
              [id]: {
                ...item,
                ui: {
                  x: -modChainContext.offset.x + 8,
                  y: -modChainContext.offset.y + 8,
                },
                isDefault: false,
                removeable: true,
              } as T,
            },
          },
        },
      }));
    },
    [modChainContext.offset.x, modChainContext.offset.y, setState],
  );

  const draggingMainRow = useRef<boolean>(false);
  const draggingModChainItem = useRef<string | null>(null);
  const zoom = modChainContext.zoom;

  useEventListener(mainRowRef, "wheel", (e) => {
    e.preventDefault();

    if (e.deltaY < 0) {
      setModChainContext((c) => ({ ...c, zoom: c.zoom * 1.1 }));
    } else if (e.deltaY > 0) {
      setModChainContext((c) => ({ ...c, zoom: c.zoom / 1.1 }));
    }
  });

  useEventListener(mainRowRef, "pointerdown", (e) => {
    if (e.target !== mainRowRef.current) return;

    e.preventDefault();
    draggingMainRow.current = true;
  });

  useEventListener(mainRowRef, "touchstart", (e) => {
    if (e.target === mainRowRef.current) {
      e.preventDefault();
    }
  });

  useEventListener(document.body, "pointermove", (e) => {
    if (!draggingMainRow.current) return;

    e.preventDefault();
    setModChainContext((c) => ({
      ...c,
      offset: { x: c.offset.x + e.movementX / zoom, y: c.offset.y + e.movementY / zoom },
    }));
  });

  useEventListener(document.body, "pointerup", (e) => {
    if (!draggingMainRow.current) return;

    e.preventDefault();
    draggingMainRow.current = false;
  });

  useEventListener(document.body, "pointercancel", (e) => {
    if (!draggingMainRow.current) return;

    e.preventDefault();
    draggingMainRow.current = false;
  });

  useEventListener(
    document.body,
    "pointerup",
    useCallback(
      (e: PointerEvent) => {
        if (!modChainContext.connectingOutput) return;

        e.preventDefault();
        setModChainContext({ connectingOutput: undefined });

        const target = document.elementFromPoint(e.clientX, e.clientY);
        if (!(target instanceof HTMLElement)) return;

        // if direct to output
        if (target.parentElement?.dataset.modChainOutput) {
          connectModItems(setState, state.modChainControl!, {
            from: modChainContext.connectingOutput.modItemId,
            fromOutput: modChainContext.connectingOutput.outputKey,
            to: ModOutput,
          });

          return;
        }

        // elseif to a node
        const modChainInputNodeId = target.dataset.modChainInputNodeId;
        const modChainInputNodeProperty = target.dataset.modChainInputNodeProperty;

        if (!modChainInputNodeId || !modChainInputNodeProperty) return;

        connectModItems(setState, state.modChainControl!, {
          from: modChainContext.connectingOutput.modItemId,
          fromOutput: modChainContext.connectingOutput.outputKey,
          to: modChainInputNodeId,
          toProperty: modChainInputNodeProperty,
        });
      },
      [modChainContext.connectingOutput, setModChainContext, setState, state.modChainControl],
    ),
  );

  useEffect(() => {
    if (state.listeningForControlValueSelection === null) return;

    addModChainItem<ControlValueMod>({
      __type: "controlValue",
      controlId: state.listeningForControlValueSelection,
      outputs: ["output"],
    });

    setState((s) => ({ ...s, listeningForControlValueSelection: null }));
  }, [addModChainItem, setState, state.listeningForControlValueSelection]);

  const label = useMemo<string>(() => {
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

    const token = Object.values(state.tokens).find((t) => t.controlIds.includes(control.id));
    if (token) {
      return `${base} (${token.label})`;
    }

    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [control]);

  if (!modChain) return null;

  return (
    <ModChainWorkspaceContext.Provider value={modChainContextProviderValue}>
      <Control.Container
        controlId={control.id}
        bald
        className={cx("modChainWorkspace", {
          listeningForConnections: modChainContextProviderValue.connectingOutput,
        })}
        ref={containerRef}
      >
        <div className="header">
          <span className="label">{label}</span>
          <GoogleIconButton
            buttonStyle="rounded"
            icon="close"
            fill
            opticalSize={20}
            title="Hide workspace"
            onClick={(e) => {
              setState((s) => ({ ...s, modChainControl: undefined }));
            }}
            className="nostyle remove"
          />
        </div>

        <div className="mainRow" ref={mainRowRef}>
          {Object.entries(modChain.mods).map(([modChainItemId, modChainItem], i) => {
            return (
              <ModChainItemComponent
                key={modChainItemId}
                id={modChainItemId}
                controlId={modChainControl}
                style={{
                  left: `${(modChainItem.ui.x + modChainContext.offset.x) * zoom}px`,
                  top: `${(modChainItem.ui.y + modChainContext.offset.y) * zoom}px`,
                  transform: `scale(${zoom})`,
                }}
              />
            );
          })}
        </div>

        <div className="mainOutput">
          <GoogleIconButton
            className={cx("modChainWorkspaceOutput", {
              connected: !!modChain.output,
            })}
            data-mod-chain-output={true}
            naked
            icon="output"
            buttonStyle="rounded"
            size={5}
          />
        </div>

        <div className="addButtons">
          <GoogleIconButton
            icon="airwave"
            size={1}
            buttonStyle="rounded"
            onClick={() => {
              addModChainItem<LFOMod>({
                __type: "lfo",
                hiPeriod: 1,
                lowPeriod: 2,
                max: 1,
                min: -1,
                period: 1,
                sequence: [],
                type: "sine",
                outputs: ["output"],
              });
            }}
          >
            Add LFO
          </GoogleIconButton>
          <GoogleIconButton
            icon="calculate"
            size={1}
            buttonStyle="rounded"
            onClick={() => {
              addModChainItem<MathMod>({
                __type: "math",
                value1: 0,
                value2: 0,
                operation: "+",
                outputs: ["output"],
              });
            }}
          >
            Add Math
          </GoogleIconButton>
          <GoogleIconButton
            icon="linear_scale"
            size={1}
            buttonStyle="rounded"
            onClick={() => {
              addModChainItem<LerpMod>({
                __type: "lerp",
                value1: 0,
                value2: 100,
                interpol: 0.5,
                outputs: ["output"],
              });
            }}
          >
            Add Mix
          </GoogleIconButton>
          <GoogleIconButton
            icon="clock_loader_10"
            size={1}
            onClick={() => {
              addModChainItem<MidiCcMod>({
                __type: "midiCc",
                controllerNumber: 16,
                outputs: ["output"],
              });
            }}
          >
            Add MIDI CC
          </GoogleIconButton>
          <GoogleIconButton
            icon="format_list_numbered"
            onClick={() => {
              addModChainItem<SequenceMod>({
                __type: "sequence",
                index: 0,
                values: [1, 2, 3],
                outputs: ["output", "lengthOutput"],
              });
            }}
          >
            Add Sequence
          </GoogleIconButton>
          {state.listeningForControlValue ? (
            <GoogleIconButton
              icon="ear_sound"
              onClick={() => {
                setState((s) => ({ ...s, listeningForControlValue: false }));
              }}
              className="listening"
            >
              Listening... Click to cancel
            </GoogleIconButton>
          ) : (
            <GoogleIconButton
              icon="search"
              onClick={() => {
                setState((s) => ({ ...s, listeningForControlValue: true }));
              }}
            >
              Add Control Value
            </GoogleIconButton>
          )}
        </div>

        <ModChainWorkspaceWires />
      </Control.Container>
    </ModChainWorkspaceContext.Provider>
  );
}
