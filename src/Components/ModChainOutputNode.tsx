import { useCallback, useContext } from "react";
import { ModChainWorkspaceContext } from "../state/ModChainWorkspaceContext";
import state from "../state/AppState";
import { ModOutput } from "../Types";
import { cx } from "../lib/utils";

interface Props {
  modItemId: string;
}

export default function ModChainOutputNode(props: Props) {
  const modChainWorkspaceContext = useContext(ModChainWorkspaceContext);
  const connected = state.useState((s) =>
    s.modChains[modChainWorkspaceContext.modChainId].connections.some(
      (c) => c.from === props.modItemId
    )
  );

  const handleMouseDown: React.PointerEventHandler<HTMLDivElement> =
    useCallback(
      (e) => {
        e.preventDefault();
        modChainWorkspaceContext.set({ connectingOutput: props.modItemId });

        const onMouseUp = (mouseUpEvent: PointerEvent) => {
          mouseUpEvent.preventDefault();
          document.removeEventListener("pointerup", onMouseUp);
          modChainWorkspaceContext.set({ connectingOutput: undefined });

          const target = mouseUpEvent.target;
          if (!(target instanceof HTMLElement)) return;

          // if direct to output
          if (target.parentElement?.dataset.modChainOutput) {
            state.connectModItems(
              modChainWorkspaceContext.modChainId,
              props.modItemId,
              ModOutput
            );

            return;
          }

          // elseif to a node
          const modChainInputNodeId = target.dataset.modChainInputNodeId;
          const modChainInputNodeProperty =
            target.dataset.modChainInputNodeProperty;

          if (!modChainInputNodeId || !modChainInputNodeProperty) return;

          state.connectModItems(
            modChainWorkspaceContext.modChainId,
            props.modItemId,
            modChainInputNodeId,
            modChainInputNodeProperty
          );
        };

        document.addEventListener("pointerup", onMouseUp);
      },
      [modChainWorkspaceContext.set]
    );

  return (
    <div
      className={cx("modChainOutputNode", { connected })}
      onPointerDown={handleMouseDown}
      data-mod-chain-output-node={props.modItemId}
    ></div>
  );
}
