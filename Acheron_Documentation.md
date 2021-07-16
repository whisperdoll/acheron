# Acheron v1.1.1 Documentation

Acheron is an Electron-based recreation of [Elysium](https://github.com/mmower/elysium), a probabilistic generative midi sequencer.

Demo video by [hellvalleyskytrees](https://twitter.com/hvst_music</a> here: https://www.youtube.com/watch?v=BkXd8Xn45_k

Download the latest Acheron release here: https://github.com/SongSing/acheron/releases

The current version as of this writing is **1.1.1**

## Setup

Extract the zip file and run **Acheron.exe**, then **enable the built in tokens** in the **Manage Tokens** window, as described below.

Please note that Acheron is a **MIDI sequencer**, and as such produces no sound on its own.

You'll need a **Digital Audio Workstation** and **MIDI loopback driver**, or a **MIDI interface** and a physical **MIDI device**.

Visit the **GitHub page** for more information, or to contribute. https://github.com/SongSing/acheron

## Glossary

The following is a list of terms used by Acheron and their definitions, including information on their properties when applicable:

### Menu Bar

At the top of the window. Contains the following items:
- **File**
    - **Open Composition** (Ctrl+O)
    - **Save Composition as** (Ctrl+S)
    - **Close** (Ctrl+W)
- **View**
    - **Toggle Full Screen** (F11)
- **Help**
    - **Documentation**
        - Links to this page
    - **Troubleshooting**
        - Links to the troubleshooting section of [README.md][1] on the Acheron GitHub.
    - **Report a Bug**
        - Links to the [Bug Report][2] page on the Acheron GitHub.
    - **Credits**
        - Links to the credits section of [README.md][1] on the Acheron GitHub.</p>

### Composition

An Acheron document.

Options that apply to the whole composition (or all compositions) are located in the bar at the bottom center of the window.

These include:

- **Play/Pause** (or press enter)
- **Settings**, including:
    - **Play notes on click**
    - **Wrap playheads**
        - When wrap playheads is on,&nbsp; playheads that exit any side of the grid will appear on the opposite side.
    - **Show confirmation prompts when removing things**
    - **MIDI outputs**
        - Here you can select which output(s) you want Acheron to send MIDI data to.
        - If you want to use Acheron with your DAW of choice rather than a hardware device, you'll need a **MIDI loopback driver** such as **[loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html)**
- **Manage Tokens**
    - This is where you can add and enable/disable token types. Tokens **<span style="color:#e74c3c">must</span>** be **enabled** here to add them to a composition.
    - **<span style="color:#e74c3c">The first time you run Acheron</span>, **click **Manage Tokens,** then**<span style="color:#e74c3c"> enable all of the tokens</span>.**
    - <span style="color:#e74c3c">**IMPORTANT**</span>: If you don't see any tokens in the Manage Tokens window, please make sure the **token search paths** include **/tokens/** in the root of the Acheron Folder.
    - Optionally you may choose a **keyboard shortcut** for each token type.
- **Show/Hide inspector** 
    - Toggles visibility of the righthand panel
- **Toggle MultiLayer Mode**
    - Allows you to view all layers at once.
    - Note that you can still add and remove tokens in this mode.
- **Report a Bug**
    - Links to the [Bug Report][2] page on the Acheron GitHub.</p>

[1]: https://github.com/SongSing/acheron/blob/main/README.md
[2]: https://github.com/SongSing/acheron/issues/new?assignees=&labels=bug&template=1-Bug_report.md