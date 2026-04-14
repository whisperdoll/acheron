import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Control from "./Control";
import GoogleIconButton from "./GoogleIconButton";
import { Lfo, ModChainItem } from "../Types";
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

interface Props {}

export default function ModChainWorkspace(props: Props) {
  const { state, setState } = useContext(AppContext)!;
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPartContainerRef = useRef<HTMLDivElement>(null);
  const { modChainControl, control, modChain } = {
    modChainControl: state.modChainControl!,
    control: state.controls[state.modChainControl!],
    modChain: state.modChains[state.modChainControl!],
  };

  function calculateContainerBounds() {
    if (!containerRef.current || !scrollPartContainerRef.current) return;

    const bounds = containerRef.current.getBoundingClientRect();

    return {
      width: bounds.width,
      height: bounds.height,
      top: bounds.top,
      left: bounds.left,
      scrollHeight: scrollPartContainerRef.current.scrollHeight,
      scrollWidth: scrollPartContainerRef.current.scrollWidth,
      scrollTop: scrollPartContainerRef.current.scrollTop,
      scrollLeft: scrollPartContainerRef.current.scrollLeft,
    };
  }

  const [modChainContext, _setModChainContext] =
    useState<IModChainWorkspaceContextProps>(() => ({
      connectingOutput: undefined,
      modChainId: modChainControl,
      containerRef,
      containerBounds: calculateContainerBounds(),
    }));

  const setModChainContext = useCallback<
    NonNullable<IModChainWorkspaceContext["set"]>
  >(
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
    if (!containerRef.current || !scrollPartContainerRef.current) return;

    const observer = new ResizeObserver(() => {
      setModChainContext({ containerBounds: calculateContainerBounds() });
    });

    observer.observe(scrollPartContainerRef.current);

    const onScroll = () => {
      setModChainContext({ containerBounds: calculateContainerBounds() });
    };

    scrollPartContainerRef.current.addEventListener("scroll", onScroll);

    return () => {
      scrollPartContainerRef.current?.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [setModChainContext]);

  const modChainContextProviderValue: IModChainWorkspaceContext =
    useMemo(() => {
      return {
        ...modChainContext,
        set: setModChainContext,
      };
    }, [modChainContext, setModChainContext]);

  function addModChainItem(item: ModChainItem) {
    const id = uuidv4();
    setState((s) => ({
      ...s,
      modChains: {
        ...s.modChains,
        [s.modChainControl!]: {
          ...s.modChains[s.modChainControl!],
          mods: {
            ...s.modChains[s.modChainControl!].mods,
            [id]: item,
          },
        },
      },
    }));
  }

  function addLfo() {
    addModChainItem({
      __type: "lfo",
      hiPeriod: 1,
      lowPeriod: 2,
      max: 1,
      min: -1,
      period: 1,
      sequence: [],
      type: "sine",
    });
  }

  if (!modChain) return null;

  return (
    <ModChainWorkspaceContext.Provider value={modChainContextProviderValue}>
      <Control.Container
        controlId={control.id}
        bald
        className={cx("modChainWorkspace", {
          listeningForConnections:
            modChainContextProviderValue.connectingOutput,
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
            title="Remove Layer"
            onClick={(e) => {
              setState((s) => ({ ...s, modChainControl: undefined }));
            }}
            className="nostyle remove"
          />
        </div>

        <div className="mainRow">
          <div className="scrollPart" ref={scrollPartContainerRef}>
            {Object.entries(modChain.mods).map(
              ([modChainItemId, modChainItem]) => {
                return (
                  <ModChainItemComponent
                    key={modChainItemId}
                    id={modChainItemId}
                    controlId={modChainControl}
                  />
                );
              },
            )}
          </div>
          <div className="fixedPart">
            <GoogleIconButton
              className={cx("modChainWorkspaceOutput", {
                connected: !!modChain.output,
              })}
              data-mod-chain-output={true}
              naked
              icon="output"
              buttonStyle="rounded"
              size={10}
            />
          </div>
        </div>

        <div className="addButtons">
          <GoogleIconButton
            icon="airwave"
            size={1}
            buttonStyle="rounded"
            onClick={addLfo}
          >
            Add LFO
          </GoogleIconButton>
        </div>

        <ModChainWorkspaceWires />
      </Control.Container>
    </ModChainWorkspaceContext.Provider>
  );
}
