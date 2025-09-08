import Control from "./Control";
import settings from "../state/AppSettings";
import GoogleIconButton from "./GoogleIconButton";
import { cx } from "../lib/utils";
import state from "../state/AppState";

interface Props {
  tokenId: string;
  onRemove: () => any;
  isCollapsed: boolean;
  onToggleCollapse: () => any;
  layerIndex: number;
  showHeader?: boolean;
  collapsible?: boolean;
}

export default function (props: Props) {
  const showHeader = props.showHeader ?? true;
  const collapsible = props.collapsible ?? true;

  const token = state.useState((s) => s.tokens[props.tokenId]);
  const controls = state.useState((s) => s.controls);
  const layers = state.useState((s) => s.layers);

  return (
    <div className="tokenControl">
      {showHeader && (
        <div
          className={cx("header", { collapsible })}
          onClick={() => props.onToggleCollapse()}
        >
          <span className="noselect">
            {collapsible ? (props.isCollapsed ? "▸ " : "▾ ") : ""}
            {token.label}
          </span>
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
          const ret = (
            <Control
              controlId={controlId}
              key={controlId}
              layerIndex={props.layerIndex}
            />
          );

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
                state.getControlValue(token.controlIds[index], {
                  layer: layers[props.layerIndex],
                  controls: controls,
                })
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
