import React, { useEffect, useRef } from "react";
import { cx } from "../lib/utils";
import settings, { TouchMode } from "../state/AppSettings";
import GoogleIcon, { CodePoint } from "./GoogleIcon";
import state from "../state/AppState";

/*
  - performance
    - (multi)touch to play notes like a piano
  - generate
    - (multi)touch to generate playheads
      - swipe for direction or tap for all directions
  - edit
    - touch to modify a hex
    - drag n drop
      - toggle for copying vs moving
*/

const touchModeDescriptions: Record<
  TouchMode,
  { title: string; description: React.ReactNode; icon: CodePoint }
> = {
  perform: {
    title: "Perform",
    description: "Tap and hold to play a note.",
    icon: "piano",
  },
  generate: {
    title: "Generate (not working yet)",
    description: (
      <>
        <span>Tap to generate playheads.</span>
        <span>Swipe to choose a direction.</span>
        <span>Hold to generate on-beat.</span>
      </>
    ),
    icon: "token",
  },
  edit: {
    title: "Edit",
    description: (
      <>
        <span>Touch or click to modify a hex.</span>
        <span>Drag and drop to move or copy tokens from a hex.</span>
      </>
    ),
    icon: "edit",
  },
};

export default function TouchModeMenu() {
  const currentMode = settings.useState((s) => s.touchMode);
  const ref = useRef<HTMLDivElement>(null);
  const reactiveState = state.useState();

  useEffect(() => {
    function pointerDown(e: PointerEvent) {
      if (!(e.target instanceof HTMLElement)) return;
      if (!ref.current) return;

      const tree: HTMLElement[] = [e.target];

      while (tree.at(-1)!.parentElement) {
        tree.push(tree.at(-1)!.parentElement!);
      }

      if (
        e.target instanceof HTMLElement &&
        (ref.current.contains(e.target) ||
          tree.some((el) => el.dataset.touchModeMenu))
      ) {
        e.stopPropagation();
        return;
      }

      state.set(
        (s) => ({
          ...s,
          isShowingTouchModeMenu: false,
        }),
        "toggle showing touch mode menu"
      );
    }

    document.addEventListener("pointerdown", pointerDown);

    return () => document.removeEventListener("pointerdown", pointerDown);
  }, []);

  return (
    <div className="touchModeMenu" ref={ref}>
      {Object.entries(touchModeDescriptions).map(
        ([mode, { title, description, icon }]) => {
          return (
            <div
              key={mode}
              className={cx("touchModeMenuItem", {
                selected: currentMode === mode,
              })}
              onClick={(e) => {
                settings.set({ touchMode: mode }, "change touch mode");
                state.set(
                  (s) => ({
                    ...s,
                    isShowingTouchModeMenu: false,
                    selectedHex: {
                      hexIndex: -1,
                      layerIndex: s.selectedHex.layerIndex,
                    },
                  }),
                  "hide touch mode menu"
                );
              }}
            >
              <GoogleIcon
                className="itemIcon"
                icon={icon}
                buttonStyle="rounded"
                fill
              />
              <div className="titleAndDescription">
                <div className="title">{title}</div>
                <div className="description">{description}</div>
              </div>
              {currentMode === mode && (
                <GoogleIcon
                  className="check"
                  icon="check"
                  buttonStyle="rounded"
                  fill
                />
              )}
            </div>
          );
        }
      )}
    </div>
  );
}
