import { $, REDUCED } from './util';
import { page } from './audio';

function typeInto(el: HTMLElement & { _t?: number }, text: string, speed = 32, done?: () => void) {
  clearInterval(el._t); el.textContent = '';
  if (REDUCED) { el.textContent = text; done?.(); return; }
  let i = 0; el._t = window.setInterval(() => { i++; el.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(el._t); done?.(); } }, speed);
}

let capTimer = 0;
/** A line in the hiker's voice at the bottom of the screen. */
export function caption(text: string, secs = 5) {
  const el = $('#caption'); clearTimeout(capTimer);
  if (!text) { el.style.opacity = '0'; return; }
  el.style.opacity = '1'; typeInto(el, text);
  capTimer = window.setTimeout(() => { el.style.opacity = '0'; }, secs * 1000 + text.length * 32);
}

let toastTimer = 0;
export function toast(label: string, html: string, secs = 5.5) {
  $('#toastLab').textContent = label; $('#toastText').innerHTML = html; $('#toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => $('#toast').classList.remove('show'), secs * 1000);
  page();
}

export function prompt(text: string | null) { const el = $('#prompt'); if (!text) { el.hidden = true; return; } el.hidden = false; el.innerHTML = text; }

export function hud(day: number, clock: string, energy: number, lamp: boolean, moon: string) {
  $('#day').textContent = 'Day ' + day; $('#clock').textContent = clock; $('#moonTxt').textContent = moon;
  document.querySelectorAll('#energy i').forEach((e, i) => e.classList.toggle('off', i >= Math.ceil(energy / 20)));
  const l = $('#lamp'); l.textContent = '· Headlamp ' + (lamp ? 'on' : 'off'); l.classList.toggle('on', lamp);
}

/* ---------- conversations ---------- */
export interface Topic { q: string; lines: [string, string][]; reveal?: boolean; note?: string }
export interface Conversation { unknown: string; name: string; open: [string, string][]; topics: Topic[]; ask: number; close: [string, string][]; nameKnown?: boolean; onEnd?: (asked: Topic[]) => void }

export const dialog = {
  active: false,
  next: null as null | (() => void),
  key: null as null | ((e: KeyboardEvent) => void),
  show(who: string, line: string, done?: () => void) { $('#dialog').hidden = false; $('#dWho').textContent = who; $('#dChoices').innerHTML = ''; typeInto($('#dLine'), line, 28, done); },
  hide() { $('#dialog').hidden = true; dialog.next = null; dialog.key = null; $('#dHint').hidden = true; dialog.active = false; },
  /** Play lines one after another: each moves on once read, or at once on a click, Enter or Space. */
  lines(lines: [string, string, (() => void)?][], onEnd: () => void) {
    let i = -1, timer = 0;
    const read = (t: string) => 1400 + t.length * 40;
    const next = () => {
      clearTimeout(timer); i++;
      if (i >= lines.length) { dialog.next = null; $('#dHint').hidden = true; onEnd(); return; }
      const [who, text, cb] = lines[i]; cb?.();
      dialog.show(who, text, () => { timer = window.setTimeout(next, read(text)); });
      $('#dHint').hidden = false;
      dialog.next = () => { const el = $('#dLine') as HTMLElement & { _t?: number }; if (el.textContent!.length < text.length) { clearInterval(el._t); el.textContent = text; clearTimeout(timer); timer = window.setTimeout(next, read(text)); } else next(); };
    };
    next();
  },
  /** Offer questions. No timer: the game waits for you. Choosing continues at once. */
  choices(qs: string[], onPick: (i: number) => void) {
    const box = $('#dChoices'); box.innerHTML = ''; dialog.next = null; $('#dHint').hidden = true;
    let done = false;
    const pick = (i: number) => { if (done) return; done = true; dialog.key = null; onPick(i); };
    qs.forEach((q, i) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = '<kbd>' + (i + 1) + '</kbd>' + q; b.addEventListener('click', ev => { ev.stopPropagation(); pick(i); }); box.appendChild(b); });
    dialog.key = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= qs.length) pick(n - 1); };
  },
  /** A whole conversation: an opening, a few questions to choose from, a goodbye. */
  run(c: Conversation, onDone: () => void) {
    dialog.active = true;
    const who = () => (c.nameKnown ? c.name : c.unknown);
    const asked: Topic[] = [];
    const ask = () => {
      const left = c.topics.filter(t => !asked.includes(t));
      if (asked.length >= c.ask || !left.length) { closeOut(); return; }
      $('#dialog').hidden = false; $('#dWho').textContent = who();
      dialog.choices([...left.map(t => t.q), 'That’s all, thanks.'], i => {
        if (i >= left.length) { closeOut(); return; }
        const t = left[i]; asked.push(t);
        dialog.lines([['You', t.q], ...t.lines.map(([w, l]) => [w === '*' ? who() : w, l, () => { if (t.reveal && l.includes(c.name)) c.nameKnown = true; }] as [string, string, () => void])], ask);
      });
    };
    const closeOut = () => dialog.lines(c.close.map(([w, l]) => [w === '*' ? who() : w, l, () => { if (l.includes(c.name)) c.nameKnown = true; }]), () => { dialog.hide(); c.onEnd?.(asked); onDone(); });
    dialog.lines(c.open.map(([w, l]) => [w === '*' ? who() : w, l]), ask);
  }
};
$('#dialog').addEventListener('click', e => { if (dialog.next && !(e.target as HTMLElement).closest('button')) dialog.next(); });

/* ---------- the journal ---------- */
export interface Entry { kind: 'People' | 'Animals' | 'Noticed'; title: string; text: string; time: string }
export const journal: Entry[] = [];
export function addEntry(e: Entry, quiet = false) {
  journal.push(e);
  if (!quiet) toast('New in your journal', '<b>' + e.title + '</b>, ' + e.text);
}
export function openJournal(open: boolean) {
  const el = $('#journal'); el.hidden = !open; if (!open) return;
  page();
  const body = $('#jBody'); body.innerHTML = '';
  (['People', 'Animals', 'Noticed'] as const).forEach(k => {
    const list = journal.filter(e => e.kind === k);
    const sec = document.createElement('section');
    sec.innerHTML = '<h3>' + k + '</h3>' + (list.length ? list.map(e => '<p><span class="jt">' + e.time + '</span> <b>' + e.title + '</b>, ' + e.text + '</p>').join('') : '<p class="empty">Nothing yet.</p>');
    body.appendChild(sec);
  });
}
