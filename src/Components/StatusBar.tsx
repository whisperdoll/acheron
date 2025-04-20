import React from "react";
import state from "../state/AppState";
import React, { useState } from "react";
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
import TouchModeMenu, { touchModeDescriptions } from "./TouchModeMenu";
import { deserializeComposition, serializeComposition } from "../Serialization";

interface Props {}

export default React.memo(function StatusBar(props: Props) {
  const reactiveState = state.useState((s) => ({
    isPlaying: s.isPlaying,
    currentBeat: Math.floor(s.layers[s.selectedHex.layerIndex].currentBeat),
    isMultiLayerMode: s.isMultiLayerMode,
  }));
  const keyboardShortcutStrings = useKeyboardShortcutStrings();
  const reactiveSettings = settings.useState((s) =>
    sliceObject(s, ["playNoteOnClick", "wrapPlayheads"])
    sliceObject(s, ["playNoteOnClick", "wrapPlayheads", "touchMode"])
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
    shortcut: keyof typeof keyboardShortcutStrings
  ): string {
    const shortcutString = keyboardShortcutStrings[shortcut];
    return shortcutString ? `${str} (${shortcutString})` : str;
  }

  return (
    <div className="statusBar">
      <div
        className={
          "pulse " + (reactiveState.currentBeat % 2 === 1 ? "active" : "")
        }
      ></div>
      <GoogleIconButton
        icon={reactiveState.isPlaying ? "stop" : "play_arrow"}
        onClick={() => state.togglePlaying("toggle play button")}
        title={withShortcut(reactiveState.isPlaying ? "Stop" : "Play", "play")}
        iconElementProps={{
          style: {
            transform: `scale(${reactiveState.isPlaying ? 1.2 : 1.28})`,
          },
        }}
        {...iconProps}
      />
      <GoogleIconButton
        onClick={() => state.set({ isShowingSettings: true }, "show settings")}
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
        icon="layers"
        title={withShortcut("Toggle MultiLayer Mode", "toggleMultilayerMode")}
        onClick={() =>
          state.set(
            (s) => ({ isMultiLayerMode: !s.isMultiLayerMode }),
            "toggle multilayer mode"
          )
        }
        {...iconProps}
        className={cx({
          active: reactiveState.isMultiLayerMode,
          inactive: !reactiveState.isMultiLayerMode,
        })}
      />
      <GoogleIconButton
        icon="touch_app"
        title={`Turn ${
          reactiveSettings.playNoteOnClick ? "off" : "on"
        } Touch-To-Play`}
        onClick={() =>
          settings.set(
            (s) => ({ playNoteOnClick: !s.playNoteOnClick }),
            "toggle touch to play"
          )
        }
        {...iconProps}
        className={cx({
          active: reactiveSettings.playNoteOnClick,
          inactive: !reactiveSettings.playNoteOnClick,
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
            "toggle wrap playheads"
          )
        }
        {...iconProps}
        className={cx({
          active: reactiveSettings.wrapPlayheads,
          inactive: !reactiveSettings.wrapPlayheads,
        })}
      />
      <GoogleIconButton
        icon="bug_report"
        title="Report a bug"
        onClick={() => {
          openUrl(
            "https://github.com/whisperdoll/acheron/issues/new?assignees=&labels=bug&template=1-Bug_report.md"
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
            "https://github.com/whisperdoll/acheron/wiki/Acheron-Documentation"
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
              "gitHash"
            )}`}
            target="_blank"
          >
            {env("gitHash")}
          </a>
        )}
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
              composition
            );
            state.set(deserialized);
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
          icon={"touch_app"}
          title={`Change touch mode`}
          onClick={() =>
            state.set((s) => ({
              ...s,
              gui: {
                ...s.gui,
                isShowingTouchModeMenu: !s.gui.isShowingTouchModeMenu,
              },
            }))
          }
          {...iconProps}
          data-touch-mode-menu="1"
        />
      </div>
    </div>
      {state.gui.isShowingTouchModeMenu && <TouchModeMenu />}
  );
});
