import fs from 'node:fs';
import path from 'node:path';

const pagesDir = path.resolve('趣然AI商品经营利润决策助手/output/pages');
const files = fs.readdirSync(pagesDir).filter((name) => name.endsWith('.html'));
const byId = new Map();

for (const name of files) {
  const html = fs.readFileSync(path.join(pagesDir, name), 'utf8');
  const id = html.match(/<meta name="page-id" content="([^"]+)"/)?.[1];
  if (!id) throw new Error(`${name} 缺少 page-id`);
  if (byId.has(id)) throw new Error(`重复 page-id: ${id}`);
  byId.set(id, name);
}

const routes = Object.fromEntries(byId);
const common = {
  '工作台': 'PAGE-F00-01',
  '数据批次': 'PAGE-F01-01',
  '批次管理': 'PAGE-F01-01',
  '行动清单': 'PAGE-F05-01',
  '历史追溯': 'PAGE-F08-01',
  '新建导入': 'PAGE-F01-02',
  '导入数据': 'PAGE-F01-02',
  '查看批次': 'PAGE-F01-03',
  '批次详情': 'PAGE-F01-03',
  '查看清单': 'PAGE-F05-01',
  '查看详情': 'PAGE-F05-02',
  '建议详情': 'PAGE-F05-02',
  '审核建议': 'PAGE-F06-01',
  '去审核': 'PAGE-F06-01',
  '执行经营动作': 'PAGE-F06-02',
  '确认经营动作': 'PAGE-F06-02',
  '执行采购动作': 'PAGE-F06-03',
  '确认采购动作': 'PAGE-F06-03',
  '记录经营结果': 'PAGE-F06-04',
  '返回建议详情': 'PAGE-F05-02',
  '返回工作台': 'PAGE-F00-01',
};

const wiring = `\n<script data-page-wiring>\n(() => {\n  const routes = ${JSON.stringify(routes)};\n  const labels = ${JSON.stringify(common)};\n  const candidates = document.querySelectorAll('a[href="#"], button');\n  for (const el of candidates) {\n    const text = el.textContent.replace(/\\s+/g, ' ').trim();\n    const key = Object.keys(labels).find((label) => text === label || text.includes(label));\n    const pageId = el.dataset.targetPage || (key && labels[key]);\n    if (!pageId || !routes[pageId]) continue;\n    if (el.tagName === 'A') el.href = routes[pageId];\n    else el.addEventListener('click', () => { location.href = routes[pageId]; });\n  }\n})();\n</script>\n`;

for (const name of files) {
  const target = path.join(pagesDir, name);
  let html = fs.readFileSync(target, 'utf8');
  html = html.replace(/\n?<script data-page-wiring>[\s\S]*?<\/script>\n?/g, '\n');
  html = html.replace(/\n{3,}(?=<\/body>)/g, '\n\n');
  html = html.replace('</body>', `${wiring}</body>`);
  fs.writeFileSync(target, html);
}

const broken = [];
for (const name of files) {
  const html = fs.readFileSync(path.join(pagesDir, name), 'utf8');
  for (const href of html.matchAll(/href="([^"]+)"/g)) {
    const value = href[1];
    if (/^(?:https?:|#|mailto:|javascript:)/.test(value)) continue;
    if (!fs.existsSync(path.join(pagesDir, value))) broken.push(`${name} -> ${value}`);
  }
}
if (broken.length) throw new Error(`死链：\n${broken.join('\n')}`);
console.log(`PAGE_WIRING_OK ${files.length} pages, 0 broken local links`);
