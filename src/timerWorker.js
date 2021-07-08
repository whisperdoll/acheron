let interval = null;
let lastTime = process.hrtime.bigint();

self.addEventListener("message", (e) =>
{
    switch (e.data)
    {
        case "start":
            if (interval !== null) return;
            lastTime = process.hrtime.bigint();
            interval = setInterval(() =>
            {
                const now = process.hrtime.bigint();
                self.postMessage(Number(now - lastTime));
                lastTime = now;
            }, 10);
            break;
        case "stop":
            clearInterval(interval);
            interval = null;
            break;
    }
});