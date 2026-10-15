import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

test('profile contract through the production entrypoint and SDK', { timeout: 120_000 }, async (t) => {
  const output = mkdtempSync(join(process.cwd(), '.runtime-test-'));
  let mf;
  try {
    execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', output], { stdio: 'pipe' });
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...await exportJWK(publicKey), kid: 'profile-test' };
    const issuer = 'https://profile-test.cloudflareaccess.com';
    const sign = (claims, expiration = '1h', audience = 'test-aud') => new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: jwk.kid }).setIssuer(issuer)
      .setAudience(audience).setExpirationTime(expiration).sign(privateKey);
    mf = new Miniflare(convertV4MiniflareOptions({
      modules: true, scriptPath: join(output, 'entry.js'),
      compatibilityDate: '2026-08-14', compatibilityFlags: ['nodejs_compat'],
      bindings: { TEAM_DOMAIN: issuer, POLICY_AUD: 'test-aud' },
      durableObjects: { PROTON_SESSIONS: { className: 'ProtonSession', useSQLite: true } },
      outboundService: async (request) => {
        assert.equal(request.url, `${issuer}/cdn-cgi/access/certs`, 'Profile must not contact mail providers');
        return Response.json({ keys: [jwk] });
      },
    }));
    const original = await sign({ sub: 'owner' });
    const rpc = async (method, params = {}, token = original) => {
      const response = await mf.dispatchFetch('https://worker/mcp', {
        method: 'POST', headers: {
          'content-type': 'application/json', accept: 'application/json',
          ...(token ? { 'cf-access-jwt-assertion': token } : {}),
          'Mcp-Method': method, 'MCP-Protocol-Version': '2026-07-28',
          ...(method === 'tools/call' ? { 'Mcp-Name': params.name } : {}),
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: {
          ...params, _meta: {
            'io.modelcontextprotocol/protocolVersion': '2026-07-28',
            'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1' },
            'io.modelcontextprotocol/clientCapabilities': {},
          },
        } }),
      });
      return { status: response.status, data: await response.json() };
    };
    const profile = async (token = original) => {
      const { status, data } = await rpc('tools/call', { name: 'get_profile', arguments: {} }, token);
      assert.equal(status, 200); assert.ok(!data.error && !data.result.isError, JSON.stringify(data));
      assert.deepEqual(JSON.parse(data.result.content[0].text), data.result.structuredContent);
      return data.result.structuredContent;
    };
    await t.test('complete metadata survives Proton tools/list rewriting', async () => {
      const { status, data } = await rpc('tools/list');
      assert.equal(status, 200);
      const tool = data.result.tools.find(x => x.name === 'get_profile');
      assert.equal(tool._meta['openai/profile'], true);
      assert.deepEqual(tool.annotations, { readOnlyHint: true, destructiveHint: false, openWorldHint: false });
      assert.deepEqual(tool.inputSchema.properties, {}); assert.equal(tool.inputSchema.additionalProperties, false);
      assert.equal(tool.outputSchema.type, 'object'); assert.deepEqual(tool.outputSchema.required, ['id']);
      assert.equal(tool.outputSchema.additionalProperties, false);
      assert.equal(tool.outputSchema.properties.id.minLength, 1); assert.equal(tool.outputSchema.properties.id.pattern, '\\S');
      for (const key of ['id', 'name', 'email', 'nickname']) assert.equal(tool.outputSchema.properties[key].type, 'string');
      for (const name of ['mail_list_accounts', 'mail_send', 'mail_proton_auth', 'mail_proton_poll_changes'])
        assert.ok(data.result.tools.some(x => x.name === name));
    });
    const first = await profile();
    await t.test('stable identity without mailbox config or provider access', async () => {
      const expected = 'prf_' + createHash('sha256').update(JSON.stringify(['mail-mcp-worker:profile:v1', 'owner'])).digest('hex');
      assert.deepEqual(first, { id: expected }); assert.deepEqual(await profile(), first);
      const renewed = await sign({ sub: 'owner', name: 'Renamed', email: 'new@example.com', jti: 'new-grant', token: 'secret-never-return' }, '2h');
      assert.deepEqual(await profile(renewed), { id: expected, name: 'Renamed', email: 'new@example.com' });
    });
    await t.test('concurrent identities cannot share request context', async () => {
      const second = await sign({ sub: 'other' });
      const values = await Promise.all([profile(), profile(second), profile(), profile(second)]);
      assert.equal(values[0].id, first.id); assert.equal(values[2].id, first.id);
      assert.notEqual(values[1].id, first.id); assert.equal(values[1].id, values[3].id);
    });
    await t.test('missing or blank subject and nonempty arguments fail closed', async () => {
      for (const sub of [undefined, '', '   ']) {
        const { data } = await rpc('tools/call', { name: 'get_profile', arguments: {} }, await sign(sub === undefined ? {} : { sub }));
        assert.equal(data.result.isError, true); assert.equal(data.result.structuredContent, undefined);
        assert.match(data.result.content[0].text, /access_denied/);
      }
      const { data } = await rpc('tools/call', { name: 'get_profile', arguments: { account: 'other' } });
      assert.ok(data.error || data.result.isError);
    });
    await t.test('missing, invalid, expired and wrong-audience JWTs are rejected', async () => {
      for (const token of ['', 'invalid-jwt', await sign({ sub: 'owner' }, '-1h'), await sign({ sub: 'owner' }, '1h', 'wrong')]) {
        const { status, data } = await rpc('tools/call', { name: 'get_profile', arguments: {} }, token);
        assert.equal(status, 403); assert.equal(data.error, 'access_denied'); assert.equal(data.structuredContent, undefined);
      }
    });
  } finally {
    if (mf) await mf.dispose();
    rmSync(output, { recursive: true, force: true });
  }
});
