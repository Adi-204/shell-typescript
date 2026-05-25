import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
});

rl.prompt();

rl.on('line', (input) => {
  if (input === "exit") {
    rl.close();
    return;
  }
  console.log(`${input}: command not found`);
  rl.prompt();
});
