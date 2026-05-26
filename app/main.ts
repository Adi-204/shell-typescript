import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
});

const commandTypes = new Set<string>(["echo", "exit"]);

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
    } else {
      console.log(`${command}: not found`);
    }
  }
  else {
    console.log(`${command}: command not found`);
  }
  rl.prompt();
});
