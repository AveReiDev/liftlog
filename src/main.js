/**
 * Wiring. The only file that reads the clock.
 */

import { createStorage } from './store/storage.js';
import { createLibrary } from './store/library.js';
import { createSettings } from './store/settings.js';
import { createWorkouts } from './store/workouts.js';
import { createHistory, newId } from './store/history.js';
import { startFromWorkout, startFromSession, startEmpty } from './engine/session.js';
import { createRouter } from './ui/router.js';
import { closeAllSheets } from './ui/sheet.js';
import { localISO, toast } from './ui/util.js';
import { createTrainScreen } from './ui/screens/train.js';
import { createSessionScreen } from './ui/screens/session.js';
import { createProgressScreen } from './ui/screens/progress.js';
import { createHistoryScreen } from './ui/screens/history.js';
import { createPlansScreen } from './ui/screens/plans.js';
import { createSettingsScreen } from './ui/screens/settings.js';

export const VERSION = '1.0.0';

const app = {
  now: () => Date.now(),
  today: () => localISO(Date.now()),
  screens: {},
};

async function boot() {
  const shipped = await fetch('./data/exercises.json').then((r) => r.json());

  app.storage = createStorage();
  app.library = createLibrary({ shipped, storage: app.storage });
  app.settings = createSettings({ storage: app.storage, stations: shipped.stations });
  app.workouts = createWorkouts({ storage: app.storage });
  app.history = createHistory({ storage: app.storage });

  app.applyTheme = () => {
    const t = app.settings.theme;
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = t;
  };
  app.applyTheme();

  app.router = createRouter({ onEnter: (id) => app.screens[id]?.refresh?.() });
  app.refreshAll = () => app.screens[app.router.current]?.refresh?.();

  const screen = (id) => document.getElementById(`screen-${id}`);
  app.screens.train = createTrainScreen({ root: screen('train'), app });
  app.screens.session = createSessionScreen({ root: screen('session'), app });
  app.screens.progress = createProgressScreen({ root: screen('progress'), app });
  app.screens.history = createHistoryScreen({ root: screen('history'), app });
  app.screens.plans = createPlansScreen({ root: screen('plans'), app });
  app.screens.settings = createSettingsScreen({ root: screen('settings'), app, version: VERSION });

  app.openSession = () => {
    closeAllSheets();
    app.router.show('session');
  };

  /** Start from a plan, from a past session, or empty. One session at a time. */
  app.start = async ({ workoutId, sessionId }) => {
    if (app.history.active) {
      toast('Finish or discard the current workout first.');
      app.openSession();
      return;
    }
    const ids = { id: newId('s', app.now()), date: app.today(), now: app.now() };
    const history = app.history.all();
    let s;
    if (workoutId) s = startFromWorkout(app.workouts.get(workoutId), history, ids);
    else if (sessionId) s = startFromSession(app.history.get(sessionId), history, ids);
    else s = startEmpty(ids);
    app.history.setActive(s);
    app.openSession();
  };

  app.editPlan = (id) => app.screens.plans.editPlan(id);

  if (!app.storage.available) toast('This browser is blocking storage, so nothing will be saved. Private Browsing does this.', 6000);

  // A workout left open (phone locked, app swiped away) picks up where it was.
  app.router.show(app.history.active ? 'session' : 'train');

  try {
    const flash = sessionStorage.getItem('liftlog.flash');
    if (flash) { sessionStorage.removeItem('liftlog.flash'); toast(flash, 4000); }
  } catch (_) {}

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('app').innerHTML = `<div class="empty"><h3>Lift Log couldn’t start</h3><p>${String(err?.message ?? err)}</p></div>`;
});
