import { randomUUID } from "crypto";
import React, { PropsWithChildren, useState } from "react";
import { modalStateStore, ModalStateStore } from "../state/ModalState";
import { cx } from "../lib/utils";

interface Props {
  backdropProps?: React.JSX.IntrinsicElements["div"];
  contentProps?: React.JSX.IntrinsicElements["div"];
  show: boolean;
  onHide: () => void;
}

const Modal = ({
  backdropProps,
  contentProps,
  children,
  show,
  onHide,
}: PropsWithChildren<Props>) => {
  return (
    <div
      className={cx("modal-backdrop", { hide: !show })}
      {...(backdropProps || {})}
      onClick={() => onHide()}
    >
      <div
        className="modal-content"
        {...(contentProps || {})}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default React.memo(Modal);
