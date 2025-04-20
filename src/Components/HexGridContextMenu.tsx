import React, { ReactNode, useEffect, useLayoutEffect, useState } from "react";
import settings from "../state/AppSettings";
import { Token, TokenStore, TokenUID } from "../Types";
import TokenControl from "./TokenControl";
import { confirmPrompt } from "../utils/desktop";
import { camelCaseToSentence, capitalize } from "../lib/utils";
import GoogleIconButton from "./GoogleIconButton";
import { useAppStore } from "../state/AppState";
import { tokenDefinitionsMap } from "../Tokens";

interface Props {
  onHide: () => void;
}

export default function HexGridContextMenu({ onHide: hide }: Props) {
  const state = useAppStore();
  const layerIndex = state.gui.hexGrid.selectedHexes.layerIndex;
  const tokenIds = state.gui.hexGrid.selectedHexes.hexIndexes.length
    ? state.simulation.layers[state.gui.hexGrid.selectedHexes.layerIndex]
        .tokenIds[state.gui.hexGrid.selectedHexes.hexIndexes[0]]
    : [];
  const stateTokens = state.simulation.tokenInstances;
  const stateControls = state.simulation.controlInstances;
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const selectedToken =
    selectedTokenId === null ? null : stateTokens[selectedTokenId];

  async function handleRemove(tokenId: string) {
    if (
      !settings.values.confirmDelete ||
      (await confirmPrompt(
        `Are you sure you want to delete the ${state.simulation.tokenInstances[tokenId].label} token?`,
        "Confirm remove token"
      ))
    ) {
      state.removeToken(tokenId);
      setSelectedTokenId(null);
    }
  }

  useEffect(() => {
    if (selectedTokenId && tokenIds.includes(selectedTokenId)) return;

    setSelectedTokenId(null);
  }, [tokenIds]);

  function description(token: Token) {
    const controls = token.controlIds.map((id) => stateControls[id]);
    const defs = token.controls;

    // const diffs = controls.map((control) => {
    //   const def = Object.entries(defs).find(
    //     ([key, def]) => key === control.key
    //   )![1];
    //   const ret: ReactNode[] = [];
    //   const value = state.getControlValue(control);
    //   if (def.inherit && control.currentValueType !== "inherit") {
    //     switch (control.currentValueType) {
    //       case "add":
    //         // TODO
    //         // ret.inherit = `Value: ${control.inherit!} + ${control.}`;
    //         break;
    //       case "multiply":
    //         // TODO
    //         break;
    //       case "fixed":
    //         ret.push(`Value: ${value} (fixed)`);
    //         break;
    //       case "modulate":
    //         ret.push(
    //           `Value: ${
    //             typeof value === "number" ? Math.round(value) : value
    //           } (${control.lfo.type} LFO)`
    //         );
    //     }
    //   }
    // });

    return controls.map((control) => {
      let value = state.getControlValue(control);
      if (typeof value === "number") {
        value = Math.round(value * 100) / 100;
      }

      return (
        <div key={control.key}>
          {control.label}: {value} (
          {camelCaseToSentence(control.currentValueType)})
        </div>
      );
    });
  }

  return (
    <div className="hexGridContextMenuContents">
      {!selectedToken ? (
        <>
          <div className="addSection">
            <div className="title">Add Token</div>
            <div className="addTokenRow">
              {Object.entries(tokenDefinitionsMap).map(([uid, tokenDef]) => {
                return (
                  <button
                    key={uid}
                    className="mono addToken"
                    title={tokenDef.label}
                    onClick={() => {
                      state.addTokenToSelected(uid);
                    }}
                  >
                    {tokenDef.symbol}
                  </button>
                );
              })}
            </div>
          </div>
          {!!tokenIds.length && (
            <>
              <div className="context-menu-separator"></div>
              <div className="modifySection">
                {/* {tokenIds.map((tokenId, i) => (
            <TokenControl
              tokenId={tokenId}
              onRemove={() => handleRemove(i)}
              key={tokenId}
              layerIndex={layerIndex}
              isCollapsed={false}
              onToggleCollapse={() => {}}
            />
          ))} */}
                {tokenIds.map((tokenId, i) => {
                  const token = stateTokens[tokenId];
                  return (
                    <div
                      key={tokenId}
                      className="tokenSelect button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTokenId(tokenId);
                      }}
                    >
                      <span className="title">
                        <span className="mono">{token.symbol}</span>{" "}
                        {token.label}
                        <GoogleIconButton
                          buttonStyle="rounded"
                          icon="delete"
                          fill
                          opticalSize={20}
                          title="Delete token"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(tokenId);
                          }}
                          className="nostyle remove"
                        />
                      </span>
                      <span className="description">{description(token)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="selectedTokenContents">
            <div className="title">
              <GoogleIconButton
                icon="arrow_back"
                buttonStyle="rounded"
                fill
                className="nostyle"
                title="Back"
                onClick={() => setSelectedTokenId(null)}
              />
              {selectedToken.label}
              <GoogleIconButton
                buttonStyle="rounded"
                icon="delete"
                fill
                opticalSize={20}
                title="Delete token"
                onClick={(e) => {
                  handleRemove(selectedToken.id);
                }}
                className="nostyle remove"
              />
            </div>
            <TokenControl
              tokenId={selectedToken.id}
              onRemove={() => handleRemove(selectedToken.id)}
              layerIndex={layerIndex}
              isCollapsed={false}
              onToggleCollapse={() => {}}
              collapsible={false}
              showHeader={false}
            />
          </div>
        </>
      )}
    </div>
  );
}
