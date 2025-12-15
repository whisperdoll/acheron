import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ModChainWorkspaceContext } from "../state/ModChainWorkspaceContext";
import ModChainWorkspaceWire from "./ModChainWorkspaceWire";
import state from "../state/AppState";
import { sliceObject } from "../utils/utils";

interface Props {}

export default function ModChainWorkspaceWires(props: Props) {
  const parentElement = useMemo(() => {
    return document.querySelector(".modChainWorkspace");
  }, []);
  const modChainWorkspaceContext = useContext(ModChainWorkspaceContext);
  const modChain = state.useState(
    (s) => s.modChains[modChainWorkspaceContext.modChainId]
  );
  const [mousePosition, setMousePosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const documentBounds = modChainWorkspaceContext.containerBounds;

  useEffect(() => {
    const onMouseMove = (e: PointerEvent) => {
      if (documentBounds) {
        setMousePosition({
          x: e.clientX,
          y: e.clientY,
        });
      }
    };

    document.body.addEventListener("pointermove", onMouseMove);

    return () => {
      document.body.removeEventListener("pointermove", onMouseMove);
    };
  }, [modChainWorkspaceContext.connectingOutput]);

  return (
    <div className="modChainWorkspaceWires">
      <svg
        viewBox={`0 0 ${documentBounds?.width ?? 0} ${
          documentBounds?.height ?? 0
        }`}
        stroke="red"
        strokeWidth={2}
        fill="transparent"
      >
        {modChainWorkspaceContext.connectingOutput && (
          <ModChainWorkspaceWire
            from={modChainWorkspaceContext.connectingOutput}
            to={mousePosition}
          />
        )}
        {modChain.output && (
          <ModChainWorkspaceWire from={modChain.output} toOutput />
        )}
        {modChain.connections.map((connection) => {
          return (
            <ModChainWorkspaceWire
              key={`${connection.from}__${connection.to}__${connection.property}`}
              from={connection.from}
              toId={connection.to}
              toProperty={connection.property}
            />
          );
        })}
      </svg>
    </div>
  );
}
