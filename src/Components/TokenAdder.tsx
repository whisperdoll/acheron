import { useContext, useState } from "react";
import GoogleIconButton from "./GoogleIconButton";
import { addTokenToSelected, AppContext } from "../state/AppState";

export default function TokenAdder() {
  const { state, setState } = useContext(AppContext)!;

  const [isShowingTokens, setIsShowingTokens] = useState(false);

  if (state.selectedHex.hexIndex === -1) return <></>;

  function toggleTokens() {
    setIsShowingTokens(!isShowingTokens);
  }

  function addToken(tokenKey: string) {
    addTokenToSelected(setState, tokenKey, "add token from inspector");
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
          {Object.entries(state.tokenDefinitions).map(([key, definition]) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
