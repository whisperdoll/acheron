import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { SizeProp } from "@fortawesome/fontawesome-svg-core";

interface Props {
  icon: IconDefinition;
  size?: SizeProp;
}

const IconButton: React.FC<
  React.PropsWithChildren<Props & React.JSX.IntrinsicElements["button"]>
> = React.memo(function IconButton(props) {
  const { className, icon, size, ...rest } = props;
  return (
    <button className={"iconButton " + (props.className ?? "")} {...rest}>
      <FontAwesomeIcon size={size || "sm"} icon={props.icon} />{" "}
      {props.children && <span>{props.children}</span>}
    </button>
  );
});

export default IconButton;
