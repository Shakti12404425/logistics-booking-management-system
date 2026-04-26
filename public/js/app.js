// ── Auth helpers ──────────────────────────────────────────────────────────────
const API = '';

function getToken() { return localStorage.getItem('rt_token'); }
function setToken(t) { localStorage.setItem('rt_token', t); }
function clearToken() { localStorage.removeItem('rt_token'); localStorage.removeItem('rt_user'); }
function isLoggedIn() { return !!getToken(); }

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function showAlert(containerId, msg, type = 'error') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const icons = { error: '❌', success: '✅', info: 'ℹ️' };
  el.innerHTML = `<div class="alert alert-${type}">${icons[type]} ${msg}</div>`;
  setTimeout(() => { el.innerHTML = ''; }, 5000);
}

function setLoading(btn, loading, text = 'Loading...') {
  if (loading) {
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> ${text}`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.origText || text;
    btn.disabled = false;
  }
}

// ── Navbar state ──────────────────────────────────────────────────────────────
function updateNavbar() {
  const loginBtn = document.getElementById('navLoginBtn');
  const userItem = document.getElementById('navUserItem');
  const logoutItem = document.getElementById('navLogoutItem');

  if (isLoggedIn()) {
    loginBtn?.classList.add('hidden');
    userItem?.classList.remove('hidden');
    logoutItem?.classList.remove('hidden');
  } else {
    loginBtn?.classList.remove('hidden');
    userItem?.classList.add('hidden');
    logoutItem?.classList.add('hidden');
  }
}

// ── Hamburger ─────────────────────────────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
hamburger?.addEventListener('click', () => navLinks?.classList.toggle('open'));
document.addEventListener('click', (e) => {
  if (!hamburger?.contains(e.target) && !navLinks?.contains(e.target)) {
    navLinks?.classList.remove('open');
  }
});

// ── Login Modal ───────────────────────────────────────────────────────────────
const loginModal = document.getElementById('loginModal');

function openLoginModal() { loginModal?.classList.remove('hidden'); }
function closeLoginModal() { loginModal?.classList.add('hidden'); }

document.getElementById('navLoginBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  openLoginModal();
});
document.getElementById('heroBookBtn')?.addEventListener('click', () => {
  if (isLoggedIn()) window.location.href = '/booking.html';
  else openLoginModal();
});
document.getElementById('closeLoginModal')?.addEventListener('click', closeLoginModal);
loginModal?.addEventListener('click', (e) => { if (e.target === loginModal) closeLoginModal(); });

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-phone')?.classList.toggle('hidden', tab !== 'phone');
    document.getElementById('tab-email')?.classList.toggle('hidden', tab !== 'email');
  });
});

document.querySelectorAll('[data-subtab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const sub = btn.dataset.subtab;
    // only affect siblings in same parent
    btn.closest('.tabs').querySelectorAll('[data-subtab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (sub === 'login-phone' || sub === 'register-phone') {
      document.getElementById('subtab-login-phone')?.classList.toggle('hidden', sub !== 'login-phone');
      document.getElementById('subtab-register-phone')?.classList.toggle('hidden', sub !== 'register-phone');
    } else {
      document.getElementById('subtab-login-email')?.classList.toggle('hidden', sub !== 'login-email');
      document.getElementById('subtab-register-email')?.classList.toggle('hidden', sub !== 'register-email');
    }
  });
});

// ── Phone Login ───────────────────────────────────────────────────────────────
document.getElementById('phoneLoginBtn')?.addEventListener('click', async () => {
  const phone = document.getElementById('loginPhone')?.value.trim();
  const password = document.getElementById('loginPhonePassword')?.value;
  if (!/^\d{10}$/.test(phone)) { showAlert('phoneAlert', 'Enter a valid 10-digit mobile number.'); return; }
  if (!password) { showAlert('phoneAlert', 'Password is required.'); return; }
  const btn = document.getElementById('phoneLoginBtn');
  setLoading(btn, true, 'Logging in...');
  try {
    const data = await apiFetch('/api/auth/phone-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    setToken(data.token);
    localStorage.setItem('rt_user', JSON.stringify(data.user));
    closeLoginModal();
    window.location.href = '/booking.html';
  } catch (err) {
    showAlert('phoneAlert', err.message);
  } finally {
    setLoading(btn, false);
  }
});

// ── Phone Register ────────────────────────────────────────────────────────────
document.getElementById('phoneRegisterBtn')?.addEventListener('click', async () => {
  const phone = document.getElementById('regPhone')?.value.trim();
  const password = document.getElementById('regPhonePassword')?.value;
  if (!/^\d{10}$/.test(phone)) { showAlert('phoneAlert', 'Enter a valid 10-digit mobile number.'); return; }
  if (!password || password.length < 6) { showAlert('phoneAlert', 'Password must be at least 6 characters.'); return; }
  const btn = document.getElementById('phoneRegisterBtn');
  setLoading(btn, true, 'Creating account...');
  try {
    const data = await apiFetch('/api/auth/phone-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    setToken(data.token);
    localStorage.setItem('rt_user', JSON.stringify(data.user));
    closeLoginModal();
    window.location.href = '/booking.html';
  } catch (err) {
    showAlert('phoneAlert', err.message);
  } finally {
    setLoading(btn, false);
  }
});

// ── Email Login ───────────────────────────────────────────────────────────────
document.getElementById('emailLoginBtn')?.addEventListener('click', async () => {
  const email = document.getElementById('loginEmail')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;
  if (!email || !password) { showAlert('emailAlert', 'Email and password are required.'); return; }
  const btn = document.getElementById('emailLoginBtn');
  setLoading(btn, true, 'Logging in...');
  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    setToken(data.token);
    localStorage.setItem('rt_user', JSON.stringify(data.user));
    closeLoginModal();
    window.location.href = '/booking.html';
  } catch (err) {
    showAlert('emailAlert', err.message);
  } finally {
    setLoading(btn, false);
  }
});

// ── Email Register ────────────────────────────────────────────────────────────
document.getElementById('emailRegisterBtn')?.addEventListener('click', async () => {
  const email = document.getElementById('regEmail')?.value.trim();
  const password = document.getElementById('regPassword')?.value;
  if (!email || !password) { showAlert('emailAlert', 'Email and password are required.'); return; }
  if (password.length < 6) { showAlert('emailAlert', 'Password must be at least 6 characters.'); return; }
  const btn = document.getElementById('emailRegisterBtn');
  setLoading(btn, true, 'Creating account...');
  try {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    setToken(data.token);
    localStorage.setItem('rt_user', JSON.stringify(data.user));
    closeLoginModal();
    window.location.href = '/booking.html';
  } catch (err) {
    showAlert('emailAlert', err.message);
  } finally {
    setLoading(btn, false);
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById('navLogoutBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  clearToken();
  window.location.href = '/';
});

// ── Contact Form ──────────────────────────────────────────────────────────────
document.getElementById('contactForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('cName')?.value.trim();
  const contact = document.getElementById('cContact')?.value.trim();
  const message = document.getElementById('cMessage')?.value.trim();
  if (!name || !contact || !message) {
    showAlert('contactAlert', 'Please fill in all fields.');
    return;
  }
  showAlert('contactAlert', 'Thank you! We\'ll get back to you shortly.', 'success');
  document.getElementById('contactForm').reset();
});

// ── Init ──────────────────────────────────────────────────────────────────────
updateNavbar();

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
      navLinks?.classList.remove('open');
    }
  });
});