/// acheron.token v1

{
    "label": "Generate",
    "symbol": "G",
    "controls": {
        "triggerMode": {
            "label": "Trigger Mode",
            "type": "select",
            "options": [
                {
                    "label": "Beat",
                    "value": "beat"
                },
                {
                    "label": "Impact",
                    "value": "impact"
                },
                {
                    "label": "MIDI",
                    "value": "midi"
                }
            ],
            "defaultValue": "beat"
        },
        "probability": {
            "label": "Probability",
            "type": "int",
            "min": 0,
            "max": 100,
            "defaultValue": 100
        },
        "direction": {
            "label": "Direction",
            "type": "direction",
            "defaultValue": 0
        },
        "timeToLive": {
            "inherit": "global.timeToLive"
        },
        "pulseEvery": {
            "inherit": "global.pulseEvery"
        },
        "offset": {
            "label": "Offset",
            "type": "int",
            "min": 0,
            "max": 64,
            "defaultValue": 0
        }
    }
}

/// token.functions

function onStart(store, helpers)
{
    store.age = helpers.getControlValue("pulseEvery") + helpers.getControlValue("offset");
}

function onStop(store, helpers)
{

}

function onTick(store, helpers, playheads)
{
    const {
        offset,
        triggerMode,
        pulseEvery,
        timeToLive,
        direction,
        probability
    } = helpers.getControlValues();

    const currentBeat = helpers.getCurrentBeat(false);

    function tryMakePlayhead()
    {
        if (probability / 100 > Math.random())
        {
            helpers.spawnPlayhead(
                helpers.getHexIndex(),
                timeToLive,
                direction
            );
        }
    }

    if (triggerMode === "beat")
    {
        if (currentBeat % (pulseEvery + offset) === 0)
        {
            tryMakePlayhead();
        }
    }
    else if (triggerMode === "impact")
    {
        playheads.forEach((playhead) =>
        {
            tryMakePlayhead();
        });
    }
    else if (triggerMode === "midi")
    {
        // todo
    }

    return [currentBeat, (pulseEvery + offset) % helpers.getBarLength()];
}