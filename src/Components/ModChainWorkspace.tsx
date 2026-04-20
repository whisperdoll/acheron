import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as Control from "./Control";
import GoogleIconButton from "./GoogleIconButton";
import {
  LerpMod,
  Lfo,
  LFOMod,
  MathMod,
  MidiCcMod,
  ModChainItem,
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
import { cx, resolveMaybeGenerated } from "../lib/utils";
import { AppContext } from "../state/AppState";
import { getDefaultModChainItemUI } from "../utils/elysiumutils";

interface Props {}

export default function ModChainWorkspace(props: Props) {
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

  function addModChainItem<T extends ModChainItem>(
    item: Omit<T, keyof SharedModChainItemAttributes>,
  ) {
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
  }

  const draggingMainRow = useRef<boolean>(false);
  const draggingModChainItem = useRef<string | null>(null);
  const zoom = modChainContext.zoom;

  useEffect(() => {
    if (!mainRowRef.current) return;

    const onDown = (e: PointerEvent) => {
      if (e.target !== mainRowRef.current) return;

      e.preventDefault();
      draggingMainRow.current = true;
    };

    const onMove = (e: PointerEvent) => {
      if (!draggingMainRow.current) return;

      e.preventDefault();
      setModChainContext((c) => ({
        ...c,
        offset: { x: c.offset.x + e.movementX, y: c.offset.y + e.movementY },
      }));
    };

    const onUp = (e: PointerEvent) => {
      if (!draggingMainRow.current) return;

      e.preventDefault();
      draggingMainRow.current = false;
    };

    const onCancel = (e: PointerEvent) => {
      if (!draggingMainRow.current) return;

      e.preventDefault();
      draggingMainRow.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.deltaY < 0) {
        setModChainContext((c) => ({ ...c, zoom: c.zoom * 1.1 }));
      } else if (e.deltaY > 0) {
        setModChainContext((c) => ({ ...c, zoom: c.zoom / 1.1 }));
      }
    };

    mainRowRef.current.addEventListener("wheel", onWheel);
    mainRowRef.current.addEventListener("pointerdown", onDown);
    document.body.addEventListener("pointermove", onMove);
    document.body.addEventListener("pointerup", onUp);
    document.body.addEventListener("pointercancel", onCancel);

    return () => {
      mainRowRef.current?.removeEventListener("wheel", onWheel);
      mainRowRef.current?.removeEventListener("pointerdown", onDown);
      document.body.removeEventListener("pointermove", onMove);
      document.body.removeEventListener("pointerup", onUp);
      document.body.removeEventListener("pointercancel", onCancel);
    };
  }, []);

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
          <Control.Label trailingColon={false} />
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
            Add Lerp
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
        </div>

        <ModChainWorkspaceWires />
      </Control.Container>
    </ModChainWorkspaceContext.Provider>
  );
}
