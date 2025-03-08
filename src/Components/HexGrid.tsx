import { useContext, useEffect, useRef } from "react";
import { ControlState, getControlValue, KeyMap } from "../Types";
import { Canvas } from "../utils/canvas";
import {
  getNoteParts,
  hexNotes,
  noteArray,
  NumHexes,
} from "../utils/elysiumutils";
import Point from "../utils/point";
import { confirmPrompt } from "../utils/utils";
import {
  Menu,
  MenuItemOptions,
  PredefinedMenuItem,
} from "@tauri-apps/api/menu";
import state from "../state/AppState";
import settings from "../state/AppSettings";

interface Props {
  layerIndex: number;
  size?: number;
}

type DragType = "copy" | "move" | "none";

export default function HexGrid(props: Props) {
  const reactiveState = state.useState();
  const reactiveSettings = settings.useState();
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

  const layerIsSelected =
    reactiveState.selectedHex.layerIndex === props.layerIndex;
  const hexIsSelected =
    reactiveState.selectedHex.hexIndex !== -1 && layerIsSelected;

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
    async function keyDown(e: KeyboardEvent) {
      if (!hexIsSelected) return;

      if (
        e.key === "Delete" &&
        reactiveState.layers[props.layerIndex].tokenIds[
          reactiveState.selectedHex.hexIndex
        ].length > 0
      ) {
        if (
          !reactiveSettings.confirmDelete ||
          (await confirmPrompt(
            "Are you sure you want to clear that hex?",
            "Confirm clear hex"
          ))
        ) {
          state.clearHex(
            {
              layerIndex: props.layerIndex,
              hexIndex: reactiveState.selectedHex.hexIndex,
            },
            "clearing hex off of keypress"
          );
        } else if ([...e.key].length === 1 && !e.ctrlKey && !e.shiftKey) {
          for (const uid in reactiveSettings.tokens) {
            if (
              reactiveSettings.tokens[uid].shortcut.toLowerCase() ===
              e.key.toLowerCase()
            ) {
              if (e.altKey) {
                const tokenIds =
                  reactiveState.layers[props.layerIndex].tokenIds[
                    reactiveState.selectedHex.hexIndex
                  ];
                const tokenToRemove = tokenIds
                  .slice(0)
                  .reverse()
                  .find((iid) => reactiveState.tokens[iid].uid === uid);
                if (tokenToRemove) {
                  state.removeTokenFromHex(
                    tokenToRemove,
                    reactiveState.selectedHex,
                    "remove token off keyboard shortcut"
                  );
                }
              } else {
                state.addTokenToHex(
                  uid,
                  reactiveState.selectedHex,
                  "add token off keyboard shortcut"
                );
              }
            }
          }
        }
      }
    }

    canvasEl.current?.addEventListener("keydown", keyDown);

    return () => canvasEl.current?.removeEventListener("keydown", keyDown);
  });

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
      opaque: true,
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

    backCanvas.current.fill("#221922");
    const pts = hexCanvas.current.drawHexagonGrid(
      startPosition,
      hexRadius,
      new Point(cols, rows),
      false,
      "#DDBBDD",
      lineWidth
    );

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
  }, []);

  ////////////////////////////////////////////////////////////////////////////////
  ///////////////////////////////// FRONT CANVAS /////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    canvas.current?.clear();
    canvas.current?.drawHexagonGridDecorations(
      startPosition,
      hexRadius,
      new Point(cols, rows),
      false,
      "#ffccff",
      hexNotes.map((hexNote, i) => {
        const symbols = reactiveState.layers[props.layerIndex].tokenIds[i].map(
          (tokenId) => reactiveState.tokens[tokenId].symbol
        );
        return symbols.length > 0 ? hexNote + "\n" + symbols.join("") : hexNote;
      }),
      hexNotes.map((hexNote, i) => {
        const tokens = reactiveState.layers[props.layerIndex].tokenIds[i].map(
          (tokenId) => reactiveState.tokens[tokenId]
        );

        const ret: number[] = [];

        tokens.forEach((token) => {
          const controls = token.controlIds.map(
            (cid) => reactiveState.controls[cid]
          );
          controls
            .filter((c) => c.type === "direction")
            .forEach((c) =>
              ret.push(
                getControlValue(
                  reactiveState,
                  props.layerIndex,
                  c as ControlState<"direction">
                )
              )
            );
        });

        return ret;
      })
    );
  }, [
    reactiveState.selectedHex.layerIndex,
    Math.floor(reactiveState.layers[props.layerIndex].currentBeat),
    reactiveState.controls,
    reactiveState.layers[props.layerIndex].tokenIds,
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
        reactiveState.isDragging &&
        reactiveState.draggingDestHex.layerIndex !== -1 &&
        reactiveState.draggingDestHex.hexIndex !== -1 &&
        !(
          reactiveState.draggingSourceHex.hexIndex ===
            reactiveState.draggingDestHex.hexIndex &&
          reactiveState.draggingSourceHex.layerIndex ===
            reactiveState.draggingDestHex.layerIndex
        )
      ) {
        const destIndex = closestHexIndex(pos);
        if (destIndex !== -1) {
          (reactiveState.draggingType === "copy"
            ? state.copyHex
            : state.moveHex)(
            {
              srcLayerIndex: reactiveState.draggingSourceHex.layerIndex,
              destLayerIndex: reactiveState.draggingDestHex.layerIndex,
              srcHexIndex: reactiveState.draggingSourceHex.hexIndex,
              destHexIndex: reactiveState.draggingDestHex.hexIndex,
            },
            `hex ${reactiveState.draggingType}`
          );
          state.set(
            {
              selectedHex: {
                layerIndex: props.layerIndex,
                hexIndex: destIndex,
              },
            },
            `hex ${reactiveState.draggingType}`
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
      if (reactiveState.isDragging && mouseLocation.current) {
        const hoveredHex = closestHexIndex(mouseLocation.current);
        const hoveredHexIsSourceHex =
          hoveredHex === reactiveState.draggingSourceHex.hexIndex &&
          props.layerIndex === reactiveState.draggingSourceHex.layerIndex;
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
            reactiveState.draggingType === "copy" ? "copy" : "move";
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
      if (!hexIsSelected) return;

      const defs = Object.entries(reactiveState.tokenDefinitions);
      const addItems: MenuItemOptions[] = defs.map(([uid, def]) => {
        return {
          text: `Add ${def.label}`,
          action() {
            state.addTokenToSelected(uid, "context menu");
          },
        };
      });

      const removeItems: MenuItemOptions[] = reactiveState.layers[
        props.layerIndex
      ].tokenIds[reactiveState.selectedHex.hexIndex].map((tokenId) => {
        return {
          text: "Remove " + reactiveState.tokens[tokenId].label,
          action() {
            state.removeTokenFromHex(
              tokenId,
              reactiveState.selectedHex,
              "remove token via context menu"
            );
          },
        };
      });

      const menu = await Menu.new({
        items: [
          ...addItems,
          await PredefinedMenuItem.new({
            item: "Separator",
          }),
          ...removeItems,
        ],
      });
      await menu.popup();
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
  });

  /////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////// BACK CANVAS //////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    backCanvas.current?.fill("#221922");
    // draw selected //
    // if (prevSelectedHex !== -1 && prevSelectedHex !== undefined && backCanvas.current)
    // {
    //     backCanvas.current.fillHexagonCell(startPosition, new Point(~~(prevSelectedHex / rows), prevSelectedHex % rows), hexRadius, false, "#221922");
    // }

    // draw key //
    // console.log(state);
    const key: keyof typeof KeyMap = getControlValue(
      state.values,
      props.layerIndex,
      reactiveState.controls[reactiveState.layers[props.layerIndex].key]
    ) as keyof typeof KeyMap;
    if (key !== "None") {
      const notes = KeyMap[key].map((ni) => noteArray[ni]);
      for (let i = 0; i < NumHexes; i++) {
        const hexNote = getNoteParts(hexNotes[i]).name;
        if (notes.includes(hexNote)) {
          backCanvas.current?.fillHexagonCell(
            startPosition,
            new Point(~~(i / rows), i % rows),
            hexRadius,
            false,
            "#005555"
          );
        }
      }
    }

    // draw selected //
    if (hexIsSelected) {
      backCanvas.current?.fillHexagonCell(
        startPosition,
        new Point(
          ~~(reactiveState.selectedHex.hexIndex / rows),
          reactiveState.selectedHex.hexIndex % rows
        ),
        hexRadius,
        false,
        "#702570"
      );
    }

    // draw midi notes //
    if (props.layerIndex === reactiveState.selectedHex.layerIndex) {
      reactiveState.midiNotes.forEach((note) => {
        const toPlay: { hexIndex: number; velocity: number }[] = [];

        for (let i = 0; i < hexNotes.length; i++) {
          if (note.isOn && hexNotes[i] === note.name) {
            toPlay.push({ hexIndex: i, velocity: note.velocity });
          }
        }

        toPlay.forEach((data) => {
          backCanvas.current?.fillHexagonCell(
            startPosition,
            new Point(~~(data.hexIndex / rows), data.hexIndex % rows),
            hexRadius,
            false,
            `rgba(40,${90 + (data.velocity / 127) * 20},${
              30 + (data.velocity / 127) * 60
            },${(data.velocity / 127) * 0.8 + 0.2})`
          );
        });
      });
    }

    // draw dragging //
    if (
      reactiveState.isDragging &&
      reactiveState.draggingDestHex.hexIndex !== -1 &&
      reactiveState.draggingDestHex.layerIndex === props.layerIndex
    ) {
      backCanvas.current?.fillHexagonCell(
        startPosition,
        new Point(
          ~~(reactiveState.draggingDestHex.hexIndex / rows),
          reactiveState.draggingDestHex.hexIndex % rows
        ),
        hexRadius,
        false,
        "#00A"
      );
    }

    // draw playheads //
    reactiveState.layers[props.layerIndex].playheads.forEach(
      (hex, hexIndex) => {
        if (hex.length > 0) {
          if (hex.some((p) => p.age >= p.lifespan)) {
            // dying //
            backCanvas.current?.fillHexagonCell(
              startPosition,
              new Point(~~(hexIndex / rows), hexIndex % rows),
              hexRadius,
              false,
              "#880000"
            );
          } else {
            backCanvas.current?.fillHexagonCell(
              startPosition,
              new Point(~~(hexIndex / rows), hexIndex % rows),
              hexRadius,
              false,
              "#FF0000"
            );
          }
        }
      }
    );
  }, [
    reactiveState.selectedHex,
    reactiveState.layers,
    props.layerIndex,
    reactiveState.draggingDestHex,
    reactiveState.isDragging,
    reactiveState.midiNotes,
  ]);

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
    </div>
  );
}
