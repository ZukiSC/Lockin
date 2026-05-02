// Application state
let tasks = [];
let habits = [];
let wins = [];
let taskFilter = 'all';
let soundEnabled = true;
let lastUpdateTime = Date.now();
let supabaseReady = false;
let supabase = null;
let userId = null;

// Chart instances (global for updating)
let earningsChart = null;
let taskCompletionChart = null;

// Phase system
const phases = [
  { id: 1, name: 'Foundation — Web + AI basics', start: new Date('2026-05-02'), end: new Date('2026-05-31'), duration: 30, earnings_goal: 10000, color: '#c77dff' },
  { id: 2, name: 'Build AI-powered tools', start: new Date('2026-06-01'), end: new Date('2026-06-30'), duration: 30, earnings_goal: 100000, color: '#6dd5c3' },
  { id: 3, name: 'Land clients + sell services', start: new Date('2026-07-01'), end: new Date('2026-07-31'), duration: 30, earnings_goal: 300000, color: '#ffa66d' },
  { id: 4, name: 'Micro-SaaS + recurring income', start: new Date('2026-08-01'), end: new Date('2026-10-15'), duration: 76, earnings_goal: 500000, color: '#ff8a7a' }
];

// Daily standup data
let standups = [];

// Hustle AI conversation history and snippets
let hustleConversation = [];
let savedSnippets = [];

const today = new Date().getDay();
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Supabase Configuration
const SUPABASE_URL = 'https://wnlexwnakuzwwhlalewu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubGV4d25ha3V6d3dobGFsZXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjg0MzQsImV4cCI6MjA5Mjk0NDQzNH0.m5XCzqqbgRfkX0N3A45BEKO4bmjccUSFqmpc1vSa9_c';

// Initialize Supabase (with fallback mode if not configured)
async function initSupabase() {
  try {
    // Check if using default config (not set up)
    if (SUPABASE_URL === 'https://your-project.supabase.co' || SUPABASE_KEY === 'your-anon-key') {
      console.log('Supabase not configured - using localStorage only');
      supabaseReady = false;
      return false;
    }
    
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Test connection
    const { data, error } = await supabase.from('health').select('*').limit(1);
    if (error) throw error;
    
    // Generate anonymous session ID
    userId = 'anon-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    localStorage.setItem('500k-before-19-user-id', userId);
    
    supabaseReady = true;
    console.log('✓ Connected to Supabase');
    return true;
  } catch (err) {
    console.log('Supabase unavailable - using localStorage', err.message);
    supabaseReady = false;
    return false;
  }
}

// ===== PHASE SYSTEM =====
function getCurrentPhase() {
  const now = new Date();
  return phases.find(p => now >= p.start && now <= p.end) || phases[0];
}

function getPhaseProgress() {
  const phase = getCurrentPhase();
  const total = phase.duration;
  const elapsed = Math.floor((new Date() - phase.start) / 86400000);
  return { elapsed: Math.max(0, Math.min(elapsed, total)), total, percent: Math.round(Math.max(0, Math.min(elapsed, total)) / total * 100) };
}

function getPhaseTarget() {
  const phase = getCurrentPhase();
  return phase.earnings_goal;
}

function getPhaseEarnings() {
  const phase = getCurrentPhase();
  return wins.filter(w => new Date(Math.floor(w.id / 1000)) >= phase.start).reduce((s, w) => s + w.money, 0);
}

function getDailyTarget() {
  const phase = getCurrentPhase();
  const phaseProgress = getPhaseProgress();
  const remaining = Math.max(1, phase.duration - phaseProgress.elapsed);
  const goal = phase.earnings_goal;
  const earned = getPhaseEarnings();
  return Math.ceil((goal - earned) / remaining);
}

// ===== ANALYTICS FUNCTIONS =====
function getEarningsVelocity() {
  const month = new Date();
  month.setDate(1);
  const monthWins = wins.filter(w => new Date(Math.floor(w.id / 1000)) >= month);
  const daysInMonth = new Date().getDate();
  const total = monthWins.reduce((s, w) => s + w.money, 0);
  return Math.round(total / daysInMonth);
}

function getBestCategory() {
  if (!tasks.length) return '—';
  const cats = { money: 0, skill: 0, health: 0 };
  tasks.filter(t => t.done).forEach(t => cats[t.cat]++);
  const max = Math.max(...Object.values(cats));
  const best = Object.entries(cats).find(([k, v]) => v === max);
  if (!best || best[1] === 0) return '—';
  return best[0].charAt(0).toUpperCase() + best[0].slice(1);
}

function getProjection() {
  const velocity = getEarningsVelocity();
  const total = wins.reduce((s, w) => s + w.money, 0);
  const bday = new Date('2026-10-15');
  const now = new Date();
  const daysLeft = Math.ceil((bday - now) / 86400000);
  return Math.round(total + (velocity * daysLeft));
}

function getLast30DaysEarnings() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const data = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    data[dateStr] = 0;
  }
  wins.filter(w => new Date(Math.floor(w.id / 1000)) >= thirtyDaysAgo).forEach(w => {
    const dateStr = new Date(Math.floor(w.id / 1000)).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    if (data[dateStr] !== undefined) data[dateStr] += w.money;
  });
  return data;
}

function getWeeklyTaskCompletion() {
  const today = new Date();
  const data = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    data[dateStr] = { total: 0, completed: 0 };
  }
  tasks.forEach(t => {
    const dateStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Math.floor(t.id / 1000)).getDay()];
    if (data[dateStr]) {
      data[dateStr].total++;
      if (t.done) data[dateStr].completed++;
    }
  });
  return data;
}

// Hybrid Storage System: Supabase + LocalStorage
const Storage = {
  async save() {
    const data = { tasks, habits, wins, standups, savedSnippets, soundEnabled, timestamp: Date.now() };

    // Always save to localStorage first (fast, reliable)
    localStorage.setItem('500k-before-19-data', JSON.stringify(data));

    // Try to sync to Supabase if available
    if (supabaseReady && supabase && userId) {
      try {
        const syncData = {
          user_id: userId,
          tasks: tasks,
          habits: habits,
          wins: wins,
          standups: standups,
          saved_snippets: savedSnippets,
          preferences: { soundEnabled },
          last_synced: new Date().toISOString(),
          device_timestamp: Date.now()
        };

        // Upsert (insert or update) user data
        const { error } = await supabase
          .from('user_data')
          .upsert(syncData, { onConflict: 'user_id' });

        if (error) {
          console.warn('Supabase sync failed:', error);
          // Gracefully degrade to localStorage only
        } else {
          localStorage.setItem('last-sync', new Date().toISOString());
          console.log('✓ Data synced to Supabase');
        }
      } catch (err) {
        console.warn('Sync error:', err.message);
      }
    }
  },

  async load() {
    // Try Supabase first if available
    if (supabaseReady && supabase && userId) {
      try {
        const { data, error } = await supabase
          .from('user_data')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (data && !error) {
          tasks = data.tasks || [];
          habits = data.habits || [];
          wins = data.wins || [];
          standups = data.standups || [];
          savedSnippets = data.saved_snippets || [];
          soundEnabled = data.preferences?.soundEnabled !== false;
          console.log('✓ Data loaded from Supabase');

          // Update local cache
          localStorage.setItem('500k-before-19-data', JSON.stringify({
            tasks, habits, wins, standups, savedSnippets, soundEnabled, timestamp: Date.now()
          }));
          return true;
        }
      } catch (err) {
        console.log('Supabase load failed, falling back to localStorage:', err.message);
      }
    }

    // Fallback to localStorage
    const localData = localStorage.getItem('500k-before-19-data');
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        tasks = parsed.tasks || [];
        habits = parsed.habits || [];
        wins = parsed.wins || [];
        standups = parsed.standups || [];
        savedSnippets = parsed.savedSnippets || [];
        soundEnabled = parsed.soundEnabled !== false;
        console.log('✓ Data loaded from localStorage');
        return true;
      } catch (err) {
        console.error('LocalStorage parse error:', err);
      }
    }
    return false;
  },

  clear() {
    localStorage.removeItem('500k-before-19-data');
    localStorage.removeItem('500k-before-19-user-id');
    localStorage.removeItem('last-sync');
    tasks = [];
    habits = [];
    wins = [];
    standups = [];
    savedSnippets = [];

    // Also clear from Supabase if available
    if (supabaseReady && supabase && userId) {
      supabase.from('user_data').delete().eq('user_id', userId).catch(err => {
        console.warn('Supabase delete failed:', err.message);
      });
    }
  }
};

// Theme Manager
const Theme = {
  init() {
    const saved = localStorage.getItem('theme-preference');
    if (saved) {
      this.set(saved);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.set(prefersDark ? 'dark' : 'light');
    }
  },
  set(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('light-theme', !isDark);
    localStorage.setItem('theme-preference', theme);
    updateThemeButton();
  },
  toggle() {
    const current = localStorage.getItem('theme-preference') || 'dark';
    this.set(current === 'dark' ? 'light' : 'dark');
  }
};

function updateThemeButton() {
  const isDark = !document.body.classList.contains('light-theme');
  const btn = document.getElementById('theme-btn');
  const settingBtn = document.getElementById('theme-setting-btn');
  if (btn) btn.textContent = isDark ? '🌙' : '☀️';
  if (settingBtn) settingBtn.textContent = (isDark ? '🌙' : '☀️') + ' ' + (isDark ? 'Dark' : 'Light');
}

function toggleTheme() {
  Theme.toggle();
}

function toggleNotifications() {
  const toggle = document.getElementById('notify-toggle');
  soundEnabled = toggle.checked;
  Storage.save();
}

// Utility: Debounce
function debounce(fn, delay = 300) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Utility: Play sound
function playSound() {
  if (!soundEnabled) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.2);
}

// Tab switching
function sw(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.nbtn').forEach(b => b.classList.remove('on'));
  document.getElementById('tab-' + name).classList.add('on');
  if (btn) btn.classList.add('on');
  
  if (name === 'analytics') {
    updateAnalytics();
  }
}

// Countdown timer
function countdown() {
  const bday = new Date('2026-10-15T00:00:00');
  const now = new Date();
  const diff = bday - now;
  
  if (diff < 0) return;
  
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  
  document.getElementById('cd-d').textContent = d;
  document.getElementById('cd-h').textContent = h;
  document.getElementById('cd-m').textContent = m;
  document.getElementById('cd-s').textContent = s;
  
  if (document.getElementById('days-remaining')) {
    document.getElementById('days-remaining').textContent = d;
  }
}

setInterval(countdown, 1000);
countdown();

// Money display
function updateMoneyDisplay() {
  const total = wins.reduce((s, w) => s + w.money, 0);
  const fmt = total.toLocaleString('en-PH');
  
  document.getElementById('total-earned').textContent = fmt;
  document.getElementById('w-total').textContent = fmt;
  
  const pct = Math.min(100, +(total / 1000000 * 100).toFixed(2));
  document.getElementById('main-pbar').style.width = pct + '%';
  document.getElementById('w-pbar').style.width = pct + '%';
  document.getElementById('main-pct').textContent = pct + '% there';
  document.getElementById('w-pct').textContent = pct + '% of ₱1M';
  
  const rem = Math.max(0, 1000000 - total);
  document.getElementById('w-remaining').textContent = '₱' + rem.toLocaleString('en-PH') + ' to go';
}

// Task management
function addTask() {
  const val = document.getElementById('task-in').value.trim();
  const cat = document.getElementById('task-cat').value;
  
  if (!val) return;
  
  tasks.push({
    id: Date.now(),
    text: val,
    cat: cat,
    done: false
  });
  
  document.getElementById('task-in').value = '';
  renderTasks();
  updateDash();
  Storage.save(); // Non-blocking
  playSound();
}

function toggleTask(id) {
  const t = tasks.find(x => x.id === id);
  if (t) {
    t.done = !t.done;
    renderTasks();
    updateDash();
    Storage.save();
    if (t.done) playSound();
  }
}

function delTask(id) {
  tasks = tasks.filter(x => x.id !== id);
  renderTasks();
  updateDash();
  Storage.save();
}

function filterTasks(f, btn) {
  taskFilter = f;
  document.querySelectorAll('.pill-row .pill').forEach(p => p.classList.remove('on'));
  btn.classList.add('on');
  renderTasks();
}

function renderTasks() {
  const list = document.getElementById('task-list');
  const empty = document.getElementById('task-empty');
  const filtered = taskFilter === 'all' ? tasks : tasks.filter(t => t.cat === taskFilter);
  
  empty.style.display = filtered.length ? 'none' : 'block';
  
  list.innerHTML = filtered.map(t => `
    <div class="todo-item">
      <input type="checkbox" class="todo-cb" ${t.done ? 'checked' : ''} onchange="toggleTask(${t.id})">
      <div class="cat-pip ${t.cat}"></div>
      <span class="todo-txt ${t.done ? 'done' : ''}">${t.text}</span>
      <span class="del-btn" onclick="delTask(${t.id})">×</span>
    </div>
  `).join('');
  
  const total = tasks.length;
  const done = tasks.filter(x => x.done).length;
  document.getElementById('t-total').textContent = total;
  document.getElementById('t-done').textContent = done;
  document.getElementById('t-pct').textContent = total ? Math.round(done / total * 100) + '%' : '0%';
}

renderTasks();

// Habit management
function addHabit() {
  const val = document.getElementById('habit-in').value.trim();
  
  if (!val) return;
  
  habits.push({
    id: Date.now(),
    name: val,
    week: Array(7).fill(false),
    streak: 0
  });
  
  document.getElementById('habit-in').value = '';
  renderHabits();
  updateDash();
  Storage.save();
  playSound();
}

function toggleDot(id, i) {
  const h = habits.find(x => x.id === id);
  if (!h) return;
  
  h.week[i] = !h.week[i];
  h.streak = h.week.filter(Boolean).length;
  renderHabits();
  updateDash();
  Storage.save();
  if (h.week[i]) playSound();
}

function delHabit(id) {
  habits = habits.filter(x => x.id !== id);
  renderHabits();
  updateDash();
  Storage.save();
}

function renderHabits() {
  const list = document.getElementById('habit-list');
  const empty = document.getElementById('habit-empty');
  empty.style.display = habits.length ? 'none' : 'block';
  
  const dl = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  
  list.innerHTML = habits.map(h => `
    <div class="habit-item">
      <div class="habit-row">
        <span class="habit-name">${h.name}</span>
        <span class="streak">${h.streak}d</span>
        <span class="del-btn" onclick="delHabit(${h.id})">×</span>
      </div>
      <div class="dots">${h.week.map((d, i) => `
        <div class="dot ${d ? 'done' : ''} ${i === today ? 'today' : ''}" 
             onclick="toggleDot(${h.id}, ${i})" 
             title="${dl[i]}"></div>
      `).join('')}</div>
      <div style="display:flex;gap:6px;margin-bottom:4px">${dl.map((l, i) => `<div class="dot-label">${l}</div>`).join('')}</div>
      <div class="habit-prog">
        <div class="hpbar"><div class="hpbar-fill" style="width:${Math.round(h.streak / 7 * 100)}%"></div></div>
        <button class="mark-btn ${h.week[today] ? 'marked' : ''}" onclick="toggleDot(${h.id}, ${today})">${h.week[today] ? 'done today' : 'mark today'}</button>
      </div>
    </div>
  `).join('');
  
  const best = habits.reduce((mx, h) => Math.max(mx, h.streak), 0);
  document.getElementById('h-count').textContent = habits.length;
  document.getElementById('h-today').textContent = habits.filter(h => h.week[today]).length;
  document.getElementById('h-best').textContent = best + 'd';
}

renderHabits();

// Win management
function addWin() {
  const text = document.getElementById('win-txt').value.trim();
  const money = parseInt(document.getElementById('win-php').value) || 0;

  if (!text) return;

  const now = new Date();
  wins.unshift({
    id: Date.now(),
    text: text,
    money: money,
    date: now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  });

  document.getElementById('win-txt').value = '';
  document.getElementById('win-php').value = '';

  renderWins();
  updateMoneyDisplay();
  updateDash();
  Storage.save();
  playSound();

  // Trigger confetti for significant wins
  if (money >= 1000) {
    confetti({ particleCount: 50, spread: 60 });
  }

  // Check for milestones
  checkMilestones();
}

function delWin(id) {
  wins = wins.filter(x => x.id !== id);
  renderWins();
  updateMoneyDisplay();
  updateDash();
  Storage.save();
}

function renderWins() {
  const list = document.getElementById('win-list');
  const empty = document.getElementById('win-empty');
  empty.style.display = wins.length ? 'none' : 'block';
  
  list.innerHTML = wins.map(w => `
    <div class="win-item">
      <div class="win-dot"></div>
      <div style="flex:1">
        <div class="win-txt">${w.text}</div>
        ${w.money ? `<div class="win-money">+₱${w.money.toLocaleString()}</div>` : ''}
      </div>
      <div class="win-meta">${w.date}</div>
      <span class="del-btn" onclick="delWin(${w.id})">×</span>
    </div>
  `).join('');
}

renderWins();

// Dashboard update
function updateDash() {
  const total = tasks.length;
  const done = tasks.filter(x => x.done).length;
  document.getElementById('dash-tasks').textContent = done + '/' + total;
  document.getElementById('dash-habits').textContent = habits.filter(h => h.week[today]).length + '/' + habits.length;
  document.getElementById('dash-wins').textContent = wins.length;

  // Update phase info
  const phase = getCurrentPhase();
  const phaseProgress = getPhaseProgress();
  const phaseEarnings = getPhaseEarnings();
  const phaseTarget = getPhaseTarget();
  const dailyTarget = getDailyTarget();

  // Find and update phase display
  const phaseCard = document.querySelector('.card');
  if (phaseCard && phaseCard.textContent.includes('Phase')) {
    const phaseBadgeClass = ['pb-purple', 'pb-teal', 'pb-amber', 'pb-coral'][phase.id - 1];
    phaseCard.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span class="phase-badge ${phaseBadgeClass}">Phase ${phase.id}</span>
        <span style="font-size:13px;font-weight:500;color:var(--color-text-primary)">${phase.name}</span>
      </div>
      <div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:10px">
        Day ${phaseProgress.elapsed}/${phaseProgress.total} · ${phaseProgress.percent}% complete
      </div>
      <div style="margin-bottom:12px">
        <div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:4px">Phase Earnings</div>
        <div style="font-size:18px;font-weight:700;color:var(--color-text-primary);margin-bottom:8px">₱${phaseEarnings.toLocaleString('en-PH')} / ₱${phaseTarget.toLocaleString('en-PH')}</div>
        <div style="background:var(--color-background-tertiary);border-radius:8px;height:8px;overflow:hidden;margin-bottom:8px">
          <div style="height:100%;background:linear-gradient(90deg, ${phase.color}, ${phase.color}cc);width:${Math.min(100, phaseEarnings / phaseTarget * 100)}%;transition:width 0.6s ease"></div>
        </div>
        <div style="font-size:11px;color:var(--color-text-secondary);display:flex;justify-content:space-between">
          <span>Daily target: ₱${dailyTarget.toLocaleString('en-PH')}</span>
          <span>${Math.min(100, Math.round(phaseEarnings / phaseTarget * 100))}%</span>
        </div>
      </div>
      <button class="btn accent" onclick="sw('analytics',document.querySelectorAll('.nbtn')[6])">View Analytics ↗</button>
    `;
  }

  const undone = tasks.filter(t => !t.done).slice(0, 4);
  const fc = document.getElementById('dash-focus');

  if (undone.length) {
    fc.innerHTML = undone.map(t => `
      <div class="todo-item">
        <input type="checkbox" class="todo-cb" onchange="toggleTask(${t.id})">
        <div class="cat-pip ${t.cat}"></div>
        <span class="todo-txt">${t.text}</span>
      </div>
    `).join('');
  } else {
    fc.innerHTML = '<div style="font-size:13px;color:var(--color-text-secondary)">' +
      (tasks.length ? 'All tasks done. Lock in. 🔥' : 'Add tasks in the Checklist tab.') + '</div>';
  }
}

updateDash();

// Schedule data
const schedDataByWeek = {
  week1: [
  {
    day: 'Monday',
    theme: 'How the web works',
    blocks: [
      {
        time: 'Hr 1–2',
        title: 'Watch: How the internet works',
        desc: 'YouTube: "How the Internet Works" + "What is HTML?" by Traversy Media. Take notes on paper.',
        type: 'learn'
      },
      {
        time: 'Hr 3–4',
        title: 'The Odin Project: HTML foundations',
        desc: 'theodinproject.com → Foundations path → first 3 lessons. Type every example — never copy-paste.',
        type: 'build'
      },
      {
        time: 'Hr 5–6',
        title: 'Build: Your first HTML page',
        desc: 'VS Code → index.html → your name, heading, paragraph, list of goals. Open in browser.',
        type: 'build'
      }
    ]
  },
  {
    day: 'Tuesday',
    theme: 'CSS — make it look good',
    blocks: [
      {
        time: 'Hr 1–2',
        title: 'Watch: CSS crash course',
        desc: 'Traversy Media "CSS Crash Course for Absolute Beginners". Focus: selectors, colors, fonts, box model.',
        type: 'learn'
      },
      {
        time: 'Hr 3–4',
        title: 'Odin Project: CSS foundations',
        desc: 'Continue CSS lessons. Do every exercise file — do not skip assignments.',
        type: 'build'
      },
      {
        time: 'Hr 5–6',
        title: 'Style your Monday page',
        desc: 'Add style.css. Google Font, background color, centered layout. Make it something you\'re proud of.',
        type: 'build'
      }
    ]
  },
  {
    day: 'Wednesday',
    theme: 'JavaScript — make it move',
    blocks: [
      {
        time: 'Hr 1–2',
        title: 'Watch: JavaScript basics',
        desc: 'Traversy Media "JavaScript Crash Course". Learn: variables, functions, if/else, DOM manipulation.',
        type: 'learn'
      },
      {
        time: 'Hr 3–4',
        title: 'freeCodeCamp: JS basics',
        desc: 'freecodecamp.org → JavaScript Algorithms → first 20 exercises. Tiny — go fast.',
        type: 'build'
      },
      {
        time: 'Hr 5–6',
        title: 'Build: Click counter app',
        desc: 'Number + plus button + minus button + reset. Core JS: variables, buttons, DOM updates.',
        type: 'build'
      }
    ]
  },
  {
    day: 'Thursday',
    theme: 'APIs — talk to the internet',
    blocks: [
      {
        time: 'Hr 1–2',
        title: 'Learn: What is an API?',
        desc: 'MuleSoft "What is an API?" video. Then read MDN "Using Fetch". Understand: request, response, JSON, async/await.',
        type: 'learn'
      },
      {
        time: 'Hr 3–4',
        title: 'Practice: Free public API',
        desc: 'Use Dog CEO API (dog.ceo) or PokeAPI. Fetch data and display it. Use console.log to debug.',
        type: 'build'
      },
      {
        time: 'Hr 5–6',
        title: 'Build: Random joke generator',
        desc: 'JokeAPI (jokeapi.dev) + button click fetches a joke. Same pattern you\'ll use for Claude API.',
        type: 'build'
      }
    ]
  },
  {
    day: 'Friday',
    theme: 'First AI-powered app',
    blocks: [
      {
        time: 'Hr 1–2',
        title: 'Learn: Claude API basics',
        desc: 'Read docs.anthropic.com → Getting Started. Get your free API key. Understand: prompt, completion, tokens.',
        type: 'learn'
      },
      {
        time: 'Hr 3–5',
        title: 'Build: Simple chatbot UI',
        desc: 'HTML input + send button + response area. JS: call Claude API on send, display reply. Your first real AI app.',
        type: 'build'
      },
      {
        time: 'Hr 6',
        title: 'Customize your chatbot',
        desc: 'Change the system prompt to "Davao business advisor" or "coding tutor". This is prompt engineering.',
        type: 'explore'
      }
    ]
  },
  {
    day: 'Saturday',
    theme: 'Build + Canva side hustle',
    blocks: [
      {
        time: 'Hr 1–3',
        title: 'Polish or build a new mini-app',
        desc: 'Add feature to chatbot OR build: quote generator, text summarizer, translator. Finish things.',
        type: 'build'
      },
      {
        time: 'Hr 4',
        title: 'Set up GitHub',
        desc: 'Create free GitHub account. Push your projects. Every build goes here — this is your portfolio.',
        type: 'learn'
      },
      {
        time: 'Hr 5–6',
        title: 'Start first Canva template pack',
        desc: 'Pick one niche (Instagram posts, resume, or menu). Design 5 templates. Clean, professional, one palette.',
        type: 'explore'
      }
    ]
  },
  {
    day: 'Sunday',
    theme: 'Review + rest + plan',
    blocks: [
      {
        time: 'Hr 1–2',
        title: 'Review the whole week',
        desc: 'Open each project. Re-read notes. What\'s fuzzy? Write it down — those fuzzy parts = Monday\'s focus.',
        type: 'learn'
      },
      {
        time: 'Hr 3–4',
        title: 'Fix or improve one project',
        desc: 'Take your weakest project and make it 20% better. Finishing things matters more than starting new ones.',
        type: 'build'
      },
      {
        time: 'Hr 5–6',
        title: 'Rest + plan week 2',
        desc: 'Step away from screens for 2 hours. Write 3 things you\'ll build next week. Rest is part of the system.',
        type: 'rest'
      }
    ]
  },
  week2: [
    {
      day: 'Monday',
      theme: 'React fundamentals',
      blocks: [
        { time: 'Hr 1–2', title: 'Watch: React basics', desc: 'Traversy "React Crash Course". Components, JSX, props, state.', type: 'learn' },
        { time: 'Hr 3–4', title: 'Build: Simple React component', desc: 'Create a counter, todo list, or form component. Use create-react-app.', type: 'build' },
        { time: 'Hr 5–6', title: 'Connect to API', desc: 'Fetch data from an API and display it in your React component.', type: 'build' }
      ]
    },
    {
      day: 'Tuesday',
      theme: 'Next.js + deployment',
      blocks: [
        { time: 'Hr 1–2', title: 'Learn: Next.js basics', desc: 'nextjs.org tutorial. File-based routing, API routes, deployment to Vercel.', type: 'learn' },
        { time: 'Hr 3–5', title: 'Build: First Next.js app', desc: 'Simple multi-page app with navigation. Add a contact form with API route handler.', type: 'build' },
        { time: 'Hr 6', title: 'Deploy to Vercel', desc: 'Push to GitHub, deploy to Vercel, share the live link.', type: 'explore' }
      ]
    },
    { day: 'Wednesday', theme: 'Claude API integration', blocks: [
      { time: 'Hr 1–2', title: 'API integration', desc: 'Integrate Claude API into your Next.js app. Build an AI writing tool or chatbot.', type: 'build' },
      { time: 'Hr 3–4', title: 'Prompt engineering', desc: 'Experiment with system prompts. Build a specialized AI tool (resume writer, code explainer).', type: 'build' },
      { time: 'Hr 5–6', title: 'Polish & ship', desc: 'Add error handling, loading states, styling. Deploy to Vercel.', type: 'build' }
    ]},
    { day: 'Thursday', theme: 'Tailwind CSS + styling', blocks: [
      { time: 'Hr 1–2', title: 'Learn: Tailwind CSS', desc: 'Quick tutorial on Tailwind. Utility-first CSS, how it works with React/Next.js.', type: 'learn' },
      { time: 'Hr 3–5', title: 'Restyle all projects', desc: 'Apply Tailwind to Monday, Tuesday, Wednesday projects. Make them look professional.', type: 'build' },
      { time: 'Hr 6', title: 'Build a landing page', desc: 'Create a simple landing page showcasing your 3 AI tools. Mobile-responsive.', type: 'build' }
    ]},
    { day: 'Friday', theme: 'Portfolio setup', blocks: [
      { time: 'Hr 1–2', title: 'GitHub portfolio', desc: 'Create GitHub README. Add all 4 projects (HTML/CSS/JS chatbot, 3 AI Next.js apps). Clear descriptions.', type: 'explore' },
      { time: 'Hr 3–4', title: 'Personal portfolio site', desc: 'Build portfolio.yourdomain.com in Next.js. About, projects, contact form.', type: 'build' },
      { time: 'Hr 5–6', title: 'Polish & deploy', desc: 'Fix bugs, test on mobile, deploy to Vercel. Take screenshots for social media.', type: 'build' }
    ]},
    { day: 'Saturday', theme: 'Canva templates + planning', blocks: [
      { time: 'Hr 1–3', title: 'Finish 5 Canva templates', desc: 'Complete first template pack (Instagram, resume, menu, or thumbnail). List on Whop/Gumroad.', type: 'explore' },
      { time: 'Hr 4', title: 'Record time-lapse video', desc: 'Record yourself designing 1 template. Post 30-second clip on TikTok with "free template" offer in bio.', type: 'explore' },
      { time: 'Hr 5–6', title: 'Plan week 3', desc: 'Review what worked. Set weekly goals for Week 3. Rest + recharge.', type: 'rest' }
    ]},
    { day: 'Sunday', theme: 'Review + rest', blocks: [
      { time: 'Hr 1–2', title: 'Code review week 2', desc: 'Walk through all 4 projects. Identify bugs, optimization opportunities.', type: 'learn' },
      { time: 'Hr 3–4', title: 'Improve one project', desc: 'Pick the weakest one. Refactor code, improve UX, add one new feature.', type: 'build' },
      { time: 'Hr 5–6', title: 'Rest + social media', desc: 'Post progress on LinkedIn/Twitter. 1 project update + 1 lesson learned. Then rest.', type: 'rest' }
    ]}
  ],
  week3: [
    { day: 'Monday', theme: 'Upwork profile setup', blocks: [
      { time: 'Hr 1–2', title: 'Create Upwork profile', desc: 'Professional photo, bio highlighting AI web dev skills, portfolio link to your projects.', type: 'explore' },
      { time: 'Hr 3–4', title: 'Craft service offerings', desc: 'Create 3 gigs: "AI Chatbot for businesses", "Custom AI tool development", "Next.js AI app".', type: 'explore' },
      { time: 'Hr 5–6', title: 'Cold pitch 10 people', desc: 'Find business owners on Facebook groups, LinkedIn. Send personalized pitch: "I build AI websites".', type: 'explore' }
    ]},
    { day: 'Tuesday', theme: 'Fiverr gigs launch', blocks: [
      { time: 'Hr 1–2', title: 'Create Fiverr profile', desc: 'Similar setup: portfolio, bio, profile pic. Link all AI projects.', type: 'explore' },
      { time: 'Hr 3–4', title: 'Create 3 service gigs', desc: 'Gigs: "Build AI chatbot", "AI content generator", "Prompt engineering service".', type: 'explore' },
      { time: 'Hr 5–6', title: 'Create sales video', desc: '60-second video showing off your AI tools. Post on Fiverr profile. Be energetic!', type: 'explore' }
    ]},
    { day: 'Wednesday', theme: 'Cold outreach day', blocks: [
      { time: 'Hr 1–4', title: 'Reach out to 20 people', desc: 'Find local businesses in Davao (restaurants, clinics, salons on Facebook). Message offer for free AI chatbot demo.', type: 'explore' },
      { time: 'Hr 5–6', title: 'Collect leads', desc: 'Keep a spreadsheet of interested prospects. Follow up daily.', type: 'explore' }
    ]},
    { day: 'Thursday', theme: 'Build custom chatbot', blocks: [
      { time: 'Hr 1–3', title: 'Build chatbot for prospect', desc: 'Take first serious lead. Build tailored chatbot for their business. 3 hours of focused development.', type: 'build' },
      { time: 'Hr 4–6', title: 'Demo + negotiate', desc: 'Show them the chatbot, teach them how to use it, discuss pricing: ₱8K–₱15K setup fee.', type: 'explore' }
    ]},
    { day: 'Friday', theme: 'Scale outreach', blocks: [
      { time: 'Hr 1–2', title: 'Follow up with leads', desc: 'Message all 20 people again. "Did you see my offer? Free demo available."', type: 'explore' },
      { time: 'Hr 3–4', title: 'Refine pitch', desc: 'Update your messaging based on responses. What objections come up? Solve them.', type: 'explore' },
      { time: 'Hr 5–6', title: 'Next chatbot project', desc: 'Start building another custom chatbot for 2nd prospect or high-intent lead.', type: 'build' }
    ]},
    { day: 'Saturday', theme: 'Template business growth', blocks: [
      { time: 'Hr 1–3', title: 'Create second template pack', desc: 'New niche (business proposals, Facebook ad templates, YouTube thumbnails). Design 8 templates.', type: 'build' },
      { time: 'Hr 4', title: 'Create TikTok content', desc: 'Film 3x 30-second template reveal videos. Post with "link in bio" CTAs.', type: 'explore' },
      { time: 'Hr 5–6', title: 'Analyze metrics', desc: 'Check Upwork/Fiverr messages, Whop sales, TikTok views. Plan next week based on what\\'s working.', type: 'explore' }
    ]},
    { day: 'Sunday', theme: 'Weekly standup + rest', blocks: [
      { time: 'Hr 1–2', title: 'Review week 3', desc: 'Count leads, conversations, deals in progress. Did any close?', type: 'learn' },
      { time: 'Hr 3–4', title: 'Optimize best channel', desc: 'Whatever channel got most traction (Upwork, cold DM, Fiverr), refine it.', type: 'explore' },
      { time: 'Hr 5–6', title: 'Rest + plan week 4', desc: 'Step away from screens. Write down this week\\'s wins. Plan week 4 targets.', type: 'rest' }
    ]}
  ],
  week4: [
    { day: 'Monday', theme: 'Sales optimization', blocks: [
      { time: 'Hr 1–2', title: 'Analyze responses', desc: 'Review all conversations. What\\'s working? What\\'s not? Double down on what works.', type: 'explore' },
      { time: 'Hr 3–4', title: 'Improve sales funnel', desc: 'Update pitches, Fiverr gigs, Upwork profile based on feedback. A/B test different approaches.', type: 'explore' },
      { time: 'Hr 5–6', title: 'Reach out to 25 more people', desc: 'Expand outreach. Find more local businesses, use better search terms on LinkedIn.', type: 'explore' }
    ]},
    { day: 'Tuesday', theme: 'Custom projects day', blocks: [
      { time: 'Hr 1–4', title: 'Build chatbots', desc: 'Work on 2–3 custom chatbot projects. Focus on delivery and quality.', type: 'build' },
      { time: 'Hr 5–6', title: 'Document process', desc: 'Write quick guides for clients on how to use their chatbots. Professional follow-up.', type: 'explore' }
    ]},
    { day: 'Wednesday', theme: 'Collect first payment', blocks: [
      { time: 'Hr 1–2', title: 'Close first deal', desc: 'Finalize first chatbot project with a customer. Ask for payment via GCash, PayMaya, or bank transfer.', type: 'explore' },
      { time: 'Hr 3–6', title: 'Celebration + momentum', desc: 'First money earned! Document it, post about it. Momentum is real. Keep going!', type: 'explore' }
    ]},
    { day: 'Thursday', theme: 'Repeat sales', blocks: [
      { time: 'Hr 1–6', title: 'Follow-up frenzy', desc: 'Message ALL warm leads again. "I just finished a project like this. Want a demo?"', type: 'explore' }
    ]},
    { day: 'Friday', theme: 'Build + sell', blocks: [
      { time: 'Hr 1–3', title: 'Develop 2nd custom project', desc: 'Build another chatbot or AI tool for high-intent client.', type: 'build' },
      { time: 'Hr 4–6', title: 'Demo + close', desc: 'Show completed work, negotiate, close deal #2.', type: 'explore' }
    ]},
    { day: 'Saturday', theme: 'Month 1 wrap-up', blocks: [
      { time: 'Hr 1–2', title: 'Count earnings', desc: 'Total up all money earned in Phase 1. Target was ₱10K. Where are you?', type: 'explore' },
      { time: 'Hr 3–4', title: 'Create case study', desc: 'Document 1 successful project. Client name (with permission), before/after, metrics. Post on LinkedIn.', type: 'explore' },
      { time: 'Hr 5–6', title: 'Plan Phase 2', desc: 'Rest and celebrate Month 1. You\\'ve shipped real projects and made real money. That\\'s huge.', type: 'rest' }
    ]},
    { day: 'Sunday', theme: 'Rest day', blocks: [
      { time: 'Hr 1–3', title: 'Reflect on Phase 1', desc: 'What worked? What didn\\'t? Which skills improved the most? Which hurt?', type: 'learn' },
      { time: 'Hr 4–6', title: 'Plan Phase 2', desc: 'Phase 2 goal: ₱100K (3 weeks at ~₱30K/week). How will you scale? More clients? Higher prices? New products?', type: 'learn' }
    ]}
  ]
};

// Keep schedData as alias to week1 for backward compatibility
const schedData = schedDataByWeek.week1;

function getCurrentScheduleWeek() {
  const phase = getCurrentPhase();
  if (phase.id === 1) {
    const days = Math.floor((new Date() - phase.start) / 86400000);
    if (days <= 7) return schedDataByWeek.week1;
    if (days <= 14) return schedDataByWeek.week2;
    if (days <= 21) return schedDataByWeek.week3;
    return schedDataByWeek.week4;
  }
  // For phases 2-4, show a simplified monthly schedule
  return schedData;
}

// Build schedule
function buildSchedule() {
  const el = document.getElementById('sched-list');
  
  el.innerHTML = schedData.map((d, i) => `
    <div class="day-sched">
      <div class="day-head" onclick="toggleDay(${i})">
        <span class="day-label">${d.day}</span>
        <span class="day-theme-badge">${d.theme}</span>
        <span class="day-chev" id="chev-${i}">▼</span>
      </div>
      <div class="day-body ${i === 0 ? 'open' : ''}" id="day-body-${i}">
        ${d.blocks.map(b => `
          <div class="block-row">
            <div class="block-accent-bar ba-${b.type}"></div>
            <div class="block-content">
              <div class="block-time">${b.time}</div>
              <div class="block-title">${b.title}</div>
              <div class="block-desc">${b.desc}</div>
              <span class="block-type bt-${b.type}">${b.type}</span>
            </div>
          </div>
        `).join('')}
        <button class="day-win-btn" onclick="logDayWin('${d.day}')">Log ${d.day} as done ↗</button>
      </div>
    </div>
  `).join('');
  
  document.getElementById('chev-0').style.transform = 'rotate(180deg)';
}

function toggleDay(i) {
  const body = document.getElementById('day-body-' + i);
  const chev = document.getElementById('chev-' + i);
  const open = body.classList.contains('open');
  
  body.classList.toggle('open', !open);
  chev.style.transform = open ? '' : 'rotate(180deg)';
}

function logDayWin(day) {
  wins.unshift({
    id: Date.now(),
    text: 'Completed ' + day + ' of week 1 schedule',
    money: 0,
    date: new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  });
  
  renderWins();
  updateMoneyDisplay();
  updateDash();
  Storage.save();
  playSound();
  alert('Week 1 ' + day + ' logged as a win! Keep going.');
}

buildSchedule();

// Analytics
function updateAnalytics() {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const weekTasks = tasks.filter(t => new Date(Math.floor(t.id / 1000)) >= weekStart).length;
  const weekHabits = habits.reduce((sum, h) => sum + h.week.filter(Boolean).length, 0);
  const weekEarnings = wins.filter(w => new Date(Math.floor(w.id / 1000)) >= weekStart).reduce((s, w) => s + w.money, 0);

  document.getElementById('weekly-tasks').textContent = weekTasks;
  document.getElementById('weekly-habits').textContent = weekHabits;
  document.getElementById('weekly-earnings').textContent = weekEarnings.toLocaleString('en-PH');

  let currentStreak = 0;
  for (let i = 0; i < 7; i++) {
    const idx = (today - i + 7) % 7;
    if (habits.some(h => h.week[idx])) {
      currentStreak++;
    } else {
      break;
    }
  }
  document.getElementById('daily-streak').textContent = currentStreak + 'd';

  // Update insights
  document.getElementById('earnings-velocity').textContent = getEarningsVelocity().toLocaleString('en-PH');
  document.getElementById('best-category').textContent = getBestCategory();
  document.getElementById('projection').textContent = getProjection().toLocaleString('en-PH');

  // Render earnings chart
  const earningsData = getLast30DaysEarnings();
  const earningsCtx = document.getElementById('earnings-chart');
  if (earningsCtx) {
    if (earningsChart) earningsChart.destroy();
    earningsChart = new Chart(earningsCtx, {
      type: 'line',
      data: {
        labels: Object.keys(earningsData),
        datasets: [{
          label: 'Daily Earnings (₱)',
          data: Object.values(earningsData),
          fill: true,
          borderColor: 'var(--acc)',
          backgroundColor: 'rgba(199, 125, 255, 0.1)',
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: 'var(--acc)',
          pointBorderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: 'var(--color-text-secondary)' },
            grid: { color: 'rgba(199, 125, 255, 0.1)' }
          },
          x: {
            ticks: { color: 'var(--color-text-secondary)' },
            grid: { display: false }
          }
        }
      }
    });
  }

  // Render task completion chart
  const taskData = getWeeklyTaskCompletion();
  const taskCtx = document.getElementById('task-completion-chart');
  if (taskCtx) {
    if (taskCompletionChart) taskCompletionChart.destroy();
    taskCompletionChart = new Chart(taskCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(taskData),
        datasets: [{
          label: 'Tasks Completed',
          data: Object.values(taskData).map(d => d.completed),
          backgroundColor: 'rgba(109, 213, 195, 0.6)',
          borderColor: '#6dd5c3',
          borderWidth: 1
        },
        {
          label: 'Tasks Total',
          data: Object.values(taskData).map(d => d.total),
          backgroundColor: 'rgba(199, 125, 255, 0.2)',
          borderColor: 'var(--acc)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { labels: { color: 'var(--color-text-secondary)' } }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: 'var(--color-text-secondary)' },
            grid: { color: 'rgba(199, 125, 255, 0.1)' }
          },
          x: {
            ticks: { color: 'var(--color-text-secondary)' },
            grid: { display: false }
          }
        }
      }
    });
  }
}

// Export Data
function exportData() {
  const data = {
    tasks,
    habits,
    wins,
    exportDate: new Date().toISOString(),
    totalEarnings: wins.reduce((s, w) => s + w.money, 0)
  };
  
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '500k-before-19-data-' + new Date().toISOString().split('T')[0] + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  playSound();
}

// Reset Data
function resetData() {
  if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
    Storage.clear();
    tasks = [];
    habits = [];
    wins = [];
    renderTasks();
    renderHabits();
    renderWins();
    updateDash();
    updateMoneyDisplay();
    alert('All data has been reset.');
  }
}

// Manual Sync
async function manualSync() {
  if (!supabaseReady) {
    alert('Cloud sync not configured. Using local storage only.');
    return;
  }
  
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Syncing...';
  
  try {
    await Storage.save();
    updateSyncStatus();
    btn.textContent = 'Synced! ✓';
    setTimeout(() => {
      btn.textContent = 'Sync Now';
      btn.disabled = false;
    }, 2000);
  } catch (err) {
    console.error('Sync error:', err);
    btn.textContent = 'Sync failed';
    btn.disabled = false;
  }
}

// Update Sync Status UI
function updateSyncStatus() {
  const lastSync = localStorage.getItem('last-sync');
  const syncElement = document.getElementById('last-sync-time');
  
  if (lastSync) {
    const syncDate = new Date(lastSync);
    const now = new Date();
    const diffMs = now - syncDate;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
      syncElement.textContent = 'just now';
    } else if (diffMins < 60) {
      syncElement.textContent = diffMins + 'm ago';
    } else if (diffMins < 1440) {
      const diffHours = Math.floor(diffMins / 60);
      syncElement.textContent = diffHours + 'h ago';
    } else {
      syncElement.textContent = syncDate.toLocaleDateString();
    }
  } else {
    syncElement.textContent = 'pending...';
  }
  
  const statusDot = document.getElementById('sync-status-dot');
  if (statusDot && supabaseReady) {
    statusDot.style.background = '#6dd5c3';
    statusDot.style.boxShadow = '0 0 8px rgba(109, 213, 195, 0.5)';
  }
}

// AI Hustle research with multi-turn conversations
async function askHustle(preset) {
  const q = preset || document.getElementById('ai-q').value.trim();

  if (!q) return;

  if (!preset) document.getElementById('ai-q').value = '';

  const pane = document.getElementById('ai-pane');
  const out = document.getElementById('ai-out');

  pane.style.display = 'block';
  out.className = 'ai-loading';
  out.textContent = 'Researching...';

  // Add user message to conversation history
  hustleConversation.push({ role: 'user', content: q });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: 'You are a sharp hustle advisor for an 18-year-old in Davao, Philippines who wants to make ₱500,000 before turning 19 (Oct 15 2026). He is learning web dev and AI (HTML/CSS/JS/React/Next.js/Claude API). Give specific, actionable, no-fluff advice. Focus on what works in the Philippines in 2025-2026. Plain text only, no markdown or symbols.',
        messages: hustleConversation
      })
    });

    const data = await res.json();
    const response = data.content && data.content[0] ? data.content[0].text : 'No response — try again.';

    // Add assistant response to conversation history
    hustleConversation.push({ role: 'assistant', content: response });

    out.className = 'ai-txt';
    out.innerHTML = `<div style="margin-bottom:16px"><strong>You:</strong><br>${q}</div><div><strong>AI Advisor:</strong><br>${response}</div>`;

    // Add save snippet button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn accent';
    saveBtn.style.marginTop = '12px';
    saveBtn.textContent = '💾 Save this advice';
    saveBtn.onclick = () => {
      savedSnippets.push({
        id: Date.now(),
        content: response,
        topic: q.split(' ').slice(0, 3).join(' '),
        savedAt: new Date().toLocaleDateString('en-PH')
      });
      Storage.save();
      saveBtn.textContent = '✓ Saved!';
      saveBtn.disabled = true;
      setTimeout(() => {
        saveBtn.textContent = '💾 Save this advice';
        saveBtn.disabled = false;
      }, 2000);
    };
    out.appendChild(saveBtn);

    Storage.save();
  } catch (e) {
    out.className = 'ai-txt';
    out.textContent = 'Could not reach AI. Check connection and try again.';
  }
}

// Milestone celebrations
const milestones = [50000, 100000, 250000, 500000];
let achievedMilestones = [];

function checkMilestones() {
  const total = wins.reduce((s, w) => s + w.money, 0);
  milestones.forEach(m => {
    if (total >= m && !achievedMilestones.includes(m)) {
      achievedMilestones.push(m);
      celebrateMilestone(m);
    }
  });
}

function celebrateMilestone(amount) {
  const msg = `🎉 Congratulations! You hit ₱${amount.toLocaleString('en-PH')}!`;
  console.log(msg);

  // Confetti animation
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      confetti({ particleCount: 100, spread: 70 });
    }, i * 200);
  }

  // Play celebration sound
  playSound();

  // Browser notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Milestone Achieved!', {
      body: msg,
      icon: '🎉'
    });
  }
}

// Notification system
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotification(title, options = {}) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, options);
  }
}

// Schedule daily notifications
function scheduleNotifications() {
  // Check every hour if it's 8am
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 8 && now.getMinutes() === 0) {
      sendNotification('Time for your standup?', {
        body: 'What\'s your main goal today?',
        tag: 'standup'
      });
    }
  }, 60000);
}

// Initialize
(async function() {
  await initSupabase();
  Theme.init();
  await Storage.load();
  updateMoneyDisplay();
  updateDash();
  renderTasks();
  renderHabits();
  renderWins();
  updateThemeButton();
  updateSyncStatus();

  // Check achieved milestones on load
  checkMilestones();

  if (document.getElementById('notify-toggle')) {
    document.getElementById('notify-toggle').checked = soundEnabled;
  }

  // Request notification permission
  requestNotificationPermission();

  // Show sync status
  if (supabaseReady) {
    console.log('✓ Running with cloud backup enabled');
  } else {
    console.log('📱 Running offline mode - local storage only');
  }

  // Auto-sync every 5 minutes
  setInterval(() => {
    if (supabaseReady) {
      Storage.save().catch(err => console.warn('Auto-sync failed:', err.message));
    }
  }, 5 * 60 * 1000);

  // Update sync status UI every 30 seconds
  setInterval(updateSyncStatus, 30000);

  // Schedule notifications
  scheduleNotifications();

  // Update analytics when tab changes
  const analyticsBtn = document.querySelectorAll('.nbtn')[6];
  if (analyticsBtn) {
    analyticsBtn.addEventListener('click', () => setTimeout(updateAnalytics, 100));
  }
})();
