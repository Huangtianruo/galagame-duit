import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../',import.meta.url));
const read = relative => fs.readFileSync(path.join(root,relative));
const json = relative => JSON.parse(read(relative));
function filesAt(dir) {
  return fs.readdirSync(path.join(root, dir), {withFileTypes:true}).flatMap(f => {
    const child = path.posix.join(dir, f.name);
    return f.isDirectory() ? filesAt(child) : [child];
  });
}
const deployment = json('zion/static-manifest.json');
const deploymentPaths = deployment.manifest.map(f=>'site/' + f.path).sort();
assert.deepEqual(filesAt('site').sort(), deploymentPaths, 'Static file inventory differs from the deployed manifest');
assert.equal(deploymentPaths.length, deployment.fileCount);
let size = 0;
for (const file of deployment.manifest) {
  const bytes = read('site/' + file.path);
  assert.equal(bytes.length, file.sizeBytes, file.path);
  assert.equal(createHash('md5').update(bytes).digest('base64'), file.md5Base64, file.path);
  size += bytes.length;
}
assert.equal(size, deployment.totalBytes);
const schema = json('zion/project.json');
const client = schema.clients.clientById['8bD5JlVexgP'];
assert.equal(client.configuration.initialPageId, 'yrt7kexh8');
for (const id of client.rootPageIds) assert.equal(client.componentById[id].type, 'PAGE', id);
const components = Object.values(client.componentById);
for (const c of components.filter(c=>c.type === 'HTML')) {
  const dir = 'src/components/' + c.id + '/';
  const source = c.properties.code.valueBinding.map(b=>b.value).join('');
  assert.equal(read(dir + 'component.html').toString('utf8'), source, c.displayName);
  const frame = source.match(/src=["']data:text\/html(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/=]+)["']/i);
  if (frame) assert.deepEqual(read(dir+'document.html'), Buffer.from(frame[1],'base64'), c.displayName);
}
for (const flow of schema.server.actionFlows) {
  for (const node of flow.allNodes) {
    if (node.type === 'CUSTOM_CODE' && node.code) {
      assert.equal(read('src/flows/'+flow.uniqueId+'/'+node.uniqueId+'.js').toString('utf8'),node.code,flow.displayName);
    }
  }
}
const assets = json('zion/assets.json');
const seenAssets = new Set();
function collectAssets(value) {
  if (!value || typeof value !== 'object') return;
  if (value.source === 'EXID') {
    for (const b of value.value?.valueBinding || []) if (b.kind === 'literal') seenAssets.add(b.value);
  }
  for (const child of Object.values(value)) collectAssets(child);
}
collectAssets(schema);
assert.deepEqual([...seenAssets].sort(), Object.keys(assets).sort(), 'Embedded editor assets');
for (const {file, sha256} of Object.values(assets)) assert.equal(createHash('sha256').update(read(file)).digest('hex'), sha256, file);
for (const item of schema.server.secretConfigs) assert.ok(Object.keys(item).every(k=>['id','type','displayName'].includes(k)), 'Unexpected Secret value');
console.log('OK · '+deployment.fileCount+' static files / '+size+' bytes; '+client.rootPageIds.length+' pages; '+components.length+' components; '+schema.server.actionFlows.length+' flows; '+seenAssets.size+' editor assets.');
