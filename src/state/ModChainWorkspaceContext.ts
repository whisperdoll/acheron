import React from "react";
import { ControlChangeMessageEvent } from "webmidi";
import appStateStore from "./AppState";
import { ControlInstanceId } from "../Types";
import { MaybeGenerated } from "../lib/utils";

export interface IModChainWorkspaceContextProps {
  modChainId: string;
  connectingOutput?: string; // modChainItem ID
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
}

export interface IModChainWorkspaceContext
  extends IModChainWorkspaceContextProps {
  set: (
    props: MaybeGenerated<
      Partial<IModChainWorkspaceContextProps>,
      [IModChainWorkspaceContextProps]
    >
  ) => unknown;
}

export const ModChainWorkspaceContext =
  React.createContext<IModChainWorkspaceContext>({
    modChainId: "",
    set: () => ({}),
  });
