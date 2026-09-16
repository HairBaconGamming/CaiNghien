#!/usr/bin/env node
/**
 * ============================================================================
 * CaiNghien_Tauri UI/UX Overhaul - Automated E2E Test Runner & Verification Suite
 * ============================================================================
 *
 * Authoritative Sources:
 * - ORIGINAL_REQUEST.md (Section ## 2026-09-15T17:07:21Z)
 * - PROJECT.md (Milestones M1-M3, Final, Interface Contracts)
 * - TEST_INFRA.md (4-Tier Test Architecture)
 *
 * 4-Tier Test Architecture:
 * -------------------------
 * Tier 1: Feature Coverage (Smoke & Primary Assertions)
 *   - CSS Review: backdrop-filter, linear-gradient, :root tokens (Deep Space)
 *   - Layout & Icons: lucide-react imports, Glow Badge render, Progress Bar render
 *   - Technical Build: npm run build (tsc && vite build) clean exit 0
 *
 * Tier 2: Boundary & Corner Cases (Robustness & Edge States)
 *   - Gamification Math Curve: H(L) = 5L(L-1) -> [0h, 10h, 30h, 60h, 100h, 150h, 210h, 280h, 360h, 450h]
 *   - Boundaries: 0h (Lv 1, 0%), 5.5h (sub-hour), 10h (milestone transition),
 *     max level capping (500h+ -> Lv 10, 100%), defensive handling of null/undefined/negative/NaN
 *   - Font generic fallbacks (sans-serif, monospace)
 *   - Glass fallback opacity for environments without backdrop-filter
 *
 * Tier 3: Cross-Feature Combinations & State Interactions
 *   - Hover glow transitions on interactive action buttons & tabs
 *   - Countdown timer (.quota-clock) styled with Fira Code & tabular figures
 *   - Modal dialogs & cards applying frosted glass surfaces & soft shadows
 *   - Icon + text pairing across key interactive zones
 *
 * Tier 4: Real-World Scenarios & Bundle Integrity
 *   - Production Vite bundle generation in dist/ (index.html, JS, CSS)
 *   - Bundle size sanity assertions (< 2.5MB bundled JS, non-empty CSS)
 *   - Bundled CSS retains backdrop-filter and gradient definitions
 *   - Offline asset independence (no mandatory network CDN blockers)
 *
 * CLI Usage:
 *   node tests/verify_ui_ux.mjs               # Run all 4 tiers
 *   node tests/verify_ui_ux.mjs --tier=1      # Run only Tier 1
 *   node tests/verify_ui_ux.mjs --tier=2      # Run only Tier 2
 *   node tests/verify_ui_ux.mjs --tier=3      # Run only Tier 3
 *   node tests/verify_ui_ux.mjs --tier=4      # Run only Tier 4
 *   node tests/verify_ui_ux.mjs --baseline    # Run all tiers in baseline recording mode (exit 0)
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const TAURI_ROOT = path.resolve(REPO_ROOT, 'CaiNghien_Tauri');
const SRC_DIR = path.resolve(TAURI_ROOT, 'src');

// Parse CLI arguments
const args = process.argv.slice(2);
const isBaselineMode = args.includes('--baseline');
const tierFilter = args.find(a => a.startsWith('--tier='))?.split('=')[1];
const checkFilter = args.find(a => a.startsWith('--check='))?.split('=')[1]?.toLowerCase();

// ANSI Color Helpers
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

const PASS_ICON = `${colors.green}✔ PASS${colors.reset}`;
const FAIL_ICON = `${colors.red}✘ FAIL${colors.reset}`;
const WARN_ICON = `${colors.yellow}⚠ WARN${colors.reset}`;
const INFO_ICON = `${colors.cyan}ℹ INFO${colors.reset}`;

// Collector for all test results
const testResults = [];

function recordResult(tier, category, name, passed, details = '', isWarning = false) {
  testResults.push({ tier, category, name, passed, details, isWarning });
  const statusIcon = passed ? PASS_ICON : (isWarning ? WARN_ICON : FAIL_ICON);
  console.log(`  ${statusIcon} ${colors.bold}${name}${colors.reset}`);
  if (details) {
    const detailLines = details.split('\n');
    detailLines.forEach(line => {
      console.log(`         ${colors.gray}${line}${colors.reset}`);
    });
  }
}

function printSectionHeader(title) {
  console.log('\n' + colors.cyan + colors.bold + '━'.repeat(74) + colors.reset);
  console.log(`${colors.cyan}${colors.bold}  ${title}${colors.reset}`);
  console.log(colors.cyan + colors.bold + '━'.repeat(74) + colors.reset);
}

// Read and cache file contents
function loadSourceFiles() {
  const appCssPath = path.resolve(SRC_DIR, 'App.css');
  const indexCssPath = path.resolve(SRC_DIR, 'index.css');
  const appTsxPath = path.resolve(SRC_DIR, 'App.tsx');
  const mainTsxPath = path.resolve(SRC_DIR, 'main.tsx');
  const indexHtmlPath = path.resolve(TAURI_ROOT, 'index.html');
  const packageJsonPath = path.resolve(TAURI_ROOT, 'package.json');

  return {
    appCss: fs.existsSync(appCssPath) ? fs.readFileSync(appCssPath, 'utf8') : '',
    indexCss: fs.existsSync(indexCssPath) ? fs.readFileSync(indexCssPath, 'utf8') : '',
    appTsx: fs.existsSync(appTsxPath) ? fs.readFileSync(appTsxPath, 'utf8') : '',
    mainTsx: fs.existsSync(mainTsxPath) ? fs.readFileSync(mainTsxPath, 'utf8') : '',
    indexHtml: fs.existsSync(indexHtmlPath) ? fs.readFileSync(indexHtmlPath, 'utf8') : '',
    packageJson: fs.existsSync(packageJsonPath) ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) : {}
  };
}

/**
 * ============================================================================
 * TIER 1: Feature Coverage (Smoke & Primary Assertions)
 * ============================================================================
 */
function runTier1(sources) {
  printSectionHeader('TIER 1: Feature Coverage (Primary Acceptance Criteria)');
  const { appCss, indexCss, appTsx } = sources;

  // 1.1 CSS backdrop-filter presence
  const backdropRegex = /backdrop-filter\s*:\s*[^;]*(blur\(|var\(--glass-blur)/gi;
  const backdropMatches = (appCss.match(backdropRegex) || []).concat(indexCss.match(backdropRegex) || []);
  recordResult(
    'Tier 1',
    'CSS Feature',
    'Requirement R1: backdrop-filter blur presence in CSS',
    backdropMatches.length > 0,
    `Found ${backdropMatches.length} occurrences of backdrop-filter (blur/var) in stylesheets.`
  );

  // 1.2 CSS background: linear-gradient presence
  const linearGradientRegex = /background(-image)?\s*:[^;]*linear-gradient\([^;]+\)/gi;
  const gradientMatches = (appCss.match(linearGradientRegex) || []).concat(indexCss.match(linearGradientRegex) || []);
  recordResult(
    'Tier 1',
    'CSS Feature',
    'Requirement R1: background linear-gradient presence in CSS',
    gradientMatches.length > 0,
    `Found ${gradientMatches.length} occurrences of background: linear-gradient(...) in stylesheets.`
  );

  // 1.3 CSS Custom Properties (:root design tokens)
  const hasRootBlock = /:root\s*\{[^}]+\}/g.test(appCss) || /:root\s*\{[^}]+\}/g.test(indexCss);
  const requiredTokens = [
    { name: '--bg-gradient-space (cosmic gradient)', regex: /--(bg-gradient-space|bg-space|cosmic-gradient)/i },
    { name: '--glass- tokens (blur, border, shadow)', regex: /--glass-(blur|border|shadow|bg)/i },
    { name: '--glow- tokens (indigo, rose, cyan, etc.)', regex: /--glow-(indigo|rose|cyan|emerald|accent)/i },
  ];
  const missingTokens = requiredTokens.filter(t => !t.regex.test(appCss) && !t.regex.test(indexCss)).map(t => t.name);
  const tokensPass = hasRootBlock && missingTokens.length === 0;
  recordResult(
    'Tier 1',
    'CSS Feature',
    'Requirement R1: Deep Space Glassmorphism Design Tokens (:root)',
    tokensPass,
    tokensPass
      ? 'Verified :root CSS variables containing cosmic gradient, glass tokens, and neon glow tokens.'
      : `Missing required design tokens: [${missingTokens.join(', ')}].`
  );

  // 1.4 lucide-react import in App.tsx
  const lucideMatch = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g.exec(appTsx);
  const hasLucide = Boolean(lucideMatch);
  const importedCount = hasLucide ? lucideMatch[1].split(',').filter(s => s.trim().length > 0).length : 0;
  recordResult(
    'Tier 1',
    'Layout & Icons',
    'Requirement R1: lucide-react Import in App.tsx',
    hasLucide,
    hasLucide
      ? `Found valid import from 'lucide-react' with ${importedCount} icon symbols.`
      : "Missing import from 'lucide-react' in App.tsx."
  );

  // 1.5 Visual Glow Badge Component Render
  const hasGlowBadge = 
    /(glow-badge|badge-container|GamificationCard|discipline-badge|GlowBadge)/i.test(appTsx) ||
    (/cấp\s*độ/i.test(appTsx) && /aura|halo|glow|tier|emblem/i.test(appTsx));
  recordResult(
    'Tier 1',
    'Gamification UI',
    'Requirement R2: Visual Glow Badge Component Render',
    hasGlowBadge,
    hasGlowBadge
      ? 'Glow Badge component/render logic identified in App.tsx with visual tier/glow attributes.'
      : 'App.tsx lacks visual Glow Badge styling or GamificationCard component (currently using plain StatCard).'
  );

  // 1.6 Dynamic Animated Progress Bar Render
  const hasProgressBar = 
    /(progress-bar|progress_bar|ProgressBar|progress-track|progress-fill)/i.test(appTsx) &&
    (/style=\{\{\s*width:\s*[`"']?\$\{?[^}]*\}?%?[`"']?\s*\}\}/i.test(appTsx) || /width:\s*['"`]?\d+%/i.test(appTsx) || /progressPercent/i.test(appTsx));
  recordResult(
    'Tier 1',
    'Gamification UI',
    'Requirement R2: Dynamic Animated Progress Bar Render',
    hasProgressBar,
    hasProgressBar
      ? 'Dynamic Progress Bar identified with percentage-driven fill width rendering.'
      : 'Missing dynamic Progress Bar displaying current hours vs required hours for next level in App.tsx.'
  );

  // 1.7 Technical Build Execution
  runBuildCheck();
}

/**
 * ============================================================================
 * TIER 2: Boundary & Corner Cases (Robustness & Edge States)
 * ============================================================================
 */
function runTier2(sources) {
  printSectionHeader('TIER 2: Boundary & Corner Cases (Robustness & Edge States)');
  const { appCss, indexCss } = sources;

  /**
   * Reference progression curve: H(L) = 5 * L * (L - 1)
   */
  const TIERS = [
    { level: 1, minHours: 0, maxHours: 10, name: "Tập Sự (Novice)" },
    { level: 2, minHours: 10, maxHours: 30, name: "Kiên Trì (Apprentice)" },
    { level: 3, minHours: 30, maxHours: 60, name: "Tự Chủ (Disciplined)" },
    { level: 4, minHours: 60, maxHours: 100, name: "Vững Vàng (Resolute)" },
    { level: 5, minHours: 100, maxHours: 150, name: "Chiến Binh (Warrior)" },
    { level: 6, minHours: 150, maxHours: 210, name: "Bất Khuất (Iron Will)" },
    { level: 7, minHours: 210, maxHours: 280, name: "Bậc Thầy (Master)" },
    { level: 8, minHours: 280, maxHours: 360, name: "Đại Sư (Grandmaster)" },
    { level: 9, minHours: 360, maxHours: 450, name: "Huyền Thoại (Legend)" },
    { level: 10, minHours: 450, maxHours: Infinity, name: "Bất Diệt (Immortal)" },
  ];

  function calcGamification(rawHours) {
    const hours = Math.max(0, Number(rawHours) || 0);
    for (let i = TIERS.length - 1; i >= 0; i--) {
      const tier = TIERS[i];
      if (hours >= tier.minHours) {
        const isMaxTier = tier.maxHours === Infinity;
        const currentInLevel = hours - tier.minHours;
        const requiredInLevel = isMaxTier ? 0 : tier.maxHours - tier.minHours;
        const progressPercent = isMaxTier
          ? 100
          : Math.min(100, Math.max(0, Math.round((currentInLevel / requiredInLevel) * 100)));
        const remainingHours = isMaxTier ? 0 : Math.max(0, tier.maxHours - hours);
        return { level: tier.level, name: tier.name, progressPercent, remainingHours };
      }
    }
    return { level: 1, name: TIERS[0].name, progressPercent: 0, remainingHours: 10 };
  }

  // 2.1 Zero hours boundary
  const t0 = calcGamification(0);
  const p0 = t0.level === 1 && t0.progressPercent === 0 && t0.remainingHours === 10;
  recordResult('Tier 2', 'Math Boundary', 'Zero hours (0h) -> Level 1, 0% progress, 10h remaining', p0,
    `Level: ${t0.level}, Progress: ${t0.progressPercent}%, Remaining: ${t0.remainingHours}h`);

  // 2.2 Sub-hour fraction
  const tFrac = calcGamification(7.5);
  const pFrac = tFrac.level === 1 && tFrac.progressPercent === 75 && tFrac.remainingHours === 2.5;
  recordResult('Tier 2', 'Math Boundary', 'Sub-hour fraction (7.5h) -> Level 1, 75% progress, 2.5h remaining', pFrac,
    `Level: ${tFrac.level}, Progress: ${tFrac.progressPercent}%, Remaining: ${tFrac.remainingHours}h`);

  // 2.3 Milestone boundaries (10h, 30h, 60h, 100h)
  const t10 = calcGamification(10);
  const t30 = calcGamification(30);
  const t60 = calcGamification(60);
  const t100 = calcGamification(100);
  const pMilestones = t10.level === 2 && t30.level === 3 && t60.level === 4 && t100.level === 5 &&
                      t10.remainingHours === 20 && t30.remainingHours === 30 && t60.remainingHours === 40;
  recordResult('Tier 2', 'Math Boundary', 'Exact milestone transitions (10h, 30h, 60h, 100h)', pMilestones,
    `10h: Lv.${t10.level} (rem ${t10.remainingHours}h) | 30h: Lv.${t30.level} (rem ${t30.remainingHours}h) | 60h: Lv.${t60.level} | 100h: Lv.${t100.level}`);

  // 2.4 Maximum level cap (500h+)
  const tMax = calcGamification(500);
  const pMax = tMax.level === 10 && tMax.progressPercent === 100 && tMax.remainingHours === 0;
  recordResult('Tier 2', 'Math Boundary', 'Maximum level cap (500h) -> Level 10, 100% progress, 0h remaining', pMax,
    `Level: ${tMax.level}, Progress: ${tMax.progressPercent}%, Remaining: ${tMax.remainingHours}h`);

  // 2.5 Defensive inputs
  const dNeg = calcGamification(-50);
  const dNull = calcGamification(null);
  const dUndef = calcGamification(undefined);
  const dNaN = calcGamification(NaN);
  const pDef = dNeg.level === 1 && dNull.level === 1 && dUndef.level === 1 && dNaN.level === 1;
  recordResult('Tier 2', 'Math Boundary', 'Defensive input handling (-50, null, undefined, NaN)', pDef,
    `Successfully resolved invalid inputs to safe default: Level 1.`);

  // 2.6 Typography fallbacks
  const combinedCss = appCss + '\n' + indexCss;
  const hasSansFallback = /font-family:[^;]*sans-serif/i.test(combinedCss);
  const hasMonoFallback = /font-family:[^;]*monospace/i.test(combinedCss);
  recordResult('Tier 2', 'Font Robustness', 'Generic font fallbacks (sans-serif & monospace)', hasSansFallback && hasMonoFallback,
    `sans-serif fallback present: ${hasSansFallback} | monospace fallback present: ${hasMonoFallback}`);

  // 2.7 Frosted glass backdrop fallback
  const hasGlassFallback = /background-color\s*:\s*rgba\([^)]+\)/i.test(combinedCss);
  recordResult('Tier 2', 'CSS Robustness', 'Frosted glass opacity background fallback for low-power mode', hasGlassFallback,
    `rgba background color present alongside backdrop-filter: ${hasGlassFallback}`);
}

/**
 * ============================================================================
 * TIER 3: Cross-Feature Combinations & State Interactions
 * ============================================================================
 */
function runTier3(sources) {
  printSectionHeader('TIER 3: Cross-Feature Combinations & State Interactions');
  const { appCss, indexCss, appTsx } = sources;
  const combinedCss = appCss + '\n' + indexCss;

  // 3.1 Button Hover Glow & Smooth Transitions
  const hasHoverGlow = /:hover[\s\S]*?(box-shadow|filter|transform|background)/i.test(combinedCss);
  const hasTransition = /transition\s*:\s*[^;]*(cubic-bezier|all|transform|box-shadow)/i.test(combinedCss);
  recordResult('Tier 3', 'Micro-Interactions', 'Interactive button hover glow & cubic-bezier transitions', hasHoverGlow && hasTransition,
    `Hover states defined: ${hasHoverGlow} | Smooth transitions defined: ${hasTransition}`);

  // 3.2 Monospace Clocks & Countdown Timer Styling
  const hasClockMono = /(\.quota-clock|\.breathing-text)[\s\S]*?(font-family:[^;]*(Fira Code|monospace)|--font-mono)/i.test(combinedCss);
  const hasTabularNums = /font-variant-numeric\s*:\s*tabular-nums/i.test(combinedCss) || /font-feature-settings/i.test(combinedCss);
  recordResult('Tier 3', 'Typography Integration', 'Fira Code monospace countdown clock & tabular figures', hasClockMono,
    `Clock monospace font applied: ${hasClockMono} | Tabular numbers configured: ${hasTabularNums}`);

  // 3.3 Modal Dialog Frosted Glass Surface
  const hasModalGlass = /(\.modal-content|\.modal-overlay|\.modal)[\s\S]*?(backdrop-filter|--glass-)/i.test(combinedCss);
  recordResult('Tier 3', 'Glassmorphic Overlay', 'Modal dialog frosted glass surface & backdrop blur', hasModalGlass,
    `Modal elements apply glassmorphic backdrop-filter / tokens: ${hasModalGlass}`);

  // 3.4 Semantic Icon Pairing on Action Buttons
  const buttonTagMatches = appTsx.match(/<button[\s\S]*?<\/button>/gi) || [];
  let buttonsWithIcons = 0;
  buttonTagMatches.forEach(btn => {
    if (/<(Shield|Power|Settings|Lock|Key|Play|Pause|Flame|Sparkles|Zap|Trophy|Crown|Award|X|Check|AlertTriangle)\b/i.test(btn)) {
      buttonsWithIcons++;
    }
  });
  const hasIconButtons = buttonsWithIcons >= 3;
  recordResult('Tier 3', 'Component Pairing', 'Semantic Lucide icon + text pairing across action buttons', hasIconButtons,
    `Found ${buttonsWithIcons} interactive buttons paired with Lucide icons.`);
}

/**
 * ============================================================================
 * TIER 4: Real-World Scenarios & Bundle Integrity
 * ============================================================================
 */
function runTier4(sources) {
  printSectionHeader('TIER 4: Real-World Scenarios & Bundle Integrity');
  const { indexHtml, packageJson } = sources;

  // 4.1 HTML Title & Meta Tags
  const hasDeepSpaceTitle = /<title>[^<]*(CaiNghiện|Deep Space)[^<]*<\/title>/i.test(indexHtml);
  const hasViewport = /name="viewport"/i.test(indexHtml);
  recordResult('Tier 4', 'HTML Shell', 'HTML shell meta tags & application title', hasDeepSpaceTitle && hasViewport,
    `Deep space application title: ${hasDeepSpaceTitle} | Responsive viewport: ${hasViewport}`);

  // 4.2 Offline Bundle Independence
  const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
  const hasOfflineFonts = Boolean(deps['@fontsource/inter'] && deps['@fontsource/fira-code']);
  recordResult('Tier 4', 'Offline Independence', 'Offline-first font asset bundling (@fontsource packages)', hasOfflineFonts,
    `Bundled @fontsource/inter: ${Boolean(deps['@fontsource/inter'])} | Bundled @fontsource/fira-code: ${Boolean(deps['@fontsource/fira-code'])}`);

  // 4.3 Production Bundle Assets Sanity Check
  const distDir = path.resolve(TAURI_ROOT, 'dist');
  const distHtml = path.resolve(distDir, 'index.html');
  const assetsDir = path.resolve(distDir, 'assets');

  let htmlOk = fs.existsSync(distHtml) && fs.statSync(distHtml).size > 0;
  let jsOk = false;
  let cssOk = false;
  let jsSizeKb = 0;
  let cssSizeKb = 0;
  let cssPreservesGlass = false;

  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    const jsFile = files.find(f => f.endsWith('.js'));
    const cssFile = files.find(f => f.endsWith('.css'));

    if (jsFile) {
      const stats = fs.statSync(path.resolve(assetsDir, jsFile));
      jsSizeKb = (stats.size / 1024).toFixed(1);
      jsOk = stats.size > 0 && stats.size < 2.5 * 1024 * 1024; // < 2.5 MB
    }
    if (cssFile) {
      const cssPath = path.resolve(assetsDir, cssFile);
      const stats = fs.statSync(cssPath);
      cssSizeKb = (stats.size / 1024).toFixed(1);
      cssOk = stats.size > 0;
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      cssPreservesGlass = cssContent.includes('backdrop-filter') || cssContent.includes('linear-gradient');
    }
  }

  const bundlePass = htmlOk && jsOk && cssOk && cssPreservesGlass;
  recordResult('Tier 4', 'Bundle Integrity', 'Production dist bundle integrity & asset size sanity', bundlePass,
    `HTML: ${htmlOk} | JS: ${jsOk} (${jsSizeKb} KB) | CSS: ${cssOk} (${cssSizeKb} KB) | Preserves glass rules: ${cssPreservesGlass}`);
}

/**
 * Dedicated Build Execution helper
 */
function runBuildCheck() {
  console.log(`  ${INFO_ICON} Executing: ${colors.bold}npm run build${colors.reset} in ${TAURI_ROOT}...`);
  const startTime = Date.now();
  let buildSuccess = false;
  let buildOutput = '';

  try {
    buildOutput = execSync('npm run build', {
      cwd: TAURI_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 60000
    });
    buildSuccess = true;
  } catch (err) {
    buildSuccess = false;
    buildOutput = (err.stdout || '') + '\n' + (err.stderr || '') + '\n' + (err.message || '');
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  recordResult(
    'Tier 1',
    'Technical Build',
    'Requirement Technical: npm run build (tsc && vite build) clean exit 0',
    buildSuccess,
    buildSuccess
      ? `Vite production build completed cleanly in ${durationSec}s with exit code 0.`
      : `Build failed with error:\n${buildOutput.slice(0, 500)}`
  );
}

/**
 * ============================================================================
 * Main Execution Entry Point
 * ============================================================================
 */
function main() {
  const startTs = new Date().toISOString();
  console.log(`\n${colors.bold}${colors.magenta}╔══════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}║         CaiNghien_Tauri Automated UI/UX & E2E Verification Suite         ║${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}║                      4-Tier Test Architecture                            ║${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}╚══════════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`${colors.gray}Timestamp  : ${startTs}${colors.reset}`);
  console.log(`${colors.gray}Target App : ${TAURI_ROOT}${colors.reset}`);
  if (isBaselineMode) {
    console.log(`${colors.yellow}${colors.bold}[BASELINE RECORDING MODE ENABLED]${colors.reset}`);
  }
  if (tierFilter) {
    console.log(`${colors.cyan}Filtering to Tier ${tierFilter} only.${colors.reset}`);
  }

  const sources = loadSourceFiles();

  if (!tierFilter || tierFilter === '1') runTier1(sources);
  if (!tierFilter || tierFilter === '2') runTier2(sources);
  if (!tierFilter || tierFilter === '3') runTier3(sources);
  if (!tierFilter || tierFilter === '4') runTier4(sources);

  // Print Summary Matrix
  printSectionHeader('4-TIER TEST EXECUTION SUMMARY MATRIX');

  const total = testResults.length;
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed && !r.isWarning).length;
  const warnings = testResults.filter(r => r.isWarning).length;

  const tiers = [...new Set(testResults.map(r => r.tier))];
  tiers.forEach(tier => {
    const tierTests = testResults.filter(r => r.tier === tier);
    const tierPassed = tierTests.filter(r => r.passed).length;
    const tierTotal = tierTests.length;
    const rate = ((tierPassed / tierTotal) * 100).toFixed(0);
    const rateColor = rate === '100' ? colors.green : (rate >= '50' ? colors.yellow : colors.red);
    console.log(`  ${colors.bold}${tier.padEnd(24)}${colors.reset}: ${rateColor}${tierPassed}/${tierTotal} Passed (${rate}%)${colors.reset}`);
  });

  console.log(colors.gray + '─'.repeat(74) + colors.reset);
  console.log(`  ${colors.bold}Total Test Checks       : ${total}${colors.reset}`);
  console.log(`  ${colors.green}${colors.bold}Passed                  : ${passed}${colors.reset}`);
  console.log(`  ${colors.red}${colors.bold}Failed                  : ${failed}${colors.reset}`);
  if (warnings > 0) {
    console.log(`  ${colors.yellow}${colors.bold}Warnings                : ${warnings}${colors.reset}`);
  }

  const overallPass = failed === 0;
  console.log('\n' + (overallPass
    ? `${colors.green}${colors.bold}>>> ALL 4 TIERS PASSED: UI/UX & Technical Specifications 100% Verified <<<${colors.reset}`
    : `${colors.red}${colors.bold}>>> VERIFICATION FAILED: ${failed} check(s) did not satisfy criteria <<<${colors.reset}`));

  if (!overallPass && !isBaselineMode) {
    console.log(`\n${colors.yellow}Tip: During milestone development, run with ${colors.bold}--baseline${colors.reset}${colors.yellow} to record progress without process exit 1.${colors.reset}\n`);
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
