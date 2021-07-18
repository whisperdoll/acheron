import React, { useEffect, useRef, useState, FC } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconProp } from "@fortawesome/fontawesome-svg-core";

interface Props
{
    icon: IconProp;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    className?: string;
}

const IconButton: React.FC<Props> = (props) =>
{
    return (
        <button className={"iconButton " + (props.className ?? "")} onClick={props.onClick}>
            <FontAwesomeIcon size="sm" icon={props.icon} /> <span>{props.children}</span>
        </button>
    );
}

export default IconButton;