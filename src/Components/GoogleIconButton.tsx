import React from "react";
import GoogleIcon, { Props as GoogleIconProps } from "./GoogleIcon";

interface Props {
  iconElementProps?: React.JSX.IntrinsicElements["span"];
}

const GoogleIconButton: React.FC<
  React.PropsWithChildren<
    GoogleIconProps & React.JSX.IntrinsicElements["button"] & Props
  >
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
    ...rest
  } = props;

  return (
    <button {...rest}>
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
