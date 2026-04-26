// Redirect if not logged in
if (!isLoggedIn()) {
  window.location.href = '/';
}

// Logout on booking page
document.getElementById('navLogoutBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  clearToken();
  window.location.href = '/';
});

// Booking form submission
document.getElementById('bookingForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Clear previous errors
  ['nameError', 'mobileError', 'goodsError', 'loadError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.classList.add('hidden'); }
  });

  const fullName = document.getElementById('fullName').value.trim();
  const mobile = document.getElementById('mobile').value.trim();
  const email = document.getElementById('email').value.trim();
  const goodsType = document.getElementById('goodsType').value;
  const loadTypeEl = document.querySelector('input[name="loadType"]:checked');
  const loadType = loadTypeEl?.value || '';

  let valid = true;

  if (!fullName) {
    showFieldError('nameError', 'Full name is required.');
    valid = false;
  }
  if (!/^\d{10}$/.test(mobile)) {
    showFieldError('mobileError', 'Please enter a valid 10-digit mobile number.');
    valid = false;
  }
  if (!goodsType) {
    showFieldError('goodsError', 'Please select the type of goods.');
    valid = false;
  }
  if (!loadType) {
    showFieldError('loadError', 'Please select a load type.');
    valid = false;
  }

  if (!valid) return;

  const btn = document.getElementById('submitBtn');
  setLoading(btn, true, 'Submitting...');

  try {
    const data = await apiFetch('/api/submissions', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ fullName, mobile, email, goodsType, loadType })
    });

    // Save for confirmation page
    sessionStorage.setItem('lastBooking', JSON.stringify({ fullName, mobile, email, goodsType, loadType }));
    window.location.href = '/confirmation.html';
  } catch (err) {
    showAlert('bookingAlert', err.message);
    setLoading(btn, false);
  }
});

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}
