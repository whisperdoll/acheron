
# ![(Acheron icon)](assets/icons/64x64.png "Acheron icon")Acheron

## About

[Acheron](https://www.whisperdoll.love/acheron/) is a loose web-based recreation of **[Elysium](https://github.com/mmower/elysium)**, part of a small, unique family of MIDI sequencers based on a hexagonal grid of notes called the [**harmonic table**](https://en.wikipedia.org/wiki/Harmonic_table_note_layout).

The cross-platform web version of Acheron can be found [Here](https://www.whisperdoll.love/acheron/).
- Acheron was designed using and works best in Chromium based browsers. It may also work in Firefox based browsers, but little testing has been done in this area.
- Acheron **doesn't** work in Webkit based browsers such as Safari
- There is also a stand-alone Windows version [Here](https://github.com/whisperdoll/acheron/releases) for use without an internet connection.

You can support the development of this software here: **https://www.patreon.com/whisperdoll**

### **Please note that Acheron is a MIDI sequencer, and as such produces no sound on its own.**

You'll need a [Digital Audio Workstation](https://en.wikipedia.org/wiki/Digital_audio_workstation) (or other VST host/MIDI receiving application) and MIDI loopback driver (such as [loopmidi](https://www.tobias-erichsen.de/software/loopmidi.html) on Windows, or the built-in [IAC driver](https://support.apple.com/guide/audio-midi-setup/transfer-midi-information-between-apps-ams1013/mac) in the Audio/Midi Settings on Mac), or a MIDI interface and a physical MIDI device.

To use Acheron without a physical MIDI device (e.g. with a DAW or other software):

- Recent Windows 11 with built-in MIDI Settings app:
    - (???)
- Windows (pre MIDI Settings):
    - First, download and install Tobias Erichsen's [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html)
    - Use loopMIDI to create a virtual MIDI port (click the plus button at the bottom left of the window.)
- Mac:
    - Set up the [IAC driver](https://support.apple.com/guide/audio-midi-setup/transfer-midi-information-between-apps-ams1013/mac) in Audio/Midi Settings
- Start [Acheron](https://www.whisperdoll.love/acheron/).
- Select Settings (at the bottom of the window.)
- Under MIDI Outputs select the virtual MIDI port you just created with loopMIDI or the IAC Driver
- If using a MIDI controller for input, Under MIDI Inputs select the controller(s) you wish to use.
- Make sure your newly created virtual MIDI port is enabled as an input in your DAW (or other MIDI recieving app or device).

To get the most out of Acheron, we highly recommend reading the documentation, located **[here](https://github.com/whisperdoll/acheron/wiki/Acheron-Documentation)**.

## Credits

* [whisperdoll](http://www.whisperdoll.love/), creator of and primary contributor to Acheron.
* [Matt Mower](https://github.com/mmower) for creating the [original incarnation of this app](https://github.com/mmower/elysium).
* [CreamSodaFloat](https://github.com/CreamSodaFloat127) for helping with some math for the LFOs.
* [hellvalleyskytrees](hellvalleyskytrees.bsky.social) for the app icon, testing, a few tokens, and documentation,.
    * She's released many, many albums using this sequencer! Check out the latest here:
        * https://hellvalleyskytrees.bandcamp.com/album/voidscapes-vol-27
		
## License

MIT - see LICENSE file.
