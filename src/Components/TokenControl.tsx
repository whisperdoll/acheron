import Control from "./Control";
import state from "../state/AppState";
import settings from "../state/AppSettings";
import GoogleIconButton from "./GoogleIconButton";

interface Props {
  tokenId: string;
  onRemove: () => any;
  isCollapsed: boolean;
  onToggleCollapse: () => any;
  layerIndex: number;
}

export default function (props: Props) {
  const reactiveState = state.useState();
  const reactiveSettings = settings.useState();

  const token = reactiveState.tokens[props.tokenId];

  return (
    <div className="tokenControl">
      <div className="header" onClick={() => props.onToggleCollapse()}>
        <span className="noselect">
          {props.isCollapsed ? "▸" : "▾"} {token.label}
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
      {!props.isCollapsed &&
        token.controlIds.map((controlId) => {
          const ret = (
            <Control
              controlId={controlId}
              key={controlId}
              layerIndex={props.layerIndex}
            />
          );

          const control = reactiveState.controls[controlId];
          if (control.showIf !== undefined) {
            const key = control.showIf.startsWith("!")
              ? control.showIf.substr(1)
              : control.showIf;
            const shouldNegate = control.showIf.startsWith("!");
            const index = token.controlIds.findIndex(
              (cid) => reactiveState.controls[cid].key === key
            );

            if (index !== -1) {
              const bool = Boolean(
                state.getControlValue(token.controlIds[index], {
                  layer: reactiveState.layers[props.layerIndex],
                  controls: reactiveState.controls,
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
