const { execSync } = require("child_process");

console.log("🚀 Running Playwright tests...");

execSync(
  "npx playwright test --project=chromium",
  { stdio: "inherit" }
);