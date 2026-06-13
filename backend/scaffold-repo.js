/**
 * Repo Scaffolding Module
 * Generates Playwright framework files for a new org's test suite repo
 * Based on the reference project structure from Playwright-github-framework
 */

/**
 * Generate package.json for the org's test repo
 */
function generatePackageJson(orgName) {
  return JSON.stringify({
    name: `${orgName.toLowerCase().replace(/\s+/g, '-')}-test-suite`,
    version: "1.0.0",
    description: `Playwright Test Suite for ${orgName}`,
    scripts: {
      "test": "npx playwright test --project=chromium",
      "test:all": "npx playwright test",
      "test:headed": "npx playwright test --headed",
      "report": "npx playwright show-report"
    },
    devDependencies: {
      "@playwright/test": "^1.58.0",
      "@types/node": "^25.5.2",
      "typescript": "^5.8.0"
    },
    dependencies: {
      "dotenv": "^17.4.2"
    }
  }, null, 2);
}

/**
 * Generate playwright.config.ts
 */
function generatePlaywrightConfig(/* orgName */) {
  return `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'playwright-report.json' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://dummyjson.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ]
});
`;
}

/**
 * Generate tsconfig.json
 */
function generateTsconfig() {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "commonjs",
      lib: ["ES2022"],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      outDir: "./dist",
      rootDir: ".",
      types: ["node"]
    },
    include: ["**/*.ts"],
    exclude: ["node_modules", "dist"]
  }, null, 2);
}

/**
 * Generate .gitignore
 */
function generateGitignore() {
  return `node_modules/
test-results/
playwright-report/
blob-report/
playwright/.cache/
.env
*.zip
dist/
`;
}

/**
 * Generate .env.example
 */
function generateEnvExample() {
  return `# Playwright Test Environment
# Copy this file to .env and fill in your values
BASE_URL=https://your-app-url.com
`;
}

/**
 * Generate example API layer file: api/health.api.ts
 */
function generateHealthApi() {
  return `import { APIRequestContext } from "@playwright/test";

/**
 * Health check API helper
 */
export async function getHealthStatus(
  request: APIRequestContext
): Promise<{ status: string }> {
  const response = await request.get("/health", {});

  if (!response.ok()) {
    throw new Error(\`Health check failed with status \${response.status()}\`);
  }

  return response.json();
}
`;
}

/**
 * Generate example page object: pages/example.page.ts
 */
function generateExamplePage() {
  return `import { Page } from '@playwright/test';

export class ExamplePage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/');
  }

  async getTitle() {
    return this.page.locator('h1');
  }

  async getPageContent() {
    return this.page.locator('body').innerText();
  }
}
`;
}

/**
 * Generate example fixture: fixtures/baseFixture.ts
 */
function generateBaseFixture() {
  return `import { test as base } from '@playwright/test';
import { ExamplePage } from '../pages/example.page';
import { getHealthStatus } from '../api/health.api';

type Fixtures = {
  examplePage: ExamplePage;
  healthStatus: { status: string };
};

export const test = base.extend<Fixtures>({
  // Page Object fixture
  examplePage: async ({ page }, use) => {
    const pageObj = new ExamplePage(page);
    await use(pageObj);
  },

  // API fixture
  healthStatus: async ({ request }, use) => {
    const status = await getHealthStatus(request);
    await use(status);
  }
});

export { expect } from '@playwright/test';
`;
}

/**
 * Generate .github/workflows/playwright.yml
 */
function generateGithubWorkflow() {
  return `name: Playwright Tests

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
  schedule:
    - cron: '30 3 * * *'
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-24.04
    timeout-minutes: 60

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install chromium

      - name: Run Playwright tests
        run: npx playwright test --project=chromium
        env:
          CI: true

      - name: Verify report folder
        if: always()
        run: |
          mkdir -p playwright-report

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-pages-artifact@v3
        with:
          path: playwright-report/
`;
}

/**
 * Generate example test: tests/example.spec.ts
 */
function generateExampleTest() {
  return `import { test, expect } from '../fixtures/baseFixture';

test.describe('Example Test Suite', () => {
  test('should load the homepage', async ({ examplePage }) => {
    await examplePage.navigate();
    const title = await examplePage.getTitle();
    await expect(title).toBeVisible();
  });

  test('should have valid health status from API', async ({ healthStatus }) => {
    expect(healthStatus.status).toBeDefined();
    console.log('Health status:', healthStatus.status);
  });
});
`;
}

/**
 * Generate README.md
 */
function generateReadme(orgName) {
  return `# ${orgName} - Playwright Test Suite

Automated test suite for ${orgName} built with Playwright and TypeScript.

## Overview

This repository contains end-to-end tests using the Playwright testing framework.
Tests are structured using the Page Object Model pattern with fixtures for clean dependency injection.

## Project Structure

\`\`\`
api/              # API request helpers
pages/            # Page Object Models
fixtures/         # Custom test fixtures
tests/            # Test specifications
.github/workflows # CI/CD pipeline configuration
playwright.config.ts  # Playwright configuration
\`\`\`

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

\`\`\`bash
npm install
npx playwright install
\`\`\`

### Running Tests

\`\`\`bash
# Run all tests
npx playwright test

# Run tests in headed mode
npx playwright test --headed

# Run a specific test file
npx playwright test tests/example.spec.ts

# View HTML report
npx playwright show-report
\`\`\`

## CI/CD

Tests are automatically run via GitHub Actions on every push to main/master and on pull requests.
Scheduled runs occur daily at 3:30 AM UTC.

## Test Reports

HTML test reports are generated after each run and can be viewed locally with:
\`\`\`bash
npx playwright show-report
\`\`\`
`;
}

/**
 * Generate the full file tree for a new org repo
 * @param {string} orgName - Organization name
 * @param {string} orgSlug - Organization slug
 * @returns {Array<{path: string, content: string, message: string}>}
 */
function generateScaffold(orgName, orgSlug) {
  const branch = `initial-setup-${Date.now()}`;
  const files = [
    {
      path: 'package.json',
      content: generatePackageJson(orgName),
      message: 'chore: initialize project with package.json'
    },
    {
      path: 'playwright.config.ts',
      content: generatePlaywrightConfig(),
      message: 'chore: add Playwright configuration'
    },
    {
      path: 'tsconfig.json',
      content: generateTsconfig(),
      message: 'chore: add TypeScript configuration'
    },
    {
      path: '.gitignore',
      content: generateGitignore(),
      message: 'chore: add .gitignore'
    },
    {
      path: '.env.example',
      content: generateEnvExample(),
      message: 'chore: add environment example file'
    },
    {
      path: 'README.md',
      content: generateReadme(orgName),
      message: 'docs: add README with project documentation'
    },
    {
      path: 'api/health.api.ts',
      content: generateHealthApi(),
      message: 'feat: add API health check helper'
    },
    {
      path: 'pages/example.page.ts',
      content: generateExamplePage(),
      message: 'feat: add example page object'
    },
    {
      path: 'fixtures/baseFixture.ts',
      content: generateBaseFixture(),
      message: 'feat: add base test fixture'
    },
    {
      path: 'tests/example.spec.ts',
      content: generateExampleTest(),
      message: 'feat: add example test specification'
    },
    {
      path: '.github/workflows/playwright.yml',
      content: generateGithubWorkflow(),
      message: 'ci: add GitHub Actions workflow for Playwright tests'
    }
  ];

  return { files, branch };
}

module.exports = {
  generateScaffold,
  generatePackageJson,
  generatePlaywrightConfig,
  generateGithubWorkflow,
  generateReadme
};