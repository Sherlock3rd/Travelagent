import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const outputPath = fileURLToPath(output);
if (dirname(resolve(outputPath)) !== resolve(fileURLToPath(root))) throw new Error('Invalid output directory');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
// Publish only the application directory; never copy workspace or private files.
await cp(new URL('public/', root), output, { recursive: true });
const fingerprint = createHash('sha256');
for (const name of (await readdir(new URL('public/', root), { recursive: true })).sort()) {
  if (/\.(?:js|mjs|html|css|json)$/.test(name)) fingerprint.update(name).update(await readFile(new URL('public/' + name.replaceAll('\\', '/'), root)));
}
const revision = process.env.GITHUB_SHA || fingerprint.digest('hex').slice(0, 16);
// Version app modules as a graph so previously visited Pages URLs cannot keep
// an old entry point or an incompatible cached dependency after publishing.
for (const name of await readdir(output)) {
  if (!name.endsWith('.js') || name === 'sw.js') continue;
  const file = new URL(name, output);
  const source = await readFile(file, 'utf8');
  await writeFile(file, source.replace(/(from\s+['"])(\.\/[^'"?]+\.js)(['"])/g, `$1$2?v=${revision}$3`));
}
await writeFile(new URL('.nojekyll', output), '');
await writeFile(new URL('release.json', output), JSON.stringify({
  revision,
  builtAt: new Date().toISOString()
}));
// Pages cannot use the local server headers; carry the supported CSP into HTML.
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org https://dohahamadairport.com https://betamedia.experienceegypt.eg https://egymonuments.gov.eg https://1442038683.rsc.cdn77.org https://upload.wikimedia.org https://thumb.wikimedia.org https://orange-bay.tours; connect-src 'self' https://router.project-osrm.org https://tiles.openfreemap.org https://xqardnobmoaxosjqwiwh.supabase.co; worker-src 'self'; base-uri 'none'; form-action 'self'";
for (const name of ['index.html', 'trip.html', 'italy.html']) {
  const html = await readFile(new URL(name, output), 'utf8');
  const versioned = html.replace(/((?:src|href)=")([^"?]+\.(?:js|css))(")/g, `$1$2?v=${revision}$3`);
  await writeFile(new URL(name, output), versioned.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="strict-origin-when-cross-origin">`));
}
const assets = (await readdir(output, { recursive: true })).map(name => name.replaceAll('\\', '/'))
  .filter(name => /\.(?:html|js|mjs|css|json|png|svg|jpg|ico)$/.test(name) && name !== 'sw.js');
// Keep exact versioned URLs and raw URLs used by vendor dynamic imports/worker.
const precache = ['./', ...assets, ...assets.filter(name => /\.(?:js|css)$/.test(name)).map(name => name + '?v=' + revision)];
const worker = await readFile(new URL('sw.js', output), 'utf8');
await writeFile(new URL('sw.js', output), worker.replace(/^const VERSION = .*;$/m, `const VERSION = ${JSON.stringify(revision)};`).replace(/^const PRECACHE = .*;$/m, `const PRECACHE = ${JSON.stringify(precache)};`));
console.log(`Website built: ${fileURLToPath(output)}`);
