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

const createDownloadLinks = (release) => {
  const installer = release.files?.installer
    ? `<a class="button primary" href="${release.files.installer.url}">Tai installer</a>`
    : "";
  const portable = release.files?.portable
    ? `<a class="button secondary" href="${release.files.portable.url}">Tai portable EXE</a>`
    : "";
  return `<div class="download-actions">${installer}${portable}</div>`;
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
              <p class="eyebrow">Latest Stable</p>
              <h3>${latest.version}</h3>
            </div>
            <span class="pill latest">Khuyen dung</span>
          </div>
          <p class="download-meta">
            Phat hanh ${latest.published_at || "khong ro"}.
            ${latest.files?.installer?.size_bytes ? `Installer ${formatBytes(latest.files.installer.size_bytes)}.` : ""}
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
                <h3>${release.version}</h3>
                <p class="version-meta">Phat hanh ${release.published_at || "khong ro"}.</p>
              </div>
              <span class="pill ${release.version === latest?.version ? "latest" : "history"}">
                ${release.version === latest?.version ? "Moi nhat" : "Lich su"}
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
    latestContainer.innerHTML = `<article class="latest-card"><p>Khong tai duoc danh sach phien ban: ${error.message}</p></article>`;
  });
