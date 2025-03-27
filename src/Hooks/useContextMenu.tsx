import React, {
  Dispatch,
  forwardRef,
  ReactElement,
  ReactNode,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./useContextMenu.scss";
import {
  cx,
  MaybeGeneratedPromise,
  resolveMaybeGeneratedPromise,
} from "../lib/utils";

export interface ContextMenuOption {
  contents: ReactNode;
  handler?: (e: PointerEvent) => any;
}

export interface ContextMenu {
  items: (ContextMenuOption | ContextMenu)[];
}

export type ContextMenuItem =
  | ContextMenuOption
  | ContextMenu
  | { type: "separator" };

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
        onClick={(e) =>
          props.handler && props.handler(e.nativeEvent as PointerEvent)
        }
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
}
const ContextMenuElement = React.memo(
  forwardRef<HTMLDivElement, ContextMenuElementProps>((props, ref) => {
    const { items, position, isShowing, setIsShowing } = props;

    return (
      <div
        ref={ref}
        className="context-menu"
        style={{
          opacity: isShowing ? 1 : 0,
          pointerEvents: isShowing ? undefined : "none",
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        {items.map((item) => (
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
            key={JSON.stringify(item)}
          />
        ))}
      </div>
    );
  })
);

export default function useContextMenu(
  menu: MaybeGeneratedPromise<ContextMenuItem[], []>,
  dependencyArray: any[] = []
) {
  const [isShowing, setIsShowing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<ContextMenuItem[]>([]);
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        e.target instanceof Element &&
        e.target.className.includes("context-menu")
      ) {
        e.stopPropagation();
        return;
      }

      setIsShowing(false);
    }

    document.addEventListener("click", onClick);

    return () => document.removeEventListener("click", onClick);
  }, [setIsShowing]);

  const trigger = useCallback(
    async (e: MouseEvent) => {
      const items = await resolveMaybeGeneratedPromise(menu);
      setPosition({ x: e.clientX, y: e.clientY });
      setItems(items);
      setIsShowing(true);
    },
    [ref, setIsShowing, menu]
  );

  const refresh = useCallback(() => {
    if (!isShowing) return;

    (async () => {
      const items: ContextMenuItem[] = (
        await resolveMaybeGeneratedPromise(menu)
      ).map((item) => {
        const isSubmenu = "items" in item;
        const isSeparator = "type" in item;
        const isOption = !isSubmenu && !isSeparator;

        if (isOption) {
          return {
            ...item,
            handler(e) {
              if (item.handler) {
                item.handler(e);
              }

              setIsShowing(false);
            },
          };
        } else {
          return item;
        }
      });
      setItems(items);
    })();
  }, [menu, setItems, isShowing, setIsShowing]);

  useEffect(() => {
    refresh();
  }, dependencyArray);

  const menuNode = (
    <ContextMenuElement
      ref={ref}
      {...{ items, position, isShowing, setIsShowing }}
    />
  );

  return [menuNode, trigger, refresh, isShowing, setIsShowing] as const;
}
