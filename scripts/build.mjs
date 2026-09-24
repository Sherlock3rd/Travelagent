import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const outputPath = fileURLToPath(output);
if (dirname(resolve(outputPath)) !== resolve(fileURLToPath(root))) throw new Error('Invalid output directory');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
// Publish only the application directory; never copy workspace or private files.
await cp(new URL('public/', root), output, { recursive: true });
const revision = process.env.GITHUB_SHA || 'local-preview';
// Version app modules as a graph so previously visited Pages URLs cannot keep
// an old entry point or an incompatible cached dependency after publishing.
for (const name of await readdir(output)) {
  if (!name.endsWith('.js')) continue;
  const file = new URL(name, output);
  const source = await readFile(file, 'utf8');
  await writeFile(file, source.replace(/(from\s+['"])(\.\/[^'"?]+\.js)(['"])/g, `$1$2?v=${revision}$3`));
}
await writeFile(new URL('.nojekyll', output), '');
await writeFile(new URL('release.json', output), JSON.stringify({
  revision,
  builtAt: new Date().toISOString()
}));
const html = await readFile(new URL('index.html', output), 'utf8');
if (!html.includes('app.js')) throw new Error('Missing application entry point');
// Pages cannot use the local server headers; carry the supported CSP into HTML.
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org https://dohahamadairport.com https://betamedia.experienceegypt.eg https://egymonuments.gov.eg https://1442038683.rsc.cdn77.org https://upload.wikimedia.org https://thumb.wikimedia.org https://orange-bay.tours; connect-src 'self' https://router.project-osrm.org https://tiles.openfreemap.org; worker-src 'self'; base-uri 'none'; form-action 'self'";
const versioned = html.replace(/((?:src|href)=")([^"?]+\.(?:js|css))(")/g, `$1$2?v=${revision}$3`);
await writeFile(new URL('index.html', output), versioned.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="strict-origin-when-cross-origin">`));
console.log(`Website built: ${fileURLToPath(output)}`);
