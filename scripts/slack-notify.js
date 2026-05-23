const fs = require("fs");

const data = JSON.parse(fs.readFileSync(".test-results.json", "utf-8"));

const message = `
📊 Playwright Test Run Completed

✅ Passed: ${data.passed}
❌ Failed: ${data.failed}
⚠️ Flaky: ${data.flaky}
📦 Total: ${data.total}

📄 HTML Report:
https://vidurbh.github.io/Playwright-github-framework/
`;

fetch("https://slack.com/api/chat.postMessage", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    channel: process.env.SLACK_CHANNEL_ID,
    text: message
  })
}).then(res => res.json())
  .then(console.log)
  .catch(console.error);