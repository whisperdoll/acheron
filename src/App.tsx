import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './App.global.scss';
import { AppContext, AppSettings, loadSettings } from './AppContext';
import { array_copy, confirmPrompt, filesFromDirectoryR, makeUserDataPath } from './utils/utils';
import HexGrid from "./Components/HexGrid";
import Inspector from './Components/Inspector';
import PlayerSettings from './Components/PlayerSettings';
import LayerSettings from './Components/LayerSettings';
import { ipcRenderer, remote, webFrame } from 'electron';
import { performStartCallbacks, performStopCallbacks, progressLayer } from './utils/driver';
import { loadTokensFromSearchPaths as _loadTokensFromSearchPaths } from './Tokens';
import { getControlValue, TokenUID } from './Types';
import * as path from "path";
import Midi from './utils/midi';
import { hexIndexesFromNote, hexNotes, transposeNote } from './utils/elysiumutils';
import Settings from "./Components/Settings";
import LfoEditor from "./Components/LfoEditor";
import * as fs from "fs";
import TokenManager from './Components/TokenManager';
import NumberInput from './Components/NumberInput';
import open from "open";
import { deserializeComposition, serializeComposition } from './Serialization';
import usePrevious from './Hooks/usePrevious';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faPause, faCog, faBug, faLayerGroup, faDonate, faToolbox, faEyeSlash, faEye, faEdit, faTrash, faTrashAlt, faMinus, faPlus, faSave, faCheck } from "@fortawesome/free-solid-svg-icons";
import IconButton from './Components/IconButton';

export default function App() {
    const { state, dispatch } = useContext(AppContext)!;

    const [ isShowingPlayerSettings, setIsShowingPlayerSettings ] = useState(true);
    const [ isEditingLayerName, setIsEditingLayerName ] = useState(false);
    const [ isShowingSettings, setIsShowingSettings ] = useState(false);
    const [ isShowingInspector, setIsShowingInspector ] = useState(true);
    const [ isShowingLeftColumn, setIsShowingLeftColumn ] = useState(true);
    const [ isShowingTokenSettings, setIsShowingTokenSettings ] = useState(false);
    const tickCallback = useRef<(deltaNs: number) => any>(() => 0);
    const timerWorker = useRef<Worker | null>(null);
    const [ isMultiLayerMode, setIsMultiLayerMode ] = useState(false);
    const [ multiLayerSize, _setMultiLayerSize ] = useState(600);
    const multiLayerSizeMin = 100;
    const multiLayerSizeMax = 1000;
    const previousNotes = usePrevious(state.midiNotes, []);
    const notePlayedAsCache = useRef<Record<string, { note: string, channel: number }>>({});

    useEffect(() =>
    {
        timerWorker.current = new Worker(path.join(process.cwd(), "src/timerWorker.js"));
        timerWorker.current.postMessage("start");

        timerWorker.current.addEventListener("message", (e) => tickCallback.current(e.data));

        return () =>
        {
            timerWorker.current!.terminate();
            timerWorker.current = null;
        };
    }, []);

    useEffect(() =>
    {
        state.midiNotes.forEach((note, i) =>
        {
            const index = previousNotes.findIndex(n => n.number === note.number);

            // check to see if we should play //
            if (note.isOn && (index === -1 || !previousNotes[index].isOn))
            {
                const playedAs = transposeNote(
                    note.name,
                    getControlValue(
                        state,
                        state.selectedHex.layerIndex,
                        state.controls[state.layers[state.selectedHex.layerIndex].transpose]
                    )
                );

                const channel = getControlValue(
                    state,
                    state.selectedHex.layerIndex,
                    state.controls[state.layers[state.selectedHex.layerIndex].midiChannel]
                );

                Midi.noteOn(
                    [ playedAs ],
                    state.settings.midiOutputs,
                    channel,
                    {
                        velocity: note.velocity
                    }
                );

                notePlayedAsCache.current[note.name] = { note: playedAs, channel };

                if (state.isPlaying)
                {
                    dispatch({ type: "bufferMidi", payload: { layerIndex: state.selectedHex.layerIndex, note }});
                }
            }
            // check to see if we should stop //
            else if (!note.isOn && (index !== -1 && previousNotes[index].isOn))
            {
                Midi.noteOff(
                    [ notePlayedAsCache.current[note.name].note ],
                    state.settings.midiOutputs,
                    notePlayedAsCache.current[note.name].channel,
                    {
                        release: note.release
                    }
                );
            }
        });
    }, [ state.midiNotes ]);

    useEffect(() =>
    {
        tickCallback.current = (deltaNs: number) =>
        {
            if (state.isPlaying)
            {
                let newState = {...state};
                state.layers.forEach((layer, layerIndex) =>
                {
                    // console.log(deltaNs);
                    newState = progressLayer(newState, deltaNs, layerIndex);
                    // console.log(newState);
                });
                dispatch({ type: "setAppState", payload: newState });
            }
        };

        function toggleLeftColumn()
        {
            setIsShowingLeftColumn(!isShowingLeftColumn);
        }

        function toggleInspector()
        {
            setIsShowingInspector(!isShowingInspector);
        }

        function toggleMultilayer()
        {
            setIsMultiLayerMode(!isMultiLayerMode);
        }

        function addLayer()
        {
            dispatch({ type: "addLayer", payload: { select: !isMultiLayerMode } });
        }

        ipcRenderer.addListener("open", loadComposition);
        ipcRenderer.addListener("saveAs", saveComposition);
        ipcRenderer.addListener("toggleLeftColumn", toggleLeftColumn);
        ipcRenderer.addListener("toggleInspector", toggleInspector);
        ipcRenderer.addListener("toggleMultilayer", toggleMultilayer);
        ipcRenderer.addListener("addLayer", addLayer);

        return () =>
        {
            ipcRenderer.removeListener("open", loadComposition);
            ipcRenderer.removeListener("saveAs", saveComposition);
            ipcRenderer.removeListener("toggleLeftColumn", toggleLeftColumn);
            ipcRenderer.removeListener("toggleInspector", toggleInspector);
            ipcRenderer.removeListener("toggleMultilayer", toggleMultilayer);
            ipcRenderer.removeListener("addLayer", addLayer);
        };
    });

    useEffect(() =>
    {
        if (state.isPlaying)
        {
            dispatch({ type: "setAppState", payload: performStartCallbacks(state) });
        }
        else
        {
            dispatch({ type: "setAppState", payload: performStopCallbacks(state) });
        }
    }, [ state.isPlaying ]);

    function loadTokensFromSearchPaths(searchPaths: string[], autoEnable: boolean = false)
    {
        const defs = { ...state.tokenDefinitions };
        const addedUids: TokenUID[] = [];

        const { tokens, failed } = _loadTokensFromSearchPaths(searchPaths);

        Object.entries(tokens).forEach(([tokenUid, res]) =>
        {
            dispatch({ type: "setTokenDefinition", payload: {
                definition: res.tokenDef,
                callbacks: res.callbacks,
                enabled: autoEnable || undefined
            }});
            addedUids.push(tokenUid);
        });
        
        for (const uid in defs)
        {
            if (!addedUids.includes(uid))
            {
                dispatch({ type: "removeTokenDefinition", payload: uid });
            }
        }

        if (failed.length > 0)
        {
            alert("Could not load the following tokens:\n\n" + failed.join("\n"));
        }

        dispatch({ type: "saveSettings" });
    }

    useEffect(() =>
    {
        makeUserDataPath();
        const settings = loadSettings();
        dispatch({ type: "setSettings", payload: settings });

        loadTokensFromSearchPaths(settings.tokenSearchPaths, settings.isFirstRun);
        if (settings.isFirstRun)
        {
            dispatch({ type: "setFirstRunFalse" });
        }

        Midi.init();
    }, []);

    useEffect(() =>
    {
        Midi.onOutputsChanged = (outputs) =>
        {
            dispatch({ type: "setAllowedOutputs", payload: outputs });
        };
        Midi.onInputsChanged = (inputs) =>
        {
            dispatch({ type: "setAllowedInputs", payload: inputs });
        };
        Midi.onNotesChanged = (notes) =>
        {
            dispatch({ type: "setMidiNotes", payload: notes });
        };

        function keyDown(e: KeyboardEvent)
        {
            if (e.key === "Enter" &&
                (!document.activeElement ||
                    !["input","button","select","textarea"].includes(document.activeElement?.tagName.toLowerCase())))
            {
                dispatch({ type: "toggleIsPlaying" });
            }
            
            if ((e.key === "+" || e.key === "=") && e.ctrlKey)
            {
                webFrame.setZoomLevel(webFrame.getZoomLevel() + 0.5);
            }
            if (e.key === "-" && e.ctrlKey)
            {
                webFrame.setZoomLevel(webFrame.getZoomLevel() - 0.5);
            }

            if ("1234567890".includes(e.key) && e.ctrlKey)
            {
                let layerIndex = parseInt(e.key) - 1;

                if (layerIndex === -1)
                {
                    layerIndex = 9;
                }

                if (layerIndex < state.layers.length)
                {
                    dispatch({ type: "setSelectedHex", payload: { ...state.selectedHex, layerIndex }});
                }
            }
        }

        document.body.addEventListener("keydown", keyDown);

        return () =>
        {
            Midi.onOutputsChanged = null;
            Midi.onInputsChanged = null;
            Midi.onNotesChanged = null;
            document.body.removeEventListener("keydown", keyDown);
        };
    });

    useEffect(() =>
    {
        Midi.setEnabledInputs(state.settings.midiInputs);
    }, [state.settings.midiInputs]);

    useEffect(() =>
    {
        Midi.setEnabledOutputs(state.settings.midiOutputs);
    }, [state.settings.midiOutputs]);

    useEffect(() =>
    {
        if (state.selectedHex.hexIndex !== -1 && state.settings.playNoteOnClick)
        {
            Midi.playNotes(
                [transposeNote(
                    hexNotes[state.selectedHex.hexIndex],
                    getControlValue(state, state.selectedHex.layerIndex, state.controls[state.layers[state.selectedHex.layerIndex].transpose])
                )],
                state.settings.midiOutputs, getControlValue(state, state.selectedHex.layerIndex, state.controls[state.layers[state.selectedHex.layerIndex].midiChannel]), {
                velocity: getControlValue(state, state.selectedHex.layerIndex, state.controls[state.velocity])!,
                durationMs: getControlValue(state, state.selectedHex.layerIndex, state.controls[state.noteLength])! * 1000
            });
        }
    }, [ state.selectedHex.hexIndex ]);

    function confirmRemoveLayer(layerIndex?: number)
    {
        if (layerIndex === undefined)
        {
            layerIndex = state.selectedHex.layerIndex;
        }

        if (state.layers.length === 1)
        {
            remote.dialog.showMessageBox(remote.getCurrentWindow(), {
                message: "You must have at least one layer.",
                buttons: [ "Fine" ],
                noLink: true,
                type: "info",
                title: "Cannot delete only layer"
            });
        }
        else
        {
            if (state.settings.confirmDelete)
            {
                confirmPrompt(
                    `Are you sure you want to delete the layer '${state.layers[layerIndex].name}'?`,
                    "Confirm delete",
                    (confirmed) =>
                    {
                        if (confirmed)
                        {
                            dispatch({ type: "removeLayer", payload: layerIndex! });
                        }
                    }
                );
            }
            else
            {
                dispatch({ type: "removeLayer", payload: layerIndex });
            }
        }
    }

    function reloadScripts()
    {
        // dispatch({ type: "setLayers", payload: Tokens.refresh(state) });
    }

    function showSettings()
    {
        setIsShowingSettings(true);
    }

    function saveComposition()
    {
        const path = remote.dialog.showSaveDialogSync(remote.getCurrentWindow(), {
            title: "Save Composition...",
            properties: [ "showOverwriteConfirmation" ],
            filters: [{ name: "Acheron Composition", extensions: [ "ache" ] }]
        });

        if (path)
        {
            fs.writeFile(path, JSON.stringify(serializeComposition(state)), (err) =>
            {
                if (err)
                {
                    alert("There was an error writing the file :(");
                    return;
                }
            });
        }
    }

    function loadComposition()
    {
        const paths = remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {
            title: "Open Composition...",
            properties: [ "openFile" ],
            filters: [{ name: "Acheron Composition", extensions: [ "ache" ] }]
        });

        if (paths && paths[0])
        {
            fs.readFile(paths[0], "utf8", (err, data) =>
            {
                if (err)
                {
                    alert("There was an error reading the file :(");
                    return;
                }

                dispatch({ type: "setAppState", payload: deserializeComposition(state, JSON.parse(data)) });
            });
        }
    }

    function setMultiLayerSize(n: any)
    {
        const size = parseInt(n);
        if (isNaN(size)) return;

        _setMultiLayerSize(Math.max(Math.min(size, multiLayerSizeMax), multiLayerSizeMin));
    }

    function reportABug()
    {
        open("https://github.com/SongSing/acheron/issues/new?assignees=&labels=bug&template=1-Bug_report.md");
    }

    function openPatreon()
    {
        open("https://www.patreon.com/whisperdoll");
    }

    function handleTokenManagerHide()
    {
        setIsShowingTokenSettings(false);
        loadTokensFromSearchPaths(state.settings.tokenSearchPaths);
    }

    const elysiumControls = 
        <div className="elysiumControls">
            <IconButton
                icon={state.isPlaying ? faPause : faPlay}
                onClick={() => dispatch({ type: "toggleIsPlaying" })}
            >
                {state.isPlaying ? "Pause" : "Play"}
            </IconButton>
            {/* <button onClick={reloadScripts}>↻ Refresh Tokens</button> */}
            <IconButton onClick={showSettings} icon={faCog}>Settings</IconButton>
            <IconButton onClick={() => setIsShowingTokenSettings(true)} icon={faToolbox}>Manage Tokens</IconButton>
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
            {isMultiLayerMode && <>
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
            </>}
            <IconButton onClick={reportABug} icon={faBug}>Report a Bug</IconButton>
            <IconButton className="patreon" icon={faDonate} onClick={openPatreon}>Support on Patreon</IconButton>
        </div>;

    const inspector = isShowingInspector ? <Inspector layerIndex={state.selectedHex.layerIndex} /> : <></>;
    const leftColumn = isShowingLeftColumn ?
        <div className="leftColumn">
            <div className="tabs">
                <button onClick={() => setIsShowingPlayerSettings(true)} className={isShowingPlayerSettings ? "active" : ""}>Player</button>
                <button onClick={() => setIsShowingPlayerSettings(false)} className={!isShowingPlayerSettings ? "active" : ""}>Layer</button>
            </div>
            {isShowingPlayerSettings ?
                <PlayerSettings /> :
                <LayerSettings layerIndex={state.selectedHex.layerIndex}></LayerSettings>
            }
        </div> : <></>;

    return (
        <div className="app">
            {isShowingSettings && <Settings onHide={() => setIsShowingSettings(false)} />}
            {isShowingTokenSettings && <TokenManager onHide={handleTokenManagerHide} />}
            {state.editingLfo && <LfoEditor />}
            {isMultiLayerMode ? (
                <div className="multilayer-view">
                    <div className="cols">
                        {leftColumn}
                        <div className="multilayer">
                            {state.layers.map((layer, layerIndex) => (
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
                                    <HexGrid layerIndex={layerIndex} key={layerIndex} size={multiLayerSize} />
                                </div>
                            ))}
                        </div>
                        {inspector}
                    </div>
                    {elysiumControls}
                </div>
            ) : (<>
                <div className="columns">
                    {leftColumn}
                    <div className="middleColumn">
                        <div className="layerSelectRow">
                            <label>
                                <span className="layerLabel">Layer: </span>
                                {isEditingLayerName ? 
                                    <input
                                        value={state.layers[state.selectedHex.layerIndex].name}
                                        onChange={(e) => dispatch({ type: "setCurrentLayerName", payload: e.currentTarget.value })}
                                    /> :
                                    <select
                                        className="layerSelect"
                                        onChange={(e) => dispatch({ type: "setSelectedHex", payload: { ...state.selectedHex, layerIndex: parseInt(e.currentTarget.value) } })}
                                        value={state.selectedHex.layerIndex}
                                    >
                                        {state.layers.map((layer, i) =>
                                        (
                                            <option
                                                key={i}
                                                value={i}
                                            >
                                                {layer.name}{i === state.selectedHex.layerIndex || i > 9 ? "" : ` (Ctrl+${(i + 1) % 10})`}
                                            </option>
                                        ))}
                                    </select>
                                    }
                            </label>
                            {isEditingLayerName ?
                                <IconButton
                                    onClick={(e) => setIsEditingLayerName(false)}
                                    icon={faCheck}
                                >
                                    Save Name
                                </IconButton> :
                                <IconButton
                                    onClick={(e) => setIsEditingLayerName(true)}
                                    icon={faEdit}
                                >
                                    Edit Name
                                </IconButton>
                            }
                            <IconButton
                                onClick={() => confirmRemoveLayer()}
                                className="delete"
                                icon={faMinus}
                            >
                                Delete Layer
                            </IconButton>
                            <IconButton
                                onClick={(e) => dispatch({ type: "addLayer", payload: { select: true } })}
                                icon={faPlus}
                            >
                                Add New Layer
                            </IconButton>
                        </div>
                        <HexGrid
                            layerIndex={state.selectedHex.layerIndex}
                        />
                        {elysiumControls}
                    </div>

                    {inspector}
                </div>
                <div className="statusBar">
                    <div className={"pulse " + (state.isPlaying && Math.floor(state.layers[state.selectedHex.layerIndex].currentBeat) % 2 === 1 ? "active" : "")}></div>
                </div>
            </>)}
        </div>
    );
}
