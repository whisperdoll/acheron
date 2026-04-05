import { useCallback, useContext } from "react";
import { ModChainWorkspaceContext } from "../state/ModChainWorkspaceContext";
import { cx } from "../lib/utils";
import { AppContext } from "../state/AppState";

interface Props {
  modItemId: string;
  property: string;
}

export default function ModChainInputNode(props: Props) {
  const { state, setState } = useContext(AppContext)!;

  const modChainWorkspaceContext = useContext(ModChainWorkspaceContext);
  const connected = state.modChains[
    modChainWorkspaceContext.modChainId
  ].connections.some(
    (c) => c.to === props.modItemId && c.property === props.property,
  );

  return (
    <div
      className={cx("modChainInputNode", { connected })}
      data-mod-chain-input-node-id={props.modItemId}
      data-mod-chain-input-node-property={props.property}
    ></div>
  );
}
