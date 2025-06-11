import { NoteMessageEvent, ControlChangeMessageEvent, WebMidi } from "webmidi";
import { transposeNote } from "./elysiumutils";
import { WebMidiInput, WebMidiPortEvent } from "../Types";
import List from "../lib/list";
import { MaybeGenerated, resolveMaybeGenerated } from "../lib/utils";

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
let controlchangeListener: (e: any) => any;

const allNotes = Array(128)
  .fill(0)
  .map((_, i) => i);
  

export var cCArr = [1];

export default class Midi {
  private static enabledOutputNames: string[] = [];
  private static enabledInputNames: string[] = [];
  private static notes: MidiNote[] = [];
  public static onOutputsChanged: null | ((outputs: MidiDevice[]) => void) =
    null;
  public static onInputsChanged: null | ((outputs: MidiDevice[]) => void) =
    null;
  public static onNotesChanged: null | ((notes: MidiNote[]) => void) = null;
  private static isEnabled = false;

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

    private static _controlchangeListener(e: any)
    {
		for (let i = 0; i < 127; i++) {
		if (cCArr[i] === undefined) {
		cCArr[i] = 1;
		}
		if (i === e.controller.number)
		cCArr[i] = e.rawValue;
		}
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
	  controlchangeListener = this._controlchangeListener.bind(this);
    }

    if (!input.channels[1].hasListener("noteon", noteOnListener)) {
      for (let i = 0; i < 16; i++) {
        input.channels[i + 1].addListener("noteon", noteOnListener);
        input.channels[i + 1].addListener("noteoff", noteOffListener);
		input.channels[i + 1].addListener("controlchange", controlchangeListener);
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
        })
      );
    }
    if (this.onInputsChanged) {
      this.onInputsChanged(
        WebMidi.inputs.map((input) => {
          return {
            name: input.name,
            id: input.id,
          };
        })
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
      List.wrap(resolveMaybeGenerated(note.deviceName)).forEach(
        (deviceName) => {
          const midiOutput = WebMidi.getOutputByName(deviceName);
          if (!midiOutput) return;

          midiOutput.channels[note.channel].sendNoteOn(note.note, {
            rawAttack: note.velocity,
            time: note.time,
          });
        }
      );
    });
  }

  public static noteOff(notes: NoteOffOptions | NoteOffOptions[]) {
    List.wrap(notes).forEach((note) => {
      List.wrap(resolveMaybeGenerated(note.deviceName)).forEach(
        (deviceName) => {
          const midiOutput = WebMidi.getOutputByName(deviceName);
          if (!midiOutput) return;

          midiOutput.channels[note.channel].sendNoteOff(note.note, {
            rawRelease: note.release,
            time: note.time,
          });
        }
      );
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

  public static scheduleNoteOff(
    note: NoteOffParams & { id: string; time: number }
  ) {
    const noteOn = this.queue.find(
      (n) => n.id === note.id && n.type === "noteOn"
    );
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
