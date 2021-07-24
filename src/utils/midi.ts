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

export interface NoteOnOptions
{
    velocity: number;
}

export interface NoteOffOptions
{
    release: number;
}

export interface MidiNote
{
    name: string;
    number: number;
    velocity: number;
    release: number;
    isOn: boolean;
    playedAs: string;
}

let noteOnListener: (e: any) => any;
let noteOffListener: (e: any) => any;

const allNotes = Array(128).fill(0).map((_, i) => i);

export default class Midi
{
    private static enabledOutputNames: string[] = [];
    private static enabledInputNames: string[] = [];
    private static notes: MidiNote[] = [];
    public static onOutputsChanged: null | ((outputs: MidiDevice[]) => any) = null;
    public static onInputsChanged: null | ((outputs: MidiDevice[]) => any) = null;
    public static onNotesChanged: null | ((notes: MidiNote[]) => any) = null;
    private static isEnabled = false;

    private static _noteOnListener(e: any)
    {
        const index = this.notes.findIndex(n => n.name === e.note.name);
        if (index === -1)
        {
            this.notes.push({
                name: e.note.name,
                number: e.note.number,
                velocity: e.note.rawAttack,
                isOn: true,
                release: 0,
                playedAs: ""
            });
        }
        else
        {
            this.notes[index] = {
                name: e.note.name,
                number: e.note.number,
                velocity: e.rawAttack,
                isOn: true,
                release: 0,
                playedAs: ""
            };
        }

        this.onNotesChanged && this.onNotesChanged(this.notes.slice(0));
    }

    private static _noteOffListener(e: any)
    {
        const index = this.notes.findIndex(n => n.name === e.note.name);
        
        if (index !== -1)
        {
            this.notes[index] = {
                ...this.notes[index],
                isOn: false,
                release: e.rawRelease
            };
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
                input.open().then(() =>
                {
                    this.attachNoteListeners(input);
                });
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

    public static noteOn(notes: string[], outputNames: string[], channel: number, options: NoteOnOptions)
    {
        outputNames.forEach((outputName) =>
        {
            const midiOutput = WebMidi.getOutputByName(outputName);

            if (midiOutput)
            {
                midiOutput.channels[channel].sendNoteOn(notes, {
                    attack: options.velocity / 127
                });
            }
        });
    }

    public static noteOff(notes: string[], outputNames: string[], channel: number, options?: NoteOffOptions)
    {
        outputNames.forEach((outputName) =>
        {
            const midiOutput = WebMidi.getOutputByName(outputName);

            if (midiOutput)
            {
                midiOutput.channels[channel].sendNoteOff(notes, options ? {
                    release: options.release / 127
                } : undefined);
            }
        });
    }

    public static allNotesOff()
    {
        WebMidi.outputs.forEach((output: any) => 
        {
            output.sendNoteOff(allNotes);
        });
    }
}