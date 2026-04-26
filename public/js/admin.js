// ── Admin Auth ────────────────────────────────────────────────────────────────
const ADMIN_TOKEN_KEY = 'rt_admin_token';

function getAdminToken() { return localStorage.getItem(ADMIN_TOKEN_KEY); }
function setAdminToken(t) { localStorage.setItem(ADMIN_TOKEN_KEY, t); }
function clearAdminToken() { localStorage.removeItem(ADMIN_TOKEN_KEY); }

function adminHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAdminToken()}` };
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function showAlert(containerId, msg, type = 'error') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const icons = { error: '❌', success: '✅', info: 'ℹ️' };
  el.innerHTML = `<div class="alert alert-${type}">${icons[type]} ${msg}</div>`;
}

function setLoading(btn, loading, text = '') {
  if (loading) {
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> ${text}`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.origText || text;
    btn.disabled = false;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
if (getAdminToken()) {
  showDashboard();
} else {
  document.getElementById('adminLoginScreen').classList.remove('hidden');
  document.getElementById('adminDashboard').classList.add('hidden');
}

// ── Login ─────────────────────────────────────────────────────────────────────
document.getElementById('adminLoginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const adminId = document.getElementById('adminId').value.trim();
  const password = document.getElementById('adminPassword').value;
  if (!adminId || !password) {
    showAlert('adminLoginAlert', 'Admin ID and password are required.');
    return;
  }
  const btn = document.getElementById('adminLoginBtn');
  setLoading(btn, true, 'Logging in...');
  try {
    const data = await apiFetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, password })
    });
    setAdminToken(data.token);
    showDashboard();
  } catch (err) {
    showAlert('adminLoginAlert', err.message);
    setLoading(btn, false);
  }
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
function showDashboard() {
  document.getElementById('adminLoginScreen').classList.add('hidden');
  document.getElementById('adminDashboard').classList.remove('hidden');
  loadSubmissions();

  // Update export link with token
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.href = `/api/admin/export?token=${getAdminToken()}`;
    exportBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Fetch with auth header and trigger download
      fetch('/api/admin/export', { headers: adminHeaders() })
        .then(res => res.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'raju-transport-submissions.csv';
          a.click();
          URL.revokeObjectURL(url);
        });
    });
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById('adminLogoutBtn')?.addEventListener('click', () => {
  clearAdminToken();
  document.getElementById('adminDashboard').classList.add('hidden');
  document.getElementById('adminLoginScreen').classList.remove('hidden');
  document.getElementById('adminId').value = '';
  document.getElementById('adminPassword').value = '';
});

// ── Sidebar Navigation ────────────────────────────────────────────────────────
document.querySelectorAll('.sidebar-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const view = link.dataset.view;
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    document.getElementById('view-submissions').classList.toggle('hidden', view !== 'submissions');
    document.getElementById('view-stats').classList.toggle('hidden', view !== 'stats');

    if (view === 'submissions') {
      document.getElementById('viewTitle').textContent = 'Submissions';
      document.getElementById('viewSubtitle').textContent = 'All booking requests';
      document.getElementById('exportBtn').classList.remove('hidden');
    } else if (view === 'stats') {
      document.getElementById('viewTitle').textContent = 'Statistics';
      document.getElementById('viewSubtitle').textContent = 'Overview of bookings';
      document.getElementById('exportBtn').classList.add('hidden');
      loadStats();
    }
  });
});

// ── Load Submissions ──────────────────────────────────────────────────────────
let allSubmissions = [];

async function loadSubmissions(search = '', loadType = '') {
  document.getElementById('submissionsLoading').classList.remove('hidden');
  document.getElementById('submissionsEmpty').classList.add('hidden');
  document.getElementById('submissionsTable').classList.add('hidden');

  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (loadType) params.set('loadType', loadType);

    const data = await apiFetch(`/api/admin/submissions?${params}`, {
      headers: adminHeaders()
    });

    allSubmissions = data.submissions;
    renderSubmissions(allSubmissions);
  } catch (err) {
    if (err.message.includes('Unauthorized') || err.message.includes('Invalid')) {
      clearAdminToken();
      document.getElementById('adminDashboard').classList.add('hidden');
      document.getElementById('adminLoginScreen').classList.remove('hidden');
    }
  } finally {
    document.getElementById('submissionsLoading').classList.add('hidden');
  }
}

function renderSubmissions(submissions) {
  if (!submissions.length) {
    document.getElementById('submissionsEmpty').classList.remove('hidden');
    document.getElementById('submissionsTable').classList.add('hidden');
    return;
  }

  document.getElementById('submissionsTable').classList.remove('hidden');
  document.getElementById('totalCount').textContent = `Showing ${submissions.length} submission${submissions.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('submissionsBody');
  tbody.innerHTML = submissions.map((s, i) => {
    const badge = getBadge(s.loadType);
    const date = new Date(s.createdAt).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    return `
      <tr>
        <td style="color:var(--text-light);font-size:12px">${i + 1}</td>
        <td><strong>${escHtml(s.fullName)}</strong></td>
        <td><a href="tel:${s.mobile}" style="color:var(--primary)">${s.mobile}</a></td>
        <td>${s.email ? `<a href="mailto:${s.email}" style="color:var(--primary)">${escHtml(s.email)}</a>` : '<span style="color:var(--text-light)">—</span>'}</td>
        <td>${escHtml(s.goodsType)}</td>
        <td><span class="badge ${badge.cls}">${badge.label}</span></td>
        <td style="color:var(--text-light);font-size:13px">${date}</td>
      </tr>
    `;
  }).join('');
}

function getBadge(loadType) {
  if (loadType?.includes('FTL')) return { cls: 'badge-ftl', label: '🚛 FTL' };
  if (loadType?.includes('Half')) return { cls: 'badge-htl', label: '🚚 Half Truck' };
  return { cls: 'badge-any', label: '📦 Any Qty' };
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Filters ───────────────────────────────────────────────────────────────────
document.getElementById('applyFilter')?.addEventListener('click', () => {
  const search = document.getElementById('searchInput').value.trim();
  const loadType = document.getElementById('loadTypeFilter').value;
  loadSubmissions(search, loadType);
});

document.getElementById('clearFilter')?.addEventListener('click', () => {
  document.getElementById('searchInput').value = '';
  document.getElementById('loadTypeFilter').value = '';
  loadSubmissions();
});

document.getElementById('searchInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('applyFilter').click();
});

// ── Stats ─────────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const data = await apiFetch('/api/admin/submissions', { headers: adminHeaders() });
    const subs = data.submissions;
    const ftl = subs.filter(s => s.loadType?.includes('FTL')).length;
    const htl = subs.filter(s => s.loadType?.includes('Half')).length;
    const any = subs.filter(s => s.loadType?.includes('Any')).length;

    const goodsCounts = {};
    subs.forEach(s => { goodsCounts[s.goodsType] = (goodsCounts[s.goodsType] || 0) + 1; });
    const topGoods = Object.entries(goodsCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card">
        <div class="s-icon">📋</div>
        <div class="s-val">${subs.length}</div>
        <div class="s-label">Total Submissions</div>
      </div>
      <div class="stat-card" style="border-color:#e65100">
        <div class="s-icon">🚛</div>
        <div class="s-val">${ftl}</div>
        <div class="s-label">Full Truck Load (FTL)</div>
      </div>
      <div class="stat-card" style="border-color:#2e7d32">
        <div class="s-icon">🚚</div>
        <div class="s-val">${htl}</div>
        <div class="s-label">Half Truck Load</div>
      </div>
      <div class="stat-card" style="border-color:#1565c0">
        <div class="s-icon">📦</div>
        <div class="s-val">${any}</div>
        <div class="s-label">Any Quantity</div>
      </div>
      ${topGoods.map(([goods, count]) => `
        <div class="stat-card" style="border-color:var(--accent)">
          <div class="s-icon">📊</div>
          <div class="s-val">${count}</div>
          <div class="s-label">${goods}</div>
        </div>
      `).join('')}
    `;
  } catch (err) {
    console.error(err);
  }
}

// ── Forgot Password ───────────────────────────────────────────────────────────
const forgotModal = document.getElementById('forgotModal');

document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  forgotModal?.classList.remove('hidden');
  document.getElementById('forgotAlert').innerHTML = '';
});

document.getElementById('closeForgotModal')?.addEventListener('click', () => {
  forgotModal?.classList.add('hidden');
});

forgotModal?.addEventListener('click', (e) => {
  if (e.target === forgotModal) forgotModal.classList.add('hidden');
});

document.getElementById('sendResetBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('sendResetBtn');
  setLoading(btn, true, 'Sending...');
  try {
    const res = await fetch('/api/admin/forgot-password', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (data.devLink) {
      // Dev mode — no email configured, show link directly
      document.getElementById('forgotAlert').innerHTML = `
        <div class="alert alert-info">
          ℹ️ Email not configured. <br>
          <a href="${data.devLink}" style="color:var(--primary);font-weight:600;word-break:break-all">Click here to reset password</a>
        </div>`;
    } else {
      document.getElementById('forgotAlert').innerHTML = `
        <div class="alert alert-success">✅ ${data.message}</div>`;
    }
    btn.style.display = 'none';
  } catch (err) {
    document.getElementById('forgotAlert').innerHTML = `
      <div class="alert alert-error">❌ ${err.message}</div>`;
    setLoading(btn, false);
  }
});
