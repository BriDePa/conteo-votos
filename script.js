/**
 * VotoClaro Pro — Sistema Electoral de Ánforas
 * script.js · ES6+ · Sin dependencias · 100% offline
 */
'use strict';

/* ════════════════════════════════════════════════════════
   STORAGE
════════════════════════════════════════════════════════ */
const Storage = (() => {
  const KEY = 'vc_pro_v3';
  const save  = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch(e){} };
  const load  = ()  => { try { const r=localStorage.getItem(KEY); return r?JSON.parse(r):null; } catch(e){return null;} };
  const clear = ()  => { try { localStorage.removeItem(KEY); } catch(e){} };
  return { save, load, clear };
})();

/* ════════════════════════════════════════════════════════
   STATE
════════════════════════════════════════════════════════ */
const State = (() => {
  // anforas: { id, num, recinto, ubicacion, enc1, enc2, habilitados }
  // candidates: { id, name, party, alias, color }
  // results: { anforaId: { [candId]: n, blancos: n, nulos: n } }
  let D = { candidates: [], anforas: [], results: {} };

  const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const persist = () => Storage.save(D);

  /* ── Candidates ── */
  const getCandidates = () => D.candidates;

  const addCandidate = (name, party, alias, color) => {
    const n = name.trim();
    if (!n) return { ok:false, error:'El nombre no puede estar vacío.' };
    if (D.candidates.some(c => c.name.toLowerCase()===n.toLowerCase()))
      return { ok:false, error:`Ya existe "${n}".` };
    const c = { id:uid(), name:n, party:party.trim(), alias:alias.trim(), color: color||'#5b8def' };
    D.candidates.push(c);
    persist();
    return { ok:true, candidate:c };
  };

  const editCandidate = (id, name, party, alias, color) => {
    const n = name.trim();
    if (!n) return { ok:false, error:'El nombre no puede estar vacío.' };
    if (D.candidates.some(c => c.name.toLowerCase()===n.toLowerCase() && c.id!==id))
      return { ok:false, error:`Ya existe "${n}".` };
    const c = D.candidates.find(c=>c.id===id);
    if (!c) return { ok:false, error:'No encontrado.' };
    c.name=n; c.party=party.trim(); c.alias=alias.trim(); c.color=color||c.color;
    persist();
    return { ok:true };
  };

  const deleteCandidate = id => {
    D.candidates = D.candidates.filter(c=>c.id!==id);
    Object.values(D.results).forEach(r=>delete r[id]);
    persist();
  };

  /* ── Anforas ── */
  const getAnforas = () => D.anforas;

  const addAnfora = (num, recinto, ubicacion, enc1, enc2, habilitados) => {
    const n = num.trim(), r = recinto.trim();
    if (!n) return { ok:false, error:'El número de ánfora no puede estar vacío.' };
    if (!r) return { ok:false, error:'El recinto no puede estar vacío.' };
    if (!enc1.trim()) return { ok:false, error:'El Encargado 1 es obligatorio.' };
    if (D.anforas.some(a => a.num===n && a.recinto.toLowerCase()===r.toLowerCase()))
      return { ok:false, error:`Ya existe el ánfora "${n}" en "${r}".` };
    const a = { id:uid(), num:n, recinto:r, ubicacion:ubicacion.trim(), enc1:enc1.trim(), enc2:enc2.trim(), habilitados:parseInt(habilitados)||0 };
    D.anforas.push(a);
    persist();
    return { ok:true, anfora:a };
  };

  const editAnfora = (id, num, recinto, ubicacion, enc1, enc2, habilitados) => {
    const r = recinto.trim();
    if (!r) return { ok:false, error:'El recinto no puede estar vacío.' };
    const a = D.anforas.find(a=>a.id===id);
    if (!a) return { ok:false, error:'No encontrada.' };
    a.num=num.trim(); a.recinto=r; a.ubicacion=ubicacion.trim();
    a.enc1=enc1.trim(); a.enc2=enc2.trim(); a.habilitados=parseInt(habilitados)||0;
    persist();
    return { ok:true };
  };

  const deleteAnfora = id => {
    D.anforas = D.anforas.filter(a=>a.id!==id);
    delete D.results[id];
    persist();
  };

  /* ── Results ── */
  const getResult   = anforaId => D.results[anforaId] || null;
  const saveResult  = (anforaId, votes) => { D.results[anforaId]=votes; persist(); };
  const clearResult = anforaId => { delete D.results[anforaId]; persist(); };

  /* ── Stats ── */
  const getStats = () => {
    const cands = D.candidates, anforas = D.anforas, results = D.results;
    const totalHab = anforas.reduce((s,a)=>s+a.habilitados,0);
    const votesByCand = {};
    cands.forEach(c => { votesByCand[c.id]=0; });
    let blancos=0, nulos=0, processed=0;
    anforas.forEach(a => {
      const r=results[a.id]; if(!r) return;
      processed++;
      blancos += r.blancos||0;
      nulos   += r.nulos||0;
      cands.forEach(c => { votesByCand[c.id]=(votesByCand[c.id]||0)+(r[c.id]||0); });
    });
    const totalValidos = Object.values(votesByCand).reduce((s,v)=>s+v,0);
    const totalEmitido = totalValidos + blancos + nulos;
    const sorted = [...cands].map(c=>({...c, votes:votesByCand[c.id]||0})).sort((a,b)=>b.votes-a.votes);
    const participacion = totalHab>0 ? totalEmitido/totalHab*100 : 0;

    // By zona
    const byZona = {};
    anforas.forEach(a => {
      const r=results[a.id]; if(!r) return;
      const z = a.ubicacion || 'Sin zona';
      if (!byZona[z]) byZona[z] = { zona:z, anforas:[], votesTotal:0, byCand:{} };
      byZona[z].anforas.push(a);
      cands.forEach(c => {
        byZona[z].byCand[c.id] = (byZona[z].byCand[c.id]||0)+(r[c.id]||0);
        byZona[z].votesTotal   += (r[c.id]||0);
      });
    });

    return { sorted, cands, anforas, results, totalValidos, blancos, nulos, totalEmitido, totalHab, participacion, processed, faltantes:anforas.length-processed, byZona };
  };

  /* ── Init / Reset ── */
  const init  = () => { const s=Storage.load(); if(s) D={candidates:[],anforas:[],results:{},...s}; };
  const reset = () => { D={candidates:[],anforas:[],results:{}}; Storage.clear(); };

  return { getCandidates, addCandidate, editCandidate, deleteCandidate, getAnforas, addAnfora, editAnfora, deleteAnfora, getResult, saveResult, clearResult, getStats, init, reset };
})();

/* ════════════════════════════════════════════════════════
   UI HELPERS
════════════════════════════════════════════════════════ */
const UI = (() => {
  const $ = id => document.getElementById(id);
  const el = (tag,cls,txt) => { const e=document.createElement(tag); if(cls)e.className=cls; if(txt!==undefined)e.textContent=txt; return e; };
  const td = (content,cls) => { const t=document.createElement('td'); if(cls)t.className=cls; if(typeof content==='string'||typeof content==='number') t.textContent=content; else if(content instanceof Node) t.appendChild(content); return t; };

  const fmt = n => (n||0).toLocaleString('es-BO');
  const pct = (n,t) => t>0 ? (n/t*100).toFixed(2)+'%' : '0.00%';
  const pctN = (n,t) => t>0 ? n/t*100 : 0;

  const openModal  = id => $(id).classList.add('open');
  const closeModal = id => $(id).classList.remove('open');
  const setErr  = (id,msg) => $(id).textContent = msg||'';
  const clearErr = id => $(id).textContent = '';

  const makeBadge = (text, cls) => { const s=el('span','sbadge'); s.classList.add(cls); s.textContent=text; return s; };

  const makeActBtns = (...btns) => {
    const w=el('div'); btns.forEach(({label,cls,onClick})=>{
      const b=el('button',`act-btn${cls?' '+cls:''}`,label); b.addEventListener('click',onClick); w.appendChild(b);
    }); return w;
  };

  const makeBar = (val, total, color, height=6) => {
    const w=el('div','inline-bar-wrap'); w.style.height=height+'px';
    const f=el('div','inline-bar'); f.style.background=color; f.style.width=total>0?Math.max(2,val/total*100)+'%':'2%';
    w.appendChild(f); return w;
  };

  return { $, el, td, fmt, pct, pctN, openModal, closeModal, setErr, clearErr, makeBadge, makeActBtns, makeBar };
})();

/* ════════════════════════════════════════════════════════
   PIE CHART (pure SVG)
════════════════════════════════════════════════════════ */
const PieChart = (() => {
  const TAU = Math.PI * 2;

  const describeArc = (cx, cy, r, startAngle, endAngle) => {
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  };

  const render = (svgId, legendId, centerValId, data) => {
    // data: [{label, value, color}]
    const svg = UI.$(svgId);
    const legend = UI.$(legendId);
    if (!svg) return;
    svg.innerHTML = '';
    if (legend) legend.innerHTML = '';

    const total = data.reduce((s,d)=>s+d.value,0);
    if (UI.$(centerValId)) UI.$(centerValId).textContent = UI.fmt(total);

    if (total === 0) {
      const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
      txt.setAttribute('x','110'); txt.setAttribute('y','115'); txt.setAttribute('text-anchor','middle');
      txt.setAttribute('fill','#9ca3af'); txt.setAttribute('font-size','12'); txt.textContent='Sin datos';
      svg.appendChild(txt);
      return;
    }

    const cx=110, cy=110, rOuter=95, rInner=52;
    let angle = -Math.PI/2;

    data.forEach((d, i) => {
      if (d.value===0) return;
      const slice = (d.value/total)*TAU;
      const endAngle = angle + slice;

      // donut slice path
      const pathStr = describeArc(cx,cy,rOuter,angle,endAngle) +
        ' ' + describeArc(cx,cy,rInner,endAngle,angle).replace('M','M').replace('L','L')
          .replace('A','A').replace('Z','');

      // Build donut wedge using two arcs
      const x1o = cx + rOuter*Math.cos(angle),  y1o = cy + rOuter*Math.sin(angle);
      const x2o = cx + rOuter*Math.cos(endAngle), y2o = cy + rOuter*Math.sin(endAngle);
      const x1i = cx + rInner*Math.cos(endAngle), y1i = cy + rInner*Math.sin(endAngle);
      const x2i = cx + rInner*Math.cos(angle),    y2i = cy + rInner*Math.sin(angle);
      const lg = slice > Math.PI ? 1 : 0;
      const donutPath = `M ${x1o} ${y1o} A ${rOuter} ${rOuter} 0 ${lg} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${rInner} ${rInner} 0 ${lg} 0 ${x2i} ${y2i} Z`;

      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d', donutPath);
      path.setAttribute('fill', d.color);
      path.setAttribute('class','pie-slice');
      path.setAttribute('stroke','#fff');
      path.setAttribute('stroke-width','2');

      // tooltip via title
      const title = document.createElementNS('http://www.w3.org/2000/svg','title');
      title.textContent = `${d.label}: ${UI.fmt(d.value)} (${UI.pct(d.value,total)})`;
      path.appendChild(title);

      svg.appendChild(path);
      angle = endAngle;
    });

    // Legend
    if (legend) {
      data.forEach(d => {
        const item = UI.el('div','pl-item');
        const dot = UI.el('div','pl-dot'); dot.style.background=d.color;
        const name = UI.el('span','pl-name', d.label.length>18?d.label.slice(0,16)+'…':d.label);
        const pct  = UI.el('span','pl-pct', UI.pct(d.value,total));
        item.appendChild(dot); item.appendChild(name); item.appendChild(pct);
        legend.appendChild(item);
      });
    }
  };

  return { render };
})();

/* ════════════════════════════════════════════════════════
   VIEWS
════════════════════════════════════════════════════════ */
const Views = (() => {
  /* ── updateSidebar ── */
  const updateSidebar = () => {
    const s = State.getStats();
    UI.$('pillCandidates').textContent = s.cands.length;
    UI.$('pillAnforas').textContent    = s.anforas.length;
    const dot  = UI.$('sel-dot')||UI.$('selDot');
    const text = UI.$('selText');
    if (dot && text) {
      const hasData = s.processed > 0;
      dot.classList.toggle('active', hasData);
      text.textContent = hasData ? `${s.processed}/${s.anforas.length} ánforas` : 'Sin datos ingresados';
    }
    // nav status indicator
    const ns = UI.$('navStatus');
    if (ns) {
      if (s.anforas.length===0) { ns.className='sstatus'; }
      else if (s.processed===s.anforas.length && s.anforas.length>0) { ns.className='sstatus done'; }
      else if (s.processed>0) { ns.className='sstatus partial'; }
      else { ns.className='sstatus'; }
    }
  };

  /* ════ CANDIDATES ════ */
  const renderCandidates = () => {
    const cands = State.getCandidates();
    const s = State.getStats();
    const list = UI.$('candList');
    const empty = UI.$('emptyCandidates');
    list.innerHTML='';
    UI.$('countCandidates').textContent = `${cands.length} registrado${cands.length!==1?'s':''}`;

    if (cands.length===0) { empty.style.display=''; return; }
    empty.style.display='none';

    // sort by votes desc
    const sorted = [...cands].sort((a,b)=>{
      const va=s.sorted.find(x=>x.id===a.id)?.votes||0;
      const vb=s.sorted.find(x=>x.id===b.id)?.votes||0;
      return vb-va;
    });

    sorted.forEach(c => {
      const votes = s.sorted.find(x=>x.id===c.id)?.votes||0;
      const item = UI.el('div','cand-item');

      const dot  = UI.el('div','cand-color-dot'); dot.style.background=c.color;
      const info = UI.el('div','cand-info');
      const nm   = UI.el('div','cand-name', c.name);
      const meta = UI.el('div','cand-meta', [c.party,c.alias].filter(Boolean).join(' · ')||'Sin partido');
      info.appendChild(nm); info.appendChild(meta);

      const vEl  = UI.el('div','cand-votes', UI.fmt(votes));
      const acts = UI.el('div','cand-actions');
      const editB = UI.el('button','act-btn edit','✏');
      editB.title = 'Editar'; editB.addEventListener('click', ()=>openEditCand(c));
      const delB  = UI.el('button','act-btn del','✕');
      delB.title = 'Eliminar'; delB.addEventListener('click', ()=>confirmAction('candidate',c.id,`¿Eliminar a "${c.name}"?`,'Se eliminarán todos sus votos registrados.'));
      acts.appendChild(editB); acts.appendChild(delB);

      item.appendChild(dot); item.appendChild(info); item.appendChild(vEl); item.appendChild(acts);
      list.appendChild(item);
    });
    updateSidebar();
  };

  /* ════ ANFORAS ════ */
  const renderAnforas = () => {
    const anforas = State.getAnforas();
    const tbody = UI.$('tbodyAnforas');
    const empty = UI.$('emptyAnforas');
    tbody.innerHTML='';
    UI.$('countAnforas').textContent = `${anforas.length} registrada${anforas.length!==1?'s':''}`;
    UI.$('pillAnforas').textContent  = anforas.length;

    if (anforas.length===0) { empty.style.display=''; return; }
    empty.style.display='none';

    anforas.forEach(a => {
      const result = State.getResult(a.id);
      const tr = document.createElement('tr');
      tr.appendChild(UI.td(a.num,'td-name'));
      tr.appendChild(UI.td(a.recinto));
      tr.appendChild(UI.td(a.ubicacion||'—','td-muted'));
      tr.appendChild(UI.td(a.enc1));
      tr.appendChild(UI.td(a.enc2||'—','td-muted'));
      tr.appendChild(UI.td(UI.fmt(a.habilitados)));
      // status
      const stTd = document.createElement('td');
      if (!result) stTd.appendChild(UI.makeBadge('Sin datos','sbadge-empty'));
      else         stTd.appendChild(UI.makeBadge('✓ Procesada','sbadge-done'));
      tr.appendChild(stTd);
      tr.appendChild(UI.td(UI.makeActBtns(
        { label:'✏ Editar', cls:'edit', onClick:()=>openEditAnf(a) },
        { label:'✕ Eliminar', cls:'del', onClick:()=>confirmAction('anfora',a.id,`¿Eliminar ánfora "${a.num} – ${a.recinto}"?`,'Se eliminarán los votos ingresados para esta ánfora.') }
      )));
      tbody.appendChild(tr);
    });
    updateSidebar();
  };

  /* ════ INGRESO ════ */
  const renderIngresoSelector = () => {
    const sel = UI.$('selAnfora');
    const cur = sel.value;
    sel.innerHTML='<option value="">— Selecciona un ánfora —</option>';
    State.getAnforas().forEach(a => {
      const o=document.createElement('option');
      o.value=a.id;
      o.textContent=`${a.num} — ${a.recinto}${a.ubicacion?' ('+a.ubicacion+')':''}`;
      sel.appendChild(o);
    });
    if (cur) sel.value=cur;
  };

  const renderIngresoForm = anforaId => {
    const anfora = State.getAnforas().find(a=>a.id===anforaId);
    const panel  = UI.$('ingresoPanel');
    const empty  = UI.$('ingresoEmpty');
    if (!anforaId||!anfora) { panel.classList.add('hidden'); empty.style.display=''; return; }
    panel.classList.remove('hidden');
    empty.style.display='none';

    // Banner
    const banner = UI.$('anforaBanner');
    banner.innerHTML='';
    [['N° Ánfora',anfora.num],['Recinto',anfora.recinto],['Zona',anfora.ubicacion||'—'],['Encargado 1',anfora.enc1],['Encargado 2',anfora.enc2||'—'],['Habilitados',UI.fmt(anfora.habilitados)]].forEach(([l,v])=>{
      const it=UI.el('div','ab-item');
      it.appendChild(UI.el('div','ab-label',l));
      it.appendChild(UI.el('div','ab-value',v));
      banner.appendChild(it);
    });

    // Vote inputs
    const grid = UI.$('voteGrid');
    grid.innerHTML='';
    const cands = State.getCandidates();
    const existing = State.getResult(anforaId);
    if (cands.length===0) {
      grid.innerHTML='<p style="color:var(--muted);font-size:0.85rem">Agrega candidatos primero.</p>';
    } else {
      cands.forEach(c => {
        const card = UI.el('div','vcard');
        const dot  = UI.el('div','vcard-dot'); dot.style.background=c.color;
        const info = UI.el('div','vcard-info');
        info.appendChild(UI.el('div','vcard-name',c.name));
        if (c.party||c.alias) info.appendChild(UI.el('div','vcard-party',[c.alias,c.party].filter(Boolean).join(' · ')));
        const inp = UI.el('input','vcard-inp');
        inp.type='number'; inp.min='0'; inp.max='9999';
        inp.dataset.cid=c.id;
        inp.value=existing?(existing[c.id]||0):0;
        inp.addEventListener('input', updateComputed);
        card.appendChild(dot); card.appendChild(info); card.appendChild(inp);
        grid.appendChild(card);
      });
    }

    UI.$('iVBlancos').value = existing?(existing.blancos||0):0;
    UI.$('iVNulos').value   = existing?(existing.nulos||0):0;
    updateComputed();
    renderResultAnfora(anforaId);
  };

  const updateComputed = () => {
    let t=0;
    document.querySelectorAll('.vcard-inp').forEach(i=>t+=parseInt(i.value)||0);
    t+=parseInt(UI.$('iVBlancos').value)||0;
    t+=parseInt(UI.$('iVNulos').value)||0;
    UI.$('computedBox').textContent=UI.fmt(t);
  };

  const renderResultAnfora = anforaId => {
    const result = State.getResult(anforaId);
    const card = UI.$('cardResultAnfora');
    if (!result) { card.style.display='none'; return; }
    card.style.display='';
    const tbody = UI.$('tbodyResultAnfora');
    tbody.innerHTML='';
    const cands = State.getCandidates();
    let total=0; cands.forEach(c=>total+=result[c.id]||0);
    cands.forEach(c=>{
      const v=result[c.id]||0;
      const tr=document.createElement('tr');
      const nameCell=UI.el('span',''); 
      const dot=UI.el('span'); dot.style.cssText=`display:inline-block;width:9px;height:9px;border-radius:50%;background:${c.color};margin-right:7px;vertical-align:middle`;
      nameCell.appendChild(dot); nameCell.appendChild(document.createTextNode(c.name));
      tr.appendChild(UI.td(nameCell,'td-name'));
      tr.appendChild(UI.td(UI.fmt(v),'td-num'));
      tr.appendChild(UI.td(UI.pct(v,total),'td-num'));
      const barTd=document.createElement('td'); barTd.appendChild(UI.makeBar(v,total,c.color,8)); tr.appendChild(barTd);
      tbody.appendChild(tr);
    });
    // blancos/nulos
    [[result.blancos||0,'En Blanco','#9ca3af'],[result.nulos||0,'Nulos','#d1d5db']].forEach(([v,label,color])=>{
      const tr=document.createElement('tr');
      tr.appendChild(UI.td(label,'td-muted'));
      tr.appendChild(UI.td(UI.fmt(v),'td-num'));
      tr.appendChild(UI.td('—','td-num'));
      const barTd=document.createElement('td'); barTd.appendChild(UI.makeBar(v,total,color,8)); tr.appendChild(barTd);
      tbody.appendChild(tr);
    });
  };

  /* ════ STATISTICS ════ */
  const renderStats = () => {
    const s = State.getStats();

    // ── KPI Row 1 ──
    const kpis1 = [
      { label:'Ánforas',         val:s.anforas.length,             sub:`${s.processed} procesadas`,          cls:'' },
      { label:'Votos Válidos',   val:UI.fmt(s.totalValidos),       sub:`${UI.fmt(s.totalHab)} habilitados`,  cls:'accent' },
      { label:'Participación',   val:s.participacion.toFixed(1)+'%',sub:'sobre electores habilitados',       cls:'' },
      { label:'Candidato Líder', val:s.sorted[0]?.name||'—',       sub:`${UI.fmt(s.sorted[0]?.votes||0)} votos · ${UI.pct(s.sorted[0]?.votes||0,s.totalValidos)}`, cls:'gold' },
    ];
    renderKPIGrid('kpiGrid', kpis1);

    // ── PIE CHART ──
    const pieData = s.sorted.filter(c=>c.votes>0).map(c=>({ label:c.name, value:c.votes, color:c.color }));
    if (s.blancos>0) pieData.push({ label:'Blanco', value:s.blancos, color:'#e5e7eb' });
    if (s.nulos>0)   pieData.push({ label:'Nulos',  value:s.nulos,   color:'#d1d5db' });
    PieChart.render('pieChart', 'pieLegend', 'pcVal', pieData);

    // ── MAIN BAR CHART ──
    const barContainer = UI.$('mainBarChart');
    barContainer.innerHTML='';
    if (s.sorted.length>0 && s.totalValidos>0) {
      s.sorted.forEach(c=>{
        const item = UI.el('div','hbar-item');
        const lbl  = UI.el('div','hbar-label',c.name.length>18?c.name.slice(0,16)+'…':c.name);
        lbl.title=c.name;
        const track= UI.el('div','hbar-track');
        const fill = UI.el('div','hbar-fill');
        fill.style.background=c.color;
        fill.style.width=s.sorted[0].votes>0?Math.max(3,c.votes/s.sorted[0].votes*100)+'%':'3%';
        const val  = UI.el('span','hbar-val',UI.pct(c.votes,s.totalValidos));
        fill.appendChild(val); track.appendChild(fill);
        const num  = UI.el('div','hbar-num',UI.fmt(c.votes));
        item.appendChild(lbl); item.appendChild(track); item.appendChild(num);
        barContainer.appendChild(item);
      });
    } else {
      barContainer.innerHTML='<p style="color:var(--muted);font-size:0.85rem;padding:12px 0">Sin datos.</p>';
    }

    // ── RESULTS TABLE ──
    const tbody = UI.$('tbodyResults');
    const empty = UI.$('emptyResults');
    tbody.innerHTML='';
    if (s.sorted.length===0||s.totalValidos===0) { empty.style.display=''; }
    else {
      empty.style.display='none';
      s.sorted.forEach((c,i)=>{
        const tr=document.createElement('tr');
        if(i===0) tr.className='row-leader';
        // rank
        const rankSpan=UI.el('span',`results-tbl td-rank${i===0?' rank-1':''}`,i===0?'★ 1°':`${i+1}°`);
        tr.appendChild(UI.td(rankSpan));
        // name with dot
        const nameWrap=UI.el('span');
        const dot=UI.el('span'); dot.style.cssText=`display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.color};margin-right:8px;vertical-align:middle`;
        nameWrap.appendChild(dot); nameWrap.appendChild(document.createTextNode(c.name));
        tr.appendChild(UI.td(nameWrap,'td-name'));
        tr.appendChild(UI.td(c.party||'—','td-muted'));
        tr.appendChild(UI.td(UI.fmt(c.votes),'td-num'));
        tr.appendChild(UI.td(UI.pct(c.votes,s.totalValidos),'td-num'));
        tr.appendChild(UI.td(UI.pct(c.votes,s.totalHab),'td-num'));
        const barTd=document.createElement('td'); barTd.appendChild(UI.makeBar(c.votes,s.sorted[0]?.votes||1,c.color,8)); tr.appendChild(barTd);
        tbody.appendChild(tr);
      });
    }

    // ── ZONA CHARTS ──
    const zonaContainer = UI.$('zonaCharts');
    const emptyZona = UI.$('emptyZona');
    zonaContainer.innerHTML='';
    const zonas = Object.values(s.byZona);
    if (zonas.length===0) { emptyZona.style.display=''; }
    else {
      emptyZona.style.display='none';
      zonaContainer.className='zona-grid';
      zonas.forEach(z=>{
        const maxZ = Math.max(...Object.values(z.byCand));
        const winner = s.cands.reduce((best,c)=>{
          const v=z.byCand[c.id]||0; return v>(z.byCand[best?.id]||0)?c:best;
        }, s.cands[0]);

        const card=UI.el('div','zona-card');
        const title=UI.el('div','zona-title',z.zona);
        const winnerEl=UI.el('div','zona-winner');
        if(winner){
          const wd=UI.el('span','zona-winner-dot'); wd.style.background=winner.color;
          const wt=UI.el('span',null,winner.name+' lidera');
          winnerEl.appendChild(wd); winnerEl.appendChild(wt);
        }
        card.appendChild(title); card.appendChild(winnerEl);

        s.cands.forEach(c=>{
          const v=z.byCand[c.id]||0;
          const item=UI.el('div','hbar-item');
          item.style.marginBottom='7px';
          const lbl=UI.el('div','hbar-label',c.name.length>14?c.name.slice(0,12)+'…':c.name);
          lbl.style.fontSize='0.74rem'; lbl.style.maxWidth='100px';
          const track=UI.el('div','hbar-track');
          const fill=UI.el('div','hbar-fill');
          fill.style.background=c.color;
          fill.style.width=maxZ>0?Math.max(3,v/maxZ*100)+'%':'3%';
          const val=UI.el('span','hbar-val',UI.fmt(v)); fill.appendChild(val);
          track.appendChild(fill);
          const num=UI.el('div','hbar-num',UI.pct(v,z.votesTotal||1)); num.style.width='48px'; num.style.fontSize='0.72rem';
          item.appendChild(lbl); item.appendChild(track); item.appendChild(num);
          card.appendChild(item);
        });
        zonaContainer.appendChild(card);
      });
    }

    // ── ANFORA BREAKDOWN ──
    const bHead = UI.$('breakHead');
    const bBody = UI.$('breakBody');
    const emptyB = UI.$('emptyBreak');
    bHead.innerHTML=''; bBody.innerHTML='';
    const processed = s.anforas.filter(a=>s.results[a.id]);
    if(processed.length===0){emptyB.style.display=''; }
    else {
      emptyB.style.display='none';
      ['Ánfora','Recinto','Zona',...s.cands.map(c=>c.name.length>10?c.name.slice(0,9)+'…':c.name),'Blanco','Nulos','Total'].forEach(h=>{
        const th=document.createElement('th'); th.textContent=h; bHead.appendChild(th);
      });
      processed.forEach(a=>{
        const r=s.results[a.id]; let rowTotal=0;
        const tr=document.createElement('tr');
        tr.appendChild(UI.td(a.num,'td-name')); tr.appendChild(UI.td(a.recinto)); tr.appendChild(UI.td(a.ubicacion||'—','td-muted'));
        s.cands.forEach(c=>{ const v=r[c.id]||0; rowTotal+=v; tr.appendChild(UI.td(UI.fmt(v),'td-num')); });
        const b=r.blancos||0, n=r.nulos||0; rowTotal+=b+n;
        tr.appendChild(UI.td(UI.fmt(b),'td-num')); tr.appendChild(UI.td(UI.fmt(n),'td-num')); tr.appendChild(UI.td(UI.fmt(rowTotal),'td-num'));
        bBody.appendChild(tr);
      });
    }

    // ── KPI Row 2 ──
    const kpis2 = [
      { label:'Votos en Blanco', val:UI.fmt(s.blancos), sub:`${UI.pct(s.blancos,s.totalEmitido)} del total emitido`, cls:'' },
      { label:'Votos Nulos',     val:UI.fmt(s.nulos),   sub:`${UI.pct(s.nulos,s.totalEmitido)} del total emitido`,   cls:'' },
      { label:'Total Emitido',   val:UI.fmt(s.totalEmitido), sub:'válidos + blancos + nulos',                         cls:'' },
      { label:'Ánforas Faltantes', val:s.faltantes, sub:'sin procesar aún',                                          cls:s.faltantes>0?'red':'green' },
    ];
    renderKPIGrid('kpiGrid2', kpis2);

    updateSidebar();
  };

  const renderKPIGrid = (id, kpis) => {
    const grid = UI.$(id);
    grid.innerHTML='';
    kpis.forEach(k=>{
      const card=UI.el('div',`kpi-card ${k.cls||''}`);
      card.appendChild(UI.el('div','kpi-lbl',k.label));
      const val=UI.el('div','kpi-val'); val.textContent=k.val; val.title=String(k.val);
      card.appendChild(val);
      card.appendChild(UI.el('div','kpi-sub',k.sub));
      grid.appendChild(card);
    });
  };

  /* ── Edit modals ── */
  const openEditCand = c => {
    UI.$('editCandId').value=c.id; UI.$('editCandName').value=c.name;
    UI.$('editCandParty').value=c.party||''; UI.$('editCandAlias').value=c.alias||'';
    UI.$('editCandColor').value=c.color||'#5b8def';
    UI.$('editCprev').style.background=c.color||'#5b8def';
    UI.$('editChex').textContent=c.color||'#5b8def';
    UI.clearErr('errEditCand'); UI.openModal('modalCand');
  };

  const openEditAnf = a => {
    UI.$('editAnfId').value=a.id; UI.$('editAnfNum').value=a.num;
    UI.$('editAnfRecinto').value=a.recinto; UI.$('editAnfUbic').value=a.ubicacion||'';
    UI.$('editAnfEnc1').value=a.enc1||''; UI.$('editAnfEnc2').value=a.enc2||'';
    UI.$('editAnfHab').value=a.habilitados||0;
    UI.clearErr('errEditAnf'); UI.openModal('modalAnf');
  };

  /* ── Confirm delete ── */
  let _pending = null;
  const confirmAction = (type,id,title,msg) => {
    UI.$('confirmTitle').textContent=title; UI.$('confirmMsg').textContent=msg;
    _pending={type,id}; UI.openModal('modalConfirm');
  };
  const executePending = () => {
    if(!_pending) return;
    if(_pending.type==='candidate') State.deleteCandidate(_pending.id);
    if(_pending.type==='anfora')    State.deleteAnfora(_pending.id);
    if(_pending.type==='reset')     { State.reset(); renderAll(); UI.closeModal('modalConfirm'); _pending=null; return; }
    _pending=null; UI.closeModal('modalConfirm'); renderAll();
  };

  const renderAll = () => {
    renderCandidates(); renderAnforas(); renderIngresoSelector();
    const sel=UI.$('selAnfora').value; if(sel) renderIngresoForm(sel);
    renderStats();
  };

  return { renderCandidates, renderAnforas, renderIngresoSelector, renderIngresoForm, updateComputed, renderResultAnfora, renderStats, renderAll, openEditCand, openEditAnf, confirmAction, executePending };
})();

/* ════════════════════════════════════════════════════════
   EXPORT PDF
════════════════════════════════════════════════════════ */
const Export = (() => {
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const toPDF = () => {
    const s = State.getStats();
    const d = new Date().toLocaleString('es-BO');

    // pie as SVG string
    const pieItems = s.sorted.filter(c=>c.votes>0).map(c=>({label:c.name,value:c.votes,color:c.color}));
    if(s.blancos>0) pieItems.push({label:'Blanco',value:s.blancos,color:'#e5e7eb'});
    if(s.nulos>0)   pieItems.push({label:'Nulos',value:s.nulos,color:'#d1d5db'});
    const total=pieItems.reduce((t,p)=>t+p.value,0);
    let pSVG=''; let angle=-Math.PI/2;
    const TAU=Math.PI*2, cx=110,cy=110,ro=95,ri=50;
    pieItems.forEach(p=>{
      if(!p.value) return;
      const sl=p.value/total*TAU; const ea=angle+sl;
      const x1o=cx+ro*Math.cos(angle), y1o=cy+ro*Math.sin(angle);
      const x2o=cx+ro*Math.cos(ea),    y2o=cy+ro*Math.sin(ea);
      const x1i=cx+ri*Math.cos(ea),    y1i=cy+ri*Math.sin(ea);
      const x2i=cx+ri*Math.cos(angle), y2i=cy+ri*Math.sin(angle);
      const lg=sl>Math.PI?1:0;
      pSVG+=`<path d="M${x1o} ${y1o} A${ro} ${ro} 0 ${lg} 1 ${x2o} ${y2o} L${x1i} ${y1i} A${ri} ${ri} 0 ${lg} 0 ${x2i} ${y2i} Z" fill="${p.color}" stroke="white" stroke-width="2"><title>${esc(p.label)}: ${p.value}</title></path>`;
      angle=ea;
    });
    const pieSVGStr=`<svg viewBox="0 0 220 220" width="220" height="220" style="display:block">${pSVG}<text x="110" y="107" text-anchor="middle" font-size="22" font-weight="800" fill="#111827" font-family="system-ui">${UI.fmt(s.totalValidos)}</text><text x="110" y="124" text-anchor="middle" font-size="9" fill="#6b7280" font-family="system-ui">VOTOS VÁLIDOS</text></svg>`;

    const candRows = s.sorted.map((c,i)=>`
      <tr style="${i===0?'background:#fffef0':''}">
        <td style="font-weight:800;color:${i===0?'#c9920a':'#9ca3af'}">${i===0?'★ 1°':`${i+1}°`}</td>
        <td style="display:flex;align-items:center;gap:8px;padding:8px 14px">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.color};flex-shrink:0"></span>
          <span style="font-weight:700">${esc(c.name)}</span>
        </td>
        <td style="color:#6b7280">${esc(c.party||'—')}</td>
        <td style="text-align:right;font-weight:700;font-family:monospace">${UI.fmt(c.votes)}</td>
        <td style="text-align:right">${UI.pct(c.votes,s.totalValidos)}</td>
        <td style="text-align:right">${UI.pct(c.votes,s.totalHab)}</td>
        <td style="min-width:120px"><div style="background:#f0f2f8;border-radius:99px;height:8px;overflow:hidden"><div style="height:100%;border-radius:99px;background:${c.color};width:${s.sorted[0]?.votes?Math.max(3,c.votes/s.sorted[0].votes*100):3}%"></div></div></td>
      </tr>`).join('');

    const processedAnf = s.anforas.filter(a=>s.results[a.id]);
    const anforaHdrs = s.cands.map(c=>`<th style="background:#f0f2f8">${esc(c.name.length>12?c.name.slice(0,11)+'…':c.name)}</th>`).join('');
    const anforaRows = processedAnf.map(a=>{
      const r=s.results[a.id]; let t=0;
      const cells=s.cands.map(c=>{const v=r[c.id]||0;t+=v;return`<td style="text-align:right">${UI.fmt(v)}</td>`;}).join('');
      const b=r.blancos||0,n=r.nulos||0; t+=b+n;
      return`<tr><td style="font-weight:700">${esc(a.num)}</td><td>${esc(a.recinto)}</td><td style="color:#6b7280">${esc(a.ubicacion||'—')}</td><td style="color:#6b7280">${esc(a.enc1)}</td>${cells}<td style="text-align:right">${UI.fmt(b)}</td><td style="text-align:right">${UI.fmt(n)}</td><td style="text-align:right;font-weight:700">${UI.fmt(t)}</td></tr>`;
    }).join('');

    const pieLegendHTML = pieItems.map(p=>`<div style="display:flex;align-items:center;gap:8px;font-size:10pt;margin-bottom:5px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};flex-shrink:0"></span><span style="flex:1;font-weight:600">${esc(p.label)}</span><span style="font-family:monospace;color:#6b7280">${UI.pct(p.value,total)}</span></div>`).join('');

    const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Reporte Electoral — VotoClaro Pro</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111827;font-size:10pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:210mm;margin:0 auto;padding:14mm 14mm 10mm}
.hdr{display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:3px solid #3b68e8;margin-bottom:20px}
.hdr-left{display:flex;align-items:center;gap:12px}
.hdr-title{font-size:16pt;font-weight:800;color:#0f1523;letter-spacing:-0.02em}
.hdr-sub{font-size:7pt;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px}
.hdr-right{text-align:right}
.hdr-report{font-size:11pt;font-weight:700}
.hdr-date{font-size:8pt;color:#6b7280;margin-top:3px}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px}
.kpi{border:1px solid #e4e6f0;border-radius:8px;padding:10px 12px;background:#f5f6fb}
.kpi.accent{background:#3b68e8;border-color:#2a56d4}
.kpi.gold{background:linear-gradient(135deg,#fdfae9,#fef7d4);border-color:#f0d660}
.kpi-l{font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:5px}
.kpi.accent .kpi-l{color:rgba(255,255,255,.7)}
.kpi.gold .kpi-l{color:#a07810}
.kpi-v{font-size:15pt;font-weight:800;color:#111827;line-height:1;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kpi.accent .kpi-v{color:#fff}
.kpi.gold .kpi-v{color:#b07808}
.kpi-s{font-size:7pt;color:#6b7280}
.kpi.accent .kpi-s{color:rgba(255,255,255,.6)}
h2{font-size:8pt;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:#6b7280;margin:18px 0 8px;padding-bottom:5px;border-bottom:1px solid #e4e6f0}
table{width:100%;border-collapse:collapse;font-size:9pt}
thead tr{background:#f5f6fb}
th{text-align:left;padding:7px 10px;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:2px solid #e4e6f0;white-space:nowrap}
td{padding:8px 10px;border-bottom:1px solid #eef0f6;vertical-align:middle}
tr:last-child td{border-bottom:none}
.charts-row{display:flex;gap:20px;margin-bottom:20px;align-items:flex-start}
.pie-section{flex-shrink:0}
.legend-section{flex:1}
.footer{margin-top:16px;padding-top:10px;border-top:1px solid #e4e6f0;display:flex;justify-content:space-between;font-size:7.5pt;color:#9ca3af}
.print-bar{position:fixed;top:0;left:0;right:0;background:#0f1523;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;z-index:999;font-family:inherit;font-size:12px}
.pbtn{background:#3b68e8;color:#fff;border:none;border-radius:6px;padding:7px 18px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
.pbtn:hover{background:#2a56d4}
.pcls{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:7px 14px;font-size:12px;cursor:pointer;font-family:inherit}
@media screen{body{background:#e8eaf0;padding-top:50px}.page{background:#fff;box-shadow:0 4px 32px rgba(0,0,0,.12);margin:16px auto 40px;border-radius:6px}}
@media print{.print-bar{display:none!important}body{background:#fff;padding-top:0}.page{padding:10mm;box-shadow:none;border-radius:0}h2{page-break-after:avoid}table{page-break-inside:auto}thead{display:table-header-group}tr{page-break-inside:avoid}}
</style></head><body>
<div class="print-bar">
  <span>⬡ <strong>VotoClaro Pro</strong> — Reporte Electoral Oficial</span>
  <span style="color:rgba(255,255,255,.6);font-size:11px">En el diálogo de impresión selecciona "Guardar como PDF"</span>
  <div style="display:flex;gap:8px">
    <button class="pcls" onclick="window.close()">✕ Cerrar</button>
    <button class="pbtn" onclick="window.print()">🖨 Imprimir / PDF</button>
  </div>
</div>
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <svg width="36" height="36" viewBox="0 0 32 32" fill="none"><polygon points="16,2 30,9 30,23 16,30 2,23 2,9" fill="none" stroke="#3b68e8" stroke-width="2"/><polygon points="16,8 24,12.5 24,19.5 16,24 8,19.5 8,12.5" fill="#3b68e8" opacity="0.2"/><circle cx="16" cy="16" r="4" fill="#3b68e8"/></svg>
      <div><div class="hdr-title">VotoClaro Pro</div><div class="hdr-sub">Sistema Electoral de Ánforas</div></div>
    </div>
    <div class="hdr-right"><div class="hdr-report">Reporte Electoral Oficial</div><div class="hdr-date">Generado: ${d}</div></div>
  </div>
  <div class="kpi-row">
    <div class="kpi"><div class="kpi-l">Ánforas</div><div class="kpi-v">${s.anforas.length}</div><div class="kpi-s">${s.processed} procesadas</div></div>
    <div class="kpi accent"><div class="kpi-l">Votos Válidos</div><div class="kpi-v">${UI.fmt(s.totalValidos)}</div><div class="kpi-s">${UI.fmt(s.totalHab)} habilitados</div></div>
    <div class="kpi"><div class="kpi-l">Participación</div><div class="kpi-v">${s.participacion.toFixed(1)}%</div><div class="kpi-s">sobre habilitados</div></div>
    <div class="kpi gold"><div class="kpi-l">Candidato Líder</div><div class="kpi-v" style="font-size:12pt">${esc(s.sorted[0]?.name||'—')}</div><div class="kpi-s">${UI.pct(s.sorted[0]?.votes||0,s.totalValidos)}</div></div>
  </div>
  <h2>Distribución de Votos</h2>
  <div class="charts-row">
    <div class="pie-section">${pieSVGStr}</div>
    <div class="legend-section">${pieLegendHTML}</div>
  </div>
  <h2>Resultados por Candidato</h2>
  <table><thead><tr><th>Pos.</th><th>Candidato</th><th>Partido</th><th style="text-align:right">Votos</th><th style="text-align:right">% Válidos</th><th style="text-align:right">% Hab.</th><th>Proporción</th></tr></thead>
  <tbody>${candRows}</tbody></table>
  ${processedAnf.length>0?`<h2>Detalle por Ánfora</h2><table><thead><tr><th>N°</th><th>Recinto</th><th>Zona</th><th>Encargado</th>${anforaHdrs}<th style="text-align:right">Blanco</th><th style="text-align:right">Nulos</th><th style="text-align:right">Total</th></tr></thead><tbody>${anforaRows}</tbody></table>`:''}
  <div class="footer">
    <span>VotoClaro Pro · Uso exclusivo oficial · Documento generado automáticamente</span>
    <span>Total emitido: ${UI.fmt(s.totalEmitido)} · Habilitados: ${UI.fmt(s.totalHab)} · Participación: ${s.participacion.toFixed(2)}%</span>
  </div>
</div></body></html>`;

    const win=window.open('','_blank');
    if(!win){alert('El navegador bloqueó la ventana emergente. Permite popups para este archivo.');return;}
    win.document.open(); win.document.write(html); win.document.close();
  };

  return { toPDF };
})();

/* ════════════════════════════════════════════════════════
   EVENTS
════════════════════════════════════════════════════════ */
const Events = (() => {
  const $ = UI.$;

  const init = () => {

    /* ── Mobile sidebar ── */
    const sidebar   = $('sidebar');
    const backdrop  = $('sidebarBackdrop');
    const menuBtn   = $('menuBtn');

    const openSB = () => {
      sidebar.classList.add('open');
      backdrop.classList.add('active');
      menuBtn.classList.add('open');
      document.body.style.overflow='hidden';
    };
    const closeSB = () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
      menuBtn.classList.remove('open');
      document.body.style.overflow='';
    };
    const handleMenu = e => { e.preventDefault(); e.stopPropagation(); sidebar.classList.contains('open')?closeSB():openSB(); };
    menuBtn.addEventListener('click', handleMenu);
    menuBtn.addEventListener('touchend', handleMenu, {passive:false});
    backdrop.addEventListener('click', closeSB);
    backdrop.addEventListener('touchend', e=>{e.preventDefault();closeSB();},{passive:false});

    /* ── Navigation ── */
    document.querySelectorAll('.snav-btn[data-view]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.snav-btn').forEach(b=>b.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
        btn.classList.add('active');
        const view=$(`view-${btn.dataset.view}`);
        if(view) view.classList.add('active');
        if(btn.dataset.view==='stats') Views.renderStats();
        closeSB();
      });
    });

    /* ── Color picker sync ── */
    $('iCandColor').addEventListener('input', e=>{
      $('cprev').style.background=e.target.value;
      $('chex').textContent=e.target.value;
    });
    $('editCandColor').addEventListener('input', e=>{
      $('editCprev').style.background=e.target.value;
      $('editChex').textContent=e.target.value;
    });

    /* ── Swatches ── */
    document.querySelectorAll('.sw').forEach(sw=>{
      sw.addEventListener('click',()=>{
        const color=sw.dataset.color;
        $('iCandColor').value=color;
        $('cprev').style.background=color;
        $('chex').textContent=color;
        document.querySelectorAll('.sw').forEach(s=>s.classList.remove('selected'));
        sw.classList.add('selected');
      });
    });

    /* ── Add Candidate ── */
    $('frmCandidate').addEventListener('submit', e=>{
      e.preventDefault(); UI.clearErr('errCandidate');
      const result=State.addCandidate($('iCandName').value,$('iCandParty').value,$('iCandAlias').value,$('iCandColor').value);
      if(!result.ok){UI.setErr('errCandidate',result.error);return;}
      $('iCandName').value=''; $('iCandParty').value=''; $('iCandAlias').value='';
      $('iCandColor').value='#5b8def'; $('cprev').style.background='#5b8def'; $('chex').textContent='#5b8def';
      document.querySelectorAll('.sw').forEach(s=>s.classList.remove('selected'));
      $('iCandName').focus();
      Views.renderCandidates(); Views.renderIngresoSelector();
    });

    /* ── Add Anfora ── */
    $('frmAnfora').addEventListener('submit', e=>{
      e.preventDefault(); UI.clearErr('errAnfora');
      const result=State.addAnfora($('iAnfNum').value,$('iAnfRecinto').value,$('iAnfUbic').value,$('iAnfEnc1').value,$('iAnfEnc2').value,$('iAnfHab').value);
      if(!result.ok){UI.setErr('errAnfora',result.error);return;}
      ['iAnfNum','iAnfRecinto','iAnfUbic','iAnfEnc1','iAnfEnc2','iAnfHab'].forEach(id=>$(id).value='');
      $('iAnfNum').focus();
      Views.renderAnforas(); Views.renderIngresoSelector();
    });

    /* ── Select Anfora ── */
    $('selAnfora').addEventListener('change', e=>Views.renderIngresoForm(e.target.value));

    /* ── Vote inputs ── */
    $('iVBlancos').addEventListener('input', Views.updateComputed);
    $('iVNulos').addEventListener('input', Views.updateComputed);

    /* ── Save ingreso ── */
    $('btnGuardar').addEventListener('click', ()=>{
      UI.clearErr('errIngreso');
      const anforaId=$('selAnfora').value;
      if(!anforaId){UI.setErr('errIngreso','Selecciona un ánfora.');return;}
      const votes={}; let total=0, valid=true;
      document.querySelectorAll('.vcard-inp').forEach(inp=>{
        const v=parseInt(inp.value);
        if(isNaN(v)||v<0){valid=false;return;}
        votes[inp.dataset.cid]=v; total+=v;
      });
      if(!valid){UI.setErr('errIngreso','Los votos deben ser números enteros no negativos.');return;}
      votes.blancos=parseInt($('iVBlancos').value)||0;
      votes.nulos=parseInt($('iVNulos').value)||0;
      total+=votes.blancos+votes.nulos;
      const anf=State.getAnforas().find(a=>a.id===anforaId);
      if(anf&&anf.habilitados>0&&total>anf.habilitados){
        UI.setErr('errIngreso',`⚠ El total (${UI.fmt(total)}) supera los habilitados (${UI.fmt(anf.habilitados)}). Verifica.`);
        return;
      }
      State.saveResult(anforaId,votes);
      Views.renderResultAnfora(anforaId);
      Views.renderAnforas(); Views.renderStats();
      // feedback
      const btn=$('btnGuardar'); const orig=btn.textContent;
      btn.textContent='✓ Guardado'; btn.style.background='var(--green)';
      setTimeout(()=>{ btn.textContent=orig; btn.style.background=''; },2000);
    });

    /* ── Limpiar ingreso ── */
    $('btnLimpiar').addEventListener('click',()=>{
      document.querySelectorAll('.vcard-inp').forEach(i=>i.value=0);
      $('iVBlancos').value=0; $('iVNulos').value=0; Views.updateComputed();
    });

    /* ── Re-editar anfora result ── */
    $('btnReEditar').addEventListener('click',()=>{ $('cardResultAnfora').style.display='none'; });

    /* ── Edit Candidate ── */
    $('btnSaveCand').addEventListener('click',()=>{
      UI.clearErr('errEditCand');
      const r=State.editCandidate($('editCandId').value,$('editCandName').value,$('editCandParty').value,$('editCandAlias').value,$('editCandColor').value);
      if(!r.ok){UI.setErr('errEditCand',r.error);return;}
      UI.closeModal('modalCand'); Views.renderAll();
    });

    /* ── Edit Anfora ── */
    $('btnSaveAnf').addEventListener('click',()=>{
      UI.clearErr('errEditAnf');
      const r=State.editAnfora($('editAnfId').value,$('editAnfNum').value,$('editAnfRecinto').value,$('editAnfUbic').value,$('editAnfEnc1').value,$('editAnfEnc2').value,$('editAnfHab').value);
      if(!r.ok){UI.setErr('errEditAnf',r.error);return;}
      UI.closeModal('modalAnf'); Views.renderAll();
    });

    /* ── Confirm ── */
    $('btnConfirm').addEventListener('click', Views.executePending);

    /* ── Reset All ── */
    $('resetAllBtn').addEventListener('click',()=>{
      Views.confirmAction('reset',null,'¿Reiniciar todo el sistema?','Se eliminarán todos los candidatos, ánforas y votos. Esta acción no se puede deshacer.');
    });

    /* ── Export PDF ── */
    $('navExportPDF').addEventListener('click', Export.toPDF);
    $('btnPDF').addEventListener('click', Export.toPDF);

    /* ── Close modals ── */
    document.querySelectorAll('[data-close]').forEach(btn=>{
      btn.addEventListener('click',()=>UI.closeModal(btn.dataset.close));
    });
    document.querySelectorAll('.modal-ov').forEach(ov=>{
      ov.addEventListener('click',e=>{ if(e.target===ov) UI.closeModal(ov.id); });
    });
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        document.querySelectorAll('.modal-ov.open').forEach(m=>UI.closeModal(m.id));
        closeSB();
      }
    });
  };

  return { init };
})();

/* ════════════════════════════════════════════════════════
   APP
════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  State.init();
  Views.renderAll();
  Events.init();
});