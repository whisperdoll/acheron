import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { ModChainWorkspaceContext } from "../state/ModChainWorkspaceContext";
import { ModOutput } from "../Types";
import { cx, formatNumberSmall, preventDefault } from "../lib/utils";
import { AppContext, connectModItems, resolveModItem } from "../state/AppState";
import useNow from "../Hooks/useNow";
import NonShrinking from "./NonShrinking";

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
  }, [props.modItemId, state.modChains, now, props.value]);
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseDown: React.PointerEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      e.preventDefault();
      modChainWorkspaceContext.set({
        connectingOutput: { modItemId: props.modItemId, outputKey: props.outputKey },
      });
    },
    [modChainWorkspaceContext.set, props.modItemId, props.outputKey],
  );

  // if (props.outputKey !== "output") {
  //   console.log(props.modItemId, state.modChains[state.modChainControl!].connections);
  // }

  useEffect(() => {
    ref.current?.addEventListener("touchstart", preventDefault);

    return () => {
      ref.current?.removeEventListener("touchstart", preventDefault);
    };
  }, []);

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
