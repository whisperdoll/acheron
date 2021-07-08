import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HashRouter as Router, Switch, Route, Link, NavLink } from 'react-router-dom';
import icon from '../assets/icon.svg';
import './App.global.scss';
import { AppContext, loadSettings } from './AppContext';
import { loadSongs } from './utils/metadata';
import { confirmPrompt, filesFromDirectoryR, makeUserDataPath } from './utils/utils';
import HexGrid from "./Components/HexGrid";
import Inspector from './Components/Inspector';
import PlayerSettings from './Components/PlayerSettings';
import LayerSettings from './Components/LayerSettings';
import { remote } from 'electron';
import useInterval from './Hooks/useInterval';
import { performStartCallbacks, performStopCallbacks, progressLayer } from './utils/driver';
import { loadToken } from './Tokens';
import { getControlValue } from './Types';
import * as path from "path";
import Midi from './utils/midi';
import { deserializeComposition, hexNotes, serializeComposition, transposeNote } from './utils/elysiumutils';
import Settings from "./Components/Settings";
import LfoEditor from "./Components/LfoEditor";
import * as fs from "fs";
import TokenSettings from './Components/TokenSettings';
import useImmediate from './Hooks/useImmediate';

export default function App() {
    const { state, dispatch } = useContext(AppContext)!;

    const [ isShowingPlayerSettings, setIsShowingPlayerSettings ] = useState(true);
    const [ isEditingLayerName, setIsEditingLayerName ] = useState(false);
    const [ isShowingSettings, setIsShowingSettings ] = useState(false);
    const [ isShowingInspector, setIsShowingInspector ] = useState(true);
    const [ isShowingTokenSettings, setIsShowingTokenSettings ] = useState(false);
    const pulseRef = useRef<HTMLDivElement | null>(null);
    const layerProgress = useRef<number[]>([]);
    const tickCallback = useRef<(deltaNs: number) => any>(() => 0);
    const timerWorker = useRef<Worker | null>(null);
    const [ isMultiLayerMode, setIsMultiLayerMode ] = useState(false);
    const [ multiLayerSize, _setMultiLayerSize ] = useState(600);
    const multiLayerSizeMin = 100;
    const multiLayerSizeMax = 1000;

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
    
            // if (pulseRef.current)
            // {
            //     pulseRef.current.classList.toggle("active");
            // }
    
            if (state.isPlaying)
            {
            }
    
            // dispatch({ type: "pulse" });
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

    useEffect(() =>
    {
        makeUserDataPath();
        const settings = loadSettings();
        dispatch({ type: "setSettings", payload: settings });

        Object.entries(settings.tokens).forEach(([path, tokenSettings]) =>
        {
            const res = loadToken(path);
            if (res)
            {
                dispatch({ type: "setTokenDefinition", payload: {
                    path: path,
                    definition: res.tokenDef,
                    callbacks: res.callbacks
                }});
            }
        });

        Midi.init();
    }, []);

    useEffect(() =>
    {
        Midi.onOutputsChanged = (outputs) =>
        {
            dispatch({ type: "setAllowedOutputs", payload: outputs });
            dispatch({ type: "setSelectedOutputs", payload: outputs.map(o => o.id) });
        };

        function keyDown(e: KeyboardEvent)
        {
            if (e.key === "Enter")
            {
                dispatch({ type: "toggleIsPlaying" });
            }
        }

        document.body.addEventListener("keydown", keyDown);

        return () =>
        {
            Midi.onOutputsChanged = null;
            document.body.removeEventListener("keydown", keyDown);
        };
    });

    useEffect(() =>
    {
        if (state.selectedHex !== -1 && state.settings.playNoteOnClick)
        {
            Midi.playNotes(
                [transposeNote(
                    hexNotes[state.selectedHex],
                    getControlValue(state, state.controls[state.layers[state.currentLayerIndex].transpose])
                )],
                state.selectedOutputs, state.layers[state.currentLayerIndex].midiChannel, {
                velocity: getControlValue(state, state.controls[state.velocity])!,
                durationMs: getControlValue(state, state.controls[state.noteLength])! * 1000
            });
        }
    }, [ state.selectedHex ]);

    function confirmRemoveLayer()
    {
        if (state.layers.length === 1)
        {
            remote.dialog.showMessageBoxSync(remote.getCurrentWindow(), {
                message: "You must have at least one layer.",
                buttons: [ "Fine" ],
                noLink: true,
                type: "info",
                title: "Cannot delete only layer"
            });
        }
        else
        {
            if (!state.settings.confirmDelete ||
                confirmPrompt(`Are you sure you want to delete the layer '${state.layers[state.currentLayerIndex].name}'?`, "Confirm delete"))
            {
                dispatch({ type: "removeCurrentLayer" });
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

    const elysiumControls = 
        <div className="elysiumControls">
            <button
                onClick={() => dispatch({ type: "toggleIsPlaying" })}
            >
                {state.isPlaying ? "❚❚ Pause" : "▶ Play"}
            </button>
            {/* <button onClick={reloadScripts}>↻ Refresh Tokens</button> */}
            <button onClick={showSettings}>⚙ Settings</button>
            <button onClick={() => setIsShowingTokenSettings(true)}>Manage Tokens</button>
            <button onClick={loadComposition}>📂 Open Composition</button>
            <button onClick={saveComposition}>💾 Save Composition</button>
            <button onClick={() => setIsShowingInspector(!isShowingInspector)}>{isShowingInspector ? "Hide" : "Show"} Inspector</button>
            <button onClick={() => setIsMultiLayerMode(!isMultiLayerMode)}>Toggle MultiLayer Mode</button>
            {isMultiLayerMode && <>
                <span>Layer Size:</span>
                <input
                    type="range"
                    min={multiLayerSizeMin}
                    max={multiLayerSizeMax}
                    value={multiLayerSize}
                    onChange={(e) => setMultiLayerSize(e.currentTarget.value)}
                />
                <input
                    type="number"
                    min={multiLayerSizeMin}
                    max={multiLayerSizeMax}
                    value={multiLayerSize}
                    onChange={(e) => setMultiLayerSize(e.currentTarget.value)}
                />
            </>}
        </div>;

    const inspector = isShowingInspector ? <Inspector layerIndex={state.currentLayerIndex} /> : <></>;

    return (
        <div className="app">
            {isShowingSettings && <Settings onHide={() => setIsShowingSettings(false)} />}
            {isShowingTokenSettings && <TokenSettings onHide={() => setIsShowingTokenSettings(false)} />}
            {state.editingLfo && <LfoEditor />}
            {isMultiLayerMode ? (
                <div className="multilayer-view">
                    <div className="cols">
                        <div className="multilayer">
                            {state.layers.map((layer, layerIndex) => (
                                <div className="layerContainer">
                                    <div className="layerName">{layer.name}</div>
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
                    <div className="leftColumn">
                        <div className="tabs">
                            <button onClick={() => setIsShowingPlayerSettings(true)} className={isShowingPlayerSettings ? "active" : ""}>Player</button>
                            <button onClick={() => setIsShowingPlayerSettings(false)} className={!isShowingPlayerSettings ? "active" : ""}>Layer</button>
                        </div>
                        {isShowingPlayerSettings ?
                            <PlayerSettings /> :
                            <LayerSettings layerIndex={state.currentLayerIndex}></LayerSettings>
                        }
                    </div>
                    <div className="middleColumn">
                        <div className="layerSelectRow">
                            <label>
                                <span className="layerLabel">Layer: </span>
                                {isEditingLayerName ? 
                                    <input
                                        value={state.layers[state.currentLayerIndex].name}
                                        onChange={(e) => dispatch({ type: "setCurrentLayerName", payload: e.currentTarget.value })}
                                    /> :
                                    <select
                                        className="layerSelect"
                                        onChange={(e) => dispatch({ type: "setCurrentLayerIndex", payload: parseInt(e.currentTarget.value) })}
                                        value={state.currentLayerIndex}
                                    >
                                        {state.layers.map((layer, i) =>
                                        (
                                            <option
                                                key={i}
                                                value={i}
                                            >
                                                {layer.name}
                                            </option>
                                        ))}
                                    </select>
                                    }
                            </label>
                            {isEditingLayerName ?
                                <button
                                    onClick={(e) => setIsEditingLayerName(false)}
                                >
                                    ✓ Save Name
                                </button> :
                                <button
                                    onClick={(e) => setIsEditingLayerName(true)}
                                >
                                    ✎ Edit Name
                                </button>
                            }
                            <button
                                onClick={confirmRemoveLayer}
                            >
                                ✖ Delete Layer
                            </button>
                            <button
                                onClick={(e) => dispatch({ type: "addLayer" })}
                            >
                                + Add New Layer
                            </button>
                        </div>
                        <HexGrid
                            layerIndex={state.currentLayerIndex}
                        />
                        {elysiumControls}
                    </div>

                    {inspector}
                </div>
                <div className="statusBar">
                    <div className="pulse" ref={pulseRef}></div>
                </div>
            </>)}
        </div>
    );
}
