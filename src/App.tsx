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
import {
  coerceControlValueToNumber,
  ControlState,
  getControlValue,
} from "./Types";
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
import timerWorkerPath from "../assets/timerWorker.worker?url";
import { Tokens } from "./Tokens";
import { buildMenu } from "./Menu";
import { invoke } from "@tauri-apps/api/core";
import * as fs from "@tauri-apps/plugin-fs";
import * as dialog from "@tauri-apps/plugin-dialog";
import { deserializeComposition } from "./Serialization";
import state from "./state/AppState";
import settings from "./state/AppSettings";
import List from "./lib/list";

export default function App() {
  const reactiveState = state.useState();
  const reactiveSettings = settings.useState();
  const [isShowingPlayerSettings, setIsShowingPlayerSettings] = useState(true);
  const [isEditingLayerName, setIsEditingLayerName] = useState(false);
  const [isShowingSettings, setIsShowingSettings] = useState(false);
  const [isShowingInspector, setIsShowingInspector] = useState(true);
  const [isShowingLeftColumn, setIsShowingLeftColumn] = useState(true);
  const [isShowingTokenSettings, setIsShowingTokenSettings] = useState(false);
  const tickCallback = useRef<(deltaMs: number) => any>(() => 0);
  const timerWorker = useRef<Worker | null>(null);
  const [isMultiLayerMode, setIsMultiLayerMode] = useState(false);
  const [multiLayerSize, _setMultiLayerSize] = useState(600);
  const multiLayerSizeMin = 100;
  const multiLayerSizeMax = 1000;
  const notePlayedAsCache = useRef<
    Record<string, { note: string; channel: number }>
  >({});

  useEffect(() => {
    timerWorker.current = new Worker(timerWorkerPath);
    timerWorker.current.postMessage("start");

    timerWorker.current.addEventListener("message", (e) =>
      tickCallback.current(e.data)
    );

    return () => {
      timerWorker.current!.terminate();
      timerWorker.current = null;
    };
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
        setIsShowingInspector((value) => !value);
      },
      toggleLeftColumn() {
        setIsShowingLeftColumn((value) => !value);
      },
      toggleMultilayer() {
        setIsMultiLayerMode((value) => !value);
      },
    });
  }, []);

  state.useSubscription(
    (prevState, newState) => {
      newState.midiNotes.forEach((note, i) => {
        const index = prevState.midiNotes.findIndex(
          (n) => n.number === note.number
        );

        // check to see if we should play //
        if (note.isOn && (index === -1 || !prevState.midiNotes[index].isOn)) {
          const transposeControl = newState.controls[
            newState.layers[newState.selectedHex.layerIndex].transpose
          ] as ControlState<"int">;
          const playedAs = transposeNote(
            note.name,
            coerceControlValueToNumber(
              getControlValue(
                newState,
                newState.selectedHex.layerIndex,
                transposeControl
              ),
              transposeControl
            )
          );

          const channel = getControlValue(
            newState,
            newState.selectedHex.layerIndex,
            newState.controls[
              newState.layers[newState.selectedHex.layerIndex].midiChannel
            ] as ControlState<"int">
          );

          Midi.noteOn([playedAs], settings.values.midiOutputs, channel, {
            velocity: note.velocity,
          });

          notePlayedAsCache.current[note.name] = { note: playedAs, channel };

          if (newState.isPlaying) {
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

  useEffect(() => {
    tickCallback.current = (deltaMs: number) => {
      state.set((state) => {
        if (!state.isPlaying) return state;

        let newState = { ...state };
        state.layers.forEach((layer, layerIndex) => {
          newState = progressLayer(newState, deltaMs, layerIndex);
        });
        state.layers.forEach((layer, layerIndex) => {
          newState = performTransfers(newState, layerIndex);
        });

        return newState;
      }, "tick");
    };

    function toggleLeftColumn() {
      setIsShowingLeftColumn(!isShowingLeftColumn);
    }

    function toggleInspector() {
      setIsShowingInspector(!isShowingInspector);
    }

    function toggleMultilayer() {
      setIsMultiLayerMode(!isMultiLayerMode);
    }

    function addLayer() {
      state.addLayer(!isMultiLayerMode, "add layer");
    }

    // TODO
    // ipcRenderer.addListener("open", loadComposition);
    // ipcRenderer.addListener("saveAs", saveComposition);
    // ipcRenderer.addListener("toggleLeftColumn", toggleLeftColumn);
    // ipcRenderer.addListener("toggleInspector", toggleInspector);
    // ipcRenderer.addListener("toggleMultilayer", toggleMultilayer);
    // ipcRenderer.addListener("addLayer", addLayer);

    // return () => {
    //   ipcRenderer.removeListener("open", loadComposition);
    //   ipcRenderer.removeListener("saveAs", saveComposition);
    //   ipcRenderer.removeListener("toggleLeftColumn", toggleLeftColumn);
    //   ipcRenderer.removeListener("toggleInspector", toggleInspector);
    //   ipcRenderer.removeListener("toggleMultilayer", toggleMultilayer);
    //   ipcRenderer.removeListener("addLayer", addLayer);
    // };
  });

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
    (_, state) => {
      if (state.selectedHex.hexIndex === -1 || !settings.values.playNoteOnClick)
        return;

      const transposeControl = state.controls[
        state.layers[state.selectedHex.layerIndex].transpose
      ] as ControlState<"int">;

      Midi.playNotes(
        [
          transposeNote(
            hexNotes[state.selectedHex.hexIndex],
            getControlValue(
              state,
              state.selectedHex.layerIndex,
              transposeControl
            ) + 12
          ),
        ],
        settings.values.midiOutputs,
        getControlValue(
          state,
          state.selectedHex.layerIndex,
          state.controls[
            state.layers[state.selectedHex.layerIndex].midiChannel
          ] as ControlState<"int">
        ),
        {
          velocity: getControlValue(
            state,
            state.selectedHex.layerIndex,
            state.controls[state.velocity] as ControlState<"decimal">
          )!,
          durationMs:
            getControlValue(
              state,
              state.selectedHex.layerIndex,
              state.controls[state.noteLength] as ControlState<"decimal">
            )! * 1000,
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
    setIsShowingSettings(true);
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

  function setMultiLayerSize(n: any) {
    const size = parseInt(n);
    if (isNaN(size)) return;

    _setMultiLayerSize(
      Math.max(Math.min(size, multiLayerSizeMax), multiLayerSizeMin)
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

  function handleTokenManagerHide() {
    setIsShowingTokenSettings(false);
    // loadTokensFromSearchPaths(state.settings.tokenSearchPaths);
  }

  const elysiumControls = (
    <div className="elysiumControls">
      <IconButton
        icon={reactiveState.isPlaying ? faPause : faPlay}
        onClick={() => state.togglePlaying("toggle play button")}
      >
        {reactiveState.isPlaying ? "Pause" : "Play"}
      </IconButton>
      {/* <button onClick={reloadScripts}>↻ Refresh Tokens</button> */}
      <IconButton onClick={showSettings} icon={faCog}>
        Settings
      </IconButton>
      <IconButton
        onClick={() => setIsShowingTokenSettings(true)}
        icon={faToolbox}
      >
        Manage Tokens
      </IconButton>
      {/* <button onClick={loadComposition}>📂 Open Composition</button>
            <button onClick={saveComposition}>💾 Save Composition</button> */}
      {/* <IconButton
                onClick={() => setIsShowingInspector(!isShowingInspector)}
                icon={isShowingInspector ? faEyeSlash : faEye}
            >
                {isShowingInspector ? "Hide" : "Show"} Inspector
            </IconButton> */}
      <IconButton
        onClick={() => setIsMultiLayerMode(!isMultiLayerMode)}
        icon={faLayerGroup}
      >
        Toggle MultiLayer Mode
      </IconButton>
      {isMultiLayerMode && (
        <>
          <span>Layer Size:</span>
          <input
            type="range"
            min={multiLayerSizeMin}
            max={multiLayerSizeMax}
            value={multiLayerSize}
            onChange={(e) => setMultiLayerSize(e.currentTarget.value)}
          />
          <NumberInput
            min={multiLayerSizeMin}
            max={multiLayerSizeMax}
            value={multiLayerSize}
            onChange={(v) => setMultiLayerSize(v)}
          />
        </>
      )}
      <IconButton onClick={reportABug} icon={faBug}>
        Report a Bug
      </IconButton>
      <IconButton className="patreon" icon={faDonate} onClick={openPatreon}>
        Support on Patreon
      </IconButton>
    </div>
  );

  const inspector = isShowingInspector ? (
    <Inspector layerIndex={reactiveState.selectedHex.layerIndex} />
  ) : (
    <></>
  );
  const leftColumn = isShowingLeftColumn ? (
    <div className="leftColumn">
      <div className="tabs">
        <button
          onClick={() => setIsShowingPlayerSettings(true)}
          className={isShowingPlayerSettings ? "active" : ""}
        >
          Global
        </button>
        <button
          onClick={() => setIsShowingPlayerSettings(false)}
          className={!isShowingPlayerSettings ? "active" : ""}
        >
          Layer
        </button>
      </div>
      {isShowingPlayerSettings ? (
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
      {isShowingSettings && (
        <Settings onHide={() => setIsShowingSettings(false)} />
      )}
      {isShowingTokenSettings && (
        <TokenManager onHide={handleTokenManagerHide} />
      )}
      {reactiveState.editingLfo && <LfoEditor />}
      {isMultiLayerMode ? (
        <div className="multilayer-view">
          <div className="cols">
            {leftColumn}
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
                  <HexGrid
                    layerIndex={layerIndex}
                    key={layerIndex}
                    size={multiLayerSize}
                  />
                </div>
              ))}
            </div>
            {inspector}
          </div>
          {elysiumControls}
        </div>
      ) : (
        <>
          <div className="columns">
            {leftColumn}
            <div className="middleColumn">
              <div className="layerSelectRow">
                <label>
                  <span className="layerLabel">Layer: </span>
                  {isEditingLayerName ? (
                    <input
                      value={
                        reactiveState.layers[
                          reactiveState.selectedHex.layerIndex
                        ].name
                      }
                      onChange={(e) =>
                        state.setLayer(
                          "current",
                          (layer) => ({
                            ...layer,
                            name: e.currentTarget.value,
                          }),
                          "change layer name"
                        )
                      }
                    />
                  ) : (
                    <select
                      className="layerSelect"
                      onChange={(e) =>
                        state.set(
                          (state) => ({
                            selectedHex: {
                              ...state.selectedHex,
                              layerIndex: parseInt(e.currentTarget.value),
                            },
                          }),
                          "change layer from select"
                        )
                      }
                      value={reactiveState.selectedHex.layerIndex}
                    >
                      {reactiveState.layers.map((layer, i) => (
                        <option key={i} value={i}>
                          {layer.name}
                          {i === reactiveState.selectedHex.layerIndex || i > 9
                            ? ""
                            : ` (Ctrl+${(i + 1) % 10})`}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                {isEditingLayerName ? (
                  <IconButton
                    onClick={(e) => setIsEditingLayerName(false)}
                    icon={faCheck}
                  >
                    Save Name
                  </IconButton>
                ) : (
                  <IconButton
                    onClick={(e) => setIsEditingLayerName(true)}
                    icon={faEdit}
                  >
                    Edit Name
                  </IconButton>
                )}
                <IconButton
                  onClick={() => confirmRemoveLayer()}
                  className="delete"
                  icon={faMinus}
                >
                  Delete Layer
                </IconButton>
                <IconButton
                  onClick={(e) => state.addLayer(true, "add layer button")}
                  icon={faPlus}
                >
                  Add New Layer
                </IconButton>
              </div>
              <HexGrid layerIndex={reactiveState.selectedHex.layerIndex} />
              {elysiumControls}
            </div>

            {inspector}
          </div>
          <div className="statusBar">
            <div
              className={
                "pulse " +
                (reactiveState.isPlaying &&
                Math.floor(
                  reactiveState.layers[reactiveState.selectedHex.layerIndex]
                    .currentBeat
                ) %
                  2 ===
                  1
                  ? "active"
                  : "")
              }
            ></div>
          </div>
        </>
      )}
    </div>
  );
}
