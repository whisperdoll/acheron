import {
  ControlDataType,
  ControlState,
  getControlValue,
  TypeForControlDataType,
} from "../Types";
import {
  LayerControlKey,
  PlayerControlKey,
  PlayerControlKeys,
} from "../utils/DefaultDefinitions";
import { sliceObject } from "../utils/utils";
import { AppState, LayerState } from "./AppState";
import SimpleStateStore from "./SimpleStateStore";

export default class SimpleAppState extends SimpleStateStore<AppState> {
  get currentLayer(): LayerState {
    return this.values.layers[this.values.selectedHex.layerIndex];
  }

  get playerControls() {
    return sliceObject(this.values, PlayerControlKeys);
  }

  layerControl<T extends ControlDataType = ControlDataType>(
    control: LayerControlKey,
    layer: number | "current" = "current"
  ): ControlState<T> {
    return (
      layer === "current"
        ? (this.values.controls[this.currentLayer[control]] as ControlState<T>)
        : this.values.controls[this.values.layers[layer][control]]
    ) as ControlState<T>;
  }

  playerControl<T extends ControlDataType = ControlDataType>(
    control: PlayerControlKey
  ): ControlState<T> {
    return this.values.controls[this.values[control]] as ControlState<T>;
  }

  getControlValue<T extends ControlDataType = ControlDataType>(
    control:
      | ControlState<T>
      | string
      | {
          layerControl: LayerControlKey;
          layer: LayerState | number | "current";
        }
      | { layerControl: LayerControlKey }
      | { playerControl: PlayerControlKey },
    opts:
      | {
          currentBeat: number | "current";
          currentTimeMs: number | "current";
          controls: AppState["controls"] | "current";
          playerControls: Pick<AppState, PlayerControlKey> | "current";
          layer: LayerState | number | "current";
        }
      | {
          layer: LayerState;
          controls: AppState["controls"];
        } = {
      controls: "current",
      currentBeat: "current",
      currentTimeMs: "current",
      playerControls: "current",
      layer: "current",
    }
  ): TypeForControlDataType<T> {
    const resolveLayer = (
      layer: LayerState | number | "current" | undefined
    ) => {
      return typeof layer === "number"
        ? this.values.layers[layer]
        : layer === "current" || layer === undefined
        ? this.values.layers[this.values.selectedHex.layerIndex]
        : layer;
    };

    const resolvedLayer =
      typeof control === "object" && "layer" in control
        ? resolveLayer(control.layer)
        : resolveLayer(opts.layer);

    const controls =
      opts.controls === "current" ? this.values.controls : opts.controls;

    const playerControls =
      "playerControls" in opts
        ? opts.playerControls === "current"
          ? this.playerControls
          : opts.playerControls
        : this.playerControls;

    const newOpts: Parameters<typeof getControlValue>[0] = {
      control:
        typeof control === "string"
          ? this.values.controls[control]
          : "layerControl" in control
          ? controls[resolvedLayer[control.layerControl]]
          : "playerControl" in control
          ? controls[playerControls[control.playerControl]]
          : control,
      layer: resolvedLayer,
      currentBeat:
        "currentBeat" in opts
          ? opts.currentBeat === "current"
            ? this.values.currentBeat
            : opts.currentBeat
          : resolvedLayer.currentBeat,
      currentTimeMs:
        "currentTimeMs" in opts
          ? opts.currentTimeMs === "current"
            ? resolvedLayer.currentTimeMs
            : opts.currentTimeMs
          : resolvedLayer.currentTimeMs,
      controls:
        opts.controls === "current" ? this.values.controls : opts.controls,
      playerControls,
    };
    return getControlValue(newOpts) as TypeForControlDataType<T>;
  }
}
