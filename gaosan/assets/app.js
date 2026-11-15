/* 渲染 + 勾选进度。数据在 data.js（按教材册 → 章 → 节），本文件只管界面。 */
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
  var activeBook = 'all';
  var openChaps = {};
  var inited = false;

  // 册的顺序（按教材使用顺序）
  var BOOKS = [];
  DATA.forEach(function (m) {
    if (m.book && BOOKS.indexOf(m.book) < 0) BOOKS.push(m.book);
  });

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
    } catch (e) { /* 隐私模式写不了，忽略 */ }
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

  function chapDone(m) {
    return m.items.filter(function (it) { return done[it.id]; }).length;
  }

  function updateProgress() {
    var all = allItems();
    var total = all.length;
    var n = 0;
    all.forEach(function (it) { if (done[it.id]) n++; });
    var p = total ? Math.round((n / total) * 100) : 0;
    barEl.style.width = p + '%';
    pctEl.textContent = p + '%';
    totalEl.textContent = total;
  }

  /* 顶部：按教材册筛选 */
  function renderTabs() {
    var html = '<button class="tab" role="tab" data-book="all">全部<span class="n">' +
      allItems().filter(function (it) { return done[it.id]; }).length + '/' + allItems().length + '</span></button>';
    BOOKS.forEach(function (b) {
      var items = [];
      DATA.forEach(function (m) { if (m.book === b) items = items.concat(m.items); });
      var have = items.filter(function (it) { return done[it.id]; }).length;
      html += '<button class="tab" role="tab" data-book="' + esc(b) + '">' +
        esc(b) + '<span class="n">' + have + '/' + items.length + '</span></button>';
    });
    tabsEl.innerHTML = html;
    Array.prototype.forEach.call(tabsEl.querySelectorAll('.tab'), function (b) {
      b.setAttribute('aria-selected', String(b.dataset.book === activeBook));
    });
  }

  function card(it, kw) {
    var isDone = !!done[it.id];
    var stars = it.star ? '★'.repeat(it.star) : '';
    var keys = (it.keys || []).map(function (k) {
      return '<li>' + esc(k) + '</li>';
    }).join('');

    // 把「1.1 集合的概念」拆成编号 + 标题，编号做成浅色标签，框内层次更清楚
    var mm = /^([§\d][\d.\-—]*)\s+(.+)$/.exec(it.t);
    var num = mm ? mm[1] : '';
    var title = mm ? mm[2] : it.t;

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
          '<div class="t">' +
            (num ? '<span class="num">' + esc(num) + '</span>' : '') +
            hl(title, kw) +
            (stars ? '<i class="stars">' + stars + '</i>' : '') +
          '</div>' +
          '<p class="core">' + hl(it.core, kw) + '</p>' +
        '</div>' +
      '</div>' +
      (keys ? '<ul class="keys">' + keys + '</ul>' : '') +
      (it.trap ? '<div class="trap"><b>易错</b>　' + esc(it.trap) + '</div>' : '') +
      eg +
      '</article>';
  }

  function chapBlock(m, items, kw, forceOpen) {
    var n = items.filter(function (it) { return done[it.id]; }).length;
    var pct = Math.round((n / m.items.length) * 100);
    var open = forceOpen || openChaps[m.id];

    return '<section class="chap' + (open ? ' open' : '') + '" data-chap="' + m.id + '">' +
      '<button class="chap-head" type="button" data-toggle="' + m.id + '">' +
        '<span class="chap-name">' + hl(m.name, kw) + '</span>' +
        '<span class="chap-bar"><i style="width:' + pct + '%"></i></span>' +
        '<span class="chap-prog" data-prog="' + m.id + '">' + n + '/' + m.items.length + '</span>' +
        '<i class="caret"></i>' +
      '</button>' +
      '<div class="chap-body">' + items.map(function (it) { return card(it, kw); }).join('') + '</div>' +
      '</section>';
  }

  function render() {
    var kw = qEl.value.trim();
    var lowKw = kw.toLowerCase();
    var onlyTodo = onlyTodoEl.checked;

    var html = '';
    var shown = 0;

    BOOKS.forEach(function (b) {
      if (activeBook !== 'all' && activeBook !== b) return;

      var bookChaps = DATA.filter(function (m) { return m.book === b; });
      var bookHtml = '';

      bookChaps.forEach(function (m) {
        var items = m.items.filter(function (it) {
          if (onlyTodo && done[it.id]) return false;
          if (!kw) return true;
          var hay = [it.t, it.core, (it.keys || []).join(' '), it.trap || ''].join(' ').toLowerCase();
          return hay.indexOf(lowKw) >= 0;
        });
        if (!items.length) return;
        shown += items.length;
        bookHtml += chapBlock(m, items, kw, !!kw || onlyTodo);
      });

      if (!bookHtml) return;
      if (activeBook === 'all') {
        html += '<h2 class="book-title">' + esc(b) + '</h2>' + bookHtml;
      } else {
        html += bookHtml;
      }
    });

    if (!shown) {
      html = '<p class="empty">没有匹配的知识点' + (kw ? '：' + esc(kw) : '') + '</p>';
    }

    listEl.innerHTML = html;

    // 首次渲染：默认展开第一册第一章，避免一进来什么都看不到
    if (!inited) {
      inited = true;
      var first = listEl.querySelector('.chap');
      if (first && !first.classList.contains('open')) {
        first.classList.add('open');
        openChaps[first.dataset.chap] = true;
      }
    }

    updateProgress();
    renderTabs();
  }

  /* 勾选：只更新卡片与所属章头的进度，不重排 DOM */
  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.check');
    if (btn) {
      var cardEl = btn.closest('.card');
      var id = cardEl.dataset.id;
      if (done[id]) delete done[id];
      else done[id] = 1;
      cardEl.classList.toggle('done', !!done[id]);
      btn.setAttribute('aria-pressed', String(!!done[id]));
      save();
      updateProgress();
      renderTabs();

      var chap = cardEl.closest('.chap');
      if (chap) {
        var mid = chap.dataset.chap;
        var m = DATA.filter(function (x) { return x.id === mid; })[0];
        if (m) {
          var n = chapDone(m);
          var pct = Math.round((n / m.items.length) * 100);
          var progEl = chap.querySelector('[data-prog]');
          if (progEl) progEl.textContent = n + '/' + m.items.length;
          var barIn = chap.querySelector('.chap-bar i');
          if (barIn) barIn.style.width = pct + '%';
        }
      }
      if (onlyTodoEl.checked) render();
      return;
    }

    var head = e.target.closest('.chap-head');
    if (head) {
      var id2 = head.dataset.toggle;
      var box = head.closest('.chap');
      var willOpen = !box.classList.contains('open');
      box.classList.toggle('open', willOpen);
      openChaps[id2] = willOpen;
    }
  });

  tabsEl.addEventListener('click', function (e) {
    var b = e.target.closest('.tab');
    if (!b) return;
    activeBook = b.dataset.book;
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
