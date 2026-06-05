const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execSync } = require("child_process");

function scan(dir) {
  const ignore = ["node_modules", ".git"];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => !ignore.includes(d.name))
    .map(d => {
      const full = path.join(dir, d.name);
      return d.isDirectory()
        ? { type: "folder", name: d.name, children: scan(full) }
        : { type: "file", name: d.name };
    });
}

function analyze(project) {
  let files = 0;
  let folders = 0;

  const walk = (n) => {
    for (const x of n) {
      if (x.type === "file") files++;
      else {
        folders++;
        walk(x.children || []);
      }
    }
  };

  walk(project);

  return { files, folders, status: files > 10 ? "medium system" : "small system" };
}

function run(cmd) {
  try {
    console.log(execSync(cmd, { encoding: "utf-8" }));
  } catch (e) {
    console.log("Error:", e.message);
  }
}

function start() {
  const project = scan(process.cwd());

  console.log("\nENGINE READY\n");
  console.log("Type: analyze | run <cmd> | exit\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "seed> "
  });

  rl.prompt();

  rl.on("line", (line) => {
    const input = line.trim();

    if (input === "exit") process.exit(0);

    if (input === "analyze") {
      console.log(analyze(scan(process.cwd())));
    }

    else if (input.startsWith("run ")) {
      run(input.replace("run ", ""));
    }

    else {
      console.log("Commands: analyze | run <cmd> | exit");
    }

    rl.prompt();
  });
}

start();
