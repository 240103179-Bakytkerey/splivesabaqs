// Сайтты dist/ қалтасына жинайды және сайттың өз доменіне бапталған кеңейтім архивін жасайды.
//   node scripts/build.mjs                 → әдепкі домен (https://splivesabaqs.vercel.app)
//   SITE_URL=https://example.com node scripts/build.mjs
// Vercel-де VERCEL_PROJECT_PRODUCTION_URL, Netlify-де URL айнымалысы өздігінен қолданылады.
import {cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateRawSync} from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const extDir = join(root, 'extension');

function siteUrl() {
  const env = process.env;
  const raw = env.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL && 'https://' + env.VERCEL_PROJECT_PRODUCTION_URL) || (env.NETLIFY && env.URL) || 'https://splivesabaqs.vercel.app';
  const u = new URL(raw);
  if (!['https:', 'http:'].includes(u.protocol)) throw Error('SITE_URL must be http(s): ' + raw);
  return u.origin + '/';
}

const CRC_TABLE = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

// Minimal ZIP writer (deflate), enough for Chrome's "Load unpacked" after extraction.
function zip(entries) {
  const locals = [], centrals = []; let offset = 0;
  const time = 0, date = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const {name, data} of entries) {
    const nameBuf = Buffer.from(name, 'utf8'), packed = deflateRawSync(data, {level: 9}), crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12); central.writeUInt16LE(date, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + packed.length;
  }
  const centralBuf = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

const files = dir => readdirSync(dir).flatMap(name => { const p = join(dir, name); return statSync(p).isDirectory() ? files(p) : [p]; });

export function build({url = siteUrl()} = {}) {
  const origin = new URL(url).origin;
  rmSync(dist, {recursive: true, force: true});
  mkdirSync(join(dist, 'downloads'), {recursive: true});
  cpSync(join(root, 'web'), dist, {recursive: true});
  cpSync(join(extDir, 'model.js'), join(dist, 'js', 'model.js'));

  const manifest = JSON.parse(readFileSync(join(extDir, 'manifest.json'), 'utf8'));
  const matches = [...new Set([origin + '/*', 'http://localhost/*', 'http://127.0.0.1/*'])];
  manifest.content_scripts[0].matches = matches;
  const config = `// build: ${new Date().toISOString()}\nself.JUZ40_SITE = ${JSON.stringify({url, origins: [...new Set([origin, 'http://localhost', 'http://127.0.0.1'])]}, null, 2)};\n`;
  const entries = files(extDir).filter(p => !/(^|[\\/])\./.test(relative(extDir, p))).map(p => {
    const rel = relative(extDir, p).split('\\').join('/');
    const data = rel === 'manifest.json' ? Buffer.from(JSON.stringify(manifest, null, 2) + '\n') : rel === 'config.js' ? Buffer.from(config) : readFileSync(p);
    return {name: 'juz40-live-extension/' + rel, data};
  }).sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(join(dist, 'downloads', 'juz40-live-extension.zip'), zip(entries));
  writeFileSync(join(dist, 'downloads', 'version.json'), JSON.stringify({version: manifest.version_name || manifest.version, site: url}, null, 2));
  return {url, files: entries.length};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = build();
  console.log(`dist/ дайын · кеңейтім ${result.files} файл · сайт ${result.url}`);
}
