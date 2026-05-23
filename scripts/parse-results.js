require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  saveTestRun,
  uploadFile,
  zipFolder
} = require('./supabase');
async function run() {
  // 1. Read Playwright JSON report
  const reportPath = 'playwright-report.json';

  if (!fs.existsSync(reportPath)) {
    console.error('❌ Report file not found:', reportPath);
    return;
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

  const passed = report.stats.expected || 0;
  const failed = report.stats.unexpected || 0;
  const flaky = report.stats.flaky || 0;

  const total = passed + failed + flaky;

  const duration = Math.round(report.stats.duration);

  const branch = process.env.GITHUB_REF || 'local';
  const commit_sha = process.env.GITHUB_SHA || 'local';

  console.log('📊 Parsed Run Data:', {
    passed,
    failed,
    flaky,
    total,
    duration
  });

  // 2. Upload HTML report (if exists)
  let reportUrl = null;

  const htmlReportPath = 'playwright-report/index.html';
  if (fs.existsSync(htmlReportPath)) {
    reportUrl = await uploadFile(
      htmlReportPath,
      `reports/report-${Date.now()}.html`
    );
    console.log('📄 Report uploaded:', reportUrl);
  }

  // 3. Upload videos/screenshots folder (optional simple zip-style upload)
  let artifactUrl = null;

  const testResultsPath = 'test-results';
  if (fs.existsSync(testResultsPath)) {
    const zipPath = `test-results-${Date.now()}.zip`;

await zipFolder('test-results', zipPath);

artifactUrl = await uploadFile(
  zipPath,
  `artifacts/artifact-${Date.now()}.zip`
);;
    console.log('📦 Artifacts uploaded:', artifactUrl);
  }

  // 4. Final payload for DB
  const runData = {
    passed,
    failed,
    flaky,
    total,
    duration,
    branch,
    commit_sha,
    report_url: reportUrl,
    artifact_url: artifactUrl
  };

  console.log('💾 Saving to Supabase:', runData);

  // 5. Save to Supabase
  await saveTestRun(runData);
}

run();