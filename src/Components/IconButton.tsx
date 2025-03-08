import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/free-solid-svg-icons";

interface Props {
  icon: IconDefinition;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
}

const IconButton: React.FC<React.PropsWithChildren<Props>> = (props) => {
  return (
    <button
      className={"iconButton " + (props.className ?? "")}
      onClick={props.onClick}
    >
      <FontAwesomeIcon size="sm" icon={props.icon} />{" "}
      <span>{props.children}</span>
    </button>
  );
};

export default IconButton;
