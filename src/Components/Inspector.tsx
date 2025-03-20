import { useContext, useEffect, useRef, useState } from "react";
import { hexNotes } from "../utils/elysiumutils";
import TokenAdder from "../Components/TokenAdder";
import TokenControl from "./TokenControl";

import state from "../state/AppState";
import settings from "../state/AppSettings";
import GoogleIconButton from "./GoogleIconButton";
import GoogleIcon from "./GoogleIcon";
import { confirmPrompt } from "../utils/desktop";

interface Props {
  layerIndex: number;
}

export default function (props: Props) {
  const reactiveState = state.useState();
  const reactiveSettings = settings.useState();
  const [toggledToken, setToggledToken] = useState("");
  const oldTokenIds = useRef<string[]>([]);

  const tokenIds =
    reactiveState.layers[props.layerIndex].tokenIds[
      reactiveState.selectedHex.hexIndex
    ];

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
      state.removeTokenFromSelected(
        tokenIds[tokenIndex],
        "remove token from inspector"
      );
    }
  }

  useEffect(() => {
    if (reactiveState.selectedHex.hexIndex === -1 || tokenIds.length === 0)
      return;

    setToggledToken(tokenIds[0]);
    oldTokenIds.current = tokenIds;
  }, [reactiveState.selectedHex, props.layerIndex]);

  useEffect(() => {
    if (reactiveState.selectedHex.hexIndex === -1 || tokenIds.length === 0)
      return;

    if (
      !tokenIds.includes(toggledToken) ||
      tokenIds.length > oldTokenIds.current.length
    ) {
      setToggledToken(tokenIds[tokenIds.length - 1]);
    }

    oldTokenIds.current = tokenIds;
  }, [reactiveState.tokens]);

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
        />
      </div>
      {reactiveState.selectedHex.hexIndex === -1 ? (
        <div className="selectedHexLabel">No hex selected.</div>
      ) : (
        <>
          <div className="selectedHexLabel">
            Selected: {hexNotes[reactiveState.selectedHex.hexIndex]}
          </div>
          <TokenAdder />
          <div className="tokens">
            {tokenIds.map((tokenId, i) => (
              <TokenControl
                tokenId={tokenId}
                onRemove={() => handleRemove(i)}
                key={tokenId}
                layerIndex={props.layerIndex}
                isCollapsed={tokenId !== toggledToken}
                onToggleCollapse={() =>
                  toggledToken === tokenId
                    ? setToggledToken("")
                    : setToggledToken(tokenId)
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
