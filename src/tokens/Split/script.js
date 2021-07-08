/// acheron.token v1

{
    "label": "Split",
    "symbol": "Y",
    "controls": {
        "probability": {
            "label": "Probability",
            "type": "int",
            "min": 0,
            "max": 100,
            "defaultValue": 100
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
        },
        "bounceback": {
            "label": "Bounceback",
            "type": "bool",
            "defaultValue": false
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
        bounceback,
        gateOffset,
        gateOn,
        gateOff
    } = helpers.getControlValues();

    function tryPerformSplit(playheadIndex)
    {
        if (probability / 100 > Math.random())
        {
            const ph = playheads[playheadIndex];
            const oppositeDirection = helpers.oppositeDirection(ph.direction);
            for (let i = 0; i < 6; i++)
            {
                if (i !== ph.direction && !(!bounceback && i === oppositeDirection))
                {
                    helpers.spawnPlayhead(helpers.getHexIndex(), ph.lifespan - ph.age, i);
                }
            }
        }
    }
    
    playheads.forEach((playhead, playheadIndex) =>
    {
        if (playhead.age === 0) return;
        
        if (gateOn + gateOff === 0)
        {
            tryPerformSplit(playheadIndex);
        }
        else
        {
            if (store.gateCounter >= gateOffset + gateOff || store.gateCounter < gateOffset)
            {
                tryPerformSplit(playheadIndex);
            }
            store.gateCounter++;
            if (store.gateCounter >= gateOffset + gateOff + gateOn)
            {
                store.gateCounter = 0;
            }
        }
    });
}