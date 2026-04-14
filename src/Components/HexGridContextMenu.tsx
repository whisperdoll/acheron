import React, {
  ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import settings from "../state/AppSettings";
import { Token, TokenStore, TokenUID } from "../Types";
import TokenControl from "./TokenControl";
import { confirmPrompt } from "../utils/desktop";
import { camelCaseToSentence, capitalize, mod } from "../lib/utils";
import GoogleIconButton from "./GoogleIconButton";
import { tokenDefinitionsMap } from "../Tokens";
import List from "../lib/list";
import {
  addTokenToSelected,
  AppContext,
  getControlValue,
  removeToken,
} from "../state/AppState";

interface Props {
  onHide: () => void;
}

export default function HexGridContextMenu({ onHide: hide }: Props) {
  const { state, setState } = useContext(AppContext)!;
  const layerIndex = state.selectedHex.layerIndex;
  const tokenIds = useMemo(
    () =>
      state.selectedHex.hexIndex !== -1
        ? state.layers[state.selectedHex.layerIndex].tokenIds[
            state.selectedHex.hexIndex
          ]
        : [],
    [state.selectedHex, state.layers[layerIndex]],
  );
  const stateTokens = state.tokens;
  const stateControls = state.controls;
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const selectedToken =
    selectedTokenId === null ? null : stateTokens[selectedTokenId];

  async function handleRemove(tokenId: string) {
    if (
      !settings.values.confirmDelete ||
      (await confirmPrompt(
        `Are you sure you want to delete the ${state.tokens[tokenId].label} token?`,
        "Confirm remove token",
      ))
    ) {
      removeToken(setState, tokenId, "remove token via context menu");
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
      let value = getControlValue(state, control);
      if (typeof value === "number") {
        value = Math.round(value * 100) / 100;
      } else if (typeof value === "boolean") {
        value = value ? "True" : "False";
      }

      return (
        <div key={control.key}>
          {control.definition.label}: {value}
        </div>
      );
    });
  }

  function moveToken(index: number, offset: number) {
    if (state.selectedHex.hexIndex === -1) return;

    const numTokens =
      state.layers[state.selectedHex.layerIndex].tokenIds[
        state.selectedHex.hexIndex
      ].length;
    const destinationIndex = mod(index + offset, numTokens);
    setState((s) => ({
      ...s,
      layers: List.withIndexReplaced(
        s.layers,
        s.selectedHex.layerIndex,
        (layer) => ({
          ...layer,
          tokenIds: List.withIndexReplaced(
            layer.tokenIds,
            s.selectedHex.hexIndex,
            (oldTokenIds) => {
              const newTokenIds = List.copy(oldTokenIds);
              const [toBeMoved] = newTokenIds.splice(index, 1);
              // console.log(List.copy(newLayer.tokenIds));
              // console.log(`${toBeMoved} -> ${destinationIndex}`);
              newTokenIds.splice(destinationIndex, 0, toBeMoved);
              // console.log(List.copy(newLayer.tokenIds));
              return newTokenIds;
            },
          ),
        }),
      ),
    }));
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
                      addTokenToSelected(
                        setState,
                        uid,
                        "add token via context menu",
                      );
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
                        <span className="fill">{token.label}</span>
                        <GoogleIconButton
                          buttonStyle="rounded"
                          icon="arrow_upward"
                          fill
                          opticalSize={20}
                          title="Delete token"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveToken(i, -1);
                          }}
                          className="nostyle remove"
                        />
                        <GoogleIconButton
                          buttonStyle="rounded"
                          icon="arrow_downward"
                          fill
                          opticalSize={20}
                          title="Delete token"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveToken(i, 1);
                          }}
                          className="nostyle remove"
                        />
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
