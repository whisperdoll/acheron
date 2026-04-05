import React, { useContext, useState } from "react";
import settings from "../state/AppSettings";
import GoogleIconButton from "./GoogleIconButton";
import { Props as GoogleIconProps } from "./GoogleIcon";
import { openComposition, openUrl, saveComposition } from "../utils/desktop";
import { keyboardShortcutString } from "../lib/keyboard";
import Dict from "../lib/dict";
import useKeyboardShortcutStrings from "../Hooks/useKeyboardShortcutStrings";
import env from "../lib/env";
import { sliceObject } from "../utils/utils";
import { cx } from "../lib/utils";
import GridSizeMenu from "./GridSizeMenu";
import TouchModeMenu from "./TouchModeMenu";
import { deserializeComposition, serializeComposition } from "../Serialization";
import { AppContext, togglePlaying } from "../state/AppState";

interface Props {}

export default React.memo(function StatusBar(props: Props) {
  const { state, setState } = useContext(AppContext)!;
  const reactiveState = {
    isPlaying: state.isPlaying,
    currentBeat: Math.floor(
      state.layers[state.selectedHex.layerIndex].currentBeat,
    ),
    isMultiLayerMode: state.isMultiLayerMode,
    isShowingTouchModeMenu: state.isShowingTouchModeMenu,
    isShowingGridSizeMenu: state.isShowingGridSizeMenu,
  };
  const keyboardShortcutStrings = useKeyboardShortcutStrings();
  const reactiveSettings = settings.useState((s) =>
    sliceObject(s, ["wrapPlayheads", "touchMode"]),
  );

  const iconProps: Pick<
    GoogleIconProps,
    "fill" | "buttonStyle" | "opticalSize"
  > = {
    fill: true,
    buttonStyle: "rounded",
    opticalSize: 20,
  };

  function withShortcut(
    str: string,
    shortcut: keyof typeof keyboardShortcutStrings,
  ): string {
    const shortcutString = keyboardShortcutStrings[shortcut];
    return shortcutString ? `${str} (${shortcutString})` : str;
  }

  return (
    <>
      <div className="statusBar">
        <div
          className={
            "pulse " + (reactiveState.currentBeat % 2 === 1 ? "active" : "")
          }
        ></div>

        <GoogleIconButton
          onClick={() => saveComposition(serializeComposition(state))}
          icon="save"
          title={"Save"}
          iconElementProps={{
            style: {
              transform: "scale(0.9)",
            },
          }}
          {...iconProps}
        />
        <GoogleIconButton
          onClick={async () => {
            const composition = await openComposition();
            if (!composition) return;

            const deserialized = await deserializeComposition(
              state,
              composition,
            );

            setState(deserialized);
          }}
          icon="upload_file"
          title={"Load"}
          iconElementProps={{
            style: {
              transform: "scale(0.9)",
            },
          }}
          {...iconProps}
        />
        <GoogleIconButton
          icon={reactiveState.isPlaying ? "stop" : "play_arrow"}
          onClick={() => togglePlaying(setState, "toggle play button")}
          title={withShortcut(
            reactiveState.isPlaying ? "Stop" : "Play",
            "play",
          )}
          iconElementProps={{
            style: {
              transform: `scale(${reactiveState.isPlaying ? 1.2 : 1.28})`,
            },
          }}
          {...iconProps}
        />

        <GoogleIconButton
          icon={"touch_app"}
          title={`Change touch mode`}
          onClick={() =>
            setState((s) => ({
              ...s,
              isShowingTouchModeMenu: !s.isShowingTouchModeMenu,
            }))
          }
          {...iconProps}
          data-touch-mode-menu="1"
        />
        <GoogleIconButton
          icon="grid_on"
          title="Change grid size"
          onClick={() =>
            setState((s) => ({
              ...s,
              isShowingGridSizeMenu: !s.isShowingGridSizeMenu,
            }))
          }
          {...iconProps}
          data-grid-size-menu="1"
        />
        <GoogleIconButton
          icon="layers"
          title={withShortcut("Toggle MultiLayer Mode", "toggleMultilayerMode")}
          onClick={() =>
            setState((s) => ({ ...s, isMultiLayerMode: !s.isMultiLayerMode }))
          }
          {...iconProps}
          className={cx({
            active: reactiveState.isMultiLayerMode,
            inactive: !reactiveState.isMultiLayerMode,
          })}
        />
        <GoogleIconButton
          icon="move_up"
          title={`Turn ${
            reactiveSettings.wrapPlayheads ? "off" : "on"
          } Playhead Wrapping`}
          onClick={() =>
            settings.set(
              (s) => ({ wrapPlayheads: !s.wrapPlayheads }),
              "toggle wrap playheads",
            )
          }
          {...iconProps}
          className={cx({
            active: reactiveSettings.wrapPlayheads,
            inactive: !reactiveSettings.wrapPlayheads,
          })}
        />

        <GoogleIconButton
          onClick={() => setState((s) => ({ ...s, isShowingSettings: true }))}
          icon="settings"
          title={withShortcut("Settings", "settings")}
          iconElementProps={{
            style: {
              transform: "scale(0.9)",
            },
          }}
          {...iconProps}
        />
        <GoogleIconButton
          icon="bug_report"
          title="Report a bug"
          onClick={() => {
            openUrl(
              "https://github.com/whisperdoll/acheron/issues/new?assignees=&labels=bug&template=1-Bug_report.md",
            );
          }}
          opticalSize={20}
          {...iconProps}
        />
        <GoogleIconButton
          icon="favorite"
          title="Support on Patreon"
          onClick={() => {
            openUrl("https://www.patreon.com/whisperdoll");
          }}
          iconElementProps={{
            style: {
              transform: "scale(0.9)",
            },
          }}
          {...iconProps}
        />
        <GoogleIconButton
          icon="question_mark"
          title="Help"
          onClick={() =>
            openUrl(
              "https://github.com/whisperdoll/acheron/wiki/Acheron-Documentation",
            )
          }
          iconElementProps={{
            style: {
              transform: "scale(0.9)",
            },
          }}
          {...iconProps}
        />
        <div className="version">
          {env("gitHash") && (
            <a
              href={`https://github.com/whisperdoll/acheron/commit/${env(
                "gitHash",
              )}`}
              target="_blank"
            >
              {env("gitHash")}
            </a>
          )}
        </div>
      </div>
      {reactiveState.isShowingTouchModeMenu && <TouchModeMenu />}
      {reactiveState.isShowingGridSizeMenu && <GridSizeMenu />}
    </>
  );
});
