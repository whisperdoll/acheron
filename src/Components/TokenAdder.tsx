import { useContext, useState } from "react";
import { faBan, faPlus } from "@fortawesome/free-solid-svg-icons";
import IconButton from "./IconButton";
import state from "../state/AppState";
import settings from "../state/AppSettings";

export default function TokenAdder() {
  const reactiveState = state.useState();
  const reactiveSettings = settings.useState();
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
      <IconButton
        onClick={toggleTokens}
        className={"addButton " + (isShowingTokens ? "expanded" : "collapsed")}
        icon={isShowingTokens ? faBan : faPlus}
      >
        {isShowingTokens ? "Cancel Adding Token" : "Add Token"}
      </IconButton>
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
