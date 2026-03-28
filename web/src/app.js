const latestContainer = document.querySelector("#latest-release");
const versionList = document.querySelector("#version-list");

const formatBytes = (value) => {
  if (!value) return "Không rõ";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDate = (dateString) => {
  if (!dateString) return "không rõ";
  try {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
};

const iconDownload = `
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.3" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
  </svg>
`;

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const createNotes = (notes) => {
  if (!notes?.length) {
    return "";
  }
  return `<ul class="notes-list">${notes
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
};

const createMetaChip = (label, value) =>
  `<span class="meta-chip">${escapeHtml(label)}: ${escapeHtml(value)}</span>`;

const shortHash = (hash) => {
  if (!hash) return "Không có";
  if (hash.length <= 20) return hash;
  return `${hash.slice(0, 12)}...${hash.slice(-8)}`;
};

const createDownloadFileCard = (label, file, tone = "primary") => {
  if (!file?.url) {
    return "";
  }

  const sizeText = formatBytes(file.size_bytes);
  const checksum = file.sha256 || "";
  const buttonClass = tone === "primary" ? "button primary" : "button secondary";

  return `
    <article class="file-card">
      <div class="file-card-head">
        <div>
          <div class="file-title">${escapeHtml(label)}</div>
          <p class="file-note">${tone === "primary" ? "Khuyên dùng cho cài đặt chuẩn trên Windows." : "Bản chạy trực tiếp nếu bạn muốn tải nhanh một file duy nhất."}</p>
        </div>
        <a class="${buttonClass}" href="${file.url}">
          ${iconDownload}
          ${tone === "primary" ? "Tải về" : "Tải EXE"}
        </a>
      </div>
      <div class="file-meta">
        ${createMetaChip("Kích thước", sizeText)}
        ${checksum ? createMetaChip("SHA-256", shortHash(checksum)) : ""}
      </div>
      ${
        checksum
          ? `
            <div class="checksum-row">
              <div class="checksum" title="${checksum}">${checksum}</div>
              <button class="copy-button" type="button" data-copy="${checksum}">Sao chép SHA-256</button>
            </div>
          `
          : ""
      }
    </article>
  `;
};

const createGlance = (release) => {
  const installerSize = release.files?.installer?.size_bytes
    ? formatBytes(release.files.installer.size_bytes)
    : "Không rõ";

  return `
    <div class="release-glance">
      <div class="glance-item">
        <span>Phát hành</span>
        <strong>${formatDate(release.published_at)}</strong>
      </div>
      <div class="glance-item">
        <span>Installer</span>
        <strong>${installerSize}</strong>
      </div>
      <div class="glance-item">
        <span>Manifest</span>
        <strong>Updater-ready</strong>
      </div>
    </div>
  `;
};

const renderLatestRelease = (release) => {
  latestContainer.innerHTML = `
    <article class="latest-card">
      <div class="version-header">
        <div>
          <p class="eyebrow">Bản ổn định mới nhất</p>
          <h3>Phiên bản ${escapeHtml(release.version)}</h3>
          <p class="download-meta">Bản phát hành khuyên dùng cho người dùng mới và cho desktop updater.</p>
        </div>
        <span class="pill latest">Khuyên dùng</span>
      </div>

      ${createGlance(release)}
      ${createNotes(release.notes)}

      <div class="download-stack">
        ${createDownloadFileCard("Installer Windows", release.files?.installer, "primary")}
        ${createDownloadFileCard("Portable EXE", release.files?.portable, "secondary")}
      </div>
    </article>
  `;
};

const renderHistoryRelease = (release) => `
  <article class="version-card">
    <div class="version-header">
      <div>
        <h3>Phiên bản ${escapeHtml(release.version)}</h3>
        <p class="version-meta">Phát hành: ${formatDate(release.published_at)}</p>
      </div>
      <span class="pill history">Lịch sử</span>
    </div>
    ${createNotes(release.notes)}
    <div class="download-actions">
      ${
        release.files?.installer?.url
          ? `<a class="button secondary btn-sm" href="${release.files.installer.url}">${iconDownload}Installer</a>`
          : ""
      }
      ${
        release.files?.portable?.url
          ? `<a class="button ghost btn-sm" href="${release.files.portable.url}">${iconDownload}Portable</a>`
          : ""
      }
    </div>
  </article>
`;

const attachCopyHandlers = () => {
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const text = button.getAttribute("data-copy") ?? "";
      try {
        await navigator.clipboard.writeText(text);
        const original = button.textContent;
        button.textContent = "Đã sao chép";
        setTimeout(() => {
          button.textContent = original ?? "Sao chép SHA-256";
        }, 1600);
      } catch {
        button.textContent = "Không sao chép được";
        setTimeout(() => {
          button.textContent = "Sao chép SHA-256";
        }, 1600);
      }
    });
  });
};

fetch("./data/releases.json")
  .then((response) => response.json())
  .then((data) => {
    const latest = data.latest;
    const releases = data.releases ?? [];

    if (latest) {
      renderLatestRelease(latest);
    } else {
      latestContainer.innerHTML = `<article class="latest-card"><p class="loading-text">Chưa có dữ liệu phát hành.</p></article>`;
    }

    const olderReleases = releases.filter((release) => release.version !== latest?.version);
    if (!olderReleases.length) {
      versionList.innerHTML = `<article class="version-card"><p class="history-empty">Chưa có phiên bản lịch sử nào khác.</p></article>`;
    } else {
      versionList.innerHTML = olderReleases.map(renderHistoryRelease).join("");
    }

    attachCopyHandlers();
  })
  .catch((error) => {
    latestContainer.innerHTML = `
      <article class="latest-card">
        <p class="error-text">Không tải được danh sách phiên bản: ${escapeHtml(error.message)}</p>
      </article>
    `;
    versionList.innerHTML = "";
  });
