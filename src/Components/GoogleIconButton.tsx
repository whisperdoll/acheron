import React from "react";
import GoogleIcon, { Props as GoogleIconProps } from "./GoogleIcon";
import { cx } from "../lib/utils";

interface Props {
  iconElementProps?: React.JSX.IntrinsicElements["span"];
  naked?: boolean;
}

const GoogleIconButton: React.FC<
  React.PropsWithChildren<GoogleIconProps & React.JSX.IntrinsicElements["button"] & Props>
> = React.memo(function GoogleIconButton(props) {
  const {
    icon,
    buttonStyle,
    size,
    fill,
    grade,
    opticalSize,
    weight,
    iconElementProps,
    className,
    naked,
    ...rest
  } = props;

  return (
    <button className={cx(className, "googleIconButton", { naked })} {...rest}>
      <GoogleIcon
        {...{
          icon,
          buttonStyle,
          size,
          fill,
          grade,
          opticalSize,
          weight,
          ...(iconElementProps || {}),
        }}
      />
      {props.children}
    </button>
  );
});

export default GoogleIconButton;
