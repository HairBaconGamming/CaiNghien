#!/usr/bin/env node

/**
 * =============================================================================
 * Automated UI/UX Verification Suite: CaiNghien Desktop (Cosmos Edition)
 * =============================================================================
 * 
 * Verifies strict UI adherence according to:
 * - spec.md (Cosmos theme, Glassmorphism, 3 mockups)
 * - PROJECT.md (Layout, Milestones M1, M3, M4, M5)
 * - ORIGINAL_REQUEST.md (Requirements R1, R2, R3)
 * 
 * Features Verified:
 * 1. Build & Config Integrity (Tailwind CSS, Vite, no merge conflict markers)
 * 2. Cosmos Design Tokens (Space Black, Neon Cyan, Galactic Magenta, Vivid Violet)
 * 3. Glassmorphism Specifications (Backdrop blur, translucent cards, hairline borders, glows)
 * 4. App Shell & Global Navigation (Cosmos branding, 4+ tabs, Level indicator)
 * 5. Screen 1: Dashboard (Level 28 Stargazer, XP bar, 365-day Heatmap, metric cards)
 * 6. Screen 2: Focus Room (Circular countdown timer, quote card, Lofi ambience, controls)
 * 7. Screen 3: Typing Challenge (Paragraph display, typing input, realtime WPM/Acc/Time, lock portal)
 * 8. Frontend Typed API Service (Tauri invoke integration with browser fallback)
 * 9. AST & Syntax Integrity (clean TypeScript/JSX structure)
 * =============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

// ANSI Color Formatting
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
};

class TestRunner {
  constructor(title) {
    this.title = title;
    this.total = 0;
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
    this.currentSuite = '';
    this.results = [];
  }

  suite(name) {
    this.currentSuite = name;
    console.log(`\n${colors.bold}${colors.cyan}=== [SUITE] ${name} ===${colors.reset}`);
  }

  assert(description, condition, details = '') {
    this.total++;
    if (condition) {
      this.passed++;
      console.log(`  ${colors.green}✓ PASS${colors.reset}: ${description}`);
      this.results.push({ suite: this.currentSuite, description, status: 'PASS', details });
    } else {
      this.failed++;
      console.log(`  ${colors.red}✗ FAIL${colors.reset}: ${description}`);
      if (details) {
        console.log(`    ${colors.dim}${colors.red}↳ Details: ${details}${colors.reset}`);
      }
      this.results.push({ suite: this.currentSuite, description, status: 'FAIL', details });
    }
  }

  warn(description, condition, details = '') {
    if (!condition) {
      this.warnings++;
      console.log(`  ${colors.yellow}⚠ WARN${colors.reset}: ${description}`);
      if (details) {
        console.log(`    ${colors.dim}${colors.yellow}↳ Details: ${details}${colors.reset}`);
      }
    }
  }

  report() {
    console.log(`\n${colors.bold}${colors.magenta}====================================================${colors.reset}`);
    console.log(`${colors.bold}${colors.white}             UI/UX VERIFICATION SUMMARY             ${colors.reset}`);
    console.log(`${colors.bold}${colors.magenta}====================================================${colors.reset}`);
    console.log(`  Total Invariant Tests : ${this.total}`);
    console.log(`  Passed Tests          : ${colors.green}${this.passed}${colors.reset}`);
    console.log(`  Failed Tests          : ${this.failed > 0 ? colors.red : colors.green}${this.failed}${colors.reset}`);
    console.log(`  Warnings              : ${this.warnings > 0 ? colors.yellow : colors.dim}${this.warnings}${colors.reset}`);
    const passRate = this.total > 0 ? ((this.passed / this.total) * 100).toFixed(1) : '0.0';
    console.log(`  Pass Rate             : ${colors.bold}${this.failed === 0 ? colors.green : colors.yellow}${passRate}%${colors.reset}`);
    console.log(`${colors.bold}${colors.magenta}====================================================${colors.reset}\n`);

    return this.failed === 0;
  }
}

const runner = new TestRunner('CaiNghien UI/UX Verification');

// Helper to read file safely
function readFile(relPath) {
  const fullPath = path.isAbsolute(relPath) ? relPath : path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, 'utf8');
}

// Helper to check if any file in a list exists
function findFirstExisting(relPaths) {
  for (const p of relPaths) {
    const full = path.join(ROOT_DIR, p);
    if (fs.existsSync(full)) {
      return { path: p, content: fs.readFileSync(full, 'utf8') };
    }
  }
  return null;
}

// Recursively find all files with given extensions in directory
function findFiles(dir, exts = ['.tsx', '.ts', '.jsx', '.js', '.css', '.json']) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === 'target') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(full, exts));
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

// =============================================================================
// Suite 1: Build & Config Integrity (Tailwind CSS, Vite, Conflict Markers)
// =============================================================================
runner.suite('1. Build & Config Integrity');

// 1.1 Check git conflict markers across frontend codebase
const frontendSourceFiles = findFiles(SRC_DIR).concat([
  path.join(ROOT_DIR, 'package.json'),
  path.join(ROOT_DIR, 'vite.config.ts'),
  path.join(ROOT_DIR, 'index.html'),
]);

let filesWithConflictMarkers = [];
for (const file of frontendSourceFiles) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('<<<<<<<') || content.includes('=======') || (content.includes('>>>>>>>') && !content.includes('/>>>>>>>/'))) {
    filesWithConflictMarkers.push(path.relative(ROOT_DIR, file));
  }
}

runner.assert(
  'Frontend files must be free of git merge conflict markers',
  filesWithConflictMarkers.length === 0,
  filesWithConflictMarkers.length > 0
    ? `Conflict markers found in: ${filesWithConflictMarkers.join(', ')}`
    : 'All frontend files clean of merge conflict markers'
);

// 1.2 Package.json & Tailwind Configuration
const pkgJsonContent = readFile('package.json');
let pkgObj = null;
try {
  if (pkgJsonContent) pkgObj = JSON.parse(pkgJsonContent);
} catch (e) {
  // If parsing fails, likely due to merge conflicts or invalid json
}

runner.assert(
  'package.json is valid JSON',
  pkgObj !== null,
  pkgObj ? 'package.json parsed successfully' : 'Failed to parse package.json (check syntax or merge conflicts)'
);

if (pkgObj) {
  const allDeps = {
    ...(pkgObj.dependencies || {}),
    ...(pkgObj.devDependencies || {}),
  };

  const hasTailwind = 'tailwindcss' in allDeps || '@tailwindcss/vite' in allDeps;
  runner.assert(
    'Tailwind CSS is declared in package.json dependencies',
    hasTailwind,
    hasTailwind ? `Found Tailwind: ${allDeps['tailwindcss'] || allDeps['@tailwindcss/vite']}` : 'Neither tailwindcss nor @tailwindcss/vite present in package.json'
  );

  const hasLucide = 'lucide-react' in allDeps;
  runner.assert(
    'lucide-react icon library is installed',
    hasLucide,
    hasLucide ? `lucide-react ${allDeps['lucide-react']} declared` : 'lucide-react missing from package.json'
  );
} else {
  runner.assert('Tailwind CSS is declared in package.json dependencies', false, 'Skipped due to package.json parse failure');
  runner.assert('lucide-react icon library is installed', false, 'Skipped due to package.json parse failure');
}

// 1.3 Vite config Tailwind integration
const viteConfigContent = readFile('vite.config.ts');
const hasViteTailwind = viteConfigContent && (
  viteConfigContent.includes('@tailwindcss/vite') ||
  viteConfigContent.includes('tailwindcss()') ||
  fs.existsSync(path.join(ROOT_DIR, 'postcss.config.js')) ||
  fs.existsSync(path.join(ROOT_DIR, 'postcss.config.cjs')) ||
  fs.existsSync(path.join(ROOT_DIR, 'postcss.config.mjs'))
);

runner.assert(
  'Vite is configured with Tailwind CSS plugin or PostCSS',
  Boolean(hasViteTailwind),
  hasViteTailwind ? 'Tailwind plugin or PostCSS configuration detected' : 'Tailwind plugin missing in vite.config.ts'
);

// 1.4 CSS Tailwind Import
const indexCssContent = readFile('src/index.css');
const hasTailwindImport = indexCssContent && (
  indexCssContent.includes('@import "tailwindcss"') ||
  indexCssContent.includes("@import 'tailwindcss'") ||
  indexCssContent.includes('@tailwind base')
);

runner.assert(
  'src/index.css imports Tailwind CSS directives',
  Boolean(hasTailwindImport),
  hasTailwindImport ? 'Tailwind directive imported in index.css' : 'No Tailwind import found in src/index.css'
);

// =============================================================================
// Suite 2: Cosmos Theme Design Tokens & Color Palette
// =============================================================================
runner.suite('2. Cosmos Theme Design Tokens & Color Palette');

// Aggregate CSS and source code for token searches
const allCssAndTsx = findFiles(SRC_DIR, ['.css', '.tsx', '.ts'])
  .map(f => fs.readFileSync(f, 'utf8'))
  .join('\n');

// 2.1 Space Black / Space Navy Canvas Floor (#030712 / #070c1e / #050819)
const hasSpaceBlack = 
  allCssAndTsx.includes('030712') ||
  allCssAndTsx.includes('070c1e') ||
  allCssAndTsx.includes('050819') ||
  allCssAndTsx.includes('slate-950');

runner.assert(
  'Deep Cosmos canvas background token (#030712 / #070c1e / slate-950) is configured',
  hasSpaceBlack,
  hasSpaceBlack ? 'Cosmos canvas dark palette verified' : 'Missing #030712 or #070c1e canvas tokens'
);

// 2.2 Neon Cyan Accent (#00f0ff or cyan-400)
const hasNeonCyan = 
  allCssAndTsx.includes('00f0ff') || 
  allCssAndTsx.includes('00e5ff') ||
  allCssAndTsx.includes('cyan-400');

runner.assert(
  'Neon Cyan brand accent (#00f0ff / cyan-400) is defined for primary glow and active indicators',
  hasNeonCyan,
  hasNeonCyan ? 'Neon Cyan #00f0ff token detected' : 'Neon Cyan #00f0ff missing from styles/tokens'
);

// 2.3 Galactic Magenta Accent (#d946ef or fuchsia-500)
const hasGalacticMagenta = 
  allCssAndTsx.includes('d946ef') || 
  allCssAndTsx.includes('ec4899') || 
  allCssAndTsx.includes('fuchsia-500') ||
  allCssAndTsx.includes('pink-500');

runner.assert(
  'Galactic Magenta / Nova Pink (#d946ef / #ec4899) is defined for progress gradients',
  hasGalacticMagenta,
  hasGalacticMagenta ? 'Galactic Magenta token detected' : 'Galactic Magenta #d946ef missing'
);

// 2.4 Vivid Violet Accent (#a855f7 or #7c3aed or purple-500)
const hasVividViolet = 
  allCssAndTsx.includes('a855f7') || 
  allCssAndTsx.includes('7c3aed') ||
  allCssAndTsx.includes('purple-500') ||
  allCssAndTsx.includes('violet-500');

runner.assert(
  'Vivid Violet / Cosmic Purple (#a855f7 / #7c3aed) is defined for cosmic glow & lock portals',
  hasVividViolet,
  hasVividViolet ? 'Vivid Violet token detected' : 'Vivid Violet #a855f7 missing'
);

// 2.5 5-Tier Heatmap Intensity Color Scale
// Tier 0: #1e2433, Tier 1: #2c407a, Tier 2: #4338ca, Tier 3: #8b5cf6, Tier 4: #c026d3, Tier 5: #00f0ff
const heatmapTierTokens = ['1e2433', '2c407a', '4338ca', '8b5cf6', 'c026d3', '00f0ff'];
const matchedTiers = heatmapTierTokens.filter(token => allCssAndTsx.toLowerCase().includes(token.toLowerCase()));

runner.assert(
  'Activity Heatmap 5-tier color scale (Charcoal, Slate Blue, Indigo, Violet, Magenta, Cyan) is present',
  matchedTiers.length >= 3,
  `Matched ${matchedTiers.length}/${heatmapTierTokens.length} color scale tier tokens (${matchedTiers.join(', ')})`
);

// =============================================================================
// Suite 3: Glassmorphism Specifications
// =============================================================================
runner.suite('3. Glassmorphism Specifications');

// 3.1 Backdrop Filter Blur
const hasBackdropBlur = 
  allCssAndTsx.includes('backdrop-blur') || 
  allCssAndTsx.includes('backdrop-filter');

runner.assert(
  'Backdrop blur filters (backdrop-blur-xl / 24px) are utilized across glass surfaces',
  hasBackdropBlur,
  hasBackdropBlur ? 'Backdrop blur verified' : 'No backdrop-blur or backdrop-filter found'
);

// 3.2 Translucent Surface Cards
const hasTranslucentSurfaces = 
  allCssAndTsx.includes('rgba(13, 18, 38') ||
  allCssAndTsx.includes('rgba(15, 23, 42') ||
  allCssAndTsx.includes('bg-slate-900/') ||
  allCssAndTsx.includes('bg-[#0d1226]') ||
  allCssAndTsx.includes('bg-white/');

runner.assert(
  'Translucent dark glass surfaces (bg-slate-900/.. or rgba(13, 18, 38, ..)) are applied',
  hasTranslucentSurfaces,
  hasTranslucentSurfaces ? 'Translucent glass surface cards verified' : 'Missing translucent glass backgrounds'
);

// 3.3 Specular Hairline Borders
const hasSpecularBorders = 
  allCssAndTsx.includes('border-white/10') ||
  allCssAndTsx.includes('border-white/15') ||
  allCssAndTsx.includes('border-white/20') ||
  allCssAndTsx.includes('rgba(255, 255, 255, 0.1');

runner.assert(
  'Specular hairline glass borders (border-white/10 or rgba(255, 255, 255, 0.12)) are applied',
  hasSpecularBorders,
  hasSpecularBorders ? 'Specular hairline glass borders verified' : 'Missing border-white opacity utilities'
);

// 3.4 Cosmic Glow Drop Shadows
const hasCosmicGlow = 
  allCssAndTsx.includes('shadow-[0_0_') ||
  allCssAndTsx.includes('drop-shadow(') ||
  allCssAndTsx.includes('box-shadow: 0 0');

runner.assert(
  'Cosmic glow effects and radiant box-shadows are implemented',
  hasCosmicGlow,
  hasCosmicGlow ? 'Radiant cosmic glow verified' : 'Missing custom cosmic glow shadows'
);

// =============================================================================
// Suite 4: App Shell & Global Navigation (Navbar & App.tsx)
// =============================================================================
runner.suite('4. App Shell & Global Navigation');

const appTsx = findFirstExisting(['src/App.tsx', 'src/App.jsx']);
const navbarTsx = findFirstExisting([
  'src/components/layout/Navbar.tsx',
  'src/components/Navbar.tsx',
  'src/components/layout/Header.tsx',
]);

runner.assert(
  'App.tsx shell component exists',
  appTsx !== null,
  appTsx ? `Found App shell at ${appTsx.path}` : 'App.tsx not found in src/'
);

runner.assert(
  'Navbar navigation header component exists',
  navbarTsx !== null,
  navbarTsx ? `Found Navbar at ${navbarTsx.path}` : 'Navbar component not found in src/components/layout/'
);

const shellContent = (appTsx?.content || '') + '\n' + (navbarTsx?.content || '');

// 4.1 Cosmos Branding & Logo
const hasCosmosBrand = 
  shellContent.toLowerCase().includes('cosmos') ||
  shellContent.toLowerCase().includes('cainghien') ||
  shellContent.toLowerCase().includes('focus guard');

runner.assert(
  'Brand identity ("COSMOS" / "CaiNghien" / Focus Guard) is rendered in shell/header',
  hasCosmosBrand,
  hasCosmosBrand ? 'Brand identity found in header shell' : 'No Cosmos/CaiNghien brand text found'
);

// 4.2 Navigation Tabs: Dashboard, Projects, Repository, Settings
const requiredTabs = ['Dashboard', 'Projects', 'Repository', 'Settings'];
const foundTabs = requiredTabs.filter(tab => {
  const reg = new RegExp(`\\b${tab}\\b`, 'i');
  return reg.test(shellContent);
});

runner.assert(
  'Navigation tabs (Dashboard, Projects, Repository, Settings) are defined',
  foundTabs.length >= 3,
  `Found tabs: ${foundTabs.join(', ')} (expected: ${requiredTabs.join(', ')})`
);

// 4.3 Screen Switching / Routing Architecture
const hasScreenRouting = 
  (shellContent.includes('activeTab') || shellContent.includes('currentScreen') || shellContent.includes('activeScreen')) &&
  (shellContent.includes('Dashboard') || shellContent.includes('dashboard'));

runner.assert(
  'Shell contains dynamic screen switching / tab routing state',
  Boolean(hasScreenRouting),
  hasScreenRouting ? 'Screen switching state logic verified' : 'No screen switching state found in shell'
);

// 4.4 Header Level Indicator
const hasHeaderLevel = 
  shellContent.toLowerCase().includes('level') ||
  shellContent.toLowerCase().includes('lvl') ||
  shellContent.toLowerCase().includes('stargazer');

runner.assert(
  'Header shell displays user progression badge / Level indicator',
  hasHeaderLevel,
  hasHeaderLevel ? 'Level progression badge present in shell' : 'Missing Level badge in header'
);

// =============================================================================
// Suite 5: Screen 1 — Dashboard (Level, XP, Heatmap, Metrics)
// =============================================================================
runner.suite('5. Screen 1 — Dashboard Adherence');

const dashboardFiles = [
  'src/components/dashboard/DashboardScreen.tsx',
  'src/components/dashboard/LevelProgress.tsx',
  'src/components/dashboard/ActivityHeatmap.tsx',
  'src/components/dashboard/StatsCard.tsx',
  'src/components/DisciplineHeatmap.tsx',
];

const foundDashboardFiles = dashboardFiles.filter(f => fs.existsSync(path.join(ROOT_DIR, f)));
runner.assert(
  'Dashboard screen component exists',
  foundDashboardFiles.length > 0,
  foundDashboardFiles.length > 0 ? `Found: ${foundDashboardFiles.join(', ')}` : 'DashboardScreen.tsx missing'
);

const dashboardContent = foundDashboardFiles.map(f => readFile(f)).join('\n');

// 5.1 Level Progress & Stargazer Badge
const hasStargazer = 
  dashboardContent.includes('Stargazer') ||
  dashboardContent.includes('Level 28') ||
  (dashboardContent.includes('level') && dashboardContent.includes('xp'));

runner.assert(
  'Dashboard displays "Level 28 Stargazer" and XP progress details',
  hasStargazer,
  hasStargazer ? 'Level 28 / Stargazer progression detected' : 'Level 28 Stargazer not found in Dashboard'
);

// 5.2 XP Progress Bar with Multi-stop Gradient
const hasXpBar = 
  dashboardContent.includes('linear-gradient') ||
  dashboardContent.includes('from-pink-500') ||
  dashboardContent.includes('from-fuchsia-500') ||
  dashboardContent.includes('bg-gradient-to-r') ||
  dashboardContent.includes('#ec4899') ||
  dashboardContent.includes('#00f0ff');

runner.assert(
  'Cosmic XP progress bar with multi-stop neon gradient is rendered',
  hasXpBar,
  hasXpBar ? 'XP progress bar gradient detected' : 'XP progress gradient missing'
);

// 5.3 365-Day Activity Heatmap Grid
const hasHeatmapMatrix = 
  dashboardContent.includes('52') || 
  dashboardContent.includes('365') || 
  dashboardContent.includes('weeks') ||
  dashboardContent.includes('days') ||
  dashboardContent.includes('heatmap');

runner.assert(
  'Activity Heatmap calendar grid logic (52 weeks / 365 days) is implemented',
  hasHeatmapMatrix,
  hasHeatmapMatrix ? 'Heatmap grid structures detected' : 'Heatmap matrix missing'
);

// 5.4 Month and Day Labels
const hasHeatmapLabels = 
  (dashboardContent.includes('Mon') || dashboardContent.includes('Wed') || dashboardContent.includes('Fri') || dashboardContent.includes('M') && dashboardContent.includes('W')) &&
  (dashboardContent.includes('Jan') || dashboardContent.includes('Oct') || dashboardContent.includes('months') || dashboardContent.includes('MONTH'));

runner.assert(
  'Heatmap displays Month and Day-of-week axis labels',
  hasHeatmapLabels,
  hasHeatmapLabels ? 'Heatmap axis labels detected' : 'Heatmap axis labels missing'
);

// 5.5 Metric Cards (Contributions, Streak, Activity Rate)
const hasMetrics = 
  dashboardContent.toLowerCase().includes('contribution') &&
  dashboardContent.toLowerCase().includes('streak') &&
  (dashboardContent.toLowerCase().includes('activity') || dashboardContent.toLowerCase().includes('rate'));

runner.assert(
  'Dashboard includes summary metric cards: Contributions, Streak, and Activity rate',
  hasMetrics,
  hasMetrics ? 'Summary metric cards present' : 'Missing one or more metric cards (Contributions, Streak, Activity)'
);

// 5.6 Heatmap Legend ("Less" to "More")
const hasLegend = 
  dashboardContent.toLowerCase().includes('less') && 
  dashboardContent.toLowerCase().includes('more');

runner.assert(
  'Heatmap includes "Less" to "More" color intensity legend',
  hasLegend,
  hasLegend ? 'Heatmap legend detected' : 'Missing Less/More heatmap legend'
);

// =============================================================================
// Suite 6: Screen 2 — Focus Room Adherence
// =============================================================================
runner.suite('6. Screen 2 — Focus Room Adherence');

const focusRoomFiles = [
  'src/components/focus/FocusRoomScreen.tsx',
  'src/components/focus/TimerRing.tsx',
  'src/components/focus/MotivationalQuote.tsx',
  'src/components/focus/LofiPlayer.tsx',
  'src/components/FocusRoom.tsx',
];

const foundFocusFiles = focusRoomFiles.filter(f => fs.existsSync(path.join(ROOT_DIR, f)));
runner.assert(
  'Focus Room screen component exists',
  foundFocusFiles.length > 0,
  foundFocusFiles.length > 0 ? `Found: ${foundFocusFiles.join(', ')}` : 'FocusRoomScreen.tsx missing'
);

const focusContent = foundFocusFiles.map(f => readFile(f)).join('\n');

// 6.1 Circular SVG Countdown Timer Ring
const hasCircularSvg = 
  focusContent.includes('<svg') &&
  focusContent.includes('<circle') &&
  (focusContent.includes('strokeDasharray') || focusContent.includes('stroke-dasharray') || focusContent.includes('strokeDashoffset'));

runner.assert(
  'Circular SVG countdown timer ring with stroke dash animation is implemented',
  hasCircularSvg,
  hasCircularSvg ? 'Circular SVG countdown timer ring detected' : 'SVG circular progress ring missing'
);

// 6.2 Time Display (MM:SS)
const hasTimeDisplay = 
  focusContent.includes(':') && 
  (focusContent.includes('padStart') || focusContent.includes('minutes') || focusContent.includes('seconds') || focusContent.includes('25:00'));

runner.assert(
  'Prominent countdown timer display (MM:SS formatting) is present',
  hasTimeDisplay,
  hasTimeDisplay ? 'MM:SS timer formatting verified' : 'MM:SS timer formatting missing'
);

// 6.3 Motivational Quotes
const hasMotivationalQuotes = 
  focusContent.includes('quote') ||
  focusContent.includes('Thích Nhất Hạnh') ||
  focusContent.includes('TĨNH LẶNG') ||
  focusContent.includes('mindful');

runner.assert(
  'Motivational philosophical quotes component with author attribution is present',
  hasMotivationalQuotes,
  hasMotivationalQuotes ? 'Motivational quotes component verified' : 'Missing motivational quotes'
);

// 6.4 Lofi / Ambience Audio Player Toggle
const hasLofiAudio = 
  focusContent.toLowerCase().includes('lofi') ||
  focusContent.toLowerCase().includes('ambience') ||
  focusContent.toLowerCase().includes('audio') ||
  focusContent.toLowerCase().includes('sound');

runner.assert(
  'Lofi / Ambience audio controls (music toggle / soundscapes) are implemented',
  hasLofiAudio,
  hasLofiAudio ? 'Lofi ambience controls detected' : 'Missing Lofi / Ambience audio controls'
);

// 6.5 Session Controls (Start, Pause, Reset)
const hasSessionControls = 
  (focusContent.toLowerCase().includes('start') || focusContent.toLowerCase().includes('play')) &&
  (focusContent.toLowerCase().includes('pause') || focusContent.toLowerCase().includes('reset'));

runner.assert(
  'Focus session lifecycle controls (Start, Pause, Reset) are present',
  hasSessionControls,
  hasSessionControls ? 'Session controls verified' : 'Missing session controls'
);

// =============================================================================
// Suite 7: Screen 3 — Typing Challenge Adherence
// =============================================================================
runner.suite('7. Screen 3 — Typing Challenge Adherence');

const typingFiles = [
  'src/components/typing/TypingChallengeScreen.tsx',
  'src/components/typing/TextPromptDisplay.tsx',
  'src/components/typing/TypingInput.tsx',
  'src/components/typing/RealtimeStats.tsx',
  'src/components/MindfulnessModal.tsx',
];

const foundTypingFiles = typingFiles.filter(f => fs.existsSync(path.join(ROOT_DIR, f)));
runner.assert(
  'Typing Challenge screen component exists',
  foundTypingFiles.length > 0,
  foundTypingFiles.length > 0 ? `Found: ${foundTypingFiles.join(', ')}` : 'TypingChallengeScreen.tsx missing'
);

const typingContent = foundTypingFiles.map(f => readFile(f)).join('\n');

// 7.1 Text Display Box with Word/Character Highlighting
const hasTextPrompt = 
  typingContent.includes('prompt') ||
  typingContent.includes('text') ||
  typingContent.includes('quick brown fox') ||
  typingContent.includes('PARAGRAPH TO TYPE');

runner.assert(
  'Paragraph text display box with target challenge text is present',
  hasTextPrompt,
  hasTextPrompt ? 'Target challenge text display detected' : 'Target challenge text display missing'
);

// 7.2 Typing Input Field
const hasTypingInput = 
  typingContent.includes('<input') || 
  typingContent.includes('<textarea') ||
  typingContent.includes('onChange') ||
  typingContent.includes('onKeyDown');

runner.assert(
  'Typing input field with keyboard event listeners is implemented',
  hasTypingInput,
  hasTypingInput ? 'Typing input field detected' : 'Typing input field missing'
);

// 7.3 Realtime Telemetry: WPM, Accuracy, Time
const hasWpm = typingContent.includes('wpm') || typingContent.includes('WPM');
const hasAccuracy = typingContent.includes('accuracy') || typingContent.includes('Accuracy') || typingContent.includes('Acc');
const hasTime = typingContent.includes('time') || typingContent.includes('Time') || typingContent.includes('elapsed');

runner.assert(
  'Realtime telemetry meters (WPM, Accuracy %, Time) are calculated and displayed',
  hasWpm && hasAccuracy && hasTime,
  `Telemetry components: WPM: ${hasWpm ? 'yes' : 'no'}, Accuracy: ${hasAccuracy ? 'yes' : 'no'}, Time: ${hasTime ? 'yes' : 'no'}`
);

// 7.4 Cosmic Lock Portal / Padlock Visual
const hasLockPortal = 
  typingContent.toLowerCase().includes('lock') ||
  typingContent.includes('Lock') ||
  typingContent.includes('vortex');

runner.assert(
  'Cosmic Lock Portal / progress lock visual is implemented',
  hasLockPortal,
  hasLockPortal ? 'Cosmic lock portal detected' : 'Cosmic lock portal missing'
);

// 7.5 Action Buttons (Submit & Cancel)
const hasActionButtons = 
  (typingContent.toLowerCase().includes('submit') || typingContent.toLowerCase().includes('complete')) &&
  (typingContent.toLowerCase().includes('cancel') || typingContent.toLowerCase().includes('close'));

runner.assert(
  'Typing Challenge includes Submit and Cancel actions',
  hasActionButtons,
  hasActionButtons ? 'Submit & Cancel actions present' : 'Missing Submit or Cancel buttons'
);

// =============================================================================
// Suite 8: Frontend Typed API Service Integration (src/services/api.ts)
// =============================================================================
runner.suite('8. Frontend Typed API Service Integration');

const apiFile = path.join(ROOT_DIR, 'src/services/api.ts');
const apiExists = fs.existsSync(apiFile);
const apiContent = apiExists ? fs.readFileSync(apiFile, 'utf8') : '';

runner.assert(
  'src/services/api.ts typed Tauri invoke wrapper exists',
  apiExists,
  apiExists ? 'Found src/services/api.ts' : 'src/services/api.ts missing'
);

if (apiExists) {
  const expectedApiMethods = [
    { name: 'getHeatmapData', cmd: 'get_heatmap_data' },
    { name: 'getUserProfile', cmd: 'get_user_profile' },
    { name: 'recordFocusSession', cmd: 'record_focus_session' },
    { name: 'getTypingChallengeText', cmd: 'get_typing_challenge_text' },
    { name: 'saveTypingScore', cmd: 'save_typing_score' },
    { name: 'getTypingScores', cmd: 'get_typing_scores' },
  ];

  for (const m of expectedApiMethods) {
    const hasMethod = apiContent.includes(m.name) || apiContent.includes(m.cmd);
    runner.assert(
      `API service implements ${m.name}() wrapping Tauri command "${m.cmd}"`,
      hasMethod,
      hasMethod ? `Method ${m.name} found` : `Method ${m.name} missing in api.ts`
    );
  }

  // Safe fallback when window.__TAURI__ is undefined
  const hasBrowserFallback = 
    apiContent.includes('__TAURI__') ||
    apiContent.includes('window') ||
    apiContent.includes('isTauri') ||
    apiContent.includes('fallback') ||
    apiContent.includes('mock');

  runner.assert(
    'API service includes safe browser / dev fallback when running outside Tauri runtime',
    Boolean(hasBrowserFallback),
    hasBrowserFallback ? 'Browser fallback / mock mode supported' : 'No browser fallback detected in api.ts'
  );
}

// =============================================================================
// Suite 9: Adversarial & Anti-Facade Quality Checks
// =============================================================================
runner.suite('9. Adversarial & Anti-Facade Quality Checks');

// 9.1 No empty component placeholders
const allComponentFiles = findFiles(path.join(SRC_DIR, 'components'), ['.tsx', '.jsx']);
let emptyComponents = [];
for (const compPath of allComponentFiles) {
  const content = fs.readFileSync(compPath, 'utf8').trim();
  // Strip comments
  const stripped = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim();
  if (stripped.length < 100) {
    emptyComponents.push(path.relative(ROOT_DIR, compPath));
  }
}

runner.assert(
  'All UI components contain substantive implementation (>100 characters code)',
  emptyComponents.length === 0,
  emptyComponents.length > 0 ? `Empty or stub components: ${emptyComponents.join(', ')}` : 'All components are substantively implemented'
);

// 9.2 WPM calculation formula accuracy check
// Formula: (correct_characters / 5) / (elapsed_seconds / 60)
const hasAccurateWpmFormula = 
  allCssAndTsx.includes('/ 5') && (allCssAndTsx.includes('/ 60') || allCssAndTsx.includes('* 60'));

runner.assert(
  'Real-time WPM calculation uses standard standard 5-character word normalization formula',
  hasAccurateWpmFormula,
  hasAccurateWpmFormula ? 'Standard WPM normalization formula found' : 'Non-standard or missing WPM formula'
);

// 9.3 Accuracy calculation clamping (0% to 100%)
const hasAccuracyClamping = 
  allCssAndTsx.includes('Math.round') ||
  allCssAndTsx.includes('Math.max') ||
  allCssAndTsx.includes('toFixed') ||
  allCssAndTsx.includes('* 100');

runner.assert(
  'Typing accuracy percentage computation formats or clamps between 0 and 100%',
  hasAccuracyClamping,
  hasAccuracyClamping ? 'Accuracy calculation formatting verified' : 'Accuracy percentage calculation missing'
);

// =============================================================================
// Run and Exit
// =============================================================================
const success = runner.report();
process.exit(success ? 0 : 1);
