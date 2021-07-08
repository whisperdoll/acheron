/// acheron.token v1

{
    "label": "Skip",
    "symbol": "K",
    "controls": {
        "probability": {
            "label": "Probability",
            "type": "int",
            "min": 0,
            "max": 100,
            "defaultValue": 100
        },
        "skipAmount": {
            "label": "Skip Amount",
            "type": "int",
            "min": -16,
            "max": 16,
            "defaultValue": 2
        },
        "gateOffset": {
            "label": "Gate Offset",
            "type": "int",
            "min": 0,
            "max": 128,
            "defaultValue": 0
        },
        "gateOff": {
            "label": "Gate-Off",
            "type": "int",
            "min": 0,
            "max": 128,
            "defaultValue": 0
        },
        "gateOn": {
            "label": "Gate-On",
            "type": "int",
            "min": 0,
            "max": 128,
            "defaultValue": 0
        }
    }
}

/// token.functions

function onStart(store, helpers)
{
    store.gateCounter = 0;
}

function onStop(store, helpers)
{

}

function onTick(store, helpers, playheads)
{
    const { 
        probability,
        skipAmount,
        gateOffset,
        gateOn,
        gateOff
    } = helpers.getControlValues();

    function tryPerformSkip(playheadIndex)
    {
        if (probability / 100 > Math.random())
        {
            helpers.skipPlayhead(playheadIndex, playheads[playheadIndex].direction, skipAmount);
        }
    }
    
    playheads.forEach((playhead, playheadIndex) =>
    {
        if (playhead.age === 0) return;
        
        if (gateOn + gateOff === 0)
        {
            tryPerformSkip(playheadIndex);
        }
        else
        {
            if (store.gateCounter >= gateOffset + gateOff || store.gateCounter < gateOffset)
            {
                tryPerformSkip(playheadIndex);
            }
            store.gateCounter++;
            if (store.gateCounter >= gateOffset + gateOff + gateOn)
            {
                store.gateCounter = 0;
            }
        }
    });
}