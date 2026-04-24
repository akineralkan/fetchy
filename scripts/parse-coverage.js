const fs = require('fs');
const path = require('path');

const dirs = [
  'coverage/src/index.html',
  'coverage/src/components/index.html',
  'coverage/src/components/openapi/index.html',
  'coverage/src/components/sidebar/index.html',
  'coverage/src/components/request/index.html',
  'coverage/src/store/index.html',
  'coverage/src/utils/index.html',
  'coverage/src/types/index.html',
  'coverage/src/hooks/index.html',
];

dirs.forEach(htmlPath => {
  const full = path.join(process.cwd(), htmlPath);
  if (!fs.existsSync(full)) return;
  const html = fs.readFileSync(full, 'utf8');
  const rows = html.match(/<tr>[\s\S]*?<\/tr>/g) || [];
  rows.forEach(r => {
    const fileMatch = r.match(/data-value="([^"]+\.tsx?)"/);
    if (!fileMatch) return;
    const file = fileMatch[1];
    const absMatch = r.match(/class="abs[^"]*">(\d+)\/(\d+)<\/td>/g) || [];
    if (absMatch.length < 1) return;
    const first = absMatch[0].match(/>(\d+)\/(\d+)</);
    if (!first) return;
    const covered = parseInt(first[1]);
    const total = parseInt(first[2]);
    const pct = total > 0 ? ((covered / total) * 100).toFixed(1) : '0';
    const uncovered = total - covered;
    const dir = htmlPath.replace('coverage/', '').replace('/index.html', '');
    console.log(`${pct}%\t${uncovered} uncov\t${dir}/${file}`);
  });
});
