import { app, BrowserWindow } from "electron";
import { join } from "path";

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
  });

  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:1420/");
    // win.openDevTools();
  } else {
    win.loadFile(join(__dirname, "./dist/index.html"));
  }
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
