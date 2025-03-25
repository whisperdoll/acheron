import { execSync } from "child_process";
process.env.VITE_DEBUG = "true";
process.env.VITE_GIT_HASH = execSync("git rev-parse HEAD").toString().trim();
execSync("vite", { stdio: "inherit" });
