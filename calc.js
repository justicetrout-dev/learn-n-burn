/*
 * Builder's calculator engine.
 *
 * Every quantity is stored as { v, dim, unit }:
 *   v    – value in base units (inches ^ dim)
 *   dim  – 0 = plain number, 1 = length, 2 = area, 3 = volume
 *   unit – how to display it ('ftin', 'ft', 'in', 'indec', 'yd', 'm', 'cm', 'mm',
 *          'bdft', or for plain numbers null / 'pitch' / 'deg')
 *
 * Works in the browser (window.BuilderCalc) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  const LEN = { in: 1, ft: 12, yd: 36, m: 100 / 2.54, cm: 1 / 2.54, mm: 1 / 25.4 };
  const BDFT = 144; // cubic inches in one board foot
  const MAX_RISER = 7.75; // inches, IRC maximum
  const DEFAULT_TREAD = 10; // inches, IRC minimum
  const RESOLUTIONS = [2, 4, 8, 16, 32, 64];
  const REG_NAMES = ['rise', 'run', 'diag', 'pitch'];
  // 'diag' is the slope length (the Jobber's SLP key): the diagonal along the slope.
  const REG_LABEL = { rise: 'RISE', run: 'RUN', diag: 'SLOPE', pitch: 'PITCH' };
  const DIGIT_KEY = /^([0-9.]|1[0-5])$/; // keys 10-15 exist for sixteenths

  class CalcError extends Error {}

  const Q = (v, dim = 0, unit = null) => ({ v, dim, unit });

  function family(unit) {
    if (unit === 'ftin' || unit === 'ft' || unit === 'bdft') return 'ft';
    if (unit === 'in' || unit === 'indec') return 'in';
    return unit;
  }

  function defaultUnit(dim, fam) {
    if (dim === 0) return null;
    fam = LEN[fam] ? fam : 'ft';
    if (dim === 1 && fam === 'ft') return 'ftin';
    return fam;
  }

  function factor(unit, dim) {
    if (dim === 0) return 1;
    if (unit === 'bdft') return BDFT;
    return Math.pow(LEN[family(unit)], dim);
  }

  // ---------- formatting ----------

  function gcd(a, b) {
    while (b) [a, b] = [b, a % b];
    return a;
  }

  function fmtNum(x, dec = 4) {
    if (!isFinite(x)) throw new CalcError('Overflow');
    const p = Math.pow(10, dec);
    let s = (Math.round(x * p) / p).toFixed(dec);
    if (s.includes('.')) s = s.replace(/\.?0+$/, '');
    if (s === '-0') s = '0';
    const [int, frac] = s.split('.');
    const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return frac ? `${withCommas}.${frac}` : withCommas;
  }

  // Splits inches into [whole inches, numerator, denominator] at the given resolution.
  function inchParts(absInches, res) {
    const n = Math.round(absInches * res);
    const whole = Math.floor(n / res);
    let num = n - whole * res;
    let den = res;
    if (num) {
      const g = gcd(num, den);
      num /= g;
      den /= g;
    }
    return [whole, num, den];
  }

  function inchText(whole, num, den) {
    if (!num) return `${whole}`;
    return whole ? `${whole} ${num}/${den}` : `${num}/${den}`;
  }

  function fmtFtIn(v, res) {
    const n = Math.round(Math.abs(v) * res);
    const ft = Math.floor(n / (12 * res));
    const [whole, num, den] = inchParts((n - ft * 12 * res) / res, res);
    const neg = v < 0 && n > 0 ? '-' : '';
    return `${neg}${fmtNum(ft, 0)}'-${whole}${num ? ` ${num}/${den}` : ''}"`;
  }

  function fmtIn(v, res) {
    const [whole, num, den] = inchParts(Math.abs(v), res);
    const neg = v < 0 && (whole || num) ? '-' : '';
    return `${neg}${inchText(whole, num, den).replace(/^(\d+)/, (w) => fmtNum(+w, 0))}"`;
  }

  const AREA = { ft: 'sq ft', in: 'sq in', yd: 'sq yd', m: 'm²', cm: 'cm²', mm: 'mm²' };
  const VOL = { ft: 'cu ft', in: 'cu in', yd: 'cu yd', m: 'm³', cm: 'cm³', mm: 'mm³', bdft: 'bd ft' };
  const LEN_DEC = { ft: 4, yd: 4, m: 4, cm: 2, mm: 1, indec: 4 };

  function format(q, res = 16) {
    const { v, dim, unit } = q;
    if (dim === 0) {
      if (unit === 'pitch') return `${fmtNum(v, 3)}/12`;
      if (unit === 'deg') return `${fmtNum(v, 2)}°`;
      return fmtNum(v, 6);
    }
    if (dim === 1) {
      if (unit === 'ftin') return fmtFtIn(v, res);
      if (unit === 'in') return fmtIn(v, res);
      if (unit === 'indec') return `${fmtNum(v, LEN_DEC.indec)} in`;
      return `${fmtNum(v / LEN[unit], LEN_DEC[unit])} ${unit}`;
    }
    const dec = family(unit) === 'm' ? 4 : 2;
    const label = dim === 2 ? AREA[family(unit)] : VOL[unit === 'bdft' ? 'bdft' : family(unit)];
    return `${fmtNum(v / factor(unit, dim), dec)} ${label}`;
  }

  // ---------- arithmetic ----------

  const DIM_NAME = ['number', 'length', 'area', 'volume'];

  function apply(a, op, b) {
    if (op === '+' || op === '-') {
      if (a.dim !== b.dim) {
        // A plain number takes on the other side's display unit: 5' + 3 = 8'.
        if (a.dim === 0) a = Q(a.v * factor(b.unit, b.dim), b.dim, b.unit);
        else if (b.dim === 0) b = Q(b.v * factor(a.unit, a.dim), a.dim, a.unit);
        else throw new CalcError(`Can't mix ${DIM_NAME[a.dim]} and ${DIM_NAME[b.dim]}`);
      }
      const v = op === '+' ? a.v + b.v : a.v - b.v;
      return Q(v, a.dim, a.dim ? a.unit : null);
    }
    let v, dim;
    if (op === '*') {
      dim = a.dim + b.dim;
      if (dim > 3) throw new CalcError('Beyond volume');
      v = a.v * b.v;
    } else {
      if (b.v === 0) throw new CalcError('Divide by zero');
      dim = a.dim - b.dim;
      if (dim < 0) throw new CalcError(`Can't divide ${DIM_NAME[a.dim]} by ${DIM_NAME[b.dim]}`);
      v = a.v / b.v;
    }
    let unit = null;
    if (dim > 0) {
      if (dim === a.dim) unit = a.unit;
      else if (dim === b.dim) unit = b.unit;
      else unit = defaultUnit(dim, family(a.dim ? a.unit : b.unit));
    }
    return Q(v, dim, unit);
  }

  // ---------- number entry ----------

  function newEntry(fis = false) {
    return {
      fis, // Feet mode: keys are feet digits, then one inch key, then one 16ths key
      keys: [], // key values typed in Feet mode
      cur: '', // digits being typed
      fracNum: null, // numerator once the fraction key is pressed
      six: false, // after Inch, number keys 0-15 are sixteenths
      unit: null, // null | 'ft' (feet-inch) | 'in' | 'yd' | 'm' | 'cm' | 'mm' | 'bdft'
      feet: null,
      inches: null,
      val: null, // value for yd / metric / bdft entries
      text: '', // what has been committed so far, for the display
      power: 1,
      last: null, // last unit key pressed
      closed: false, // further digits start a new entry
      neg: false,
      hist: [],
    };
  }

  function pendingValue(e) {
    if (e.fracNum !== null) {
      const den = parseInt(e.cur, 10);
      return den ? e.fracNum / den : e.fracNum;
    }
    if (e.six) return e.cur === '' ? null : parseInt(e.cur, 10) / 16;
    if (e.cur === '' || e.cur === '.') return null;
    return parseFloat(e.cur);
  }

  function sixteenthsText(n) {
    if (!n) return '0';
    const g = gcd(n, 16);
    return `${n / g}/${16 / g}`;
  }

  function pendingText(e) {
    if (e.fracNum !== null) return `${e.fracNum}/${e.cur}`;
    if (e.six && e.cur !== '') return sixteenthsText(parseInt(e.cur, 10));
    return e.cur;
  }

  function isEmptyEntry(e) {
    return e.cur === '' && e.fracNum === null && e.unit === null && e.keys.length === 0;
  }

  // Feet mode reads keys from the right: last = sixteenths, one before = inches, rest = feet.
  function fisInches(keys) {
    const n = keys.length;
    const six = n >= 1 ? keys[n - 1] : 0;
    const inch = n >= 2 ? keys[n - 2] : 0;
    const feet = n >= 3 ? parseInt(keys.slice(0, n - 2).join(''), 10) : 0;
    return feet * 12 + inch + six / 16;
  }

  function finalize(e) {
    const pend = pendingValue(e);
    let q;
    if (e.fis) {
      q = Q(fisInches(e.keys), 1, 'ftin');
      if (e.neg) q.v = -q.v;
      return q;
    }
    switch (e.unit) {
      case null:
        q = Q(pend ?? 0);
        break;
      case 'ft':
        q = e.power > 1
          ? Q(e.feet * Math.pow(12, e.power), e.power, 'ft')
          : Q(e.feet * 12 + (e.inches ?? 0) + (pend ?? 0), 1, 'ftin');
        break;
      case 'in':
        q = e.power > 1 ? Q(e.inches, e.power, 'in') : Q(e.inches + (pend ?? 0), 1, 'in');
        break;
      case 'bdft':
        q = Q(e.val * BDFT, 3, 'bdft');
        break;
      default:
        q = Q(e.val * Math.pow(LEN[e.unit], e.power), e.power, e.unit);
    }
    if (e.neg) q.v = -q.v;
    return q;
  }

  // Shows Feet-mode keys as typed, like the Jobber: 1 0 0 0 → 10'-0 0/16 (simplified on =).
  function fisText(keys) {
    const n = keys.length;
    const six = n >= 1 ? keys[n - 1] : 0;
    const inch = n >= 2 ? keys[n - 2] : 0;
    const feet = n >= 3 ? parseInt(keys.slice(0, n - 2).join(''), 10) : 0;
    return `${fmtNum(feet, 0)}'-${inch} ${six}/16`;
  }

  function entryText(e) {
    if (e.fis) return (e.neg ? '-' : '') + fisText(e.keys);
    const sup = e.power === 2 ? '²' : e.power === 3 ? '³' : '';
    const pend = pendingText(e);
    let s;
    if (e.unit === null) s = pend || '0';
    else if (e.six && pend) s = e.text.replace(/"(#?)$/, pend === '0' ? '"$1' : ` ${pend}"$1`).replace('#', sup);
    else s = e.text.replace('#', sup) + (pend ? ` ${pend}` : '');
    return (e.neg ? '-' : '') + s;
  }

  // ---------- calculator ----------

  class Calculator {
    constructor({ mode = 'fis' } = {}) {
      this.mode = mode; // 'fis' = feet-inch-sixteenths entry, 'dec' = plain decimal entry
      this.res = 16;
      this.mem = null;
      this.tape = [];
      this.resetRegs();
      this.clearAll();
    }

    clearAll() {
      this.x = Q(0);
      this.xNew = false; // x is a fresh operand for a pending operator
      this.xSource = 'init'; // 'calc' results can be stored with Rise/Run/…
      this.acc = null;
      this.op = null;
      this.entry = null;
      this.error = null;
      this.cycle = null;
      this.label = '';
      this.info = '';
    }

    resetRegs() {
      this.regs = { rise: null, run: null, diag: null, pitch: null };
      this.clock = 0;
      this.regUnit = 'ftin';
    }

    press(key) {
      if (this.error) {
        if (key === 'clear') return this.clearAll();
        if (!DIGIT_KEY.test(key)) return;
        this.clearAll();
      }
      if (!this.cycle || this.cycle.key !== key) this.cycle = null;
      if (key !== 'res') {
        this.label = '';
        this.info = '';
      }
      try {
        this.dispatch(key);
      } catch (err) {
        if (!(err instanceof CalcError)) throw err;
        this.error = err.message;
        this.entry = null;
        this.acc = null;
        this.op = null;
        this.cycle = null;
      }
    }

    dispatch(key) {
      if (DIGIT_KEY.test(key)) return this.digit(key);
      switch (key) {
        case 'frac': return this.frac();
        case 'ft': case 'in': case 'yd': case 'm': case 'cm': case 'mm': case 'bdft':
          return this.unitKey(key);
        case '+': case '-': case '*': case '/': return this.operator(key);
        case '=': return this.equals();
        case 'neg': return this.negate();
        case 'sqrt': return this.sqrt();
        case 'sq': return this.square();
        case 'back': return this.back();
        case 'clear': return this.clear();
        case 'res': return this.cycleRes();
        case 'mode': this.mode = this.mode === 'fis' ? 'dec' : 'fis'; return;
        case 'mplus': return this.memAdd('+');
        case 'mminus': return this.memAdd('-');
        case 'rcl': return this.recall();
        case 'mc': this.mem = null; return;
        case 'slope': return this.regKey('diag');
        case 'rise': case 'run': case 'diag': case 'pitch': return this.regKey(key);
        case 'deg': return this.degrees();
        case 'stair': return this.stairs();
        case 'circ': return this.circle();
        default: throw new Error(`Unknown key: ${key}`);
      }
    }

    setX(q, source) {
      this.x = q;
      this.xNew = true;
      this.xSource = source;
    }

    commitEntry() {
      if (!this.entry) return this.x;
      const q = finalize(this.entry);
      this.entry = null;
      this.setX(q, 'entry');
      return q;
    }

    snap() {
      const e = this.entry;
      const { hist, ...rest } = e;
      hist.push(rest);
    }

    // --- entry keys ---

    // In Feet mode, entries are lengths, except the number after a length × or ÷.
    fisEntry() {
      if (this.mode !== 'fis') return false;
      return !((this.op === '*' || this.op === '/') && this.acc && this.acc.dim > 0);
    }

    // Reinterpret a Feet-mode entry as the plain digits that were typed.
    toRegular() {
      const e = this.entry;
      if (!e || !e.fis) return;
      this.snap();
      e.fis = false;
      e.cur = e.keys.join('');
      e.keys = [];
    }

    digit(d) {
      if (!this.entry || this.entry.closed) {
        if (!this.op) this.acc = null;
        this.entry = newEntry(d !== '.' && this.fisEntry());
      }
      const e = this.entry;
      if (e.fis) {
        if (d === '.') this.toRegular();
        else {
          if (e.keys.length >= 10) return;
          this.snap();
          e.keys = [...e.keys, parseInt(d, 10)];
          return;
        }
      }
      if (e.six) {
        // One key per sixteenth; typing 1 then 5 on a keyboard also gives 15/16.
        if (d === '.') return;
        let n = parseInt(d.length > 1 ? d : e.cur + d, 10);
        if (n > 15) n = parseInt(d, 10);
        this.snap();
        e.cur = String(n);
        return;
      }
      if (d === '.' && (e.cur.includes('.') || e.fracNum !== null)) return;
      if ((e.cur + d).replace('.', '').length > 10) return;
      this.snap();
      e.cur += d;
    }

    frac() {
      this.toRegular();
      const e = this.entry;
      if (!e || e.closed || e.fracNum !== null || e.cur === '' || e.cur.includes('.')) return;
      this.snap();
      e.fracNum = parseInt(e.cur, 10);
      e.cur = '';
      e.six = false;
    }

    takePending() {
      const e = this.entry;
      const txt = pendingText(e);
      e.cur = '';
      e.fracNum = null;
      return txt;
    }

    unitKey(u) {
      if (this.entry && this.entry.keys.length) this.toRegular();
      const e = this.entry;
      if (!e || isEmptyEntry(e)) {
        if (e) this.entry = null;
        return this.convert(u);
      }
      const pend = pendingValue(e);
      const again = pend === null && e.last === u && e.power < 3;

      if (u === 'ft') {
        if (pend !== null && e.unit === null) {
          this.snap();
          e.feet = pend;
          e.unit = 'ft';
          e.text = `${this.takePending()}'#`;
        } else if (again && e.unit === 'ft' && e.inches === null) {
          this.snap();
          e.power++;
          e.closed = true;
        } else return;
      } else if (u === 'in') {
        const canTake = e.power === 1 && (e.unit === null || e.unit === 'ft' || e.unit === 'in');
        const isFrac = e.fracNum !== null || e.six;
        if (pend !== null && canTake && (e.inches === null || isFrac)) {
          this.snap();
          const txt = this.takePending();
          if (e.inches === null) {
            e.inches = pend;
            e.text = e.unit === null ? `${txt}"#` : `${e.text}-${txt}"`;
            if (e.unit === null) e.unit = 'in';
            e.six = !isFrac;
          } else {
            e.inches += pend;
            if (pend) e.text = e.text.replace(/"(#?)$/, ` ${txt}"$1`);
            e.six = false;
          }
        } else if (again && e.unit === 'in') {
          this.snap();
          e.power++;
          e.six = false;
          e.closed = true;
        } else return;
      } else {
        if (pend !== null && e.unit === null) {
          this.snap();
          e.val = pend;
          e.unit = u;
          e.power = u === 'bdft' ? 3 : 1;
          e.text = `${this.takePending()} ${u === 'bdft' ? 'bd ft' : u}#`;
          if (u === 'bdft') e.text = e.text.replace('#', '');
          e.closed = true;
        } else if (again && e.unit === u && u !== 'bdft') {
          this.snap();
          e.power++;
        } else return;
      }
      e.last = u;
    }

    convert(u) {
      const { v, dim, unit } = this.x;
      let next;
      if (dim === 0) {
        next = u === 'bdft' ? Q(v * BDFT, 3, 'bdft') : Q(v * LEN[u], 1, defaultUnit(1, u));
      } else if (u === 'bdft') {
        if (dim !== 3) throw new CalcError('Board feet needs a volume');
        next = Q(v, 3, 'bdft');
      } else if (dim === 1 && u === 'ft') {
        next = Q(v, 1, unit === 'ftin' ? 'ft' : 'ftin');
      } else if (dim === 1 && u === 'in') {
        next = Q(v, 1, unit === 'in' ? 'indec' : 'in');
      } else {
        next = Q(v, dim, u);
      }
      this.x = next;
      if (dim === 0) this.xNew = true;
    }

    negate() {
      if (this.entry) {
        this.entry.neg = !this.entry.neg;
        return;
      }
      this.setX(Q(-this.x.v, this.x.dim, this.x.unit), this.xSource);
    }

    back() {
      const e = this.entry;
      if (!e) return;
      const prev = e.hist.pop();
      if (prev) Object.assign(e, prev);
    }

    clear() {
      if (this.entry) {
        this.entry = null;
        this.x = Q(0);
        this.xNew = false;
        return;
      }
      if (this.op || this.x.v !== 0 || this.xSource !== 'init') {
        const { mem } = this;
        this.clearAll();
        this.mem = mem;
        return;
      }
      this.resetRegs();
      this.label = 'CLEARED';
      this.info = 'Rise, run, slope and pitch reset';
    }

    cycleRes() {
      const i = RESOLUTIONS.indexOf(this.res);
      this.res = RESOLUTIONS[(i + 1) % RESOLUTIONS.length];
    }

    // --- arithmetic keys ---

    record(a, op, b, r) {
      const sym = { '+': '+', '-': '−', '*': '×', '/': '÷' }[op];
      this.tape.push(`${format(a, this.res)} ${sym} ${format(b, this.res)} = ${format(r, this.res)}`);
      if (this.tape.length > 50) this.tape.shift();
    }

    operator(op) {
      this.commitEntry();
      if (this.op && this.xNew) {
        const r = apply(this.acc, this.op, this.x);
        this.record(this.acc, this.op, this.x, r);
        this.x = r;
        this.xSource = 'calc';
      }
      this.acc = this.x;
      this.op = op;
      this.xNew = false;
    }

    equals() {
      this.commitEntry();
      if (!this.op) return;
      const b = this.xNew ? this.x : this.acc;
      const r = apply(this.acc, this.op, b);
      this.record(this.acc, this.op, b, r);
      this.acc = null;
      this.op = null;
      this.setX(r, 'calc');
    }

    sqrt() {
      const { v, dim, unit } = this.commitEntry();
      if (dim !== 0 && dim !== 2) throw new CalcError(`Can't root a ${DIM_NAME[dim]}`);
      if (v < 0) throw new CalcError('Negative root');
      this.setX(Q(Math.sqrt(v), dim / 2, dim ? defaultUnit(1, family(unit)) : null), 'calc');
    }

    square() {
      const { v, dim, unit } = this.commitEntry();
      if (dim > 1) throw new CalcError('Beyond volume');
      this.setX(Q(v * v, dim * 2, dim ? defaultUnit(2, family(unit)) : null), 'calc');
    }

    memAdd(op) {
      const x = this.commitEntry();
      this.mem = this.mem ? apply(this.mem, op, x) : Q(op === '+' ? x.v : -x.v, x.dim, x.unit);
      this.xSource = 'calc';
      this.label = op === '+' ? 'M+' : 'M−';
      this.info = `Memory: ${format(this.mem, this.res)}`;
    }

    recall() {
      if (!this.mem) return;
      this.commitEntry();
      this.setX({ ...this.mem }, 'calc');
      this.label = 'MEMORY';
    }

    // --- rise / run / diagonal / pitch ---

    storeReg(k, q) {
      let v;
      if (k === 'pitch') {
        if (q.dim > 1) throw new CalcError('Pitch is inches per foot');
        v = q.v;
      } else {
        if (q.dim !== 1) throw new CalcError(`${REG_LABEL[k]} needs a length`);
        v = q.v;
        this.regUnit = q.unit;
      }
      if (v <= 0) throw new CalcError('Must be positive');
      // Two inputs fully define the triangle, so drop the oldest if a third arrives.
      const others = REG_NAMES.filter((r) => r !== k && this.regs[r]);
      if (others.length >= 2) {
        const oldest = others.reduce((a, b) => (this.regs[a].t < this.regs[b].t ? a : b));
        this.regs[oldest] = null;
      }
      this.regs[k] = { v, t: ++this.clock };
    }

    getReg(k) {
      const R = this.regs;
      if (R[k]) return R[k].v;
      const has = (a, b) => R[a] && R[b];
      const val = (a) => R[a].v;
      const leg = (hyp, side) => {
        if (hyp <= side) throw new CalcError('Slope too short');
        return Math.sqrt(hyp * hyp - side * side);
      };
      const ang = () => Math.atan(val('pitch') / 12);
      switch (k) {
        case 'rise':
          if (has('run', 'pitch')) return (val('run') * val('pitch')) / 12;
          if (has('run', 'diag')) return leg(val('diag'), val('run'));
          if (has('diag', 'pitch')) return val('diag') * Math.sin(ang());
          break;
        case 'run':
          if (has('rise', 'pitch')) return (val('rise') * 12) / val('pitch');
          if (has('rise', 'diag')) return leg(val('diag'), val('rise'));
          if (has('diag', 'pitch')) return val('diag') * Math.cos(ang());
          break;
        case 'diag':
          if (has('rise', 'run')) return Math.hypot(val('rise'), val('run'));
          if (has('run', 'pitch')) return val('run') / Math.cos(ang());
          if (has('rise', 'pitch')) return val('rise') / Math.sin(ang());
          break;
        case 'pitch':
          if (has('rise', 'run')) return (12 * val('rise')) / val('run');
          if (has('rise', 'diag')) return (12 * val('rise')) / leg(val('diag'), val('rise'));
          if (has('run', 'diag')) return (12 * leg(val('diag'), val('run'))) / val('run');
          break;
      }
      return null;
    }

    regQuantity(k, v) {
      return k === 'pitch' ? Q(v, 0, 'pitch') : Q(v, 1, this.regUnit);
    }

    showReg(k, v, stored) {
      this.setX(stored ? this.x : this.regQuantity(k, v), 'reg');
      this.label = REG_LABEL[k];
      if (k === 'pitch') {
        const deg = (Math.atan(v / 12) * 180) / Math.PI;
        this.info = `${fmtNum(deg, 2)}° · ${fmtNum((v / 12) * 100, 1)}% grade`;
      }
      if (stored) this.info = this.info ? `stored · ${this.info}` : 'stored';
    }

    regKey(k) {
      if (k === 'pitch') this.toRegular();
      if (this.entry || this.xSource === 'calc') {
        const q = this.commitEntry();
        this.storeReg(k, q);
        if (k === 'pitch') this.x = Q(q.v, 0, 'pitch');
        return this.showReg(k, this.regs[k].v, true);
      }
      const v = this.getReg(k);
      if (v === null) throw new CalcError('Enter 2 of Rise/Run/Slope/Pitch');
      this.showReg(k, v, false);
    }

    degrees() {
      this.toRegular();
      if (this.entry) {
        const q = this.commitEntry();
        if (q.dim !== 0 || q.v <= 0 || q.v >= 90) throw new CalcError('Angle must be 0–90°');
        this.storeReg('pitch', Q((12 * Math.tan((q.v * Math.PI) / 180)), 0));
        this.x = Q(q.v, 0, 'deg');
        this.showReg('pitch', this.regs.pitch.v, true);
        this.label = 'PITCH °';
        return;
      }
      const p = this.getReg('pitch');
      if (p === null) throw new CalcError('Enter 2 of Rise/Run/Slope/Pitch');
      this.setX(Q((Math.atan(p / 12) * 180) / Math.PI, 0, 'deg'), 'reg');
      this.label = 'PITCH °';
      this.info = `${fmtNum(p, 3)}/12 pitch`;
    }

    // --- multi-press functions ---

    startCycle(key, items) {
      this.cycle = { key, idx: 0, items };
      this.showCycle();
    }

    showCycle() {
      const { items, idx } = this.cycle;
      const item = items[idx];
      this.setX(item.q, 'reg');
      this.label = item.label;
      this.info = `${idx + 1} of ${items.length} · press again for more`;
    }

    advanceCycle() {
      this.cycle.idx = (this.cycle.idx + 1) % this.cycle.items.length;
      this.showCycle();
    }

    stairs() {
      if (this.cycle) return this.advanceCycle();
      if (this.entry) this.storeReg('rise', this.commitEntry());
      const rise = this.getReg('rise');
      if (rise === null) throw new CalcError('Enter total Rise first');
      const n = Math.max(1, Math.ceil(rise / MAX_RISER - 1e-9));
      const treads = n - 1;
      const run = this.regs.run && treads ? this.regs.run.v : DEFAULT_TREAD * treads;
      const tread = treads ? run / treads : 0;
      const len = (v) => Q(v, 1, this.regUnit);
      this.startCycle('stair', [
        { label: 'RISERS', q: Q(n) },
        { label: 'RISER HT', q: len(rise / n) },
        { label: 'TREADS', q: Q(treads) },
        { label: 'TREAD', q: len(tread) },
        { label: 'STAIR RUN', q: len(run) },
        { label: 'STRINGER', q: len(Math.hypot(run, rise)) },
      ]);
    }

    circle() {
      if (this.cycle) return this.advanceCycle();
      const d = this.commitEntry();
      if (d.dim !== 1) throw new CalcError('Enter a diameter');
      const fam = family(d.unit);
      this.startCycle('circ', [
        { label: 'CIRCUMF', q: Q(Math.PI * d.v, 1, d.unit) },
        { label: 'AREA', q: Q((Math.PI * d.v * d.v) / 4, 2, defaultUnit(2, fam)) },
      ]);
    }

    // ---------- view ----------

    entryHint() {
      const e = this.entry;
      if (!e) return '';
      if (e.fis) return 'feet · inch · 16ths';
      return e.six ? 'next key = 16ths (0–15)' : '';
    }

    view() {
      const opSym = { '+': '+', '-': '−', '*': '×', '/': '÷' };
      return {
        main: this.error ? 'Error' : this.entry ? entryText(this.entry) : format(this.x, this.res),
        label: this.error ? 'ERROR' : this.label,
        info: this.error || this.entryHint() || this.info,
        mode: this.mode === 'fis' ? 'FEET' : 'DEC',
        op: this.op ? opSym[this.op] : '',
        mem: !!this.mem,
        res: `1/${this.res}`,
        regs: REG_NAMES.filter((r) => this.regs[r]),
        tape: this.tape.slice(),
      };
    }
  }

  const api = { Calculator, CalcError, format, apply, Q };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BuilderCalc = api;
})(typeof self !== 'undefined' ? self : this);
