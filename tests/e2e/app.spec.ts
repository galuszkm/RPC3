import { test as base, expect, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXAMPLE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'SignalExample.rsp');

// Fails every test that logs a console error or throws an uncaught page error
const test = base.extend<{ errors: string[] }>({
  // Fixture callback named `provide` (not `use`) so the React hooks lint rule doesn't flag it
  errors: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    await provide(errors);
    expect(errors, 'console/page errors').toEqual([]);
  },
});

/** Drops SignalExample.rsp onto the file drop area, like a user dragging it in. */
async function dropExampleFile(page: Page) {
  const base64 = fs.readFileSync(EXAMPLE_FILE).toString('base64');
  await page.locator('.dropzone-box').evaluate((el, b64) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([bytes], 'SignalExample.rsp'));
    el.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));
  }, base64);
  await expect(channelRows(page)).toHaveCount(5);
}

const channelRows = (page: Page) => page.locator('.channel-table tbody tr:not(.p-datatable-emptymessage)');
const timeChart = (page: Page) => page.locator('.time-chart-container');
const row = (page: Page, channelName: string) => channelRows(page).filter({ hasText: channelName });

test.beforeEach(async ({ page, errors }) => {
  void errors; // attach the error listener before the page loads
  await page.goto('/');
  await expect(page.getByText('Available channels')).toBeVisible();
});

test('renders the main components on load', async ({ page }) => {
  await expect(timeChart(page).locator('canvas')).toBeVisible();
  await expect(page.getByText('Drag and Drop Signal Files Here')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load signal example' })).toBeVisible();
  await expect(page.getByPlaceholder('Search ...')).toBeVisible();
  await expect(channelRows(page)).toHaveCount(0);

  // Calculation needs at least one selected channel
  await page.getByRole('button', { name: 'Calculate damage and equivalent block signal' }).click();
  await expect(page.getByText('At least one channel must be selected!')).toBeVisible();
});

test('loads the signal example', async ({ page }) => {
  // `vite preview` has no proxy for /getExample, so serve the file directly
  await page.route('**/getExample', route => route.fulfill({ body: fs.readFileSync(EXAMPLE_FILE) }));

  await page.getByRole('button', { name: 'Load signal example' }).click();

  await expect(page.locator('.dropzone-file-row')).toHaveCount(1);
  await expect(page.locator('.dropzone-file-row')).toContainText('01_Example');
  await expect(channelRows(page)).toHaveCount(5);
  for (const name of ['FDO_54xLoc_sh', 'ACC_76zGlob', 'FFG_78zGlob', 'FAD_7yknc', 'D_23magLo']) {
    await expect(row(page, name)).toContainText('01_Example');
  }
});

test('reads a dropped file and lists its channels', async ({ page }) => {
  await dropExampleFile(page);

  await expect(page.locator('.dropzone-file-row')).toContainText('SignalExample');
  await expect(page.locator('.dropzone-file-row')).toContainText('29.7 kB');
  await expect(row(page, 'FDO_54xLoc_sh')).toContainText('232.284');
  await expect(row(page, 'FDO_54xLoc_sh')).toContainText('-197.966');
  await expect(row(page, 'D_23magLo')).toContainText('mm');
  await expect(row(page, 'D_23magLo')).toContainText('955.154');
});

test('plots selected channels, clears the selection and filters the table', async ({ page }) => {
  await dropExampleFile(page);

  await row(page, 'FDO_54xLoc_sh').click();
  await row(page, 'ACC_76zGlob').click();
  await expect(timeChart(page)).toHaveAttribute('aria-label', /FDO_54xLoc_sh/);
  await expect(timeChart(page)).toHaveAttribute('aria-label', /ACC_76zGlob/);
  await expect(timeChart(page)).not.toHaveAttribute('aria-label', /FFG_78zGlob/);

  // ECharts keeps the old aria-label when no series are left, so select another
  // channel after clearing and check that only it is plotted
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await row(page, 'FFG_78zGlob').click();
  await expect(timeChart(page)).toHaveAttribute('aria-label', /FFG_78zGlob/);
  await expect(timeChart(page)).not.toHaveAttribute('aria-label', /FDO_54xLoc_sh|ACC_76zGlob/);

  await page.getByPlaceholder('Search ...').fill('ACC');
  await expect(channelRows(page)).toHaveCount(1);
  await expect(channelRows(page)).toContainText('ACC_76zGlob');
});

test('removing a file removes its channels from the table and chart', async ({ page }) => {
  await dropExampleFile(page);
  await row(page, 'FDO_54xLoc_sh').click();
  await expect(timeChart(page)).toHaveAttribute('aria-label', /FDO_54xLoc_sh/);

  await page.locator('.dropzone-file-row button').click();

  await expect(page.locator('.dropzone-file-row')).toHaveCount(0);
  await expect(channelRows(page)).toHaveCount(0);

  // ECharts keeps the old aria-label when no series are left, so load the file
  // again and check that only the newly selected channel is plotted
  await dropExampleFile(page);
  await row(page, 'ACC_76zGlob').click();
  await expect(timeChart(page)).toHaveAttribute('aria-label', /ACC_76zGlob/);
  await expect(timeChart(page)).not.toHaveAttribute('aria-label', /FDO_54xLoc_sh/);
});

test('calculates damage and the equivalent block signal', async ({ page }) => {
  await dropExampleFile(page);
  for (const name of ['FDO_54xLoc_sh', 'ACC_76zGlob', 'FFG_78zGlob']) {
    await row(page, name).click();
  }
  await page.getByRole('button', { name: 'Calculate damage and equivalent block signal' }).click();

  const dialog = page.locator('.signal-calc-dialog');
  await expect(dialog).toBeVisible();
  // Enough repetitions to reach the default minimum of 250k cycles
  await dialog.locator('.utils-table input[type=number]').fill('10000');
  await dialog.getByRole('button', { name: 'Calculate', exact: true }).click();

  // Cumulative cycles chart is drawn
  await expect(dialog.locator('.cumulative-chart-container canvas')).toBeVisible();
  await expect(dialog.locator('.cumulative-chart-container')).toHaveAttribute('aria-label', /FDO_54xLoc_sh/);

  // Damage values (reference values from the processing tests, x10000 repetitions)
  await dialog.getByRole('tab', { name: 'Results' }).click();
  const damageRows = dialog.locator('.utils-table tbody tr');
  await expect(damageRows).toHaveCount(3);
  await expect(damageRows.filter({ hasText: 'FDO_54xLoc_sh - SignalExample' })).toContainText('1.200e+18');
  await expect(damageRows.filter({ hasText: 'ACC_76zGlob - SignalExample' })).toContainText('1.281e+12');
  await expect(damageRows.filter({ hasText: 'FFG_78zGlob - SignalExample' })).toContainText('4.196e+12');

  // One equivalent block table per channel: 5 blocks + summary row with 100% damage
  await dialog.getByRole('tab', { name: 'Eq block signals' }).click();
  const eqTables = dialog.locator('.eq-signal-table');
  await expect(eqTables).toHaveCount(3);
  for (const table of await eqTables.all()) {
    await expect(table.locator('tbody tr')).toHaveCount(6);
    await expect(table.locator('.summary-row')).toContainText('100.0');
  }
});

test('time chart fills its area when the window is resized', async ({ page }) => {
  await dropExampleFile(page);
  await row(page, 'FDO_54xLoc_sh').click();

  for (const viewport of [{ width: 1900, height: 1100 }, { width: 1100, height: 800 }, { width: 1400, height: 900 }]) {
    await page.setViewportSize(viewport);
    await expect(async () => {
      const wrapper = await page.locator('.time-chart-wrapper').boundingBox();
      const canvas = await timeChart(page).locator('canvas').boundingBox();
      if (!wrapper || !canvas) throw new Error('Time chart is not visible');
      expect(Math.abs(canvas.width - wrapper.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(canvas.height - wrapper.height)).toBeLessThanOrEqual(2);
    }).toPass({ timeout: 5000 });
  }
});
