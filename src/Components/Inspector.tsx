import { useContext, useEffect, useMemo, useRef, useState } from "react";
import TokenAdder from "../Components/TokenAdder";
import TokenControl from "./TokenControl";

import state from "../state/AppState";
import settings from "../state/AppSettings";
import GoogleIconButton from "./GoogleIconButton";
import GoogleIcon from "./GoogleIcon";
import { confirmPrompt } from "../utils/desktop";
import useKeyboardShortcutStrings from "../Hooks/useKeyboardShortcutStrings";
import { generateGridNotes } from "../utils/elysiumutils";
import List from "../lib/list";

interface Props {
  layerIndex: number;
}

export default function (props: Props) {
  const reactiveState = state.useState();
  const reactiveSettings = settings.useState();
  const [collapsedTokens, setCollapsedTokens] = useState<string[]>([]);
  const keyboardShortcutStrings = useKeyboardShortcutStrings();
  const layerIndex =
    reactiveState.selectedHex.layerIndex !== -1
      ? reactiveState.selectedHex.layerIndex
      : props.layerIndex;

  const tokenIds =
    reactiveState.layers[layerIndex].tokenIds[
      reactiveState.selectedHex.hexIndex
    ];

  const hexNotes = useMemo(() => {
    return generateGridNotes(
      reactiveState.gridStartingNote,
      reactiveState.gridRows,
      reactiveState.gridCols
    );
  }, [
    reactiveState.gridStartingNote,
    reactiveState.gridRows,
    reactiveState.gridCols,
  ]);

  async function handleRemove(tokenIndex: number) {
    if (
      !reactiveSettings.confirmDelete ||
      (await confirmPrompt(
        `Are you sure you want to delete the ${
          reactiveState.tokens[tokenIds[tokenIndex]].label
        } token?`,
        "Confirm remove token"
      ))
    ) {
      state.removeToken(tokenIds[tokenIndex], "remove token from inspector");
    }
  }

  return (
    <div className="inspector">
      <div className="mainHeader">
        <GoogleIcon
          icon="frame_inspect"
          buttonStyle="rounded"
          fill
          opticalSize={20}
        />
        <span className="label">Inspector</span>
        <GoogleIconButton
          className="pin"
          icon="keep_off"
          buttonStyle="rounded"
          fill
          onClick={() =>
            state.set(
              (s) => ({ isShowingInspector: !s.isShowingInspector }),
              "toggle showing inspector"
            )
          }
          opticalSize={20}
          title={`Unpin Inspector (${keyboardShortcutStrings.toggleShowInspector})`}
        />
      </div>
      {reactiveState.selectedHex.hexIndex === -1 ? (
        <div className="selectedHexLabel">No hex selected.</div>
      ) : (
        <>
          <div className="headerSection">
            <div className="selectedHexLabel">
              Selected: L{layerIndex + 1}H
              {reactiveState.selectedHex.hexIndex + 1} (
              {hexNotes[reactiveState.selectedHex.hexIndex]})
            </div>
            <TokenAdder />
          </div>
          <div className="tokens">
            {tokenIds.map((tokenId, i) => (
              <TokenControl
                i={i}
                tokenId={tokenId}
                onRemove={() => handleRemove(i)}
                key={tokenId}
                layerIndex={layerIndex}
                isCollapsed={collapsedTokens.includes(tokenId)}
                onToggleCollapse={() => {
                  if (collapsedTokens.includes(tokenId)) {
                    setCollapsedTokens(List.without(collapsedTokens, tokenId));
                  } else {
                    setCollapsedTokens(collapsedTokens.concat([tokenId]));
                  }
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
