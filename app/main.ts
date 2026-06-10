import { createInterface } from "readline";
import path from 'path';
import fs from 'fs';
import { execFile, exec } from 'child_process';
import { promisify } from 'util';
import { Trie } from './trie';

const execPromise = promisify(exec);

const BUILTINS = new Set<string>(["echo", "exit", "type", "pwd", "cd", "complete"]);
const PATH_DIRS = process.env.PATH.split(path.delimiter);
const HOME_DIR = process.env.HOME;
const BACKSLASH_IN_DOUBLE_QUOTES = new Set<string>(['"', '\\']);
let prevLine = "";
const completerScripts = new Map<string, string>();

const executeCommand = async (script: string | undefined): Promise<string> => {
  if (!script) return "";
  try {
    const { stdout } = await execPromise(script);
    return stdout.trim() + " ";
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    return "";
  }
};

function getPathExecutables(): string[] {
  const executables: string[] = [];
  for (const dir of PATH_DIRS) {
    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      try {
        const fullPath = path.join(dir, file);
        fs.accessSync(fullPath, fs.constants.X_OK);
        executables.push(file);
      } catch {
        continue;
      }
    }
  }
  return executables;
}

function buildTrie(): Trie {
  const builtinNames = ["echo", "exit", "type", "pwd", "cd"];
  const pathExecutables = getPathExecutables();
  const all = [...new Set([...builtinNames, ...pathExecutables])];
  const trie = new Trie();
  for (const word of all) trie.insert(word);
  return trie;
}

async function completer(line: string): Promise<[string[], string]> {
  const parts = line.split(' ');
  const command = parts[0];

  if (parts.length > 1) {
    if (command && completerScripts.has(command)) {
      const script = completerScripts.get(command);
      const output = await executeCommand(script);
      const lastWord = parts[parts.length - 1]; 
      return [[output], lastWord];
    } else {
      process.stdout.write('\x07');
      return [[], line];
    }
  }

  // Completing the command name itself (no spaces)
  const trie = buildTrie();
  const matchCount = trie.countMatches(line);

  if (matchCount === 0) {
    process.stdout.write('\x07');
    return [[], line];
  }

  if (matchCount === 1) {
    const completed = trie.lcp(line) + " ";
    return [[completed], line];
  }

  const lcpResult = trie.lcp(line);
  if (lcpResult !== line) {
    return [[lcpResult], line];
  }

  if (prevLine === line) {
    const allMatches = trie.getAllMatches(line);
    process.stdout.write("\n" + allMatches.join("  ") + "\n");
    rl.write(null, { ctrl: true, name: 'u' });
    prompt();
    rl.write(line);
    prevLine = "";
  } else {
    process.stdout.write('\x07');
    prevLine = line;
  }

  return [[], line];
}

const rl = createInterface({
  input: process.stdin,
  completer: completer,
  output: process.stdout,
  prompt: "$ "
});

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

const writeToTarget = (data: string, file: string | null, append: string | null, stream: NodeJS.WriteStream) => {
  if (file) fs.writeFileSync(file, data, 'utf8');
  else if (append) fs.appendFileSync(append, data);
  else if (data) stream.write(data);
};

const changeDirectory = (target: string, stderrFile: string | null, appendStderrFile: string | null) => {
  try {
    process.chdir(target);
  } catch {
    const error = `cd: ${target}: No such file or directory\n`;
    writeToTarget(error, stderrFile, appendStderrFile, process.stderr);
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
      if (current.length > 0) { result.push(current); current = ""; }
    } else {
      current += char;
    }
  }
  if (current.length > 0) result.push(current);
  return result;
};

interface RedirectInfo {
  cmdArgs: string[];
  stdoutFile: string | null;
  stderrFile: string | null;
  appendStdOutFile: string | null;
  appendStdErrFile: string | null;
}

const extractRedirect = (tokens: string[]): RedirectInfo => {
  const cmdArgs: string[] = [];
  let stdoutFile: string | null = null;
  let stderrFile: string | null = null;
  let appendStdOutFile: string | null = null;
  let appendStdErrFile: string | null = null;

  for (let i = 0; i < tokens.length; i++) {
    switch (tokens[i]) {
      case '>': case '1>':   stdoutFile       = tokens[++i] ?? null; break;
      case '2>':             stderrFile       = tokens[++i] ?? null; break;
      case '>>': case '1>>': appendStdOutFile = tokens[++i] ?? null; break;
      case '2>>':            appendStdErrFile = tokens[++i] ?? null; break;
      default: cmdArgs.push(tokens[i]);
    }
  }
  return { cmdArgs, stdoutFile, stderrFile, appendStdOutFile, appendStdErrFile };
};

type BuiltinFn = (args: string[], r: RedirectInfo) => void;

const builtins: Record<string, BuiltinFn> = {
  exit: () => rl.close(),

  echo: (args, r) => {
    writeToTarget(args.join(' ') + '\n', r.stdoutFile, r.appendStdOutFile, process.stdout);
    writeToTarget('', r.stderrFile, r.appendStdErrFile, process.stderr);
    prompt();
  },

  type: (args, r) => {
    const target = args[0];
    const found = findExecutable(target);
    const output = BUILTINS.has(target)
      ? `${target} is a shell builtin\n`
      : found ? `${target} is ${found}\n` : `${target}: not found\n`;
    writeToTarget(output, r.stdoutFile, r.appendStdOutFile, process.stdout);
    writeToTarget('', r.stderrFile, r.appendStdErrFile, process.stderr);
    prompt();
  },

  pwd: (_, r) => {
    writeToTarget(process.cwd() + '\n', r.stdoutFile, r.appendStdOutFile, process.stdout);
    writeToTarget('', r.stderrFile, r.appendStdErrFile, process.stderr);
    prompt();
  },

  cd: (args, r) => {
    const target = args[0] === "~" ? HOME_DIR : args[0];
    changeDirectory(target, r.stderrFile, r.appendStdErrFile);
    prompt();
  },

  complete: (args, r) => {
    const flag = args[0];
    if (flag === "-C") {
      const path: string = args[1]
      const command: string = args[2];
      completerScripts.set(command, path);
    }
    else if (flag === "-p") {
      const command = args[1];
      let output = "";
      if (completerScripts.has(command)) {
        const path = completerScripts.get(command);
        output = `complete -C '${path}' ${command}\n`;
      } else {  
        output = `complete: ${command}: no completion specification\n`;
      }
      writeToTarget(output, r.stdoutFile, r.appendStdOutFile, process.stdout);
    }
    prompt();
  }
};

rl.on('line', (input) => {
  const trimmed = input.trim();
  if (!trimmed) { prompt(); return; }

  const parsed = parseArgs([trimmed]);
  const redirect = extractRedirect(parsed);
  const [command, ...args] = redirect.cmdArgs;

  if (builtins[command]) {
    builtins[command](args, redirect);
    return;
  }

  if (!findExecutable(command)) {
    console.log(`${command}: command not found`);
    prompt();
    return;
  }

  execFile(command, args, (_, stdout, stderr) => {
    writeToTarget(stdout ?? '', redirect.stdoutFile, redirect.appendStdOutFile, process.stdout);
    writeToTarget(stderr ?? '', redirect.stderrFile, redirect.appendStdErrFile, process.stderr);
    prompt();
  });
});

prompt();