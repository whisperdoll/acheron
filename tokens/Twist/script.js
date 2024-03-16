/// acheron.token v1

{
    "label": "Twist",
    "symbol": "T",
    "uid": "hvst.twist",
    "controls": {
        "probability": {
            "label": "Probability",
            "type": "int",
            "min": 0,
            "max": 100,
            "defaultValue": 100
        },
        "twistAmount": {
            "label": "Twist Amount",
            "type": "int",
			"min": -3,
            "max": 3,
            "defaultValue": 1
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
	if (store.gateCounter == undefined)
	{
		store.gateCounter = 0;	
	}
}

function onStop(store, helpers)
{

}

function onTick(store, helpers, playheads)
{
    const { 
        probability,
        twistAmount,
        gateOffset,
        gateOn,
        gateOff
    } = helpers.getControlValues();

    function tryPerformTwist(playheadIndex)
    {
        if (probability / 100 > Math.random())
        {
            helpers.modifyPlayhead(playheadIndex, { direction });
        }
    }
    
    playheads.forEach((playhead, playheadIndex) =>
    {
        if (playhead.age === 0) return;
        
		direction = playheads[playheadIndex].direction + twistAmount;
		
        if (gateOn + gateOff === 0)
        {
            tryPerformTwist(playheadIndex);
        }
        else
        {
            if (store.gateCounter >= gateOffset + gateOff || store.gateCounter < gateOffset)
            {
                tryPerformTwist(playheadIndex);
            }
            store.gateCounter++;
            if (store.gateCounter >= gateOffset + gateOff + gateOn)
            {
                store.gateCounter = 0;
            }
        }
    });
}
