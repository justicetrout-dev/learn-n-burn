(function () {
  'use strict';

  const calc = new BuilderCalc.Calculator();
  const $ = (id) => document.getElementById(id);
  const REG_ABBR = { rise: 'RISE', run: 'RUN', diag: 'SLOPE', pitch: 'PITCH' };

  function render() {
    const v = calc.view();
    $('main').textContent = v.main;
    $('main').classList.toggle('long', v.main.length > 14);
    $('label').textContent = v.label;
    $('info').textContent = v.info;
    $('ind-mem').classList.toggle('on', v.mem);
    $('ind-op').textContent = v.op;
    $('ind-regs').textContent = v.regs.map((r) => REG_ABBR[r]).join(' ');
    $('ind-res').textContent = v.res;
    $('ind-mode').textContent = v.mode;
    document.querySelector('[data-key="res"]').textContent = v.res;

    const tape = $('tape');
    tape.replaceChildren(
      ...v.tape.slice().reverse().map((line) => {
        const li = document.createElement('li');
        li.textContent = line;
        return li;
      })
    );
  }

  function press(key) {
    calc.press(key);
    render();
  }

  $('keys').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-key]');
    if (btn) press(btn.dataset.key);
  });

  const KEYMAP = {
    Enter: '=', '=': '=', Escape: 'clear', Delete: 'clear', Backspace: 'back',
    "'": 'ft', '"': 'in', '\\': 'frac', y: 'yd', m: 'm', c: 'cm',
    d: 'mode', r: 'rise', n: 'run', s: 'slope', p: 'pitch',
    '+': '+', '-': '-', '*': '*', x: '*', '/': '/',
  };

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = /^[0-9.]$/.test(e.key) ? e.key : KEYMAP[e.key];
    if (!key) return;
    e.preventDefault();
    press(key);
    const btn = document.querySelector(`button[data-key="${CSS.escape(key)}"]`);
    if (btn) {
      btn.classList.add('pressed');
      setTimeout(() => btn.classList.remove('pressed'), 120);
    }
  });

  render();
})();
