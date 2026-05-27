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

const getFileStatus = (filePath: string) => {
  const fileStatus = {
    isExecutable: false,
    isFound: false
  };
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
};

rl.prompt();

rl.on('line', (input) => {
  const splitInput = input.trim().split(' ');
  const command = splitInput[0];
  const args = splitInput.slice(1);

  if (command === "exit") {
    rl.close();
    return;
  }
  else if (command === "echo") {
    const arg = args.join(' ');
    console.log(arg);
    rl.prompt();
  }
  else if (command === "type") {
    const arg = args[0];
    if (commandTypes.has(arg)) {
      console.log(`${arg} is a shell builtin`);
    } else {
      let isFound = false;
      for (const dir of allDirs) {
        const filePath = path.join(dir, arg);
        const fileStatus = getFileStatus(filePath);
        if (fileStatus.isFound) {
          isFound = true;
        }
        if (fileStatus.isExecutable) {
          console.log(`${arg} is ${filePath}`);
          break;
        }
      }
      if (!isFound) {
        console.log(`${arg}: not found`);
      }
    }
    rl.prompt();
  }
  else {
    // Try to find and execute external command
    let isExe = false;
    for (const dir of allDirs) {
      const filePath = path.join(dir, command);
      const fileStatus = getFileStatus(filePath);
      if (fileStatus.isExecutable) {
        isExe = true;
        execFile(filePath, args, (error, stdout, stderr) => {
          if (stdout) process.stdout.write(stdout);
          if (stderr) process.stderr.write(stderr);
          rl.prompt();
        });
        return; 
      }
    }
    if (!isExe) {
      console.log(`${command}: command not found`);
      rl.prompt();
    }
  }
});