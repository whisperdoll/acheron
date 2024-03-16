/// acheron.token v1

{
    "label": "Randomize",
    "symbol": "*",
    "uid": "hvst.randomize",
    "controls": {
        "probability": {
            "label": "Probability",
            "type": "int",
            "min": 0,
            "max": 100,
            "defaultValue": 100
        },
		"randomLocation": {
            "label": "Random Location",
            "type": "bool",
            "defaultValue": true
		},
		"randomDirection": {
            "label": "Random Direction",
            "type": "bool",
            "defaultValue": false
		},
		"randomLayer": {
            "label": "Random Layer",
            "type": "bool",
            "defaultValue": false
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
		randomLocation,
		randomDirection,
		randomLayer,
        gateOffset,
        gateOn,
        gateOff
    } = helpers.getControlValues();

    function tryPerformRandomize(playheadIndex)
    {
        if (probability / 100 > Math.random())
        {
			let direction = Math.floor(6 * Math.random());
			let rand = Math.floor(204 * Math.random());
			let currentPos = helpers.getHexIndex();
			if (randomLayer === false)
			{
				currentLayer = helpers.getLayer();
			}
			else
			{
				currentLayer = Math.floor(helpers.getNumLayers() * Math.random());
			}
			if (randomLocation === true)
			{
				helpers.warpPlayhead(playheadIndex, rand, currentLayer);
			}
			else
			{
				if (randomLayer === true)
				{
					helpers.warpPlayhead(playheadIndex, currentPos, currentLayer);
				}
			}
			if (randomDirection === true)
			{
				helpers.modifyPlayhead(playheadIndex, { direction });
			}
        }
    }
    
    playheads.forEach((playhead, playheadIndex) =>
    {
        if (playhead.age === 0) return;
        
        if (gateOn + gateOff === 0)
        {
            tryPerformRandomize(playheadIndex);
        }
        else
        {
            if (store.gateCounter >= gateOffset + gateOff || store.gateCounter < gateOffset)
            {
                tryPerformRandomize(playheadIndex);
            }
            store.gateCounter++;
            if (store.gateCounter >= gateOffset + gateOff + gateOn)
            {
                store.gateCounter = 0;
            }
        }
    });
}
