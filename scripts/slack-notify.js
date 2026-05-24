const fs = require("fs");

const mode = process.argv[2];

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

async function sendStartMessage() {
const response = await fetch(
"https://slack.com/api/chat.postMessage",
{
method: "POST",
headers: {
Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
"Content-Type": "application/json"
},
body: JSON.stringify({
channel: SLACK_CHANNEL_ID,
text: "🚀 Playwright Test Run Started..."
})
}
);

const data = await response.json();

console.log(data);

fs.writeFileSync(".slack-ts", data.ts);

console.log("✅ Slack TS saved");
}

async function updateMessage() {
const results = JSON.parse(
fs.readFileSync(".test-results.json", "utf-8")
);

const ts = fs.readFileSync(".slack-ts", "utf-8");

const message = `
📊 Playwright Test Run Completed

✅ Passed: ${results.passed}
❌ Failed: ${results.failed}
⚠️ Flaky: ${results.flaky}
📦 Total: ${results.total}

📄 HTML Report:
https://vidurbh.github.io/Playwright-github-framework/
`;

const response = await fetch(
"https://slack.com/api/chat.update",
{
method: "POST",
headers: {
Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
"Content-Type": "application/json"
},
body: JSON.stringify({
channel: SLACK_CHANNEL_ID,
ts,
text: message
})
}
);

const data = await response.json();

console.log(data);
}

if (mode === "start") {
sendStartMessage();
} else if (mode === "complete") {
updateMessage();
} else {
console.log("❌ Invalid mode");
}
