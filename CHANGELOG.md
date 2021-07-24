# 1.0.0 (2021/07/08)

It's the first version.

# 1.1.1 (2021/07/14)

* Fixed Note Length controls (and other decimal controls)
* Improved QOL for number inputs
    * Can now hold step buttons to repeatedly increment/decrement
* Add zoom feature via Ctrl+ and Ctrl-.
    * You can easily make the app look broken with these, use them wisely...
* More direct bug report link
* Added documentation by [hellvalleyskytrees](https://twitter.com/hvst_music) viewable in help menu
* Updated icon by her too!

# 1.1.2 (2021/07/17)

* Fixed LFOs on select controls
* Added LFOs to Layer properties
    * Enabled
    * MIDI Channel
    * Key
* Fixed documentation link
* Bugfixes relating to inheritance
* Auto-enable builtin tokens
* Fix beat signal staying on when paused

# 1.1.3 (2021/07/21)

* Fixed bug with saving token search paths
* Added MIDI input support
    * Generate token's "MIDI" trigger works now
* Added Patreon button
* QOL changes relating to layout
* Lots of keyboard shortcuts!
* New icons
* Fixed bug relating to dragging tokens in Multilayer Mode
* Added Wormhole Token
* Added tempo sync feature

# 1.1.4 (2021/07/24)

* Added new Token helpers functions
    * `getLayer()` - returns the layer a token is on (zero-indexed)
    * `getNumLayers()` - returns the number of layers in the composition