import { useContext, useEffect, useRef, useState } from "react";
import "./App.global.scss";
import { confirmPrompt, makeUserDataPath } from "./utils/utils";
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
import TokenManager from "./Components/TokenManager";
import NumberInput from "./Components/NumberInput";
import usePrevious from "./Hooks/usePrevious";
import {
  faPlay,
  faPause,
  faCog,
  faBug,
  faLayerGroup,
  faDonate,
  faToolbox,
  faEdit,
  faMinus,
  faPlus,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import IconButton from "./Components/IconButton";
import { tokenDefinitions } from "./Tokens";
import { buildMenu } from "./Menu";
import { invoke } from "@tauri-apps/api/core";
import * as fs from "@tauri-apps/plugin-fs";
import * as dialog from "@tauri-apps/plugin-dialog";
import { deserializeComposition } from "./Serialization";
import state from "./state/AppState";
import settings from "./state/AppSettings";
import List from "./lib/list";
import useTimer from "./Hooks/useTimer";
import StatusBar from "./Components/StatusBar";
import LayerSelect from "./Components/LayerSelect";

export default function App() {
  const reactiveState = state.useState();
  const notePlayedAsCache = useRef<
    Record<string, { note: string; channel: number }>
  >({});
  const lastTick = useRef(0);

  const [startTimer, stopTimer] = useTimer({
    onTick: (deltaMs: number) => {
      // console.time("tick");
      const now = performance.now();
      if (state.values.isPlaying) {
        const deltaMs = now - lastTick.current;
        let newState = { ...state.values };
        for (let i = 0; i < state.values.layers.length; i++) {
          newState = progressLayer(newState, deltaMs, i);
        }
        for (let i = 0; i < state.values.layers.length; i++) {
          newState = performTransfers(newState, i);
        }
        state.set(newState, "tick");
      }
      lastTick.current = now;
      // console.timeEnd("tick");
    },
  });

  useEffect(() => {
    lastTick.current = performance.now();
    startTimer();

    return () => stopTimer();
  }, []);

  useEffect(() => {
    buildMenu({
      async open() {
        const filepath = await dialog.open({
          title: "Open Composition...",
          filters: [{ name: "Acheron Composition", extensions: ["ache"] }],
          canCreateDirectories: true,
          directory: false,
          multiple: false,
        });

        if (!filepath) return;

        const serialized = JSON.parse(await fs.readTextFile(filepath));
        state.set((state) => {
          return deserializeComposition(state, serialized);
        }, "open composition from menu");
      },
      saveAs() {},
      addLayer() {
        state.addLayer(true, "add layer from menu");
      },
      devtools() {
        invoke("plugin:webview|internal_toggle_devtools");
      },
      toggleInspector() {
        state.set(
          (s) => ({ isShowingInspector: !s.isShowingInspector }),
          "toggle showing inspector"
        );
      },
      toggleLeftColumn() {
        state.set(
          (s) => ({ isShowingLeftColumn: !s.isShowingLeftColumn }),
          "toggle showing left col"
        );
      },
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
        const index = prevState.midiNotes.findIndex(
          (n) => n.number === note.number
        );

        // check to see if we should play //
        if (note.isOn && (index === -1 || !prevState.midiNotes[index].isOn)) {
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
          prevState.midiNotes[index].isOn
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
    (s) => s.midiNotes
  );

  state.useSubscription(
    (prevState, newState) => {
      if (newState.isPlaying) {
        state.set((state) => performStartCallbacks(state), "start callbacks");
      } else {
        state.set((state) => performStopCallbacks(state), "{start callbacks}");
        Midi.allNotesOff();
      }
    },
    [],
    (s) => s.isPlaying
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
      if (
        e.key === "Enter" &&
        (!document.activeElement ||
          !["input", "button", "select", "textarea"].includes(
            document.activeElement?.tagName.toLowerCase()
          ))
      ) {
        state.togglePlaying("toggle play cuz enter pressed");
      }

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
    (s) => s.midiInputs
  );

  settings.useSubscription(
    (_, settings) => {
      Midi.setEnabledOutputs(settings.midiOutputs);
    },
    [],
    (s) => s.midiOutputs
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
    (s) => s.selectedHex.hexIndex
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
    (s) => s.multiLayerSize
  );

  const inspector = reactiveState.isShowingInspector ? (
    <Inspector layerIndex={reactiveState.selectedHex.layerIndex} />
  ) : (
    <></>
  );
  const leftColumn = reactiveState.isShowingLeftColumn ? (
    <div className="leftColumn">
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
            state.set({ leftColumnTab: "layer" }, "show layer tab on left col")
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
  ) : (
    <></>
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
                <span>Columns: {reactiveState.multiLayerSize}</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={reactiveState.multiLayerSize}
                  onChange={(e) => setMultiLayerSize(e.currentTarget.value)}
                />
                <IconButton
                  onClick={(e) => state.addLayer(true, "add layer button")}
                  icon={faPlus}
                >
                  Add New Layer
                </IconButton>
              </div>
              <div className="multilayer">
                {reactiveState.layers.map((layer, layerIndex) => (
                  <div className="layerContainer" key={layerIndex}>
                    <div className="layerName">
                      <span>{layer.name}</span>
                      <button
                        className="nostyle remove"
                        onClick={() => confirmRemoveLayer(layerIndex)}
                      >
                        ❌
                      </button>
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
    </div>
  );
}
