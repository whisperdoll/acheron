# Making Custom Acheron Tokens

Note: It is highly advised that you check out some of the [included tokens](./src/tokens) while reading this file. It will make more sense that way.

## File Structure

Tokens live in a folder with their name as a `script.js` file. See [src/tokens](./src/tokens) directory for an example.

## Format

Acheron tokens are half JSON and half JavaScript.

The first (JSON) half of a token defines its metadata and the controls that it exposes to the app, and the second (JavaScript) half defines its behavior using code.

### JSON half
All tokens will start with the following line:

```
/// acheron.token \<version\>
```

Where `<version>` is the token version. The only supported version as of now is `v1`, so your first line will be:

```
/// acheron.token v1
```

(Please note that `v1` isn't literally in \<angular brackets\>)

Following that will be the JSON definition of the control. You can get more details on each of the fields below.

```json
{
    "label": <string>,
    "symbol": <string>,
    "controls": {
        <controlKey:string>: {
            "label": <string>,
            "type": <"int" | "decimal" | "direction" | "bool" | "select" | "triad">,
            "min"?: <number>,
            "max"?: <number>,
            "step"?: <number>
            "options"?: {
                "label": <string>,
                "value": <string>
            }[],
            "inherit"?: <inheritKey:string>,
            "defaultValue"?: <value>
        }
    }
}
```

* `label`: The label for the token. This is the name that will show up in the app.
* `symbol`: The symbol for the token. This will show up on any hex that the token is on.
* `controls`: These are controls that will be provided to the user to interact with when they are configuring an instance of your token. Their values can be modified by the user or an LFO and accessed in the token's code to modify its behavior accordingly.
    * `controlKey`: This will be the key used to access the control's value in your code.
    * `type`: The type of value the control represents.
        * `int`: A whole number.
        * `decimal`: A number that can have a decimal component.
        * `direction`: A direction, internally represented as a number from 0 to 5, with 0 being Up and incrementing clockwise.
        * `bool`: A boolean value—true or false. Commonly represented by a checkbox.
        * `select`: A string that is an option provided by the control's `options` attribute. The user can select an option via a drop-down box.
        * `triad`: A triad of notes. This is represented internally by a number from 0 to 6, and denotes a relative triad to be performed on any given note. This is mostly useful for passing to the `playTriad` function.
    * `min`: An minimum value to be used when the control's `type` is `int` or `decimal`. Defaults to `0` if not specified.
    * `max`: A maximum value to be used when the control's `type` is `int` or `decimal`. Defaults to `16` if not specified.
    * `step`: A value to be used as a stepping value when control's `type` is `int` or `decimal`. The UI will present the user with up and down arrows on this control, which will respectively increase and decrease the control's value by the `step`.
    * `options`: An array of options to be used when a control's type is `select`. Each option represents an item on a drop-down list.
        `label`: This will be the string shown to the user.
        `value`: This will be the underlying value of the option to be used in your code.
    * `inherit`: If your control inherits one of the app's default controls, you must specify the key here. **If you specify an `inherit` key, you do not have to specify anything else, including `label` and `type`.** See more about `inherit` keys in the errata section.
    * `defaultValue`: The value to be used as the control's default.

### JavaScript half

After the token's JSON definition, the following line is mandatory to denote the start of the token's behavior code:

```
/// token.functions
```

There are currently three functions supported:
* `onStart`: Runs when the composition is started.
* `onTick`: Runs when a beat has elapsed while the composition is playing.
* `onStop`: Runs when the composition is stopped. (Not usually necessary)

#### `onStart`

```js
function onStart(store, helpers)
{
    // code to be executed when the composition is started
}
```

`onStart` is passed the following arguments:
* `store`: A map-like object to store variables for your token to be accessed between functions. Often used to initialize the token in `onStart` and modify it during `onTick`. The value of `store` will be persisted between functions and beats.
* `helpers`: A map-like object containing a number of functions to help your token interact with the app. This is built on each function call, so it is fruitless to try to store things here (use `store` for that). More on the specific helper functions below.

#### `onTick`

```js
function onStop(store, helpers, playheads)
{
    // code to be executed when a beat occurs while a composition is playing
}
```

`onTick` is passed the same arguments as `onStart` with the addition of `playheads`.
`playheads` is an array of information about the playheads currently interacting with this token, and can be modified using certain functions from `helpers`.

The format for a single `playhead` object is as follows:

```json
{
    "age": <number>,
    "lifespan": <number>,
    "direction": <direction:number>
}
```

`age` and `lifespan` are measured in beats, and direction is a number from 0 to 5 with 0 being Up and incrementing clockwise.

#### `onStop`

```js
function onStop(store, helpers)
{
    // code to be executed when the composition is stopped
}
```

`onStop` is passed the same arguments as `onStart`.

#### Helper Functions

* `getControlValue(controlKey:string)`
    * Returns the value of the token's control with the given `controlKey`.
* `getControlValues()`
    * Returns a map-like object of the form `{ <controlKey>: <controlValue> }`.
    * Useful for retrieving all control values at once.
* `spawnPlayhead(hexIndex:number, timeToLive:number, direction:number, offset:number = 0)`
    * Spawns a playhead on the given `hexIndex`. See the errata section for more information on hex indexes.
    * `offset` is optional and will default to `0` if not specified.
* `getHexIndex()`
    * Returns the token's hex index.
* `modifyPlayhead(playheadIndex:number, newPlayheadDef:playhead)`
    * Modifies a given playhead.
    * `playheadIndex` refers to the index of the playhead you want to modify in the function's `playheads` argument.
    * `newPlayheadDef` expects an object in the form of the playhead format described above. You can leave out any attributes you don't wish to modify.
* `warpPlayhead(playheadIndex:number, newHexIndex:number)`
    * Moves a the given playhead to the `newHexIndex` on the next beat. See the errata section for more information on hex indexes.
* `skipPlayhead(playheadIndex:number, direction:number, skipAmount:number)`
    * Moves the given playhead by `skipAmount` in the given `direction`.
    * `skipAmount` can be negative to move the playhead in the opposite direction of the given `direction`.
* `oppositeDirection(direction:number)`
    * Returns a number representing the opposite direction of the given `direction`.
* `playTriad(hexIndex: number, triad: number, durationMs: number, velocity: number, transpose: number = 0)`
    * Instructs the app to send a MIDI signal for the given `hexIndex` (which represents a note) and `triad`.
    * `transpose` is optional and will default to `0` if not specified.
* `getCurrentBeat(withinBar: boolean = true)`
    * Returns the current beat, starting at `0`.
    * If `withinBar` is `false`, this will be how long the composition has been playing in beats.
    * If `witinBar` is `true`, this will be the beat relative to the current bar (so it will not reach or exceed the bar length of the layer the token is on).
    * `withinBar` is optional and will default to `true` if not specified.
* `getBarLength()`
    * Returns the bar length of the layer that the token is on.

## Errata

### Inherit Keys

The following inherit keys are valid, with `global` keys referring to the controls found in the *Player* section in the app, and `layer` keys referring to the controls found in the *Layer* section.

* `"player.transpose"`
* `"player.barLength"`
* `"player.tempo"`
* `"player.velocity"`
* `"player.emphasis"`
* `"player.noteLength"`
* `"player.timeToLive"`
* `"player.pulseEvery"`

* `"layer.barLength"`
* `"layer.emphasis"`
* `"layer.tempo"`
* `"layer.transpose"`
* `"layer.velocity"`
* `"layer.noteLength"`
* `"layer.pulseEvery"`
* `"layer.timeToLive"`

Controls that inherit will essentially just be copies, with the option of co-opting their value or overriding them with the user's own value or LFO. This can be seen in action as most of the *Layer* controls inherit *Player* controls.

### Hex Indexes

Hex indexes start at 0, which represents the top-left hex (D#7), and ascend following column-order.
E.g. 0=D#7, 1=G#6, 2=C#6, ..., 12=G7, 13=C7, 14=F6, ...