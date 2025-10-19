import { Cup } from "./src/cup";

async function main() {
  const cup = new Cup();

  const res = await cup.check("ghcr.io", "steveiliop56", "tinyauth", "v4.0", [
    "ghcr.io/steveiliop56/tinyauth@sha256:9e8fb9d58dc69031af395fd570ada147c6c7b98b29c036971bf69738b73d71b0",
  ]);

  console.log(res);
}

main();
