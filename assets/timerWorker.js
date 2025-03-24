let interval = null;
let lastTime = performance.now();
let running = false;

self.addEventListener("message", (e) => {
  switch (e.data) {
    case "start":
      if (interval !== null) return;
      lastTime = performance.now();
      // console.log("starting fr");
      interval = setInterval(() => {
        if (interval === null) return;
        const now = performance.now();
        self.postMessage(now - lastTime);
        lastTime = now;
      }, 10);
      break;
    case "stop":
      // console.log("stopping fr");
      clearInterval(interval);
      interval = null;
      break;
  }
});
