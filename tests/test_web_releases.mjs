import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_DIR = path.resolve(__dirname, '../web');

console.log('=== VERIFYING WEB RELEASES & HOME UPDATES ===');

// 1. Verify releases.json
const releasesJsonPath = path.join(WEB_DIR, 'public/data/releases.json');
if (!fs.existsSync(releasesJsonPath)) {
  console.error('FAIL: releases.json not found');
  process.exit(1);
}
const releasesData = JSON.parse(fs.readFileSync(releasesJsonPath, 'utf8'));
console.log('✔ releases.json parsed successfully.');

if (releasesData.latest.version !== '1.2.0') {
  console.error(`FAIL: releasesData.latest.version is ${releasesData.latest.version}, expected 1.2.0`);
  process.exit(1);
}
console.log('✔ releasesData.latest.version is 1.2.0');

const v120 = releasesData.releases.find(r => r.version === '1.2.0');
if (!v120) {
  console.error('FAIL: v1.2.0 not found in releases array');
  process.exit(1);
}
if (!v120.files.installer.sha256 || v120.files.installer.sha256.length !== 64) {
  console.error(`FAIL: v1.2.0 sha256 is invalid: ${v120.files.installer.sha256}`);
  process.exit(1);
}
console.log(`✔ v1.2.0 sha256 is valid: ${v120.files.installer.sha256}`);

// 1b. Verify MSI hashes in releases.json
for (const rel of releasesData.releases) {
  if (rel.files?.msi) {
    if (!rel.files.msi.sha256 || rel.files.msi.sha256.length !== 64) {
      console.error(`FAIL: v${rel.version} msi sha256 is invalid: ${rel.files.msi.sha256}`);
      process.exit(1);
    }
  }
}
console.log('✔ All MSI packages in releases.json have valid 64-char SHA-256 hashes');

// 2. Verify update-manifest.json
const updateManifestPath = path.join(WEB_DIR, 'public/data/update-manifest.json');
const updateManifest = JSON.parse(fs.readFileSync(updateManifestPath, 'utf8'));
if (updateManifest.latest.version !== '1.2.0') {
  console.error(`FAIL: updateManifest.latest.version is ${updateManifest.latest.version}`);
  process.exit(1);
}
console.log('✔ update-manifest.json is updated to 1.2.0');

// 3. Verify Home.jsx contains dynamic releaseInfo and default v1.2.0
const homeContent = fs.readFileSync(path.join(WEB_DIR, 'src/pages/Home.jsx'), 'utf8');
if (!homeContent.includes('v1.2.0')) {
  console.error('FAIL: Home.jsx does not mention v1.2.0');
  process.exit(1);
}
if (!homeContent.includes('fetch(\'/data/releases.json\')')) {
  console.error('FAIL: Home.jsx does not fetch /data/releases.json');
  process.exit(1);
}
if (!homeContent.includes('releaseInfo.installerUrl')) {
  console.error('FAIL: Home.jsx does not use releaseInfo.installerUrl');
  process.exit(1);
}
if (!homeContent.includes('msiAvailable')) {
  console.error('FAIL: Home.jsx missing msiAvailable handling');
  process.exit(1);
}
console.log('✔ Home.jsx correctly wired to dynamic releaseInfo with v1.2.0 default');

// 4. Verify App.jsx points nav download to v1.2.0 installer and uses NavLink
const appContent = fs.readFileSync(path.join(WEB_DIR, 'src/App.jsx'), 'utf8');
if (!appContent.includes('v1.2.0')) {
  console.error('FAIL: App.jsx does not have v1.2.0 default installerUrl');
  process.exit(1);
}
if (!appContent.includes('NavLink')) {
  console.error('FAIL: App.jsx missing NavLink for releases link');
  process.exit(1);
}
console.log('✔ App.jsx has dynamic installerUrl with v1.2.0 default and NavLink support');

// 5. Verify Releases.jsx
const releasesContent = fs.readFileSync(path.join(WEB_DIR, 'src/pages/Releases.jsx'), 'utf8');
if (!releasesContent.includes('releases-page-wrapper')) {
  console.error('FAIL: Releases.jsx missing releases-page-wrapper');
  process.exit(1);
}
if (!releasesContent.includes('releases-featured-card')) {
  console.error('FAIL: Releases.jsx missing featured card');
  process.exit(1);
}
if (!releasesContent.includes('releases-timeline')) {
  console.error('FAIL: Releases.jsx missing releases timeline');
  process.exit(1);
}
if (!releasesContent.includes('Get-FileHash')) {
  console.error('FAIL: Releases.jsx missing PowerShell Get-FileHash verification');
  process.exit(1);
}
if (!releasesContent.includes('normalizeForSearch')) {
  console.error('FAIL: Releases.jsx missing diacritic-insensitive search function');
  process.exit(1);
}
if (!releasesContent.includes('toggleHistoricalExpand')) {
  console.error('FAIL: Releases.jsx missing expandable historical details handler');
  process.exit(1);
}
if (!releasesContent.includes('timeline-expand-btn')) {
  console.error('FAIL: Releases.jsx missing timeline-expand-btn');
  process.exit(1);
}
console.log('✔ Releases.jsx features confirmed (diacritic search, expandable timeline details, PowerShell verification)');

// 6. Verify styles.css
const cssContent = fs.readFileSync(path.join(WEB_DIR, 'src/styles.css'), 'utf8');
if (!cssContent.includes('.releases-featured-card')) {
  console.error('FAIL: styles.css missing .releases-featured-card');
  process.exit(1);
}
if (!cssContent.includes('.releases-timeline')) {
  console.error('FAIL: styles.css missing .releases-timeline');
  process.exit(1);
}
if (!cssContent.includes('.timeline-expand-btn')) {
  console.error('FAIL: styles.css missing .timeline-expand-btn');
  process.exit(1);
}
if (!cssContent.includes('.timeline-expanded-content')) {
  console.error('FAIL: styles.css missing .timeline-expanded-content');
  process.exit(1);
}
console.log('✔ styles.css has all required Cosmos Glassmorphism classes and expandable styles');

// 7. Verify search algorithm across edge cases
const normalizeForSearch = (str) => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim();
};

const releaseMatchesQuery = (rel, query) => {
  if (!query || !query.trim()) return true;
  const q = normalizeForSearch(query);
  const qRaw = query.toLowerCase().trim();

  const fields = [
    rel.version,
    `v${rel.version}`,
    rel.tag,
    rel.title,
    rel.summary
  ];
  if (Array.isArray(rel.notes)) fields.push(...rel.notes);
  if (rel.categorized_notes) {
    if (Array.isArray(rel.categorized_notes.features)) fields.push(...rel.categorized_notes.features);
    if (Array.isArray(rel.categorized_notes.improvements)) fields.push(...rel.categorized_notes.improvements);
    if (Array.isArray(rel.categorized_notes.fixes)) fields.push(...rel.categorized_notes.fixes);
  }
  if (rel.files) {
    Object.values(rel.files).forEach(f => {
      if (f.filename) fields.push(f.filename);
      if (f.platform) fields.push(f.platform);
      if (f.sha256) fields.push(f.sha256);
      if (f.size_formatted) fields.push(f.size_formatted);
    });
  }

  return fields.some(field => {
    if (!field) return false;
    const norm = normalizeForSearch(field);
    const raw = String(field).toLowerCase();
    return norm.includes(q) || raw.includes(qRaw);
  });
};

const ed25519Match = releasesData.releases.filter(r => releaseMatchesQuery(r, 'ed25519'));
if (ed25519Match.length === 0) {
  console.error('FAIL: ed25519 did not match any releases');
  process.exit(1);
}

const tiengVietMatch = releasesData.releases.filter(r => releaseMatchesQuery(r, 'tieng viet'));
if (tiengVietMatch.length === 0) {
  console.error('FAIL: unaccented "tieng viet" did not match any releases');
  process.exit(1);
}

const msiMatch = releasesData.releases.filter(r => releaseMatchesQuery(r, 'msi'));
if (msiMatch.length === 0) {
  console.error('FAIL: "msi" did not match any releases');
  process.exit(1);
}
console.log('✔ Search algorithm passed all accentless and categorized notes edge case tests');

console.log('=== ALL RELEASE & HOME CHECKS PASSED ===');
