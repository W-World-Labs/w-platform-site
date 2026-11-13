import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({ testDir: '.', testMatch: 'acceptance.spec.ts', fullyParallel: false, workers: 1, timeout: 180_000, expect: { timeout: 15_000 }, reporter: [['./redacted-reporter.ts']], outputDir: join(tmpdir(), 'w-reference-playwright', String(process.pid)), use: { baseURL: 'http://127.0.0.1:4174', trace: 'off', screenshot: 'off', video: 'off' }, webServer: { command: 'npx vite --config vite.config.ts', url: 'http://127.0.0.1:4174', reuseExistingServer: false }, projects: [{ name: 'desktop-chromium', grep: /@(destructive|boundary|ui)/, use: { ...devices['Desktop Chrome'] } }, { name: 'mobile-chromium', grep: /@ui/, use: { ...devices['Pixel 7'] } }] });
