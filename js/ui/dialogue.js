// Dialogue overlay — a thin DOM layer over the overworld (the project keeps
// menus/log/overlays in the DOM and only battlers/tiles on canvas). Two prompts:
//   say(lines, {name})  -> Promise<void>   advance through lines
//   confirm(text,{name})-> Promise<bool>   Enter = yes, Esc = no
// Each prompt owns its own key/click listeners and tears them down on resolve,
// so only one is ever live. The overworld controller freezes player input while
// a prompt is open.
(function () {
  const WS = (globalThis.WS = globalThis.WS || {});
  const $ = (s) => document.querySelector(s);

  class Dialogue {
    constructor() {
      this.box = $('#dialogue-box');
      this.nameEl = $('#dialogue-name');
      this.textEl = $('#dialogue-text');
      this.hintEl = $('#dialogue-hint');
      this._active = false;
    }
    get active() { return this._active; }

    _open(name) {
      this._active = true;
      this.nameEl.textContent = name || '';
      this.nameEl.classList.toggle('hidden', !name);
      this.box.classList.remove('hidden');
    }
    _close() {
      this._active = false;
      this.box.classList.add('hidden');
    }

    say(lines, opts = {}) {
      lines = Array.isArray(lines) ? lines : [lines];
      this._open(opts.name);
      this.hintEl.textContent = '▸ Enter';
      let i = 0;
      const render = () => { this.textEl.textContent = lines[i]; };
      render();
      return new Promise((resolve) => {
        const advance = () => {
          i += 1;
          if (i >= lines.length) { done(); return; }
          render();
        };
        const onKey = (e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
            e.preventDefault();
            if (e.key === 'Escape') { done(); return; }
            advance();
          }
        };
        const onClick = () => advance();
        const done = () => {
          window.removeEventListener('keydown', onKey, true);
          this.box.removeEventListener('click', onClick);
          this._close();
          resolve();
        };
        window.addEventListener('keydown', onKey, true);
        this.box.addEventListener('click', onClick);
      });
    }

    confirm(text, opts = {}) {
      this._open(opts.name);
      this.textEl.textContent = text;
      this.hintEl.innerHTML = '<span data-yes>▸ Enter · Yes</span>&nbsp;&nbsp;<span data-no>Esc · No</span>';
      return new Promise((resolve) => {
        const done = (val) => {
          window.removeEventListener('keydown', onKey, true);
          this.hintEl.removeEventListener('click', onHintClick);
          this._close();
          resolve(val);
        };
        const onKey = (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); done(true); }
          else if (e.key === 'Escape') { e.preventDefault(); done(false); }
        };
        const onHintClick = (e) => {
          if (e.target.closest('[data-yes]')) done(true);
          else if (e.target.closest('[data-no]')) done(false);
        };
        window.addEventListener('keydown', onKey, true);
        this.hintEl.addEventListener('click', onHintClick);
      });
    }
  }

  WS.Dialogue = Dialogue;
})();
