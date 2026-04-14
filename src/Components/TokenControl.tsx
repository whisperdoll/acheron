import Control from "./Control";
import settings from "../state/AppSettings";
import GoogleIconButton from "./GoogleIconButton";
import { cx, isNullOrUndefined, mod } from "../lib/utils";
import List from "../lib/list";
import { useContext } from "react";
import { AppContext, getControlValue } from "../state/AppState";

interface Props {
  tokenId: string;
  onRemove: () => any;
  isCollapsed: boolean;
  onToggleCollapse: () => any;
  layerIndex: number;
  showHeader?: boolean;
  collapsible?: boolean;
  i?: number;
}

export default function (props: Props) {
  const { state, setState } = useContext(AppContext)!;

  const showHeader = props.showHeader ?? true;
  const collapsible = props.collapsible ?? true;

  const token = state.tokens[props.tokenId];
  const controls = state.controls;
  const layers = state.layers;

  function handleMoveToken(index: number, offset: number) {
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
    <div className="tokenControl">
      {showHeader && (
        <div
          className={cx("header", { collapsible })}
          onClick={() => props.onToggleCollapse()}
        >
          <span className="noselect grow">
            {collapsible ? (props.isCollapsed ? "▸ " : "▾ ") : ""}
            <span>{token.label}</span>
          </span>
          {props.i !== undefined && (
            <>
              <GoogleIconButton
                buttonStyle="rounded"
                icon="arrow_upward"
                fill
                opticalSize={20}
                title="Delete token"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveToken(props.i!, -1);
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
                  handleMoveToken(props.i!, 1);
                }}
                className="nostyle remove"
              />
            </>
          )}
          <GoogleIconButton
            buttonStyle="rounded"
            icon="close"
            fill
            opticalSize={20}
            title="Remove Layer"
            onClick={(e) => {
              e.stopPropagation();
              props.onRemove();
            }}
            className="nostyle remove"
          />
        </div>
      )}
      {!props.isCollapsed &&
        token.controlIds.map((controlId) => {
          const ret = <Control controlId={controlId} key={controlId} />;

          const control = controls[controlId];
          if (control.definition.showIf !== undefined) {
            const key = control.definition.showIf.startsWith("!")
              ? control.definition.showIf.substr(1)
              : control.definition.showIf;
            const shouldNegate = control.definition.showIf.startsWith("!");
            const index = token.controlIds.findIndex(
              (cid) => controls[cid].key === key,
            );

            if (index !== -1) {
              const bool = Boolean(
                getControlValue(state, token.controlIds[index]),
              );
              return bool !== shouldNegate ? ret : undefined;
            } else {
              return undefined;
            }
          } else {
            return ret;
          }
        })}
    </div>
  );
}
