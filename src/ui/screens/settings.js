/**
 * Settings: theme, welcome messages, which equipment her gym has, and backups.
 */

import { esc, toast, plural } from '../util.js';
import { confirmSheet, openSheet } from '../sheet.js';
import { THEMES, MAX_MESSAGES, MAX_MESSAGE_LENGTH, cleanMessages } from '../../store/settings.js';
import { createBackup, backupFilename, parseBackup, restoreBackup } from '../../store/backup.js';
import { showWelcome } from '../welcome.js';

const THEME_LABEL = { system: 'Match phone', light: 'Light', dark: 'Dark' };

export function createSettingsScreen({ root, app, version }) {
  const { library, settings } = app;

  function render() {
    const stations = Object.entries(library.stations).filter(([id]) => id !== 'floor')
      .sort((a, b) => a[1].localeCompare(b[1]));
    const off = stations.filter(([id]) => !settings.hasStation(id)).length;

    root.innerHTML = `
      <div class="page-head"><h1 class="page-title">Settings</h1></div>

      <div class="section-label">Appearance</div>
      <div class="seg" role="group" aria-label="Theme">${THEMES.map((t) => `<button data-theme-pick="${t}" aria-pressed="${settings.theme === t}">${THEME_LABEL[t]}</button>`).join('')}</div>

      <div class="section-label">Welcome messages</div>
      <div class="card">
        <button class="row" data-messages><span class="row-main"><span class="row-title">Messages when the app opens</span><span class="row-sub">${settings.messages.length ? `${plural(settings.messages.length, 'message')}${settings.messageFrom ? `, from ${esc(settings.messageFrom)}` : ''}` : 'None yet'}</span></span><span class="chev">›</span></button>
      </div>

      <div class="section-label">Backup</div>
      <div class="card">
        <button class="row" data-export><span class="row-main"><span class="row-title">Export backup</span><span class="row-sub">Save plans, exercises and all history to a file</span></span><span class="chev">›</span></button>
        <button class="row" data-import><span class="row-main"><span class="row-title">Import backup</span><span class="row-sub">Merge a backup file into this phone. Nothing here is overwritten.</span></span><span class="chev">›</span></button>
      </div>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
      <p class="hint">Your data lives only on this phone. Export now and then, and before you clear Safari’s website data or switch phones.</p>

      <div class="section-label">My gym ${off ? `<button class="link" data-all>Turn all on</button>` : ''}</div>
      <p class="hint" style="margin-top:0">Swaps only suggest equipment that’s switched on. The list covers what a big club like Equinox usually has. Switch off anything your location doesn’t.</p>
      <div class="card">${stations.map(([id, label]) => `
        <div class="row"><span class="row-title">${esc(label)}</span>
        <button class="switch" role="switch" data-station="${esc(id)}" aria-checked="${settings.hasStation(id)}" aria-label="${esc(label)}"></button></div>`).join('')}
      </div>

      <div class="section-label">Danger zone</div>
      <button class="btn danger block" data-reset>Erase everything</button>

      <p class="hint" style="text-align:center;margin-top:24px">Lift Log ${esc(version)}</p>`;
  }

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.themePick) {
      settings.setTheme(t.dataset.themePick);
      app.applyTheme();
      render();
    } else if (t.dataset.station) {
      const on = t.getAttribute('aria-checked') !== 'true';
      settings.setStation(t.dataset.station, on);
      t.setAttribute('aria-checked', String(on));
      const all = root.querySelector('[data-all]');
      if (on && !all) return;
      render();
    } else if (t.dataset.all !== undefined) {
      for (const id of Object.keys(library.stations)) settings.setStation(id, true);
      render();
    } else if (t.dataset.messages !== undefined) {
      editMessages();
    } else if (t.dataset.export !== undefined) {
      exportBackup();
    } else if (t.dataset.import !== undefined) {
      root.querySelector('#import-file').click();
    } else if (t.dataset.reset !== undefined) {
      const ok = await confirmSheet({
        title: 'Erase everything?',
        message: 'This deletes every plan, custom exercise and logged session on this phone. Export a backup first if you might want them.',
        confirm: 'Erase everything', danger: true,
      });
      if (!ok) return;
      app.storage.clearAll();
      location.reload();
    }
  });

  root.addEventListener('change', async (e) => {
    if (e.target.id !== 'import-file') return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) { toast(parsed.error, 4000); return; }
    const r = restoreBackup(app.storage, parsed.backup);
    const bits = [
      r.sessions && `${r.sessions} sessions`,
      r.workouts && `${r.workouts} plans`,
      r.exercises && `${r.exercises} exercises`,
      r.messages && 'new messages',
    ].filter(Boolean);
    sessionStorage.setItem('liftlog.flash', bits.length ? `Imported ${bits.join(', ')}` : 'Nothing new in that backup');
    location.reload();   // every store re-reads, and re-cleans, what was written
  });

  function editMessages() {
    openSheet({
      title: 'Welcome messages',
      tall: true,
      closeLabel: 'Cancel',
      body: `
        <p class="hint" style="margin-top:0">One message per line. Each time the app opens it shows the next one, then starts over.</p>
        <div class="field"><label for="msg-list">Messages</label>
          <textarea class="input" id="msg-list" rows="8" placeholder="Have a great workout!">${esc(settings.messages.join('\n'))}</textarea>
          <span class="hint">Up to ${MAX_MESSAGES} messages, ${MAX_MESSAGE_LENGTH} characters each.</span></div>
        <div class="field"><label for="msg-from">Signed</label><input class="input" id="msg-from" value="${esc(settings.messageFrom)}" placeholder="Your name" autocomplete="off"></div>
        <button class="btn block" data-preview>Preview</button>`,
      foot: '<button class="btn primary block" data-save>Save messages</button>',
      onMount(el, close) {
        const list = () => cleanMessages(el.querySelector('#msg-list').value);
        const from = () => el.querySelector('#msg-from').value;
        el.querySelector('#msg-list').style.minHeight = '180px';
        el.querySelector('[data-preview]').addEventListener('click', () => {
          const first = list()[0];
          if (!first) { toast('Write a message first.'); return; }
          showWelcome({ text: first, from: from().trim() });
        });
        el.querySelector('[data-save]').addEventListener('click', () => {
          settings.setMessages(list(), from());
          close();
          render();
          toast(settings.messages.length ? `Saved ${plural(settings.messages.length, 'message')}` : 'Messages cleared');
        });
      },
    });
  }

  async function exportBackup() {
    const now = app.now();
    const text = JSON.stringify(createBackup(app.storage, now), null, 2);
    const name = backupFilename(now);
    const file = new File([text], name, { type: 'application/json' });
    // On iPhone the share sheet is the reliable route to Save to Files or AirDrop.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { render, refresh: render };
}
