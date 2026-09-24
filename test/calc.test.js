const test = require('node:test');
const assert = require('node:assert/strict');
const { Calculator } = require('../calc.js');

// Presses a space-separated key sequence and returns the view.
function run(keys, calc = new Calculator({ mode: 'dec' })) {
  for (const k of keys.split(/\s+/).filter(Boolean)) {
    if (/^\d{2,}$/.test(k)) [...k].forEach((d) => calc.press(d));
    else if (k.startsWith('#')) calc.press(k.slice(1)); // single key, e.g. #15
    else calc.press(k);
  }
  return calc.view();
}

test('feet-inch-fraction entry and display', () => {
  assert.equal(run('5 ft 6 in 3 frac 8').main, `5'-6\" 3/8`);
  assert.equal(run('5 ft 6 in 3 frac 8 =').main, `5'-6 3/8\"`);
  assert.equal(run('5 ft 6 =').main, `5'-6\"`);
  assert.equal(run('6 in 3 frac 8 in').main, `6 3/8\"`);
  assert.equal(run('1 frac 2 ft =').main, `0'-6\"`);
});

test('after Inch, number keys 0-15 are sixteenths', () => {
  assert.equal(run('24 ft #11 in 5').main, `24'-11 5/16\"`);
  assert.equal(run('24 ft #11 in 5 =').main, `24'-11 5/16\"`);
  assert.equal(run('6 in 2 =').main, `6 1/8\"`);
  assert.equal(run('6 in 4 =').main, `6 1/4\"`);
  assert.equal(run('6 in 8 =').main, `6 1/2\"`);
  assert.equal(run('6 in #12 =').main, `6 3/4\"`);
  assert.equal(run('6 in #15 =').main, `6 15/16\"`);
  assert.equal(run('6 in 0 =').main, `6"`);
  assert.equal(run('6 in 1 5 =').main, `6 15/16\"`); // typed on a keyboard
  assert.equal(run('6 in 1 7').main, `6 7/16\"`); // 17 is too big, so 7 replaces it
  assert.equal(run('5 ft 3 in 3 + 1 ft 1 in 13 =').main, `6'-5\"`);
  assert.equal(run('#12 ft #10 in').main, `12'-10\"`);
  assert.equal(run('#12 ft #10 in').info, 'next key = 16ths (0–15)');
});

test('adds and subtracts lengths', () => {
  assert.equal(run('10 ft 6 in + 2 ft 8 in 1 frac 4 =').main, `13'-2 1/4\"`);
  assert.equal(run('3 ft - 5 ft 1 frac 16 in =').main, `-2'-0 1/16\"`);
  assert.equal(run('5 ft + 3 =').main, `8'-0\"`);
  assert.equal(run('1 m + 10 cm =').main, '1.1 m');
});

test('multiplication and division track dimensions', () => {
  assert.equal(run('12 ft * 10 ft =').main, '120 sq ft');
  assert.equal(run('12 ft * 10 ft * 4 in =').main, '40 cu ft');
  assert.equal(run('12 ft * 10 ft * 4 in = yd').main, '1.48 cu yd');
  assert.equal(run('120 ft ft / 10 ft =').main, `12'-0\"`);
  assert.equal(run('10 ft / 2 ft =').main, '5');
  assert.equal(run('2 in * 6 in * 8 ft = bdft').main, '8 bd ft');
});

test('dimension errors', () => {
  const v = run('5 ft + 5 ft ft =');
  assert.equal(v.main, 'Error');
  assert.match(v.info, /mix length and area/);
  assert.equal(run('5 / 2 ft =').main, 'Error');
  assert.equal(run('5 ft / 0 =').main, 'Error');
});

test('unit conversion toggles', () => {
  const c = new Calculator({ mode: 'dec' });
  assert.equal(run('3 ft 6 in =', c).main, `3'-6\"`);
  assert.equal(run('ft', c).main, '3.5 ft');
  assert.equal(run('in', c).main, '42"');
  assert.equal(run('in', c).main, '42 in');
  assert.equal(run('m', c).main, '1.0668 m');
  assert.equal(run('mm', c).main, '1,066.8 mm');
  assert.equal(run('25 = ft').main, `25'-0\"`);
});

test('fraction resolution', () => {
  const c = new Calculator({ mode: 'dec' });
  run('1 frac 3 in =', c);
  assert.equal(c.view().main, '5/16"');
  c.press('res');
  assert.equal(c.view().main, '11/32"');
});

test('rise / run / diagonal / pitch', () => {
  const c = new Calculator({ mode: 'dec' });
  run('6 ft rise 8 ft run', c);
  assert.equal(run('diag', c).main, `10'-0\"`);
  assert.equal(run('pitch', c).main, '9/12');
  assert.equal(run('deg', c).main, '36.87°');

  const d = new Calculator({ mode: 'dec' });
  run('12 ft run 6 pitch', d);
  assert.equal(run('rise', d).main, `6'-0\"`);
  assert.equal(run('diag', d).main, `13'-5\"`);

  const e = new Calculator({ mode: 'dec' });
  run('30 deg 10 ft run', e);
  assert.equal(run('rise', e).main, `5'-9 5/16\"`);
});

test('third register input replaces the oldest', () => {
  const c = new Calculator({ mode: 'dec' });
  run('3 ft rise 4 ft run 10 ft diag', c);
  assert.deepEqual(c.view().regs, ['run', 'diag']);
  assert.equal(run('rise', c).main, `9'-2\"`);
});

test('calculation result can be stored into a register', () => {
  const c = new Calculator({ mode: 'dec' });
  run('4 ft + 2 ft = rise 8 ft run', c);
  assert.equal(run('diag', c).main, `10'-0\"`);
});

test('Slope key gives the slope length, like the Jobber SLP key', () => {
  const v = run('1 0 0 0 rise 5 0 0 0 run slope', new Calculator());
  assert.equal(v.main, `50'-11 7/8"`);
  assert.equal(v.label, 'SLOPE');
});

test('stairs', () => {
  const c = new Calculator({ mode: 'dec' });
  const v = run('8 ft 11 in stair', c);
  assert.equal(v.label, 'RISERS');
  assert.equal(v.main, '14');
  assert.equal(run('stair', c).main, `0'-7 5/8\"`);
  assert.equal(run('stair', c).main, '13');
  assert.equal(run('stair', c).main, `0'-10\"`);
});

test('circle', () => {
  const c = new Calculator({ mode: 'dec' });
  assert.equal(run('10 ft circ', c).main, `31'-5\"`);
  assert.equal(run('circ', c).main, '78.54 sq ft');
});

test('memory', () => {
  const c = new Calculator({ mode: 'dec' });
  run('5 ft mplus 3 ft mplus clear', c);
  assert.equal(c.view().mem, true);
  assert.equal(run('rcl', c).main, `8'-0\"`);
});

test('backspace and clear', () => {
  const c = new Calculator({ mode: 'dec' });
  run('5 ft 6 in back', c);
  assert.equal(c.view().main, `5' 6`);
  run('back back', c);
  assert.equal(c.view().main, '5');
  run('clear', c);
  assert.equal(c.view().main, '0');
});

test('square root and square', () => {
  assert.equal(run('144 ft ft sqrt').main, `12'-0\"`);
  assert.equal(run('3 ft sq').main, '9 sq ft');
});

test('Feet mode (default): feet digits, then one inch key, then one 16ths key', () => {
  const fis = (keys) => run(keys, new Calculator());
  assert.equal(fis('2 4 5 #10').main, `24'-5 10/16`); // as typed
  assert.equal(fis('2 4 5 #10 =').main, `24'-5 5/8\"`); // simplified
  assert.equal(fis('2 4 #11 5 =').main, `24'-11 5/16\"`);
  assert.equal(fis('2').main, `0'-0 2/16`);
  assert.equal(fis('2 4').main, `0'-2 4/16`);
  assert.equal(fis('1 0 0 0').main, `10'-0 0/16`);
  assert.equal(fis('1 0 0 0 =').main, `10'-0\"`);
  assert.equal(fis('1 2 3 0').main, `12'-3 0/16`);
  assert.equal(fis('1 0 0 0 + 2 6 8 =').main, `12'-6 1/2\"`);
  assert.equal(fis('1 0 0 0 / 3 =').main, `3'-4\"`); // number after length ÷
  assert.equal(fis('1 0 0 0 * 3 =').main, `30'-0\"`);
  assert.equal(fis('1 2 ft * 1 0 ft =').main, '120 sq ft'); // unit keys still work
  assert.equal(fis('2 4 5 #10 back').main, `2'-4 5/16`);
  assert.equal(fis('1 . 5 =').main, '1.5');
  assert.equal(fis('6 pitch 1 2 0 0 run rise').main, `6'-0\"`);
  assert.equal(fis('').mode, 'FEET');
  assert.equal(fis('mode').mode, 'DEC');
  assert.equal(fis('mode 2 4 =').main, '24');
});
