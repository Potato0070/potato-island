// Read-only browser verification against local API fixtures. No production calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[2] ? pathToFileURL(path.resolve(process.argv[2])).href : '@playwright/test');
const origin = process.env.TREASURY_PREVIEW_URL || 'http://127.0.0.1:8090';
const output = path.resolve('tmp/treasury-verification');
await fs.mkdir(output, { recursive: true });
const userId = '00000000-0000-4000-8000-000000000001';
const user = { id: userId, email: 'local-fixture@example.test', aud: 'authenticated', role: 'authenticated', user_metadata: {}, app_metadata: {} };
const token = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url') + '.local-fixture-only';
const artwork = await fs.readFile('assets/homepage/icons/gene.png');
const browser = await chromium.launch({ headless: true });
const checks = [];

async function openFixture({ admin = false, empty = false, failure = false, large = false, width = 393, height = 852 } = {}) {
  const state = { failure, nftsRequests: 0, restRequests: [] };
  const context = await browser.newContext({ viewport: { width, height }, permissions: ['clipboard-read', 'clipboard-write'] });
  await context.addInitScript(({ user, token }) => {
    localStorage.setItem('sb-glmghjrrnhylztzgxomm-auth-token', JSON.stringify({ access_token: token, refresh_token: 'local-fixture-only', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user }));
  }, { user, token });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) {
      if (url.pathname === '/fixture-art.png') return route.fulfill({ contentType: 'image/png', body: artwork });
      return route.continue();
    }
    if (url.hostname !== 'glmghjrrnhylztzgxomm.supabase.co') return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    const json = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
    if (request.method() === 'OPTIONS') return json({});
    if (url.pathname.endsWith('/auth/v1/user')) return json(user);
    if (url.pathname.endsWith('/auth/v1/token')) return json({ access_token: token, refresh_token: 'local-fixture-only', expires_in: 3600, user });
    state.restRequests.push(url.pathname);
    if (state.failure) return json({ message: 'Fixture connection unavailable' }, 503);
    if (url.pathname.endsWith('/profiles')) return json({ id: userId, nickname: admin ? '岛主名字很长也应该显示正常' : '岛民小七', avatar_url: null, is_admin: admin, vip_level: 1, potato_coin_balance: '1280.50' });
    if (url.pathname.endsWith('/transfer_logs')) return json([{ price: '18.80' }, { price: 20 }]);
    if (url.pathname.endsWith('/nfts')) {
      state.nftsRequests++;
      if (empty) return json([]);
      const col = { id: 'local-collection-1', name: '本地验证藏品', image_url: origin + '/fixture-art.png' };
      if (large) {
        const offset = Number(url.searchParams.get('offset') || 0);
        return json(Array.from({ length: offset === 0 ? 1000 : 1 }, (_, index) => ({ id: 'local-nft-' + (offset + index), status: 'idle', collections: col })));
      }
      return json([{ id: 'local-nft-1', status: 'idle', collections: col }, { id: 'local-nft-2', status: 'consigning', collections: { ...col, id: 'local-collection-2', name: '第二件本地藏品' } }]);
    }
    return json([]);
  });
  await page.goto(origin + '/profile', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '金库', exact: true }).waitFor();
  if (failure) await page.getByRole('button', { name: '重新加载', exact: true }).waitFor();
  else await page.getByRole('button', { name: '订单', exact: true }).waitFor();
  await page.waitForFunction(() => [...document.fonts].filter(font => font.family.startsWith('Island-') && font.status === 'loaded').length === 2);
  return { page, context, state, errors };
}

async function assertLayout(page, width) {
  const box = await page.getByTestId('treasury-content').boundingBox();
  assert(box && box.x >= -0.5 && box.x + box.width <= width + 0.5, 'Treasury content stays inside viewport');
  assert(box.width <= 720.5, 'Desktop reading width is capped');
  assert(await page.getByTestId('treasury-content').evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'Content children do not overflow horizontally');
  assert.equal(await page.getByText('命运抽签', { exact: true }).count(), 0);
  for (const name of ['首页', '集市', '旨意', '消息', '金库']) {
    const bounds = await page.getByText(name, { exact: true }).last().boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y >= 0 && bounds.y + bounds.height <= page.viewportSize().height + 1, 'Navigation label visible: ' + name);
  }
  for (const image of await page.getByTestId('treasury-collection-image').all()) {
    const bounds = await image.boundingBox();
    assert(Math.abs(bounds.width - bounds.height) < 1, 'Collectible artwork is square');
  }
}

try {
  for (const width of [320, 360, 393, 430, 1024, 1440]) {
    const { page, context, errors } = await openFixture({ width, admin: true });
    await assertLayout(page, width);
    assert.equal(await page.getByRole('button', { name: '进入创世中枢控制台', exact: true }).count(), 1);
    assert.equal(await page.getByText('38.80', { exact: true }).count(), 2, 'String prices are summed numerically');
    if ([360, 393, 1440].includes(width)) await page.screenshot({ path: path.join(output, `admin-${width}.png`), fullPage: true });
    assert.deepEqual(errors, []);
    checks.push(`Admin layout ${width}px: square artwork, visible navigation, no lottery block`);
    await context.close();
  }
  {
    const { page, context, errors } = await openFixture({ empty: true });
    await assertLayout(page, 393);
    assert.equal(await page.getByRole('button', { name: '进入创世中枢控制台', exact: true }).count(), 0);
    await page.getByText('这里还没有藏品', { exact: true }).waitFor();
    await page.getByRole('button', { name: '复制土豆岛号', exact: true }).click();
    await page.getByText('土豆岛号已复制', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), userId);
    await page.getByRole('button', { name: '邀请，暂未开放', exact: true }).click();
    await page.getByText('邀请功能暂未开放', { exact: true }).waitFor();
    await page.getByText('邀请功能暂未开放', { exact: true }).waitFor({ state: 'hidden' });
    const buttonBounds = await page.getByRole('button', { name: '去集市', exact: true }).boundingBox();
    const artBounds = await page.getByTestId('pencil-button-art').boundingBox();
    assert(Math.abs(buttonBounds.width - artBounds.width) < 1 && Math.abs(buttonBounds.height - artBounds.height) < 1, 'Button background matches button geometry');
    await page.screenshot({ path: path.join(output, 'player-empty-393.png'), fullPage: true });
    await page.getByRole('button', { name: '去集市', exact: true }).click();
    await page.waitForURL('**/market');
    assert.deepEqual(errors, []);
    checks.push('Player: no admin entry; empty art, copy ID, invite feedback, go-to-market route');
    await context.close();
  }
  {
    const { page, context, state } = await openFixture({ failure: true });
    assert.equal(await page.getByText('这里还没有藏品', { exact: true }).count(), 0);
    state.failure = false;
    await page.getByRole('button', { name: '重新加载', exact: true }).click();
    await page.getByRole('button', { name: '订单', exact: true }).waitFor();
    await page.getByText('我的藏品', { exact: false }).first().waitFor();
    checks.push('Failure shows retry rather than empty vault; retry recovers');
    await context.close();
  }
  {
    const { page, context, state } = await openFixture({ large: true });
    await page.getByText('持有 1,001 件', { exact: true }).waitFor();
    assert.equal(state.nftsRequests, 2, 'Holdings after row 1000 are loaded');
    checks.push('Pagination preserves holdings beyond 1000 rows');
    await context.close();
  }
  for (const [label, pathname] of [['订单', '/my-orders'], ['求购', '/create-buy-order'], ['钱包', '/wallet'], ['合成', '/synthesis-list'], ['权益', '/vip-privilege'], ['转赠', '/transfer'], ['设置', '/change-avatar'], ['进入创世中枢控制台', '/admin-panel']]) {
    const { page, context } = await openFixture({ admin: true });
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForURL(url => url.pathname === pathname);
    checks.push(`Entry ${label} navigates to ${pathname}`);
    await context.close();
  }
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ fixtureOnly: true, checks }, null, 2));
  console.log(JSON.stringify({ fixtureOnly: true, checks }, null, 2));
} finally { await browser.close(); }
