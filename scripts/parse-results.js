const fs = require("fs");

const report = JSON.parse(fs.readFileSync("playwright-report.json", "utf-8"));

const passed = report.stats.expected || 0;
const failed = report.stats.unexpected || 0;
const flaky = report.stats.flaky || 0;

const total = passed + failed + flaky;

fs.writeFileSync(".test-results.json", JSON.stringify({
  passed,
  failed,
  flaky,
  total
}, null, 2));

console.log("📊 Results parsed:", { passed, failed, flaky, total });