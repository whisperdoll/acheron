import { PropsWithChildren, useEffect, useRef } from "react";

interface Props {}

export default function NonShrinking(
  props: PropsWithChildren<Props> & React.JSX.IntrinsicElements["div"],
) {
  const ref = useRef<HTMLDivElement>(null);
  const minWidth = useRef<number>(0);
  const minHeight = useRef<number>(0);

  const { ...rest } = props;
  const myAssumedStyle: Partial<CSSStyleDeclaration> = {
    display: "flex",
    justifyContent: "flex-end",
  };
  const myMandatoryStyle: Partial<CSSStyleDeclaration> = {
    boxSizing: "border-box",
  };

  useEffect(() => {
    if (!ref.current) return;

    Object.assign(ref.current.style, {
      ...myAssumedStyle,
      ...rest.style,
      ...myMandatoryStyle,
    });

    const observer = new ResizeObserver((entries) => {
      if (!ref.current) return;
      const entry = entries.find((e) => e.borderBoxSize);
      if (!entry) return;

      if (entry.borderBoxSize[0].inlineSize > minWidth.current) {
        ref.current.style.minWidth = `${(minWidth.current = entry.borderBoxSize[0].inlineSize)}px`;
      }
      if (entry.borderBoxSize[0].blockSize > minHeight.current) {
        ref.current.style.minHeight = `${(minHeight.current = entry.borderBoxSize[0].blockSize)}px`;
      }
    });

    observer.observe(ref.current);
  }, []);

  return <div ref={ref} {...rest} />;
}
