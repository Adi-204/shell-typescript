import { createInterface } from "readline";
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
});

const allDirs = process.env.PATH.split(path.delimiter);

const commandTypes = new Set<string>(["echo", "exit", "type"]);

const getFileStatus = (filePath) => {
  const fileStatus = {
    isExecutable: false,
    isFound: false
  }
  if (fs.existsSync(filePath)) {
    fileStatus.isFound = true;
    try {
      fs.accessSync(filePath, fs.constants.X_OK);
      fileStatus.isExecutable = true;
    } catch (err) {
      fileStatus.isExecutable = false;
    }
  }
  return fileStatus;
}

rl.prompt();

rl.on('line', (input) => {
  const splitInput = input.split(' ');
  const command = splitInput[0];
  const args = splitInput.slice(1);
  if (command === "exit") {
    rl.close();
    return;
  }
  else if (command === "echo") {
    const arg = args.join(' ');
    console.log(arg);
  }
  else if (command === "type") {
    const arg = args[0];
    if (commandTypes.has(arg)) {
      console.log(`${arg} is a shell builtin`);
    }
    else {
      let isFound = false;
      for (const dir of allDirs) {
        const isExecutableFile = path.join(dir, arg);
        const fileStatus = getFileStatus(isExecutableFile);
        if (fileStatus.isFound) {
          isFound = true;
        }
        if (fileStatus.isExecutable) {
          console.log(`${arg} is ${isExecutableFile}`);
          break;
        }
      }
      if (!isFound) {
        console.log(`${arg}: not found`);
      }
    }
  }
  else {
    // not a builtin function
    let isExe = false;
    for (const dir of allDirs) {
      const isExecutableFile = path.join(dir, command);
      const fileStatus = getFileStatus(isExecutableFile);
      if (fileStatus.isExecutable) {
        isExe = true;
        execFile(isExecutableFile, args, (error, stdout, stderr) => {
            if (!error && !stderr) {
              console.log(stdout);
            }
        });
      }
    }
    if (!isExe) {
      console.log(`${command}: command not found`);
    }
  }
  rl.prompt();
});
