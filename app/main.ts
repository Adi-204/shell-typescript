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

const extractRedirect = (tokens: string[]): { cmdArgs: string[], stdoutFile: string | null, isErrorInFile: boolean } => {
  const cmdArgs: string[] = [];
  let stdoutFile: string | null = null;
  let isErrorInFile: boolean = false;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === '>' || tokens[i] === '1>' || tokens[i] === '2>') {
      isErrorInFile = (tokens[i] === '2>') ? true : false;
      stdoutFile = tokens[i + 1] ?? null;
      i++;
    } else {
      cmdArgs.push(tokens[i]);
    }
  }
  return { cmdArgs, stdoutFile, isErrorInFile };
};

const writeOutput = (data: string, filePath: string, isErrorInFile: boolean) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    if (isErrorInFile) {
      const error = `shell: ${filePath}: No such file or directory\n`;
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, error, 'utf8');
    } else {
      process.stderr.write(error);
    }
  }
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, data, 'utf8');
  } catch (err) {
    process.stderr.write(`shell: ${err}\n`);
  }
};

const builtins: Record<string, (args: string[], stdoutFile: string | null, isErrorInFile: boolean) => void> = {
  exit: () => rl.close(),
  echo: (args, stdoutFile) => {
    const output = args.join(' ') + '\n';
    if (stdoutFile) {
      writeOutput(output, stdoutFile, isErrorInFile);
    } else {
      process.stdout.write(output);
    }
    prompt();
  },
  type: (args, stdoutFile) => {
    const target = args[0];
    let output: string;
    if (BUILTINS.has(target)) {
      output = `${target} is a shell builtin\n`;
    } else {
      const filePath = findExecutable(target);
      output = filePath ? `${target} is ${filePath}\n` : `${target}: not found\n`;
    }
    if (stdoutFile) {
      writeOutput(output, stdoutFile, isErrorInFile);
    } else {
      process.stdout.write(output);
    }
    prompt();
  },
  pwd: (_, stdoutFile) => {
    const output = process.cwd() + '\n';
    if (stdoutFile) {
      writeOutput(output, stdoutFile, isErrorInFile);
    } else {
      process.stdout.write(output);
    }
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
  const { cmdArgs, stdoutFile, isErrorInFile } = extractRedirect(parsed);
  const [command, ...args] = cmdArgs;

  if (builtins[command]) {
    builtins[command](args, stdoutFile, isErrorInFile);
    return;
  }

  const filePath = findExecutable(command);
  if (!filePath) {
    console.log(`${command}: command not found`);
    prompt();
    return;
  }

  execFile(command, args, (_, stdout, stderr) => {
    if (stdoutFile) {
      writeOutput(stdout ?? '', stdoutFile, isErrorInFile);
    } else {
      if (stdout) process.stdout.write(stdout);
    }
    if (stderr) process.stderr.write(stderr);
    prompt();
  });
});
prompt();