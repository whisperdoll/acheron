import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import "./App.global.scss";
import HexGrid from "./Components/HexGrid";
import Inspector from "./Components/Inspector";
import PlayerSettings from "./Components/PlayerSettings";
import LayerSettings from "./Components/LayerSettings";
import {
  performStartCallbacks,
  performStopCallbacks,
  performTransfers,
  progressLayer,
} from "./utils/driver";
import { coerceControlValueToNumber, ControlState } from "./Types";
import Midi from "./utils/midi";
import { hexNotes, transposeNote } from "./utils/elysiumutils";
import Settings from "./Components/Settings";
import LfoEditor from "./Components/LfoEditor";
import { buildMenu } from "./Menu";
import { deserializeComposition } from "./Serialization";
import state from "./state/AppState";
import settings, { AppSettings } from "./state/AppSettings";
import useTimer from "./Hooks/useTimer";
import StatusBar from "./Components/StatusBar";
import LayerSelect from "./Components/LayerSelect";
import GoogleIconButton from "./Components/GoogleIconButton";
import GoogleIcon from "./Components/GoogleIcon";
import {
  confirmPrompt,
  openComposition,
  toggleDevtools,
} from "./utils/desktop";
import ModalController from "./Components/ModalController";
import { addKeyboardShortcutEventListeners } from "./lib/keyboard";
import Dict from "./lib/dict";

export default function App() {
  const reactiveState = state.useState();
  const keyboardShortcuts = settings.useState((s) => s.keyboardShortcuts);
  const resizing = useRef<"leftColumn" | "inspector" | null>(null);
  const notePlayedAsCache = useRef<
    Record<string, { note: string; channel: number }>
  >({});
  const lastTick = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stopped = useRef(true);

  useEffect(() => {
    const triggers: Record<
      keyof AppSettings["keyboardShortcuts"],
      { onTrigger: () => void }
    > = {
      addNewLayer: {
        onTrigger: () =>
          state.addLayer(true, "add layer via keyboard shortcut"),
      },
      play: {
        onTrigger: () =>
          state.togglePlaying("toggle play via keyboard shortcut"),
      },
      settings: {
        onTrigger: () =>
          state.set(
            { isShowingSettings: true },
            "show settings via keyboard shortcut"
          ),
      },
      toggleMultilayerMode: {
        onTrigger: () =>
          state.set(
            (s) => ({ isMultiLayerMode: !s.isMultiLayerMode }),
            "toggle multilayer mode via keyboard shortcut"
          ),
      },
      toggleShowInspector: {
        onTrigger: () =>
          state.set(
            (s) => ({ isShowingInspector: !s.isShowingInspector }),
            "toggle showing inspector via keyboard shortcut"
          ),
      },
      toggleShowLeftColumn: {
        onTrigger: () =>
          state.set(
            (s) => ({ isShowingLeftColumn: !s.isShowingLeftColumn }),
            "toggle showing left column via keyboard shortcut"
          ),
      },
    };

    const zipped = Dict.zip(keyboardShortcuts, triggers);
    return addKeyboardShortcutEventListeners(Object.values(zipped));
  }, [keyboardShortcuts]);

  const [startTimer, stopTimer] = useTimer({
    onTick: (deltaMs: number) => {
      // console.time("tick");

      let newState = { ...state.values };

      if (stopped.current && state.values.isPlaying) {
        newState = performStartCallbacks(newState);
        stopped.current = false;
      }

      const now = performance.now();
      if (state.values.isPlaying) {
        const deltaMs = now - lastTick.current;
        for (let i = 0; i < state.values.layers.length; i++) {
          newState = progressLayer(newState, deltaMs, i);
        }
        for (let i = 0; i < state.values.layers.length; i++) {
          newState = performTransfers(newState, i);
        }
      }
      if (!stopped.current && !state.values.isPlaying) {
        newState = performStopCallbacks(newState);
        stopped.current = true;
      }

      state.set(newState, "tick");
      lastTick.current = now;

      // console.timeEnd("tick");
    },
  });

  function updateInspectorWidth() {
    document.documentElement.style.setProperty(
      "--inspectorWidth",
      `${state.values.inspectorWidth}px`
    );
  }

  function updateLeftColumnWidth() {
    document.documentElement.style.setProperty(
      "--leftColumnWidth",
      `${state.values.leftColumnWidth}px`
    );
  }

  state.useSubscription(
    updateInspectorWidth,
    [],
    state.filters.deepEqual((s) => s.inspectorWidth)
  );
  state.useSubscription(
    updateLeftColumnWidth,
    [],
    state.filters.deepEqual((s) => s.leftColumnWidth)
  );

  useLayoutEffect(() => {
    updateInspectorWidth();
    updateLeftColumnWidth();

    function move(e: PointerEvent) {
      if (resizing.current === "leftColumn") {
        state.set(
          (s) => ({
            leftColumnWidth: Math.max(s.leftColumnWidth + e.movementX, 100),
          }),
          "resize left col"
        );
      } else if (resizing.current === "inspector") {
        state.set(
          (s) => ({
            inspectorWidth: Math.max(s.inspectorWidth - e.movementX, 100),
          }),
          "resize inspector"
        );
      }
    }

    function up(e: PointerEvent) {
      resizing.current = null;
      document.documentElement.style.cursor = "";
    }

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);

    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
  }, []);

  useEffect(() => {
    lastTick.current = performance.now();
    startTimer();

    return () => stopTimer();
  }, []);

  function toggleLeftColumn() {
    state.set(
      (s) => ({ isShowingLeftColumn: !s.isShowingLeftColumn }),
      "toggle showing left col"
    );
  }

  useEffect(() => {
    buildMenu({
      async open() {
        const serialized = await openComposition();
        if (!serialized) return;

        state.set((state) => {
          return deserializeComposition(state, serialized);
        }, "open composition from menu");
      },
      saveAs() {},
      addLayer() {
        state.addLayer(true, "add layer from menu");
      },
      async devtools() {
        await toggleDevtools();
      },
      toggleInspector() {
        state.set(
          (s) => ({ isShowingInspector: !s.isShowingInspector }),
          "toggle showing inspector"
        );
      },
      toggleLeftColumn,
      toggleMultilayer() {
        state.set(
          (s) => ({ isMultiLayerMode: !s.isMultiLayerMode }),
          "toggle multilayer"
        );
      },
    });
  }, []);

  state.useSubscription(
    (prevState) => {
      state.values.midiNotes.forEach((note, i) => {
        const index = prevState
          ? prevState.midiNotes.findIndex((n) => n.number === note.number)
          : -1;

        // check to see if we should play //
        if (note.isOn && (index === -1 || !prevState?.midiNotes[index].isOn)) {
          const transposeControl = state.layerControl("transpose");
          const playedAs = transposeNote(
            note.name,
            coerceControlValueToNumber(
              state.getControlValue(transposeControl),
              transposeControl
            )
          );

          const channel = state.getControlValue<"int">({
            layerControl: "midiChannel",
            layer: "current",
          });

          Midi.noteOn([playedAs], settings.values.midiOutputs, channel, {
            velocity: note.velocity,
          });

          notePlayedAsCache.current[note.name] = { note: playedAs, channel };

          if (state.values.isPlaying) {
            state.bufferMidi(
              (state) => ({ layerIndex: state.selectedHex.layerIndex, note }),
              "playing notes lol"
            );
          }
        }
        // check to see if we should stop //
        else if (
          !note.isOn &&
          index !== -1 &&
          prevState?.midiNotes[index].isOn
        ) {
          Midi.noteOff(
            [notePlayedAsCache.current[note.name].note],
            settings.values.midiOutputs,
            notePlayedAsCache.current[note.name].channel,
            {
              release: note.release,
            }
          );
        }
      });
    },
    [],
    state.filters.deepEqual((s) => s.midiNotes)
  );

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
      state.set({ allowedOutputs: outputs }, "allowed midi outputs changed");
    };
    Midi.onInputsChanged = (inputs) => {
      state.set({ allowedInputs: inputs }, "allowed midi inputs changed");
    };
    Midi.onNotesChanged = (notes) => {
      state.set({ midiNotes: notes }, "midi notes changed");
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

        if (layerIndex < state.values.layers.length) {
          state.set(
            (state) => ({ selectedHex: { ...state.selectedHex, layerIndex } }),
            "changing layer from keyboard shortcut"
          );
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
    settings.filters.deepEqual((s) => s.midiInputs)
  );

  settings.useSubscription(
    (_, settings) => {
      Midi.setEnabledOutputs(settings.midiOutputs);
    },
    [],
    settings.filters.deepEqual((s) => s.midiOutputs)
  );

  state.useSubscription(
    () => {
      if (
        state.values.selectedHex.hexIndex === -1 ||
        !settings.values.playNoteOnClick
      )
        return;

      const transposeControl = state.layerControl<"int">("transpose");

      Midi.playNotes(
        [
          transposeNote(
            hexNotes[state.values.selectedHex.hexIndex],
            state.getControlValue(transposeControl) + 12
          ),
        ],
        settings.values.midiOutputs,
        state.getControlValue<"int">({ layerControl: "midiChannel" }),
        {
          velocity: state.getControlValue<"decimal">({
            layerControl: "velocity",
          }),
          durationMs:
            state.getControlValue<"decimal">({ layerControl: "noteLength" }) *
            1000,
        }
      );
    },
    [],
    state.filters.deepEqual((s) => s.selectedHex.hexIndex)
  );

  async function confirmRemoveLayer(layerIndex?: number) {
    if (layerIndex === undefined) {
      layerIndex = state.values.selectedHex.layerIndex;
    }

    if (state.values.layers.length === 1) {
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
        `Are you sure you want to delete the layer '${state.values.layers[layerIndex].name}'?`,
        "Confirm delete"
      ))
    ) {
      state.removeLayer(layerIndex, "removing layer");
    }
  }

  function reloadScripts() {
    // dispatch({ type: "setLayers", payload: Tokens.refresh(state) });
  }

  function showSettings() {
    state.set({ isShowingSettings: true }, "show settings");
  }

  async function saveComposition() {
    //  TODO
    // serializeComposition(state)
  }

  function loadComposition() {
    // const paths = remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {
    //   title: "Open Composition...",
    //   properties: ["openFile"],
    //   filters: [{ name: "Acheron Composition", extensions: ["ache"] }],
    // });
    // if (paths && paths[0]) {
    //  TODO
    // fs.readFile(paths[0], "utf8", (err, data) => {
    //   if (err) {
    //     alert("There was an error reading the file :(");
    //     return;
    //   }
    //   dispatch({
    //     type: "setAppState",
    //     payload: deserializeComposition(state, JSON.parse(data)),
    //   });
    // });
    // }
  }

  function setMultiLayerSize(n: string) {
    const size = parseInt(n);
    if (isNaN(size)) return;

    state.set(
      {
        multiLayerSize: size,
      },
      "set multilayer size"
    );
  }

  function reportABug() {
    open(
      "https://github.com/whisperdoll/acheron/issues/new?assignees=&labels=bug&template=1-Bug_report.md"
    );
  }

  function openPatreon() {
    open("https://www.patreon.com/whisperdoll");
  }

  state.useSubscription(
    () => {
      document.documentElement.style.setProperty(
        "--multilayer-cols",
        state.values.multiLayerSize.toString()
      );
    },
    [],
    state.filters.deepEqual((s) => s.multiLayerSize)
  );

  const inspector = reactiveState.isShowingInspector ? (
    <>
      <div
        className="resizeHandle"
        onPointerDown={(e) => {
          e.preventDefault();
          document.documentElement.style.cursor = "ew-resize";
          resizing.current = "inspector";
        }}
      ></div>
      <Inspector layerIndex={reactiveState.selectedHex.layerIndex} />
    </>
  ) : (
    <>
      <GoogleIconButton
        className="showInspector"
        icon="frame_inspect"
        buttonStyle="rounded"
        fill
        onClick={() =>
          state.set(
            (s) => ({ isShowingInspector: !s.isShowingInspector }),
            "toggle showing inspector"
          )
        }
        opticalSize={20}
        title="Show Inspector"
      />
    </>
  );
  const leftColumn = reactiveState.isShowingLeftColumn ? (
    <>
      <div className="leftColumn">
        <div className="mainHeader">
          <GoogleIcon
            icon="globe"
            buttonStyle="rounded"
            fill
            opticalSize={20}
          />
          <span className="label">Player Properties</span>
          <GoogleIconButton
            className="pin"
            icon="keep_off"
            fill
            buttonStyle="rounded"
            onClick={toggleLeftColumn}
            opticalSize={20}
            title="Unpin Player Properties"
          />
        </div>
        <div className="tabs">
          <button
            onClick={() =>
              state.set(
                { leftColumnTab: "player" },
                "show player tab on left col"
              )
            }
            className={reactiveState.leftColumnTab === "player" ? "active" : ""}
          >
            Global
          </button>
          <button
            onClick={() =>
              state.set(
                { leftColumnTab: "layer" },
                "show layer tab on left col"
              )
            }
            className={reactiveState.leftColumnTab === "layer" ? "active" : ""}
          >
            Layer
          </button>
        </div>
        {reactiveState.leftColumnTab === "player" ? (
          <PlayerSettings />
        ) : (
          <LayerSettings
            layerIndex={reactiveState.selectedHex.layerIndex}
          ></LayerSettings>
        )}
      </div>
      <div
        className="resizeHandle"
        onPointerDown={(e) => {
          e.preventDefault();
          document.documentElement.style.cursor = "ew-resize";
          resizing.current = "leftColumn";
        }}
      ></div>
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
        title="Show Player Properties"
      />
    </>
  );

  return (
    <div className="app">
      {reactiveState.isShowingSettings && (
        <Settings
          onHide={() =>
            state.set({ isShowingSettings: false }, "hide settings")
          }
        />
      )}
      {reactiveState.editingLfo && <LfoEditor />}
      <div className="columns">
        {leftColumn}

        <div
          className={`middleColumn ${
            reactiveState.isMultiLayerMode ? "multilayer" : "single-layer"
          }`}
        >
          {reactiveState.isMultiLayerMode ? (
            <>
              <div className="multilayerSizeContainer">
                <span className="columnsLabel">
                  Columns: {reactiveState.multiLayerSize}
                </span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={reactiveState.multiLayerSize}
                  onChange={(e) => setMultiLayerSize(e.currentTarget.value)}
                />
                <GoogleIconButton
                  icon="add"
                  buttonStyle="rounded"
                  fill
                  onClick={(e) => state.addLayer(true, "add layer button")}
                  title="Add Layer"
                >
                  Add Layer
                </GoogleIconButton>
              </div>
              <div className="multilayer">
                {reactiveState.layers.map((layer, layerIndex) => (
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
              <HexGrid layerIndex={reactiveState.selectedHex.layerIndex} />
            </>
          )}
        </div>

        {inspector}
      </div>
      <StatusBar />
      <ModalController />
    </div>
  );
}
