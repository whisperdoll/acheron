import { transposeNote } from "./elysiumutils";
import { array_remove } from "./utils";

const { WebMidi } = require("../../node_modules/webmidi/dist/webmidi.esm");

export interface MidiDevice
{
    name: string;
    id: string;
}

export interface NoteOptions
{
    velocity: number;
    durationMs: number;
}

let noteOnListener: (e: any) => any;
let noteOffListener: (e: any) => any;

export default class Midi
{
    private static enabledOutputNames: string[] = [];
    private static enabledInputNames: string[] = [];
    private static notes: string[] = [];
    public static onOutputsChanged: null | ((outputs: MidiDevice[]) => any) = null;
    public static onInputsChanged: null | ((outputs: MidiDevice[]) => any) = null;
    public static onNotesChanged: null | ((notes: string[]) => any) = null;
    private static isEnabled = false;

    private static _noteOnListener(e: any)
    {
        if (!this.notes.includes(e.note.name))
        {
            this.notes.push(e.note.name);
        }

        this.onNotesChanged && this.onNotesChanged(this.notes.slice(0));
    }

    private static _noteOffListener(e: any)
    {
        if (array_remove(this.notes, e.note.name).existed)
        {
            this.onNotesChanged && this.onNotesChanged(this.notes.slice(0));
        }
    }

    public static setEnabledOutputs(names: string[])
    {
        this.enabledOutputNames = names;
        WebMidi.outputs.forEach((output: any) =>
        {
            if (!names.includes(output.name))
            {
                output.close();
            }
        });
    }

    private static attachNoteListeners(input: any)
    {
        if (!noteOnListener)
        {
            noteOnListener = this._noteOnListener.bind(this);
            noteOffListener = this._noteOffListener.bind(this);
        }

        if (!input.channels[1].hasListener("noteon", noteOnListener))
        {
            for (let i = 0; i < 16; i++)
            {
                input.channels[i + 1].addListener("noteon", noteOnListener);
                input.channels[i + 1].addListener("noteoff", noteOffListener);
            }
        }
    }

    public static setEnabledInputs(names: string[])
    {
        this.enabledInputNames = names;
        WebMidi.inputs.forEach((input: any) =>
        {
            if (!names.includes(input.name))
            {
                input.close();
            }
            else
            {
                this.attachNoteListeners(input);
            }
        });
    }

    private static broadcastDevices()
    {
        if (this.onOutputsChanged)
        {
            this.onOutputsChanged(WebMidi.outputs.map((output: any) =>
            {
                return {
                    name: output.name,
                    id: output.id
                };
            }));
        }
        if (this.onInputsChanged)
        {
            this.onInputsChanged(WebMidi.inputs.map((input: any) =>
            {
                return {
                    name: input.name,
                    id: input.id
                };
            }));
        }
    }

    public static init()
    {
        if (this.isEnabled) return;

        this.isEnabled = true;
        WebMidi.enable();

        WebMidi.addListener("connected", (e: any) =>
        {
            if (e.target.type === "output")
            {
                if (!this.enabledOutputNames.includes(e.target.name))
                {
                    e.target.close();
                }

            }
            else // input
            {
                if (!this.enabledInputNames.includes(e.target.name))
                {
                    e.target.close();
                }
                else
                {
                    this.attachNoteListeners(e.target);
                }
            }

            this.broadcastDevices();
        });

        WebMidi.addListener("disconnected", (e: any) =>
        {
            this.broadcastDevices();
        });

        WebMidi.addListener("enabled", () =>
        {
            this.broadcastDevices();
        });
    }

    public static playNotes(notes: string[], outputNames: string[], channel: number, options: NoteOptions)
    {
        notes = notes.map(note => transposeNote(note, -12));
        outputNames.forEach((outputName) =>
        {
            const midiOutput = WebMidi.getOutputByName(outputName);

            if (midiOutput)
            {
                midiOutput.channels[channel].playNote(notes, {
                    duration: options.durationMs,
                    attack: options.velocity / 127
                });
            }
        });
    }
}