import React, { useState } from "react";
import { ModalConfig, modalStateStore } from "../state/ModalState";
import Modal from "./Modal";

function PromptModal({ modal }: { modal: ModalConfig & { type: "prompt" } }) {
  const [value, setValue] = useState("");

  function cancel() {
    modal.onCancel && modal.onCancel();
    modalStateStore.remove(modal.id);
  }

  function confirm() {
    modal.onConfirm && modal.onConfirm(value);
    modalStateStore.remove(modal.id);
  }

  return (
    <Modal onHide={cancel} show>
      <h1 className="title">{modal.title}</h1>
      <span className="prompt">{modal.prompt}</span>
      <input
        className="input"
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
      ></input>
      <div className="bottomButtons">
        <button onClick={confirm}>{modal.confirmText}</button>
        <button onClick={cancel}>{modal.cancelText}</button>
      </div>
    </Modal>
  );
}

function ConfirmModal({ modal }: { modal: ModalConfig & { type: "confirm" } }) {
  function cancel() {
    modal.onCancel && modal.onCancel();
    modalStateStore.remove(modal.id);
  }

  function confirm() {
    modal.onConfirm && modal.onConfirm();
    modalStateStore.remove(modal.id);
  }

  return (
    <Modal onHide={cancel} show>
      <h1 className="title">{modal.title}</h1>
      <span className="prompt">{modal.prompt}</span>
      <div className="bottomButtons">
        <button onClick={confirm}>{modal.confirmText}</button>
        <button onClick={cancel}>{modal.cancelText}</button>
      </div>
    </Modal>
  );
}

const ModalController = () => {
  const modals = modalStateStore.useState((s) => s.modals);

  return (
    <>
      {modals.map((modal) =>
        modal.type === "confirm" ? (
          <ConfirmModal modal={modal} />
        ) : (
          <PromptModal modal={modal} />
        )
      )}
    </>
  );
};

export default React.memo(ModalController);
