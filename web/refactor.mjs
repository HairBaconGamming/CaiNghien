import fs from 'fs';

const appPath = 'd:/Projects/APPs/CaiNghien-main/web/src/App.jsx';
const homePath = 'd:/Projects/APPs/CaiNghien-main/web/src/pages/Home.jsx';

// Refactor Home.jsx
let homeContent = fs.readFileSync(homePath, 'utf8');
homeContent = homeContent.replace('./components/Icons.jsx', '../components/Icons.jsx');
homeContent = homeContent.replace('export default function App()', 'export default function Home()');
// Remove from <div className="landing-root-container"> to <main className="page-layout-shell"> (exclusive)
homeContent = homeContent.replace(/<div className="landing-root-container">[\s\S]*?(<main className="page-layout-shell">)/, '$1');
// Remove from </main> to the end of file
homeContent = homeContent.replace(/(<\/main>)[\s\S]*$/, '$1\n');
fs.writeFileSync(homePath, homeContent);

// Refactor App.jsx
let appContent = fs.readFileSync(appPath, 'utf8');
appContent = 'import { Routes, Route, Link, useLocation } from \'react-router-dom\';\n' +
  'import Home from \'./pages/Home.jsx\';\n' +
  'import Releases from \'./pages/Releases.jsx\';\n' +
  appContent;

// Remove the states and variables in App component
appContent = appContent.replace(/export default function App\(\) {[\s\S]*?return \(/, 'export default function App() {\n  return (');

// Replace the <main> block
appContent = appContent.replace(/<main className="page-layout-shell">[\s\S]*?<\/main>/, 
  '<main className="page-layout-shell-router" style={{ display: \'flex\', flexDirection: \'column\', minHeight: \'100vh\' }}>\n' +
  '        <Routes>\n' +
  '          <Route path="/" element={<Home />} />\n' +
  '          <Route path="/releases" element={<Releases />} />\n' +
  '        </Routes>\n' +
  '      </main>'
);

// Add Lịch sử cập nhật link to Navbar
appContent = appContent.replace(
  /<a href="#downloads" className="navigation-link-item">Tải Xuống<\/a>/,
  '<a href="/#downloads" className="navigation-link-item">Tải Xuống</a>\n            <Link to="/releases" className="navigation-link-item">Lịch sử cập nhật</Link>'
);
appContent = appContent.replace(/<a href="#features"/g, '<a href="/#features"');
appContent = appContent.replace(/<a href="#mindfulness"/g, '<a href="/#mindfulness"');
appContent = appContent.replace(/<a href="#kiosk"/g, '<a href="/#kiosk"');

// Replace ShieldCheckIcon with logo.png in branding spots
appContent = appContent.replace(
  /<div className="brand-icon-wrapper">[\s\S]*?<ShieldCheckIcon className="svg-icon-standard" \/>[\s\S]*?<\/div>/g,
  '<div className="brand-icon-wrapper">\n              <img src="/logo.png" alt="Logo" className="svg-icon-standard" style={{ width: \'24px\', height: \'24px\', objectFit: \'contain\' }} />\n            </div>'
);

fs.writeFileSync(appPath, appContent);
