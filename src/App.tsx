import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './App.global.scss';
import { AppContext, AppSettings, loadSettings } from './AppContext';
import { confirmPrompt, filesFromDirectoryR, makeUserDataPath } from './utils/utils';
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
import { hexNotes, transposeNote } from './utils/elysiumutils';
import Settings from "./Components/Settings";
import LfoEditor from "./Components/LfoEditor";
import * as fs from "fs";
import TokenManager from './Components/TokenManager';
import NumberInput from './Components/NumberInput';
import open from "open";
import { deserializeComposition, serializeComposition } from './Serialization';

export default function App() {
    const { state, dispatch } = useContext(AppContext)!;

    const [ isShowingPlayerSettings, setIsShowingPlayerSettings ] = useState(true);
    const [ isEditingLayerName, setIsEditingLayerName ] = useState(false);
    const [ isShowingSettings, setIsShowingSettings ] = useState(false);
    const [ isShowingInspector, setIsShowingInspector ] = useState(true);
    const [ isShowingTokenSettings, setIsShowingTokenSettings ] = useState(false);
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

            if (state.isPlaying)
            {
            }
        };

        function keyDown(e: KeyboardEvent)
        {
            if ((e.key === "+" || e.key === "=") && e.ctrlKey)
            {
                webFrame.setZoomLevel(webFrame.getZoomLevel() + 0.5);
            }
            if (e.key === "-" && e.ctrlKey)
            {
                webFrame.setZoomLevel(webFrame.getZoomLevel() - 0.5);
            }
        }

        ipcRenderer.addListener("open", loadComposition);
        ipcRenderer.addListener("saveAs", saveComposition);

        window.addEventListener("keydown", keyDown);

        return () =>
        {
            ipcRenderer.removeListener("open", loadComposition);
            ipcRenderer.removeListener("saveAs", saveComposition);
            window.removeEventListener("keydown", keyDown);
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

    function loadTokensFromSearchPaths(searchPaths: string[])
    {
        const defs = { ...state.tokenDefinitions };
        const addedUids: TokenUID[] = [];

        const { tokens, failed } = _loadTokensFromSearchPaths(searchPaths);

        Object.entries(tokens).forEach(([tokenUid, res]) =>
        {
            dispatch({ type: "setTokenDefinition", payload: {
                definition: res.tokenDef,
                callbacks: res.callbacks
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
    }

    useEffect(() =>
    {
        makeUserDataPath();
        const settings = loadSettings();
        dispatch({ type: "setSettings", payload: settings });

        loadTokensFromSearchPaths(settings.tokenSearchPaths);

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
            if (e.key === "Enter" &&
                (!document.activeElement ||
                    !["input","button","select","textarea"].includes(document.activeElement?.tagName.toLowerCase())))
            {
                console.log(document.activeElement);
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
        if (state.selectedHex.hexIndex !== -1 && state.settings.playNoteOnClick)
        {
            Midi.playNotes(
                [transposeNote(
                    hexNotes[state.selectedHex.hexIndex],
                    getControlValue(state, state.controls[state.layers[state.selectedHex.layerIndex].transpose])
                )],
                state.selectedOutputs, state.layers[state.selectedHex.layerIndex].midiChannel, {
                velocity: getControlValue(state, state.controls[state.velocity])!,
                durationMs: getControlValue(state, state.controls[state.noteLength])! * 1000
            });
        }
    }, [ state.selectedHex.hexIndex ]);

    function confirmRemoveLayer()
    {
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
                    `Are you sure you want to delete the layer '${state.layers[state.selectedHex.layerIndex].name}'?`,
                    "Confirm delete",
                    (confirmed) =>
                    {
                        if (confirmed)
                        {
                            dispatch({ type: "removeCurrentLayer" });
                        }
                    }
                );
            }
            else
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

    function reportABug()
    {
        open("https://github.com/SongSing/acheron/issues/new/choose");
    }

    function handleTokenManagerHide()
    {
        setIsShowingTokenSettings(false);
        loadTokensFromSearchPaths(state.settings.tokenSearchPaths);
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
            {/* <button onClick={loadComposition}>📂 Open Composition</button>
            <button onClick={saveComposition}>💾 Save Composition</button> */}
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
                <NumberInput
                    min={multiLayerSizeMin}
                    max={multiLayerSizeMax}
                    value={multiLayerSize}
                    onChange={(v) => setMultiLayerSize(v)}
                />
            </>}
            <button onClick={reportABug}>🐞 Report a Bug</button>
        </div>;

    const inspector = isShowingInspector ? <Inspector layerIndex={state.selectedHex.layerIndex} /> : <></>;

    return (
        <div className="app">
            {isShowingSettings && <Settings onHide={() => setIsShowingSettings(false)} />}
            {isShowingTokenSettings && <TokenManager onHide={handleTokenManagerHide} />}
            {state.editingLfo && <LfoEditor />}
            {isMultiLayerMode ? (
                <div className="multilayer-view">
                    <div className="cols">
                        <div className="multilayer">
                            {state.layers.map((layer, layerIndex) => (
                                <div className="layerContainer" key={layerIndex}>
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
                            <LayerSettings layerIndex={state.selectedHex.layerIndex}></LayerSettings>
                        }
                    </div>
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
                                onClick={(e) => dispatch({ type: "addLayer", payload: { select: true } })}
                            >
                                + Add New Layer
                            </button>
                        </div>
                        <HexGrid
                            layerIndex={state.selectedHex.layerIndex}
                        />
                        {elysiumControls}
                    </div>

                    {inspector}
                </div>
                <div className="statusBar">
                    <div className={"pulse " + (Math.floor(state.layers[state.selectedHex.layerIndex].currentBeat) % 2 === 1 ? "active" : "")}></div>
                </div>
            </>)}
        </div>
    );
}
