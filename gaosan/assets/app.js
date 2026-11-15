/* 渲染 + 勾选进度。数据在 data.js，本文件只管界面。 */
(function () {
  'use strict';

  var KEY = 'gsmath.mastered.v1';
  var DATA = window.MATH_DATA || [];

  var qEl = document.getElementById('q');
  var tabsEl = document.getElementById('tabs');
  var listEl = document.getElementById('list');
  var barEl = document.getElementById('bar');
  var pctEl = document.getElementById('pct');
  var onlyTodoEl = document.getElementById('onlyTodo');
  var resetEl = document.getElementById('reset');
  var totalEl = document.getElementById('total');

  var done = load();
  var activeMod = 'all';

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(done));
    } catch (e) { /* 隐私模式下写不了，忽略 */ }
  }

  function allItems() {
    var out = [];
    DATA.forEach(function (m) {
      m.items.forEach(function (it) { out.push(it); });
    });
    return out;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // 搜索命中高亮：只在标题和核心结论上做，公式里混 <mark> 容易切坏
  function hl(s, kw) {
    var safe = esc(s);
    if (!kw) return safe;
    var re = new RegExp('(' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return safe.replace(re, '<mark>$1</mark>');
  }

  function updateProgress() {
    var total = allItems().length;
    var n = 0;
    allItems().forEach(function (it) { if (done[it.id]) n++; });
    var p = total ? Math.round((n / total) * 100) : 0;
    barEl.style.width = p + '%';
    pctEl.textContent = p + '%';
    totalEl.textContent = total;
  }

  function renderTabs() {
    var html = '<button class="tab" role="tab" data-mod="all">全部<span class="n">' +
      allItems().length + '</span></button>';
    DATA.forEach(function (m) {
      var have = m.items.filter(function (it) { return done[it.id]; }).length;
      html += '<button class="tab" role="tab" data-mod="' + m.id + '">' +
        esc(m.name) + '<span class="n">' + have + '/' + m.items.length + '</span></button>';
    });
    tabsEl.innerHTML = html;
    Array.prototype.forEach.call(tabsEl.querySelectorAll('.tab'), function (b) {
      b.setAttribute('aria-selected', String(b.dataset.mod === activeMod));
    });
  }

  function card(it, kw) {
    var isDone = !!done[it.id];
    var stars = it.star ? '★'.repeat(it.star) : '';
    var keys = (it.keys || []).map(function (k) {
      return '<li>' + esc(k) + '</li>';
    }).join('');

    var eg = '';
    if (it.eg && it.eg.q) {
      eg = '<details class="eg"><summary>例题与解析</summary><div class="eg-body">' +
        '<div class="q">' + esc(it.eg.q) + '</div>' +
        '<div class="a">' + esc(it.eg.a) + '</div>' +
        '</div></details>';
    }

    return '<article class="card' + (isDone ? ' done' : '') + '" data-id="' + it.id + '">' +
      '<div class="card-head">' +
        '<button class="check" type="button" aria-label="标记已掌握" aria-pressed="' + isDone + '"></button>' +
        '<div class="title-wrap">' +
          '<div class="t">' + hl(it.t, kw) + (stars ? '<i class="stars">' + stars + '</i>' : '') + '</div>' +
          '<p class="core">' + hl(it.core, kw) + '</p>' +
        '</div>' +
      '</div>' +
      (keys ? '<ul class="keys">' + keys + '</ul>' : '') +
      (it.trap ? '<div class="trap"><b>易错</b>　' + esc(it.trap) + '</div>' : '') +
      eg +
      '</article>';
  }

  function render() {
    var kw = qEl.value.trim();
    var onlyTodo = onlyTodoEl.checked;
    var lowKw = kw.toLowerCase();

    var html = '';
    var shown = 0;

    DATA.forEach(function (m) {
      if (activeMod !== 'all' && activeMod !== m.id) return;

      var items = m.items.filter(function (it) {
        if (onlyTodo && done[it.id]) return false;
        if (!kw) return true;
        var hay = [it.t, it.core, (it.keys || []).join(' '), it.trap || ''].join(' ').toLowerCase();
        return hay.indexOf(lowKw) >= 0;
      });
      if (!items.length) return;

      shown += items.length;

      if (activeMod === 'all') {
        html += '<div class="sec-title">' + esc(m.name) +
          '<span>' + m.items.filter(function (i) { return done[i.id]; }).length +
          '/' + m.items.length + '</span></div>';
      }
      items.forEach(function (it) { html += card(it, kw); });
    });

    if (!shown) {
      html = '<p class="empty">没有匹配的知识点' +
        (kw ? '：' + esc(kw) : '') + '</p>';
    }

    listEl.innerHTML = html;
    updateProgress();
    renderTabs();
  }

  // 事件委托：勾选
  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.check');
    if (!btn) return;
    var cardEl = btn.closest('.card');
    var id = cardEl.dataset.id;
    if (done[id]) delete done[id];
    else done[id] = 1;
    cardEl.classList.toggle('done', !!done[id]);
    btn.setAttribute('aria-pressed', String(!!done[id]));
    save();
    updateProgress();
    renderTabs();
    if (onlyTodoEl.checked) render();
  });

  tabsEl.addEventListener('click', function (e) {
    var b = e.target.closest('.tab');
    if (!b) return;
    activeMod = b.dataset.mod;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  qEl.addEventListener('input', render);
  onlyTodoEl.addEventListener('change', render);

  resetEl.addEventListener('click', function () {
    if (!confirm('清空所有已掌握标记？')) return;
    done = {};
    save();
    render();
  });

  render();
})();
