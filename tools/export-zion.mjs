// Pipe "zion-mcp schema snapshot --args '{\"full\":true}'" to this program.
// Write only sanitized design-time configuration, never runtime table rows.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appId = '8bD5JlVexgP';
const input = fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, '');
const schema = JSON.parse(input);
const app = schema.clients?.clientById?.[appId];
if (!app?.rootPageIds?.includes('yrt7kexh8') || !schema.server?.actionFlows?.length) {
  throw Error('Input is not a full galagame Web schema snapshot.');
}
// Secret values are managed by the original Zion project. Retain only references.
schema.server.secretConfigs = (schema.server.secretConfigs ?? []).map(({ id, type, displayName }) => ({id, type, displayName}));
const sensitive = /^(?:password|passwd|clientSecret|appSecret|accessToken|refreshToken|privateKey|apiKey|secretKey|bearerToken|signingKey|sessionCookie)$/i;
const evidence = /-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----|(?:gh[pousr]_|github_pat_|sk-(?:proj-)?)[A-Za-z0-9_-]{18,}|\bAKIA[0-9A-Z]{16}\b|\beyJ[\w-]{6,}\.eyJ[\w-]{8,}\.[\w-]{8,}|(?:X-Amz-Signature|OSSAccessKeyId|X-Goog-Signature|x-oss-signature)=|\b(?:authorization|api[-_]?key|client[-_]?secret|access[-_]?token|password)["']?\s*[:=]\s*["'](?:Bearer\s+)?[\w+./=-]{16,}["']/i;
function audit(value, location) {
  if (typeof value === 'string') {
    if (evidence.test(value)) throw Error('Review possible secret at ' + location);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (sensitive.test(key) && typeof child === 'string' && child.length > 0) {
      throw Error('Review credential field at ' + location + '/' + key);
    }
    audit(child, location + '/' + key);
  }
}
audit(schema, 'schema');
const write = (relative, contents) => {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, contents);
};
const parts = [];
for (const component of Object.values(app.componentById)) {
  if (component.type !== 'HTML') continue;
  const bindings = component.properties.code?.valueBinding ?? [];
  if (!bindings.every(b => b.kind === 'literal' && typeof b.value === 'string')) {
    throw Error('Inspect the dynamic HTML binding on ' + component.id);
  }
  const html = bindings.map(b => b.value).join('');
  const dir = 'src/components/' + component.id;
  parts.push([dir + '/component.html', html]);
  const embedded = html.match(/src=["']data:text\/html(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/=]+)["']/i);
  if (embedded) {
    const document = Buffer.from(embedded[1], 'base64').toString('utf8');
    audit(document, dir + '/document.html');
    parts.push([dir + '/document.html', document]);
  }
}
for (const flow of schema.server.actionFlows) {
  for (const node of flow.allNodes ?? []) {
    if (node.type !== 'CUSTOM_CODE' || !node.code) continue;
    parts.push(['src/flows/' + flow.uniqueId + '/' + node.uniqueId + '.js', node.code]);
  }
}
// Keep the authoritative schema and human-readable mirrors from exactly the same export.
write('zion/project.json', JSON.stringify(schema, null, 2) + '\n');
for (const [name, source] of parts) write(name, source);
console.log(JSON.stringify({pages: app.rootPageIds.length, components:Object.keys(app.componentById).length, flows:schema.server.actionFlows.length, sources:parts.length}));
