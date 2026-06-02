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

const writeOutput = (data: string, filePath: string) => {
  try {
    fs.writeFileSync(filePath, data, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    const msg = code === 'ENOENT' ? 'No such file or directory' : (err as NodeJS.ErrnoException).message;
    process.stderr.write(`shell: ${filePath}: ${msg}\n`);
  }
};

const changeDirectory = (target: string, stderrFile: string | null) => {
  try {
    process.chdir(target);
  } catch {
    const error = `cd: ${target}: No such file or directory\n`;
    if (stderrFile) writeOutput(error, stderrFile);
    else process.stderr.write(error);
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

const extractRedirect = (tokens: string[]): { cmdArgs: string[], stdoutFile: string | null, stderrFile: string | null } => {
  const cmdArgs: string[] = [];
  let stdoutFile: string | null = null;
  let stderrFile: string | null = null;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === '>' || tokens[i] === '1>') {
      stdoutFile = tokens[i + 1] ?? null;
      i++;
    } else if (tokens[i] === '2>') {
      stderrFile = tokens[i + 1] ?? null;
      i++;
    } else {
      cmdArgs.push(tokens[i]);
    }
  }
  return { cmdArgs, stdoutFile, stderrFile };
};

const builtins: Record<string, (args: string[], stdoutFile: string | null, stderrFile: string | null) => void> = {
  exit: () => rl.close(),

  echo: (args, stdoutFile, stderrFile) => {
    const output = args.join(' ') + '\n';
    if (stdoutFile) writeOutput(output, stdoutFile);
    else process.stdout.write(output);
    if (stderrFile) writeOutput('', stderrFile);
    prompt();
  },

  type: (args, stdoutFile, stderrFile) => {
    const target = args[0];
    const found = findExecutable(target);
    const output = BUILTINS.has(target)
      ? `${target} is a shell builtin\n`
      : found ? `${target} is ${found}\n` : `${target}: not found\n`;
    if (stdoutFile) writeOutput(output, stdoutFile);
    else process.stdout.write(output);
    if (stderrFile) writeOutput('', stderrFile);
    prompt();
  },

  pwd: (_, stdoutFile, stderrFile) => {
    const output = process.cwd() + '\n';
    if (stdoutFile) writeOutput(output, stdoutFile);
    else process.stdout.write(output);
    if (stderrFile) writeOutput('', stderrFile);
    prompt();
  },

  cd: (args, _, stderrFile) => {
    const target = args[0] === "~" ? HOME_DIR : args[0];
    changeDirectory(target, stderrFile);
    prompt();
  }
};

rl.on('line', (input) => {
  const trimmed = input.trim();
  if (!trimmed) { prompt(); return; }

  const parsed = parseArgs([trimmed]);
  const { cmdArgs, stdoutFile, stderrFile } = extractRedirect(parsed);
  const [command, ...args] = cmdArgs;

  if (builtins[command]) {
    builtins[command](args, stdoutFile, stderrFile);
    return;
  }

  const filePath = findExecutable(command);
  if (!filePath) {
    console.log(`${command}: command not found`);
    prompt();
    return;
  }

  execFile(command, args, (_, stdout, stderr) => {
    if (stdoutFile) writeOutput(stdout ?? '', stdoutFile);
    else if (stdout) process.stdout.write(stdout);
    if (stderrFile) writeOutput(stderr ?? '', stderrFile);
    else if (stderr) process.stderr.write(stderr);

    prompt();
  });
});

prompt();