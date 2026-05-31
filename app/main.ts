import { createInterface } from "readline";
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';

const BUILTINS = new Set<string>(["echo", "exit", "type", "pwd", "cd"]);
const PATH_DIRS = process.env.PATH.split(path.delimiter);
const HOME_DIR = process.env.HOME;
const BACKSLASH_IN_DOUBLE_QUOTES = new Set<string>(['"', '\\']);

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
  } catch {
    console.log(`cd: ${target}: No such file or directory`);
  }
};

const parseArgs = (args: string[]): string[] => {
  const input = args.join(' ');
  const result: string[] = [];
  let current = "";
  let quoteChar = "";

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const nextChar = i < input.length - 1 ? input[i + 1] : "";
    if (char === "\\" && (quoteChar === "" || (quoteChar === '"' && BACKSLASH_IN_DOUBLE_QUOTES.has(nextChar)))) {
      current += nextChar;
      i++;
    } else if (char === quoteChar) {
      quoteChar = "";
    } else if ((char === "'" || char === '"') && quoteChar === "") {
      quoteChar = char;
    } else if (char === ' ' && quoteChar === "") {
      if (current.length > 0) {
        result.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0) result.push(current);
  return result;
};

const builtins: Record<string, (args: string[]) => void> = {
  exit: () => rl.close(),
  echo: (args) => {
    console.log(args.join(' '));
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
    const target = args[0] === "~" ? HOME_DIR : args[0];
    changeDirectory(target);
    prompt();
  }
};

rl.on('line', (input) => {
  const trimmed = input.trim();
  if (!trimmed) { prompt(); return; }

  const parsed = parseArgs([trimmed]);
  const [command, ...args] = parsed;

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

  execFile(command, args, (_, stdout, stderr) => {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    prompt();
  });
});

prompt();