import { useContext, useEffect, useRef } from "react";
import { ControlState, PerformanceNote } from "../Types";
import { Canvas } from "../utils/canvas";
import {
  generateGridNotes,
  getNoteParts,
  hexIndexesFromNote,
  indexFromNote,
  noteArray,
  noteColors,
} from "../utils/elysiumutils";
import Point from "../utils/point";
import {
  addTokenToHex,
  AppContext,
  AppState,
  clearHex,
  copyHex,
  getControlValue,
  moveHex,
  removeTokenFromHex,
} from "../state/AppState";
import settings from "../state/AppSettings";
import Dict from "../lib/dict";
import { confirmPrompt } from "../utils/desktop";
import useContextMenu from "../Hooks/useContextMenu";
import { Driver } from "../utils/driver";
import { filterMapObject, mapTouches } from "../lib/utils";
import Midi from "../utils/midi";
import HexGridContextMenu from "./HexGridContextMenu";
import Color from "colorjs.io";
import { modes, notesForKey } from "../utils/scales";
import useNow from "../Hooks/useNow";
import { objectWithoutKeys } from "../utils/utils";

interface Props {
  layerIndex: number;
  size?: number;
}

type DragType = "copy" | "move" | "none";

export default function HexGrid(props: Props) {
  const { state, setState } = useContext(AppContext)!;
  const now = useNow();
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const canvas = useRef<Canvas | null>(null);
  const backCanvasEl = useRef<HTMLCanvasElement | null>(null);
  const backCanvas = useRef<Canvas | null>(null);
  const hexCanvasEl = useRef<HTMLCanvasElement | null>(null);
  const hexCanvas = useRef<Canvas | null>(null);
  const hexPoints = useRef<Point[]>([]);
  const mouseLocation = useRef<Point | null>(null);

  const hexRadius = 38;
  const lineWidth = 2;
  const startPosition = new Point(hexRadius + lineWidth / 2, hexRadius + lineWidth / 2);
  const animationFrameHandle = useRef<number | null>(null);
  const animationCallback = useRef<() => any>(() => 0);

  const layerIsSelected = (s: AppState) => s.selectedHex.layerIndex === props.layerIndex;
  const hexIsSelected = (s: AppState) => s.selectedHex.hexIndex !== -1 && layerIsSelected(s);
  const tokenIds = state.layers[props.layerIndex].tokenIds;

  const rootStyle = getComputedStyle(document.documentElement);
  const colors = Dict.fromArray(
    [
      "--hex-text-color",
      "--hex-text-color-selected",
      "--hex-token-text-color",
      "--hex-token-text-color-selected",
      "--hex-background-color",
      "--hex-background-color-selected",
      "--hex-playhead-background-color",
      "--hex-playhead-background-color-dying",
      "--hex-playhead-text-color",
      "--hex-outline-color",
      "--hex-key-background-color",
      "--hex-background-color-drop",
    ].map((variable) => {
      return [
        variable.substr(2).replace(/-([a-z])/g, (m) => m[1].toUpperCase()),
        rootStyle.getPropertyValue(variable),
      ];
    }),
  );

  function closestHexIndex(point: Point) {
    let hexIndex = -1;
    let closestDist = hexRadius;

    hexPoints.current.forEach((hexPoint, i) => {
      const dist = point.distanceTo(hexPoint);
      if (dist < closestDist) {
        closestDist = dist;
        hexIndex = i;
      }
    });

    return hexIndex;
  }

  function resizeCanvases() {
    const size = new Point(
      state.gridCols * ((3 / 2) * hexOuterRadius) + (1 / 2) * hexOuterRadius + lineWidth,
      (state.gridRows + 0.5) * (2 * hexOuterRadius * Math.sin((2 * Math.PI) / 6)) +
        lineWidth * state.gridRows +
        (1 / state.gridRows) * 5,
    ).rounded;

    [canvas.current, backCanvas.current, hexCanvas.current].forEach((c) => {
      if (!c) return;

      c.resize(size, false);
    });

    const pts = hexCanvas.current?.drawHexagonGrid({
      location: startPosition,
      size: new Point(state.gridCols, state.gridRows),
      hexRadius,
      startHigh: false,
      outlineColor: colors["hexOutlineColor"],
      outlineWidth: lineWidth,
      textColor: colors["hexTextColor"],
      tokenTextColor: colors["hexTokenTextColor"],
      backgroundColor: colors["hexBackgroundColor"],
      notes: generateGridNotes(state.gridStartingNote, state.gridRows, state.gridCols).map(
        getNoteParts,
      ),
    });

    if (pts) {
      hexPoints.current = pts;
    }
  }

  useEffect(resizeCanvases, [props.layerIndex, state.gridRows, state.gridCols]);

  // keyboard controls
  useEffect(() => {
    const keyDown = async (e: KeyboardEvent) => {
      if (!hexIsSelected(state)) {
        // console.log("hex not selected");
        return;
      }

      if (document.activeElement instanceof HTMLInputElement) {
        // dont add if we're typing in an input
        const type = document.activeElement.type;
        if (!["checkbox", "range"].includes(type)) {
          return;
        }
      }
      if (document.activeElement instanceof HTMLTextAreaElement) {
        return;
      }

      if (
        e.key === "Delete" &&
        state.layers[props.layerIndex].tokenIds[state.selectedHex.hexIndex].length > 0
      ) {
        if (
          !settings.values.confirmDelete ||
          (await confirmPrompt(
            "Are you sure you want to clear that hex?",
            "Confirm clear hex",
          ))
        ) {
          clearHex(
            setState,
            {
              layerIndex: props.layerIndex,
              hexIndex: state.selectedHex.hexIndex,
            },
            "clearing hex off of keypress",
          );
        }
      } else if ([...e.key].length === 1 && !e.ctrlKey && !e.shiftKey) {
        for (const uid in settings.values.tokens) {
          if (settings.values.tokens[uid].shortcut.toLowerCase() === e.key.toLowerCase()) {
            if (e.altKey) {
              const tokenIds =
                state.layers[props.layerIndex].tokenIds[state.selectedHex.hexIndex];
              const tokenToRemove = tokenIds
                .slice(0)
                .reverse()
                .find((iid) => state.tokens[iid].uid === uid);
              if (tokenToRemove) {
                removeTokenFromHex(
                  setState,
                  tokenToRemove,
                  (s) => s.selectedHex,
                  "remove token off keyboard shortcut",
                );
              }
            } else {
              addTokenToHex(
                setState,
                uid,
                (s) => s.selectedHex,
                "add token off keyboard shortcut",
              );
            }
          }
        }
      }
    };

    document.addEventListener("keydown", keyDown);

    return () => {
      document.removeEventListener("keydown", keyDown);
    };
  }, [props.layerIndex, state]);

  /*
    (hexRadius * 2 * cols)) / 1.3076923076923077 + lineWidth * 2 + 1
    (hexRadius * 2 * rows) / 1.0971428571428572 + lineWidth * 2 + 1
  */
  // setup
  const hexOuterRadius = hexRadius;
  useEffect(() => {
    canvas.current = new Canvas({
      canvasElement: canvasEl.current!,
      opaque: false,
      pixelated: false,
    });

    backCanvas.current = new Canvas({
      canvasElement: backCanvasEl.current!,
      deepCalc: false,
      opaque: false,
      pixelated: false,
    });

    hexCanvas.current = new Canvas({
      canvasElement: hexCanvasEl.current!,
      deepCalc: false,
      opaque: false,
      pixelated: false,
    });

    resizeCanvases();

    function anim() {
      animationCallback.current();

      if (animationFrameHandle.current !== null) {
        animationFrameHandle.current = requestAnimationFrame(anim);
      }
    }

    animationFrameHandle.current = requestAnimationFrame(anim);

    return () => {
      if (animationFrameHandle.current !== null)
        cancelAnimationFrame(animationFrameHandle.current);
      animationFrameHandle.current = null;
    };
  }, [props.layerIndex]);

  ////////////////////////////////////////////////////////////////////////////////
  ///////////////////////////////// FRONT CANVAS /////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    if (!state.layers[props.layerIndex]?.tokenIds) return;

    canvas.current?.clear();
    canvas.current?.drawHexagonGridDecorations({
      location: startPosition,
      size: new Point(state.gridCols, state.gridRows),
      hexRadius,
      startHigh: false,
      textColor: colors["hexTextColor"],
      tokenTextColor: colors["hexTokenTextColor"],
      labels: generateGridNotes(state.gridStartingNote, state.gridRows, state.gridCols).map(
        (hexNote, i) => {
          const symbols = state.layers[props.layerIndex].tokenIds[i].map(
            (tokenId) => state.tokens[tokenId].symbol,
          );
          // return `${i}\n${hexNote}`;
          return symbols.length > 0 ? hexNote + "\n" + symbols.join("") : hexNote;
        },
      ),
      directions: generateGridNotes(
        state.gridStartingNote,
        state.gridRows,
        state.gridCols,
      ).map((hexNote, i) => {
        // console.log({
        //   hexNote,
        //   i,
        //   tokenIds: state.layers[props.layerIndex].tokenIds,
        // });
        const tokens = state.layers[props.layerIndex].tokenIds[i].map(
          (tokenId) => state.tokens[tokenId],
        );

        const ret: number[] = [];

        tokens.forEach((token) => {
          const controls = token.controlIds.map((cid) => state.controls[cid]);
          controls
            .filter((c) => c.definition.type === "direction")
            .forEach((c) => ret.push(getControlValue(state, c as ControlState<"direction">)));
        });

        return ret;
      }),
    });
  }, [
    props.layerIndex,
    state.selectedHex.layerIndex,
    Math.floor(state.layers[props.layerIndex]?.currentBeat),
    state.controls,
    state.layers[props.layerIndex]?.tokenIds,
    state.gridCols,
    state.gridRows,
    state.gridStartingNote,
    // now,
  ]);

  const [contextMenuNode, showContextMenu] = useContextMenu(
    ({ hide, setPosition, isShowing }) => {
      return [
        {
          contents: <HexGridContextMenu onHide={hide} />,
        },
      ];
    },
    {
      offset: (bounds) => ({ x: 16, y: -bounds.height / 2 }),
    },
    [props.layerIndex, tokenIds],
  );

  ////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////// EVENTS ////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    const mouseUp = (pos: Point, _originalPos: Point, _e: MouseEvent | TouchEvent) => {
      if (
        state.isDragging &&
        state.draggingDestHex.layerIndex !== -1 &&
        state.draggingDestHex.hexIndex !== -1 &&
        !(
          state.draggingSourceHex.hexIndex === state.draggingDestHex.hexIndex &&
          state.draggingSourceHex.layerIndex === state.draggingDestHex.layerIndex
        )
      ) {
        const destIndex = closestHexIndex(pos);
        // console.log("mouseUp", { destIndex });
        if (destIndex !== -1) {
          (state.draggingType === "copy" ? copyHex : moveHex).bind(null, setState)(
            {
              srcLayerIndex: state.draggingSourceHex.layerIndex,
              destLayerIndex: state.draggingDestHex.layerIndex,
              srcHexIndex: state.draggingSourceHex.hexIndex,
              destHexIndex: state.draggingDestHex.hexIndex,
            },
            `hex ${state.draggingType}`,
          );
          setState((s) => ({
            ...s,
            selectedHex: {
              layerIndex: props.layerIndex,
              hexIndex: destIndex,
            },
          }));
        }
        // dispatch({ type: "setIsDragging", payload: false });
      }
    };

    function documentMouseUp(e: MouseEvent | TouchEvent | PointerEvent) {
      if (!canvasEl.current) return;

      const isTouch = e instanceof TouchEvent;

      if (settings.values.touchMode === "perform") {
        const toRemove: Set<PerformanceNote["identifier"]> = new Set();

        const identifiers = new Set(
          isTouch ? mapTouches(e.changedTouches, (t) => t.identifier) : [-1],
        );

        // find matching notes
        state.performingNotes.forEach((note) => {
          if (!identifiers.has(note.identifier)) return;

          // stop the matching note
          if (note.note) {
            Midi.noteOff({
              note: note.note,
              channel: note.channel,
              deviceName: note.device,
            });
          }
          toRemove.add(note.identifier);
        });

        setState((s) => ({
          ...s,
          performingNotes: s.performingNotes.filter((s) => !toRemove.has(s.identifier)),
        }));

        return;
      }

      if (settings.values.touchMode === "edit") {
        setState((s) => ({
          ...s,
          isDragging: false,
          draggingDestHex: { hexIndex: -1, layerIndex: -1 },
          draggingSourceHex: { hexIndex: -1, layerIndex: -1 },
        }));
        document.body.style.cursor = "default";
        return;
      }

      if (settings.values.touchMode === "generate") {
        // TODO
        return;
      }
    }

    function mouseDown(pos: Point, e: MouseEvent | TouchEvent | PointerEvent) {
      mouseLocation.current = pos;
      const hexIndex = closestHexIndex(pos);
      if (!canvasEl.current) return;
      const isTouch = e instanceof TouchEvent;

      if (settings.values.touchMode === "perform") {
        e.preventDefault();
        const notes: PerformanceNote[] = [];

        const touches = isTouch
          ? mapTouches(e.changedTouches, (t) => ({
              hexIndex: closestHexIndex(canvas.current!.posFromEvent(t)),
              identifier: t.identifier,
            }))
          : [{ hexIndex, identifier: -1 }];

        const tempo = getControlValue<"decimal">(state, {
          layerControl: "tempo",
          layer: props.layerIndex,
        });
        const durationMs = (1 / (tempo / 60)) * 1000;
        touches.forEach(({ hexIndex, identifier }) => {
          const [newNotes, unpermitted] = Driver.playTriad({
            state,
            hexIndex,
            triad: 0,
            durationMs,
          });
          notes.push(
            ...newNotes.map<PerformanceNote>((n) => ({
              ...n,
              identifier,
            })),
            ...unpermitted.map<PerformanceNote>((n) => ({
              ...n,
              note: null,
              identifier,
            })),
          );
        });

        setState((s) => ({
          ...s,
          performingNotes: s.performingNotes.concat(notes),
        }));

        return;
      }

      if (settings.values.touchMode === "edit") {
        setState((s) => ({
          ...s,
          selectedHex: {
            hexIndex: hexIndex,
            layerIndex: props.layerIndex,
          },
        }));

        if (!state.layers[props.layerIndex].tokenIds[hexIndex]?.length) return;

        setState((s) => ({
          ...s,
          draggingSourceHex: { hexIndex, layerIndex: props.layerIndex },
          draggingType: e.shiftKey ? "copy" : "move",
        }));
        return;
      }

      if (settings.values.touchMode === "generate") {
        // TODO
      }
    }

    function mouseMove(e: MouseEvent | TouchEvent | PointerEvent) {
      const pos = canvas.current!.posFromEvent(e);
      mouseLocation.current = pos;
      const isTouch = e instanceof TouchEvent;

      if (!canvasEl.current) return;

      if (settings.values.touchMode === "perform") {
        e.preventDefault();
        const newNotes = state.performingNotes.slice(0);
        let changed = false;

        const touches = isTouch
          ? mapTouches(e.changedTouches, (t) => ({
              identifier: t.identifier,
              hexIndex: closestHexIndex(canvas.current!.posFromEvent(t)),
            }))
          : [
              {
                identifier: -1,
                hexIndex: closestHexIndex(canvas.current!.posFromEvent(e)),
              },
            ];

        touches.forEach(({ identifier, hexIndex }) => {
          // determine if we changed notes
          state.performingNotes.forEach((note, noteIndex) => {
            if (note.identifier !== identifier) return;
            if (note.hexIndex === hexIndex && note.layer === props.layerIndex) return;

            // change
            changed = true;

            if (note.note) {
              Midi.noteOff({
                channel: note.channel,
                deviceName: note.device,
                note: note.note,
              });
            }

            const [playedNotes] = Driver.playTriad({
              state,
              hexIndex,
              triad: 0,
              layerIndex: props.layerIndex,
              velocity: note.velocity ?? undefined,
              durationMs:
                (1 /
                  (getControlValue<"decimal">(state, {
                    layerControl: "tempo",
                    layer: props.layerIndex,
                  }) /
                    60)) *
                1000,
            });

            newNotes[noteIndex] = {
              identifier: note.identifier,
              channel: note.channel,
              device: note.device,
              velocity: note.velocity,
              layer: props.layerIndex,
              note: playedNotes.at(0)?.note ?? null,
              hexIndex,
            };
          });
        });

        if (changed) {
          setState((s) => ({
            ...s,
            performingNotes: newNotes,
          }));
        }

        return;
      }

      if (settings.values.touchMode === "edit") {
        // TODO (maybe)
      }

      if (settings.values.touchMode === "generate") {
        // TODO
      }
    }

    animationCallback.current = () => {
      if (state.draggingSourceHex.hexIndex !== -1 && mouseLocation.current) {
        const hoveredHex = closestHexIndex(mouseLocation.current);
        const hoveredHexIsSourceHex =
          hoveredHex === state.draggingSourceHex.hexIndex &&
          props.layerIndex === state.draggingSourceHex.layerIndex;

        if (hoveredHex !== -1 && !hoveredHexIsSourceHex) {
          setState((s) => ({
            ...s,
            isDragging: true,
            draggingDestHex: {
              hexIndex: hoveredHex,
              layerIndex: props.layerIndex,
            },
          }));
          document.body.style.cursor = state.draggingType === "copy" ? "copy" : "move";
        } else {
          setState((s) => ({
            ...s,
            draggingDestHex: { hexIndex: -1, layerIndex: -1 },
          }));
        }
      }
    };

    function mouseLeave(_pos: Point, _e: MouseEvent | TouchEvent) {
      setState((s) => ({
        ...s,
        draggingDestHex: { hexIndex: -1, layerIndex: -1 },
      }));
      mouseLocation.current = null;
    }

    async function contextMenu(e: MouseEvent) {
      e.preventDefault();
      if (!hexIsSelected(state)) return;
      if (e instanceof TouchEvent) return;
      if (!canvasEl.current) return;
      if (!canvas.current) return;

      const hexIndex = closestHexIndex(canvas.current!.posFromEvent(e));
      const pos = canvas.current.localPointToGlobal(hexPoints.current[hexIndex]);

      showContextMenu(e, {
        position: pos.toJSON(),
      });
    }

    document.body.addEventListener("mousemove", mouseMove, { passive: false });
    document.body.addEventListener("touchmove", mouseMove, { passive: false });
    canvas.current?.addEventListener("mousedown", mouseDown);
    canvas.current?.addEventListener("mouseup", mouseUp);
    canvas.current?.addEventListener("mouseleave", mouseLeave);
    document.body.addEventListener("mouseup", documentMouseUp);
    document.body.addEventListener("touchend", documentMouseUp);
    canvas.current?.canvas.addEventListener("contextmenu", contextMenu);

    return () => {
      document.body.removeEventListener("mousemove", mouseMove);
      document.body.removeEventListener("touchmove", mouseMove);
      canvas.current?.removeEventListener("mousedown", mouseDown);
      canvas.current?.removeEventListener("mouseup", mouseUp);
      canvas.current?.removeEventListener("mouseleave", mouseLeave);
      document.body.removeEventListener("mouseup", documentMouseUp);
      canvas.current?.canvas.removeEventListener("contextmenu", contextMenu);
    };
  }, [
    props.layerIndex,
    state.layers[props.layerIndex].tokenIds,
    state.draggingDestHex,
    state.draggingSourceHex,
    state.draggingType,
    state.isDragging,
    state.performingNotes,
    state.selectedHex,
    Object.keys(state.tokens).length,
  ]);

  /////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////// BACK CANVAS //////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    if (!state.layers[props.layerIndex]?.tokenIds) return;

    const hexNotes = generateGridNotes(state.gridStartingNote, state.gridRows, state.gridCols);

    backCanvas.current?.clear();
    // draw selected //
    // if (prevSelectedHex !== -1 && prevSelectedHex !== undefined && backCanvas.current)
    // {
    //     backCanvas.current.fillHexagonCell(startPosition, new Point(~~(prevSelectedHex / rows), prevSelectedHex % rows), hexRadius, false, "#221922");
    // }

    // draw key //
    // console.log(state);
    const key = getControlValue<"select">(state, {
      layerControl: "keyTonic",
      layer: props.layerIndex,
    });
    if (key !== "None") {
      const mode = getControlValue<"select">(state, {
        layerControl: "keyMode",
        layer: props.layerIndex,
      }) as keyof typeof modes;
      const notes = notesForKey(noteArray.indexOf(key), mode).map(
        (noteIndex) => noteArray[noteIndex],
      );
      for (let i = 0; i < state.gridRows * state.gridCols; i++) {
        const hexNote = getNoteParts(hexNotes[i]).name;
        if (notes.includes(hexNote)) {
          backCanvas.current?.fillHexagonCell({
            gridLocation: startPosition,
            cellCoordinate: new Point(~~(i / state.gridRows), i % state.gridRows),
            color: colors["hexKeyBackgroundColor"],
            gridStartsHigh: false,
            hexRadius,
          });
        }
      }
    }

    // draw selected //
    if (hexIsSelected(state)) {
      const note = getNoteParts(hexNotes[state.selectedHex.hexIndex]);
      const color = new Color(noteColors[note.name]);
      color.alpha = 0.4;
      const lightColor = color.clone();
      // lightColor.hsv[1] *= 0.5;
      lightColor.alpha = 0.1;

      hexNotes.forEach((hexNote, i) => {
        const hexNoteParts = getNoteParts(hexNote);
        if (hexNoteParts.name === note.name) {
          backCanvas.current?.fillHexagonCell({
            gridLocation: startPosition,
            cellCoordinate: new Point(~~(i / state.gridRows), i % state.gridRows),
            color: (i === state.selectedHex.hexIndex ? color : lightColor).toString(),
            gridStartsHigh: false,
            hexRadius,
          });
        }
      });
    }

    // draw midi notes //
    if (props.layerIndex === state.selectedHex.layerIndex) {
      const toPlay: { hexIndex: number; velocity: number }[] = [];
      state.midiNotes.forEach((note) => {
        if (!note.isOn) return;

        hexIndexesFromNote(note.name, hexNotes).forEach((hexIndex) => {
          toPlay.push({ hexIndex, velocity: note.velocity });
        });
      });

      toPlay.forEach((data) => {
        backCanvas.current?.fillHexagonCell({
          gridLocation: startPosition,
          cellCoordinate: new Point(
            ~~(data.hexIndex / state.gridRows),
            data.hexIndex % state.gridRows,
          ),
          color: `rgba(40,${90 + (data.velocity / 127) * 20},${
            30 + (data.velocity / 127) * 60
          },${(data.velocity / 127) * 0.8 + 0.2})`,
          gridStartsHigh: false,
          hexRadius,
        });
      });
    }

    // draw performing notes //
    state.performingNotes.forEach((note) => {
      if (!note.note || !note.velocity) return;

      const color = new Color(noteColors[getNoteParts(note.note).name]);
      color.alpha = 0.4;

      backCanvas.current?.fillHexagonCell({
        gridLocation: startPosition,
        cellCoordinate: new Point(
          ~~(note.hexIndex / state.gridRows),
          note.hexIndex % state.gridRows,
        ),
        color: color.toString(),
        gridStartsHigh: false,
        hexRadius,
      });
    });

    // draw dragging //
    if (
      state.isDragging &&
      state.draggingDestHex.hexIndex !== -1 &&
      state.draggingDestHex.layerIndex === props.layerIndex
    ) {
      backCanvas.current?.fillHexagonCell({
        gridLocation: startPosition,
        cellCoordinate: new Point(
          ~~(state.draggingDestHex.hexIndex / state.gridRows),
          state.draggingDestHex.hexIndex % state.gridRows,
        ),
        color: colors["hexBackgroundColorDrop"],
        gridStartsHigh: false,
        hexRadius,
      });
    }

    // draw playheads //
    state.layers[props.layerIndex].playheads.forEach((hex, hexIndex) => {
      if (!hex.length) return;

      const dying = hex.some((p) => p.age >= p.lifespan);

      backCanvas.current?.fillHexagonCell({
        gridLocation: startPosition,
        cellCoordinate: new Point(~~(hexIndex / state.gridRows), hexIndex % state.gridRows),
        color:
          colors[dying ? "hexPlayheadBackgroundColorDying" : "hexPlayheadBackgroundColor"],
        gridStartsHigh: false,
        hexRadius,
      });
    });
  }, [
    props.layerIndex,
    hexIsSelected(state),
    state.selectedHex,
    state.layers,
    state.draggingDestHex,
    state.isDragging,
    state.midiNotes,
    state.performingNotes,
    state.gridCols,
    state.gridRows,
    state.gridStartingNote,
    state.keyMode,
    state.keyTonic,
  ]);

  const style = props.size ? { width: props.size + "px", height: "auto" } : undefined;

  return (
    <div className="hexGrid">
      <canvas ref={backCanvasEl} style={style}></canvas>
      <canvas ref={hexCanvasEl} style={style}></canvas>
      <canvas tabIndex={0} ref={canvasEl} draggable={false} style={style}></canvas>
      {contextMenuNode}
    </div>
  );
}
