import React, { useContext, useEffect, useRef } from "react";
import { ControlState, KeyMap } from "../Types";
import { Canvas } from "../utils/canvas";
import {
  getNoteParts,
  hexNotes,
  noteArray,
  NumHexes,
} from "../utils/elysiumutils";
import Point from "../utils/point";
import {
  Menu,
  MenuItemOptions,
  PredefinedMenuItem,
} from "@tauri-apps/api/menu";
import state, { AppState } from "../state/AppState";
import settings from "../state/AppSettings";
import Dict from "../lib/dict";
import { confirmPrompt } from "../utils/desktop";
import useContextMenu, {
  ContextMenuItem,
  SeparatorItem,
} from "../Hooks/useContextMenu";
import { Driver } from "../utils/driver";
import SimpleAppState from "../state/SimpleAppState";
import { msPerBeat } from "../lib/utils";
import { mapTouches, mod, msPerBeat, pointArray } from "../lib/utils";
import Midi from "../utils/midi";
import HexGridContextMenu from "./HexGridContextMenu";

interface Props {
  layerIndex: number;
  size?: number;
}

type DragType = "copy" | "move" | "none";

export default function HexGrid(props: Props) {
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const canvas = useRef<Canvas | null>(null);
  const backCanvasEl = useRef<HTMLCanvasElement | null>(null);
  const backCanvas = useRef<Canvas | null>(null);
  const hexCanvasEl = useRef<HTMLCanvasElement | null>(null);
  const hexCanvas = useRef<Canvas | null>(null);
  const hexPoints = useRef<Point[]>([]);
  const mouseLocation = useRef<Point | null>(null);

  const rows = 12;
  const cols = 17;
  const start = noteArray.indexOf("D#") + noteArray.length * 7;
  const hexRadius = 38;
  const lineWidth = 2;
  const startPosition = new Point(
    hexRadius + lineWidth / 2,
    hexRadius + lineWidth / 2
  );
  const animationFrameHandle = useRef<number | null>(null);
  const animationCallback = useRef<() => any>(() => 0);

  const layerIsSelected = (s: AppState) =>
    s.selectedHex.layerIndex === props.layerIndex;
  const hexIsSelected = (s: AppState) =>
    s.selectedHex.hexIndex !== -1 && layerIsSelected(s);

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
    })
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

  useEffect(() => {
    const keyDown = async (e: KeyboardEvent) => {
      if (!hexIsSelected(state.values)) {
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
        state.values.layers[props.layerIndex].tokenIds[
          state.values.selectedHex.hexIndex
        ].length > 0
      ) {
        if (
          !settings.values.confirmDelete ||
          (await confirmPrompt(
            "Are you sure you want to clear that hex?",
            "Confirm clear hex"
          ))
        ) {
          state.clearHex(
            {
              layerIndex: props.layerIndex,
              hexIndex: state.values.selectedHex.hexIndex,
            },
            "clearing hex off of keypress"
          );
        }
      } else if ([...e.key].length === 1 && !e.ctrlKey && !e.shiftKey) {
        for (const uid in settings.values.tokens) {
          if (
            settings.values.tokens[uid].shortcut.toLowerCase() ===
            e.key.toLowerCase()
          ) {
            if (e.altKey) {
              const tokenIds =
                state.values.layers[props.layerIndex].tokenIds[
                  state.values.selectedHex.hexIndex
                ];
              const tokenToRemove = tokenIds
                .slice(0)
                .reverse()
                .find((iid) => state.values.tokens[iid].uid === uid);
              if (tokenToRemove) {
                state.removeTokenFromHex(
                  tokenToRemove,
                  (s) => s.selectedHex,
                  "remove token off keyboard shortcut"
                );
              }
            } else {
              state.addTokenToHex(
                uid,
                (s) => s.selectedHex,
                "add token off keyboard shortcut"
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
  }, [props.layerIndex]);

  useEffect(() => {
    canvas.current = new Canvas({
      canvasElement: canvasEl.current!,
      opaque: false,
      pixelated: false,
      size: new Point(
        (hexRadius * 2 * cols) / 1.3076923076923077 + lineWidth * 2 + 1,
        (hexRadius * 2 * rows) / 1.0971428571428572 + lineWidth * 2 + 1
      ).rounded,
    });

    backCanvas.current = new Canvas({
      canvasElement: backCanvasEl.current!,
      deepCalc: false,
      opaque: false,
      pixelated: false,
      size: canvas.current.size,
    });

    hexCanvas.current = new Canvas({
      canvasElement: hexCanvasEl.current!,
      deepCalc: false,
      opaque: false,
      pixelated: false,
      size: canvas.current.size,
    });

    const pts = hexCanvas.current.drawHexagonGrid({
      location: startPosition,
      size: new Point(cols, rows),
      hexRadius,
      startHigh: false,
      outlineColor: colors["hexOutlineColor"],
      outlineWidth: lineWidth,
      textColor: colors["hexTextColor"],
      tokenTextColor: colors["hexTokenTextColor"],
      backgroundColor: colors["hexBackgroundColor"],
    });

    if (pts) {
      hexPoints.current = pts;
    }

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
  state.useSubscription(
    () => {
      if (!state.values.layers[props.layerIndex]?.tokenIds) return;

      canvas.current?.clear();
      canvas.current?.drawHexagonGridDecorations({
        location: startPosition,
        size: new Point(cols, rows),
        hexRadius,
        startHigh: false,
        textColor: colors["hexTextColor"],
        tokenTextColor: colors["hexTokenTextColor"],
        labels: hexNotes.map((hexNote, i) => {
          const symbols = state.values.layers[props.layerIndex].tokenIds[i].map(
            (tokenId) => state.values.tokens[tokenId].symbol
          );
          return symbols.length > 0
            ? hexNote + "\n" + symbols.join("")
            : hexNote;
        }),
        directions: hexNotes.map((hexNote, i) => {
          const tokens = state.values.layers[props.layerIndex].tokenIds[i].map(
            (tokenId) => state.values.tokens[tokenId]
          );

          const ret: number[] = [];

          tokens.forEach((token) => {
            const controls = token.controlIds.map(
              (cid) => state.values.controls[cid]
            );
            controls
              .filter((c) => c.type === "direction")
              .forEach((c) =>
                ret.push(
                  state.getControlValue(c as ControlState<"direction">, {
                    controls: state.values.controls,
                    layer: state.values.layers[props.layerIndex],
                  })
                )
              );
          });

          return ret;
        }),
      });
    },
    [props.layerIndex],
    state.filters.deepEqual((s) => [
      s.selectedHex.layerIndex,
      Math.floor(s.layers[props.layerIndex]?.currentBeat),
      s.controls,
      s.layers[props.layerIndex]?.tokenIds,
    ])
  );

  const [contextMenuNode, showContextMenu] = useContextMenu(() => {
    const defs = Object.entries(state.values.tokenDefinitions);
    const addItems: ContextMenuItem[] = defs.map(([uid, def]) => {
      return {
        contents: (
          <div className="tokenMenuItem">
            <span className="mono">{def.symbol}</span>
            <span>{def.label}</span>
          </div>
        ),
        handler() {
          state.addTokenToSelected(uid, "context menu");
        },
      };
    });

    const removeItems: ContextMenuItem[] = state.values.layers[
      props.layerIndex
    ].tokenIds[state.values.selectedHex.hexIndex].map((tokenId) => {
      return {
        contents: "Remove " + state.values.tokens[tokenId].label,
        handler() {
          state.removeTokenFromHex(
            tokenId,
            state.values.selectedHex,
            "remove token via context menu"
          );
        },
      };
    });

    const ret: ContextMenuItem[] = [...addItems];
    if (removeItems.length) {
      ret.push(SeparatorItem);
      ret.push(...removeItems);
    }

    return ret;
  }, [
    state.values.tokenDefinitions,
    state.values.layers[props.layerIndex]?.tokenIds,
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
    [state.simulation.layers[props.layerIndex]?.tokenIds]
  );

  ////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////// EVENTS ////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    const mouseUp = (
      pos: Point,
      originalPos: Point,
      e: MouseEvent | TouchEvent
    ) => {
      if (
        state.values.isDragging &&
        state.values.draggingDestHex.layerIndex !== -1 &&
        state.values.draggingDestHex.hexIndex !== -1 &&
        !(
          state.values.draggingSourceHex.hexIndex ===
            state.values.draggingDestHex.hexIndex &&
          state.values.draggingSourceHex.layerIndex ===
            state.values.draggingDestHex.layerIndex
        )
      ) {
        const destIndex = closestHexIndex(pos);
        // console.log("mouseUp", { destIndex });
        if (destIndex !== -1) {
          (state.values.draggingType === "copy"
            ? state.copyHex
            : state.moveHex
          ).bind(state)(
            {
              srcLayerIndex: state.values.draggingSourceHex.layerIndex,
              destLayerIndex: state.values.draggingDestHex.layerIndex,
              srcHexIndex: state.values.draggingSourceHex.hexIndex,
              destHexIndex: state.values.draggingDestHex.hexIndex,
            },
            `hex ${state.values.draggingType}`
          );
          state.set(
            {
              selectedHex: {
                layerIndex: props.layerIndex,
                hexIndex: destIndex,
              },
            },
            `hex ${state.values.draggingType}`
          );
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
          isTouch ? mapTouches(e.changedTouches, (t) => t.identifier) : [-1]
        );

        // find matching notes
        state.gui.performingNotes.forEach((note) => {
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

        state.set((s) => ({
          ...s,
          gui: {
            ...s.gui,
            performingNotes: s.gui.performingNotes.filter(
              (s) => !toRemove.has(s.identifier)
            ),
          },
        }));

        return;
      }

      if (settings.values.touchMode === "edit") {
        state.set((s) => ({
          ...s,
          gui: {
            ...s.gui,
            hexGrid: {
              ...s.gui.hexGrid,
              isDragging: false,
              dragDest: null,
              dragSource: null,
            },
          },
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

        touches.forEach(({ hexIndex, identifier }) => {
          const [newNotes, unpermitted] = Driver.playTriad({
            state,
            hexIndex,
            triad: 0,
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
            }))
          );
        });

        state.set((s) => ({
          ...s,
          gui: {
            ...s.gui,
            performingNotes: s.gui.performingNotes.concat(notes),
          },
        }));

        return;
      }

      if (settings.values.touchMode === "edit") {
        state.set((s) => ({
          ...s,
          gui: {
            ...s.gui,
            hexGrid: {
              ...s.gui.hexGrid,
              selectedHexes: {
                hexIndexes: [hexIndex],
                layerIndex: props.layerIndex,
              },
            },
          },
        }));

        if (
          !state.simulation.layers[props.layerIndex].tokenIds[hexIndex]?.length
        )
          return;

        state.set((s) => ({
          ...s,
          gui: {
            ...s.gui,
            hexGrid: {
              ...s.gui.hexGrid,
              dragSource: {
                hexIndexes: [hexIndex],
                layerIndex: props.layerIndex,
              },
              isDragging: true,
              dragType: e.shiftKey ? "copy" : "move",
            },
          },
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
        const newNotes = state.gui.performingNotes.slice(0);
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
          state.gui.performingNotes.forEach((note, noteIndex) => {
            if (note.identifier !== identifier) return;
            if (note.hexIndex === hexIndex && note.layer === props.layerIndex)
              return;

            // change
            changed = true;

            if (note.note) {
              Midi.noteOff({
                channel: note.channel,
                deviceName: note.device,
                note: note.note,
              });
            }

            const [playedNotes, unpermittedPlayedNotes] = Driver.playTriad({
              state,
              hexIndex,
              triad: 0,
              layerIndex: props.layerIndex,
              velocity: note.velocity ?? undefined,
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
          state.set((s) => ({
            ...s,
            gui: { ...s.gui, performingNotes: newNotes },
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
      if (
        state.gui.hexGrid.isDragging &&
        state.gui.hexGrid.dragSource &&
        mouseLocation.current
      ) {
        const hoveredHex = closestHexIndex(mouseLocation.current);
        const hoveredHexIsSourceHex =
          hoveredHex === state.gui.hexGrid.dragSource.hexIndexes[0] &&
          props.layerIndex === state.gui.hexGrid.dragSource.layerIndex;
        if (hoveredHex !== undefined && !hoveredHexIsSourceHex) {
          state.set((s) => ({
            ...s,
            gui: {
              ...s.gui,
              hexGrid: {
                ...s.gui.hexGrid,
                dragDest: {
                  hexIndexes: [hoveredHex],
                  layerIndex: props.layerIndex,
                },
              },
            },
          }));
          document.body.style.cursor =
            state.gui.hexGrid.dragType === "copy" ? "copy" : "move";
        } else {
          state.set((s) => ({
            ...s,
            gui: {
              ...s.gui,
              hexGrid: {
                ...s.gui.hexGrid,
                dragDest: null,
              },
            },
          }));
        }
      }
    };

    function mouseLeave(pos: Point, e: MouseEvent | TouchEvent) {
      state.set((s) => ({
        ...s,
        gui: {
          ...s.gui,
          hexGrid: {
            ...s.gui.hexGrid,
            dragDest: null,
          },
        },
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
      const pos = canvas.current.localPointToGlobal(
        hexPoints.current[hexIndex]
      );

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
  }, [props.layerIndex]);

  /////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////// BACK CANVAS //////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////
  state.useSubscription(
    () => {
      if (!state.values.layers[props.layerIndex]?.tokenIds) return;

      backCanvas.current?.clear();
      // draw selected //
      // if (prevSelectedHex !== -1 && prevSelectedHex !== undefined && backCanvas.current)
      // {
      //     backCanvas.current.fillHexagonCell(startPosition, new Point(~~(prevSelectedHex / rows), prevSelectedHex % rows), hexRadius, false, "#221922");
      // }

      // draw key //
      // console.log(state);
      const key: keyof typeof KeyMap = state.getControlValue(
        { layerControl: "key" },
        {
          layer: state.values.layers[props.layerIndex],
          controls: state.values.controls,
        }
      ) as keyof typeof KeyMap;
      if (key !== "None") {
        const notes = KeyMap[key].map((ni) => noteArray[ni]);
        for (let i = 0; i < NumHexes; i++) {
          const hexNote = getNoteParts(hexNotes[i]).name;
          if (notes.includes(hexNote)) {
            backCanvas.current?.fillHexagonCell({
              gridLocation: startPosition,
              cellCoordinate: new Point(~~(i / rows), i % rows),
              color: colors["hexKeyBackgroundColor"],
              gridStartsHigh: false,
              hexRadius,
            });
          }
        }
      }

      // draw selected //
      if (hexIsSelected(state.values)) {
        backCanvas.current?.fillHexagonCell({
          gridLocation: startPosition,
          cellCoordinate: new Point(
            ~~(state.values.selectedHex.hexIndex / rows),
            state.values.selectedHex.hexIndex % rows
          ),
          color: colors["hexBackgroundColorSelected"],
          gridStartsHigh: false,
          hexRadius,
        });
      }

      // draw midi notes //
      if (props.layerIndex === state.values.selectedHex.layerIndex) {
        state.values.midiNotes.forEach((note) => {
          const toPlay: { hexIndex: number; velocity: number }[] = [];

          for (let i = 0; i < hexNotes.length; i++) {
            if (note.isOn && hexNotes[i] === note.name) {
              toPlay.push({ hexIndex: i, velocity: note.velocity });
            }
          }

          toPlay.forEach((data) => {
            backCanvas.current?.fillHexagonCell({
              gridLocation: startPosition,
              cellCoordinate: new Point(
                ~~(data.hexIndex / rows),
                data.hexIndex % rows
              ),
              color: `rgba(40,${90 + (data.velocity / 127) * 20},${
                30 + (data.velocity / 127) * 60
              },${(data.velocity / 127) * 0.8 + 0.2})`,
              gridStartsHigh: false,
              hexRadius,
            });
          });
        });
      }

      // draw dragging //
      if (
        state.values.isDragging &&
        state.values.draggingDestHex.hexIndex !== -1 &&
        state.values.draggingDestHex.layerIndex === props.layerIndex
      ) {
        backCanvas.current?.fillHexagonCell({
          gridLocation: startPosition,
          cellCoordinate: new Point(
            ~~(state.values.draggingDestHex.hexIndex / rows),
            state.values.draggingDestHex.hexIndex % rows
          ),
          color: colors["hexBackgroundColorDrop"],
          gridStartsHigh: false,
          hexRadius,
        });
      }

      // draw playheads //
      state.values.layers[props.layerIndex].playheads.forEach(
        (hex, hexIndex) => {
          if (!hex.length) return;

          const dying = hex.some((p) => p.age >= p.lifespan);

          backCanvas.current?.fillHexagonCell({
            gridLocation: startPosition,
            cellCoordinate: new Point(~~(hexIndex / rows), hexIndex % rows),
            color:
              colors[
                dying
                  ? "hexPlayheadBackgroundColorDying"
                  : "hexPlayheadBackgroundColor"
              ],
            gridStartsHigh: false,
            hexRadius,
          });
        }
      );
    },
    [props.layerIndex],
    state.filters.deepEqual((s) => [
      hexIsSelected(s),
      s.selectedHex,
      s.layers,
      s.draggingDestHex,
      s.isDragging,
      s.midiNotes,
    ])
  );

  // useEffect(() =>
  // {
  //     if (!canvas.current || state.selectedHex === -1) return;

  //     const tokens = state.layers[props.layerIndex].tokenIds[state.selectedHex].map(tid => state.tokens[tid]);
  //     const symbols = tokens.map(t => t.symbol).join("");
  //     const directions: number[] = [];

  //     tokens.forEach((token) =>
  //     {
  //         token.controlIds.forEach((controlId) =>
  //         {
  //             const control = state.controls[controlId];
  //             if (control.type === "direction")
  //             {
  //                 directions.push(getControlValue(state, control));
  //             }
  //         });
  //     });

  //     canvas.current.blendMode = "destination-out";
  //     canvas.current.fillHexagonCell(startPosition, new Point(~~(state.selectedHex / rows), state.selectedHex % rows), hexRadius, false, "#221922");
  //     canvas.current.blendMode = "source-over";
  //     canvas.current.drawHexagonCell(startPosition, new Point(~~(state.selectedHex / rows), state.selectedHex % rows),
  //         hexRadius, false, "white", lineWidth, `${hexNotes[state.selectedHex]}${symbols.length > 0 ? "\n" + symbols : ""}`, directions);
  // }, [ state.controls ]);

  const style = props.size
    ? { width: props.size + "px", height: "auto" }
    : undefined;

  return (
    <div className="hexGrid">
      <canvas ref={backCanvasEl} style={style}></canvas>
      <canvas ref={hexCanvasEl} style={style}></canvas>
      <canvas
        tabIndex={0}
        ref={canvasEl}
        draggable={false}
        style={style}
      ></canvas>
      {contextMenuNode}
    </div>
  );
}
