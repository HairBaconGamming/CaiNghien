const latestContainer = document.querySelector("#latest-release");
const versionList = document.querySelector("#version-list");

const formatBytes = (value) => {
  if (!value) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const createNotes = (notes) => {
  if (!notes?.length) {
    return "";
  }
  return `<ul class="notes-list">${notes.map((item) => `<li>${item}</li>`).join("")}</ul>`;
};

const iconDownload = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" style="margin-right:4px; vertical-align: text-bottom;"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>`;

const createDownloadLinks = (release) => {
  const installer = release.files?.installer
    ? `<a class="button primary" href="${release.files.installer.url}">${iconDownload} Tải Installer</a>`
    : "";
  const portable = release.files?.portable
    ? `<a class="button secondary" href="${release.files.portable.url}">${iconDownload} Tải Portable EXE</a>`
    : "";
  return `<div class="download-actions">${installer}${portable}</div>`;
};

const formatDate = (dateString) => {
  if (!dateString) return "không rõ";
  try {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateString;
  }
};

fetch("./data/releases.json")
  .then((response) => response.json())
  .then((data) => {
    const latest = data.latest;
    const releases = data.releases ?? [];

    if (latest) {
      latestContainer.innerHTML = `
        <article class="latest-card">
          <div class="version-header">
            <div>
              <p class="eyebrow">Bản ổn định mới nhất</p>
              <h3>Phiên bản ${latest.version}</h3>
            </div>
            <span class="pill latest">Khuyên dùng</span>
          </div>
          <p class="download-meta">
            Phát hành: <strong>${formatDate(latest.published_at)}</strong>.
            ${latest.files?.installer?.size_bytes ? `Kích thước Installer: ${formatBytes(latest.files.installer.size_bytes)}.` : ""}
          </p>
          ${createNotes(latest.notes)}
          ${createDownloadLinks(latest)}
        </article>
      `;
    }

    versionList.innerHTML = releases
      .map(
        (release) => `
          <article class="version-card">
            <div class="version-header">
              <div>
                <h3>Phiên bản ${release.version}</h3>
                <p class="version-meta">Phát hành: ${formatDate(release.published_at)}.</p>
              </div>
              <span class="pill ${release.version === latest?.version ? "latest" : "history"}">
                ${release.version === latest?.version ? "Mới nhất" : "Lịch sử"}
              </span>
            </div>
            ${createNotes(release.notes)}
            ${createDownloadLinks(release)}
          </article>
        `
      )
      .join("");
  })
  .catch((error) => {
    latestContainer.innerHTML = `<article class="latest-card"><p style="color: red;">Không tải được danh sách phiên bản: ${error.message}</p></article>`;
  });
