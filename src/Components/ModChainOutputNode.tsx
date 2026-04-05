import { useCallback, useContext } from "react";
import { ModChainWorkspaceContext } from "../state/ModChainWorkspaceContext";
import { ModOutput } from "../Types";
import { cx } from "../lib/utils";
import { AppContext, connectModItems } from "../state/AppState";

interface Props {
  modItemId: string;
}

export default function ModChainOutputNode(props: Props) {
  const { state, setState } = useContext(AppContext)!;
  const modChainWorkspaceContext = useContext(ModChainWorkspaceContext);
  const connected = state.modChains[
    modChainWorkspaceContext.modChainId
  ].connections.some((c) => c.from === props.modItemId);

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
            connectModItems(
              setState,
              modChainWorkspaceContext.modChainId,
              props.modItemId,
              ModOutput,
            );

            return;
          }

          // elseif to a node
          const modChainInputNodeId = target.dataset.modChainInputNodeId;
          const modChainInputNodeProperty =
            target.dataset.modChainInputNodeProperty;

          if (!modChainInputNodeId || !modChainInputNodeProperty) return;

          connectModItems(
            setState,
            modChainWorkspaceContext.modChainId,
            props.modItemId,
            modChainInputNodeId,
            modChainInputNodeProperty,
          );
        };

        document.addEventListener("pointerup", onMouseUp);
      },
      [modChainWorkspaceContext.set],
    );

  return (
    <div
      className={cx("modChainOutputNode", { connected })}
      onPointerDown={handleMouseDown}
      data-mod-chain-output-node={props.modItemId}
    ></div>
  );
}
