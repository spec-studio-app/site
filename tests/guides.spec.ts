import { expect, test, type Page } from '@playwright/test';

const guides = [
	{ slug: 'get-started', title: 'Get started' },
	{ slug: 'app', title: 'The app' },
	{ slug: 'relay', title: 'The relay' },
	{ slug: 'backends', title: 'Relay backends' },
	{ slug: 'backend-plugins', title: 'Backend plugins' }
];

/** The h2 headings of the guide, in order. */
async function headings(page: Page, level = 'h2'): Promise<string[]> {
	return page.getByTestId('guide').locator(level).allInnerTexts();
}

/** Every prototype in the guide draws, with a label for a screen reader. */
async function shotsLoad(page: Page) {
	for (const svg of await page.locator('.proto').all()) {
		await expect(svg).toHaveAttribute('role', 'img');
		expect((await svg.getAttribute('aria-label'))!.length).toBeGreaterThan(20);
		expect((await svg.boundingBox())!.height).toBeGreaterThan(100);
	}
}

// R1.S1
test('the index lists the five guides in order, each with a summary', async ({ page }) => {
	await page.goto('./guides/');
	const items = page.getByTestId('guide-list').locator('li');
	await expect(items).toHaveCount(guides.length);
	for (const [index, guide] of guides.entries()) {
		const item = items.nth(index);
		await expect(item.getByRole('link')).toHaveText(guide.title);
		await expect(item.getByRole('link')).toHaveAttribute('href', new RegExp(`guides/${guide.slug}/?$`));
		expect((await item.locator('p').innerText()).length).toBeGreaterThan(10);
	}
});

// R1.S2
test('the launch page links to the guides from the hero and the footer', async ({ page }) => {
	await page.goto('./');
	for (const area of [page.getByTestId('hero').getByRole('navigation'), page.getByTestId('footer')]) {
		const link = area.getByRole('link', { name: 'Guides' });
		await expect(link).toHaveCount(1);
		await link.click();
		await expect(page).toHaveURL(/\/site\/guides\/?$/);
		await page.goBack();
	}
});

// R2.S1
test('Get started goes from the requirements to a first spec, with a screenshot of each app step', async ({ page }) => {
	await page.goto('./guides/get-started/');
	expect(await headings(page)).toEqual(['Requirements', 'Install', 'First open', 'Add a repo', 'Your first spec']);
	const guide = page.getByTestId('guide');
	await expect(guide).toContainText('macOS 26 or later');
	await expect(guide).toContainText('Claude Code');
	await expect(guide).toContainText('gh auth login');
	await expect(guide.locator('code', { hasText: 'brew install --cask spec-studio-app/tap/spec-studio' })).toHaveCount(1);
	// Each app step has a screenshot between its heading and the next h2.
	const shots = await guide.evaluate((root) => {
		const count: Record<string, number> = {};
		let current = '';
		for (const el of root.children) {
			if (el.tagName === 'H2') current = el.id;
			else if (current) count[current] = (count[current] ?? 0) + el.querySelectorAll('.proto').length;
		}
		return count;
	});
	for (const id of ['first-open', 'add-a-repo', 'your-first-spec']) {
		expect(shots[id] ?? 0, `screenshots in ${id}`).toBeGreaterThan(0);
	}
	await shotsLoad(page);
});

// R3.S1 and R3.S2
test('the app guide explains the stages, the modes, the review, the panels and the CLI', async ({ page }) => {
	await page.goto('./guides/app/');
	const h2 = await headings(page);
	for (const name of ['The five stages', 'The three modes', 'The review', 'The shell panel', 'The sidebar panels', 'Settings', 'The studio command']) {
		expect(h2).toContain(name);
	}
	expect(await headings(page, 'h3')).toEqual(expect.arrayContaining(['Autopilot', 'Guided', 'Loop']));
	const stages = page.getByTestId('guide').locator('h2#the-five-stages + p + ol > li');
	await expect(stages).toHaveCount(5);
	const names = (await stages.locator('strong').allInnerTexts()).map((s) => s.replace(/\.$/, ''));
	expect(names).toEqual(['Spec', 'Plan', 'Build', 'Check', 'Merge']);
	for (const command of ['studio new', 'studio specs', 'studio --home . --spec open-count show', 'studio status']) {
		await expect(page.getByTestId('guide').locator('pre code', { hasText: command }).first()).toBeVisible();
	}
	await shotsLoad(page);
});

// R4.S1
test('the relay guide starts with what the relay does and the diagram', async ({ page }) => {
	await page.goto('./guides/relay/');
	expect((await headings(page))[0]).toBe('What the relay does');
	const first = page.getByTestId('guide').locator('h2#what-the-relay-does ~ *');
	await expect(page.getByTestId('guide')).toContainText('while the Mac is offline');
	for (const name of ['claude.ai', 'the Claude app', 'Claude Code on another computer']) {
		await expect(page.getByTestId('guide')).toContainText(name);
	}
	await expect(first.locator('pre code', { hasText: 'studio agent (Mac)' })).toHaveCount(1);
});

// R4.S2
test('the relay guide gives the steps in order, with the Remote Relay screenshot', async ({ page }) => {
	await page.goto('./guides/relay/');
	const steps = (await headings(page)).filter((h) => h.startsWith('Step '));
	expect(steps).toEqual([
		'Step 1: Make the password hash',
		'Step 2: Choose the store',
		'Step 3: Choose a bucket (optional)',
		'Step 4: Run the relay',
		'Step 5: Pair the Mac',
		'Step 6: Add the connector in Claude AI'
	]);
	await expect(page.locator('.proto[data-proto="settings-relay"]')).toHaveCount(1);
	await shotsLoad(page);
});

// R4.S3
test('the tools table gives each tool online and offline', async ({ page }) => {
	await page.goto('./guides/relay/');
	const table = page.getByTestId('guide').locator('h2#the-tools ~ .table table').first();
	await expect(table.locator('thead th')).toHaveText(['Tool', 'Mac online', 'Mac offline']);
	const tools = await table.locator('tbody tr td:first-child').allInnerTexts();
	expect(tools).toEqual(['list_repos', 'list_specs', 'list_collections', 'read_spec', 'make_spec', 'start_spec', 'send_message', 'read_messages', 'upload_attachment']);
	for (const row of await table.locator('tbody tr').all()) {
		for (const cell of await row.locator('td').all()) expect((await cell.innerText()).trim().length).toBeGreaterThan(0);
	}
});

// R5.S1, R5.S2 and R5.S3
test('the backends guide covers each store, bucket and run choice', async ({ page }) => {
	await page.goto('./guides/backends/');
	expect(await headings(page)).toEqual(['plugin-json', 'plugin-temporal', 'Another plugin', 'Upgrade from a relay with a built-in store', 'The attachment bucket', 'Ways to run the relay', 'Every setting']);
	expect(await headings(page, 'h3')).toEqual([
		'Temporal Cloud with an API key',
		'Temporal Cloud with mTLS',
		'Self-hosted Temporal',
		'Share the store with the Mac',
		'Cloudflare R2',
		'AWS S3',
		'MinIO',
		'No bucket',
		'Docker Compose',
		'Helm',
		'Docker',
		'PAYLOAD_KEYS'
	]);
	const guide = page.getByTestId('guide');
	for (const auth of ['plain', 'tls', 'mtls']) await expect(guide.locator('code', { hasText: new RegExp(`^${auth}$`) }).first()).toBeVisible();
	await expect(guide.getByText('plugin-temporal needs no search attribute')).toHaveCount(1);
	await expect(guide.getByText('Use Temporal Server 1.27 or later.')).toHaveCount(1);
	await expect(guide.locator('pre code', { hasText: 'docker compose --profile dev up' })).toHaveCount(1);
});

// Backend plugin host, R12.S1
test('the backend plugins guide explains the pane and links to the three plugin repos', async ({ page }) => {
	await page.goto('./guides/backend-plugins/');
	const guide = page.getByTestId('guide');
	for (const name of ['The two official plugins', 'Install the Temporal plugin', 'Choose a plugin in Settings', 'Work offline with Temporal']) {
		expect(await headings(page)).toContain(name);
	}
	for (const repo of ['plugin-json', 'plugin-temporal', 'plugin-sdk']) {
		await expect(guide.locator(`a[href="https://github.com/spec-studio-app/${repo}"]`)).toHaveCount(1);
	}
	await expect(guide).toContainText('Move my data');
	await expect(guide).not.toContainText('Send Now');
	await expect(guide).toContainText('Use This Plugin');
	await expect(guide).toContainText('Try Again');
	await expect(guide).not.toContainText('choose it again');
	await expect(guide).toContainText('Move My Data to Temporal…');
	await expect(guide.locator('pre code', { hasText: 'temporal server start-dev --db-filename' })).toHaveCount(1);
	await expect(guide.locator('tr', { hasText: 'History and replay' }).locator('td')).toHaveText(['History and replay', 'Yes', 'Yes']);
	await expect(guide).toContainText('one atomic step');
	await expect(guide).toContainText('~/Library/Application Support/Spec Studio/backend/json');
});

// R7.S1: the guides and their prototypes take the theme from the first paint.
const paper = { light: 'rgb(246, 241, 230)', dark: 'rgb(26, 25, 23)' };
/** The app's Ghostty themes in the replicas: TokyoNight Day and TokyoNight Storm. */
const appBg = { light: 'rgb(225, 226, 231)', dark: 'rgb(36, 40, 59)' };
for (const scheme of ['light', 'dark'] as const) {
	test.describe(`guides in the ${scheme} theme with JavaScript off`, () => {
		test.use({ colorScheme: scheme, javaScriptEnabled: false });

		for (const guide of guides) {
			test(`${guide.title} has the ${scheme} paper and ${scheme} replicas`, async ({ page }) => {
				await page.goto(`./guides/${guide.slug}/`);
				expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(paper[scheme]);
				for (const svg of await page.locator('.proto').all()) {
					const bg = await svg.evaluate((el) => getComputedStyle(el.querySelector('.rp:not(.rp-backdrop), .rp-sheet')!).backgroundColor);
					expect(bg).toBe(appBg[scheme]);
				}
			});
		}
	});
}

// Reduced motion: no animation, and the final state (no transient parts).
test.describe('with reduced motion', () => {
	test.use({ reducedMotion: 'reduce' });
	test('the prototypes do not move and show their final state', async ({ page }) => {
		for (const slug of ['get-started', 'app', 'relay']) {
			await page.goto(`./guides/${slug}/`);
			const moving = await page.evaluate(() => document.getAnimations().length);
			expect(moving, slug).toBe(0);
			const shown = await page.locator('.proto .transient').evaluateAll((els) => els.filter((el) => getComputedStyle(el).display !== 'none').length);
			expect(shown, slug).toBe(0);
		}
	});
});

// R7.S2
test.describe('on a 390 px phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });
	for (const path of ['guides/', ...guides.map((g) => `guides/${g.slug}/`)]) {
		test(`${path} has no horizontal scroll`, async ({ page }) => {
			await page.goto(`./${path}`);
			await page.evaluate(() => document.fonts.ready);
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
		});
	}
});

// R7.S3
test('the copy button of a code block copies its command', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('./guides/backends/');
	const block = page.locator('[data-copy-block]', { hasText: 'docker compose --profile dev up' });
	const button = block.getByRole('button', { name: 'Copy the command' });
	await button.click();
	await expect(button).toHaveText('Copied');
	await expect(block.getByRole('status')).toHaveText('Copied to the clipboard.');
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('docker compose --profile dev up');
	await expect(button).toHaveText('Copy', { timeout: 4000 });
});

// specs/collections R13.S2 (in the app repo)
test('the app guide has the section Areas and collections, and no project view', async ({ page }) => {
	await page.goto('./guides/app/');
	const guide = page.getByTestId('guide');
	await expect(guide.locator('h2#areas-and-collections')).toHaveText('Areas and collections');
	await expect(guide.locator('h2#areas-and-projects')).toHaveCount(0);
	await expect(guide.locator('h3#archive-a-collection')).toHaveCount(1);
	await expect(guide.locator('[data-shot="project-view"]')).toHaveCount(0);
	await expect(guide).toContainText('studio collection new');
});
