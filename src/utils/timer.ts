import { array_remove } from "./utils";

export default class Timer
{
    public onTick: (() => any)[];
    public onStop: (() => any)[];
    private intervalNs: bigint = 0n;
    private startingTime: bigint = 0n;
    private isStopQueued: boolean = false;
    private shouldCancelNextTick: boolean = false;

    constructor(public shouldTickOnStart: boolean = false)
    {
        this.onTick = [];
        this.onStop = [];
    }

    public addEventListener(event: "tick" | "stop", fn: () => any)
    {
        ({
            stop: this.onStop,
            tick: this.onTick
        } as Record<typeof event, (() => any)[]>)[event].push(fn);
    }

    public removeEventListener(event: "tick" | "stop", fn: () => any)
    {
        array_remove(
            ({
                stop: this.onStop,
                tick: this.onTick
            } as Record<typeof event, (() => any)[]>)[event],
            fn
        );
    }

    public start(intervalNs: bigint)
    {
        this.intervalNs = intervalNs;
        if (this.shouldTickOnStart)
        {
            this.onTick.forEach(fn => fn());
        }
        this.startTick();
    }

    private startTick()
    {
        this.startingTime = process.hrtime.bigint();

        if (this.intervalNs > 25000000n)
        {
            setTimeout(() =>
            {
                this.startImmediateTick();
            }, (Number((this.intervalNs - 25000000n) / 1000000n)));
        }
        else
        {
            this.startImmediateTick();
        }
    }

    private startImmediateTick()
    {
        if (this.isStopQueued && this.shouldCancelNextTick)
        {
            this.isStopQueued = false;
            this.onStop.forEach(fn => fn());
            return;
        }

        const now = process.hrtime.bigint();

        if (now - this.startingTime < this.intervalNs)
        {
            setImmediate(() => this.startImmediateTick());
        }
        else
        {
            this.onTick.forEach(fn => fn());
            if (!this.isStopQueued)
            {
                this.startTick();
            }
            else
            {
                this.isStopQueued = false;
                this.onStop.forEach(fn => fn());
            }
        }
    }

    public stop(cancelNextTick: boolean = true)
    {
        this.isStopQueued = true;
        this.shouldCancelNextTick = cancelNextTick;
    }
}