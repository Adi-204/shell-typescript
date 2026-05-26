import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
});

rl.prompt();

rl.on('line', (input) => {
  const splitInput = input.split(' ');
  const command = splitInput[0];
  if (command === "exit") {
    rl.close();
    return;
  }
  else if (command === "echo") {
    const arg = splitInput.slice(1).join(' ');
    console.log(arg);
  }
  else {
    console.log(`${command}: command not found`);
  }
  rl.prompt();
});
