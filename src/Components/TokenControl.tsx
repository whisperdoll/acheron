import Control from "./Control";
import settings from "../state/AppSettings";
import GoogleIconButton from "./GoogleIconButton";
import { cx, isNullOrUndefined, mod } from "../lib/utils";
import state from "../state/AppState";
import List from "../lib/list";

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
  const showHeader = props.showHeader ?? true;
  const collapsible = props.collapsible ?? true;

  const token = state.useState((s) => s.tokens[props.tokenId]);
  const controls = state.useState((s) => s.controls);
  const layers = state.useState((s) => s.layers);

  function handleMoveToken(index: number, offset: number) {
    if (state.values.selectedHex.hexIndex === -1) return;

    const numTokens =
      state.values.layers[state.values.selectedHex.layerIndex].tokenIds[
        state.values.selectedHex.hexIndex
      ].length;
    const destinationIndex = mod(index + offset, numTokens);
    state.set(
      (s) => ({
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
              }
            ),
          })
        ),
      }),
      "move token"
    );
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
          if (control.showIf !== undefined) {
            const key = control.showIf.startsWith("!")
              ? control.showIf.substr(1)
              : control.showIf;
            const shouldNegate = control.showIf.startsWith("!");
            const index = token.controlIds.findIndex(
              (cid) => controls[cid].key === key
            );

            if (index !== -1) {
              const bool = Boolean(
                state.getControlValue(token.controlIds[index])
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
