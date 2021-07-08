import { transposeNote } from "./elysiumutils";

const { WebMidi } = require("../../node_modules/webmidi/dist/webmidi.esm");

export interface MidiOutput
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
    public static onOutputsChanged: null | ((outputs: MidiOutput[]) => any) = null;
    private static isEnabled = false;

    public static init()
    {
        if (this.isEnabled) return;

        this.isEnabled = true;
        WebMidi.enable();

        WebMidi.addListener("connected", (e: any) =>
        {
            WebMidi.inputs.forEach((input: any) => input.close());

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
        });

        WebMidi.addListener("disconnected", (e: any) =>
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
        });
    }

    public static playNotes(notes: string[], outputIds: string[], channel: number, options: NoteOptions)
    {
        notes = notes.map(note => transposeNote(note, -12));
        outputIds.forEach((outputId) =>
        {
            const midiOutput = WebMidi.getOutputById(outputId);

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