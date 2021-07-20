/// acheron.token v1

{
    "label": "Wormhole",
    "symbol": "W",
    "uid": "whisperdoll.wormhole",
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
        "syncChannels": {
            "label": "Sync Channel I/O",
            "type": "bool",
            "defaultValue": true
        },
        "channel": {
            "label": "Channel",
            "type": "int",
            "min": 0,
            "max": 999,
            "defaultValue": 0
        },
        "sendToChannel": {
            "label": "Send to Channel",
            "type": "int",
            "min": 0,
            "max": 999,
            "defaultValue": 0,
            "showIf": "!syncChannels"
        },
        "receiveFromChannel": {
            "label": "Receive from Channel",
            "type": "int",
            "min": 0,
            "max": 999,
            "defaultValue": 0,
            "showIf": "!syncChannels"
        },
        "behavior": {
            "label": "Send Behavior",
            "type": "select",
            "options": [
                {
                    "label": "Sequence",
                    "value": "sequence"
                },
                {
                    "label": "Random",
                    "value": "random"
                }
            ],
            "defaultValue": "sequence"
        },
        "priority": {
            "label": "Priority",
            "type": "int",
            "min": -999,
            "max": 999,
            "defaultValue": 0
        }
    }
}

/// token.functions

function onStart(store, helpers)
{
    store.gateCounter = 0;
    store.sequenceCounter = 0;
}

function onStop(store, helpers)
{

}

function onTick(store, helpers, playheads)
{
    const { 
        probability,
        gateOffset,
        gateOn,
        gateOff,
        channel,
        sendToChannel,
        receiveFromChannel,
        syncChannels,
        behavior,
        priority
    } = helpers.getControlValues();

    function tryPerformWormhole(playheadIndex)
    {
        if (probability / 100 > Math.random())
        {
            function canSendTo(other)
            {
                const weCanSend = (syncChannels ? channel : sendToChannel) === other.channel;
                const theyCanReceive = (other.syncChannels ? other.channel : other.receiveFromChannel) === channel;
                return weCanSend && theyCanReceive;
            }

            const ph = playheads[playheadIndex];
            
            const wormholes = helpers.getOtherTokenInstances()
                .filter(w => canSendTo(w))
                .sort((a, b) => a.priority - b.priority);

            if (wormholes.length > 0)
            {
                let gotoIndex;
    
                if (behavior === "sequence")
                {
                    store.sequenceCounter++;
                    gotoIndex = store.sequenceCounter % wormholes.length;
                }
                else // random
                {
                    gotoIndex = Math.floor(Math.random() * wormholes.length);
                }

                helpers.warpPlayhead(playheadIndex, wormholes[gotoIndex].hexIndex, wormholes[gotoIndex].layerIndex);
                const playheadStore = helpers.getPlayheadStore(playheadIndex);
                playheadStore.lastWarpedAt = helpers.getCurrentBeat(false);
            }
        }
    }
    
    playheads.forEach((playhead, playheadIndex) =>
    {
        const playheadStore = helpers.getPlayheadStore(playheadIndex);
        if (playheadStore.lastWarpedAt === helpers.getCurrentBeat(false) - 1)
        {
            return;
        }
        if (playhead.age === 0) return;
        
        if (gateOn + gateOff === 0)
        {
            tryPerformWormhole(playheadIndex);
        }
        else
        {
            if (store.gateCounter >= gateOffset + gateOff || store.gateCounter < gateOffset)
            {
                tryPerformWormhole(playheadIndex);
            }
            store.gateCounter++;
            if (store.gateCounter >= gateOffset + gateOff + gateOn)
            {
                store.gateCounter = 0;
            }
        }
    });
}