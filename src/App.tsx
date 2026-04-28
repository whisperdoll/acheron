import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./App.global.scss";
import HexGrid from "./Components/HexGrid";
import Inspector from "./Components/Inspector";
import PlayerSettings from "./Components/PlayerSettings";
import LayerSettings from "./Components/LayerSettings";
import { Driver } from "./utils/driver";
import Midi from "./utils/midi";
import Settings from "./Components/Settings";
import { buildMenu } from "./Menu";
import settings, { AppSettings } from "./state/AppSettings";
import useTimer from "./Hooks/useTimer";
import StatusBar from "./Components/StatusBar";
import LayerSelect from "./Components/LayerSelect";
import GoogleIconButton from "./Components/GoogleIconButton";
import GoogleIcon from "./Components/GoogleIcon";
import { confirmPrompt, openComposition, toggleDevtools } from "./utils/desktop";
import ModalController from "./Components/ModalController";
import { addKeyboardShortcutEventListeners, keyboardShortcutString } from "./lib/keyboard";
import Dict from "./lib/dict";
import useLazyRef from "./useLazyRef";
import ModChainWorkspace from "./Components/ModChainWorkspace";
import {
  addLayer,
  AppContext,
  initialState,
  removeLayer,
  togglePlaying,
} from "./state/AppState";
import { deserializeComposition } from "./Serialization";
import { Point, preventDefault } from "./lib/utils";
import useDrag from "./Hooks/useDrag";

export default function App() {
  const [state, setState] = useState(initialState);
  const keyboardShortcuts = settings.useState((s) => s.keyboardShortcuts);
  const keyboardShortcutStrings = useMemo(
    () => Dict.transformedValues(keyboardShortcuts, keyboardShortcutString),
    [keyboardShortcuts],
  );
  const resizing = useRef<
    "leftColumn" | "inspector" | "modChainWorkspace" | "statusBar" | null
  >(null);
  const lastTick = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stopped = useRef(true);

  const leftResizeHandleRef = useRef<HTMLDivElement>(null);
  const inspectorResizeHandleRef = useRef<HTMLDivElement>(null);
  const modChainWorkspaceResizeHandleRef = useRef<HTMLDivElement>(null);
  const statusBarResizeHandleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    leftResizeHandleRef.current?.addEventListener("touchstart", preventDefault);
    inspectorResizeHandleRef.current?.addEventListener("touchstart", preventDefault);
    modChainWorkspaceResizeHandleRef.current?.addEventListener("touchstart", preventDefault);
    statusBarResizeHandleRef.current?.addEventListener("touchstart", preventDefault);

    return () => {
      leftResizeHandleRef.current?.removeEventListener("touchstart", preventDefault);
      inspectorResizeHandleRef.current?.removeEventListener("touchstart", preventDefault);
      modChainWorkspaceResizeHandleRef.current?.removeEventListener(
        "touchstart",
        preventDefault,
      );
      statusBarResizeHandleRef.current?.removeEventListener("touchstart", preventDefault);
    };
  }, []);

  useEffect(() => {
    const triggers: Record<keyof AppSettings["keyboardShortcuts"], { onTrigger: () => void }> =
      {
        addNewLayer: {
          onTrigger: () => addLayer(setState, true, "add layer via keyboard shortcut"),
        },
        play: {
          onTrigger: () => togglePlaying(setState, "toggle play via keyboard shortcut"),
        },
        settings: {
          onTrigger: () => setState((state) => ({ ...state, isShowingSettings: true })),
        },
        toggleMultilayerMode: {
          onTrigger: () => setState((s) => ({ ...s, isMultiLayerMode: !s.isMultiLayerMode })),
        },
        toggleShowInspector: {
          onTrigger: () =>
            setState((s) => ({
              ...s,
              isShowingInspector: !s.isShowingInspector,
            })),
        },
        toggleShowLeftColumn: {
          onTrigger: () =>
            setState((s) => ({
              ...s,
              isShowingLeftColumn: !s.isShowingLeftColumn,
            })),
        },
      };

    const zipped = Dict.zip(keyboardShortcuts, triggers);
    return addKeyboardShortcutEventListeners(Object.values(zipped));
  }, [keyboardShortcuts]);

  const driver = useMemo(() => {
    return new Driver(state);
  }, []);

  const [startTimer, stopTimer] = useTimer({
    onTick: (deltaMs: number) => {
      // console.time("tick");

      // driver.state = new AppStateStore(state, true);
      driver.state = state;

      if (stopped.current && state.isPlaying) {
        driver.start();
        stopped.current = false;
      }

      const now = performance.now();
      let delta = now - lastTick.current;
      const step = 2;

      while (delta > 0) {
        driver.step(Math.min(step, delta));
        delta = Math.max(delta - step, 0);
      }

      if (!stopped.current && !state.isPlaying) {
        driver.stop();
        stopped.current = true;
      }

      setState(driver.state);
      lastTick.current = now;

      // console.timeEnd("tick");
    },
  });

  function updateInspectorWidth() {
    document.documentElement.style.setProperty(
      "--inspectorWidth",
      `${state.inspectorWidth}px`,
    );
  }

  function updateLeftColumnWidth() {
    document.documentElement.style.setProperty(
      "--leftColumnWidth",
      `${state.leftColumnWidth}px`,
    );
  }

  function updateModChainWorkspaceHeight() {
    document.documentElement.style.setProperty(
      "--modChainWorkspaceHeight",
      `${state.modChainWorkspaceHeight}px`,
    );
  }

  useEffect(updateInspectorWidth, [state.inspectorWidth]);
  useEffect(updateLeftColumnWidth, [state.leftColumnWidth]);
  useEffect(updateModChainWorkspaceHeight, [state.modChainWorkspaceHeight]);

  useLayoutEffect(() => {
    updateInspectorWidth();
    updateLeftColumnWidth();

    function up(e: PointerEvent) {
      resizing.current = null;
      document.documentElement.style.cursor = "";
    }

    document.body.addEventListener("pointerup", up);

    return () => {
      document.body.removeEventListener("pointerup", up);
    };
  }, []);

  useEffect(() => {
    lastTick.current = performance.now();
    startTimer();

    return () => stopTimer();
  }, []);

  function toggleLeftColumn() {
    setState((s) => ({ ...s, isShowingLeftColumn: !s.isShowingLeftColumn }));
  }

  useEffect(() => {
    buildMenu({
      async open() {
        const serialized = await openComposition();
        if (!serialized) return;

        const deserialized = deserializeComposition(state, serialized);
        setState(deserialized);
      },
      saveAs() {},
      addLayer() {
        addLayer(setState, true, "add layer from menu");
      },
      async devtools() {
        await toggleDevtools();
      },
      toggleInspector() {
        setState((s) => ({ ...s, isShowingInspector: !s.isShowingInspector }));
      },
      toggleLeftColumn,
      toggleMultilayer() {
        setState((s) => ({ ...s, isMultiLayerMode: !s.isMultiLayerMode }));
      },
    });
  }, []);

  useEffect(() => {
    (async () => {
      if (settings.values.isFirstRun) {
        settings.set({ isFirstRun: false }, "first run check");
      }

      Midi.init();
    })();
  }, []);

  useEffect(() => {
    Midi.onOutputsChanged = (outputs) => {
      setState((s) => ({ ...s, allowedOutputs: outputs }));
    };
    Midi.onInputsChanged = (inputs) => {
      setState((s) => ({ ...s, allowedInputs: inputs }));
    };

    function keyDown(e: KeyboardEvent) {
      //   if ((e.key === "+" || e.key === "=") && e.ctrlKey) {
      //     webFrame.setZoomLevel(webFrame.getZoomLevel() + 0.5);
      //   }
      //   if (e.key === "-" && e.ctrlKey) {
      //     webFrame.setZoomLevel(webFrame.getZoomLevel() - 0.5);
      //   }

      if ("1234567890".includes(e.key) && e.ctrlKey) {
        let layerIndex = parseInt(e.key) - 1;

        if (layerIndex === -1) {
          layerIndex = 9;
        }

        if (layerIndex < state.layers.length) {
          e.preventDefault();
          setState((state) => ({
            ...state,
            selectedHex: { ...state.selectedHex, layerIndex },
          }));
        }
      }
    }

    document.body.addEventListener("keydown", keyDown);

    return () => {
      Midi.onOutputsChanged = null;
      Midi.onInputsChanged = null;
      Midi.onNotesChanged = null;
      document.body.removeEventListener("keydown", keyDown);
    };
  }, []);

  settings.useSubscription(
    (_, settings) => {
      Midi.setEnabledInputs(settings.midiInputs);
    },
    [],
    settings.filters.deepEqual((s) => s.midiInputs),
  );

  settings.useSubscription(
    (_, settings) => {
      Midi.setEnabledOutputs(settings.midiOutputs);
    },
    [],
    settings.filters.deepEqual((s) => s.midiOutputs),
  );

  async function confirmRemoveLayer(layerIndex?: number) {
    if (layerIndex === undefined) {
      layerIndex = state.selectedHex.layerIndex;
    }

    if (state.layers.length === 1) {
      // TODO
      // remote.dialog.showMessageBox(remote.getCurrentWindow(), {
      //   message: "You must have at least one layer.",
      //   buttons: ["Fine"],
      //   noLink: true,
      //   type: "info",
      //   title: "Cannot delete only layer",
      // });
    } else if (
      !settings.values.confirmDelete ||
      (await confirmPrompt(
        `Are you sure you want to delete the layer '${state.layers[layerIndex].name}'?`,
        "Confirm delete",
      ))
    ) {
      removeLayer(setState, layerIndex, "removing layer");
    }
  }

  function setMultiLayerSize(n: string) {
    const size = parseInt(n);
    if (isNaN(size)) return;

    setState((s) => ({
      ...s,
      multiLayerSize: size,
    }));
  }

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--multilayer-cols",
      state.multiLayerSize.toString(),
    );
  }, [state.multiLayerSize]);

  const onDrag = useCallback((pos: Point, invertedPos: Point) => {
    switch (resizing.current) {
      case "leftColumn":
        setState((s) => ({ ...s, leftColumnWidth: Math.max(pos.x, 100) }));
        break;
      case "inspector":
        setState((s) => ({ ...s, inspectorWidth: Math.max(invertedPos.x, 100) }));
        break;
      case "modChainWorkspace":
        setState((s) => ({ ...s, modChainWorkspaceHeight: Math.max(invertedPos.y, 100) }));
        break;
      default:
        throw "unknown resize";
    }
  }, []);

  const { startDragging } = useDrag(onDrag);

  const inspector = (
    <>
      <div
        className="resizeHandle"
        onPointerDown={(e) => {
          e.preventDefault();
          document.documentElement.style.cursor = "ew-resize";
          resizing.current = "inspector";
          startDragging(e, { x: state.inspectorWidth, y: 0 });
        }}
        ref={inspectorResizeHandleRef}
        style={{ display: state.isShowingInspector ? undefined : "none" }}
      ></div>

      {state.isShowingInspector ? (
        <>
          <Inspector layerIndex={state.selectedHex.layerIndex} />
        </>
      ) : (
        <>
          <GoogleIconButton
            className="showInspector"
            icon="frame_inspect"
            buttonStyle="rounded"
            fill
            onClick={() =>
              setState((s) => ({ ...s, isShowingInspector: !s.isShowingInspector }))
            }
            opticalSize={20}
            title={`Show Inspector (${keyboardShortcutStrings.toggleShowInspector})`}
          />
        </>
      )}
    </>
  );

  const leftColumn = (
    <>
      {state.isShowingLeftColumn ? (
        <>
          <div className="leftColumn">
            <div className="mainHeader">
              <GoogleIcon icon="globe" buttonStyle="rounded" fill opticalSize={20} />
              <span className="label">Player Properties</span>
              <GoogleIconButton
                className="pin"
                icon="keep_off"
                fill
                buttonStyle="rounded"
                onClick={toggleLeftColumn}
                opticalSize={20}
                title={`Unpin Player Properties (${keyboardShortcutStrings.toggleShowLeftColumn})`}
              />
            </div>
            <div className="tabs">
              <button
                onClick={() => setState((s) => ({ ...s, leftColumnTab: "player" }))}
                className={state.leftColumnTab === "player" ? "active" : ""}
              >
                Global
              </button>
              <button
                onClick={() => setState((s) => ({ ...s, leftColumnTab: "layer" }))}
                className={state.leftColumnTab === "layer" ? "active" : ""}
              >
                Layer
              </button>
            </div>
            {state.leftColumnTab === "player" ? (
              <PlayerSettings />
            ) : (
              <LayerSettings layerIndex={state.selectedHex.layerIndex}></LayerSettings>
            )}
          </div>
        </>
      ) : (
        <>
          <GoogleIconButton
            className="showLeftColumn"
            icon="globe"
            buttonStyle="rounded"
            fill
            opticalSize={20}
            onClick={toggleLeftColumn}
            title={`Show Player Properties (${keyboardShortcutStrings.toggleShowLeftColumn})`}
          />
        </>
      )}

      <div
        className="resizeHandle"
        onPointerDown={(e) => {
          e.preventDefault();
          document.documentElement.style.cursor = "ew-resize";
          resizing.current = "leftColumn";
          startDragging(e, { x: state.leftColumnWidth, y: 0 });
        }}
        ref={leftResizeHandleRef}
        style={{ display: state.isShowingLeftColumn ? undefined : "none" }}
      ></div>
    </>
  );

  return (
    <AppContext.Provider value={{ state, setState }}>
      <div className="app">
        {state.isShowingSettings && (
          <Settings onHide={() => setState((s) => ({ ...s, isShowingSettings: false }))} />
        )}
        {/* {state.editingLfo && <LfoEditor />} */}
        <div className="columns">
          {leftColumn}

          <div
            className={`middleColumn ${
              state.isMultiLayerMode ? "multilayer" : "single-layer"
            }`}
          >
            {state.isMultiLayerMode ? (
              <>
                <div className="multilayerSizeContainer">
                  <span className="columnsLabel">Columns: {state.multiLayerSize}</span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={state.multiLayerSize}
                    onChange={(e) => setMultiLayerSize(e.currentTarget.value)}
                  />
                  <GoogleIconButton
                    icon="add"
                    buttonStyle="rounded"
                    fill
                    onClick={(e) => addLayer(setState, true, "add layer button")}
                  >
                    Add Layer ({keyboardShortcutString(keyboardShortcuts.addNewLayer)})
                  </GoogleIconButton>
                </div>
                <div className="multilayer">
                  {state.layers.map((layer, layerIndex) => (
                    <div className="layerContainer" key={layerIndex}>
                      <div className="layerName">
                        <span>{layer.name}</span>
                        <GoogleIconButton
                          buttonStyle="rounded"
                          icon="close"
                          fill
                          opticalSize={20}
                          title="Remove Layer"
                          onClick={() => confirmRemoveLayer(layerIndex)}
                          className="nostyle remove"
                        />
                      </div>
                      <HexGrid layerIndex={layerIndex} key={layerIndex} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <LayerSelect />
                <HexGrid layerIndex={state.selectedHex.layerIndex} />
              </>
            )}
          </div>

          {inspector}
        </div>

        <div
          className="resizeHandle-alt"
          onPointerDown={(e) => {
            e.preventDefault();
            document.documentElement.style.cursor = "ns-resize";
            resizing.current = "modChainWorkspace";
            startDragging(e, { x: 0, y: state.modChainWorkspaceHeight });
          }}
          ref={modChainWorkspaceResizeHandleRef}
          style={{
            display: state.modChainControl ? undefined : "none",
          }}
        ></div>

        {state.modChainControl && (
          <>
            <ModChainWorkspace />
          </>
        )}

        <div
          className="resizeHandle-alt"
          onPointerDown={(e) => {
            e.preventDefault();
            document.documentElement.style.cursor = "ns-resize";
            resizing.current = "statusBar";
            startDragging(e, { x: 0, y: state.statusBarHeight });
          }}
          ref={statusBarResizeHandleRef}
        ></div>

        <StatusBar />
        <ModalController />
      </div>
    </AppContext.Provider>
  );
}
