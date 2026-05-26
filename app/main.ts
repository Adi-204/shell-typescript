import { createInterface } from "readline";
import path from 'path';
import fs from 'fs';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
});

const commandTypes = new Set<string>(["echo", "exit", "type"]);

rl.prompt();

rl.on('line', (input) => {
  const splitInput = input.split(' ');
  const command = splitInput[0];
  const arg = splitInput.slice(1).join(' ');
  if (command === "exit") {
    rl.close();
    return;
  }
  else if (command === "echo") {
    console.log(arg);
  }
  else if (command === "type") {
    if (commandTypes.has(arg)) {
      console.log(`${arg} is a shell builtin`);
    }
    else {
      let isFound = false;
      const allDirs = process.env.PATH.split(path.delimiter);
      for (const dir of allDirs) {
        const isExecutableFile = path.join(dir, arg);
        if (fs.existsSync(isExecutableFile)) {
          fs.access(isExecutableFile, fs.constants.X_OK, (err) => {
            isFound = true;
            if (!err) {
              console.log(`${arg} is ${isExecutableFile}`);
            } 
          });
        }
      }
      if (!isFound) {
        console.log(`${arg}: not found`);
      }
    }
  }
  else {
    console.log(`${command}: command not found`);
  }
  rl.prompt();
});
