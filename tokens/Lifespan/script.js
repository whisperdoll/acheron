/// acheron.token v1

{
    "label": "Lifespan",
    "symbol": "L",
    "uid": "hvst.life",
    "controls": {
        "probability": {
            "label": "Probability",
            "type": "int",
            "min": 0,
            "max": 100,
            "defaultValue": 100
        },
        "amount": {
            "label": "Amount",
            "type": "int",
			"min": -32,
            "max": 32,
            "defaultValue": 0
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
        amount,
        gateOffset,
        gateOn,
        gateOff
    } = helpers.getControlValues();

    function tryPerformLife(playheadIndex)
    {
        if (probability / 100 > Math.random())
        {
            helpers.modifyPlayhead(playheadIndex, { "lifespan": life });
        }
    }
    
    playheads.forEach((playhead, playheadIndex) =>
    {
        if (playhead.age === 0) return;
        
		life = playhead.lifespan + amount
		
        if (gateOn + gateOff === 0)
        {
          tryPerformLife(playheadIndex);
        }
        else
        {
            if (store.gateCounter >= gateOffset + gateOff || store.gateCounter < gateOffset)
            {
                tryPerformLife(playheadIndex);
            }
            store.gateCounter++;
            if (store.gateCounter >= gateOffset + gateOff + gateOn)
            {
                store.gateCounter = 0;
            }
        }
    });
}