import { useState } from "react";
import state from "../state/AppState";
import GoogleIconButton from "./GoogleIconButton";

export default function TokenAdder() {
  const reactiveState = state.useState();
  const [isShowingTokens, setIsShowingTokens] = useState(false);

  if (reactiveState.selectedHex.hexIndex === -1) return <></>;

  function toggleTokens() {
    setIsShowingTokens(!isShowingTokens);
  }

  function addToken(tokenKey: string) {
    state.addTokenToSelected(tokenKey, "add token from inspector");
  }

  return (
    <div className="tokenAdder">
      <GoogleIconButton
        onClick={toggleTokens}
        className={"addButton " + (isShowingTokens ? "expanded" : "collapsed")}
        icon={isShowingTokens ? "cancel" : "add"}
        buttonStyle="rounded"
        fill
      >
        {isShowingTokens ? "Cancel Adding Token" : "Add Token"}
      </GoogleIconButton>
      {isShowingTokens && (
        <div className="tokenAdderList">
          {Object.entries(reactiveState.tokenDefinitions).map(
            ([key, definition]) => (
              <button
                className="tokenAdderButton"
                onClick={() => {
                  addToken(key);
                  setIsShowingTokens(false);
                }}
                key={key}
              >
                {"Add " + definition.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
