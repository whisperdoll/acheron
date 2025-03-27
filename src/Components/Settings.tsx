import React, { useContext, useEffect } from "react";
import state from "../state/AppState";
import settings, { AppSettings } from "../state/AppSettings";
import List from "../lib/list";
import TokenManager from "./TokenManager";
import { keyboardShortcutString } from "../lib/keyboard";
import { camelCaseToSentence } from "../lib/utils";
import KeyboardShortcutInput from "./KeyboardShortcutInput";

interface Props {
  onHide: () => any;
}

export default function Settings(props: Props) {
  const reactiveState = state.useState();
  const reactiveSettings = settings.useState();

  function handleCheckChanged(
    e: React.ChangeEvent<HTMLInputElement>,
    property: keyof AppSettings
  ) {
    settings.set(
      (settings) => ({
        ...settings,
        [property]: e.currentTarget.checked,
      }),
      `setting ${property} setting`
    );
  }

  function handleOutputToggled(
    e: React.ChangeEvent<HTMLInputElement>,
    outputName: string
  ) {
    if (reactiveSettings.midiOutputs.includes(outputName)) {
      settings.set(
        { midiOutputs: List.without(reactiveSettings.midiOutputs, outputName) },
        "toggling midi output off"
      );
    } else if (!reactiveSettings.midiOutputs.includes(outputName)) {
      settings.set(
        { midiOutputs: reactiveSettings.midiOutputs.concat([outputName]) },
        "toggling midi output on"
      );
    }
  }

  function handleInputToggled(
    e: React.ChangeEvent<HTMLInputElement>,
    inputName: string
  ) {
    if (reactiveSettings.midiInputs.includes(inputName)) {
      settings.set(
        { midiInputs: List.without(reactiveSettings.midiInputs, inputName) },
        "toggling midi input off"
      );
    } else if (!reactiveSettings.midiInputs.includes(inputName)) {
      settings.set(
        { midiInputs: reactiveSettings.midiInputs.concat([inputName]) },
        "toggling midi input on"
      );
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        props.onHide();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="settings-backdrop" onClick={() => props.onHide()}>
      <div className="settings-content" onClick={(e) => e.stopPropagation()}>
        <h1>Settings</h1>
        <label className="clicky">
          <input
            type="checkbox"
            checked={reactiveSettings.playNoteOnClick}
            onChange={(e) => handleCheckChanged(e, "playNoteOnClick")}
          ></input>
          <span>Play notes on click</span>
        </label>
        <label className="clicky">
          <input
            type="checkbox"
            checked={reactiveSettings.wrapPlayheads}
            onChange={(e) => handleCheckChanged(e, "wrapPlayheads")}
          ></input>
          <span>Wrap playheads</span>
        </label>
        <label className="clicky">
          <input
            type="checkbox"
            checked={reactiveSettings.confirmDelete}
            onChange={(e) => handleCheckChanged(e, "confirmDelete")}
          ></input>
          <span>Show confirmation prompts when removing things</span>
        </label>
        <h2>MIDI</h2>
        <div className="midiSelects">
          <div className="midiSelect">
            <div>MIDI Inputs:</div>
            {reactiveState.allowedInputs.map((input) => (
              <label className="clicky" key={input.name}>
                <input
                  type="checkbox"
                  checked={reactiveSettings.midiInputs.includes(input.name)}
                  onChange={(e) => handleInputToggled(e, input.name)}
                />
                <span>{input.name}</span>
              </label>
            ))}
          </div>
          <div className="midiSelect">
            <div>MIDI Outputs:</div>
            {reactiveState.allowedOutputs.map((output) => (
              <label className="clicky" key={output.name}>
                <input
                  type="checkbox"
                  checked={reactiveSettings.midiOutputs.includes(output.name)}
                  onChange={(e) => handleOutputToggled(e, output.name)}
                />
                <span>{output.name}</span>
              </label>
            ))}
          </div>
        </div>
        <TokenManager onHide={props.onHide} />
        <h2>Keyboard Shortcuts</h2>
        <div className="keyboardShortcuts">
          {Object.entries(reactiveSettings.keyboardShortcuts).map(
            ([key, shortcut]) => {
              return (
                <div key={key} className="keyboardShortcut row">
                  <div>{camelCaseToSentence(key)}</div>
                  <KeyboardShortcutInput
                    shortcut={shortcut}
                    onChange={(newShortcut) =>
                      settings.set(
                        (s) => ({
                          ...s,
                          keyboardShortcuts: {
                            ...s.keyboardShortcuts,
                            [key]: (newShortcut && newShortcut) || { key: "" },
                          },
                        }),
                        `set keyboard shortcut for ${key}`
                      )
                    }
                  />
                </div>
              );
            }
          )}
        </div>
        <div className="bottomButtons">
          <button onClick={() => props.onHide()}>OK</button>
        </div>
      </div>
    </div>
  );
}
