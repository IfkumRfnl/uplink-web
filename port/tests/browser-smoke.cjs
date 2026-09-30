'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../../prototype');
const out = path.resolve(__dirname, '../../qa');
const mime = {'.html':'text/html', '.js':'text/javascript', '.wasm':'application/wasm', '.data':'application/octet-stream', '.ogg':'audio/ogg', '.wav':'audio/wav', '.png':'image/png'};
function requestHandler(req, res) {
  let pathname;
  try { pathname = decodeURIComponent(req.url.split('?')[0]); }
  catch (_) { res.writeHead(400); return res.end(); }
  const p = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!p.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', mime[path.extname(p)] || 'application/octet-stream');
    res.end(data);
  });
}
async function run(entry = 'index.html', dependencies = {}) {
  if (!['index.html', 'game.html'].includes(entry)) throw Error('Expected index.html or game.html');
  const chromium = dependencies.chromium || require('playwright').chromium;
  const server = (dependencies.createServer || http.createServer)(requestHandler);
  let browser;
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args:['--enable-unsafe-swiftshader']});
    const page = await browser.newPage({viewport:{width:1200,height:1000}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.stack || String(e)));
    page.on('console', m => console.log('CONSOLE', m.type(), m.text()));
    const response = await page.goto(origin + '/' + entry);
    if (!response || !response.ok()) throw Error('Entry page did not load successfully');
    await page.waitForTimeout(5000);
    console.log('BODY', await page.locator('body').innerText());
    console.log('ERRORS', errors);
    console.log('GAMELOG', await page.evaluate(() => { try { return Module.FS.readFile('/persistent/.uplink/debug.log', {encoding:'utf8'}); } catch(e) { return String(e); } }));
    fs.mkdirSync(out, {recursive:true});
    await page.screenshot({path:path.join(out, entry + '.png'), fullPage:true});
    if (errors.length) throw Error('Browser reported ' + errors.length + ' uncaught page error(s)');
    // This remains a diagnostic capture, not a login/gameplay/audio/IndexedDB test.
  } finally {
    try { if (browser) await browser.close(); }
    finally { if (server.listening) await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())); }
  }
}
module.exports = {run, requestHandler};
if (require.main === module) run(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
