import React from "react";
import { ControlChangeMessageEvent } from "webmidi";
import { ControlInstanceId } from "../Types";
import { MaybeGenerated } from "../lib/utils";

export interface IModChainWorkspaceContextProps {
  connectingOutput?: { modItemId: string; outputKey: string };
  containerRef?: React.RefObject<HTMLDivElement | null>;
  containerBounds?: {
    width: number;
    height: number;
    top: number;
    left: number;
    scrollWidth: number;
    scrollHeight: number;
    scrollLeft: number;
    scrollTop: number;
  };
  offset: { x: number; y: number };
  zoom: number;
}

export interface IModChainWorkspaceContext extends IModChainWorkspaceContextProps {
  set: (
    props: MaybeGenerated<
      Partial<IModChainWorkspaceContextProps>,
      [IModChainWorkspaceContextProps]
    >,
  ) => unknown;
}

export const ModChainWorkspaceContext = React.createContext<IModChainWorkspaceContext>({
  set: () => ({}),
  offset: { x: 0, y: 0 },
  zoom: 1,
});
