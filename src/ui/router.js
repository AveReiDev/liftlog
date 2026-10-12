/**
 * Screen switching and the bottom tab bar. Five tabs plus the full-screen
 * session, which hides the tab bar.
 */

export function createRouter({ onEnter } = {}) {
  let current = null;

  function show(id) {
    for (const el of document.querySelectorAll('.screen')) {
      el.classList.toggle('active', el.id === `screen-${id}`);
    }
    for (const el of document.querySelectorAll('.tab')) {
      if (el.dataset.tab === id) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    }
    document.body.dataset.mode = id === 'session' ? 'session' : 'browse';
    if (current !== id) window.scrollTo(0, 0);
    current = id;
    onEnter?.(id);
  }

  document.getElementById('tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (b) show(b.dataset.tab);
  });

  return {
    show,
    get current() { return current; },
  };
}
