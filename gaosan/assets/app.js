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
  var tabsBuilt = false;
  var thumbEl = null;
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function counts() {
    var map = {};
    var all = allItems();
    map.all = { have: all.filter(function (it) { return done[it.id]; }).length, total: all.length };
    BOOKS.forEach(function (b) {
      var items = [];
      DATA.forEach(function (m) { if (m.book === b) items = items.concat(m.items); });
      map[b] = { have: items.filter(function (it) { return done[it.id]; }).length, total: items.length };
    });
    return map;
  }

  function renderTabs() {
    var c = counts();
    // 只建一次，之后只更新数字和选中态，滑块节点才不会被重建
    if (!tabsBuilt) {
      var html = '<button class="tab" role="tab" data-book="all">全部<span class="n"></span></button>';
      BOOKS.forEach(function (b) {
        html += '<button class="tab" role="tab" data-book="' + esc(b) + '">' +
          esc(b) + '<span class="n"></span></button>';
      });
      tabsEl.innerHTML = html;
      thumbEl = document.createElement('span');
      thumbEl.className = 'thumb';
      thumbEl.setAttribute('aria-hidden', 'true');
      tabsEl.insertBefore(thumbEl, tabsEl.firstChild);
      tabsBuilt = true;
    }
    Array.prototype.forEach.call(tabsEl.querySelectorAll('.tab'), function (b) {
      var k = b.dataset.book;
      var d = c[k] || { have: 0, total: 0 };
      b.querySelector('.n').textContent = d.have + '/' + d.total;
      b.setAttribute('aria-selected', String(k === activeBook));
    });
    syncThumb();
  }

  /* 滑块：跟着选中的 tab 平滑移动；窄屏切横向时自动换成左右滑 */
  function syncThumb() {
    if (!thumbEl) return;
    var cur = tabsEl.querySelector('.tab[aria-selected="true"]');
    if (!cur) { thumbEl.style.opacity = '0'; return; }
    var row = getComputedStyle(tabsEl).flexDirection === 'row';
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

    // 配图：教材扫描件没法单独裁图，改成内联 SVG 重画
    var figSvg = (window.MATH_FIG && window.MATH_FIG[it.id]) || '';

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
      (figSvg ? '<figure class="fig">' + figSvg + '</figure>' : '') +
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
      '<div class="chap-body"><div class="chap-inner">' +
        items.map(function (it) { return card(it, kw); }).join('') +
      '</div></div>' +
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

  /* 换册：内容先淡出→重绘→淡入，滑块同步滑过去 */
  function swapRender() {
    if (REDUCE) { render(); return; }
    listEl.classList.add('leaving');
    setTimeout(function () {
      render();
      listEl.classList.remove('leaving');
      listEl.classList.add('entering');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { listEl.classList.remove('entering'); });
      });
    }, 110);
  }

  tabsEl.addEventListener('click', function (e) {
    var b = e.target.closest('.tab');
    if (!b) return;
    if (b.dataset.book === activeBook) return;
    activeBook = b.dataset.book;
    // 先让滑块起步，不等内容重绘
    Array.prototype.forEach.call(tabsEl.querySelectorAll('.tab'), function (x) {
      x.setAttribute('aria-selected', String(x.dataset.book === activeBook));
    });
    syncThumb();
    swapRender();
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

  window.addEventListener('resize', function () { syncThumb(); });
  window.addEventListener('load', function () { syncThumb(); });

  render();
  // 首次定位不要有滑动动作
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { tabsEl.classList.remove('no-anim'); });
  });
})();
