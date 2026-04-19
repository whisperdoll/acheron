import { useCallback, useContext, useMemo } from "react";
import { ModChainWorkspaceContext } from "../state/ModChainWorkspaceContext";
import { ModOutput } from "../Types";
import { cx, formatNumberSmall } from "../lib/utils";
import { AppContext, connectModItems, resolveModItem } from "../state/AppState";
import useNow from "../Hooks/useNow";
import NonShrinking from "./NonShrinking";

interface Props {
  modItemId: string;
  value?: number | null;
}

export default function ModChainOutputNode(props: Props) {
  const { state, setState } = useContext(AppContext)!;
  const modChainWorkspaceContext = useContext(ModChainWorkspaceContext);
  const connected = state.modChains[state.modChainControl!].connections.some(
    (c) => c.from === props.modItemId,
  );
  const now = useNow();
  const value = useMemo(() => {
    if (props.value === null) return null;
    if (props.value !== undefined) return formatNumberSmall(props.value);

    const resolved = resolveModItem(
      state,
      state.modChains[state.modChainControl!],
      props.modItemId,
    );
    return formatNumberSmall(resolved);
  }, [props.modItemId, state.modChains, now, props.value]);

  const handleMouseDown: React.PointerEventHandler<HTMLDivElement> = useCallback(
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
          connectModItems(setState, state.modChainControl!, props.modItemId, ModOutput);

          return;
        }

        // elseif to a node
        const modChainInputNodeId = target.dataset.modChainInputNodeId;
        const modChainInputNodeProperty = target.dataset.modChainInputNodeProperty;

        if (!modChainInputNodeId || !modChainInputNodeProperty) return;

        connectModItems(
          setState,
          state.modChainControl!,
          props.modItemId,
          modChainInputNodeId,
          modChainInputNodeProperty,
        );
      };

      document.addEventListener("pointerup", onMouseUp);
    },
    [modChainWorkspaceContext.set, state.modChainControl],
  );

  return (
    <div className="row">
      {value !== null && <NonShrinking style={{ whiteSpace: "nowrap" }}>{value}</NonShrinking>}
      <div
        className={cx("modChainOutputNode", { connected })}
        onPointerDown={handleMouseDown}
        data-mod-chain-output-node={props.modItemId}
      ></div>
    </div>
  );
}
