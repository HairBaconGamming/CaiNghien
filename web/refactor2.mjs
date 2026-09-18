import fs from 'fs';

const appPath = 'd:/Projects/APPs/CaiNghien-main/web/src/App.jsx';

let appContent = fs.readFileSync(appPath, 'utf8');

// Add imports
appContent = 'import { Routes, Route, Link } from \'react-router-dom\';\n' +
  'import Home from \'./pages/Home.jsx\';\n' +
  'import Releases from \'./pages/Releases.jsx\';\n' +
  appContent;

// Replace the main block safely using a custom function
const mainStart = appContent.indexOf('<main className="page-layout-shell">');
const mainEnd = appContent.indexOf('</main>', mainStart) + '</main>'.length;

const newMain = `<main className="page-layout-shell-router" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/releases" element={<Releases />} />
        </Routes>
      </main>`;

appContent = appContent.substring(0, mainStart) + newMain + appContent.substring(mainEnd);

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
