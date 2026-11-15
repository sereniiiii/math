/* 知识点配图：全部用内联 SVG 现画，随网页缩放不糊。
   教材 PDF 是整页扫描（每页一张 1276×1790 的 JPX），插图与正文在同一张图里，
   没法自动裁成独立图片，所以按教材的标准画法重画。
   使用：window.MATH_FIG[itemId] = () => '<svg …>' */
(function () {
  'use strict';

  var C = {
    line: '#2a56c6',
    light: '#9db8ea',
    grid: '#eaeff7',
    axis: '#b6c4d8',
    ink: '#39424f',
    dim: '#78859a',
    red: '#a91f2f',
    green: '#0b6b45',
    fill: '#e4ebfa',
    fill2: '#fbf0f1',
    gold: '#8a5a06',
    white: '#ffffff'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- 基础件 ---------- */
  function svg(w, h, inner, cap) {
    return '<svg class="figsvg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" ' +
      'role="img" aria-label="' + esc(cap || '') + '">' +
      '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="#fff"></rect>' + inner + '</svg>';
  }

  // 数学坐标 → 屏幕坐标
  function M(w, h, xr, yr, pad) {
    pad = pad || [38, 14, 18, 26];
    var l = pad[0], t = pad[1], r = pad[2], b = pad[3];
    var iw = w - l - r, ih = h - t - b;
    return {
      w: w, h: h, l: l, t: t, iw: iw, ih: ih,
      x0: xr[0], x1: xr[1], y0: yr[0], y1: yr[1],
      X: function (x) { return l + (x - xr[0]) / (xr[1] - xr[0]) * iw; },
      Y: function (y) { return t + (yr[1] - y) / (yr[1] - yr[0]) * ih; }
    };
  }

  function txt(x, y, s, o) {
    o = o || {};
    return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '"' +
      ' font-size="' + (o.size || 12) + '" fill="' + (o.color || C.ink) + '"' +
      ' text-anchor="' + (o.anchor || 'start') + '"' +
      (o.weight ? ' font-weight="' + o.weight + '"' : '') +
      (o.font ? ' font-family="' + o.font + '"' : '') +
      (o.style ? ' font-style="' + o.style + '"' : '') + '>' + esc(s) + '</text>';
  }

  function line(x1, y1, x2, y2, o) {
    o = o || {};
    return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"' +
      ' stroke="' + (o.color || C.line) + '" stroke-width="' + (o.w || 1.6) + '"' +
      (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') +
      (o.cap ? ' stroke-linecap="' + o.cap + '"' : '') + '></line>';
  }

  function path(d, o) {
    o = o || {};
    return '<path d="' + d + '" fill="' + (o.fill || 'none') + '"' +
      ' stroke="' + (o.color || C.line) + '" stroke-width="' + (o.w || 2) + '"' +
      (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') +
      (o.opacity ? ' opacity="' + o.opacity + '"' : '') +
      ' stroke-linejoin="round" stroke-linecap="round"></path>';
  }

  function circle(cx, cy, r, o) {
    o = o || {};
    return '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r + '"' +
      ' fill="' + (o.fill || 'none') + '" stroke="' + (o.color || C.line) + '"' +
      ' stroke-width="' + (o.w || 1.6) + '"' +
      (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') +
      (o.opacity ? ' opacity="' + o.opacity + '"' : '') + '></circle>';
  }

  function rect(x, y, w, h, o) {
    o = o || {};
    return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '"' +
      ' fill="' + (o.fill || 'none') + '" stroke="' + (o.color || C.line) + '" stroke-width="' + (o.w || 1.6) + '"' +
      (o.rx ? ' rx="' + o.rx + '"' : '') +
      (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + '></rect>';
  }

  function dot(m, x, y, o) {
    o = o || {};
    return circle(m.X(x), m.Y(y), o.r || 3.4, { fill: o.color || C.line, color: o.color || C.line, w: 0 });
  }

  // 直角坐标轴（过原点，带箭头）
  function axes(m, o) {
    o = o || {};
    var y0 = m.Y(clamp(0, m.y0, m.y1));
    var x0 = m.X(clamp(0, m.x0, m.x1));
    var g = '';
    if (o.grid !== false) {
      var stepX = o.stepX || 1, stepY = o.stepY || 1;
      for (var x = Math.ceil(m.x0 / stepX) * stepX; x <= m.x1 + 1e-9; x += stepX) {
        g += line(m.X(x), m.t, m.X(x), m.t + m.ih, { color: C.grid, w: 1 });
      }
      for (var y = Math.ceil(m.y0 / stepY) * stepY; y <= m.y1 + 1e-9; y += stepY) {
        g += line(m.l, m.Y(y), m.l + m.iw, m.Y(y), { color: C.grid, w: 1 });
      }
    }
    // x 轴
    g += line(m.l - 6, y0, m.l + m.iw + 8, y0, { color: C.axis, w: 1.4 });
    g += path('M' + (m.l + m.iw + 8) + ' ' + y0 + ' l-8 -3.6 l0 7.2 z', { fill: C.axis, color: C.axis, w: 0 });
    // y 轴
    g += line(x0, m.t + m.ih + 6, x0, m.t - 8, { color: C.axis, w: 1.4 });
    g += path('M' + x0 + ' ' + (m.t - 8) + ' l-3.6 8 l7.2 0 z', { fill: C.axis, color: C.axis, w: 0 });
    if (o.axisLabel !== false) {
      var xl = o.xLabel || 'x';
      if (xl.length > 1) {
        // 长轴标签（实轴/虚轴…）放箭头内侧，不然会顶出右边界
        g += txt(m.l + m.iw - 2, y0 - 7, xl, { size: 11.5, color: C.dim, anchor: 'end' });
      } else {
        g += txt(m.l + m.iw + 10, y0 + 14, xl, { size: 12, color: C.dim, style: 'italic' });
      }
      // y 标签压在箭头顶端下方，别让它顶出画布
      var yl = o.yLabel || 'y';
      if (yl.length > 1) {
        g += txt(x0 - 7, m.t + 12, yl, { size: 11.5, color: C.dim, anchor: 'end' });
      } else {
        g += txt(x0 + 6, m.t - 2, yl, { size: 12, color: C.dim, style: 'italic' });
      }
      g += txt(x0 - 7, y0 + 14, 'O', { size: 11, color: C.dim, anchor: 'end' });
    }
    return g;
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // 采样画函数曲线
  function curve(m, fn, a, b, o) {
    o = o || {};
    // 裁剪余量按像素折算成数学单位：直接写 ±3 数学单位，在量程窄的图里会冲出几十像素
    var px2u = (m.y1 - m.y0) / m.ih;
    var lo = m.y0 - 2 * px2u, hi = m.y1 + 2 * px2u;
    var n = o.n || 160, d = '', started = false;
    for (var i = 0; i <= n; i++) {
      var x = a + (b - a) * i / n;
      var y = fn(x);
      if (!isFinite(y) || y < lo - 2 * px2u || y > hi + 2 * px2u) { started = false; continue; }
      var px = m.X(x), py = m.Y(clamp(y, lo, hi));
      d += (started ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1);
      started = true;
    }
    return d ? path(d, o) : '';
  }

  // 折线（数学坐标点列）
  function poly(m, pts, o) {
    var d = pts.map(function (p, i) {
      return (i ? 'L' : 'M') + m.X(p[0]).toFixed(1) + ' ' + m.Y(p[1]).toFixed(1);
    }).join('');
    return path(d, o);
  }

  function arrow(m, x1, y1, x2, y2, o) {
    o = o || {};
    var X1 = m.X(x1), Y1 = m.Y(y1), X2 = m.X(x2), Y2 = m.Y(y2);
    var ang = Math.atan2(Y2 - Y1, X2 - X1);
    var L = o.head || 9;
    var bx = X2 - Math.cos(ang) * L, by = Y2 - Math.sin(ang) * L;
    var s = line(X1, Y1, bx, by, { color: o.color || C.line, w: o.w || 2 });
    var w2 = L * 0.42;
    var p1x = bx + Math.cos(ang + Math.PI / 2) * w2, p1y = by + Math.sin(ang + Math.PI / 2) * w2;
    var p2x = bx + Math.cos(ang - Math.PI / 2) * w2, p2y = by + Math.sin(ang - Math.PI / 2) * w2;
    s += path('M' + X2.toFixed(1) + ' ' + Y2.toFixed(1) + ' L' + p1x.toFixed(1) + ' ' + p1y.toFixed(1) +
      ' L' + p2x.toFixed(1) + ' ' + p2y.toFixed(1) + ' z',
      { fill: o.color || C.line, color: o.color || C.line, w: 0 });
    return s;
  }

  function tag(m, x, y, s, color) {
    var px = m.X(x), py = m.Y(y);
    return txt(px, py, s, { size: 12, color: color || C.ink, anchor: 'middle', weight: 600 });
  }

  /* 阴影（半透明填充多边形） */
  function shade(m, pts, color, opacity) {
    var d = pts.map(function (p, i) {
      return (i ? 'L' : 'M') + m.X(p[0]).toFixed(1) + ' ' + m.Y(p[1]).toFixed(1);
    }).join('') + 'Z';
    return path(d, { fill: color || C.fill, color: 'none', w: 0, opacity: opacity == null ? 1 : opacity });
  }

  var PI = Math.PI;

  /* ==================================================
     一、必修一
     ================================================== */

  // 1.1 集合与元素：韦恩图
  function figSetBasic() {
    var g = '';
    g += rect(70, 40, 500, 220, { color: C.axis, w: 1.4, rx: 6, dash: '5 4' });
    g += txt(84, 62, 'U（全集）', { size: 11, color: C.dim });
    g += circle(280, 150, 105, { fill: C.fill, color: C.line, opacity: 0.55 });
    g += txt(280, 78, 'A', { size: 15, color: C.line, anchor: 'middle', weight: 600 });
    g += dot({ X: function (v) { return v; }, Y: function (v) { return v; } }, 245, 130, { r: 3.2, color: C.red });
    g += dot({ X: function (v) { return v; }, Y: function (v) { return v; } }, 305, 165, { r: 3.2, color: C.red });
    g += dot({ X: function (v) { return v; }, Y: function (v) { return v; } }, 440, 200, { r: 3.2, color: C.gold });
    g += txt(232, 126, 'a', { size: 13, color: C.red, anchor: 'end', weight: 600 });
    g += txt(314, 170, 'b', { size: 13, color: C.red, weight: 600 });
    g += txt(450, 205, 'c', { size: 13, color: C.gold, weight: 600 });
    g += txt(280, 288, 'a∈A，b∈A，c∉A', { size: 13, color: C.ink, anchor: 'middle' });
    return svg(640, 300, g, '集合与元素关系的韦恩图');
  }

  // 1.2 子集关系
  function figSubset() {
    var g = '';
    g += rect(70, 40, 500, 220, { color: C.axis, w: 1.4, rx: 6, dash: '5 4' });
    g += circle(340, 150, 105, { fill: C.fill2, color: C.red, opacity: 0.5 });
    g += txt(340, 78, 'B', { size: 15, color: C.red, anchor: 'middle', weight: 600 });
    g += circle(215, 150, 62, { fill: C.fill, color: C.line, opacity: 0.9 });
    g += txt(215, 110, 'A', { size: 15, color: C.line, anchor: 'middle', weight: 600 });
    g += txt(280, 240, 'A⊆B：A 的每个元素都在 B 里', { size: 13, color: C.ink, anchor: 'middle' });
    g += txt(280, 285, 'A⊂B（真子集）：B 里还有 A 没有的元素', { size: 12.5, color: C.dim, anchor: 'middle' });
    return svg(640, 310, g, '子集与真子集的韦恩图');
  }

  // 1.3 交并补
  function figSetOps() {
    var g = '';
    function panel(ox, label, mode) {
      var cx1 = ox + 60, cx2 = ox + 116, cy = 120, r = 52;
      var s = '';
      if (mode === 'inter') {
        s += '<defs><clipPath id="clipL' + ox + '"><circle cx="' + cx1 + '" cy="' + cy + '" r="' + r + '"/></clipPath></defs>';
        s += circle(cx2, cy, r, { fill: C.fill, color: C.line, opacity: 0.35 });
        s += '<g clip-path="url(#clipL' + ox + ')">' + circle(cx2, cy, r, { fill: C.fill, color: 'none', opacity: 1 }) + '</g>';
        s += circle(cx1, cy, r, { color: C.line });
        s += circle(cx2, cy, r, { color: C.line });
      } else if (mode === 'union') {
        s += circle(cx1, cy, r, { fill: C.fill, color: C.line, opacity: 0.85 });
        s += circle(cx2, cy, r, { fill: C.fill, color: C.line, opacity: 0.85 });
        s += circle(cx1, cy, r, { color: C.line });
        s += circle(cx2, cy, r, { color: C.line });
      } else {
        s += '<defs><clipPath id="clipU' + ox + '"><rect x="' + (ox + 8) + '" y="52" width="160" height="136" rx="4"/></clipPath>' +
          '<mask id="maskU' + ox + '"><rect x="' + (ox + 8) + '" y="52" width="160" height="136" fill="#fff"/>' +
          circle(cx1, cy, r, { fill: '#000', color: '#000' }) + circle(cx2, cy, r, { fill: '#000', color: '#000' }) + '</mask></defs>';
        s += rect(ox + 8, 52, 160, 136, { color: C.axis, w: 1.3, rx: 4 });
        s += '<rect x="' + (ox + 8) + '" y="52" width="160" height="136" rx="4" fill="' + C.fill + '" mask="url(#maskU' + ox + ')" opacity="0.9"/>';
        s += circle(cx1, cy, r, { color: C.line });
        s += circle(cx2, cy, r, { color: C.line });
      }
      s += txt(ox + 88, 232, label, { size: 13, color: C.ink, anchor: 'middle', weight: 600 });
      return s;
    }
    g += panel(10, 'A∩B  交集', 'inter');
    g += panel(200, 'A∪B  并集', 'union');
    g += panel(390, '∁ᵤA  补集', 'comp');
    g += txt(320, 266, '公共部分 / 全部合起来 / 全集里挖掉 A', { size: 12.5, color: C.dim, anchor: 'middle' });
    return svg(640, 290, g, '交集并集补集示意图');
  }

  // 1.8 一元二次函数
  function figQuad() {
    var m = M(640, 300, [-2.6, 4.6], [-5.4, 4.4]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    g += curve(m, function (x) { return x * x - 2 * x - 3; }, -2.6, 4.6, { color: C.line, w: 2.2 });
    [[-1, 0], [3, 0], [1, -4]].forEach(function (p) {
      g += dot(m, p[0], p[1], { color: C.red });
    });
    g += txt(m.X(-1) - 8, m.Y(0) - 9, '(-1,0)', { size: 11, color: C.red, anchor: 'end' });
    g += txt(m.X(3) + 6, m.Y(0) - 9, '(3,0)', { size: 11, color: C.red });
    g += txt(m.X(1) + 7, m.Y(-4) + 4, '(1,-4) 顶点', { size: 11, color: C.red });
    g += txt(m.X(2.6), m.Y(2.4), 'y=x²-2x-3', { size: 12, color: C.line, weight: 600 });
    g += line(m.X(1), m.Y(0), m.X(1), m.Y(-4), { color: C.dim, w: 1, dash: '4 3' });
    return svg(640, 300, g, '二次函数图象与顶点、零点');
  }

  // 1.9 一元二次不等式
  function figQuadIneq() {
    var m = M(640, 300, [-2.4, 4.4], [-5.2, 4.4]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    g += curve(m, function (x) { return x * x - 2 * x - 3; }, -2.4, -1, { color: C.red, w: 3.4 });
    g += curve(m, function (x) { return x * x - 2 * x - 3; }, 3, 4.4, { color: C.red, w: 3.4 });
    g += curve(m, function (x) { return x * x - 2 * x - 3; }, -1, 3, { color: C.light, w: 2 });
    g += line(m.X(-2.4), m.Y(0), m.X(-1), m.Y(0), { color: C.red, w: 3.4 });
    g += line(m.X(3), m.Y(0), m.X(4.4), m.Y(0), { color: C.red, w: 3.4 });
    g += line(m.X(-1), m.Y(0), m.X(3), m.Y(0), { color: C.light, w: 2.4, dash: '4 3' });
    g += dot(m, -1, 0, { color: C.red }); g += dot(m, 3, 0, { color: C.red });
    g += txt(m.X(-1) - 4, m.Y(0) + 18, '-1', { size: 11, color: C.red, anchor: 'end' });
    g += txt(m.X(3) + 4, m.Y(0) + 18, '3', { size: 11, color: C.red });
    g += txt(m.X(1.4), m.Y(3.4), 'x²-2x-3>0 ⇒ x<-1 或 x>3', { size: 12.5, color: C.red, weight: 600 });
    return svg(640, 300, g, '一元二次不等式的解集与图象位置关系');
  }

  // 2.4 单调性与最值
  function figMono() {
    var m = M(640, 300, [-1, 7.4], [-1, 5.6]);
    var g = axes(m, { stepX: 1, stepY: 1, axisLabel: false });
    var f = function (x) {
      if (x <= 2) return 1 + 0.55 * x;
      if (x <= 4) return 2.1 - 0.85 * (x - 2);
      return 0.4 + 0.7 * (x - 4) * (x - 4) * 0.4 + 0.35 * (x - 4);
    };
    g += curve(m, f, -0.8, 7.2, { color: C.line, w: 2.2 });
    g += dot(m, 2, 2.1, { color: C.red });
    g += dot(m, 4, 0.4, { color: C.green });
    g += txt(m.X(2), m.Y(2.1) - 10, '极大值', { size: 11, color: C.red, anchor: 'middle' });
    g += txt(m.X(4), m.Y(0.4) + 18, '极小值', { size: 11, color: C.green, anchor: 'middle' });
    g += txt(m.X(0.3), m.Y(3.6), '增', { size: 13, color: C.green, weight: 700 });
    g += txt(m.X(2.7), m.Y(3.2), '减', { size: 13, color: C.red, weight: 700 });
    g += txt(m.X(5.6), m.Y(4.4), '增', { size: 13, color: C.green, weight: 700 });
    g += line(m.X(2), m.t, m.X(2), m.Y(0), { color: C.dim, w: 1, dash: '3 3' });
    g += line(m.X(4), m.t, m.X(4), m.Y(0), { color: C.dim, w: 1, dash: '3 3' });
    return svg(640, 300, g, '函数单调性与极值的图象');
  }

  // 2.5 奇偶性
  function figParity() {
    var g = '';
    // 偶函数
    var m1 = M(320, 260, [-2.6, 2.6], [-0.6, 3.4], [30, 12, 14, 24]);
    g += '<g>';
    g += axes(m1, { stepX: 1, stepY: 1, axisLabel: false });
    g += curve(m1, function (x) { return x * x * 0.45; }, -2.5, 2.5, { color: C.line, w: 2.2 });
    g += dot(m1, -1.6, 1.152, { color: C.red }); g += dot(m1, 1.6, 1.152, { color: C.red });
    g += line(m1.X(-1.6), m1.Y(1.152), m1.X(1.6), m1.Y(1.152), { color: C.dim, w: 1, dash: '4 3' });
    g += txt(160, 244, '偶函数：f(-x)=f(x)，关于 y 轴对称', { size: 12, color: C.ink, anchor: 'middle' });
    g += '</g>';
    // 奇函数
    var m2 = M(320, 260, [-2.6, 2.6], [-3.4, 3.4], [30, 12, 14, 24]);
    g += '<g transform="translate(320,0)">';
    g += axes(m2, { stepX: 1, stepY: 2, axisLabel: false });
    g += curve(m2, function (x) { return x * x * x * 0.22; }, -2.4, 2.4, { color: C.line, w: 2.2 });
    g += dot(m2, 1.8, 1.282, { color: C.red }); g += dot(m2, -1.8, -1.282, { color: C.red });
    g += line(m2.X(-1.8), m2.Y(-1.282), m2.X(1.8), m2.Y(1.282), { color: C.dim, w: 1, dash: '4 3' });
    g += txt(160, 244, '奇函数：f(-x)=-f(x)，关于原点对称', { size: 12, color: C.ink, anchor: 'middle' });
    g += '</g>';
    return svg(640, 260, g, '偶函数与奇函数的对称性');
  }

  // 2.6 幂函数
  function figPower() {
    var m = M(640, 320, [-0.6, 4.4], [-0.6, 4.4]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    g += curve(m, function (x) { return x; }, -0.4, 4.2, { color: '#8a5a06', w: 2 });
    g += curve(m, function (x) { return x * x; }, -0.5, 2.05, { color: C.line, w: 2 });
    g += curve(m, function (x) { return x * x * x; }, -0.5, 1.63, { color: C.red, w: 2 });
    g += curve(m, function (x) { return Math.sqrt(Math.max(x, 0)); }, 0, 4.2, { color: C.green, w: 2 });
    g += curve(m, function (x) { return 1 / x; }, 0.24, 4.2, { color: '#6d3fa8', w: 2 });
    g += txt(m.X(3.4), m.Y(3.6), 'y=x', { size: 11.5, color: '#8a5a06' });
    g += txt(m.X(3.1), m.Y(2.6), 'y=x²', { size: 11.5, color: C.line });
    g += txt(m.X(1.42), m.Y(3.5), 'y=x³', { size: 11.5, color: C.red });
    g += txt(m.X(2.6), m.Y(1.9), 'y=√x', { size: 11.5, color: C.green });
    g += txt(m.X(2.9), m.Y(0.55), 'y=1/x', { size: 11.5, color: '#6d3fa8' });
    return svg(640, 320, g, '五个常见幂函数的图象');
  }

  // 3.4 指数函数
  function figExp() {
    var m = M(640, 300, [-3.2, 3.2], [-0.8, 4.6]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    g += curve(m, function (x) { return Math.pow(2, x); }, -3.1, 2.2, { color: C.line, w: 2.2 });
    g += curve(m, function (x) { return Math.pow(0.5, x); }, -2.2, 3.1, { color: C.red, w: 2.2 });
    g += dot(m, 0, 1, { color: C.gold });
    g += txt(m.X(0) + 6, m.Y(1) - 7, '(0,1)', { size: 11, color: C.gold });
    g += line(m.l, m.Y(0), m.l + m.iw, m.Y(0), { color: C.axis, w: 1.2, dash: '1 0' });
    g += txt(m.X(1.9), m.Y(3.9), 'y=aˣ (a>1)', { size: 12, color: C.line, weight: 600 });
    g += txt(m.X(-3.0), m.Y(3.9), 'y=aˣ (0<a<1)', { size: 12, color: C.red, weight: 600 });
    g += txt(m.X(-3.0), m.Y(0.15), 'y=0 是渐近线', { size: 11, color: C.dim });
    return svg(640, 300, g, '指数函数 a>1 与 0<a<1 的图象');
  }

  // 3.5 三种增长比较
  function figGrowth() {
    var m = M(640, 300, [-0.4, 8.4], [-1.2, 8.4]);
    var g = axes(m, { stepX: 1, stepY: 2 });
    g += curve(m, function (x) { return Math.pow(2, x * 0.75); }, 0, 3.4, { color: C.red, w: 2.2 });
    g += curve(m, function (x) { return x * x * 0.22; }, 0, 6.1, { color: C.line, w: 2.2 });
    g += curve(m, function (x) { return x > 0 ? Math.log(x) / Math.LN2 * 1.6 : NaN; }, 0.1, 8.2, { color: C.green, w: 2.2 });
    g += txt(m.X(2.9), m.Y(6.4), 'y=aˣ（指数）', { size: 11.5, color: C.red, weight: 600 });
    g += txt(m.X(5.4), m.Y(6.0), 'y=xⁿ（幂）', { size: 11.5, color: C.line, weight: 600 });
    g += txt(m.X(6.0), m.Y(2.2), 'y=logₐx（对数）', { size: 11.5, color: C.green, weight: 600 });
    g += txt(m.X(0.3), m.Y(-0.9), 'x 很大时：指数 > 幂 > 对数', { size: 11.5, color: C.dim });
    return svg(640, 300, g, '指数函数、幂函数、对数函数增长速度比较');
  }

  // 4.5 对数函数
  function figLog() {
    var m = M(640, 300, [-0.8, 6.4], [-3.2, 3.2]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    g += curve(m, function (x) { return x > 0 ? Math.log(x) / Math.LN2 : NaN; }, 0.05, 6.2, { color: C.line, w: 2.2 });
    g += curve(m, function (x) { return x > 0 ? -Math.log(x) / Math.LN2 : NaN; }, 0.05, 6.2, { color: C.red, w: 2.2 });
    g += dot(m, 1, 0, { color: C.gold });
    g += txt(m.X(1) + 6, m.Y(0) + 16, '(1,0)', { size: 11, color: C.gold });
    g += txt(m.X(4.2), m.Y(2.4), 'y=log₂x', { size: 12, color: C.line, weight: 600 });
    g += txt(m.X(4.2), m.Y(-2.2), 'y=log₀.₅x', { size: 12, color: C.red, weight: 600 });
    g += line(m.X(0), m.t, m.X(0), m.t + m.ih, { color: C.axis, w: 1.2 });
    g += txt(m.X(0) + 5, m.t + 12, 'x=0 渐近', { size: 11, color: C.dim });
    return svg(640, 300, g, '对数函数 a>1 与 0<a<1 的图象');
  }

  // 5.1 零点存在定理
  function figZero() {
    var m = M(640, 300, [-0.4, 6.4], [-2.6, 3.4]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    var f = function (x) { return 0.28 * (x - 3.1) * (x - 3.1) - 2 + 0.35 * x; };
    g += curve(m, f, 0.2, 6.2, { color: C.line, w: 2.2 });
    g += line(m.X(1), m.Y(0), m.X(1), m.Y(f(1)), { color: C.dim, w: 1, dash: '4 3' });
    g += line(m.X(5.4), m.Y(0), m.X(5.4), m.Y(f(5.4)), { color: C.dim, w: 1, dash: '4 3' });
    g += dot(m, 1, f(1), { color: C.red }); g += dot(m, 5.4, f(5.4), { color: C.green });
    g += txt(m.X(1) - 6, m.Y(f(1)) + 18, 'f(a)<0', { size: 11.5, color: C.red, anchor: 'end' });
    g += txt(m.X(5.4) + 6, m.Y(f(5.4)) - 8, 'f(b)>0', { size: 11.5, color: C.green });
    g += txt(m.X(1) - 4, m.Y(0) + 18, 'a', { size: 12, color: C.ink, anchor: 'end', style: 'italic' });
    g += txt(m.X(5.4) + 4, m.Y(0) + 18, 'b', { size: 12, color: C.ink, style: 'italic' });
    // 交点
    var lo = 1, hi = 5.4;
    for (var i = 0; i < 60; i++) { var mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
    g += dot(m, lo, 0, { color: C.gold, r: 4 });
    g += txt(m.X(lo) + 6, m.Y(0) - 10, 'x₀', { size: 12, color: C.gold, weight: 600 });
    g += txt(m.X(2.4), m.Y(3.0), 'f(a)·f(b)<0 ⇒ (a,b) 内有零点', { size: 12, color: C.ink });
    return svg(640, 300, g, '零点存在定理示意');
  }

  // 6.3 频率分布直方图
  function figHist() {
    var W = 640, H = 300;
    var l = 74, t = 20, iw = W - l - 30, ih = H - t - 52;
    var bars = [[0.02, 0], [0.05, 1], [0.08, 2], [0.09, 3], [0.075, 4], [0.055, 5], [0.03, 6], [0.01, 7]];
    var maxH = 0.1;
    var bw = iw / bars.length;
    var g = '';
    // y 轴
    g += line(l, t + ih, l, t - 6, { color: C.axis, w: 1.4 });
    g += path('M' + l + ' ' + (t - 6) + ' l-3.6 8 l7.2 0 z', { fill: C.axis, color: C.axis, w: 0 });
    g += line(l - 6, t + ih, l + iw + 8, t + ih, { color: C.axis, w: 1.4 });
    g += path('M' + (l + iw + 8) + ' ' + (t + ih) + ' l-8 -3.6 l0 7.2 z', { fill: C.axis, color: C.axis, w: 0 });
    g += txt(l - 8, t + 8, '频率/组距', { size: 11, color: C.dim, anchor: 'end' });
    bars.forEach(function (b, i) {
      var hh = b[0] / maxH * ih;
      var x = l + i * bw + 2;
      g += rect(x, t + ih - hh, bw - 4, hh, { fill: C.fill, color: C.line, w: 1.4 });
      g += txt(l + i * bw + bw / 2, t + ih + 16, '[' + (10 + i * 2) + ',' + (12 + i * 2) + ')', { size: 9.5, color: C.dim, anchor: 'middle' });
    });
    g += txt(l + iw / 2, H - 8, '数据分组（组距 2）', { size: 11, color: C.dim, anchor: 'middle' });
    g += txt(l + iw - 2, t + 14, '各矩形面积之和 = 1', { size: 11, color: C.red, anchor: 'end' });
    return svg(W, H, g, '频率分布直方图');
  }

  /* ==================================================
     二、必修二
     ================================================== */

  // 1.3 象限角
  function figQuadAngle() {
    var m = M(640, 320, [-3.4, 3.4], [-2.8, 2.8], [30, 18, 26, 26]);
    var g = axes(m, { stepX: 1, stepY: 1, axisLabel: true });
    var cx = m.X(0), cy = m.Y(0);
    g += txt((cx + m.l + m.iw) / 2 - 10, (cy + m.t) / 2, '第一象限', { size: 11.5, color: C.dim, anchor: 'middle' });
    g += txt((cx + m.l) / 2 + 8, (cy + m.t) / 2, '第二象限', { size: 11.5, color: C.dim, anchor: 'middle' });
    g += txt((cx + m.l) / 2 + 8, (cy + m.t + m.ih) / 2, '第三象限', { size: 11.5, color: C.dim, anchor: 'middle' });
    g += txt((cx + m.l + m.iw) / 2 - 10, (cy + m.t + m.ih) / 2, '第四象限', { size: 11.5, color: C.dim, anchor: 'middle' });
    var ang = 50 * PI / 180;
    var R = 2.6;
    var ex = Math.cos(ang) * R, ey = Math.sin(ang) * R;
    g += arrow(m, 0, 0, ex, ey, { color: C.red, w: 2 });
    g += path('M' + (cx + 46) + ' ' + cy + ' A46 46 0 0 0 ' + (cx + 46 * Math.cos(ang)) + ' ' + (cy - 46 * Math.sin(ang)),
      { color: C.red, w: 1.6, dash: '5 3' });
    g += txt(cx + 58, cy - 14, 'α', { size: 13, color: C.red, weight: 700, style: 'italic' });
    g += txt(m.X(ex) + 6, m.Y(ey) - 4, '终边', { size: 11, color: C.red });
    return svg(640, 320, g, '象限角与终边相同的角');
  }

  // 1.6 单位圆定义
  function figUnitCircle() {
    var m = M(640, 340, [-2.84, 2.84], [-1.45, 1.45], [30, 18, 26, 24]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    var cx = m.X(0), cy = m.Y(0), R = m.X(1) - m.X(0);
    g += circle(cx, cy, R, { color: C.line, w: 2 });
    g += txt(cx + R + 6, cy - 6, 'r=1', { size: 11, color: C.dim });
    var a = 0.9;
    var px = Math.cos(a), py = Math.sin(a);
    g += arrow(m, 0, 0, px, py, { color: C.red, w: 2 });
    g += dot(m, px, py, { color: C.red, r: 4 });
    g += txt(m.X(px) + 8, m.Y(py) - 8, 'P(cosα, sinα)', { size: 12, color: C.red, weight: 600 });
    g += line(m.X(px), m.Y(py), m.X(px), m.Y(0), { color: C.green, w: 1.6, dash: '4 3' });
    g += line(m.X(px), m.Y(0), m.X(0), m.Y(0), { color: C.gold, w: 2.4 });
    g += line(m.X(0), m.Y(0), m.X(0), m.Y(py), { color: C.red, w: 2.4, dash: '0' });
    g += txt(m.X(px / 2), m.Y(0) + 18, 'cosα', { size: 12, color: C.gold, anchor: 'middle', weight: 600 });
    g += txt(m.X(0) - 8, m.Y(py / 2), 'sinα', { size: 12, color: C.red, anchor: 'end', weight: 600 });
    g += txt(m.X(-1.55), m.Y(1.15), 'sinα = y，cosα = x', { size: 12, color: C.ink });
    return svg(640, 340, g, '单位圆上的正弦余弦定义');
  }

  // 1.10 正弦余弦图象
  function figSinCos() {
    var m = M(640, 300, [-6.6, 6.6], [-1.8, 1.8]);
    var g = axes(m, { stepX: 2, stepY: 1 });
    g += curve(m, function (x) { return Math.sin(x); }, -2 * PI, 2 * PI, { color: C.line, w: 2.2 });
    g += curve(m, function (x) { return Math.cos(x); }, -2 * PI, 2 * PI, { color: C.red, w: 2.2, dash: '6 3' });
    [[-2, '-2π'], [-1, '-π'], [1, 'π'], [2, '2π']].forEach(function (p) {
      var x = p[0] * PI;
      g += line(m.X(x), m.Y(0) - 4, m.X(x), m.Y(0) + 4, { color: C.axis, w: 1.2 });
      g += txt(m.X(x), m.Y(0) + 17, p[1], { size: 10.5, color: C.dim, anchor: 'middle' });
    });
    g += txt(m.X(PI * 0.55), m.Y(1.45), 'y=sinx', { size: 12, color: C.line, weight: 600 });
    g += txt(m.X(-PI * 2.0), m.Y(1.45), 'y=cosx', { size: 12, color: C.red, weight: 600 });
    g += txt(m.X(-6.4), m.Y(-1.55), '周期 2π，最大值 1，最小值 -1', { size: 11.5, color: C.dim });
    return svg(640, 300, g, '正弦与余弦函数的图象');
  }

  // 1.11 y=Asin(ωx+φ)
  function figAsin() {
    var m = M(640, 330, [-6.8, 6.8], [-2.6, 2.6]);
    var g = axes(m, { stepX: 2, stepY: 1 });
    g += curve(m, function (x) { return Math.sin(x); }, -2 * PI, 2 * PI, { color: C.light, w: 1.8, dash: '5 4' });
    g += curve(m, function (x) { return 2 * Math.sin(2 * x + PI / 3); }, -2 * PI, 2 * PI, { color: C.line, w: 2.2 });
    g += line(m.l, m.Y(2), m.l + m.iw, m.Y(2), { color: C.red, w: 1, dash: '4 3' });
    g += line(m.l, m.Y(-2), m.l + m.iw, m.Y(-2), { color: C.red, w: 1, dash: '4 3' });
    g += txt(m.l + 4, m.Y(2) - 6, 'y=A', { size: 11, color: C.red });
    g += txt(m.l + 4, m.Y(-2) + 14, 'y=-A', { size: 11, color: C.red });
    g += txt(m.X(0.35), m.Y(2.45), 'y=2sin(2x+π/3)', { size: 12, color: C.line, weight: 600 });
    g += txt(m.X(-6.6), m.Y(1.15), 'y=sinx', { size: 11, color: C.dim });
    // 一个周期标注
    g += line(m.X(-PI / 6), m.Y(-2.35), m.X(-PI / 6 + PI), m.Y(-2.35), { color: C.green, w: 1.6 });
    g += txt(m.X(-PI / 6 + PI / 2), m.Y(-2.35) + 15, 'T=π=2π/ω', { size: 11, color: C.green, anchor: 'middle' });
    return svg(640, 330, g, 'y=Asin(ωx+φ) 的振幅与周期');
  }

  // 1.12 正切图象
  function figTan() {
    var m = M(640, 320, [-4.8, 4.8], [-4.4, 4.4]);
    var g = axes(m, { stepX: 1, stepY: 2 });
    [-PI / 2, PI / 2, 3 * PI / 2, -3 * PI / 2].forEach(function (x) {
      g += line(m.X(x), m.t, m.X(x), m.t + m.ih, { color: C.axis, w: 1.2, dash: '5 3' });
    });
    g += curve(m, function (x) { return Math.tan(x); }, -PI / 2 + 0.06, PI / 2 - 0.06, { color: C.line, w: 2.2 });
    g += curve(m, function (x) { return Math.tan(x); }, PI / 2 + 0.06, 3 * PI / 2 - 0.06, { color: C.line, w: 2.2 });
    g += curve(m, function (x) { return Math.tan(x); }, -3 * PI / 2 + 0.06, -PI / 2 - 0.06, { color: C.line, w: 2.2 });
    g += txt(m.X(-PI / 2), m.t + 10, 'x=-π/2', { size: 10.5, color: C.dim, anchor: 'middle' });
    g += txt(m.X(PI / 2), m.t + 10, 'x=π/2', { size: 10.5, color: C.dim, anchor: 'middle' });
    g += txt(m.X(1.55), m.Y(-3.4), '周期 π，无对称轴，值域 R', { size: 11.5, color: C.ink });
    return svg(640, 320, g, '正切函数图象与渐近线');
  }

  // 2.3 向量加法
  function figVecAdd() {
    var m = M(640, 320, [-0.6, 6.4], [-0.6, 4.4]);
    var g = '';
    g += dot(m, 1, 0.6, { color: 'transparent' });
    var ax = 1, ay = 0.7, bx = 4.2, by = 1.1;
    g += arrow(m, ax, ay, ax + 2.2, ay + 1.9, { color: C.line, w: 2.2 });
    g += arrow(m, ax, ay, ax + 1.6, ay - 0.1, { color: C.red, w: 2.2 });
    g += txt(m.X(ax + 1.1), m.Y(ay + 1.5), 'a', { size: 13, color: C.line, weight: 700, style: 'italic' });
    g += txt(m.X(ax + 1.0), m.Y(ay - 0.2), 'b', { size: 13, color: C.red, weight: 700, style: 'italic' });
    // 平行四边形（虚线）
    g += line(m.X(ax + 1.6), m.Y(ay - 0.1), m.X(ax + 3.8), m.Y(ay + 1.8), { color: C.dim, w: 1.2, dash: '5 4' });
    g += line(m.X(ax + 2.2), m.Y(ay + 1.9), m.X(ax + 3.8), m.Y(ay + 1.8), { color: C.dim, w: 1.2, dash: '5 4' });
    g += arrow(m, ax, ay, ax + 3.8, ay + 1.8, { color: C.green, w: 2.4 });
    g += txt(m.X(ax + 2.4), m.Y(ay + 1.05), 'a+b', { size: 13, color: C.green, weight: 700, style: 'italic' });
    // 三角形法则
    g += arrow(m, ax + 1.6, ay - 0.1, ax + 3.8, ay + 1.8, { color: C.green, w: 1.2, dash: '0', head: 7 });
    g += txt(320, 300, '三角形法则（首尾相接）与平行四边形法则（同起点）', { size: 12, color: C.dim, anchor: 'middle' });
    return svg(640, 320, g, '向量加法的三角形法则与平行四边形法则');
  }

  // 2.4 向量减法
  function figVecSub() {
    var m = M(640, 320, [-0.6, 6.4], [-0.8, 4.4]);
    var g = '';
    var ox = 2.2, oy = 1.2;
    g += arrow(m, ox, oy, ox + 2.6, oy + 1.6, { color: C.line, w: 2.2 });
    g += arrow(m, ox, oy, ox + 1.2, oy + 0.2, { color: C.red, w: 2.2 });
    g += txt(m.X(ox + 1.5), m.Y(oy + 1.1), 'a', { size: 13, color: C.line, weight: 700, style: 'italic' });
    g += txt(m.X(ox + 0.5), m.Y(oy + 0.15), 'b', { size: 13, color: C.red, weight: 700, style: 'italic' });
    g += arrow(m, ox + 1.2, oy + 0.2, ox + 2.6, oy + 1.6, { color: C.green, w: 2.4 });
    g += txt(m.X(ox + 2.1), m.Y(oy + 0.6), 'a-b', { size: 13, color: C.green, weight: 700, style: 'italic' });
    g += txt(320, 300, 'a-b 从 b 的终点指向 a 的终点（共起点时）', { size: 12, color: C.dim, anchor: 'middle' });
    return svg(640, 320, g, '向量减法的几何意义');
  }

  // 2.8 坐标表示
  function figVecCoord() {
    var m = M(640, 300, [-0.6, 5.4], [-0.6, 4.4]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    var px = 3.2, py = 2.4;
    g += arrow(m, 0, 0, px, py, { color: C.line, w: 2.2 });
    g += dot(m, px, py, { color: C.line, r: 3.6 });
    g += line(m.X(px), m.Y(py), m.X(px), m.Y(0), { color: C.red, w: 1.4, dash: '4 3' });
    g += line(m.X(px), m.Y(py), m.X(0), m.Y(py), { color: C.red, w: 1.4, dash: '4 3' });
    g += txt(m.X(px) + 6, m.Y(py) - 6, 'A(x,y)', { size: 12, color: C.line, weight: 600 });
    g += txt(m.X(px / 2), m.Y(0) + 18, 'x', { size: 12, color: C.red, anchor: 'middle' });
    g += txt(m.X(0) - 8, m.Y(py / 2), 'y', { size: 12, color: C.red, anchor: 'end' });
    g += arrow(m, 0, 0, px, 0, { color: C.red, w: 1.2, head: 7 });
    g += arrow(m, 0, 0, 0, py, { color: C.red, w: 1.2, head: 7 });
    g += txt(m.X(0.3), m.Y(3.9), 'OA = (x, y) = x i + y j', { size: 12.5, color: C.ink, weight: 600 });
    return svg(640, 300, g, '向量的坐标表示');
  }

  // 2.9 数量积
  function figDot() {
    var m = M(640, 300, [-0.6, 6.4], [-1.2, 4.4]);
    var g = '';
    var ox = 1.2, oy = 1.0;
    var bx = 4.6, by = 2.4;
    var bd = Math.hypot(bx - ox, by - oy);
    var ux = (bx - ox) / bd, uy = (by - oy) / bd;
    var L = 4.2;
    g += arrow(m, ox, oy, ox + L, oy + 0.35, { color: C.line, w: 2.2 });
    g += arrow(m, ox, oy, bx, by, { color: C.red, w: 2.2 });
    g += txt(m.X(ox + 3.0), m.Y(oy + 0.5), 'a', { size: 13, color: C.line, weight: 700, style: 'italic' });
    g += txt(m.X(bx - 0.3), m.Y(by + 0.25), 'b', { size: 13, color: C.red, weight: 700, style: 'italic' });
    // 夹角弧
    var a1 = Math.atan2(0.35, L), a2 = Math.atan2(by - oy, bx - ox);
    g += path('M' + (m.X(ox) + 52 * Math.cos(a1)) + ' ' + (m.Y(oy) - 52 * Math.sin(a1)) +
      ' A52 52 0 0 0 ' + (m.X(ox) + 52 * Math.cos(a2)) + ' ' + (m.Y(oy) - 52 * Math.sin(a2)),
      { color: C.gold, w: 1.6 });
    g += txt(m.X(ox) + 60, m.Y(oy) - 16, 'θ', { size: 13, color: C.gold, weight: 700, style: 'italic' });
    // 投影
    var proj = (bx - ox) * ux + (by - oy) * uy;
    var projx = ox + ux * proj * (L / 4.2), projy = oy + uy * proj * (L / 4.2);
    g += line(m.X(bx), m.Y(by), m.X(projx), m.Y(projy), { color: C.dim, w: 1.2, dash: '4 3' });
    g += line(m.X(ox), m.Y(oy), m.X(projx), m.Y(projy), { color: C.green, w: 3 });
    g += txt(m.X((ox + projx) / 2), m.Y(oy) - 10, '|b|cosθ（投影）', { size: 11, color: C.green, anchor: 'middle' });
    g += txt(m.X(0), m.Y(-0.9), 'a·b = |a||b|cosθ = x₁x₂ + y₁y₂', { size: 12.5, color: C.ink, weight: 600 });
    return svg(640, 300, g, '向量数量积与投影');
  }

  // 2.12 正余弦定理
  function figTriangle() {
    var g = '';
    var A = [150, 60], B = [520, 90], Cp = [330, 250];
    g += path('M' + A[0] + ' ' + A[1] + 'L' + B[0] + ' ' + B[1] + 'L' + Cp[0] + ' ' + Cp[1] + 'Z',
      { color: C.line, w: 2.2, fill: '#f7faff' });
    [[A, 'A'], [B, 'B'], [Cp, 'C']].forEach(function (p) {
      g += circle(p[0][0], p[0][1], 3.6, { fill: C.red, color: C.red, w: 0 });
      var dx = p[1] === 'A' ? -16 : p[1] === 'B' ? 10 : 0;
      var dy = p[1] === 'C' ? 18 : -8;
      g += txt(p[0][0] + dx, p[0][1] + dy, p[1], { size: 13, color: C.red, weight: 700 });
    });
    g += txt((B[0] + Cp[0]) / 2 + 12, (B[1] + Cp[1]) / 2, 'a', { size: 13, color: C.ink, weight: 600 });
    g += txt((A[0] + Cp[0]) / 2 - 16, (A[1] + Cp[1]) / 2, 'b', { size: 13, color: C.ink, weight: 600 });
    g += txt((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 10, 'c', { size: 13, color: C.ink, weight: 600 });
    g += txt(320, 292, 'a/sinA = b/sinB = c/sinC = 2R', { size: 12.5, color: C.line, anchor: 'middle', weight: 600 });
    g += txt(320, 312, 'c² = a² + b² - 2ab·cosC', { size: 12.5, color: C.green, anchor: 'middle', weight: 600 });
    return svg(640, 330, g, '三角形中的正弦定理与余弦定理');
  }

  // 5.2 复平面
  function figComplex() {
    var m = M(640, 300, [-0.8, 4.6], [-1.6, 3.6]);
    var g = axes(m, { stepX: 1, stepY: 1, xLabel: '实轴', yLabel: '虚轴' });
    var a = 3, b = 2.2;
    g += arrow(m, 0, 0, a, b, { color: C.line, w: 2.2 });
    g += dot(m, a, b, { color: C.red, r: 4 });
    g += line(m.X(a), m.Y(b), m.X(a), m.Y(0), { color: C.dim, w: 1, dash: '4 3' });
    g += line(m.X(a), m.Y(b), m.X(0), m.Y(b), { color: C.dim, w: 1, dash: '4 3' });
    g += txt(m.X(a) + 8, m.Y(b) - 6, 'Z(a,b) 即 a+bi', { size: 12, color: C.red, weight: 600 });
    g += txt(m.X(a / 2), m.Y(0) + 18, 'a', { size: 12, color: C.ink, anchor: 'middle', style: 'italic' });
    g += txt(m.X(0) - 8, m.Y(b / 2), 'b', { size: 12, color: C.ink, anchor: 'end', style: 'italic' });
    g += txt(m.X(0.2), m.Y(-1.2), '|z| = √(a²+b²) 是 OZ 的长度', { size: 12, color: C.dim });
    return svg(640, 300, g, '复数在复平面内对应点与向量');
  }

  // 6.2 棱柱棱锥棱台
  function figPrism() {
    var g = '';
    function prism(ox, label) {
      var s = '';
      s += path('M' + (ox + 20) + ' 70 L' + (ox + 100) + ' 70 L' + (ox + 130) + ' 100 L' + (ox + 50) + ' 100 Z', { color: C.line, w: 1.8 });
      s += path('M' + (ox + 20) + ' 70 L' + (ox + 20) + ' 160 L' + (ox + 100) + ' 160 L' + (ox + 100) + ' 70', { color: C.line, w: 1.8 });
      s += line(ox + 50, 100, ox + 50, 190, { color: C.line, w: 1.8 });
      s += line(ox + 130, 100, ox + 130, 190, { color: C.line, w: 1.8 });
      s += path('M' + (ox + 50) + ' 190 L' + (ox + 130) + ' 190 L' + (ox + 100) + ' 160', { color: C.line, w: 1.8 });
      s += line(ox + 20, 160, ox + 50, 190, { color: C.axis, w: 1.2, dash: '5 4' });
      s += txt(ox + 75, 216, label, { size: 12, color: C.ink, anchor: 'middle', weight: 600 });
      return s;
    }
    function pyramid(ox, label) {
      var s = '';
      s += path('M' + (ox + 30) + ' 160 L' + (ox + 120) + ' 160 L' + (ox + 90) + ' 70 Z', { color: C.line, w: 1.8 });
      s += line(ox + 90, 70, ox + 60, 190, { color: C.line, w: 1.8 });
      s += line(ox + 90, 70, ox + 30, 160, { color: C.line, w: 1.8 });
      s += line(ox + 30, 160, ox + 60, 190, { color: C.axis, w: 1.2, dash: '5 4' });
      s += line(ox + 60, 190, ox + 120, 160, { color: C.axis, w: 1.2, dash: '5 4' });
      s += txt(ox + 75, 216, label, { size: 12, color: C.ink, anchor: 'middle', weight: 600 });
      return s;
    }
    function frustum(ox, label) {
      var s = '';
      s += path('M' + (ox + 25) + ' 85 L' + (ox + 105) + ' 85 L' + (ox + 130) + ' 110 L' + (ox + 50) + ' 110 Z', { color: C.line, w: 1.8 });
      s += line(ox + 25, 85, ox + 25, 160, { color: C.line, w: 1.8 });
      s += line(ox + 105, 85, ox + 105, 160, { color: C.line, w: 1.8 });
      s += line(ox + 50, 110, ox + 50, 185, { color: C.line, w: 1.8 });
      s += line(ox + 130, 110, ox + 130, 185, { color: C.line, w: 1.8 });
      s += path('M' + (ox + 25) + ' 160 L' + (ox + 105) + ' 160 L' + (ox + 130) + ' 185 L' + (ox + 50) + ' 185 Z', { color: C.line, w: 1.8 });
      s += txt(ox + 77, 216, label, { size: 12, color: C.ink, anchor: 'middle', weight: 600 });
      return s;
    }
    g += prism(40, '棱柱');
    g += pyramid(240, '棱锥');
    g += frustum(430, '棱台');
    return svg(640, 240, g, '棱柱、棱锥、棱台的直观图');
  }

  // 6.3 旋转体
  function figRevolve() {
    var g = '';
    // 球
    g += circle(90, 120, 62, { color: C.line, w: 1.8, fill: '#f7faff' });
    g += '<ellipse cx="90" cy="120" rx="62" ry="20" fill="none" stroke="' + C.axis + '" stroke-width="1.2" stroke-dasharray="5 4"/>';
    g += txt(90, 216, '球', { size: 12, color: C.ink, anchor: 'middle', weight: 600 });
    // 圆柱
    g += '<ellipse cx="245" cy="72" rx="45" ry="14" fill="#f7faff" stroke="' + C.line + '" stroke-width="1.8"/>';
    g += line(200, 72, 200, 168, { color: C.line, w: 1.8 });
    g += line(290, 72, 290, 168, { color: C.line, w: 1.8 });
    g += path('M200 168 A45 14 0 0 0 290 168', { color: C.line, w: 1.8 });
    g += path('M200 168 A45 14 0 0 1 290 168', { color: C.axis, w: 1.2, dash: '5 4' });
    g += txt(245, 216, '圆柱', { size: 12, color: C.ink, anchor: 'middle', weight: 600 });
    // 圆锥
    g += path('M390 60 L345 165 A45 14 0 0 0 435 165 Z', { color: C.line, w: 1.8, fill: '#f7faff' });
    g += path('M345 165 A45 14 0 0 1 435 165', { color: C.axis, w: 1.2, dash: '5 4' });
    g += txt(390, 216, '圆锥', { size: 12, color: C.ink, anchor: 'middle', weight: 600 });
    // 圆台
    g += '<ellipse cx="530" cy="80" rx="28" ry="9" fill="#f7faff" stroke="' + C.line + '" stroke-width="1.8"/>';
    g += line(502, 80, 482, 168, { color: C.line, w: 1.8 });
    g += line(558, 80, 578, 168, { color: C.line, w: 1.8 });
    g += path('M482 168 A48 14 0 0 0 578 168', { color: C.line, w: 1.8 });
    g += path('M482 168 A48 14 0 0 1 578 168', { color: C.axis, w: 1.2, dash: '5 4' });
    g += txt(530, 216, '圆台', { size: 12, color: C.ink, anchor: 'middle', weight: 600 });
    return svg(640, 240, g, '球、圆柱、圆锥、圆台的直观图');
  }

  // 6.12 球与截面
  function figSphere() {
    var g = '';
    var cx = 300, cy = 130, R = 96;
    g += circle(cx, cy, R, { color: C.line, w: 2, fill: '#f9fbff' });
    g += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + R + '" ry="30" fill="none" stroke="' + C.axis + '" stroke-width="1.2" stroke-dasharray="5 4"/>';
    // 截面圆
    var cyy = cy + 34, rr = Math.sqrt(Math.max(R * R - 34 * 34, 1));
    g += '<ellipse cx="' + cx + '" cy="' + cyy + '" rx="' + rr + '" ry="' + (rr * 0.3) + '" fill="none" stroke="' + C.red + '" stroke-width="1.6" stroke-dasharray="4 3"/>';
    g += line(cx, cy, cx + R * 0.72, cy - R * 0.7, { color: C.line, w: 1.8 });
    g += txt(cx + R * 0.5, cy - R * 0.5, 'R', { size: 12, color: C.line, weight: 700, style: 'italic' });
    g += line(cx, cy, cx, cyy, { color: C.gold, w: 1.6, dash: '4 3' });
    g += txt(cx + 6, cy + 20, 'd', { size: 12, color: C.gold, weight: 700, style: 'italic' });
    g += line(cx, cyy, cx + rr, cyy, { color: C.red, w: 1.6 });
    g += txt(cx + rr * 0.5, cyy - 6, 'r', { size: 12, color: C.red, weight: 700, style: 'italic' });
    g += txt(cx, 250, 'R² = r² + d²', { size: 13, color: C.ink, anchor: 'middle', weight: 600 });
    return svg(640, 270, g, '球的截面与半径关系');
  }

  /* ==================================================
     三、选修一、选修二
     ================================================== */

  // 1.2 倾斜角与斜率
  function figSlope() {
    var m = M(640, 300, [-0.6, 6.4], [-1.4, 4.4]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    var k = 0.7, b = 0.6;
    g += line(m.X(0.2), m.Y(k * 0.2 + b), m.X(6.0), m.Y(k * 6.0 + b), { color: C.line, w: 2.2 });
    var x0 = 3.4, y0 = k * x0 + b;
    g += dot(m, x0, y0, { color: C.red });
    g += line(m.X(0.6), m.Y(y0), m.X(5.2), m.Y(y0), { color: C.axis, w: 1.2, dash: '5 4' });
    g += txt(m.X(x0) + 8, m.Y(y0) - 8, 'P(x₀,y₀)', { size: 11.5, color: C.red });
    var ang = Math.atan(k);
    g += path('M' + (m.X(0.6) + 58) + ' ' + m.Y(y0) + ' A58 58 0 0 0 ' + (m.X(0.6) + 58 * Math.cos(ang)) + ' ' + (m.Y(y0) - 58 * Math.sin(ang)),
      { color: C.gold, w: 1.6 });
    g += txt(m.X(0.6) + 68, m.Y(y0) - 12, 'α', { size: 13, color: C.gold, weight: 700, style: 'italic' });
    g += txt(m.X(2.6), m.Y(3.6), 'k = tanα = (y₂-y₁)/(x₂-x₁)', { size: 12.5, color: C.ink, weight: 600 });
    return svg(640, 300, g, '直线的倾斜角与斜率');
  }

  // 1.7 圆的标准方程
  function figCircle() {
    // 横纵比例取成 1:1（80px/单位），画出来才是真圆而不是椭圆
    var m = M(640, 400, [-0.5, 4.5], [-0.5, 3.875], [120, 20, 120, 30]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    var a = 2, b = 2, r = 1.5;
    g += circle(m.X(a), m.Y(b), m.X(a + r) - m.X(a), { color: C.line, w: 2.2, fill: C.fill, opacity: 0.4 });
    g += dot(m, a, b, { color: C.red, r: 3.6 });
    g += txt(m.X(a) + 6, m.Y(b) - 8, 'C(a,b)', { size: 12, color: C.red, weight: 600 });
    g += line(m.X(a), m.Y(b), m.X(a + r * 0.72), m.Y(b + r * 0.7), { color: C.green, w: 2 });
    g += txt(m.X(a + 0.55), m.Y(b + 0.28), 'r', { size: 12, color: C.green, weight: 700, style: 'italic' });
    g += txt(m.X(-0.3), m.Y(3.68), '(x-a)² + (y-b)² = r²', { size: 13, color: C.ink, weight: 600 });
    return svg(640, 400, g, '圆的标准方程与圆心半径');
  }

  // 1.9 直线与圆的位置关系
  function figLineCircle() {
    var g = '';
    function one(ox, dy, label, sub, color) {
      var s = '';
      var cx = ox + 100, cy = 120, r = 52;
      s += circle(cx, cy, r, { color: C.line, w: 1.8 });
      s += line(ox + 20, cy + dy, ox + 180, cy + dy, { color: color, w: 2 });
      s += line(cx, cy, cx, cy + dy, { color: C.gold, w: 1.4, dash: '4 3' });
      s += dot({ X: function (v) { return v; }, Y: function (v) { return v; } }, cx, cy, { r: 3, color: C.red });
      s += txt(cx, 200, label, { size: 12.5, color: C.ink, anchor: 'middle', weight: 600 });
      s += txt(cx, 218, sub, { size: 11, color: C.dim, anchor: 'middle' });
      return s;
    }
    g += one(10, -70, '相离', 'd > r', C.red);
    g += one(220, -52, '相切', 'd = r', C.green);
    g += one(430, 0, '相交', 'd < r', C.line);
    return svg(640, 236, g, '直线与圆的三种位置关系');
  }

  // 1.10 圆与圆
  function figTwoCircle() {
    var g = '';
    function one(ox, gap, label, sub, color) {
      var s = '';
      var r = 44;
      var c1 = ox + 78, c2 = ox + 78 + gap, cy = 110;
      s += circle(c1, cy, r, { color: C.line, w: 1.8 });
      s += circle(c2, cy, r, { color: color, w: 1.8 });
      s += line(c1, cy, c2, cy, { color: C.gold, w: 1.2, dash: '4 3' });
      s += txt((c1 + c2) / 2, cy - 6, 'd', { size: 11, color: C.gold, anchor: 'middle', style: 'italic' });
      s += txt((c1 + c2) / 2, 190, label, { size: 12.5, color: C.ink, anchor: 'middle', weight: 600 });
      s += txt((c1 + c2) / 2, 208, sub, { size: 11, color: C.dim, anchor: 'middle' });
      return s;
    }
    g += one(6, 116, '外离', 'd > r₁+r₂', C.red);
    g += one(216, 88, '相交', '|r₁-r₂| < d < r₁+r₂', C.line);
    g += one(426, 60, '内含', 'd < |r₁-r₂|', C.dim);
    return svg(640, 226, g, '圆与圆的三种位置关系');
  }

  // 2.1 椭圆定义
  function figEllipseDef() {
    var m = M(640, 320, [-3.6, 3.6], [-2.4, 2.4], [30, 18, 26, 24]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    var a = 2.8, b = 1.7, c = Math.sqrt(a * a - b * b);
    g += '<ellipse cx="' + m.X(0) + '" cy="' + m.Y(0) + '" rx="' + (m.X(a) - m.X(0)) + '" ry="' + (m.Y(0) - m.Y(b)) + '" fill="' + C.fill + '" fill-opacity="0.35" stroke="' + C.line + '" stroke-width="2.2"/>';
    g += dot(m, -c, 0, { color: C.red, r: 3.6 }); g += dot(m, c, 0, { color: C.red, r: 3.6 });
    g += txt(m.X(-c) - 4, m.Y(0) - 9, 'F₁', { size: 12, color: C.red, anchor: 'end', weight: 600 });
    g += txt(m.X(c) + 4, m.Y(0) - 9, 'F₂', { size: 12, color: C.red, weight: 600 });
    var px = 1.7, py = b * Math.sqrt(1 - (px * px) / (a * a));
    g += dot(m, px, py, { color: C.green, r: 3.6 });
    g += line(m.X(px), m.Y(py), m.X(-c), m.Y(0), { color: C.green, w: 1.8 });
    g += line(m.X(px), m.Y(py), m.X(c), m.Y(0), { color: C.green, w: 1.8 });
    g += txt(m.X(px) + 6, m.Y(py) - 8, 'P', { size: 12, color: C.green, weight: 700 });
    g += txt(m.X(0), m.Y(-2.0), '|PF₁| + |PF₂| = 2a > |F₁F₂| = 2c', { size: 12.5, color: C.ink, anchor: 'middle', weight: 600 });
    return svg(640, 320, g, '椭圆的定义：到两焦点距离之和为常数');
  }

  // 2.2 椭圆 abc
  function figEllipseABC() {
    var m = M(640, 300, [-3.4, 3.4], [-2.2, 2.2], [30, 18, 26, 24]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    var a = 2.8, b = 1.6, c = Math.sqrt(a * a - b * b);
    g += '<ellipse cx="' + m.X(0) + '" cy="' + m.Y(0) + '" rx="' + (m.X(a) - m.X(0)) + '" ry="' + (m.Y(0) - m.Y(b)) + '" fill="none" stroke="' + C.line + '" stroke-width="2.2"/>';
    g += line(m.X(-c), m.Y(0), m.X(-c), m.Y(b), { color: C.gold, w: 2 });
    g += line(m.X(-c), m.Y(b), m.X(0), m.Y(0), { color: C.red, w: 2 });
    g += line(m.X(0), m.Y(0), m.X(-c), m.Y(0), { color: C.green, w: 2 });
    g += txt(m.X(-c) - 8, m.Y(b / 2), 'b', { size: 12.5, color: C.gold, anchor: 'end', weight: 700, style: 'italic' });
    g += txt(m.X(-c / 2), m.Y(b / 2) - 4, 'a', { size: 12.5, color: C.red, anchor: 'middle', weight: 700, style: 'italic' });
    g += txt(m.X(-c / 2), m.Y(0) + 16, 'c', { size: 12.5, color: C.green, anchor: 'middle', weight: 700, style: 'italic' });
    g += dot(m, 0, b, { color: C.line, r: 3.2 });
    g += txt(m.X(0.15), m.Y(b) - 8, 'B(0,b)', { size: 11.5, color: C.line });
    g += txt(m.X(-3.2), m.Y(-1.7), 'a² = b² + c²，e = c/a ∈ (0,1)', { size: 12.5, color: C.ink, weight: 600 });
    return svg(640, 300, g, '椭圆中 a、b、c 的关系');
  }

  // 双曲线一支：cosh/sinh 增长快，点出了画布就跳过（断开），别让 path 冲出 viewBox
  function hyperBranch(m, sign, a, b, t0, t1, o) {
    var n = 140, d = '', started = false;
    var xmin = m.l - 1, xmax = m.l + m.iw + 1, ymin = m.t - 1, ymax = m.t + m.ih + 1;
    for (var i = 0; i <= n; i++) {
      var t = t0 + (t1 - t0) * i / n;
      var px = m.X(sign * a * Math.cosh(t)), py = m.Y(b * Math.sinh(t));
      if (px < xmin || px > xmax || py < ymin || py > ymax) { started = false; continue; }
      d += (started ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1);
      started = true;
    }
    return d ? path(d, o) : '';
  }

  // 2.3 双曲线
  function figHyper() {
    var m = M(640, 320, [-4.2, 4.2], [-3.0, 3.0], [30, 18, 26, 24]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    var a = 1.8, b = 1.4, c = Math.sqrt(a * a + b * b);
    g += hyperBranch(m, 1, a, b, -2.4, 2.4, { color: C.line, w: 2.2 });
    g += hyperBranch(m, -1, a, b, -2.4, 2.4, { color: C.line, w: 2.2 });
    g += dot(m, -c, 0, { color: C.red, r: 3.4 }); g += dot(m, c, 0, { color: C.red, r: 3.4 });
    g += txt(m.X(-c) - 4, m.Y(0) - 9, 'F₁', { size: 11.5, color: C.red, anchor: 'end', weight: 600 });
    g += txt(m.X(c) + 4, m.Y(0) - 9, 'F₂', { size: 11.5, color: C.red, weight: 600 });
    g += txt(m.X(a) + 6, m.Y(0) + 18, 'a', { size: 12, color: C.green, style: 'italic' });
    g += txt(m.X(0), m.Y(-2.6), '||PF₁| - |PF₂|| = 2a < 2c', { size: 12.5, color: C.ink, anchor: 'middle', weight: 600 });
    return svg(640, 320, g, '双曲线的两支与焦点');
  }

  // 2.4 渐近线
  function figHyperAsym() {
    var m = M(640, 320, [-4.2, 4.2], [-2.8, 2.8], [30, 18, 26, 24]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    var a = 2.2, b = 1.4;
    g += line(m.X(-a), m.Y(-b), m.X(a), m.Y(b), { color: C.dim, w: 1.4, dash: '6 4' });
    g += line(m.X(-a), m.Y(b), m.X(a), m.Y(-b), { color: C.dim, w: 1.4, dash: '6 4' });
    g += rect(m.X(-a), m.Y(b), m.X(a) - m.X(-a), m.Y(-b) - m.Y(b), { color: C.axis, w: 1, dash: '3 3' });
    g += hyperBranch(m, 1, a, b, -1.7, 1.7, { color: C.line, w: 2.2 });
    g += hyperBranch(m, -1, a, b, -1.7, 1.7, { color: C.line, w: 2.2 });
    g += txt(m.X(2.5), m.Y(1.9), 'y=(b/a)x', { size: 11.5, color: C.dim });
    g += txt(m.X(2.5), m.Y(-2.1), 'y=-(b/a)x', { size: 11.5, color: C.dim });
    g += txt(m.X(0), m.Y(-2.6), '渐近线 y=±(b/a)x，e>1 越大越张开', { size: 12, color: C.ink, anchor: 'middle' });
    return svg(640, 320, g, '双曲线的渐近线与特征矩形');
  }

  // 2.5 抛物线
  function figParabola() {
    var m = M(640, 320, [-3.6, 4.0], [-3.0, 3.0], [30, 18, 26, 24]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    var p = 1;
    g += curve(m, function (x) { return Math.sqrt(2 * p * x); }, 0, 3.6, { color: C.line, w: 2.2 });
    g += curve(m, function (x) { return -Math.sqrt(2 * p * x); }, 0, 3.6, { color: C.line, w: 2.2 });
    g += line(m.X(-p / 2), m.t, m.X(-p / 2), m.t + m.ih, { color: C.red, w: 1.8, dash: '6 4' });
    g += txt(m.X(-p / 2) - 6, m.Y(2.4), '准线 x=-p/2', { size: 11, color: C.red, anchor: 'end' });
    g += dot(m, p / 2, 0, { color: C.red, r: 3.6 });
    g += txt(m.X(p / 2) + 6, m.Y(0) - 8, 'F(p/2,0)', { size: 11.5, color: C.red });
    var px = 2, py = Math.sqrt(2 * p * px);
    g += dot(m, px, py, { color: C.green, r: 3.4 });
    g += line(m.X(px), m.Y(py), m.X(p / 2), m.Y(0), { color: C.green, w: 1.6 });
    g += line(m.X(px), m.Y(py), m.X(-p / 2), m.Y(py), { color: C.green, w: 1.6 });
    g += txt(m.X(px) + 6, m.Y(py) - 6, 'P', { size: 11.5, color: C.green, weight: 700 });
    g += txt(m.X(-3.4), m.Y(-2.6), 'y²=2px：到焦点与到准线距离相等', { size: 12, color: C.ink, weight: 600 });
    return svg(640, 320, g, '抛物线的焦点与准线');
  }

  // 3.1 空间直角坐标系
  function figSpace() {
    var g = '';
    var O = [230, 240];
    g += arrow({ X: function (v) { return v; }, Y: function (v) { return v; } }, O[0], O[1], O[0] + 190, O[1] + 22, { color: C.line, w: 1.8, head: 10 });
    g += arrow({ X: function (v) { return v; }, Y: function (v) { return v; } }, O[0], O[1], O[0] - 120, O[1] + 40, { color: C.line, w: 1.8, head: 10 });
    g += arrow({ X: function (v) { return v; }, Y: function (v) { return v; } }, O[0], O[1], O[0], O[1] - 170, { color: C.line, w: 1.8, head: 10 });
    g += txt(O[0] + 196, O[1] + 30, 'y', { size: 13, color: C.line, weight: 700, style: 'italic' });
    g += txt(O[0] - 132, O[1] + 52, 'x', { size: 13, color: C.line, weight: 700, style: 'italic' });
    g += txt(O[0] - 12, O[1] - 178, 'z', { size: 13, color: C.line, weight: 700, style: 'italic' });
    g += txt(O[0] - 12, O[1] + 16, 'O', { size: 12, color: C.dim, anchor: 'end' });
    var P = [O[0] + 130, O[1] - 90];
    g += line(O[0], O[1], P[0], P[1], { color: C.red, w: 2 });
    g += line(P[0], P[1], P[0], O[1] + 16, { color: C.axis, w: 1.2, dash: '5 4' });
    g += dot({ X: function (v) { return v; }, Y: function (v) { return v; } }, P[0], P[1], { r: 3.6, color: C.red });
    g += txt(P[0] + 8, P[1] - 6, 'P(x,y,z)', { size: 12, color: C.red, weight: 600 });
    g += txt(320, 300, '三个坐标平面把空间分成八个卦限', { size: 12, color: C.dim, anchor: 'middle' });
    return svg(640, 320, g, '空间直角坐标系');
  }

  // 6.10 正态分布
  function figNormal() {
    var m = M(640, 300, [-4.2, 4.2], [-0.2, 4.6], [30, 22, 26, 24]);
    var g = '';
    var mu = 0, sig = 1;
    function f(x) { return 4 * Math.exp(-((x - mu) * (x - mu)) / (2 * sig * sig)); }
    // 填充 3σ
    var pts = 'M' + m.X(-3) + ' ' + m.Y(0);
    for (var i = 0; i <= 100; i++) {
      var x = -3 + 6 * i / 100;
      pts += 'L' + m.X(x).toFixed(1) + ' ' + m.Y(f(x)).toFixed(1);
    }
    pts += 'L' + m.X(3) + ' ' + m.Y(0) + 'Z';
    g += path(pts, { fill: C.fill, color: 'none', w: 0, opacity: 0.9 });
    g += curve(m, f, -4.1, 4.1, { color: C.line, w: 2.2 });
    g += line(m.l, m.Y(0), m.l + m.iw, m.Y(0), { color: C.axis, w: 1.4 });
    [-3, -2, -1, 0, 1, 2, 3].forEach(function (k) {
      g += line(m.X(k), m.Y(0), m.X(k), m.Y(0) + 5, { color: C.axis, w: 1.1 });
      g += txt(m.X(k), m.Y(0) + 18, k === 0 ? 'μ' : (k > 0 ? 'μ+' + k + 'σ' : 'μ' + k + 'σ'), { size: 9.5, color: C.dim, anchor: 'middle' });
    });
    g += txt(m.X(0), m.Y(f(0)) - 10, '最高点在 x=μ', { size: 11.5, color: C.line, anchor: 'middle', weight: 600 });
    g += txt(m.X(-4.0), m.Y(4.2), 'σ 越小越"瘦高"，越大越"矮胖"', { size: 11.5, color: C.ink });
    g += txt(m.X(1.55), m.Y(1.6), 'P(μ-σ,μ+σ)≈0.6827', { size: 10.5, color: C.dim });
    return svg(640, 300, g, '正态分布曲线与 3σ 原则');
  }

  // 7.1 一元线性回归
  function figRegress() {
    var m = M(640, 300, [-0.4, 8.4], [-0.4, 8.4]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    var pts = [[1, 1.8], [1.6, 2.6], [2.2, 2.1], [3.1, 3.6], [3.8, 3.2], [4.4, 4.6], [5.2, 4.9], [6.0, 5.8], [6.6, 5.4], [7.4, 7.0]];
    var sx = 0, sy = 0;
    pts.forEach(function (p) { sx += p[0]; sy += p[1]; });
    var mx = sx / pts.length, my = sy / pts.length;
    var num = 0, den = 0;
    pts.forEach(function (p) { num += (p[0] - mx) * (p[1] - my); den += (p[0] - mx) * (p[0] - mx); });
    var k = num / den, b = my - k * mx;
    g += line(m.X(0.4), m.Y(k * 0.4 + b), m.X(8.0), m.Y(k * 8.0 + b), { color: C.red, w: 2.2 });
    pts.forEach(function (p) {
      g += circle(m.X(p[0]), m.Y(p[1]), 3.4, { fill: C.line, color: C.line, w: 0 });
      g += line(m.X(p[0]), m.Y(p[1]), m.X(p[0]), m.Y(k * p[0] + b), { color: C.light, w: 1, dash: '3 3' });
    });
    g += txt(m.X(0.6), m.Y(7.6), 'ŷ = bx + â（最小二乘）', { size: 12.5, color: C.red, weight: 600 });
    g += txt(m.X(6.2), m.Y(1.4), '竖线=残差', { size: 11, color: C.dim });
    return svg(640, 300, g, '散点图与回归直线');
  }

  // 2.4 导数几何意义
  function figTangent() {
    var m = M(640, 320, [-0.6, 5.2], [-1.4, 5.6]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    var f = function (x) { return 0.32 * x * x - 0.5 * x + 1.4; };
    g += curve(m, f, -0.3, 4.8, { color: C.line, w: 2.2 });
    var x0 = 3.2;
    var k = 0.64 * x0 - 0.5;
    g += line(m.X(0.4), m.Y(k * (0.4 - x0) + f(x0)), m.X(4.7), m.Y(k * (4.7 - x0) + f(x0)), { color: C.red, w: 2 });
    g += dot(m, x0, f(x0), { color: C.red, r: 4 });
    g += txt(m.X(x0) - 6, m.Y(f(x0)) - 12, 'P(x₀,f(x₀))', { size: 11.5, color: C.red, anchor: 'end', weight: 600 });
    // 割线
    var x1 = 4.3;
    g += line(m.X(x0), m.Y(f(x0)), m.X(x1), m.Y(f(x1)), { color: C.green, w: 1.6, dash: '6 4' });
    g += dot(m, x1, f(x1), { color: C.green, r: 3.2 });
    g += txt(m.X(x1) + 6, m.Y(f(x1)), 'Q', { size: 11.5, color: C.green, weight: 700 });
    g += txt(m.X(0.5), m.Y(3.8), "k = f′(x₀) = lim(Δy/Δx)", { size: 12.5, color: C.ink, weight: 600 });
    g += txt(m.X(0.5), m.Y(3.2), 'Q→P 时割线趋于切线', { size: 11.5, color: C.dim });
    return svg(640, 320, g, '导数的几何意义：切线斜率');
  }

  // 2.8 导数与单调性
  function figDerivMono() {
    var m = M(640, 320, [-0.6, 5.2], [-2.4, 3.4]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    var f = function (x) { return 0.33 * x * x * x - 2.2 * x * x + 3.2 * x - 0.6; };
    var df = function (x) { return x * x - 4.4 * x + 3.2; };
    g += curve(m, f, -0.2, 5.0, { color: C.line, w: 2.2 });
    var r1 = 0.86, r2 = 3.74;
    g += line(m.X(r1), m.t, m.X(r1), m.Y(0), { color: C.dim, w: 1, dash: '4 3' });
    g += line(m.X(r2), m.t, m.X(r2), m.Y(0), { color: C.dim, w: 1, dash: '4 3' });
    g += dot(m, r1, f(r1), { color: C.green, r: 3.4 });
    g += dot(m, r2, f(r2), { color: C.red, r: 3.4 });
    g += txt(m.X(0.2), m.Y(2.6), "f′(x)>0 增", { size: 12, color: C.green, weight: 700 });
    g += txt(m.X(1.4), m.Y(2.6), "f′(x)<0 减", { size: 12, color: C.red, weight: 700 });
    g += txt(m.X(4.0), m.Y(2.6), "f′(x)>0 增", { size: 12, color: C.green, weight: 700 });
    g += txt(m.X(0.15), m.Y(-1.9), 'f′(x)=0 的点是极值可疑点', { size: 11.5, color: C.dim });
    return svg(640, 320, g, '导数符号与函数单调性');
  }

  // 2.9 极值
  function figExtremum() {
    var m = M(640, 300, [-0.6, 5.2], [-2.6, 3.2]);
    var g = axes(m, { stepX: 1, stepY: 1 });
    var f = function (x) { return 0.3 * x * x * x - 2 * x * x + 3 * x - 0.4; };
    g += curve(m, f, -0.2, 5.0, { color: C.line, w: 2.2 });
    g += dot(m, 1.1, f(1.1), { color: C.red, r: 4 });
    g += dot(m, 3.4, f(3.4), { color: C.green, r: 4 });
    g += line(m.X(1.1), m.Y(f(1.1)), m.X(1.1), m.Y(0), { color: C.axis, w: 1, dash: '4 3' });
    g += line(m.X(3.4), m.Y(f(3.4)), m.X(3.4), m.Y(0), { color: C.axis, w: 1, dash: '4 3' });
    g += txt(m.X(1.1), m.Y(f(1.1)) - 10, '极大值', { size: 12, color: C.red, anchor: 'middle', weight: 600 });
    g += txt(m.X(3.4), m.Y(f(3.4)) + 18, '极小值', { size: 12, color: C.green, anchor: 'middle', weight: 600 });
    g += txt(m.X(0.2), m.Y(-2.1), '极值是局部概念，最值是整体概念', { size: 11.5, color: C.dim });
    return svg(640, 300, g, '函数的极大值与极小值');
  }

  /* ---------- 注册表 ---------- */
  window.MATH_FIG = {
    'bx1-c1-1': figSetBasic,
    'bx1-c1-2': figSubset,
    'bx1-c1-3': figSetOps,
    'bx1-c1-8': figQuad,
    'bx1-c1-9': figQuadIneq,
    'bx1-c2-4': figMono,
    'bx1-c2-5': figParity,
    'bx1-c2-6': figPower,
    'bx1-c3-4': figExp,
    'bx1-c3-5': figGrowth,
    'bx1-c4-5': figLog,
    'bx1-c5-1': figZero,
    'bx1-c6-3': figHist,
    'bx2-c1-3': figQuadAngle,
    'bx2-c1-6': figUnitCircle,
    'bx2-c1-10': figSinCos,
    'bx2-c1-11': figAsin,
    'bx2-c1-12': figTan,
    'bx2-c2-3': figVecAdd,
    'bx2-c2-4': figVecSub,
    'bx2-c2-8': figVecCoord,
    'bx2-c2-9': figDot,
    'bx2-c2-12': figTriangle,
    'bx2-c5-2': figComplex,
    'bx2-c6-2': figPrism,
    'bx2-c6-3': figRevolve,
    'bx2-c6-12': figSphere,
    'xx1-c1-2': figSlope,
    'xx1-c1-7': figCircle,
    'xx1-c1-9': figLineCircle,
    'xx1-c1-10': figTwoCircle,
    'xx1-c2-1': figEllipseDef,
    'xx1-c2-2': figEllipseABC,
    'xx1-c2-3': figHyper,
    'xx1-c2-4': figHyperAsym,
    'xx1-c2-5': figParabola,
    'xx1-c3-1': figSpace,
    'xx1-c6-10': figNormal,
    'xx1-c7-1': figRegress,
    'xx2-c2-4': figTangent,
    'xx2-c2-8': figDerivMono,
    'xx2-c2-9': figExtremum
  };

  // 预渲染成字符串，避免每次重绘都重算
  Object.keys(window.MATH_FIG).forEach(function (k) {
    var fn = window.MATH_FIG[k];
    window.MATH_FIG[k] = fn();
  });
})();
