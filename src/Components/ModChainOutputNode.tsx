import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { ModChainWorkspaceContext } from "../state/ModChainWorkspaceContext";
import { ModOutput } from "../Types";
import { cx, formatNumberSmall, preventDefault } from "../lib/utils";
import { AppContext, connectModItems, resolveModItem } from "../state/AppState";
import useNow from "../Hooks/useNow";
import NonShrinking from "./NonShrinking";
import useEventListener from "../Hooks/useEventListener";

interface Props {
  modItemId: string;
  outputKey: string;
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
      state.modChainControl!,
      props.modItemId,
      props.outputKey,
    );
    return formatNumberSmall(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.modItemId, state.modChains, now, props.value, props.outputKey]);
  const ref = useRef<HTMLDivElement>(null);

  const setModChainWorkspaceContext = modChainWorkspaceContext.set;
  const handleMouseDown: React.PointerEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      e.preventDefault();
      setModChainWorkspaceContext({
        connectingOutput: { modItemId: props.modItemId, outputKey: props.outputKey },
      });
    },
    [setModChainWorkspaceContext, props.modItemId, props.outputKey],
  );

  // if (props.outputKey !== "output") {
  //   console.log(props.modItemId, state.modChains[state.modChainControl!].connections);
  // }

  useEventListener(ref, "touchstart", preventDefault);

  return (
    <div className="row">
      {value !== null && <NonShrinking style={{ whiteSpace: "nowrap" }}>{value}</NonShrinking>}
      <div
        className={cx("modChainOutputNode", { connected })}
        onPointerDown={handleMouseDown}
        ref={ref}
        data-mod-chain-output-node={`${props.modItemId}-${props.outputKey}`}
      ></div>
    </div>
  );
}
