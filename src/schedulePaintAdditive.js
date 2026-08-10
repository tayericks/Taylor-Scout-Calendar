// Allows Prep and Strike schedule paint to extend an existing range instead of replacing it.
// Kept separate from the core Calendar editor so the existing assignment workflow stays stable.
(() => {
  let drag = null;
  const saved = { prep: null, strike: null };

  const dateInRange = (date, start, end) => !!date && !!start && !!end && date >= start && date <= end;
  const rangeLabel = (start, end) => {
    if (!start || !end) return '—';
    const fmt = s => {
      const [y,m,d] = s.split('-').map(Number);
      return new Date(y,m-1,d).toLocaleDateString('en-US',{month:'short',day:'numeric'});
    };
    return start === end ? fmt(start) : `${fmt(start)}–${fmt(end)}`;
  };

  function getActiveTool() {
    return document.querySelector('#schedulePanel .paint-tool.active')?.dataset.tool || '';
  }

  function hidden(kind, side) {
    return document.querySelector(`#f_${kind}${side}`);
  }

  function captureRanges() {
    for (const kind of ['prep','strike']) {
      const start = hidden(kind,'Start')?.value || '';
      const end = hidden(kind,'End')?.value || start;
      if (start) saved[kind] = { start, end };
    }
  }

  function refreshDayLabels(panel) {
    panel.querySelectorAll('.paint-day').forEach(day => {
      const kinds = [];
      if (day.classList.contains('is-prep')) kinds.push('P');
      if (day.classList.contains('is-shoot')) kinds.push('S');
      if (day.classList.contains('is-hold')) kinds.push('H');
      if (day.classList.contains('is-strike')) kinds.push('S');
      const small = day.querySelector('small');
      if (small) small.textContent = kinds.join('');
    });
  }

  function applySavedRange(kind) {
    const r = saved[kind];
    const panel = document.querySelector('#schedulePanel');
    if (!r || !panel) return;
    const startInput = hidden(kind,'Start');
    const endInput = hidden(kind,'End');
    if (startInput) startInput.value = r.start;
    if (endInput) endInput.value = r.end;
    panel.querySelectorAll('.paint-day').forEach(day => {
      if (dateInRange(day.dataset.date, r.start, r.end)) day.classList.add(`is-${kind}`);
    });
    const summary = [...panel.querySelectorAll('.schedule-summary span')].find(x => x.querySelector('strong')?.textContent?.toLowerCase().startsWith(kind));
    if (summary) summary.innerHTML = `<strong>${kind}:</strong> ${rangeLabel(r.start,r.end)}`;
    refreshDayLabels(panel);
  }

  function restoreRanges() {
    applySavedRange('prep');
    applySavedRange('strike');
  }

  document.addEventListener('click', e => {
    const tool = e.target.closest('#schedulePanel .paint-tool');
    if (!tool) return;
    captureRanges();
    setTimeout(restoreRanges, 0);
  }, true);

  document.addEventListener('pointerdown', e => {
    const day = e.target.closest('#schedulePanel .paint-day');
    if (!day) return;
    const tool = getActiveTool();
    if (tool !== 'prep' && tool !== 'strike') return;
    captureRanges();
    drag = { kind: tool, start: day.dataset.date };
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  document.addEventListener('pointerup', e => {
    if (!drag) return;
    const day = e.target.closest('#schedulePanel .paint-day');
    if (!day) { drag = null; return; }
    const kind = drag.kind;
    const a = drag.start;
    const b = day.dataset.date;
    const newStart = a < b ? a : b;
    const newEnd = a < b ? b : a;
    const old = saved[kind];
    saved[kind] = {
      start: old?.start && old.start < newStart ? old.start : newStart,
      end: old?.end && old.end > newEnd ? old.end : newEnd
    };
    drag = null;
    restoreRanges();
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  // When an assignment editor opens, remember whatever range it already has.
  document.addEventListener('click', e => {
    if (e.target.closest('#addEventBtn,.add-day,.edit-summary,.event')) {
      setTimeout(() => { captureRanges(); restoreRanges(); }, 0);
    }
  });
})();
