/**
 * VotoClaro Pro — Sistema Electoral de Ánforas
 * script.js · ES6+ · Sin dependencias · 100% offline
 *
 * Módulos:
 *   Storage   — localStorage
 *   State     — estado en memoria
 *   UI        — helpers DOM
 *   Views     — renderizado por vista
 *   Events    — registro de eventos
 *   Export    — CSV y HTML
 *   App       — inicialización
 */

'use strict';

/* =========================================================
   STORAGE
   ========================================================= */
const Storage = (() => {
  const KEY = 'votoclaro_pro_v2';

  const save = (state) => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('localStorage error:', e); }
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  };

  const clear = () => { try { localStorage.removeItem(KEY); } catch (e) {} };

  return { save, load, clear };
})();

/* =========================================================
   STATE
   ========================================================= */
const State = (() => {
  let data = {
    candidates: [],  // { id, name, party }
    anforas: [],     // { id, name, location, totalEligible }
    results: {}      // { anforaId: { candidateId: votes, blancos, nulos } }
  };

  const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const persist = () => Storage.save(data);

  /* --- Candidates --- */
  const get候 = () => data.candidates;

  const addCandidate = (name, party) => {
    const n = name.trim();
    if (!n) return { ok: false, error: 'El nombre no puede estar vacío.' };
    const dup = data.candidates.some(c => c.name.toLowerCase() === n.toLowerCase());
    if (dup) return { ok: false, error: `Ya existe el candidato "${n}".` };
    const c = { id: uid(), name: n, party: party.trim() };
    data.candidates.push(c);
    persist();
    return { ok: true, candidate: c };
  };

  const editCandidate = (id, name, party) => {
    const n = name.trim();
    if (!n) return { ok: false, error: 'El nombre no puede estar vacío.' };
    const dup = data.candidates.some(c => c.name.toLowerCase() === n.toLowerCase() && c.id !== id);
    if (dup) return { ok: false, error: `Ya existe el candidato "${n}".` };
    const c = data.candidates.find(c => c.id === id);
    if (!c) return { ok: false, error: 'Candidato no encontrado.' };
    c.name = n;
    c.party = party.trim();
    persist();
    return { ok: true };
  };

  const deleteCandidate = (id) => {
    data.candidates = data.candidates.filter(c => c.id !== id);
    // Clean from results
    Object.values(data.results).forEach(r => { delete r[id]; });
    persist();
  };

  /* --- Anforas --- */
  const getAnforas = () => data.anforas;

  const addAnfora = (name, location, totalEligible) => {
    const n = name.trim();
    if (!n) return { ok: false, error: 'El nombre del ánfora no puede estar vacío.' };
    const dup = data.anforas.some(a => a.name.toLowerCase() === n.toLowerCase());
    if (dup) return { ok: false, error: `Ya existe el ánfora "${n}".` };
    const a = { id: uid(), name: n, location: location.trim(), totalEligible: parseInt(totalEligible) || 0 };
    data.anforas.push(a);
    persist();
    return { ok: true, anfora: a };
  };

  const editAnfora = (id, name, location, totalEligible) => {
    const n = name.trim();
    if (!n) return { ok: false, error: 'El nombre no puede estar vacío.' };
    const dup = data.anforas.some(a => a.name.toLowerCase() === n.toLowerCase() && a.id !== id);
    if (dup) return { ok: false, error: `Ya existe el ánfora "${n}".` };
    const a = data.anforas.find(a => a.id === id);
    if (!a) return { ok: false, error: 'Ánfora no encontrada.' };
    a.name = n;
    a.location = location.trim();
    a.totalEligible = parseInt(totalEligible) || 0;
    persist();
    return { ok: true };
  };

  const deleteAnfora = (id) => {
    data.anforas = data.anforas.filter(a => a.id !== id);
    delete data.results[id];
    persist();
  };

  /* --- Results --- */
  const getResults = () => data.results;

  const getAnforaResult = (anforaId) => data.results[anforaId] || null;

  const saveAnforaResult = (anforaId, votes) => {
    // votes: { candidateId: number, blancos: number, nulos: number }
    data.results[anforaId] = votes;
    persist();
  };

  const clearAnforaResult = (anforaId) => {
    delete data.results[anforaId];
    persist();
  };

  /* --- Stats --- */
  const getStats = () => {
    const candidates = data.candidates;
    const anforas = data.anforas;
    const results = data.results;

    const totalHabilitados = anforas.reduce((s, a) => s + a.totalEligible, 0);

    // Aggregate per candidate
    const votesByCand = {};
    candidates.forEach(c => { votesByCand[c.id] = 0; });

    let totalBlancos = 0, totalNulos = 0, totalEmitido = 0;
    let anforasProcesadas = 0;

    anforas.forEach(a => {
      const r = results[a.id];
      if (!r) return;
      anforasProcesadas++;
      totalBlancos += r.blancos || 0;
      totalNulos += r.nulos || 0;
      candidates.forEach(c => {
        votesByCand[c.id] = (votesByCand[c.id] || 0) + (r[c.id] || 0);
      });
    });

    const totalValidos = Object.values(votesByCand).reduce((s, v) => s + v, 0);
    totalEmitido = totalValidos + totalBlancos + totalNulos;

    const sorted = [...candidates]
      .map(c => ({ ...c, votes: votesByCand[c.id] || 0 }))
      .sort((a, b) => b.votes - a.votes);

    const participacion = totalHabilitados > 0 ? (totalEmitido / totalHabilitados * 100) : 0;

    const anforasFaltantes = anforas.length - anforasProcesadas;

    return {
      sorted,
      totalValidos,
      totalBlancos,
      totalNulos,
      totalEmitido,
      totalHabilitados,
      participacion,
      anforasProcesadas,
      anforasFaltantes,
      anforas,
      results,
      candidates
    };
  };

  /* --- Init --- */
  const init = () => {
    const saved = Storage.load();
    if (saved) data = { candidates: [], anforas: [], results: {}, ...saved };
  };

  const reset = () => {
    data = { candidates: [], anforas: [], results: {} };
    Storage.clear();
  };

  return {
    getCandidates: get候,
    addCandidate, editCandidate, deleteCandidate,
    getAnforas, addAnfora, editAnfora, deleteAnfora,
    getResults, getAnforaResult, saveAnforaResult, clearAnforaResult,
    getStats,
    init, reset
  };
})();

/* =========================================================
   UI HELPERS
   ========================================================= */
const UI = (() => {
  const $ = (id) => document.getElementById(id);
  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const makeTd = (content, cls) => {
    const td = document.createElement('td');
    if (cls) td.className = cls;
    if (typeof content === 'string' || typeof content === 'number') {
      td.textContent = content;
    } else if (content instanceof Node) {
      td.appendChild(content);
    }
    return td;
  };

  const showModal = (id) => $(id).classList.add('visible');
  const hideModal = (id) => $(id).classList.remove('visible');

  const setError = (id, msg) => { $(id).textContent = msg || ''; };
  const clearError = (id) => { $(id).textContent = ''; };

  const fmt = (n) => n.toLocaleString('es-BO');
  const pct = (n, total) => total > 0 ? ((n / total) * 100).toFixed(2) + '%' : '0.00%';

  const makeBar = (value, total, isGold = false) => {
    const wrap = make('div', 'bar-wrap');
    const fill = make('div', 'bar-fill');
    fill.style.background = isGold ? 'var(--gold)' : 'var(--accent)';
    fill.style.width = total > 0 ? Math.max(2, (value / total) * 100) + '%' : '0%';
    wrap.appendChild(fill);
    return wrap;
  };

  const makeStatusBadge = (anforaId) => {
    const r = State.getAnforaResult(anforaId);
    const span = make('span', 'status-badge');
    if (!r) {
      span.classList.add('badge-empty');
      span.textContent = 'Sin datos';
    } else {
      span.classList.add('badge-done');
      span.textContent = '✓ Procesada';
    }
    return span;
  };

  const makeActionBtns = (...btns) => {
    const wrap = make('div');
    btns.forEach(({ label, cls, onClick }) => {
      const b = make('button', `action-btn${cls ? ' ' + cls : ''}`, label);
      b.addEventListener('click', onClick);
      wrap.appendChild(b);
    });
    return wrap;
  };

  return { $, make, makeTd, showModal, hideModal, setError, clearError, fmt, pct, makeBar, makeStatusBadge, makeActionBtns };
})();

/* =========================================================
   VIEWS
   ========================================================= */
const Views = (() => {
  /* ---------- CANDIDATES ---------- */
  const renderCandidates = () => {
    const candidates = State.getCandidates();
    const tbody = UI.$('candidatesTbody');
    const empty = UI.$('emptyCandidates');
    tbody.innerHTML = '';

    UI.$('badgeCandidates').textContent = candidates.length;
    UI.$('countCandidates').textContent = `${candidates.length} registrado${candidates.length !== 1 ? 's' : ''}`;

    if (candidates.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    const stats = State.getStats();
    const totalValidos = stats.totalValidos;

    const sorted = [...candidates].sort((a, b) => {
      const va = stats.sorted.find(s => s.id === a.id)?.votes || 0;
      const vb = stats.sorted.find(s => s.id === b.id)?.votes || 0;
      return vb - va;
    });

    sorted.forEach((c, i) => {
      const votes = stats.sorted.find(s => s.id === c.id)?.votes || 0;
      const tr = document.createElement('tr');
      tr.className = 'new-row';
      if (i === 0 && votes > 0) tr.classList.add('rank-1-row');

      const rankEl = UI.make('span', `rank-cell${i === 0 && votes > 0 ? ' rank-1' : ''}`, i === 0 && votes > 0 ? '★ 1' : `#${i + 1}`);
      tr.appendChild(UI.makeTd(rankEl));
      tr.appendChild(UI.makeTd(c.name, 'td-name'));
      tr.appendChild(UI.makeTd(c.party || '—', 'td-muted'));
      tr.appendChild(UI.makeTd(UI.fmt(votes)));
      tr.appendChild(UI.makeTd(UI.pct(votes, totalValidos)));
      tr.appendChild(UI.makeTd(UI.makeActionBtns(
        { label: '✏ Editar', cls: 'edit', onClick: () => openEditCandidate(c) },
        { label: '✕ Eliminar', cls: 'del', onClick: () => confirmDelete('candidate', c.id, `¿Eliminar al candidato "${c.name}"?`, 'Se eliminarán también todos sus votos registrados.') }
      )));
      tbody.appendChild(tr);
    });
  };

  /* ---------- ANFORAS ---------- */
  const renderAnforas = () => {
    const anforas = State.getAnforas();
    const tbody = UI.$('anforasTbody');
    const empty = UI.$('emptyAnforas');
    tbody.innerHTML = '';

    UI.$('badgeAnforas').textContent = anforas.length;
    UI.$('countAnforas').textContent = `${anforas.length} registrada${anforas.length !== 1 ? 's' : ''}`;

    if (anforas.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    anforas.forEach((a, i) => {
      const result = State.getAnforaResult(a.id);
      const candidates = State.getCandidates();
      let votesIngresados = 0;
      if (result) {
        candidates.forEach(c => { votesIngresados += result[c.id] || 0; });
        votesIngresados += (result.blancos || 0) + (result.nulos || 0);
      }

      const tr = document.createElement('tr');
      tr.className = 'new-row';
      tr.appendChild(UI.makeTd(`#${i + 1}`, 'td-muted'));
      tr.appendChild(UI.makeTd(a.name, 'td-name'));
      tr.appendChild(UI.makeTd(a.location || '—', 'td-muted'));
      tr.appendChild(UI.makeTd(UI.fmt(a.totalEligible)));
      tr.appendChild(UI.makeTd(result ? UI.fmt(votesIngresados) : '—'));
      tr.appendChild(UI.makeTd(UI.makeStatusBadge(a.id)));
      tr.appendChild(UI.makeTd(UI.makeActionBtns(
        {
          label: '✏ Editar', cls: 'edit', onClick: () => openEditAnfora(a)
        },
        {
          label: '✕ Eliminar', cls: 'del',
          onClick: () => confirmDelete('anfora', a.id, `¿Eliminar el ánfora "${a.name}"?`, 'Se eliminarán también los votos ingresados para esta ánfora.')
        }
      )));
      tbody.appendChild(tr);
    });
  };

  /* ---------- INGRESO ---------- */
  const renderIngresoSelector = () => {
    const sel = UI.$('selectAnfora');
    const current = sel.value;
    sel.innerHTML = '<option value="">— Selecciona un ánfora —</option>';
    State.getAnforas().forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name + (a.location ? ` — ${a.location}` : '');
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  };

  const renderIngresoForm = (anforaId) => {
    const anfora = State.getAnforas().find(a => a.id === anforaId);
    const candidates = State.getCandidates();
    const ingresoForm = UI.$('ingresoForm');
    const ingresoEmpty = UI.$('ingresoEmpty');

    if (!anforaId || !anfora) {
      ingresoForm.classList.add('hidden');
      ingresoEmpty.style.display = '';
      return;
    }

    ingresoEmpty.style.display = 'none';
    ingresoForm.classList.remove('hidden');

    // Info bar
    const bar = UI.$('anforaInfoBar');
    bar.innerHTML = '';
    const items = [
      { label: 'Ánfora', value: anfora.name },
      { label: 'Ubicación', value: anfora.location || '—' },
      { label: 'Habilitados', value: UI.fmt(anfora.totalEligible) }
    ];
    items.forEach(({ label, value }) => {
      const wrap = UI.make('div', 'aib-item');
      wrap.appendChild(UI.make('div', 'aib-label', label));
      wrap.appendChild(UI.make('div', 'aib-value', value));
      bar.appendChild(wrap);
    });

    if (candidates.length === 0) {
      UI.$('voteInputsGrid').innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem">Agrega candidatos primero.</p>';
    } else {
      UI.$('voteInputsGrid').innerHTML = '';
      const existing = State.getAnforaResult(anforaId);
      candidates.forEach(c => {
        const card = UI.make('div', 'vote-input-card');
        const info = UI.make('div');
        info.appendChild(UI.make('div', 'vic-name', c.name));
        if (c.party) info.appendChild(UI.make('div', 'vic-party', c.party));
        const inp = UI.make('input', 'vic-input');
        inp.type = 'number';
        inp.min = '0';
        inp.max = '99999';
        inp.dataset.candidateId = c.id;
        inp.value = existing ? (existing[c.id] || 0) : 0;
        inp.addEventListener('input', updateComputedTotal);
        card.appendChild(info);
        card.appendChild(inp);
        UI.$('voteInputsGrid').appendChild(card);
      });
    }

    const existing = State.getAnforaResult(anforaId);
    UI.$('inpVotosBlancos').value = existing ? (existing.blancos || 0) : 0;
    UI.$('inpVotosNulos').value = existing ? (existing.nulos || 0) : 0;
    updateComputedTotal();
    renderAnforaResultCard(anforaId);
  };

  const updateComputedTotal = () => {
    let total = 0;
    document.querySelectorAll('.vic-input').forEach(inp => {
      total += parseInt(inp.value) || 0;
    });
    total += parseInt(UI.$('inpVotosBlancos').value) || 0;
    total += parseInt(UI.$('inpVotosNulos').value) || 0;
    UI.$('computedTotal').textContent = `${UI.fmt(total)} votos`;
  };

  const renderAnforaResultCard = (anforaId) => {
    const result = State.getAnforaResult(anforaId);
    const card = UI.$('anforaResultCard');
    if (!result) { card.style.display = 'none'; return; }

    card.style.display = '';
    const candidates = State.getCandidates();
    const tbody = UI.$('anforaResultTbody');
    tbody.innerHTML = '';

    let total = 0;
    candidates.forEach(c => { total += result[c.id] || 0; });

    candidates.forEach(c => {
      const v = result[c.id] || 0;
      const tr = document.createElement('tr');
      tr.appendChild(UI.makeTd(c.name, 'td-name'));
      tr.appendChild(UI.makeTd(UI.fmt(v)));
      tr.appendChild(UI.makeTd(UI.pct(v, total)));
      tbody.appendChild(tr);
    });

    // blancos/nulos
    [[result.blancos || 0, 'En Blanco'], [result.nulos || 0, 'Nulos']].forEach(([v, label]) => {
      const tr = document.createElement('tr');
      tr.appendChild(UI.makeTd(label, 'td-muted'));
      tr.appendChild(UI.makeTd(UI.fmt(v)));
      tr.appendChild(UI.makeTd('—'));
      tbody.appendChild(tr);
    });
  };

  /* ---------- STATS ---------- */
  const renderStats = () => {
    const s = State.getStats();
    const emptyResults = UI.$('emptyResults');
    const emptyBreak = UI.$('emptyBreak');

    // KPIs
    UI.$('kpiAnfTotal').textContent = s.anforas.length;
    UI.$('kpiAnfSub').textContent = `${s.anforasProcesadas} procesada${s.anforasProcesadas !== 1 ? 's' : ''}`;

    UI.$('kpiVotosValidos').textContent = UI.fmt(s.totalValidos);
    UI.$('kpiVotosValidosSub').textContent = `${UI.fmt(s.totalHabilitados)} habilitados`;

    UI.$('kpiParticipacion').textContent = s.participacion.toFixed(1) + '%';
    UI.$('kpiParticipacionSub').textContent = 'sobre habilitados';

    const leader = s.sorted[0];
    if (leader && leader.votes > 0) {
      const nm = leader.name.length > 16 ? leader.name.slice(0, 14) + '…' : leader.name;
      UI.$('kpiLider').textContent = nm;
      UI.$('kpiLiderSub').textContent = `${UI.fmt(leader.votes)} votos · ${UI.pct(leader.votes, s.totalValidos)}`;
    } else {
      UI.$('kpiLider').textContent = '—';
      UI.$('kpiLiderSub').textContent = 'Sin datos';
    }

    UI.$('kpiBlancos').textContent = UI.fmt(s.totalBlancos);
    UI.$('kpiBlancosP').textContent = UI.pct(s.totalBlancos, s.totalEmitido) + ' del emitido';
    UI.$('kpiNulos').textContent = UI.fmt(s.totalNulos);
    UI.$('kpiNulosP').textContent = UI.pct(s.totalNulos, s.totalEmitido) + ' del emitido';
    UI.$('kpiTotalEmitido').textContent = UI.fmt(s.totalEmitido);
    UI.$('kpiFaltantes').textContent = s.anforasFaltantes;

    // Results table
    const tbody = UI.$('resultsTbody');
    tbody.innerHTML = '';

    if (s.sorted.length === 0 || s.totalValidos === 0) {
      emptyResults.style.display = 'block';
    } else {
      emptyResults.style.display = 'none';
      s.sorted.forEach((c, i) => {
        const tr = document.createElement('tr');
        if (i === 0) tr.classList.add('rank-1-row');
        const rankEl = UI.make('span', `rank-cell${i === 0 ? ' rank-1' : ''}`, i === 0 ? '★ 1°' : `${i + 1}°`);
        tr.appendChild(UI.makeTd(rankEl));
        tr.appendChild(UI.makeTd(c.name, 'td-name'));
        tr.appendChild(UI.makeTd(c.party || '—', 'td-muted'));
        tr.appendChild(UI.makeTd(UI.fmt(c.votes)));
        tr.appendChild(UI.makeTd(UI.pct(c.votes, s.totalValidos)));
        tr.appendChild(UI.makeTd(UI.pct(c.votes, s.totalHabilitados)));
        tr.appendChild(UI.makeTd(UI.makeBar(c.votes, s.sorted[0]?.votes || 1, i === 0)));
        tbody.appendChild(tr);
      });
    }

    // Anfora breakdown
    const head = UI.$('anforaBreakHead');
    const bBody = UI.$('anforaBreakBody');
    head.innerHTML = '';
    bBody.innerHTML = '';

    const processedAnforas = s.anforas.filter(a => s.results[a.id]);

    if (processedAnforas.length === 0) {
      emptyBreak.style.display = 'block';
    } else {
      emptyBreak.style.display = 'none';
      // Header
      const thAnf = UI.make('th', null, 'Ánfora');
      head.appendChild(thAnf);
      s.candidates.forEach(c => {
        const th = UI.make('th', null, c.name.length > 14 ? c.name.slice(0, 12) + '…' : c.name);
        head.appendChild(th);
      });
      head.appendChild(UI.make('th', null, 'Blanco'));
      head.appendChild(UI.make('th', null, 'Nulos'));
      head.appendChild(UI.make('th', null, 'Total'));

      processedAnforas.forEach(a => {
        const r = s.results[a.id];
        const tr = document.createElement('tr');
        tr.appendChild(UI.makeTd(a.name, 'td-name'));
        let rowTotal = 0;
        s.candidates.forEach(c => {
          const v = r[c.id] || 0;
          rowTotal += v;
          tr.appendChild(UI.makeTd(UI.fmt(v)));
        });
        const blancos = r.blancos || 0;
        const nulos = r.nulos || 0;
        rowTotal += blancos + nulos;
        tr.appendChild(UI.makeTd(UI.fmt(blancos)));
        tr.appendChild(UI.makeTd(UI.fmt(nulos)));
        tr.appendChild(UI.makeTd(UI.fmt(rowTotal)));
        bBody.appendChild(tr);
      });
    }
  };

  /* ---------- Edit modals ---------- */
  const openEditCandidate = (c) => {
    UI.$('editCandId').value = c.id;
    UI.$('editCandName').value = c.name;
    UI.$('editCandParty').value = c.party || '';
    UI.clearError('errEditCand');
    UI.showModal('modalEditCand');
  };

  const openEditAnfora = (a) => {
    UI.$('editAnfId').value = a.id;
    UI.$('editAnfName').value = a.name;
    UI.$('editAnfLoc').value = a.location || '';
    UI.$('editAnfTotal').value = a.totalEligible || 0;
    UI.clearError('errEditAnf');
    UI.showModal('modalEditAnf');
  };

  /* ---------- Confirm delete ---------- */
  let _pendingDelete = null;

  const confirmDelete = (type, id, title, msg) => {
    UI.$('confirmTitle').textContent = title;
    UI.$('confirmMsg').textContent = msg;
    _pendingDelete = { type, id };
    UI.showModal('modalConfirm');
  };

  const executePendingDelete = () => {
    if (!_pendingDelete) return;
    const { type, id } = _pendingDelete;
    if (type === 'candidate') State.deleteCandidate(id);
    if (type === 'anfora') State.deleteAnfora(id);
    _pendingDelete = null;
    UI.hideModal('modalConfirm');
    renderAll();
  };

  /* ---------- Render all ---------- */
  const renderAll = () => {
    renderCandidates();
    renderAnforas();
    renderIngresoSelector();
    const selVal = UI.$('selectAnfora').value;
    if (selVal) renderIngresoForm(selVal);
    renderStats();
  };

  return {
    renderCandidates, renderAnforas, renderIngresoSelector,
    renderIngresoForm, updateComputedTotal, renderAnforaResultCard,
    renderStats, renderAll,
    openEditCandidate, openEditAnfora,
    executePendingDelete
  };
})();

/* =========================================================
   EXPORT
   ========================================================= */
const Export = (() => {

  const esc = (str) => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const toPDF = () => {
    const s = State.getStats();
    const d = new Date().toLocaleString('es-BO');
    const maxVotes = s.sorted[0]?.votes || 1;

    /* ---- KPI boxes ---- */
    const kpis = [
      { label: 'Ánforas Totales',    value: s.anforas.length,              sub: `${s.anforasProcesadas} procesadas`, cls: '' },
      { label: 'Votos Válidos',       value: UI.fmt(s.totalValidos),        sub: `${UI.fmt(s.totalHabilitados)} habilitados`, cls: 'accent' },
      { label: 'Participación',       value: s.participacion.toFixed(1)+'%', sub: 'sobre habilitados', cls: '' },
      { label: 'Candidato Líder',     value: esc(s.sorted[0]?.name || '—'), sub: `${UI.fmt(s.sorted[0]?.votes||0)} votos · ${UI.pct(s.sorted[0]?.votes||0, s.totalValidos)}`, cls: 'gold' },
      { label: 'Votos en Blanco',     value: UI.fmt(s.totalBlancos),        sub: UI.pct(s.totalBlancos, s.totalEmitido)+' del emitido', cls: '' },
      { label: 'Votos Nulos',         value: UI.fmt(s.totalNulos),          sub: UI.pct(s.totalNulos, s.totalEmitido)+' del emitido', cls: '' },
      { label: 'Total Emitido',       value: UI.fmt(s.totalEmitido),        sub: 'válidos + blancos + nulos', cls: '' },
      { label: 'Ánforas Pendientes',  value: s.anforasFaltantes,            sub: 'sin procesar', cls: s.anforasFaltantes > 0 ? 'warn' : '' },
    ];

    const kpiHTML = kpis.map(k => `
      <div class="kpi ${k.cls}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-sub">${k.sub}</div>
      </div>`).join('');

    /* ---- Results rows ---- */
    const resultRows = s.sorted.map((c, i) => {
      const barW = maxVotes > 0 ? Math.max(2, Math.round((c.votes / maxVotes) * 100)) : 0;
      const isLeader = i === 0 && c.votes > 0;
      return `
        <tr class="${isLeader ? 'leader-row' : ''}">
          <td class="rank ${isLeader ? 'rank-gold' : ''}">${isLeader ? '★ 1°' : `${i+1}°`}</td>
          <td class="name">${esc(c.name)}</td>
          <td class="muted">${esc(c.party || '—')}</td>
          <td class="num">${UI.fmt(c.votes)}</td>
          <td class="num">${UI.pct(c.votes, s.totalValidos)}</td>
          <td class="num">${UI.pct(c.votes, s.totalHabilitados)}</td>
          <td class="bar-cell">
            <div class="bar-wrap"><div class="bar-fill ${isLeader ? 'bar-gold' : ''}" style="width:${barW}%"></div></div>
            <span class="bar-pct">${UI.pct(c.votes, s.totalValidos)}</span>
          </td>
        </tr>`;
    }).join('');

    /* ---- Anfora breakdown ---- */
    const processedAnforas = s.anforas.filter(a => s.results[a.id]);
    let anforaSection = '';
    if (processedAnforas.length > 0) {
      const candHeaders = s.candidates.map(c => `<th>${esc(c.name.length > 12 ? c.name.slice(0,11)+'…' : c.name)}</th>`).join('');
      const anforaRows = processedAnforas.map(a => {
        const r = s.results[a.id];
        let rowTotal = 0;
        const cells = s.candidates.map(c => {
          const v = r[c.id] || 0; rowTotal += v;
          return `<td class="num">${UI.fmt(v)}</td>`;
        }).join('');
        const b = r.blancos || 0, n = r.nulos || 0;
        rowTotal += b + n;
        return `<tr>
          <td class="name">${esc(a.name)}</td>
          <td class="muted">${esc(a.location || '—')}</td>
          ${cells}
          <td class="num">${UI.fmt(b)}</td>
          <td class="num">${UI.fmt(n)}</td>
          <td class="num bold">${UI.fmt(rowTotal)}</td>
        </tr>`;
      }).join('');

      anforaSection = `
        <div class="section-break">
          <h2>Detalle por Ánfora</h2>
          <table>
            <thead><tr>
              <th>Ánfora</th><th>Ubicación</th>
              ${candHeaders}
              <th>Blanco</th><th>Nulos</th><th>Total</th>
            </tr></thead>
            <tbody>${anforaRows}</tbody>
          </table>
        </div>`;
    }

    /* ---- Full HTML document ---- */
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Reporte Electoral — VotoClaro Pro</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Outfit', 'Segoe UI', Arial, sans-serif;
      background: #fff;
      color: #13162a;
      font-size: 11pt;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page { max-width: 210mm; margin: 0 auto; padding: 14mm 14mm 10mm; }

    /* --- Header --- */
    .report-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding-bottom: 12px;
      border-bottom: 2px solid #2153e8;
      margin-bottom: 20px;
    }
    .report-logo { display: flex; align-items: center; gap: 10px; }
    .logo-hex { font-size: 28px; color: #2153e8; line-height: 1; }
    .logo-text-main { font-size: 16pt; font-weight: 700; color: #0e1229; letter-spacing: -0.02em; }
    .logo-text-sub { font-size: 7.5pt; color: #5c6282; text-transform: uppercase; letter-spacing: 0.06em; }
    .report-meta { text-align: right; }
    .report-title { font-size: 13pt; font-weight: 700; color: #0e1229; }
    .report-date { font-size: 8pt; color: #5c6282; margin-top: 3px; }

    /* --- KPI Grid --- */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 20px;
    }
    .kpi {
      border: 1px solid #e2e4ec;
      border-radius: 8px;
      padding: 10px 12px;
      background: #f8f9fc;
    }
    .kpi.accent { background: #2153e8; border-color: #1440c4; }
    .kpi.gold { background: linear-gradient(135deg, #fdf6e3, #fef9ee); border-color: #e8d89a; }
    .kpi.warn { background: #fff8ed; border-color: #f0d080; }
    .kpi-label {
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #5c6282;
      margin-bottom: 5px;
    }
    .kpi.accent .kpi-label { color: rgba(255,255,255,0.75); }
    .kpi.gold .kpi-label { color: #a07010; }
    .kpi-value {
      font-size: 16pt;
      font-weight: 700;
      color: #0e1229;
      line-height: 1;
      margin-bottom: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .kpi.accent .kpi-value { color: #fff; }
    .kpi.gold .kpi-value { color: #b07800; }
    .kpi-sub { font-size: 7pt; color: #6b7491; }
    .kpi.accent .kpi-sub { color: rgba(255,255,255,0.65); }

    /* --- Section titles --- */
    h2 {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #5c6282;
      margin-bottom: 8px;
      padding-bottom: 5px;
      border-bottom: 1px solid #e2e4ec;
    }

    /* --- Tables --- */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-bottom: 6px;
    }
    thead tr { background: #f0f1f6; }
    th {
      text-align: left;
      padding: 7px 10px;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #5c6282;
      border-bottom: 2px solid #e2e4ec;
      white-space: nowrap;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #eef0f6;
      vertical-align: middle;
    }
    tr:last-child td { border-bottom: none; }
    tr.leader-row { background: #fffdf0; }

    td.rank { font-weight: 700; color: #8890aa; font-size: 8.5pt; white-space: nowrap; }
    td.rank-gold { color: #c9920a !important; }
    td.name { font-weight: 600; }
    td.muted { color: #6b7491; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    td.bold { font-weight: 700; }

    /* Bar */
    td.bar-cell { min-width: 90px; }
    .bar-wrap {
      background: #eef0f6;
      border-radius: 99px;
      height: 6px;
      overflow: hidden;
      display: inline-block;
      width: 70px;
      vertical-align: middle;
    }
    .bar-fill {
      height: 100%;
      border-radius: 99px;
      background: #2153e8;
      display: block;
    }
    .bar-fill.bar-gold { background: #c9920a; }
    .bar-pct {
      font-size: 7.5pt;
      color: #6b7491;
      margin-left: 5px;
      vertical-align: middle;
    }

    /* --- Separator --- */
    .section-break { margin-top: 20px; }

    /* --- Footer --- */
    .report-footer {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #e2e4ec;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-left { font-size: 7.5pt; color: #a0a6bf; }
    .footer-right { font-size: 7.5pt; color: #a0a6bf; text-align: right; }

    /* --- Print button (screen only) --- */
    .print-bar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #0e1229;
      color: #fff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      z-index: 999;
      font-size: 13px;
      font-family: 'Outfit', 'Segoe UI', sans-serif;
    }
    .print-bar-info { color: rgba(255,255,255,0.7); font-size: 12px; }
    .print-btn {
      background: #2153e8;
      color: #fff;
      border: none;
      border-radius: 7px;
      padding: 9px 22px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      letter-spacing: 0.01em;
    }
    .print-btn:hover { background: #1440c4; }
    .close-btn {
      background: rgba(255,255,255,0.1);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 7px;
      padding: 9px 16px;
      font-size: 13px;
      cursor: pointer;
      font-family: inherit;
    }
    .close-btn:hover { background: rgba(255,255,255,0.18); }

    @media screen {
      body { background: #e8eaf0; padding-top: 56px; }
      .page {
        background: #fff;
        box-shadow: 0 4px 32px rgba(0,0,0,0.12);
        margin: 20px auto 40px;
        border-radius: 6px;
      }
    }

    @media print {
      .print-bar { display: none !important; }
      body { background: #fff; padding-top: 0; }
      .page { padding: 10mm; box-shadow: none; border-radius: 0; }
      .section-break { page-break-inside: avoid; }
      table { page-break-inside: auto; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <div class="print-bar">
    <span>⬡ <strong>VotoClaro Pro</strong> — Reporte Electoral</span>
    <span class="print-bar-info">Usa "Guardar como PDF" en el diálogo de impresión para exportar el archivo</span>
    <div style="display:flex;gap:10px">
      <button class="close-btn" onclick="window.close()">✕ Cerrar</button>
      <button class="print-btn" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
    </div>
  </div>

  <div class="page">

    <div class="report-header">
      <div class="report-logo">
        <div class="logo-hex">⬡</div>
        <div>
          <div class="logo-text-main">VotoClaro Pro</div>
          <div class="logo-text-sub">Sistema Electoral de Ánforas</div>
        </div>
      </div>
      <div class="report-meta">
        <div class="report-title">Reporte Electoral Oficial</div>
        <div class="report-date">Generado: ${d}</div>
      </div>
    </div>

    <div class="kpi-grid">${kpiHTML}</div>

    <h2>Resultados por Candidato</h2>
    <table>
      <thead>
        <tr>
          <th>Pos.</th>
          <th>Candidato</th>
          <th>Partido / Lista</th>
          <th style="text-align:right">Votos</th>
          <th style="text-align:right">% Válidos</th>
          <th style="text-align:right">% Habilitados</th>
          <th>Proporción</th>
        </tr>
      </thead>
      <tbody>${resultRows}</tbody>
    </table>

    ${anforaSection}

    <div class="report-footer">
      <div class="footer-left">
        VotoClaro Pro · Documento generado automáticamente · Uso oficial exclusivo
      </div>
      <div class="footer-right">
        Total emitido: ${UI.fmt(s.totalEmitido)} ·
        Habilitados: ${UI.fmt(s.totalHabilitados)} ·
        Participación: ${s.participacion.toFixed(2)}%
      </div>
    </div>

  </div>

  <script>
    // Auto-trigger print dialog after fonts load
    window.addEventListener('load', () => {
      setTimeout(() => {
        // Don't auto-print, let user click the button
      }, 300);
    });
  </script>

</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) {
      alert('El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para este archivo y vuelve a intentarlo.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return { toPDF };
})();

/* =========================================================
   EVENTS
   ========================================================= */
const Events = (() => {
  const $ = UI.$;

  const init = () => {
    /* --- Mobile menu setup (MUST be defined first) --- */
    const sidebar = $('sidebar');
    const backdrop = $('sidebarBackdrop');
    const menuBtn = $('menuBtn');

    const openSidebar = () => {
      sidebar.classList.add('open');
      backdrop.classList.add('active');
      document.body.style.overflow = 'hidden';
    };

    const closeSidebar = () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
      document.body.style.overflow = '';
    };

    // Use both click and touchend for maximum mobile compatibility
    const handleMenuBtn = (e) => {
      e.preventDefault();
      e.stopPropagation();
      sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    };

    menuBtn.addEventListener('click', handleMenuBtn);
    menuBtn.addEventListener('touchend', handleMenuBtn, { passive: false });

    backdrop.addEventListener('click', closeSidebar);
    backdrop.addEventListener('touchend', (e) => { e.preventDefault(); closeSidebar(); }, { passive: false });

    /* --- Navigation --- */
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        const view = $(`view-${btn.dataset.view}`);
        if (view) view.classList.add('active');
        if (btn.dataset.view === 'stats') Views.renderStats();
        closeSidebar();
      });
    });

    /* --- Add Candidate --- */
    $('formCandidate').addEventListener('submit', (e) => {
      e.preventDefault();
      UI.clearError('errCandidate');
      const name = $('inpCandName').value;
      const party = $('inpCandParty').value;
      const result = State.addCandidate(name, party);
      if (!result.ok) { UI.setError('errCandidate', result.error); return; }
      $('inpCandName').value = '';
      $('inpCandParty').value = '';
      $('inpCandName').focus();
      Views.renderCandidates();
      Views.renderIngresoSelector();
    });

    /* --- Add Anfora --- */
    $('formAnfora').addEventListener('submit', (e) => {
      e.preventDefault();
      UI.clearError('errAnfora');
      const name = $('inpAnfName').value;
      const loc = $('inpAnfLocation').value;
      const total = $('inpAnfTotal').value;
      const result = State.addAnfora(name, loc, total);
      if (!result.ok) { UI.setError('errAnfora', result.error); return; }
      $('inpAnfName').value = '';
      $('inpAnfLocation').value = '';
      $('inpAnfTotal').value = '';
      $('inpAnfName').focus();
      Views.renderAnforas();
      Views.renderIngresoSelector();
    });

    /* --- Select Anfora for ingreso --- */
    $('selectAnfora').addEventListener('change', (e) => {
      Views.renderIngresoForm(e.target.value);
    });

    /* --- Live compute total --- */
    $('inpVotosBlancos').addEventListener('input', Views.updateComputedTotal);
    $('inpVotosNulos').addEventListener('input', Views.updateComputedTotal);

    /* --- Save ingreso --- */
    $('btnSaveIngreso').addEventListener('click', () => {
      UI.clearError('errIngreso');
      const anforaId = $('selectAnfora').value;
      if (!anforaId) { UI.setError('errIngreso', 'Selecciona un ánfora.'); return; }

      const votes = {};
      let total = 0;
      let valid = true;

      document.querySelectorAll('.vic-input').forEach(inp => {
        const v = parseInt(inp.value);
        if (isNaN(v) || v < 0) { valid = false; return; }
        votes[inp.dataset.candidateId] = v;
        total += v;
      });

      if (!valid) { UI.setError('errIngreso', 'Los votos deben ser números enteros no negativos.'); return; }

      votes.blancos = parseInt($('inpVotosBlancos').value) || 0;
      votes.nulos = parseInt($('inpVotosNulos').value) || 0;
      total += votes.blancos + votes.nulos;

      const anfora = State.getAnforas().find(a => a.id === anforaId);
      if (anfora && anfora.totalEligible > 0 && total > anfora.totalEligible) {
        UI.setError('errIngreso', `⚠ El total de votos (${UI.fmt(total)}) supera los electores habilitados (${UI.fmt(anfora.totalEligible)}). Verifica los datos.`);
        return;
      }

      State.saveAnforaResult(anforaId, votes);
      Views.renderAnforaResultCard(anforaId);
      Views.renderAnforas();
      Views.renderStats();
      UI.setError('errIngreso', '');
      // Show success feedback
      const btn = $('btnSaveIngreso');
      const orig = btn.textContent;
      btn.textContent = '✓ Guardado';
      btn.classList.add('btn-success');
      btn.classList.remove('btn-primary');
      setTimeout(() => {
        btn.textContent = orig;
        btn.classList.remove('btn-success');
        btn.classList.add('btn-primary');
      }, 2000);
    });

    /* --- Clear ingreso --- */
    $('btnClearIngreso').addEventListener('click', () => {
      document.querySelectorAll('.vic-input').forEach(inp => { inp.value = 0; });
      $('inpVotosBlancos').value = 0;
      $('inpVotosNulos').value = 0;
      Views.updateComputedTotal();
    });

    /* --- Edit ingreso (re-enable form) --- */
    $('btnEditAnfora').addEventListener('click', () => {
      $('anforaResultCard').style.display = 'none';
    });

    /* --- Edit candidate save --- */
    $('btnSaveEditCand').addEventListener('click', () => {
      UI.clearError('errEditCand');
      const id = $('editCandId').value;
      const result = State.editCandidate(id, $('editCandName').value, $('editCandParty').value);
      if (!result.ok) { UI.setError('errEditCand', result.error); return; }
      UI.hideModal('modalEditCand');
      Views.renderAll();
    });

    /* --- Edit anfora save --- */
    $('btnSaveEditAnf').addEventListener('click', () => {
      UI.clearError('errEditAnf');
      const id = $('editAnfId').value;
      const result = State.editAnfora(id, $('editAnfName').value, $('editAnfLoc').value, $('editAnfTotal').value);
      if (!result.ok) { UI.setError('errEditAnf', result.error); return; }
      UI.hideModal('modalEditAnf');
      Views.renderAll();
    });

    /* --- Confirm delete execute --- */
    $('confirmActionBtn').addEventListener('click', Views.executePendingDelete);

    /* --- Reset all --- */
    $('resetAllBtn').addEventListener('click', () => {
      $('confirmTitle').textContent = '¿Reiniciar todo el sistema?';
      $('confirmMsg').textContent = 'Esta acción eliminará todos los candidatos, ánforas y votos registrados. No se puede deshacer.';
      // special flag
      $('confirmActionBtn').dataset.action = 'resetAll';
      UI.showModal('modalConfirm');
    });

    $('confirmActionBtn').addEventListener('click', () => {
      if ($('confirmActionBtn').dataset.action === 'resetAll') {
        State.reset();
        $('confirmActionBtn').dataset.action = '';
        UI.hideModal('modalConfirm');
        Views.renderAll();
        $('selectAnfora').value = '';
        Views.renderIngresoForm('');
      }
    });

    /* --- Close modals --- */
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => UI.hideModal(btn.dataset.close));
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) UI.hideModal(overlay.id);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.visible').forEach(m => UI.hideModal(m.id));
        closeSidebar();
      }
    });

    /* --- Export --- */
    $('btnExportPDF').addEventListener('click', Export.toPDF);

    /* --- Clear errors on input --- */
    document.querySelectorAll('.input').forEach(inp => {
      inp.addEventListener('input', () => UI.clearError('errCandidate'));
    });
  };

  return { init };
})();

/* =========================================================
   APP
   ========================================================= */
const App = (() => {
  const init = () => {
    State.init();
    Views.renderAll();
    Events.init();
  };
  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);