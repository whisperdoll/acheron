import React from "react";
import state from "../state/AppState";
import GoogleIconButton from "./GoogleIconButton";
import { Props as GoogleIconProps } from "./GoogleIcon";
import { openUrl } from "../utils/desktop";

interface Props {}

export default React.memo(function StatusBar(props: Props) {
  const reactiveState = state.useState((s) => ({
    isPlaying: s.isPlaying,
    currentBeat: Math.floor(s.layers[s.selectedHex.layerIndex].currentBeat),
  }));

  function showSettings() {}

  const iconProps: Pick<
    GoogleIconProps,
    "fill" | "buttonStyle" | "opticalSize"
  > = {
    fill: true,
    buttonStyle: "rounded",
    opticalSize: 20,
  };

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
        title={reactiveState.isPlaying ? "Stop" : "Play"}
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
        title="Settings"
        iconElementProps={{
          style: {
            transform: "scale(0.9)",
          },
        }}
        {...iconProps}
      />
      <GoogleIconButton
        icon="layers"
        title="Toggle MultiLayer Mode"
        onClick={() =>
          state.set(
            (s) => ({ isMultiLayerMode: !s.isMultiLayerMode }),
            "toggle multilayer mode"
          )
        }
        {...iconProps}
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
    </div>
  );
});
