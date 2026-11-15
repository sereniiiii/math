/* 数学错题本 —— 原生 JS，无依赖 */
(function () {
  'use strict';

  var DATA = window.MATH_DATA || [];
  var CLS = window.KPClassify;
  var KEY = 'gsmath.review.v1';
  var WHY = [
    { k: 'concept', t: '概念不清' },
    { k: 'formula', t: '公式记错' },
    { k: 'calc', t: '算错/漏步' },
    { k: 'idea', t: '没思路' },
    { k: 'careless', t: '看错/抄错' },
    { k: 'time', t: '时间不够' }
  ];

  /* ---------- 索引 ---------- */
  var MODS = DATA.map(function (m) { return { id: m.id, name: m.name, items: m.items }; });
  var KP = {};          // kpId -> {it, modId, modName, modIdx, kpIdx}
  MODS.forEach(function (m, mi) {
    m.items.forEach(function (it, ii) {
      KP[it.id] = { it: it, modId: m.id, modName: m.name, modIdx: mi, kpIdx: ii };
    });
  });
  if (CLS) CLS.build(MODS);

  var TOTAL_KP = Object.keys(KP).length;

  /* ---------- 存储 ---------- */
  var store = { v: 1, mistakes: [] };
  var canStore = true;

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && Array.isArray(d.mistakes)) store = { v: 1, mistakes: d.mistakes };
      }
    } catch (e) {
      canStore = false;
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch (e) {
      canStore = false;
      toast('浏览器不允许保存，数据只在本次打开有效');
    }
  }
  load();

  /* ---------- 工具 ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function hl(s, kw) {
    var out = esc(s);
    if (!kw) return out;
    try {
      var re = new RegExp('(' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      return out.replace(re, '<mark>$1</mark>');
    } catch (e) { return out; }
  }
  function stars(n) { return new Array(n + 1).join('★'); }
  function kpTitle(id) { return KP[id] ? KP[id].it.t : '（知识点已不存在）'; }
  function modName(id) { return KP[id] ? KP[id].modName : ''; }
  function whyText(k) {
    for (var i = 0; i < WHY.length; i++) if (WHY[i].k === k) return WHY[i].t;
    return '';
  }
  function fmtDate(ts) {
    var d = new Date(ts);
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return (d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function ymd(d) {
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function uid() {
    return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = 'position:fixed;left:50%;bottom:calc(26px + env(safe-area-inset-bottom));transform:translateX(-50%);' +
        'background:rgba(27,58,92,.94);color:#fff;font-size:13px;padding:9px 16px;border-radius:999px;z-index:99;' +
        'max-width:86vw;text-align:center;pointer-events:none;transition:opacity .2s;opacity:0';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.style.opacity = '0'; }, 2200);
  }

  /* ---------- 统计 ---------- */
  function stat() {
    var s = { total: store.mistakes.length, todo: 0, fixed: 0, kps: 0, byMod: {}, byKp: {} };
    store.mistakes.forEach(function (m) {
      if (m.fixed) s.fixed++; else s.todo++;
      if (m.kp) {
        s.byKp[m.kp] = (s.byKp[m.kp] || 0) + 1;
        var mid = KP[m.kp] ? KP[m.kp].modId : '';
        if (mid) s.byMod[mid] = (s.byMod[mid] || 0) + 1;
      }
    });
    s.kps = Object.keys(s.byKp).length;
    return s;
  }

  function renderHeader() {
    var s = stat();
    $('#sub').textContent = TOTAL_KP + ' 个知识点';
    $('#statline').innerHTML = s.total
      ? '错题 <b>' + s.total + '</b> 道 · 待解决 <i>' + s.todo + '</i> · 已弄懂 <b>' + s.fixed + '</b> · 覆盖 <b>' + s.kps + '</b> 个知识点'
      : '还没有错题。去「＋ 记错题」抄第一道进来。';
    var dot = $('#cntList');
    dot.textContent = s.todo || '';
    dot.className = 'dot' + (s.todo ? ' show' : '');
  }

  /* ---------- 概览 ---------- */
  function renderOverview() {
    var s = stat();
    var h = '<div class="ov-top">' +
      '<div class="ov-num"><b>' + s.total + '</b><span>道错题</span></div>' +
      '<div class="ov-num warn"><b>' + s.todo + '</b><span>待解决</span></div>' +
      '<div class="ov-num ok"><b>' + s.fixed + '</b><span>已弄懂</span></div>' +
      '<div class="ov-num"><b>' + s.kps + '</b><span>涉及知识点</span></div>' +
      '</div>';

    if (s.total) {
      h += '<div class="bars">';
      MODS.forEach(function (m) {
        var c = s.byMod[m.id] || 0;
        var max = 1;
        for (var k in s.byMod) if (s.byMod[k] > max) max = s.byMod[k];
        var w = c ? Math.max(6, Math.round(c / max * 100)) : 0;
        h += '<div class="bar-row' + (c ? '' : ' zero') + '" data-jump="' + m.id + '">' +
          '<span class="bn">' + esc(m.name) + '</span>' +
          '<span class="bt"><i style="width:' + w + '%"></i></span>' +
          '<span class="bc">' + c + '</span></div>';
      });
      h += '</div>';
    }
    $('#overview').innerHTML = h;
  }

  /* ---------- 知识点列表 ---------- */
  var openMods = {};
  var kpKw = '';

  function renderKp() {
    var s = stat();
    var onlyWrong = $('#onlyWrong').checked;
    kpKw = $('#q').value.trim();
    var kw = kpKw.toLowerCase();
    var h = '';

    MODS.forEach(function (m) {
      var items = m.items.filter(function (it) {
        if (onlyWrong && !s.byKp[it.id]) return false;
        if (!kw) return true;
        var hay = [m.name, it.t, it.core, (it.keys || []).join(' '), it.trap || ''].join(' ').toLowerCase();
        return hay.indexOf(kw) >= 0;
      });
      if (!items.length) return;

      var modWrong = s.byMod[m.id] || 0;
      var isOpen = openMods[m.id] || (kw && items.length <= 4) || (onlyWrong && true);
      h += '<section class="mod' + (isOpen ? ' open' : '') + '" id="mod-' + m.id + '">' +
        '<button class="mod-head" type="button" data-mod="' + m.id + '">' +
        '<span class="mod-name">' + esc(m.name) + '</span>' +
        '<span class="mod-cnt">' + (modWrong ? '错题 ' + modWrong + ' · ' : '') + items.length + ' 点</span>' +
        '<i class="caret"></i></button><div class="mod-body">';

      items.forEach(function (it) {
        var n = s.byKp[it.id] || 0;
        h += '<div class="kp-row' + (n ? ' has-mis' : '') + '" data-kp="' + it.id + '">' +
          '<span class="kp-stars">' + stars(it.star || 1) + '</span>' +
          '<span class="kp-t">' + hl(it.t, kpKw) + '</span>' +
          '<span class="badge' + (n ? ' hot' : '') + '">' + (n || '·') + '</span></div>';
      });
      h += '</div></section>';
    });

    $('#kpList').innerHTML = h || '<div class="empty">没有匹配的知识点</div>';
  }

  /* ---------- 错题本 ---------- */
  function renderList() {
    var s = stat();
    var kw = $('#q2').value.trim().toLowerCase();
    var onlyTodo = $('#onlyTodo').checked;
    var kpF = $('#fKpFilter').value;

    var arr = store.mistakes.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    arr = arr.filter(function (m) {
      if (onlyTodo && m.fixed) return false;
      if (kpF && m.kp !== kpF) return false;
      if (kw) {
        var hay = [m.q, m.note, m.src, kpTitle(m.kp), whyText(m.why)].join(' ').toLowerCase();
        if (hay.indexOf(kw) < 0) return false;
      }
      return true;
    });

    if (!arr.length) {
      $('#misList').innerHTML = '<div class="empty">' + (store.mistakes.length ? '没有符合筛选条件的错题' : '错题本是空的。点上面「＋ 记错题」开始。') + '</div>';
      return;
    }

    // 按知识点分组（模块顺序 → 知识点顺序），便于看到「哪个点反复错」
    var groups = {};
    arr.forEach(function (m) { (groups[m.kp] = groups[m.kp] || []).push(m); });
    var keys = Object.keys(groups).sort(function (a, b) {
      var A = KP[a], B = KP[b];
      if (!A || !B) return (A ? -1 : 1);
      return A.modIdx - B.modIdx || A.kpIdx - B.kpIdx;
    });

    var h = '';
    keys.forEach(function (kid) {
      var list = groups[kid], todo = 0;
      list.forEach(function (m) { if (!m.fixed) todo++; });
      h += '<div class="mis-group"><p class="mis-group-h">' +
        '<b>' + esc(kpTitle(kid)) + '</b>' +
        '<span>' + esc(modName(kid)) + ' · ' + list.length + ' 道，待解决 ' + todo + '</span></p>';
      list.forEach(function (m) {
        h += '<article class="mis' + (m.fixed ? ' done' : '') + '" data-id="' + m.id + '">' +
          '<p class="mis-q">' + hl(m.q, $('#q2').value.trim()) + '</p>' +
          '<div class="mis-meta">' +
          (m.why ? '<span class="tag why">' + esc(whyText(m.why)) + '</span>' : '') +
          (m.src ? '<span class="tag">' + esc(m.src) + '</span>' : '') +
          '<span>' + fmtDate(m.ts) + '</span>' +
          '<span class="mis-acts">' +
          '<button class="mini' + (m.fixed ? ' on' : '') + '" type="button" data-act="fix">' + (m.fixed ? '已弄懂' : '标为已懂') + '</button>' +
          '<button class="mini del" type="button" data-act="del">删</button>' +
          '</span></div>' +
          (m.note ? '<p class="mis-note">' + hl(m.note, $('#q2').value.trim()) + '</p>' : '') +
          '</article>';
      });
      h += '</div>';
    });
    $('#misList').innerHTML = h;
  }

  /* ---------- 知识点详情抽屉 ---------- */
  function openSheet(kid) {
    var o = KP[kid];
    if (!o) return;
    var it = o.it;
    var list = store.mistakes.filter(function (m) { return m.kp === kid; })
      .sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });

    var h = '<div class="grab"></div>' +
      '<p class="sh-mod">' + esc(o.modName) + ' · ' + stars(it.star || 1) + '</p>' +
      '<h2 class="sh-title">' + esc(it.t) + '</h2>' +
      '<p class="sh-core">' + esc(it.core) + '</p>';

    if (it.keys && it.keys.length) {
      h += '<p class="sh-h">必背公式 / 要点</p><ul class="sh-keys">';
      it.keys.forEach(function (k) { h += '<li>' + esc(k) + '</li>'; });
      h += '</ul>';
    }
    if (it.trap) {
      h += '<p class="sh-h">易错点</p><div class="sh-trap">' + esc(it.trap) + '</div>';
    }
    if (it.eg) {
      h += '<p class="sh-h">例题</p><div class="sh-eg"><p>' + esc(it.eg.q) + '</p>' +
        '<details><summary>看答案</summary><p class="ans">' + esc(it.eg.a) + '</p></details></div>';
    }

    h += '<p class="sh-h">这个点的错题（' + list.length + '）</p>';
    if (!list.length) {
      h += '<div class="empty" style="padding:18px">还没有记录</div>';
    } else {
      list.forEach(function (m) {
        h += '<article class="mis' + (m.fixed ? ' done' : '') + '" data-id="' + m.id + '">' +
          '<p class="mis-q">' + esc(m.q) + '</p>' +
          '<div class="mis-meta">' +
          (m.why ? '<span class="tag why">' + esc(whyText(m.why)) + '</span>' : '') +
          '<span>' + fmtDate(m.ts) + '</span>' +
          '<span class="mis-acts">' +
          '<button class="mini' + (m.fixed ? ' on' : '') + '" type="button" data-act="fix">' + (m.fixed ? '已弄懂' : '标为已懂') + '</button>' +
          '<button class="mini del" type="button" data-act="del">删</button>' +
          '</span></div></article>';
      });
    }
    h += '<button class="primary" type="button" id="sheetAdd" style="margin-top:14px">给这个点记一道错题</button>';

    $('#sheetBody').innerHTML = h;
    $('#sheet').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#sheetAdd').addEventListener('click', function () {
      closeSheet();
      go('add');
      $('#fKp').value = kid;
      manualKp = true;
      clearSug();
      setTimeout(function () { $('#fQ').focus(); }, 120);
    });
  }
  function closeSheet() {
    $('#sheet').hidden = true;
    document.body.style.overflow = '';
  }

  /* ---------- 视图切换 ---------- */
  function go(v) {
    var views = { kp: 'view-kp', add: 'view-add', list: 'view-list' };
    Object.keys(views).forEach(function (k) { $('#' + views[k]).classList.toggle('hide', k !== v); });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      b.classList.toggle('on', b.dataset.view === v);
    });
    if (v === 'list') renderList();
    if (v === 'kp') { renderOverview(); renderKp(); }
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* ---------- 表单 ---------- */
  var manualKp = false;
  var whySel = '';
  var sugTimer = null;
  var lastSug = [];

  function fillKpSelect() {
    var html = '<option value="">— 请选择 —</option>';
    MODS.forEach(function (m) {
      html += '<optgroup label="' + esc(m.name) + '">';
      m.items.forEach(function (it) {
        html += '<option value="' + it.id + '">' + esc(it.t) + '</option>';
      });
      html += '</optgroup>';
    });
    $('#fKp').innerHTML = html;

    var f = '<option value="">全部知识点</option>';
    MODS.forEach(function (m) {
      f += '<optgroup label="' + esc(m.name) + '">';
      m.items.forEach(function (it) { f += '<option value="' + it.id + '">' + esc(it.t) + '</option>'; });
      f += '</optgroup>';
    });
    $('#fKpFilter').innerHTML = f;
  }

  function renderWhy() {
    $('#whyList').innerHTML = WHY.map(function (w) {
      return '<button type="button" class="why' + (whySel === w.k ? ' on' : '') + '" data-why="' + w.k + '">' + w.t + '</button>';
    }).join('');
  }

  function clearSug() {
    $('#sugBox').hidden = true;
    $('#sugList').innerHTML = '';
    lastSug = [];
  }

  function suggest() {
    var q = $('#fQ').value.trim();
    if (!CLS || q.length < 4) { clearSug(); return; }
    var res = CLS.rank(q, 3);
    if (!res.length) { clearSug(); return; }
    lastSug = res;
    var cur = $('#fKp').value;
    $('#sugList').innerHTML = res.map(function (r, i) {
      var on = cur === r.id || (!cur && i === 0);
      return '<button type="button" class="sug-item' + (on ? ' on' : '') + '" data-kp="' + r.id + '">' +
        '<span class="si-t">' + esc(r.title) + '<span class="si-hit">' + (r.hits.length ? '　命中：' + esc(r.hits.slice(0, 3).join(' ')) : '') + '</span></span>' +
        '<span class="si-m">' + esc(r.modName) + '</span></button>';
    }).join('');
    $('#sugBox').hidden = false;

    // 用户没手动选过，就默认取第一个
    if (!manualKp && res[0]) $('#fKp').value = res[0].id;
  }

  function submitForm(e) {
    e.preventDefault();
    var q = $('#fQ').value.trim();
    var kp = $('#fKp').value;
    if (!q) { toast('题干不能为空'); $('#fQ').focus(); return; }
    if (!kp) { toast('选一个归属知识点'); $('#fKp').focus(); return; }
    var m = {
      id: uid(),
      q: q,
      kp: kp,
      why: whySel || '',
      src: $('#fSrc').value.trim(),
      note: $('#fNote').value.trim(),
      fixed: 0,
      ts: Date.now()
    };
    store.mistakes.push(m);
    save();

    // 重置（保留知识点，方便连记同一类）
    $('#fQ').value = '';
    $('#fSrc').value = '';
    $('#fNote').value = '';
    whySel = '';
    renderWhy();
    clearSug();
    manualKp = false;
    renderHeader();
    toast('已归入「' + kpTitle(kp) + '」');
    go('list');
  }

  /* ---------- 备份 ---------- */
  function exportJSON() {
    var payload = {
      app: 'math-review',
      v: 1,
      exportedAt: new Date().toISOString(),
      kpTotal: TOTAL_KP,
      mistakes: store.mistakes
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '数学错题_' + ymd(new Date()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast('已导出 ' + store.mistakes.length + ' 道错题');
  }

  var pendingImport = null;

  function handleFile(file) {
    var fr = new FileReader();
    fr.onload = function () {
      var d;
      try { d = JSON.parse(fr.result); } catch (err) { toast('文件不是合法 JSON'); return; }
      var arr = d && Array.isArray(d.mistakes) ? d.mistakes : (Array.isArray(d) ? d : null);
      if (!arr) { toast('文件里没有错题数据'); return; }
      var clean = arr.filter(function (m) { return m && typeof m.q === 'string' && m.q.trim(); }).map(function (m) {
        return {
          id: m.id || uid(),
          q: m.q,
          kp: m.kp || '',
          why: m.why || '',
          src: m.src || '',
          note: m.note || '',
          fixed: m.fixed ? 1 : 0,
          ts: m.ts || Date.now()
        };
      });
      if (!clean.length) { toast('文件里没有有效错题'); return; }
      pendingImport = clean;
      var bar = $('#importBar');
      bar.hidden = false;
      bar.innerHTML = '读到 <b>' + clean.length + '</b> 道错题。怎么处理？' +
        '<div class="ib-act">' +
        '<button type="button" id="impMerge" style="border:1px solid #d5e2ee;background:#fff;color:#1b3a5c">合并（去重）</button>' +
        '<button type="button" id="impReplace" style="border:1px solid #eccdbc;background:#fff;color:#b4552d">覆盖现有</button>' +
        '<button type="button" id="impCancel" style="border:1px solid #e6e1d7;background:#fff;color:#86868b">取消</button>' +
        '</div>';
      $('#impMerge').onclick = function () {
        var have = {};
        store.mistakes.forEach(function (m) { have[m.id] = 1; });
        var added = 0;
        clean.forEach(function (m) { if (!have[m.id]) { store.mistakes.push(m); have[m.id] = 1; added++; } });
        save(); afterImport('合并完成，新增 ' + added + ' 道');
      };
      $('#impReplace').onclick = function () {
        if (!confirm('覆盖会清掉现有的 ' + store.mistakes.length + ' 道错题，确定？')) return;
        store.mistakes = clean;
        save(); afterImport('已覆盖为 ' + clean.length + ' 道');
      };
      $('#impCancel').onclick = function () {
        pendingImport = null; bar.hidden = true; bar.innerHTML = '';
      };
    };
    fr.readAsText(file);
  }

  function afterImport(msg) {
    pendingImport = null;
    var bar = $('#importBar');
    bar.hidden = true; bar.innerHTML = '';
    $('#fileIn').value = '';
    renderHeader(); renderOverview(); renderKp(); renderList();
    toast(msg);
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    $('#tabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (b) go(b.dataset.view);
    });

    // 知识点：模块折叠 / 进入详情
    $('#kpList').addEventListener('click', function (e) {
      var head = e.target.closest('.mod-head');
      if (head) {
        var mod = head.closest('.mod');
        var id = head.dataset.mod;
        var willOpen = !mod.classList.contains('open');
        mod.classList.toggle('open', willOpen);
        openMods[id] = willOpen;
        return;
      }
      var row = e.target.closest('.kp-row');
      if (row) openSheet(row.dataset.kp);
    });

    $('#q').addEventListener('input', renderKp);
    $('#onlyWrong').addEventListener('change', function () {
      if (this.checked) MODS.forEach(function (m) { openMods[m.id] = true; });
      renderKp();
    });
    $('#toggleAll').addEventListener('click', function () {
      var anyClosed = MODS.some(function (m) { return !openMods[m.id]; });
      MODS.forEach(function (m) { openMods[m.id] = anyClosed; });
      this.textContent = anyClosed ? '全部收起' : '全部展开';
      renderKp();
    });

    // 概览条：跳到对应模块
    $('#overview').addEventListener('click', function (e) {
      var r = e.target.closest('[data-jump]');
      if (!r) return;
      var id = r.dataset.jump;
      openMods[id] = true;
      renderKp();
      var el = $('#mod-' + id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // 错题本操作
    $('#misList').addEventListener('click', function (e) {
      var art = e.target.closest('.mis');
      if (!art) return;
      var id = art.dataset.id;
      var m = store.mistakes.filter(function (x) { return x.id === id; })[0];
      if (!m) return;
      var btn = e.target.closest('[data-act]');
      if (btn) {
        if (btn.dataset.act === 'fix') {
          m.fixed = m.fixed ? 0 : 1;
          save(); renderHeader(); renderList(); renderOverview(); renderKp();
          toast(m.fixed ? '标记为已弄懂' : '重新放回待解决');
        } else if (btn.dataset.act === 'del') {
          if (!confirm('删除这道错题？不可恢复。')) return;
          store.mistakes = store.mistakes.filter(function (x) { return x.id !== id; });
          save(); renderHeader(); renderList(); renderOverview(); renderKp();
          toast('已删除');
        }
        return;
      }
      if (e.target.closest('.mis-q')) art.classList.toggle('open');
    });

    // 抽屉内的操作
    $('#sheet').addEventListener('click', function (e) {
      if (e.target.dataset.close) { closeSheet(); return; }
      var art = e.target.closest('.mis');
      var btn = e.target.closest('[data-act]');
      if (art && btn) {
        var id = art.dataset.id;
        var m = store.mistakes.filter(function (x) { return x.id === id; })[0];
        if (!m) return;
        if (btn.dataset.act === 'fix') {
          m.fixed = m.fixed ? 0 : 1;
          save(); renderHeader(); renderOverview(); renderKp(); renderList();
          openSheet(m.kp);   // 刷新抽屉
        } else if (btn.dataset.act === 'del') {
          if (!confirm('删除这道错题？不可恢复。')) return;
          var kp = m.kp;
          store.mistakes = store.mistakes.filter(function (x) { return x.id !== id; });
          save(); renderHeader(); renderOverview(); renderKp(); renderList();
          openSheet(kp);
        }
      }
    });

    $('#q2').addEventListener('input', renderList);
    $('#onlyTodo').addEventListener('change', renderList);
    $('#fKpFilter').addEventListener('change', renderList);

    // 表单
    $('#fQ').addEventListener('input', function () {
      clearTimeout(sugTimer);
      sugTimer = setTimeout(suggest, 320);
    });
    $('#fKp').addEventListener('change', function () { manualKp = !!this.value; });
    $('#sugList').addEventListener('click', function (e) {
      var b = e.target.closest('.sug-item');
      if (!b) return;
      $('#fKp').value = b.dataset.kp;
      manualKp = true;
      Array.prototype.forEach.call(this.querySelectorAll('.sug-item'), function (x) {
        x.classList.toggle('on', x === b);
      });
      toast('已归入「' + kpTitle(b.dataset.kp) + '」');
    });
    $('#whyList').addEventListener('click', function (e) {
      var b = e.target.closest('.why');
      if (!b) return;
      whySel = (whySel === b.dataset.why) ? '' : b.dataset.why;
      renderWhy();
    });
    $('#addForm').addEventListener('submit', submitForm);

    // 备份
    $('#btnBackup').addEventListener('click', function () { $('#modal').hidden = false; });
    $('#btnCloseModal').addEventListener('click', function () {
      $('#modal').hidden = true;
      $('#importBar').hidden = true;
      $('#importBar').innerHTML = '';
    });
    $('#modal').addEventListener('click', function (e) {
      if (e.target === this) { this.hidden = true; }
    });
    $('#btnExport').addEventListener('click', exportJSON);
    $('#btnImport').addEventListener('click', function () { $('#fileIn').click(); });
    $('#fileIn').addEventListener('change', function () {
      if (this.files && this.files[0]) handleFile(this.files[0]);
    });
    $('#btnClear').addEventListener('click', function () {
      if (!store.mistakes.length) { toast('本来就是空的'); return; }
      if (!confirm('清空全部 ' + store.mistakes.length + ' 道错题？建议先导出备份。')) return;
      if (!confirm('再确认一次：清空后无法恢复。')) return;
      store.mistakes = [];
      save();
      renderHeader(); renderOverview(); renderKp(); renderList();
      $('#modal').hidden = true;
      toast('已清空');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$('#modal').hidden) { $('#modal').hidden = true; return; }
        if (!$('#sheet').hidden) closeSheet();
      }
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    if (!DATA.length) {
      document.body.innerHTML = '<p style="padding:40px;text-align:center;color:#b4552d">知识点数据 load 失败：检查 assets/data.js 是否存在。</p>';
      return;
    }
    fillKpSelect();
    renderWhy();
    renderHeader();
    renderOverview();
    renderKp();
    bind();
    if (!canStore) $('#statline').innerHTML += ' <b style="color:#b4552d">（浏览器禁用了本地存储，本次记录不会保存）</b>';
  }

  init();
})();
