const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(process.cwd(), 'data', 'animetrack.db'));
const coversDir = path.join(process.cwd(), 'public', 'covers');

const rows = db.prepare(`
  SELECT id, title, coverUrl
  FROM anime
  WHERE coverUrl LIKE 'http://%' OR coverUrl LIKE 'https://%'
  ORDER BY id
`).all();

fs.mkdirSync(coversDir, { recursive: true });

const colors = [
  '#1f2937', '#334155', '#3f3f46', '#374151',
  '#4c1d95', '#7f1d1d', '#064e3b', '#78350f',
  '#1e3a8a', '#581c87', '#713f12', '#164e63',
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function splitTitle(title) {
  const chars = Array.from(title);
  return [
    chars.slice(0, 9).join(''),
    chars.slice(9, 18).join(''),
  ];
}

const update = db.prepare('UPDATE anime SET coverUrl = ? WHERE id = ?');
const writeFallbacks = db.transaction(() => {
  rows.forEach((row, index) => {
    const [line1, line2] = splitTitle(row.title);
    const bg = colors[index % colors.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="480" height="640" fill="url(#g)"/>
  <rect x="34" y="34" width="412" height="572" rx="28" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="3"/>
  <text x="240" y="278" text-anchor="middle" font-family="Arial, Microsoft YaHei, sans-serif" font-size="34" font-weight="700" fill="white">${escapeXml(line1)}</text>
  <text x="240" y="326" text-anchor="middle" font-family="Arial, Microsoft YaHei, sans-serif" font-size="30" font-weight="600" fill="rgba(255,255,255,.86)">${escapeXml(line2)}</text>
  <text x="240" y="558" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" letter-spacing="4" fill="rgba(255,255,255,.55)">ANIME TRACK</text>
  <title>${escapeXml(row.title)}</title>
</svg>`;

    const publicPath = `/covers/${row.id}.svg`;
    fs.writeFileSync(path.join(coversDir, `${row.id}.svg`), svg, 'utf8');
    update.run(publicPath, row.id);
  });
});

writeFallbacks();

console.log(JSON.stringify({
  created: rows.length,
  ids: rows.map((row) => row.id),
}, null, 2));

db.close();
