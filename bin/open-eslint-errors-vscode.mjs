import { spawn } from "node:child_process";

const eslint = spawn("pnpm", ["eslint", ".", "--format", "json"], {
  stdio: ["ignore", "pipe", "inherit"],
});

let buffer = "";
const errorFiles = new Set();

eslint.stdout.setEncoding("utf8");

eslint.stdout.on("data", (chunk) => {
  buffer += chunk;

  // Try to parse only when we have complete JSON
  try {
    const json = JSON.parse(buffer);

    for (const result of json) {
      if (result.messages?.length) {
        errorFiles.add(result.filePath);
      }
    }

    buffer = ""; // reset after successful parse
  } catch {
    // not complete JSON yet — keep buffering
  }
});

eslint.on("close", (code) => {
  if (code !== 0 && code !== 1) {
    console.error(`ESLint exited with code ${code}`);
    process.exit(code);
  }

  if (errorFiles.size === 0) {
    console.log("No ESLint errors found 🎉");
    return;
  }

  const files = [...errorFiles];

  console.log(`Opening ${files.length} files with ESLint errors...`);

  // batch open instead of spawning per file
  const batchSize = 20;

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);

    spawn("code", batch, {
      stdio: "inherit",
      shell: true,
    });
  }
});
