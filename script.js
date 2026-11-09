'use strict';

/* ==========================================================================
   Game Portal – Logik
   ==========================================================================

   NEUES SPIEL HINZUFÜGEN
   ----------------------
   1. Lege die Spiel-Datei in den Ordner "games/" (z. B. games/snake.html).
   2. Ergänze unten im Array GAMES genau einen Eintrag nach diesem Muster:

      {
        id: 'mein-spiel',                 // eindeutig, nur Kleinbuchstaben/Zahlen/Bindestrich
        title: 'Mein Spiel',              // Anzeigename
        description: 'Kurze Beschreibung in ein bis zwei Sätzen.',
        category: 'Action',               // Action | Puzzle | Arcade | Strategie | Sonstige
        color: '#6d4aff',                 // Cover-Farbe (Hex), ergibt den Farbverlauf
        src: 'games/mein-spiel.html'      // Pfad zur Spiel-Datei
      },

   Karten, Filter, Suche, Favoriten und "Zuletzt gespielt" entstehen
   automatisch aus diesem Array. Ein leeres Array zeigt den Leerzustand.
   ========================================================================== */

const GAMES = [
  // Platzhalter – ersetzen oder löschen, sobald echte Spiele vorhanden sind.
  {
    id: 'spiel-1',
    title: 'Spiel 1',
    description: 'Beschreibung folgt.',
    category: 'Sonstige',
    color: '#14b8a6',
    src: 'games/spiel-1.html'
  },
  {
    id: 'spiel-2',
    title: 'Spiel 2',
    description: 'Beschreibung folgt.',
    category: 'Sonstige',
    color: '#6d4aff',
    src: 'games/spiel-2.html'
  },
  {
    id: 'spiel-3',
    title: 'Spiel 3',
    description: 'Beschreibung folgt.',
    category: 'Sonstige',
    color: '#f97316',
    src: 'games/spiel-3.html'
  }
];

/* ---------- Konstanten ---------------------------------------------------- */

const CATEGORIES = ['Alle', 'Action', 'Puzzle', 'Arcade', 'Strategie', 'Sonstige'];
const MAX_RECENT = 6;
const PATTERNS = ['dots', 'lines', 'rings'];

const KEYS = {
  theme: 'spielwiese:theme',
  favorites: 'spielwiese:favorites',
  recent: 'spielwiese:recent',
  name: 'spielwiese:name'
};

const HEART_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
  '<path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.3 2.7 4.5 6.4 4.5c2.1 0 3.8 1.1 5.6 3.2 1.8-2.1 3.5-3.2 5.6-3.2 3.7 0 5.6 3.8 4 7.3C19.5 16.4 12 21 12 21z"/>' +
  '</svg>';

/* ---------- Sicherer localStorage-Zugriff -------------------------------- */

const storage = {
  get(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* Speicher nicht verfügbar – Portal funktioniert trotzdem weiter. */
    }
  }
};

function loadName() {
  const value = storage.get(KEYS.name, '');
  return typeof value === 'string' ? value.trim().slice(0, 24) : '';
}

function loadIdList(key) {
  const value = storage.get(key, []);
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
}

/* ---------- Zustand & DOM-Referenzen ------------------------------------- */

const state = {
  query: '',
  category: 'Alle',
  favorites: loadIdList(KEYS.favorites),
  recent: loadIdList(KEYS.recent),
  name: loadName()
};

const $ = (selector) => document.querySelector(selector);

const dom = {
  root: document.documentElement,
  main: $('#main'),
  search: $('#search-input'),
  themeToggle: $('#theme-toggle'),
  logoutBtn: $('#logout-btn'),
  logoutDialog: $('#logout-dialog'),
  logoutCancel: $('#logout-cancel'),
  logoutConfirm: $('#logout-confirm'),
  randomBtn: $('#random-btn'),
  filters: $('#filters'),
  chips: $('#chips'),
  status: $('#status'),
  emptyState: $('#empty-state'),
  favSection: $('#favorites-section'),
  favGrid: $('#favorites-grid'),
  recentSection: $('#recent-section'),
  recentGrid: $('#recent-grid'),
  allSection: $('#all-section'),
  allGrid: $('#all-grid'),
  count: $('#count'),
  noResults: $('#no-results'),
  overlay: $('#overlay'),
  overlayTitle: $('#overlay-title'),
  frame: $('#game-frame'),
  backBtn: $('#back-btn'),
  heroTitle: $('#hero-title'),
  welcome: $('#welcome'),
  welcomeForm: $('#welcome-form'),
  welcomeInput: $('#welcome-name'),
  welcomeError: $('#welcome-error')
};

/* ---------- Hilfsfunktionen ---------------------------------------------- */

const gameById = (id) => GAMES.find((g) => g.id === id);

function categoryOf(game) {
  return CATEGORIES.includes(game.category) && game.category !== 'Alle' ? game.category : 'Sonstige';
}

function normalize(text) {
  return String(text)
    .toLocaleLowerCase('de')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function matchesFilter(game) {
  if (state.category !== 'Alle' && categoryOf(game) !== state.category) return false;
  const q = normalize(state.query.trim());
  if (!q) return true;
  const haystack = normalize(`${game.title} ${game.description} ${categoryOf(game)}`);
  return haystack.includes(q);
}

function countLabel(n) {
  return `${n} ${n === 1 ? 'Spiel' : 'Spiele'}`;
}

function announce(message) {
  dom.status.textContent = '';
  // Kurze Verzögerung, damit Screenreader die Änderung zuverlässig melden.
  window.setTimeout(() => { dom.status.textContent = message; }, 50);
}

function isTyping(target) {
  return target instanceof Element && target.matches('input, textarea, select, [contenteditable]');
}

/* ---------- Karten rendern ------------------------------------------------ */

// Wählt pro Spiel dauerhaft eines von drei Cover-Mustern (aus der id abgeleitet).
function patternOf(id) {
  let sum = 0;
  for (const ch of String(id)) sum += ch.codePointAt(0);
  return PATTERNS[sum % PATTERNS.length];
}

function initialsOf(title) {
  return String(title)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join('')
    .toUpperCase();
}

function createCard(game) {
  const isFav = state.favorites.includes(game.id);
  const category = categoryOf(game);

  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.pattern = patternOf(game.id);
  if (game.color) card.style.setProperty('--card-color', game.color);

  const cover = document.createElement('div');
  cover.className = 'card__cover';
  cover.setAttribute('aria-hidden', 'true');
  const initials = document.createElement('span');
  initials.className = 'card__initials';
  initials.textContent = initialsOf(game.title);
  cover.appendChild(initials);

  const fav = document.createElement('button');
  fav.type = 'button';
  fav.className = 'card__fav';
  fav.dataset.action = 'fav';
  fav.dataset.id = game.id;
  fav.setAttribute('aria-pressed', String(isFav));
  fav.setAttribute(
    'aria-label',
    isFav
      ? `${game.title} aus Favoriten entfernen`
      : `${game.title} zu Favoriten hinzufügen`
  );
  fav.innerHTML = HEART_SVG; // statisches, eigenes Markup

  const body = document.createElement('div');
  body.className = 'card__body';

  const title = document.createElement('h3');
  title.className = 'card__title';
  title.textContent = game.title;

  const desc = document.createElement('p');
  desc.className = 'card__desc';
  desc.textContent = game.description;

  const foot = document.createElement('div');
  foot.className = 'card__foot';

  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.dataset.category = category;
  tag.textContent = category;

  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'btn btn--primary';
  play.dataset.action = 'play';
  play.dataset.id = game.id;
  play.setAttribute('aria-label', `${game.title} spielen`);
  play.textContent = 'Spielen';

  foot.append(tag, play);
  body.append(title, desc, foot);
  cover.appendChild(fav);
  card.append(cover, body);
  return card;
}

function fillGrid(grid, games) {
  const fragment = document.createDocumentFragment();
  games.forEach((game) => fragment.appendChild(createCard(game)));
  grid.replaceChildren(fragment);
}

function render() {
  const hasGames = GAMES.length > 0;

  dom.emptyState.hidden = hasGames;
  dom.filters.hidden = !hasGames;
  dom.allSection.hidden = !hasGames;
  dom.randomBtn.disabled = !hasGames;

  if (!hasGames) {
    dom.favSection.hidden = true;
    dom.recentSection.hidden = true;
    return;
  }

  const filtered = GAMES.filter(matchesFilter);
  const favs = state.favorites.map(gameById).filter(Boolean).filter(matchesFilter);
  const recent = state.recent.map(gameById).filter(Boolean).filter(matchesFilter);

  dom.favSection.hidden = favs.length === 0;
  fillGrid(dom.favGrid, favs);

  dom.recentSection.hidden = recent.length === 0;
  fillGrid(dom.recentGrid, recent);

  fillGrid(dom.allGrid, filtered);
  dom.count.textContent = countLabel(filtered.length);
  dom.noResults.hidden = filtered.length > 0;

  updateChips();
}

/* ---------- Suche: zu den Ergebnissen scrollen --------------------------- */

function scrollToResults() {
  const target = dom.favSection.hidden ? dom.allSection : dom.favSection;
  const top = target.getBoundingClientRect().top;
  // Nur scrollen, wenn die Ergebnisse noch nicht im oberen Bildschirmbereich liegen.
  if (top > 140 || top < 0) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- Kategorie-Chips ---------------------------------------------- */

function buildChips() {
  const fragment = document.createDocumentFragment();
  CATEGORIES.forEach((name) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.category = name;
    chip.textContent = name;
    chip.setAttribute('aria-pressed', String(name === state.category));
    fragment.appendChild(chip);
  });
  dom.chips.replaceChildren(fragment);
}

function updateChips() {
  dom.chips.querySelectorAll('.chip').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.category === state.category));
  });
}

function resetFilters() {
  state.query = '';
  state.category = 'Alle';
  dom.search.value = '';
  render();
  announce(`Filter zurückgesetzt. ${countLabel(GAMES.length)} angezeigt.`);
  dom.search.focus();
}

/* ---------- Favoriten & Verlauf ------------------------------------------ */

function focusControl(action, id, section) {
  const safeId = window.CSS && CSS.escape ? CSS.escape(id) : id;
  const inSection = section
    ? document.querySelector(`[data-section="${section}"] [data-action="${action}"][data-id="${safeId}"]`)
    : null;
  const target = inSection || document.querySelector(`[data-action="${action}"][data-id="${safeId}"]`);
  if (target) target.focus();
}

function toggleFavorite(id, section) {
  const game = gameById(id);
  if (!game) return;

  const index = state.favorites.indexOf(id);
  const added = index === -1;
  if (added) {
    state.favorites.unshift(id);
  } else {
    state.favorites.splice(index, 1);
  }
  storage.set(KEYS.favorites, state.favorites);

  render();
  focusControl('fav', id, section);
  announce(added ? `${game.title} zu Favoriten hinzugefügt.` : `${game.title} aus Favoriten entfernt.`);
}

function touchRecent(id) {
  state.recent = [id, ...state.recent.filter((x) => x !== id)].slice(0, MAX_RECENT);
  storage.set(KEYS.recent, state.recent);
}

/* ---------- Spiel-Overlay ------------------------------------------------- */

let lastOpened = { id: null, section: null };

function setPageInert(isInert) {
  document.querySelectorAll('.site-header, main, .site-footer').forEach((el) => {
    el.inert = isInert;
  });
}

function openGame(id, section) {
  const game = gameById(id);
  if (!game) return;

  lastOpened = { id, section: section || null };
  touchRecent(id);

  dom.overlayTitle.textContent = game.title;
  dom.frame.title = game.title;
  dom.frame.src = game.src;
  dom.overlay.hidden = false;
  document.body.classList.add('is-locked');
  setPageInert(true);
  dom.backBtn.focus();
}

function closeGame() {
  if (dom.overlay.hidden) return;

  dom.overlay.hidden = true;
  dom.frame.src = 'about:blank';
  document.body.classList.remove('is-locked');
  setPageInert(false);

  render();
  if (lastOpened.id) focusControl('play', lastOpened.id, lastOpened.section);
}

function openRandomGame() {
  if (GAMES.length === 0) return;
  const game = GAMES[Math.floor(Math.random() * GAMES.length)];
  openGame(game.id, null);
}

/* ---------- Begrüßung & Namensabfrage ------------------------------------ */

function renderGreeting() {
  dom.heroTitle.textContent = state.name
    ? `Hallo, ${state.name}! Worauf hast du heute Lust?`
    : 'Hallo! Worauf hast du heute Lust?';
}

function showWelcome() {
  dom.welcome.hidden = false;
  setPageInert(true);
  dom.welcomeInput.focus();
}

function submitName(e) {
  e.preventDefault();
  const name = dom.welcomeInput.value.trim().replace(/\s+/g, ' ');

  if (!name) {
    dom.welcomeError.hidden = false;
    dom.welcomeInput.focus();
    return;
  }

  state.name = name;
  storage.set(KEYS.name, name);
  dom.welcome.hidden = true;
  setPageInert(false);
  renderGreeting();
}

/* ---------- Abmelden (alles zurücksetzen) --------------------------------- */

function openLogoutDialog() {
  dom.logoutDialog.hidden = false;
  setPageInert(true);
  dom.logoutCancel.focus();
}

function closeLogoutDialog() {
  if (dom.logoutDialog.hidden) return;
  dom.logoutDialog.hidden = true;
  setPageInert(false);
  dom.logoutBtn.focus();
}

function logout() {
  dom.logoutDialog.hidden = true;
  setPageInert(false);

  try {
    Object.values(KEYS).forEach((key) => window.localStorage.removeItem(key));
  } catch (err) {
    /* Speicher nicht verfügbar – Zustand wird trotzdem zurückgesetzt. */
  }

  state.query = '';
  state.category = 'Alle';
  state.favorites = [];
  state.recent = [];
  state.name = '';

  dom.search.value = '';
  dom.welcomeInput.value = '';
  dom.welcomeError.hidden = true;
  delete dom.root.dataset.theme;
  updateThemeToggle();

  render();
  renderGreeting();
  window.scrollTo(0, 0);
  showWelcome();
}

/* ---------- Hell-/Dunkelmodus -------------------------------------------- */

function currentTheme() {
  const explicit = dom.root.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function updateThemeToggle() {
  const isDark = currentTheme() === 'dark';
  dom.themeToggle.setAttribute('aria-pressed', String(isDark));
}

function applyTheme(theme, persist) {
  dom.root.dataset.theme = theme;
  updateThemeToggle();
  if (persist) storage.set(KEYS.theme, theme);
}

function initTheme() {
  const stored = storage.get(KEYS.theme, null);
  if (stored === 'light' || stored === 'dark') {
    applyTheme(stored, false);
  } else {
    updateThemeToggle();
  }

  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (!dom.root.dataset.theme) updateThemeToggle(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
  }
}

/* ---------- Events -------------------------------------------------------- */

function bindEvents() {
  // Suche (live)
  dom.search.addEventListener('input', () => {
    state.query = dom.search.value;
    render();
    announce(`${countLabel(GAMES.filter(matchesFilter).length)} gefunden.`);
    if (state.query.trim()) scrollToResults();
  });

  dom.search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      scrollToResults();
    }
  });

  dom.search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.search.value) {
      e.preventDefault();
      dom.search.value = '';
      state.query = '';
      render();
    }
  });

  // Kategorie-Chips
  dom.chips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.category = chip.dataset.category;
    render();
    announce(`Kategorie ${state.category}: ${countLabel(GAMES.filter(matchesFilter).length)}.`);
  });

  // Karten-Aktionen (Event-Delegation)
  dom.main.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || !dom.main.contains(btn)) return;

    const { action, id } = btn.dataset;
    const sectionEl = btn.closest('[data-section]');
    const section = sectionEl ? sectionEl.dataset.section : null;

    if (action === 'play') openGame(id, section);
    else if (action === 'fav') toggleFavorite(id, section);
    else if (action === 'reset') resetFilters();
  });

  dom.randomBtn.addEventListener('click', openRandomGame);
  dom.backBtn.addEventListener('click', closeGame);

  dom.themeToggle.addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
  });

  dom.logoutBtn.addEventListener('click', openLogoutDialog);
  dom.logoutCancel.addEventListener('click', closeLogoutDialog);
  dom.logoutConfirm.addEventListener('click', logout);
  dom.logoutDialog.addEventListener('click', (e) => {
    if (e.target === dom.logoutDialog) closeLogoutDialog();
  });

  // Namensabfrage
  dom.welcomeForm.addEventListener('submit', submitName);
  dom.welcomeInput.addEventListener('input', () => { dom.welcomeError.hidden = true; });

  // Tastatur: Esc schließt das Overlay, "/" fokussiert die Suche
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dom.logoutDialog.hidden) {
      e.preventDefault();
      closeLogoutDialog();
      return;
    }
    if (e.key === 'Escape' && !dom.overlay.hidden) {
      e.preventDefault();
      closeGame();
      return;
    }
    if (e.key === '/' && dom.overlay.hidden && !isTyping(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      dom.search.focus();
    }
  });
}

/* ---------- Start --------------------------------------------------------- */

function init() {
  initTheme();
  buildChips();
  bindEvents();
  render();
  renderGreeting();
  if (!state.name) showWelcome();
}

init();