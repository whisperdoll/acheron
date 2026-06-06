import { PropsWithChildren, useEffect, useMemo, useRef } from "react";

export default function NonShrinking(
  props: PropsWithChildren & React.JSX.IntrinsicElements["div"],
) {
  const ref = useRef<HTMLDivElement>(null);
  const minWidth = useRef<number>(0);
  const minHeight = useRef<number>(0);

  const { ...rest } = props;
  const myAssumedStyle: Partial<CSSStyleDeclaration> = useMemo(
    () => ({
      display: "flex",
      justifyContent: "flex-end",
    }),
    [],
  );
  const myMandatoryStyle: Partial<CSSStyleDeclaration> = useMemo(
    () => ({
      boxSizing: "border-box",
    }),
    [],
  );

  useEffect(() => {
    if (!ref.current) return;

    Object.assign(ref.current.style, {
      ...myAssumedStyle,
      ...rest.style,
      ...myMandatoryStyle,
    });
  }, [myAssumedStyle, myMandatoryStyle, rest.style]);

  useEffect(() => {
    if (!ref.current) return;

    const currentRef = ref.current;

    const observer = new ResizeObserver((entries) => {
      const entry = entries.find((e) => e.borderBoxSize);
      if (!entry) return;

      if (entry.borderBoxSize[0].inlineSize > minWidth.current) {
        currentRef.style.minWidth = `${(minWidth.current = entry.borderBoxSize[0].inlineSize)}px`;
      }
      if (entry.borderBoxSize[0].blockSize > minHeight.current) {
        currentRef.style.minHeight = `${(minHeight.current = entry.borderBoxSize[0].blockSize)}px`;
      }
    });

    observer.observe(currentRef);

    return () => {
      observer.unobserve(currentRef);
    };
  }, []);

  return <div ref={ref} {...rest} />;
}
