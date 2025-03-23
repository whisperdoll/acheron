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
        console.log("hex not selected");
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

    const canvasElRef = canvasEl.current;
    canvasElRef && canvasElRef.addEventListener("keydown", keyDown);

    return () => {
      canvasElRef && canvasElRef.removeEventListener("keydown", keyDown);
    };
  }, [props.layerIndex]);

  useEffect(() => {
    canvas.current = new Canvas({
      align: { horizontal: true, vertical: true },
      canvasElement: canvasEl.current!,
      deepCalc: true,
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

    function documentMouseUp() {
      state.set(
        {
          isDragging: false,
          draggingDestHex: { hexIndex: -1, layerIndex: -1 },
        },
        "mouse up"
      );
      document.body.style.cursor = "default";
    }

    function mouseDown(pos: Point, e: MouseEvent | TouchEvent) {
      const hexIndex = closestHexIndex(pos);
      if (hexIndex !== -1) {
        state.set(
          {
            selectedHex: {
              hexIndex,
              layerIndex: props.layerIndex,
            },
          },
          "mouse down"
        );

        if (!state.values.layers[props.layerIndex].tokenIds[hexIndex]?.length)
          return;

        state.set(
          {
            draggingSourceHex: {
              hexIndex,
              layerIndex: props.layerIndex,
            },
            isDragging: true,
            draggingType: e.shiftKey ? "copy" : "move",
          },
          "mouse down on token"
        );
      }
    }

    function mouseMove(
      pos: Point,
      isDown: boolean,
      lastPos: Point,
      originalPos: Point,
      e: MouseEvent | TouchEvent
    ) {
      mouseLocation.current = pos;
    }

    animationCallback.current = () => {
      if (state.values.isDragging && mouseLocation.current) {
        const hoveredHex = closestHexIndex(mouseLocation.current);
        const hoveredHexIsSourceHex =
          hoveredHex === state.values.draggingSourceHex.hexIndex &&
          props.layerIndex === state.values.draggingSourceHex.layerIndex;
        if (hoveredHex !== -1 && !hoveredHexIsSourceHex) {
          state.set(
            {
              draggingDestHex: {
                hexIndex: hoveredHex,
                layerIndex: props.layerIndex,
              },
            },
            "hover while dragging"
          );
          document.body.style.cursor =
            state.values.draggingType === "copy" ? "copy" : "move";
        } else {
          state.set(
            {
              draggingDestHex: {
                hexIndex: -1,
                layerIndex: -1,
              },
            },
            "hover over nothing while dragging"
          );
        }
      }
    };

    function mouseLeave(pos: Point, e: MouseEvent | TouchEvent) {
      state.set(
        {
          draggingDestHex: {
            hexIndex: -1,
            layerIndex: -1,
          },
        },
        "mouse leave while dragging"
      );
      mouseLocation.current = null;
    }

    async function contextMenu(e: MouseEvent) {
      e.preventDefault();
      if (!hexIsSelected(state.values)) return;

      showContextMenu(e);

      //   const defs = Object.entries(state.values.tokenDefinitions);
      //   const addItems: MenuItemOptions[] = defs.map(([uid, def]) => {
      //     return {
      //       text: `Add ${def.label}`,
      //       action() {
      //         state.addTokenToSelected(uid, "context menu");
      //       },
      //     };
      //   });

      //   const removeItems: MenuItemOptions[] = state.values.layers[
      //     props.layerIndex
      //   ].tokenIds[state.values.selectedHex.hexIndex].map((tokenId) => {
      //     return {
      //       text: "Remove " + state.values.tokens[tokenId].label,
      //       action() {
      //         state.removeTokenFromHex(
      //           tokenId,
      //           state.values.selectedHex,
      //           "remove token via context menu"
      //         );
      //       },
      //     };
      //   });

      //   const menu = await Menu.new({
      //     items: [
      //       ...addItems,
      //       await PredefinedMenuItem.new({
      //         item: "Separator",
      //       }),
      //       ...removeItems,
      //     ],
      //   });
      //   await menu.popup();
      // }
    }

    canvas.current?.addEventListener("mousemove", mouseMove);
    canvas.current?.addEventListener("mousedown", mouseDown);
    canvas.current?.addEventListener("mouseup", mouseUp);
    canvas.current?.addEventListener("mouseleave", mouseLeave);
    document.body.addEventListener("mouseup", documentMouseUp);
    canvas.current?.canvas.addEventListener("contextmenu", contextMenu);

    return () => {
      canvas.current?.removeEventListener("mousemove", mouseMove);
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
