// ── Auth State ─────────────────────────────────────────────
const DB_KEY = 'taskflow_users';
const SESSION_KEY = 'taskflow_session';

function getUsers() {
  return JSON.parse(localStorage.getItem(DB_KEY) || '[]');
}
function saveUsers(users) {
  localStorage.setItem(DB_KEY, JSON.stringify(users));
}
function setSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, email: user.email, name: user.firstName }));
}

// Redirect if already logged in
(function () {
  const sess = localStorage.getItem(SESSION_KEY);
  if (sess) window.location.href = 'pages/dashboard.html';
})();

// ── Tab Toggle ──────────────────────────────────────────────
function showLogin() {
  document.getElementById('loginPanel').classList.remove('hidden');
  document.getElementById('registerPanel').classList.add('hidden');
  document.getElementById('tabLogin').classList.add('active');
  document.getElementById('tabRegister').classList.remove('active');
  document.getElementById('tabIndicator').classList.remove('right');
}
function showRegister() {
  document.getElementById('loginPanel').classList.add('hidden');
  document.getElementById('registerPanel').classList.remove('hidden');
  document.getElementById('tabLogin').classList.remove('active');
  document.getElementById('tabRegister').classList.add('active');
  document.getElementById('tabIndicator').classList.add('right');
  document.getElementById('registerPanel').style.animation = 'none';
  requestAnimationFrame(() => {
    document.getElementById('registerPanel').style.animation = 'fadeUp 0.35s ease both';
  });
}

// ── Login ───────────────────────────────────────────────────
function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');

  errEl.classList.add('hidden');
  if (!email || !pass) { showError(errEl, 'Please fill in all fields.'); return; }

  const users = getUsers();
  const user = users.find(u => u.email === email && u.password === btoa(pass));
  if (!user) { showError(errEl, 'Invalid email or password.'); return; }

  setSession(user);
  animateSuccess(() => window.location.href = 'pages/dashboard.html');
}

// ── Register ────────────────────────────────────────────────
function handleRegister() {
  const first = document.getElementById('regFirst').value.trim();
  const last  = document.getElementById('regLast').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass  = document.getElementById('regPassword').value;
  const errEl = document.getElementById('registerError');

  errEl.classList.add('hidden');
  if (!first || !last || !email || !pass) { showError(errEl, 'Please fill in all fields.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError(errEl, 'Please enter a valid email.'); return; }
  if (pass.length < 6) { showError(errEl, 'Password must be at least 6 characters.'); return; }

  const users = getUsers();
  if (users.find(u => u.email === email)) { showError(errEl, 'An account with this email already exists.'); return; }

  const newUser = {
    id: 'u_' + Date.now(),
    firstName: first,
    lastName: last,
    email,
    password: btoa(pass),
    createdAt: new Date().toISOString(),
    streakData: { currentStreak: 0, longestStreak: 0, lastCompletedDate: null, dailyLog: {} }
  };
  users.push(newUser);
  saveUsers(users);
  setSession(newUser);
  animateSuccess(() => window.location.href = 'pages/dashboard.html');
}

// ── Helpers ─────────────────────────────────────────────────
function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.animation = 'none';
  requestAnimationFrame(() => el.style.animation = 'fadeUp 0.3s ease');
}

function animateSuccess(cb) {
  const btn = document.querySelector('.form-panel:not(.hidden) .btn-primary');
  btn.style.background = '#6af7b8';
  btn.style.color = '#0a0a0f';
  btn.querySelector('span').textContent = 'Loading...';
  setTimeout(cb, 600);
}

// Enter key support
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const loginVisible = !document.getElementById('loginPanel').classList.contains('hidden');
  if (loginVisible) handleLogin(); else handleRegister();
});
