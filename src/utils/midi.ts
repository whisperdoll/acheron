import { ControlChangeMessageEvent, NoteMessageEvent, WebMidi } from "webmidi";
import { transposeNote } from "./elysiumutils";
import { WebMidiInput, WebMidiPortEvent } from "../Types";
import List from "../lib/list";
import { clamp, MaybeGenerated, resolveMaybeGenerated } from "../lib/utils";
import * as wm from "webmidi";
import { decodeMidiCc, detectRelativeMode, MidiCcMode } from "./ccClassifier";

export interface MidiDevice {
  name: string;
  id: string;
}

export interface NoteOnOptions {
  note: string;
  velocity?: number;
  time?: string | number;
  channel: number;
  deviceName: MaybeGenerated<string | string[]>;
}

interface NoteOffParams {
  release?: number;
}

export interface NoteOffOptions extends NoteOffParams {
  note: string;
  time?: string | number;
  channel: number;
  deviceName: MaybeGenerated<string | string[]>;
}

export interface MidiNote {
  name: string;
  number: number;
  velocity: number;
  release: number;
  isOn: boolean;
}

let noteOnListener: (e: NoteMessageEvent) => void;
let noteOffListener: (e: NoteMessageEvent) => void;
let ccListener: (e: ControlChangeMessageEvent) => void;

const allNotes = Array(128)
  .fill(0)
  .map((_, i) => i);

export default class Midi {
  private static enabledOutputNames: string[] = [];
  private static enabledInputNames: string[] = [];
  private static notes: MidiNote[] = [];
  public static onOutputsChanged: null | ((outputs: MidiDevice[]) => void) = null;
  public static onInputsChanged: null | ((outputs: MidiDevice[]) => void) = null;
  public static onNotesChanged: null | ((notes: MidiNote[]) => void) = null;
  public static onCC: (({ number, value }: { number: number; value: number }) => void)[] = [];
  private static isEnabled = false;
  private static ccValues: number[] = Array(128).fill(0); // 0-127
  private static ccModes: { values: number[]; mode: MidiCcMode }[] = List.fromGenerator(
    () => ({ values: [], mode: "unknown" }),
    128,
  );

  private static _noteOnListener(e: NoteMessageEvent) {
    const index = this.notes.findIndex((n) => n.name === e.note.name);
    if (index === -1) {
      this.notes.push({
        name: e.note.name,
        number: e.note.number,
        velocity: e.note.rawAttack,
        isOn: true,
        release: 0,
      });
    } else {
      this.notes[index] = {
        name: e.note.name,
        number: e.note.number,
        velocity: e.note.rawAttack,
        isOn: true,
        release: 0,
      };
    }

    this.onNotesChanged && this.onNotesChanged(this.notes.slice(0));
  }

  private static _noteOffListener(e: NoteMessageEvent) {
    const index = this.notes.findIndex((n) => n.name === e.note.name);

    if (index !== -1) {
      this.notes[index] = {
        ...this.notes[index],
        isOn: false,
        release: e.note.rawRelease,
      };
      this.onNotesChanged && this.onNotesChanged(this.notes.slice(0));
    }
  }

  private static _CCListener(e: ControlChangeMessageEvent) {
    let value = e.rawValue || 0;
    const existingValue = this.ccValues[e.controller.number];
    const ccMode = this.ccModes[e.controller.number];

    if (ccMode.mode === "unknown") {
      ccMode.values.push(value);
      ccMode.mode = detectRelativeMode(ccMode.values);
    }

    switch (ccMode.mode) {
      case "unknown": // if it's still unknown
        return;
      case "absolute":
        value = value; // nuf said
        break;
      case "binaryOffset":
      case "signMagnitude":
      case "twosComplement":
        // TODO: settings on this behavior (clamp vs wrap)
        value = clamp(existingValue + decodeMidiCc(value, ccMode.mode), 0, 127);
        break;
    }

    this.ccValues[e.controller.number] = value;
    this.onCC.forEach((fn) => {
      fn({ number: e.controller.number, value });
    });
  }

  public static ccValue(ccNumber: number) {
    return this.ccValues[ccNumber];
  }

  public static setEnabledOutputs(names: string[]) {
    this.enabledOutputNames = names;
    WebMidi.outputs.forEach((output) => {
      if (!names.includes(output.name)) {
        output.close();
      }
    });
  }

  private static attachNoteListeners(input: WebMidiInput) {
    if (!noteOnListener) {
      noteOnListener = this._noteOnListener.bind(this);
      noteOffListener = this._noteOffListener.bind(this);
      ccListener = this._CCListener.bind(this);
    }

    if (!input.channels[1].hasListener("noteon", noteOnListener)) {
      for (let i = 0; i < 16; i++) {
        input.channels[i + 1].addListener("noteon", noteOnListener);
        input.channels[i + 1].addListener("noteoff", noteOffListener);
        input.channels[i + 1].addListener("controlchange", ccListener);
      }
    }
  }

  public static setEnabledInputs(names: string[]) {
    this.enabledInputNames = names;
    WebMidi.inputs.forEach((input) => {
      if (!names.includes(input.name)) {
        input.close();
      } else {
        input.open().then(() => {
          this.attachNoteListeners(input as WebMidiInput);
        });
      }
    });
  }

  private static broadcastDevices() {
    if (this.onOutputsChanged) {
      this.onOutputsChanged(
        WebMidi.outputs.map((output) => {
          return {
            name: output.name,
            id: output.id,
          };
        }),
      );
    }
    if (this.onInputsChanged) {
      this.onInputsChanged(
        WebMidi.inputs.map((input) => {
          return {
            name: input.name,
            id: input.id,
          };
        }),
      );
    }
  }

  public static init() {
    if (this.isEnabled) return;

    this.isEnabled = true;
    WebMidi.enable();

    WebMidi.addListener("connected", (e: WebMidiPortEvent) => {
      if (e.port.type === "output") {
        if (!this.enabledOutputNames.includes(e.port.name)) {
          e.port.close();
        }
      } else {
        if (!this.enabledInputNames.includes(e.port.name)) {
          e.port.close();
        } else {
          this.attachNoteListeners(e.port);
        }
      }

      this.broadcastDevices();
    });

    WebMidi.addListener("disconnected", (e: WebMidiPortEvent) => {
      this.broadcastDevices();
    });

    WebMidi.addListener("enabled", () => {
      this.broadcastDevices();
    });
  }

  public static noteOn(notes: NoteOnOptions | NoteOnOptions[]) {
    List.wrap(notes).forEach((note) => {
      List.wrap(resolveMaybeGenerated(note.deviceName)).forEach((deviceName) => {
        const midiOutput = WebMidi.getOutputByName(deviceName);
        if (!midiOutput) return;

        try {
          midiOutput.channels[note.channel].sendNoteOn(note.note, {
            rawAttack: note.velocity,
            time: note.time,
          });
        } catch (e) {
          // bad note
        }
      });
    });
  }

  public static noteOff(notes: NoteOffOptions | NoteOffOptions[]) {
    List.wrap(notes).forEach((note) => {
      List.wrap(resolveMaybeGenerated(note.deviceName)).forEach((deviceName) => {
        const midiOutput = WebMidi.getOutputByName(deviceName);
        if (!midiOutput) return;

        midiOutput.channels[note.channel].sendNoteOff(note.note, {
          rawRelease: note.release,
          time: note.time,
        });
      });
    });
  }

  public static allNotesOff() {
    WebMidi.outputs.forEach((output) => {
      output.sendNoteOff(allNotes);
    });
  }
}

interface ScheduledNoteOn extends NoteOnOptions {
  time: number;
  bufferedToDevice: boolean;
  type: "noteOn";
  id: string;
}

interface BufferedNoteOn extends ScheduledNoteOn {
  bufferedToDevice: true;
}

interface ScheduledNoteOff extends NoteOffOptions {
  time: number;
  bufferedToDevice: boolean;
  type: "noteOff";
  id: string;
}

type ScheduledNote = ScheduledNoteOn | ScheduledNoteOff;

function isBufferedNoteOn(n: ScheduledNote): n is BufferedNoteOn {
  return n.type === "noteOn" && n.bufferedToDevice;
}

export class MidiScheduler {
  private static queue: ScheduledNote[] = [];
  public static bufferedUntil: number | null = null;
  private static idCounter = 0;

  private static generateId(): string {
    const ret = this.idCounter.toString();
    this.idCounter++;
    return ret;
  }

  public static scheduleNoteOn(note: NoteOnOptions & { time: number }): string {
    const id = this.generateId();
    this.queue.push({
      ...note,
      id,
      type: "noteOn",
      bufferedToDevice: false,
    });

    return id;
  }

  public static scheduleNoteOff(note: NoteOffParams & { id: string; time: number }) {
    const noteOn = this.queue.find((n) => n.id === note.id && n.type === "noteOn");
    if (!noteOn) {
      throw new Error("scheduled noteOff for non-existing noteOn");
    }

    this.queue.push({
      ...noteOn,
      ...note,
      type: "noteOff",
      bufferedToDevice: false,
    });
  }

  // returns noteOns that are buffered to the device
  public static clear(): BufferedNoteOn[] {
    const hangingNoteOns = this.queue.filter(isBufferedNoteOn);

    this.queue = [];
    return hangingNoteOns;
  }

  // find notes that are scheduled to play soon and buffer them to devices
  public static bufferUpcomingNotesToDevice(thresholdMs: number) {
    const now = performance.now();

    this.queue.forEach((note) => {
      if (note.bufferedToDevice || note.time - now > thresholdMs) return;

      switch (note.type) {
        case "noteOn":
          Midi.noteOn(note);
          break;
        case "noteOff":
          Midi.noteOff(note);
          break;
      }
      note.bufferedToDevice = true;
      if (!this.bufferedUntil || note.time > this.bufferedUntil) {
        this.bufferedUntil = note.time;
      }
    });
  }

  // public static clean() {
  //   // schedule noteoffs for any buffered noteons without a corresponding buffered noteoff
  //   const [noteOns, noteOffs] = List.partition(
  //     this.queue,
  //     (n) => n.type === "noteOn"
  //   );
  //   noteOns.forEach((noteOn) => {
  //     if (noteOn.bufferedToDevice) return;

  //     const noteOffIsBuffered = noteOffs.some(
  //       (noteOff) =>
  //         noteOff.note === noteOn.note &&
  //         noteOff.bufferedToDevice &&
  //         noteOff.time > noteOn.time
  //     );

  //     if (noteOffIsBuffered) return;

  //     Midi.noteOff({
  //       ...noteOn,
  //       time: noteOn.time + 1,
  //     });
  //   });
  // }
}
