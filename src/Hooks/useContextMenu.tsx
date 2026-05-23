import React, {
  Dispatch,
  forwardRef,
  ReactElement,
  ReactNode,
  SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./useContextMenu.scss";
import {
  cx,
  Expand,
  MaybeGenerated,
  MaybeGeneratedPromise,
  resolveMaybeGenerated,
  resolveMaybeGeneratedPromise,
} from "../lib/utils";
import Point from "../utils/point";

export interface ContextMenuOption {
  contents: ReactNode;
  handler?: (e: PointerEvent) => any;
}

export interface ContextMenu {
  items: (ContextMenuOption | ContextMenu)[];
}

export type ContextMenuItem = ContextMenuOption | ContextMenu | { type: "separator" };

export const SeparatorItem: ContextMenuItem = { type: "separator" };

function ContextMenuItemElement(props: ContextMenuItem) {
  const isSubmenu = "items" in props;
  const isSeparator = "type" in props;

  if (isSubmenu) {
    return (
      <div className="context-menu-item has-children">
        {props.items.map(ContextMenuItemElement)}
      </div>
    );
  } else if (isSeparator) {
    return <div className="context-menu-separator"></div>;
  } else {
    return (
      <div
        onClick={(e) => props.handler && props.handler(e.nativeEvent as PointerEvent)}
        className={cx("context-menu-item", { "has-handler": !!props.handler })}
      >
        {props.contents}
      </div>
    );
  }
}

interface ContextMenuElementProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  isShowing: boolean;
  setIsShowing: Dispatch<SetStateAction<boolean>>;
  offset: MaybeGenerated<{ x: number; y: number }, [DOMRect]>;
}
const ContextMenuElement = React.memo(
  forwardRef<HTMLDivElement, ContextMenuElementProps>((props, ref) => {
    const {
      items,
      position,
      isShowing,
      setIsShowing,
      offset: unresolvedDisplayOffset,
    } = props;
    const offset = useRef({ x: 0, y: 0 });
    const size = useRef<{
      width: number | undefined;
      height: number | undefined;
    }>({ width: undefined, height: undefined });

    const updatePosition = useCallback(() => {
      if (!ref || !("current" in ref) || !ref.current) return;

      // console.log("--");

      const bounds = ref.current.getBoundingClientRect();
      const boundsI: DOMRect = {
        height: bounds.height,
        width: bounds.width,
        x: bounds.y,
        y: bounds.x,
        left: bounds.top,
        top: bounds.left,
        bottom: bounds.x + bounds.height,
        right: bounds.y + bounds.width,
        toJSON: () => ({
          height: bounds.height,
          width: bounds.width,
          x: bounds.y,
          y: bounds.x,
          left: bounds.top,
          top: bounds.left,
          bottom: bounds.x + bounds.height,
          right: bounds.y + bounds.width,
        }),
      };
      const documentBounds = document.body.getBoundingClientRect();
      const displayOffset = resolveMaybeGenerated(unresolvedDisplayOffset, bounds);
      const displayOffsetI: { x: number; y: number } =
        typeof unresolvedDisplayOffset === "function"
          ? Point.fromPointLike(unresolvedDisplayOffset(boundsI)).swapped.toJSON()
          : {
              x: unresolvedDisplayOffset.y,
              y: unresolvedDisplayOffset.x,
            };
      resolveMaybeGenerated(unresolvedDisplayOffset, boundsI);
      const newOffset = { ...displayOffset };
      const newSize = { ...size.current };

      (
        [
          {
            x: "x",
            y: "y",
            width: "width",
            height: "height",
            right: "right",
            bottom: "bottom",
          },
          {
            x: "y",
            y: "x",
            width: "height",
            height: "width",
            right: "bottom",
            bottom: "right",
          },
        ] as const
      ).forEach(({ x, y, width, height, right, bottom }) => {
        if (position[x] + displayOffset[x] < 0) {
          // console.log("resize", { x }, "too far up");
          newOffset[x] = -displayOffset[x];
        } else if (position[x] + displayOffset[x] + bounds[width] > documentBounds[width]) {
          // console.log("resize", { x }, "too far down");

          const otherSideX = position[x] - bounds[width] - displayOffset[x];
          if (otherSideX >= 0) {
            // console.log(">", "other side");

            if (
              position[x] + (-bounds[width] - displayOffset[x]) + bounds[width] <=
              documentBounds[width]
            ) {
              newOffset[x] = -bounds[width] - displayOffset[x];
            } else {
              const overflow =
                position[x] + bounds[width] + displayOffset[x] - documentBounds[width];

              newOffset[x] = displayOffset[x] - overflow;
            }
          } else {
            const currentTop = position[y] + displayOffset[y];
            const currentBottom = currentTop + bounds[height];
            const tryBottom = position[y] - displayOffsetI[y];
            const tryTop = position[y] + displayOffsetI[y];

            newOffset[x] = -position[x];

            if (tryBottom - bounds[height] >= 0) {
              // console.log("on top");
              newOffset[y] = currentTop - currentBottom - displayOffsetI[y];
            } else {
              // console.log("on bottom");
              newOffset[y] = displayOffsetI[y];
            }
          }
        } else {
          // newOffset[x] = displayOffset[x];
        }

        if (bounds[width] > documentBounds[width]) {
          // console.log("resize", { x }, "too big");
          newSize[width] = documentBounds[width];
          newOffset[x] = -displayOffset[x];
        } else {
          newSize[width] = undefined;
        }
      });

      offset.current = newOffset;
      size.current = newSize;

      ref.current.style.opacity = isShowing ? "1" : "0";
      ref.current.style.pointerEvents = isShowing ? "" : "none";
      ref.current.style.left = `${position.x + offset.current.x}px`;
      ref.current.style.top = `${position.y + offset.current.y}px`;
      ref.current.style.width =
        size.current.width === undefined ? "" : `${size.current.width}px`;
      ref.current.style.height =
        size.current.height === undefined ? "" : `${size.current.height}px`;
    }, [position.x, position.y, isShowing]);

    useLayoutEffect(() => {
      if (!ref || !("current" in ref) || !ref.current) return;

      const observer = new ResizeObserver((entries, observer) => {
        updatePosition();
      });

      observer.observe(ref.current);

      updatePosition();

      return () => observer.disconnect();
    }, [updatePosition]);

    return (
      <div ref={ref} className="context-menu">
        {items.map((item, i) => (
          <ContextMenuItemElement
            {...item}
            handler={
              "handler" in item && item.handler
                ? (e) => {
                    item.handler!(e);
                    setIsShowing(false);
                  }
                : undefined
            }
            key={`${JSON.stringify(item)}-${i}`}
          />
        ))}
      </div>
    );
  }),
);

type TriggerOpts = {
  position?: { x: number; y: number };
};

type ReturnType = [
  React.JSX.Element, // node
  (e: MouseEvent | TouchEvent | PointerEvent, opts?: TriggerOpts) => Promise<void>, // trigger
  (opts?: TriggerOpts) => void, // update
  boolean, // is showing
  React.Dispatch<React.SetStateAction<boolean>>, // set is showing
];

type MenuType = MaybeGeneratedPromise<
  ContextMenuItem[],
  [
    {
      hide: () => void;
      setPosition: React.Dispatch<
        React.SetStateAction<{
          x: number;
          y: number;
        }>
      >;
      isShowing: boolean;
    },
  ]
>;

type Opts = { offset?: MaybeGenerated<{ x: number; y: number }, [DOMRect]> };

export default function useContextMenu(
  menu: MenuType,
  opts: Opts,
  dependencyArray?: any[],
): ReturnType;
export default function useContextMenu(menu: MenuType, dependencyArray?: any[]): ReturnType;
export default function useContextMenu(
  menu: MenuType,
  optsOrDependencyArray?: Opts | any[],
  dependencyArray?: any[],
): ReturnType {
  const passedOpts = optsOrDependencyArray && !Array.isArray(optsOrDependencyArray);
  const opts: Required<Opts> = useMemo(
    () =>
      passedOpts
        ? {
            ...optsOrDependencyArray,
            offset: optsOrDependencyArray.offset || { x: 0, y: 0 },
          }
        : {
            offset: { x: 0, y: 0 },
          },
    [optsOrDependencyArray],
  );
  const dependencyArrayResolved: any[] | undefined = passedOpts
    ? dependencyArray
    : optsOrDependencyArray;
  const [isShowing, setIsShowing] = useState(false);
  const hide = useCallback(() => setIsShowing(false), [setIsShowing]);
  const ref = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<ContextMenuItem[]>([]);
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const triggeringEvent = useRef<MouseEvent | TouchEvent | PointerEvent | null>(null);
  const triggeringOpts = useRef<TriggerOpts | undefined>(undefined);

  useEffect(() => {
    function onDocumentClick(e: MouseEvent | TouchEvent | PointerEvent) {
      if (!(e.target instanceof Element)) return;
      if (!ref.current) return;

      if (e.target instanceof Element && ref.current.contains(e.target)) {
        e.stopPropagation();
        return;
      }

      hide();
    }

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("touchstart", onDocumentClick);

    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("touchstart", onDocumentClick);
    };
  }, [setIsShowing]);

  const trigger = useCallback(
    async (e: MouseEvent | TouchEvent | PointerEvent, opts?: TriggerOpts) => {
      triggeringEvent.current = e;
      triggeringOpts.current = opts;
      const items = await resolveMaybeGeneratedPromise(menu, {
        hide,
        setPosition,
        isShowing,
      });
      const pos =
        opts?.position ||
        (e instanceof TouchEvent
          ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
          : { x: e.clientX, y: e.clientY });
      setPosition(pos);
      setItems(items);
      setIsShowing(true);
    },
    [ref, setIsShowing, menu],
  );

  const refresh = useCallback(() => {
    if (!triggeringEvent.current) return;
    if (!isShowing) return;

    trigger(triggeringEvent.current, triggeringOpts.current);
  }, [trigger]);

  useEffect(() => {
    refresh();
  }, dependencyArrayResolved);

  const menuNode = (
    <ContextMenuElement
      ref={ref}
      {...{ items, position, isShowing, setIsShowing }}
      offset={opts.offset}
    />
  );

  return [menuNode, trigger, refresh, isShowing, setIsShowing] as const;
}
