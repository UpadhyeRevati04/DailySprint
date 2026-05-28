// ── Constants & State ───────────────────────────────────────
const SESSION_KEY   = 'taskflow_session';
const DB_KEY        = 'taskflow_users';
const TASKS_PREFIX  = 'taskflow_tasks_';

let currentUser   = null;
let tasks         = [];
let currentFilter = 'all';
let editingTaskId = null;
let tempSubtasks  = [];
let selectedDays  = 1;
let toastTimer    = null;

// ── Boot ────────────────────────────────────────────────────
(function init() {
  const sess = localStorage.getItem(SESSION_KEY);
  if (!sess) { window.location.href = '../index.html'; return; }
  currentUser = JSON.parse(sess);
  tasks = loadTasks();
  checkOverdueTasks();
  updateStreakFromActivity();
  renderAll();
  setGreeting();
})();

// ── Persistence ─────────────────────────────────────────────
function loadTasks() {
  return JSON.parse(localStorage.getItem(TASKS_PREFIX + currentUser.id) || '[]');
}
function saveTasks() {
  localStorage.setItem(TASKS_PREFIX + currentUser.id, JSON.stringify(tasks));
}
function getFullUser() {
  const users = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
  return users.find(u => u.id === currentUser.id);
}
function saveFullUser(user) {
  const users = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
  const idx = users.findIndex(u => u.id === user.id);
  if (idx !== -1) { users[idx] = user; localStorage.setItem(DB_KEY, JSON.stringify(users)); }
}

// ── Greeting ────────────────────────────────────────────────
function setGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greetingText').textContent = `${greet}, ${currentUser.name} 👋`;
  document.getElementById('userName').textContent = currentUser.name;
  document.getElementById('userEmail').textContent = currentUser.email;
  document.getElementById('userAvatar').textContent = currentUser.name[0].toUpperCase();
}

// ── Overdue Check ────────────────────────────────────────────
function checkOverdueTasks() {
  const today = todayStr();
  let changed = false;
  tasks.forEach(t => {
    if (t.status !== 'done' && t.dueDate < today) {
      t.status = 'overdue'; changed = true;
    }
  });
  if (changed) saveTasks();
}

// ── Streak Logic ─────────────────────────────────────────────
function updateStreakFromActivity() {
  const user = getFullUser();
  if (!user) return;
  if (!user.streakData) user.streakData = { currentStreak: 0, longestStreak: 0, lastCompletedDate: null, dailyLog: {} };

  const today = todayStr();
  const yesterday = offsetDate(-1);

  // Count tasks completed today
  const todayDone = tasks.filter(t => t.status === 'done' && t.completedDate === today).length;
  const todayTotal = tasks.filter(t => {
    return t.dueDate === today || (t.startDate <= today && t.dueDate >= today);
  }).length;

  if (todayDone > 0) {
    user.streakData.dailyLog[today] = { done: todayDone, total: todayTotal };
  }

  // Check if streak should continue or reset
  const last = user.streakData.lastCompletedDate;
  if (todayDone > 0 && last !== today) {
    if (last === yesterday) {
      user.streakData.currentStreak += 1;
    } else if (!last || last < yesterday) {
      user.streakData.currentStreak = 1;
    }
    user.streakData.lastCompletedDate = today;
    if (user.streakData.currentStreak > user.streakData.longestStreak) {
      user.streakData.longestStreak = user.streakData.currentStreak;
    }
  } else if (!last || (last < yesterday && todayDone === 0)) {
    // streak broken
    if (last && last < yesterday) {
      user.streakData.currentStreak = 0;
    }
  }

  saveFullUser(user);
  renderStreakUI(user.streakData);
}

function renderStreakUI(sd) {
  const n = sd.currentStreak || 0;
  document.getElementById('sidebarStreakNum').textContent = n;
  document.getElementById('mobileStreakNum').textContent = n;
  document.getElementById('streakBigNum').textContent = n;
  document.getElementById('longestStreak').textContent = sd.longestStreak || 0;

  // Ring progress (max 30 days = full ring)
  const deg = Math.min((n / 30) * 360, 360);
  document.getElementById('streakRing').style.setProperty('--progress', deg + 'deg');

  // Stats
  const done = tasks.filter(t => t.status === 'done').length;
  const total = tasks.length;
  document.getElementById('totalCompleted').textContent = done;
  document.getElementById('completionRate').textContent = total ? Math.round((done / total) * 100) + '%' : '0%';
  document.getElementById('longestStreak').textContent = sd.longestStreak || 0;
}

// ── Render All ───────────────────────────────────────────────
function renderAll() {
  renderStats();
  renderDashboard();
  renderTasksView();
  renderStreakView();
  renderAnalytics();
}

// ── Stats ────────────────────────────────────────────────────
function renderStats() {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.status === 'done').length;
  const pending = tasks.filter(t => t.status === 'todo' || t.status === 'inprogress').length;
  const overdue = tasks.filter(t => t.status === 'overdue').length;

  animateCount('statTotal',   total);
  animateCount('statDone',    done);
  animateCount('statPending', pending);
  animateCount('statOverdue', overdue);

  document.getElementById('greetingSub').textContent =
    overdue > 0 ? `⚠️ You have ${overdue} overdue task${overdue > 1 ? 's' : ''}.`
    : done === total && total > 0 ? '🎉 All tasks complete! Amazing work!'
    : `You have ${pending} task${pending !== 1 ? 's' : ''} in progress.`;
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  let current = 0;
  const step = Math.ceil(target / 20);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 30);
}

// ── Dashboard View ───────────────────────────────────────────
function renderDashboard() {
  const today = todayStr();
  const todayTasks    = tasks.filter(t => t.dueDate === today);
  const upcomingTasks = tasks.filter(t => t.dueDate > today && t.status !== 'done').slice(0, 5);

  document.getElementById('todayCount').textContent = todayTasks.length;
  renderTaskList('todayTaskList',    todayTasks,    'No tasks due today. Add one!',   '🗓️');
  renderTaskList('upcomingTaskList', upcomingTasks, "You're all caught up!",           '🚀');
}

// ── Tasks View ───────────────────────────────────────────────
function renderTasksView() {
  const query = (document.getElementById('searchInput')?.value || '').toLowerCase();
  let filtered = [...tasks];

  if (currentFilter === 'overdue')    filtered = filtered.filter(t => t.status === 'overdue');
  else if (currentFilter !== 'all')   filtered = filtered.filter(t => t.status === currentFilter);
  if (query) filtered = filtered.filter(t => t.title.toLowerCase().includes(query) || (t.desc || '').toLowerCase().includes(query));

  // Sort: overdue first, then by dueDate
  filtered.sort((a, b) => {
    const order = { overdue: 0, todo: 1, inprogress: 2, done: 3 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return a.dueDate.localeCompare(b.dueDate);
  });

  renderTaskList('allTaskList', filtered, 'No tasks match. Try a different filter.', '🔍');
}

function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTasksView();
}

// ── Task List Renderer ───────────────────────────────────────
function renderTaskList(containerId, taskArr, emptyMsg, emptyIcon) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!taskArr.length) {
    container.innerHTML = `<div class="empty-state"><span>${emptyIcon}</span><p>${emptyMsg}</p></div>`;
    return;
  }
  container.innerHTML = taskArr.map(t => taskCardHTML(t)).join('');
}

function taskCardHTML(t) {
  const isDone    = t.status === 'done';
  const isOverdue = t.status === 'overdue';
  const daysLeft  = daysUntil(t.dueDate);
  const dueLabel  = isDone ? '✅ Done'
    : isOverdue ? `⚠️ ${Math.abs(daysLeft)}d overdue`
    : daysLeft === 0 ? '📅 Due today'
    : daysLeft > 0 ? `📅 ${daysLeft}d left`
    : '';

  const subDone  = (t.subtasks || []).filter(s => s.done).length;
  const subTotal = (t.subtasks || []).length;
  const subPct   = subTotal ? Math.round((subDone / subTotal) * 100) : 0;

  const catEmoji = { work: '💼', personal: '🏠', health: '💪', learning: '📚', other: '📌' };

  return `
  <div class="task-card ${isDone ? 'done' : ''} ${isOverdue ? 'overdue' : ''}" onclick="toggleTaskDone('${t.id}', event)">
    <div class="task-check" onclick="toggleTaskDone('${t.id}', event)">
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        <path d="M2 6l3 3 5-5" stroke="#0a0a0f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="task-content">
      <div class="task-name">${escapeHTML(t.title)}</div>
      <div class="task-meta">
        <span class="task-pill priority-${t.priority}">${priorityLabel(t.priority)}</span>
        <span class="task-pill">${catEmoji[t.category] || '📌'} ${capitalize(t.category)}</span>
        ${dueLabel ? `<span class="task-pill ${isOverdue ? 'overdue-pill' : ''}">${dueLabel}</span>` : ''}
        ${t.estimatedDays > 1 ? `<span class="task-pill">⏱ ${t.estimatedDays}d task</span>` : ''}
      </div>
      ${subTotal ? `
        <div class="subtask-progress" title="${subDone}/${subTotal} subtasks">
          <div class="subtask-progress-fill" style="width:${subPct}%"></div>
        </div>` : ''}
    </div>
    <div class="task-actions" onclick="event.stopPropagation()">
      <button class="task-action-btn" onclick="openEditModal('${t.id}')" title="Edit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
      <button class="task-action-btn delete" onclick="deleteTask('${t.id}')" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
    </div>
  </div>`;
}

// ── Toggle Done ──────────────────────────────────────────────
function toggleTaskDone(id, e) {
  if (e && e.target.closest('.task-action-btn')) return;
  const t = tasks.find(t => t.id === id);
  if (!t) return;

  if (t.status === 'done') {
    t.status = t.dueDate < todayStr() ? 'overdue' : 'todo';
    t.completedDate = null;
    showToast('Task marked incomplete');
  } else {
    t.status = 'done';
    t.completedDate = todayStr();
    showToast('✅ Task completed! Keep it up!');
    triggerConfetti();
  }
  saveTasks();
  updateStreakFromActivity();
  renderAll();
}

// ── Delete Task ──────────────────────────────────────────────
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderAll();
  showToast('🗑️ Task deleted');
}

// ── Streak View ──────────────────────────────────────────────
function renderStreakView() {
  renderHeatmap();
  renderTimeline();
}

function renderHeatmap() {
  const container = document.getElementById('heatmap');
  if (!container) return;
  const user = getFullUser();
  const log  = user?.streakData?.dailyLog || {};
  let html   = '';

  for (let i = 29; i >= 0; i--) {
    const d     = offsetDate(-i);
    const entry = log[d];
    let level   = 0;
    if (entry) {
      const pct = entry.total ? entry.done / entry.total : 0;
      if (pct > 0)    level = 1;
      if (pct >= 0.5) level = 2;
      if (pct >= 0.8) level = 3;
      if (pct >= 1)   level = 4;
    }
    const isToday = d === todayStr();
    html += `<div class="heatmap-cell level-${level}" title="${d}${entry ? `: ${entry.done}/${entry.total} tasks` : ''}" style="${isToday ? 'outline:2px solid var(--accent2);' : ''}"></div>`;
  }
  container.innerHTML = html;
}

function renderTimeline() {
  const container = document.getElementById('timeline');
  if (!container) return;

  const sorted = [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 10);
  if (!sorted.length) { container.innerHTML = '<div class="empty-state"><span>📅</span><p>No tasks yet</p></div>'; return; }

  const today = todayStr();
  container.innerHTML = sorted.map(t => {
    const dotClass = t.status === 'done' ? 'done' : t.status === 'overdue' ? 'overdue' : t.dueDate === today ? 'active' : '';
    const label    = t.status === 'done' ? 'Completed' : t.status === 'overdue' ? 'Overdue' : t.dueDate === today ? 'Due today' : `Due ${formatDate(t.dueDate)}`;
    return `
    <div class="timeline-item">
      <div class="tl-line">
        <div class="tl-dot ${dotClass}"></div>
        <div class="tl-connector"></div>
      </div>
      <div class="tl-content">
        <div class="tl-name">${escapeHTML(t.title)}</div>
        <div class="tl-date">${label} · ${capitalize(t.priority)} priority · ${capitalize(t.category)}</div>
      </div>
    </div>`;
  }).join('');
}

// ── Analytics ────────────────────────────────────────────────
function renderAnalytics() {
  renderWeeklyChart();
  renderPriorityChart();
  renderCategoryBreakdown();
}

function renderWeeklyChart() {
  const container = document.getElementById('weeklyChart');
  if (!container) return;
  const days  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const today = new Date();
  const counts = days.map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const ds = d.toISOString().split('T')[0];
    return tasks.filter(t => t.completedDate === ds).length;
  });
  const max = Math.max(...counts, 1);
  container.innerHTML = counts.map((c, i) => `
    <div class="bar-wrap">
      <div class="bar ${c > 0 ? 'has-data' : ''}" style="height:${Math.max((c / max) * 100, c > 0 ? 8 : 4)}%" title="${c} tasks"></div>
      <span class="bar-lbl">${days[i]}</span>
    </div>`).join('');
}

function renderPriorityChart() {
  const container = document.getElementById('priorityDonut');
  if (!container) return;
  const priorities = [
    { key: 'high',   label: '🔴 High',   color: 'var(--priority-high)' },
    { key: 'medium', label: '🟡 Medium', color: 'var(--priority-medium)' },
    { key: 'low',    label: '🟢 Low',    color: 'var(--priority-low)' },
  ];
  const total = tasks.length || 1;
  container.innerHTML = priorities.map(p => {
    const count = tasks.filter(t => t.priority === p.key).length;
    const pct   = Math.round((count / total) * 100);
    return `
    <div class="donut-row">
      <div class="donut-swatch" style="background:${p.color}"></div>
      <span class="donut-label">${p.label}</span>
      <span class="donut-count">${count}</span>
      <div class="donut-bar-bg">
        <div class="donut-bar-fill" style="width:${pct}%; background:${p.color}"></div>
      </div>
    </div>`;
  }).join('');
}

function renderCategoryBreakdown() {
  const container = document.getElementById('categoryBreakdown');
  if (!container) return;
  const cats = [
    { key: 'work',     label: '💼 Work' },
    { key: 'personal', label: '🏠 Personal' },
    { key: 'health',   label: '💪 Health' },
    { key: 'learning', label: '📚 Learning' },
    { key: 'other',    label: '📌 Other' },
  ];
  const total = tasks.length || 1;
  container.innerHTML = cats.map(c => {
    const count = tasks.filter(t => t.category === c.key).length;
    const done  = tasks.filter(t => t.category === c.key && t.status === 'done').length;
    const pct   = Math.round((count / total) * 100);
    return `
    <div class="donut-row">
      <span class="donut-label">${c.label}</span>
      <span class="donut-count" style="font-size:0.78rem;color:var(--text-dim)">${done}/${count}</span>
      <div class="donut-bar-bg">
        <div class="donut-bar-fill" style="width:${pct}%; background:var(--accent)"></div>
      </div>
    </div>`;
  }).join('');
}

// ── Modal ────────────────────────────────────────────────────
function openTaskModal() {
  editingTaskId = null;
  tempSubtasks  = [];
  selectedDays  = 1;
  document.getElementById('modalTitle').textContent    = 'New Task';
  document.getElementById('saveTaskLabel').textContent = 'Create Task';
  document.getElementById('taskTitle').value    = '';
  document.getElementById('taskDesc').value     = '';
  document.getElementById('taskPriority').value = 'medium';
  document.getElementById('taskCategory').value = 'work';
  document.getElementById('taskStart').value    = todayStr();
  document.getElementById('taskDue').value      = todayStr();
  document.getElementById('modalError').classList.add('hidden');
  document.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', b.dataset.days === '1'));
  renderSubtaskList();
  document.getElementById('taskModalOverlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
}

function openEditModal(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  editingTaskId = id;
  tempSubtasks  = [...(t.subtasks || [])];
  selectedDays  = t.estimatedDays || 1;

  document.getElementById('modalTitle').textContent    = 'Edit Task';
  document.getElementById('saveTaskLabel').textContent = 'Save Changes';
  document.getElementById('taskTitle').value    = t.title;
  document.getElementById('taskDesc').value     = t.desc || '';
  document.getElementById('taskPriority').value = t.priority;
  document.getElementById('taskCategory').value = t.category;
  document.getElementById('taskStart').value    = t.startDate || todayStr();
  document.getElementById('taskDue').value      = t.dueDate;
  document.getElementById('modalError').classList.add('hidden');
  document.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('active', +b.dataset.days === selectedDays));
  renderSubtaskList();
  document.getElementById('taskModalOverlay').classList.remove('hidden');
}

function closeTaskModal(e) {
  if (e && e.target !== document.getElementById('taskModalOverlay')) return;
  document.getElementById('taskModalOverlay').classList.add('hidden');
}

function selectDays(n, btn) {
  selectedDays = n;
  document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Auto-set due date from start
  const start = document.getElementById('taskStart').value;
  if (start) {
    const d = new Date(start);
    d.setDate(d.getDate() + n - 1);
    document.getElementById('taskDue').value = d.toISOString().split('T')[0];
  }
}

function addSubtask() {
  const input = document.getElementById('subtaskInput');
  const val   = input.value.trim();
  if (!val) return;
  tempSubtasks.push({ id: 'st_' + Date.now(), text: val, done: false });
  input.value = '';
  renderSubtaskList();
}

function removeSubtask(id) {
  tempSubtasks = tempSubtasks.filter(s => s.id !== id);
  renderSubtaskList();
}

function renderSubtaskList() {
  const container = document.getElementById('subtaskList');
  if (!container) return;
  container.innerHTML = tempSubtasks.map(s => `
    <div class="subtask-item">
      <span>${escapeHTML(s.text)}</span>
      <button class="rm-sub" onclick="removeSubtask('${s.id}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>`).join('');
}

function saveTask() {
  const title    = document.getElementById('taskTitle').value.trim();
  const desc     = document.getElementById('taskDesc').value.trim();
  const priority = document.getElementById('taskPriority').value;
  const category = document.getElementById('taskCategory').value;
  const start    = document.getElementById('taskStart').value;
  const due      = document.getElementById('taskDue').value;
  const errEl    = document.getElementById('modalError');

  errEl.classList.add('hidden');
  if (!title) { showModalError('Please enter a task title.'); return; }
  if (!due)   { showModalError('Please select a due date.'); return; }
  if (start && due && due < start) { showModalError('Due date cannot be before start date.'); return; }

  const today = todayStr();
  let status = due < today ? 'overdue' : 'todo';

  if (editingTaskId) {
    const t = tasks.find(t => t.id === editingTaskId);
    if (t) {
      t.title         = title;
      t.desc          = desc;
      t.priority      = priority;
      t.category      = category;
      t.startDate     = start;
      t.dueDate       = due;
      t.estimatedDays = selectedDays;
      t.subtasks      = tempSubtasks;
      if (t.status !== 'done') t.status = status;
    }
    showToast('✏️ Task updated');
  } else {
    tasks.push({
      id: 'task_' + Date.now(),
      title, desc, priority, category,
      startDate: start, dueDate: due,
      estimatedDays: selectedDays,
      status,
      subtasks: tempSubtasks,
      createdAt: new Date().toISOString(),
      completedDate: null
    });
    showToast('🎯 Task created!');
  }

  saveTasks();
  renderAll();
  document.getElementById('taskModalOverlay').classList.add('hidden');
}

function showModalError(msg) {
  const el = document.getElementById('modalError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ── View Navigation ──────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelector(`[data-view="${name}"]`).classList.add('active');
  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.add('hidden');
}

// ── Sidebar (mobile) ─────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('hidden');
}

// ── Logout ───────────────────────────────────────────────────
function logout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = '../index.html';
}

// ── Confetti ─────────────────────────────────────────────────
function triggerConfetti() {
  const colors = ['#7c6af7', '#f7c46a', '#6af7b8', '#f76a6a', '#fff'];
  for (let i = 0; i < 28; i++) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; z-index:9999; pointer-events:none;
      width:${6 + Math.random() * 8}px; height:${6 + Math.random() * 8}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      left:${20 + Math.random() * 60}%; top:${30 + Math.random() * 30}%;
      animation:confettiFall ${0.8 + Math.random() * 0.8}s ease forwards;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }
}

// Inject confetti keyframe once
const styleEl = document.createElement('style');
styleEl.textContent = `
@keyframes confettiFall {
  0%   { transform: translateY(0) rotate(0deg) scale(1); opacity:1; }
  100% { transform: translateY(120px) rotate(${Math.random()*360}deg) scale(0.3); opacity:0; }
}`;
document.head.appendChild(styleEl);

// ── Toast ────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2400);
}

// ── Utilities ────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function offsetDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
function daysUntil(dateStr) {
  const now  = new Date(); now.setHours(0,0,0,0);
  const then = new Date(dateStr + 'T00:00:00');
  return Math.round((then - now) / 86400000);
}
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function priorityLabel(p) {
  return p === 'high' ? '🔴 High' : p === 'medium' ? '🟡 Medium' : '🟢 Low';
}
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function escapeHTML(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ESC closes modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('taskModalOverlay').classList.add('hidden');
});
