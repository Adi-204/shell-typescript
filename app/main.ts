import { createInterface } from "readline";
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';

const BUILTINS = new Set<string>(["echo", "exit", "type", "pwd", "cd"]);
const PATH_DIRS = process.env.PATH.split(path.delimiter);
const HOME_DIR = process.env.HOME;

const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "$ " });
const prompt = () => rl.prompt();

const isExecutable = (filePath: string): boolean => {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const findExecutable = (command: string): string | null => {
  for (const dir of PATH_DIRS) {
    const filePath = path.join(dir, command);
    if (isExecutable(filePath)) return filePath;
  }
  return null;
};

const changeDirectory = (target: string) => {
  try {
    process.chdir(target);
  } catch (err) {
    console.log(`cd: ${target}: No such file or directory`);
  }
};

const parseQuotedArgs = (args: string[]): string => {
  const joined = args.join(' ');
  const segments = joined.split("'");
  let result = "";

  segments.forEach((segment, index) => {
    const insideQuotes = index % 2 === 1;
    if (insideQuotes) {
      result += segment;
    } else {
      const collapsed = segment.replace(/\s+/g, ' ');
      result += collapsed;
    }
  });

  return result;
};

const builtins: Record<string, (args: string[]) => void> = {
  exit: () => rl.close(),
  echo: (args) => {
    const output = parseQuotedArgs(args);
    console.log(output);
    prompt();
  },
  type: (args) => {
    const target = args[0];
    if (BUILTINS.has(target)) {
      console.log(`${target} is a shell builtin`);
    } else {
      const filePath = findExecutable(target);
      console.log(filePath ? `${target} is ${filePath}` : `${target}: not found`);
    }
    prompt();
  },
  pwd: () => {
    console.log(process.cwd());
    prompt();
  },
  cd: (args) => {
    const target = (args[0] === "~") ? HOME_DIR : args[0];
    changeDirectory(target);
    prompt();
  }
};

rl.on('line', (input) => {
  const [command, ...args] = input.trim().split(' ');
  if (builtins[command]) {
    builtins[command](args);
    return;
  }
  const filePath = findExecutable(command);
  if (!filePath) {
    console.log(`${command}: command not found`);
    prompt();
    return;
  }
  const parsedArgs = parseArgs(args);
  execFile(command, parsedArgs, (_, stdout, stderr) => {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    prompt();
  });
});

prompt();

// echo 'script     example' 'hello''world' shell''test