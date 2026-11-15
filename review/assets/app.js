/* 数学错题本 —— 原生 JS，无依赖
   1) 知识点概览 / 折叠 / 详情抽屉
   2) 手抄一道错题，边打字边自动归类
   3) 拍照整卷 → 按行间空白切题 → 每题挂知识点（图片存 IndexedDB）
   4) 错题本按知识点分组、标记已弄懂、导出导入 JSON */
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
  var MODS = DATA.map(function (m) {
    return {
      id: m.id,
      book: m.book || '',
      name: m.name,
      full: (m.book ? m.book + ' · ' : '') + m.name,
      items: m.items
    };
  });
  var KP = {};          // kpId -> {it, modId, modFull, modName, modIdx, kpIdx}
  MODS.forEach(function (m, mi) {
    m.items.forEach(function (it, ii) {
      KP[it.id] = { it: it, modId: m.id, modName: m.name, modFull: m.full, modIdx: mi, kpIdx: ii };
    });
  });
  if (CLS) CLS.build(MODS.map(function (m) { return { id: m.id, name: m.name, items: m.items }; }));

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

  /* ---------- 题图：IndexedDB ---------- */
  var IMG = (function () {
    var db = null, broken = false;
    function open() {
      return new Promise(function (res, rej) {
        if (db) return res(db);
        if (broken || !window.indexedDB) return rej(new Error('no-idb'));
        var req = indexedDB.open('gsmath-img', 1);
        req.onupgradeneeded = function () {
          var d = req.result;
          if (!d.objectStoreNames.contains('img')) d.createObjectStore('img');
        };
        req.onsuccess = function () { db = req.result; res(db); };
        req.onerror = function () { broken = true; rej(req.error); };
      });
    }
    function put(id, blob) {
      return open().then(function (d) {
        return new Promise(function (res, rej) {
          var tx = d.transaction('img', 'readwrite');
          tx.objectStore('img').put(blob, id);
          tx.oncomplete = function () { res(id); };
          tx.onerror = function () { rej(tx.error); };
        });
      });
    }
    function get(id) {
      return open().then(function (d) {
        return new Promise(function (res, rej) {
          var tx = d.transaction('img', 'readonly');
          var rq = tx.objectStore('img').get(id);
          rq.onsuccess = function () { res(rq.result || null); };
          rq.onerror = function () { rej(rq.error); };
        });
      });
    }
    function del(id) {
      return open().then(function (d) {
        return new Promise(function (res) {
          var tx = d.transaction('img', 'readwrite');
          tx.objectStore('img').delete(id);
          tx.oncomplete = function () { res(1); };
          tx.onerror = function () { res(0); };
        });
      }).catch(function () { return 0; });
    }
    return { put: put, get: get, del: del };
  })();

  var urlCache = {};

  function hydrateImgs(root) {
    Array.prototype.forEach.call(root.querySelectorAll('img[data-img]'), function (el) {
      var id = el.getAttribute('data-img');
      if (urlCache[id]) { el.src = urlCache[id]; return; }
      IMG.get(id).then(function (b) {
        if (!b) { el.classList.add('gone'); el.alt = '题图未随备份迁移'; return; }
        var u = URL.createObjectURL(b);
        urlCache[id] = u;
        el.src = u;
      }).catch(function () { el.alt = '题图读取失败'; });
    });
  }

  /* ---------- 工具 ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
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
  function modName(id) { return KP[id] ? KP[id].modFull : ''; }
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
  function rid(pre) {
    return (pre || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function uid() { return rid('m'); }

  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = 'position:fixed;left:50%;bottom:calc(26px + env(safe-area-inset-bottom));transform:translateX(-50%);' +
        'background:rgba(12,17,23,.94);color:#fff;font-size:13px;padding:9px 16px;border-radius:8px;z-index:99;' +
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
      ? '错题 <b>' + s.total + '</b> 道 · 待解决 <i>' + s.todo + '</i><br>已弄懂 <b>' + s.fixed + '</b> · 覆盖 <b>' + s.kps + '</b> 个知识点'
      : '还没有错题。<br>去「＋ 记错题」或「拍照切题」开始。';
    var dot = $('#cntList');
    dot.textContent = s.todo || '';
    dot.className = 'dot' + (s.todo ? ' show' : '');
  }

  /* ---------- 概览 ---------- */
  function renderOverview() {
    var s = stat();
    var h = '<div class="ov-top">' +
      '<div class="ov-num"><b>' + s.total + '</b><span>道错题</span></div>' +
      '<div class="ov-num' + (s.todo ? ' warn' : '') + '"><b>' + s.todo + '</b><span>待解决</span></div>' +
      '<div class="ov-num' + (s.fixed ? ' ok' : '') + '"><b>' + s.fixed + '</b><span>已弄懂</span></div>' +
      '<div class="ov-num"><b>' + s.kps + '</b><span>涉及知识点</span></div>' +
      '</div>';

    if (s.total) {
      var max = 1;
      for (var k in s.byMod) if (s.byMod[k] > max) max = s.byMod[k];
      h += '<div class="bars">';
      MODS.forEach(function (m) {
        var c = s.byMod[m.id] || 0;
        var w = c ? Math.max(6, Math.round(c / max * 100)) : 0;
        h += '<div class="bar-row' + (c ? '' : ' zero') + '" data-jump="' + m.id + '">' +
          '<span class="bn">' + esc(m.full) + '</span>' +
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
    var lastBook = '';

    MODS.forEach(function (m) {
      var items = m.items.filter(function (it) {
        if (onlyWrong && !s.byKp[it.id]) return false;
        if (!kw) return true;
        var hay = [m.full, m.name, it.t, it.core, (it.keys || []).join(' '), it.trap || ''].join(' ').toLowerCase();
        return hay.indexOf(kw) >= 0;
      });
      if (!items.length) return;

      // 册做分组标题，章只显示章名，避免每行重复「必修一 ·」
      if (m.book !== lastBook) {
        h += '<p class="book-title">' + esc(m.book || '其他') + '</p>';
        lastBook = m.book;
      }

      var modWrong = s.byMod[m.id] || 0;
      var isOpen = openMods[m.id] || (kw && items.length <= 4) || onlyWrong;
      h += '<section class="mod' + (isOpen ? ' open' : '') + '" id="mod-' + m.id + '">' +
        '<button class="mod-head" type="button" data-mod="' + m.id + '">' +
        '<span class="mod-name">' + esc(m.name) + '</span>' +
        '<span class="mod-cnt">' + (modWrong ? '错题 ' + modWrong + ' · ' : '') + items.length + ' 点</span>' +
        '<i class="caret"></i></button><div class="mod-body"><div class="mod-inner">';

      items.forEach(function (it) {
        var n = s.byKp[it.id] || 0;
        h += '<div class="kp-row' + (n ? ' has-mis' : '') + '" data-kp="' + it.id + '">' +
          '<span class="kp-stars">' + stars(it.star || 1) + '</span>' +
          '<span class="kp-t">' + hl(it.t, kpKw) + '</span>' +
          '<span class="badge' + (n ? ' hot' : '') + '">' + (n || '·') + '</span></div>';
      });
      h += '</div></div></section>';
    });

    $('#kpList').innerHTML = h || '<div class="empty">没有匹配的知识点</div>';
  }

  /* ---------- 错题卡（列表与抽屉共用） ---------- */
  function misCard(m, kw) {
    return '<article class="mis' + (m.fixed ? ' done' : '') + '" data-id="' + m.id + '">' +
      (m.img ? '<img class="mis-img" data-img="' + esc(m.img) + '" data-zoom="1" alt="题图">' : '') +
      '<p class="mis-q">' + hl(m.q, kw) + '</p>' +
      '<div class="mis-meta">' +
      (m.why ? '<span class="tag why">' + esc(whyText(m.why)) + '</span>' : '') +
      (m.src ? '<span class="tag">' + esc(m.src) + '</span>' : '') +
      '<span>' + fmtDate(m.ts) + '</span>' +
      '<span class="mis-acts">' +
      '<button class="mini' + (m.fixed ? ' on' : '') + '" type="button" data-act="fix">' + (m.fixed ? '已弄懂' : '标为已懂') + '</button>' +
      '<button class="mini del" type="button" data-act="del">删</button>' +
      '</span></div>' +
      (m.note ? '<p class="mis-note">' + hl(m.note, kw) + '</p>' : '') +
      '</article>';
  }

  /* ---------- 错题本 ---------- */
  function renderList() {
    var kwRaw = $('#q2').value.trim();
    var kw = kwRaw.toLowerCase();
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
      $('#misList').innerHTML = '<div class="empty">' +
        (store.mistakes.length ? '没有符合筛选条件的错题' : '错题本是空的。点上面「＋ 记错题」或「拍照切题」开始。') + '</div>';
      return;
    }

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
      list.forEach(function (m) { h += misCard(m, kwRaw); });
      h += '</div>';
    });
    $('#misList').innerHTML = h;
    hydrateImgs($('#misList'));
  }

  /* ---------- 知识点详情抽屉 ---------- */
  function openSheet(kid) {
    var o = KP[kid];
    if (!o) return;
    var it = o.it;
    var list = store.mistakes.filter(function (m) { return m.kp === kid; })
      .sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });

    var h = '<div class="grab"></div>' +
      '<p class="sh-mod">' + esc(o.modFull) + ' · ' + stars(it.star || 1) + '</p>' +
      '<h2 class="sh-title">' + esc(it.t) + '</h2>' +
      '<p class="sh-core">' + esc(it.core) + '</p>';

    var figSvg = (window.MATH_FIG && window.MATH_FIG[it.id]) || '';
    if (figSvg) h += '<figure class="fig">' + figSvg + '</figure>';

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
      list.forEach(function (m) { h += misCard(m, ''); });
    }
    h += '<button class="primary" type="button" id="sheetAdd" style="margin-top:14px">给这个点记一道错题</button>';

    $('#sheetBody').innerHTML = h;
    hydrateImgs($('#sheetBody'));
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
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var curView = '';
  var thumbEl = null;
  var tabsNav = $('#tabs');
  var mainEl = document.querySelector('main');

  /* 滑块：跟着选中的 tab 平滑移动；窄屏切横向时自动换成左右滑 */
  function syncThumb() {
    if (!thumbEl) {
      thumbEl = document.createElement('span');
      thumbEl.className = 'thumb';
      thumbEl.setAttribute('aria-hidden', 'true');
      tabsNav.insertBefore(thumbEl, tabsNav.firstChild);
    }
    var cur = tabsNav.querySelector('.tab.on');
    if (!cur) { thumbEl.style.opacity = '0'; return; }
    var row = getComputedStyle(tabsNav).flexDirection === 'row';
    thumbEl.style.opacity = '1';
    if (row) {
      thumbEl.style.width = cur.offsetWidth + 'px';
      thumbEl.style.height = cur.offsetHeight + 'px';
      thumbEl.style.transform = 'translateX(' + cur.offsetLeft + 'px)';
    } else {
      thumbEl.style.width = '';
      thumbEl.style.height = cur.offsetHeight + 'px';
      thumbEl.style.transform = 'translateY(' + cur.offsetTop + 'px)';
    }
  }

  function applyView(v) {
    var views = { kp: 'view-kp', add: 'view-add', scan: 'view-scan', list: 'view-list' };
    Object.keys(views).forEach(function (k) { $('#' + views[k]).classList.toggle('hide', k !== v); });
    if (v === 'list') renderList();
    if (v === 'kp') { renderOverview(); renderKp(); }
    if (v === 'scan') refreshScan();
  }

  function go(v) {
    if (v === curView) return;
    var first = !curView;
    curView = v;

    // 滑块先起步，不等视图重绘
    $$('.tab').forEach(function (b) { b.classList.toggle('on', b.dataset.view === v); });
    syncThumb();

    if (first || REDUCE) {
      applyView(v);
      window.scrollTo(0, 0);
      return;
    }
    mainEl.classList.add('leaving');
    window.scrollTo(0, 0);
    setTimeout(function () {
      applyView(v);
      mainEl.classList.remove('leaving');
      mainEl.classList.add('entering');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { mainEl.classList.remove('entering'); });
      });
    }, 110);
  }

  /* ---------- 手动表单 ---------- */
  var manualKp = false;
  var whySel = '';
  var sugTimer = null;
  var lastSug = [];

  function fillKpSelect() {
    var html = '<option value="">— 请选择 —</option>';
    MODS.forEach(function (m) {
      html += '<optgroup label="' + esc(m.full) + '">';
      m.items.forEach(function (it) {
        html += '<option value="' + it.id + '">' + esc(it.t) + '</option>';
      });
      html += '</optgroup>';
    });
    $('#fKp').innerHTML = html;

    var f = '<option value="">全部知识点</option>';
    MODS.forEach(function (m) {
      f += '<optgroup label="' + esc(m.full) + '">';
      m.items.forEach(function (it) { f += '<option value="' + it.id + '">' + esc(it.t) + '</option>'; });
      f += '</optgroup>';
    });
    $('#fKpFilter').innerHTML = f;
  }

  function kpOptions(sel) {
    var html = '<option value="">— 选知识点 —</option>';
    MODS.forEach(function (m) {
      html += '<optgroup label="' + esc(m.full) + '">';
      m.items.forEach(function (it) {
        html += '<option value="' + it.id + '"' + (sel === it.id ? ' selected' : '') + '>' + esc(it.t) + '</option>';
      });
      html += '</optgroup>';
    });
    return html;
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

  function sugHtml(res, cur) {
    return res.map(function (r, i) {
      var on = cur === r.id || (!cur && i === 0);
      return '<button type="button" class="sug-item' + (on ? ' on' : '') + '" data-kp="' + r.id + '">' +
        '<span class="si-t">' + esc(r.title) +
        '<span class="si-hit">' + (r.hits && r.hits.length ? '　命中：' + esc(r.hits.slice(0, 3).join(' ')) : '') + '</span></span>' +
        '<span class="si-m">' + esc(KP[r.id] ? KP[r.id].modFull : '') + '</span></button>';
    }).join('');
  }

  function suggest() {
    var q = $('#fQ').value.trim();
    if (!CLS || q.length < 4) { clearSug(); return; }
    var res = CLS.rank(q, 3);
    if (!res.length) { clearSug(); return; }
    lastSug = res;
    var cur = $('#fKp').value;
    $('#sugList').innerHTML = sugHtml(res, cur);
    $('#sugBox').hidden = false;
    if (!manualKp && res[0]) $('#fKp').value = res[0].id;
  }

  function submitForm(e) {
    e.preventDefault();
    var q = $('#fQ').value.trim();
    var kp = $('#fKp').value;
    if (!q) { toast('题干不能为空'); $('#fQ').focus(); return; }
    if (!kp) { toast('选一个归属知识点'); $('#fKp').focus(); return; }
    store.mistakes.push({
      id: uid(),
      q: q,
      kp: kp,
      why: whySel || '',
      src: $('#fSrc').value.trim(),
      note: $('#fNote').value.trim(),
      fixed: 0,
      ts: Date.now()
    });
    save();

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

  /* ==================================================
     拍照切题
     ================================================== */
  var scanItems = [];      // {sid, cv, y0, y1, blob, url, text, kp}
  var scanBusy = false;

  function scanEls() { return $$('#scanList .qb'); }

  function refreshScan() {
    $('#scanNote').hidden = !scanItems.length;
    $('#btnSaveAll').style.display = scanItems.length > 1 ? 'block' : 'none';
  }

  /* 行投影：找出题目之间的空白带 */
  function segmentPage(cv, opts) {
    var W = cv.width, H = cv.height;
    var d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    var ink = new Uint32Array(H);
    for (var y = 0; y < H; y++) {
      var off = y * W * 4, c = 0;
      for (var x = 0; x < W; x++) {
        var i = off + x * 4;
        var g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
        if (g < 168) c++;
      }
      ink[y] = c;
    }
    var blankMin = Math.max(2, Math.round(W * 0.006));
    var minGap = Math.max(12, Math.round(H * (opts && opts.minGap ? opts.minGap : 0.016)));

    var gaps = [], s = -1;
    for (var y2 = 0; y2 < H; y2++) {
      var blank = ink[y2] <= blankMin;
      if (blank) { if (s < 0) s = y2; }
      else if (s >= 0) { if (y2 - s >= minGap) gaps.push([s, y2]); s = -1; }
    }
    if (s >= 0 && H - s >= minGap) gaps.push([s, H]);

    var bounds = [0];
    gaps.forEach(function (g) {
      var mid = Math.round((g[0] + g[1]) / 2);
      if (mid > H * 0.015 && mid < H * 0.985) bounds.push(mid);
    });
    bounds.push(H);
    bounds.sort(function (a, b) { return a - b; });

    var minH = Math.max(20, Math.round(H * 0.018));
    var blocks = [];
    for (var j = 0; j < bounds.length - 1; j++) {
      var a = bounds[j], b = bounds[j + 1];
      if (b - a < minH) continue;
      // 去掉块内首尾空白
      var top = -1, bot = -1;
      for (var k = a; k < b; k++) {
        if (ink[k] > blankMin) { if (top < 0) top = k; bot = k; }
      }
      if (top < 0) continue;
      blocks.push({ y0: top, y1: bot + 1 });
    }
    if (!blocks.length) blocks.push({ y0: 0, y1: H });
    return blocks;
  }

  function cropFrom(cv, y0, y1) {
    var pad = 6;
    var a = Math.max(0, y0 - pad), b = Math.min(cv.height, y1 + pad);
    var c2 = document.createElement('canvas');
    c2.width = cv.width;
    c2.height = b - a;
    c2.getContext('2d').drawImage(cv, 0, a, cv.width, b - a, 0, 0, cv.width, b - a);
    return new Promise(function (res) {
      c2.toBlob(function (bl) { res({ blob: bl, y0: a, y1: b }); }, 'image/jpeg', 0.82);
    });
  }

  function loadBitmap(file) {
    return new Promise(function (res, rej) {
      if (window.createImageBitmap) {
        createImageBitmap(file).then(res).catch(rej);
        return;
      }
      var img = new Image();
      var u = URL.createObjectURL(file);
      img.onload = function () { res(img); URL.revokeObjectURL(u); };
      img.onerror = rej;
      img.src = u;
    });
  }

  function handleImages(files) {
    if (scanBusy) return;
    scanBusy = true;
    var list = Array.prototype.slice.call(files);
    $('#scanNote').hidden = false;
    $('#scanNote').firstElementChild.textContent = '正在切题，' + list.length + ' 张图…';

    var chain = Promise.resolve();
    list.forEach(function (f) {
      chain = chain.then(function () {
        return loadBitmap(f).then(function (bmp) {
          var scale = Math.min(1, 1280 / bmp.width);
          var W = Math.round(bmp.width * scale);
          var H = Math.round(bmp.height * scale);
          var cv = document.createElement('canvas');
          cv.width = W;
          cv.height = H;
          cv.getContext('2d').drawImage(bmp, 0, 0, W, H);
          var blocks = segmentPage(cv);
          return blocks.reduce(function (p, bl) {
            return p.then(function () {
              return cropFrom(cv, bl.y0, bl.y1).then(function (r) {
                scanItems.push({
                  sid: rid('s'), cv: cv, y0: r.y0, y1: r.y1,
                  blob: r.blob, url: URL.createObjectURL(r.blob), text: '', kp: ''
                });
              });
            });
          }, Promise.resolve());
        }).catch(function () { toast('有一张图读不出来，跳过'); });
      });
    });

    chain.then(function () {
      scanBusy = false;
      renderScan();
      var n = scanItems.length;
      if (n) toast('切出 ' + n + ' 块，逐块填关键词即可归类');
      else toast('没切出内容，换一张清晰点的图');
    });
  }

  function renderScan() {
    var h = scanItems.map(function (it, i) {
      var dim = it.cv ? (it.cv.width + '×' + (it.y1 - it.y0)) : '文字题';
      return '<article class="qb" data-sid="' + it.sid + '">' +
        '<div class="qb-top">' +
        '<span class="qb-no">' + (i + 1) + '</span>' +
        '<span class="qb-dim">' + dim + '</span>' +
        '<span class="qb-tools">' +
        (i > 0 ? '<button class="mini" type="button" data-act="merge">↑合并上一块</button>' : '') +
        (it.cv ? '<button class="mini" type="button" data-act="split">拆开</button>' : '') +
        '<button class="mini del" type="button" data-act="drop">移除</button>' +
        '</span></div>' +
        (it.url ? '<img class="qb-img" src="' + it.url + '" data-zoom="1" alt="题图">' : '') +
        '<div class="qb-body">' +
        '<textarea class="qb-q" rows="' + (it.cv ? 2 : 4) + '" placeholder="抄一句题干 / 关键词，例如「椭圆 离心率 求方程」——填了就能自动归类">' + esc(it.text) + '</textarea>' +
        '<div class="sug-list" data-sugs="' + it.sid + '" style="margin-top:9px">' + sugHtml(sugFor(it), it.kp) + '</div>' +
        '<div class="qb-foot">' +
        '<select data-kpsel="' + it.sid + '">' + kpOptions(it.kp) + '</select>' +
        '<button class="mini blue" type="button" data-act="save">存入</button>' +
        '</div></div></article>';
    }).join('');

    $('#scanList').innerHTML = h;
    refreshScan();
  }

  function sugFor(it) {
    if (!CLS || (it.text || '').trim().length < 4) return [];
    return CLS.rank(it.text, 3);
  }

  function findScan(sid) {
    for (var i = 0; i < scanItems.length; i++) if (scanItems[i].sid === sid) return scanItems[i];
    return null;
  }

  function saveScanItem(sid) {
    var it = findScan(sid);
    if (!it) return;
    var q = (it.text || '').trim();
    if (!q) { toast('先写一句题干或关键词，才能归类'); return; }
    if (!it.kp) { toast('选一个知识点'); return; }
    var m = {
      id: uid(), q: q, kp: it.kp, why: '',
      src: $('#scanSrc').value.trim(), note: '', fixed: 0, ts: Date.now()
    };
    var imgId = rid('i');
    IMG.put(imgId, it.blob).then(function () {
      m.img = imgId;
    }).catch(function () {}).then(function () {
      store.mistakes.push(m);
      save();
      dropScan(sid);
      renderHeader();
      toast('已归入「' + kpTitle(m.kp) + '」');
    });
  }

  function dropScan(sid) {
    for (var i = 0; i < scanItems.length; i++) {
      if (scanItems[i].sid === sid) {
        URL.revokeObjectURL(scanItems[i].url);
        scanItems.splice(i, 1);
        break;
      }
    }
    renderScan();
  }

  function mergeUp(sid) {
    var idx = scanItems.findIndex(function (x) { return x.sid === sid; });
    if (idx <= 0) return;
    var cur = scanItems[idx], prev = scanItems[idx - 1];
    if (cur.cv !== prev.cv) { toast('跨页的两块不能合并'); return; }
    var y0 = Math.min(prev.y0, cur.y0), y1 = Math.max(prev.y1, cur.y1);
    cropFrom(prev.cv, y0, y1).then(function (r) {
      URL.revokeObjectURL(prev.url);
      URL.revokeObjectURL(cur.url);
      prev.y0 = r.y0; prev.y1 = r.y1; prev.blob = r.blob;
      prev.url = URL.createObjectURL(r.blob);
      prev.text = [prev.text, cur.text].filter(Boolean).join('\n');
      scanItems.splice(idx, 1);
      renderScan();
    });
  }

  function splitBlock(sid) {
    var it = findScan(sid);
    if (!it) return;
    var sub = document.createElement('canvas');
    var h = it.y1 - it.y0;
    sub.width = it.cv.width;
    sub.height = h;
    sub.getContext('2d').drawImage(it.cv, 0, it.y0, it.cv.width, h, 0, 0, it.cv.width, h);
    var parts = segmentPage(sub, { minGap: 0.008 });
    if (parts.length < 2) { toast('这一块切不开，试着整块存或换张图'); return; }
    var idx = scanItems.indexOf(it);
    var made = [];
    var chain = parts.reduce(function (p, bl) {
      return p.then(function () {
        var full = { y0: it.y0 + bl.y0, y1: it.y0 + bl.y1 };
        return cropFrom(it.cv, full.y0, full.y1).then(function (r) {
          made.push({
            sid: rid('s'), cv: it.cv, y0: r.y0, y1: r.y1,
            blob: r.blob, url: URL.createObjectURL(r.blob), text: '', kp: ''
          });
        });
      });
    }, Promise.resolve());
    chain.then(function () {
      URL.revokeObjectURL(it.url);
      scanItems.splice.apply(scanItems, [idx, 1].concat(made));
      renderScan();
      toast('拆成 ' + made.length + ' 块');
    });
  }

  function splitWholeText(txt) {
    var s = String(txt || '').replace(/\r/g, '').replace(/\u00a0/g, ' ').trim();
    if (!s) { toast('先把题目文字贴进来'); return; }
    var lines = s.split('\n');
    // 主切分：1. / 1、/ 1）/ 第1题 —— 小问「（1）」不单独成题
    var RE_MAIN = /^\s*(?:\d{1,2}\s*[.、．)）](?!\d)|第\s*\d{1,2}\s*题)/;
    // 没有主题号（整卷都是小问）时才退回用「（1）」切
    var RE_SUB = /^\s*[(（]\s*\d{1,2}\s*[)）]/;

    function markLines(re) {
      var m = [];
      lines.forEach(function (ln, i) {
        if (re.test(ln) && ln.trim().length > 2 && m.length < 120) m.push(i);
      });
      return m;
    }

    var marks = markLines(RE_MAIN);
    if (marks.length < 2) marks = markLines(RE_SUB);

    var chunks = [];
    if (marks.length < 2) {
      chunks = [s];
    } else {
      for (var i = 0; i < marks.length; i++) {
        var a = marks[i];
        var b = i + 1 < marks.length ? marks[i + 1] : lines.length;
        var body = lines.slice(a, b).join('\n').trim();
        if (body) chunks.push(body);
      }
      var head = lines.slice(0, marks[0]).join('\n').trim();
      if (head && chunks.length) chunks[0] = head + '\n' + chunks[0];
    }
    chunks.forEach(function (q) {
      var kp = '';
      if (CLS && q.length >= 4) {
        var r = CLS.rank(q, 3);
        if (r[0]) kp = r[0].id;
      }
      scanItems.push({
        sid: rid('s'), cv: null, y0: 0, y1: 0, blob: null, url: '',
        text: q, kp: kp
      });
    });
    $('#fWhole').value = '';
    renderScan();
    toast('切出 ' + chunks.length + ' 道题，已按内容预设知识点');
  }

  /* ---------- 备份 ---------- */
  function blobToDataURL(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = function () { rej(fr.error); };
      fr.readAsDataURL(blob);
    });
  }

  function dataURLToBlob(u) {
    var m = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(String(u || ''));
    if (!m) return null;
    try {
      if (m[2]) {
        var bin = atob(m[3]);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: m[1] || 'image/jpeg' });
      }
      return new Blob([decodeURIComponent(m[3])], { type: m[1] || 'image/jpeg' });
    } catch (e) {
      return null;
    }
  }

  function exportJSON() {
    // 复制一份再挂 base64，绝不能写回 store（否则 localStorage 会被图片撑爆）
    var out = store.mistakes.map(function (m) {
      var c = {};
      for (var k in m) c[k] = m[k];
      return c;
    });
    var has = out.filter(function (m) { return m.img; });
    if (has.length) toast('正在打包 ' + has.length + ' 张题图…');

    var lost = 0;
    var chain = has.reduce(function (p, m) {
      return p.then(function () {
        return IMG.get(m.img).then(function (b) {
          if (!b) { lost++; return; }
          return blobToDataURL(b).then(function (u) { m.imgData = u; });
        }).catch(function () { lost++; });
      });
    }, Promise.resolve());

    chain.then(function () {
      var payload = {
        app: 'math-review',
        v: 2,
        withImages: has.length > 0,
        exportedAt: new Date().toISOString(),
        kpTotal: TOTAL_KP,
        mistakes: out
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = '数学错题_' + ymd(new Date()) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);

      var mb = (blob.size / 1048576).toFixed(1);
      toast('已导出 ' + out.length + ' 道，' + mb + ' MB' +
        (has.length ? '，含 ' + (has.length - lost) + ' 张题图' : '') +
        (lost ? '（' + lost + ' 张读取失败）' : ''));
    }).catch(function () {
      toast('导出失败，可能图片太大，试试分几次导出');
    });
  }

  // 导入时把 base64 还原成 Blob 存回 IndexedDB，拿到新的 imgId
  function restoreImgs(list) {
    return list.reduce(function (p, m) {
      return p.then(function () {
        if (!m.imgData) return;
        var blob = dataURLToBlob(m.imgData);
        delete m.imgData;
        if (!blob) return;
        var nid = rid('i');
        return IMG.put(nid, blob).then(function () { m.img = nid; })
          .catch(function () { });
      });
    }, Promise.resolve());
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
          img: m.img || '',
          imgData: m.imgData || '',
          fixed: m.fixed ? 1 : 0,
          ts: m.ts || Date.now()
        };
      });
      if (!clean.length) { toast('文件里没有有效错题'); return; }
      pendingImport = clean;
      var withImg = clean.filter(function (m) { return m.imgData; }).length;
      var bar = $('#importBar');
      bar.hidden = false;
      bar.innerHTML = '读到 <b>' + clean.length + '</b> 道错题' +
        (withImg ? '，其中 <b>' + withImg + '</b> 道带题图' : '') + '。怎么处理？' +
        '<div class="ib-act">' +
        '<button type="button" id="impMerge">合并（去重）</button>' +
        '<button type="button" id="impReplace">覆盖现有</button>' +
        '<button type="button" id="impCancel">取消</button>' +
        '</div>';
      $('#impMerge').onclick = function () {
        toast('正在还原题图…');
        restoreImgs(clean).then(function () {
          var have = {};
          store.mistakes.forEach(function (m) { have[m.id] = 1; });
          var added = 0;
          clean.forEach(function (m) { if (!have[m.id]) { store.mistakes.push(m); have[m.id] = 1; added++; } });
          save(); afterImport('合并完成，新增 ' + added + ' 道');
        });
      };
      $('#impReplace').onclick = function () {
        if (!confirm('覆盖会清掉现有的 ' + store.mistakes.length + ' 道错题，确定？')) return;
        toast('正在还原题图…');
        restoreImgs(clean).then(function () {
          store.mistakes.forEach(function (m) { if (m.img) IMG.del(m.img); });
          store.mistakes = clean;
          save(); afterImport('已覆盖为 ' + clean.length + ' 道');
        });
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

  /* ---------- 图片放大 ---------- */
  function openZoom(src) {
    if (!src) return;
    $('#zoomImg').src = src;
    $('#zoom').hidden = false;
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    $('#tabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (b) go(b.dataset.view);
    });

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

    $('#overview').addEventListener('click', function (e) {
      var r = e.target.closest('[data-jump]');
      if (!r) return;
      var id = r.dataset.jump;
      openMods[id] = true;
      renderKp();
      var el = $('#mod-' + id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    /* 错题本操作（列表 + 抽屉共用同一套逻辑） */
    function misAction(e, refreshExtra) {
      var art = e.target.closest('.mis');
      if (!art) return false;
      var id = art.dataset.id;
      var m = store.mistakes.filter(function (x) { return x.id === id; })[0];
      if (!m) return false;
      var btn = e.target.closest('[data-act]');
      if (btn) {
        if (btn.dataset.act === 'fix') {
          m.fixed = m.fixed ? 0 : 1;
          save(); renderHeader(); renderOverview(); renderKp(); renderList();
          if (refreshExtra) refreshExtra(m.kp);
          toast(m.fixed ? '标记为已弄懂' : '重新放回待解决');
        } else if (btn.dataset.act === 'del') {
          if (!confirm('删除这道错题？不可恢复。')) return true;
          var kp = m.kp;
          if (m.img) IMG.del(m.img);
          store.mistakes = store.mistakes.filter(function (x) { return x.id !== id; });
          save(); renderHeader(); renderOverview(); renderKp(); renderList();
          if (refreshExtra) refreshExtra(kp);
          toast('已删除');
        }
        return true;
      }
      var zoomEl = e.target.closest('[data-zoom]');
      if (zoomEl && zoomEl.tagName === 'IMG' && zoomEl.src) { openZoom(zoomEl.src); return true; }
      if (e.target.closest('.mis-q')) art.classList.toggle('open');
      return true;
    }

    $('#misList').addEventListener('click', function (e) { misAction(e); });

    $('#sheet').addEventListener('click', function (e) {
      if (e.target.dataset.close) { closeSheet(); return; }
      misAction(e, function (kp) { if (kp && KP[kp]) openSheet(kp); else closeSheet(); });
    });

    $('#q2').addEventListener('input', renderList);
    $('#onlyTodo').addEventListener('change', renderList);
    $('#fKpFilter').addEventListener('change', renderList);

    /* 表单 */
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
      $$('.sug-item', this).forEach(function (x) { x.classList.toggle('on', x === b); });
      toast('已归入「' + kpTitle(b.dataset.kp) + '」');
    });
    $('#whyList').addEventListener('click', function (e) {
      var b = e.target.closest('.why');
      if (!b) return;
      whySel = (whySel === b.dataset.why) ? '' : b.dataset.why;
      renderWhy();
    });
    $('#addForm').addEventListener('submit', submitForm);

    /* 拍照切题 */
    $('#fImgs').addEventListener('change', function () {
      if (this.files && this.files.length) handleImages(this.files);
      this.value = '';
    });
    $('#btnSplitText').addEventListener('click', function () {
      splitWholeText($('#fWhole').value);
    });

    $('#scanList').addEventListener('input', function (e) {
      var ta = e.target.closest('.qb-q');
      if (!ta) return;
      var art = ta.closest('.qb');
      var it = findScan(art.dataset.sid);
      if (!it) return;
      it.text = ta.value;
      clearTimeout(ta._t);
      ta._t = setTimeout(function () {
        var res = sugFor(it);
        var box = $('[data-sugs="' + it.sid + '"]');
        if (!box) return;
        box.innerHTML = res.length ? sugHtml(res, it.kp) : '';
        if (!it.kp && res[0]) {
          it.kp = res[0].id;
          var sel = $('[data-kpsel="' + it.sid + '"]');
          if (sel) sel.value = res[0].id;
          box.innerHTML = sugHtml(res, it.kp);
        }
      }, 300);
    });

    $('#scanList').addEventListener('change', function (e) {
      var sel = e.target.closest('select[data-kpsel]');
      if (!sel) return;
      var it = findScan(sel.dataset.kpsel);
      if (it) it.kp = sel.value;
    });

    $('#scanList').addEventListener('click', function (e) {
      var art = e.target.closest('.qb');
      if (!art) return;
      var sid = art.dataset.sid;
      var it = findScan(sid);
      var sug = e.target.closest('.sug-item');
      if (sug) {
        if (it) it.kp = sug.dataset.kp;
        var sel = $('[data-kpsel="' + sid + '"]');
        if (sel) sel.value = sug.dataset.kp;
        $$('.sug-item', art).forEach(function (x) { x.classList.toggle('on', x === sug); });
        return;
      }
      var img = e.target.closest('[data-zoom]');
      if (img && img.tagName === 'IMG') { openZoom(img.src); return; }
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'save') saveScanItem(sid);
      else if (btn.dataset.act === 'drop') dropScan(sid);
      else if (btn.dataset.act === 'merge') mergeUp(sid);
      else if (btn.dataset.act === 'split') splitBlock(sid);
    });

    $('#btnSaveAll').addEventListener('click', function () {
      var list = scanItems.slice();
      var ok = 0, skip = 0;
      var chain = list.reduce(function (p, it) {
        return p.then(function () {
          if (!(it.text || '').trim() || !it.kp) { skip++; return; }
          var m = {
            id: uid(), q: it.text.trim(), kp: it.kp, why: '',
            src: $('#scanSrc').value.trim(), note: '', fixed: 0, ts: Date.now()
          };
          var imgId = rid('i');
          return IMG.put(imgId, it.blob).then(function () { m.img = imgId; })
            .catch(function () { })
            .then(function () {
              store.mistakes.push(m);
              ok++;
              dropScan(it.sid);
            });
        });
      }, Promise.resolve());
      chain.then(function () {
        save(); renderHeader();
        toast('存了 ' + ok + ' 道' + (skip ? '，' + skip + ' 块没填关键词先留着' : ''));
      });
    });

    /* 备份 */
    $('#btnBackup').addEventListener('click', function () { $('#modal').hidden = false; });
    $('#btnCloseModal').addEventListener('click', function () {
      $('#modal').hidden = true;
      $('#importBar').hidden = true;
      $('#importBar').innerHTML = '';
    });
    $('#modal').addEventListener('click', function (e) {
      if (e.target === this) this.hidden = true;
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
      store.mistakes.forEach(function (m) { if (m.img) IMG.del(m.img); });
      store.mistakes = [];
      save();
      renderHeader(); renderOverview(); renderKp(); renderList();
      $('#modal').hidden = true;
      toast('已清空');
    });

    $('#zoom').addEventListener('click', function () { this.hidden = true; });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('#zoom').hidden) { $('#zoom').hidden = true; return; }
      if (!$('#modal').hidden) { $('#modal').hidden = true; return; }
      if (!$('#sheet').hidden) closeSheet();
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    if (!DATA.length) {
      document.body.innerHTML = '<p style="padding:40px;text-align:center;color:#a91f2f">知识点数据 load 失败：检查 assets/data.js 是否存在。</p>';
      return;
    }
    fillKpSelect();
    renderWhy();
    renderHeader();
    renderOverview();
    renderKp();
    bind();
    // 支持直接用 #list / #scan / #add 打开某个视图
    var hv = (location.hash || '').replace('#', '');
    if (hv === 'list' || hv === 'scan' || hv === 'add' || hv === 'kp') go(hv);
    if (!canStore) $('#statline').innerHTML += ' <b style="color:#f0a3a8">（浏览器禁用了本地存储，本次记录不会保存）</b>';
  }

  init();

  // 滑块首次定位不要有滑动动作
  syncThumb();
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { tabsNav.classList.remove('no-anim'); });
  });
  window.addEventListener('resize', function () { syncThumb(); });
  window.addEventListener('load', function () { syncThumb(); });

  /* 调试入口：加 ?__t=1 时把内部函数挂出来，方便在控制台/测试页验证切题算法 */
  if (location.search.indexOf('__t=1') > -1) {
    window.__mt = {
      segmentPage: segmentPage,
      cropFrom: cropFrom,
      splitWholeText: splitWholeText,
      store: store,
      IMG: IMG,
      exportJSON: exportJSON
    };
  }
})();
