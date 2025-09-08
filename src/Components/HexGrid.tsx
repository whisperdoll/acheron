import React, { useContext, useEffect, useRef, useState } from "react";
import { ControlState, KeyMap, PerformanceNote } from "../Types";
import { Canvas } from "../utils/canvas";
import {
  generateGridNotes,
  getNoteParts,
  hexNotes,
  noteArray,
  noteColors,
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
import { mapTouches, mod, pointArray } from "../lib/utils";
import Midi from "../utils/midi";
import HexGridContextMenu from "./HexGridContextMenu";
import Color from "colorjs.io";

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

  const rows = state.values.gridRows;
  const cols = state.values.gridCols;
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
  const tokenIds = state.useState((s) => s.layers[props.layerIndex].tokenIds);

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

  // keyboard controls
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

  // setup
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
      notes: hexNotes.map(getNoteParts),
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
        labels: generateGridNotes("D#7", rows, cols).map((hexNote, i) => {
          const symbols = state.values.layers[props.layerIndex].tokenIds[i].map(
            (tokenId) => state.values.tokens[tokenId].symbol
          );
          return `${i}\n${hexNote}`;
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
    [props.layerIndex, tokenIds]
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
        state.values.performingNotes.forEach((note) => {
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

        state.set(
          (s) => ({
            performingNotes: s.performingNotes.filter(
              (s) => !toRemove.has(s.identifier)
            ),
          }),
          "perform notes visual"
        );

        return;
      }

      if (settings.values.touchMode === "edit") {
        state.set(
          (s) => ({
            isDragging: false,
            draggingDestHex: { hexIndex: -1, layerIndex: -1 },
            draggingSourceHex: { hexIndex: -1, layerIndex: -1 },
          }),
          "stop dragging"
        );
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
            state: new SimpleAppState(state.values),
            hexIndex,
            triad: 0,
            durationMs:
              1 /
              state.getControlValue<"decimal">({
                layerControl: "tempo",
                layer: props.layerIndex,
              }),
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

        state.set(
          (s) => ({
            performingNotes: s.performingNotes.concat(notes),
          }),
          "perform some notes"
        );

        return;
      }

      if (settings.values.touchMode === "edit") {
        state.set(
          (s) => ({
            selectedHex: {
              hexIndex: hexIndex,
              layerIndex: props.layerIndex,
            },
          }),
          "select hex"
        );

        if (!state.values.layers[props.layerIndex].tokenIds[hexIndex]?.length)
          return;

        state.set(
          (s) => ({
            draggingSourceHex: { hexIndex, layerIndex: props.layerIndex },
          }),
          "set drag src"
        );
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
        const newNotes = state.values.performingNotes.slice(0);
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
          state.values.performingNotes.forEach((note, noteIndex) => {
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
              state: new SimpleAppState(state.values),
              hexIndex,
              triad: 0,
              layerIndex: props.layerIndex,
              velocity: note.velocity ?? undefined,
              durationMs:
                1 /
                state.getControlValue<"decimal">({
                  layerControl: "tempo",
                  layer: props.layerIndex,
                }),
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
          state.set(
            (s) => ({
              performingNotes: newNotes,
            }),
            "set perform notes"
          );
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
        state.values.draggingSourceHex.hexIndex !== -1 &&
        mouseLocation.current
      ) {
        const hoveredHex = closestHexIndex(mouseLocation.current);
        const hoveredHexIsSourceHex =
          hoveredHex === state.values.draggingSourceHex.hexIndex &&
          props.layerIndex === state.values.draggingSourceHex.layerIndex;

        if (hoveredHex !== -1 && !hoveredHexIsSourceHex) {
          state.set(
            (s) => ({
              isDragging: true,
              draggingDestHex: {
                hexIndex: hoveredHex,
                layerIndex: props.layerIndex,
              },
            }),
            "set dragging dest hex"
          );
          document.body.style.cursor =
            state.values.draggingType === "copy" ? "copy" : "move";
        } else {
          state.set(
            (s) => ({
              draggingDestHex: { hexIndex: -1, layerIndex: -1 },
            }),
            "clear dragging hex"
          );
        }
      }
    };

    function mouseLeave(pos: Point, e: MouseEvent | TouchEvent) {
      state.set(
        (s) => ({
          draggingDestHex: { hexIndex: -1, layerIndex: -1 },
        }),
        "clear dragging hex"
      );
      mouseLocation.current = null;
    }

    async function contextMenu(e: MouseEvent) {
      e.preventDefault();
      if (!hexIsSelected(state.values)) return;
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
        const note = getNoteParts(hexNotes[state.values.selectedHex.hexIndex]);
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
              cellCoordinate: new Point(~~(i / rows), i % rows),
              color: (i === state.values.selectedHex.hexIndex
                ? color
                : lightColor
              ).toString(),
              gridStartsHigh: false,
              hexRadius,
            });
          }
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
