import { transposeNote } from "./elysiumutils";

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

export default class Midi
{
    private static enabledOutputNames: string[] = [];
    private static enabledInputNames: string[] = [];
    public static onOutputsChanged: null | ((outputs: MidiDevice[]) => any) = null;
    public static onInputsChanged: null | ((outputs: MidiDevice[]) => any) = null;
    private static isEnabled = false;

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

    public static setEnabledInputs(names: string[])
    {
        this.enabledInputNames = names;
        WebMidi.inputs.forEach((input: any) =>
        {
            if (!names.includes(input.name))
            {
                input.close();
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
            else
            {
                if (!this.enabledInputNames.includes(e.target.name))
                {
                    e.target.close();
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