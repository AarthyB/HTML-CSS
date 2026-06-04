// ===========================
// State
// ===========================
const files = [];          // { id, file, status, progress, objectUrl }
let filterType = 'all';

// ===========================
// DOM Refs
// ===========================
const dropZone      = document.getElementById('dropZone');
const pickBtn       = document.getElementById('pickBtn');
const fileInput     = document.getElementById('selectedFile');
const fileList      = document.getElementById('fileList');
const emptyState    = document.getElementById('emptyState');
const filterSelect  = document.getElementById('filterSelect');
const clearAllBtn   = document.getElementById('clearAllBtn');
const uploadAllBtn  = document.getElementById('uploadAllBtn');
const statsBar      = document.getElementById('statsBar');
const statCount     = document.getElementById('statCount');
const statSize      = document.getElementById('statSize');
const statTypes     = document.getElementById('statTypes');
const toastEl       = document.getElementById('toast');

// ===========================
// Utilities
// ===========================
let toastTimer;
function showToast(msg, type = 'info') {
  toastEl.textContent = msg;
  toastEl.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 3000);
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getCategory(file) {
  const t = file.type;
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (t === 'application/pdf') return 'pdf';
  if (t.startsWith('text/')) return 'text';
  return 'other';
}

const categoryEmoji = {
  image: '🖼',
  video: '🎬',
  audio: '🎵',
  pdf:   '📄',
  text:  '📝',
  other: '📦'
};

function uniqueId() {
  return '_' + Math.random().toString(36).slice(2, 9);
}

// ===========================
// Add Files
// ===========================
function addFiles(newFiles) {
  const MAX_SIZE = 50 * 1024 * 1024;
  let rejected = 0;

  Array.from(newFiles).forEach(f => {
    if (f.size > MAX_SIZE) { rejected++; return; }
    // Prevent duplicates by name+size
    if (files.find(e => e.file.name === f.name && e.file.size === f.size)) return;

    const entry = {
      id: uniqueId(),
      file: f,
      status: 'pending',
      progress: 0,
      objectUrl: f.type.startsWith('image/') || f.type.startsWith('video/') || f.type.startsWith('audio/')
        ? URL.createObjectURL(f)
        : null
    };
    files.push(entry);
  });

  if (rejected) showToast(`${rejected} file(s) exceed 50 MB limit`, 'error');
  else if (newFiles.length) showToast(`${newFiles.length} file(s) added`, 'success');

  renderAll();
}

// ===========================
// Render
// ===========================
function renderAll() {
  const visible = filterType === 'all'
    ? files
    : files.filter(e => getCategory(e.file) === filterType);

  fileList.innerHTML = '';

  if (!files.length) {
    emptyState.hidden = false;
    statsBar.hidden = true;
    return;
  }

  emptyState.hidden = true;
  statsBar.hidden = false;
  updateStats();

  visible.forEach(entry => {
    fileList.appendChild(buildFileItem(entry));
  });

  if (visible.length === 0 && files.length > 0) {
    const msg = document.createElement('p');
    msg.style.cssText = 'text-align:center;color:var(--text-muted);font-size:0.8rem;padding:24px 0;';
    msg.textContent = 'No files match this filter.';
    fileList.appendChild(msg);
  }
}

function buildFileItem(entry) {
  const cat = getCategory(entry.file);
  const item = document.createElement('div');
  item.className = 'file-item';
  item.dataset.id = entry.id;

  // Thumbnail or badge
  let iconHtml;
  if (entry.objectUrl && entry.file.type.startsWith('image/')) {
    iconHtml = `<img src="${entry.objectUrl}" class="file-thumb" alt="preview">`;
  } else {
    iconHtml = `<div class="file-type-badge badge-${cat}">${categoryEmoji[cat]}</div>`;
  }

  const statusClass = `status-${entry.status}`;
  const statusLabel = entry.status.charAt(0).toUpperCase() + entry.status.slice(1);

  item.innerHTML = `
    ${iconHtml}
    <div class="file-info">
      <div class="file-name" title="${entry.file.name}">${entry.file.name}</div>
      <div class="file-meta">
        <span>${formatSize(entry.file.size)}</span>
        <span>${cat}</span>
        ${entry.file.type ? `<span>${entry.file.type}</span>` : ''}
      </div>
      <div class="progress-track">
        <div class="progress-fill" id="prog-${entry.id}" style="width:${entry.progress}%"></div>
      </div>
    </div>
    <span class="status-chip ${statusClass}" id="chip-${entry.id}">${statusLabel}</span>
    <div class="file-actions">
      ${entry.objectUrl ? `
        <button class="action-btn preview" title="Preview" onclick="openPreview('${entry.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      ` : ''}
      <button class="action-btn" title="Upload" onclick="simulateUpload('${entry.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
        </svg>
      </button>
      <button class="action-btn del" title="Remove" onclick="removeFile('${entry.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `;

  return item;
}

function updateStats() {
  const total = files.reduce((s, e) => s + e.file.size, 0);
  const cats = [...new Set(files.map(e => getCategory(e.file)))];
  statCount.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
  statSize.textContent  = formatSize(total) + ' total';
  statTypes.textContent = cats.map(c => categoryEmoji[c]).join(' ');
}

// ===========================
// File Actions
// ===========================
window.removeFile = function(id) {
  const el = document.querySelector(`.file-item[data-id="${id}"]`);
  if (el) {
    el.classList.add('removing');
    setTimeout(() => {
      const idx = files.findIndex(e => e.id === id);
      if (idx !== -1) {
        if (files[idx].objectUrl) URL.revokeObjectURL(files[idx].objectUrl);
        files.splice(idx, 1);
      }
      renderAll();
    }, 200);
  }
};

window.simulateUpload = function(id) {
  const entry = files.find(e => e.id === id);
  if (!entry || entry.status === 'uploading' || entry.status === 'done') return;

  entry.status = 'uploading';
  entry.progress = 0;

  const chip = document.getElementById(`chip-${id}`);
  const prog = document.getElementById(`prog-${id}`);

  if (chip) {
    chip.className = 'status-chip status-uploading';
    chip.textContent = 'Uploading';
  }

  let p = 0;
  const speed = Math.random() * 15 + 5; // random speed 5-20
  const interval = setInterval(() => {
    p += speed * (Math.random() * 0.5 + 0.75);
    if (p >= 100) {
      p = 100;
      clearInterval(interval);
      entry.status = 'done';
      entry.progress = 100;
      if (chip) { chip.className = 'status-chip status-done'; chip.textContent = 'Done'; }
      showToast(`"${entry.file.name}" uploaded!`, 'success');
    }
    entry.progress = p;
    if (prog) prog.style.width = p + '%';
  }, 80);
};

// ===========================
// Upload All
// ===========================
uploadAllBtn.addEventListener('click', () => {
  const pending = files.filter(e => e.status === 'pending');
  if (!pending.length) { showToast('No pending files to upload', 'info'); return; }
  pending.forEach((e, i) => setTimeout(() => simulateUpload(e.id), i * 300));
  showToast(`Uploading ${pending.length} file(s)...`, 'info');
});

// ===========================
// Clear All
// ===========================
clearAllBtn.addEventListener('click', () => {
  if (!files.length) { showToast('No files to clear', 'info'); return; }
  files.forEach(e => { if (e.objectUrl) URL.revokeObjectURL(e.objectUrl); });
  files.length = 0;
  renderAll();
  showToast('All files cleared', 'info');
});

// ===========================
// Filter
// ===========================
filterSelect.addEventListener('change', e => {
  filterType = e.target.value;
  renderAll();
});

// ===========================
// Drag & Drop
// ===========================
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', e => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  addFiles(e.dataTransfer.files);
});

dropZone.addEventListener('click', e => {
  if (e.target === pickBtn || pickBtn.contains(e.target)) return;
  fileInput.click();
});

pickBtn.addEventListener('click', e => {
  e.stopPropagation();
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) addFiles(fileInput.files);
  fileInput.value = '';
});

// ===========================
// Preview Modal
// ===========================
window.openPreview = function(id) {
  const entry = files.find(e => e.id === id);
  if (!entry || !entry.objectUrl) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const cat = getCategory(entry.file);
  let mediaHtml;

  if (cat === 'image') {
    mediaHtml = `<img src="${entry.objectUrl}" alt="${entry.file.name}">`;
  } else if (cat === 'video') {
    mediaHtml = `<video src="${entry.objectUrl}" controls></video>`;
  } else if (cat === 'audio') {
    mediaHtml = `<audio src="${entry.objectUrl}" controls style="width:100%;padding:20px"></audio>`;
  } else {
    mediaHtml = `<p style="color:var(--text-muted);font-size:0.8rem">No preview available</p>`;
  }

  const lastModified = new Date(entry.file.lastModified).toLocaleDateString();

  backdrop.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <div class="modal-title">${entry.file.name}</div>
        <button class="modal-close" id="closeModal">✕</button>
      </div>
      <div class="modal-preview-area">${mediaHtml}</div>
      <div class="modal-meta">
        <span class="meta-pill">${formatSize(entry.file.size)}</span>
        <span class="meta-pill">${entry.file.type || 'unknown type'}</span>
        <span class="meta-pill">Modified ${lastModified}</span>
        <span class="meta-pill">${categoryEmoji[cat]} ${cat}</span>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  backdrop.addEventListener('click', e => {
    if (e.target === backdrop || e.target.id === 'closeModal') {
      backdrop.remove();
    }
  });
};

// ===========================
// Keyboard shortcut: ESC closes modal
// ===========================
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelector('.modal-backdrop')?.remove();
  }
});

// ===========================
// Init
// ===========================
renderAll();
