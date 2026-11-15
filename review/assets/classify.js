/*!
 * 错题自动归类：数学术语命中 + 中文 2-gram + IDF 余弦 + 模块特征词加成
 * 纯前端、无网络、无依赖。输入题干原文，输出最可能的 3 个知识点（附命中依据）。
 */
(function (root) {
  'use strict';

  // 高频虚词，作为 2-gram 的过滤条件（两个字都是虚词才丢）
  var STOP = {};
  '的了是在和与或为则求已得其之且有可也都就很若使当设解'.split('').forEach(function (c) { STOP[c] = 1; });

  // 数学术语表：命中一次权重 3.0，远高于零碎 2-gram，用来压掉跨词噪声
  var TERMS = [
    // 集合逻辑
    '集合', '子集', '真子集', '交集', '并集', '补集', '空集', '元素', '韦恩图', '命题', '否命题',
    '充分条件', '必要条件', '充要条件', '量词', '全称', '存在量词', '逻辑联结',
    // 函数
    '定义域', '值域', '解析式', '分段函数', '单调性', '单调区间', '奇偶性', '周期性', '对称轴',
    '指数函数', '对数函数', '幂函数', '反函数', '零点', '二分法', '复合函数', '图像变换',
    // 导数
    '导数', '求导', '切线', '极值', '极大值', '极小值', '最大值', '最小值', '最值', '单调递增',
    '单调递减', '恒成立', '构造函数', '极值点偏移', '拐点', '二阶导',
    // 三角
    '三角函数', '正弦', '余弦', '正切', '弧度', '诱导公式', '和差角', '二倍角', '辅助角',
    '解三角形', '正弦定理', '余弦定理', '面积公式', '周期', '振幅', '相位',
    // 向量复数
    '平面向量', '数量积', '共线', '垂直', '夹角', '基底', '坐标运算', '复数', '共轭复数',
    '虚部', '实部', '模长',
    // 数列
    '数列', '等差数列', '等比数列', '公差', '公比', '通项公式', '前n项和', '递推', '累加',
    '累乘', '错位相减', '裂项相消', '分组求和',
    // 不等式
    '不等式', '一元二次不等式', '基本不等式', '均值不等式', '线性规划', '可行域', '目标函数',
    '解集', '绝对值不等式',
    // 立体几何
    '立体几何', '棱柱', '棱锥', '棱台', '圆锥', '圆柱', '球', '异面直线', '二面角', '线面角',
    '线面平行', '线面垂直', '面面平行', '面面垂直', '三视图', '体积', '表面积', '外接球',
    '空间向量', '法向量',
    // 解析几何
    '解析几何', '直线方程', '斜率', '圆的方程', '椭圆', '双曲线', '抛物线', '焦点', '离心率',
    '准线', '渐近线', '弦长', '中点弦', '点差法', '轨迹方程', '圆锥曲线', '相交', '相切',
    // 计数概率统计
    '排列', '组合', '排列组合', '分类计数', '分步计数', '二项式定理', '展开式', '常数项',
    '二项式系数', '概率', '古典概型', '几何概型', '条件概率', '相互独立', '互斥', '分布列',
    '数学期望', '方差', '正态分布', '抽样', '回归直线', '独立性检验', '频率分布直方图',
    // 选考
    '参数方程', '极坐标', '不等式选讲', '数学归纳法', '放缩'
  ];

  // 同义扩展：题干里的口语化说法映射到教材术语（只加高价值的几条）
  var SYN = [
    [/(选法|多少种|几种|方案数|选\s*\d*\s*人|选出)/, '排列组合 分类计数'],
    [/(a\s*\+\s*b\s*=)/, '基本不等式 均值不等式'],
    [/(取球|任取|同色|抽到|摸出|掷|翻牌)/, '古典概型 概率 分布列'],
    [/((圆|椭圆|双曲线|抛物线)[\s\S]{0,30}(切线|相切|切点))/, '圆的方程 圆锥曲线 相切'],
    [/(有多|几个)解/, '零点'],
    [/(求和|加起来)/, '前n项和']
  ];

  // 每个模块的特征词：题干里出现就直接给该模块加分
  var MOD_WORDS = {
    m1: ['集合', '子集', '交集', '并集', '补集', '命题', '充分', '必要', '充要', '量词', '全称', '存在', '逻辑', '韦恩图'],
    m2: ['函数', '定义域', '值域', '单调', '奇偶', '周期', '零点', '指数', '对数', '幂函数', '分段', '图像', '对称', '反函数'],
    m3: ['导数', '求导', '极值', '最值', '切线', '单调区间', '恒成立', '构造函数', '零点个数', '拐点'],
    m4: ['三角', '正弦', '余弦', '正切', '弧度', '和差', '二倍角', '辅助角', '解三角形', '余弦定理', '正弦定理', '面积公式', '图像变换'],
    m5: ['向量', '数量积', '共线', '垂直', '夹角', '坐标运算', '复数', '共轭', '虚部', '实部', '模长'],
    m6: ['数列', '等差', '等比', '通项', '前n项和', '公差', '公比', '递推', '累加', '累乘', '错位相减', '裂项'],
    m7: ['不等式', '均值', '基本不等式', '线性规划', '可行域', '一元二次', '解集', '恒成立'],
    m8: ['立体', '棱柱', '棱锥', '棱台', '球', '异面', '二面角', '线面', '面面', '体积', '表面积', '三视图', '外接球', '空间向量', '法向量'],
    m9: ['解析几何', '直线', '斜率', '圆', '椭圆', '双曲线', '抛物线', '离心率', '准线', '焦点', '弦长', '中点弦', '轨迹', '渐近线', '相切', '切点', '圆心', '半径', '切线方程'],
    m10: ['概率', '统计', '排列', '组合', '二项式', '展开式', '分布列', '期望', '方差', '抽样', '回归', '独立性检验', '古典概型', '条件概率', '正态'],
    m11: ['压轴', '选考', '参数方程', '极坐标', '不等式选讲', '绝对值不等式', '放缩', '数学归纳']
  };

  function isCJK(s) { return /[\u4e00-\u9fa5]/.test(s); }
  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/[\u3000]/g, ' ')
      .replace(/[，。；：、（）【】「」《》？！,.;:()\[\]<>"'"'']/g, ' ');
  }

  // 特征抽取：数学术语 + 中文 2-gram + 英文/符号 token
  function feat(text) {
    var s = norm(text);
    // 同义扩展
    SYN.forEach(function (rule) { if (rule[0].test(s)) s += ' ' + rule[1]; });
    var out = {}, i, g, seg;
    // 术语
    for (i = 0; i < TERMS.length; i++) {
      if (s.indexOf(TERMS[i]) >= 0) out['T:' + TERMS[i]] = 1;
    }
    // 中文 2-gram
    var cjk = s.match(/[\u4e00-\u9fa5]+/g) || [];
    for (var k = 0; k < cjk.length; k++) {
      seg = cjk[k];
      for (i = 0; i < seg.length - 1; i++) {
        g = seg.substr(i, 2);
        if (STOP[g.charAt(0)] && STOP[g.charAt(1)]) continue;
        out[g] = (out[g] || 0) + 1;
      }
      if (seg.length === 1) out[seg] = (out[seg] || 0) + 1;
    }
    // 英文/符号
    var tok = s.match(/[a-z]{2,}|[∈⊆⊂∩∪≤≥≠±∑√∫′°π∅]/g) || [];
    for (i = 0; i < tok.length; i++) out['#' + tok[i]] = (out['#' + tok[i]] || 0) + 1;
    return out;
  }

  // 特征权重：术语 3.0 > 符号 1.6 > 零碎 2-gram 1.0
  function weightOf(g) {
    if (g.indexOf('T:') === 0) return 3.0;
    if (g.charAt(0) === '#') return 1.6;
    return 1.0;
  }

  var IDX = null;

  function build(mods) {
    var docs = [], df = {}, N = 0;
    mods.forEach(function (m) {
      m.items.forEach(function (it) {
        var text = [m.name, it.t, it.core, (it.keys || []).join(' '), it.trap || '',
          it.eg ? it.eg.q : ''].join(' ');
        var f = feat(text);
        var tf = feat(it.t + ' ' + m.name);   // 标题特征，命中另有加成
        var d = { id: it.id, mod: m.id, modName: m.name, title: it.t, star: it.star, f: f, tf: tf, w: {}, norm: 1 };
        docs.push(d);
        for (var g in f) df[g] = (df[g] || 0) + 1;
      });
    });
    N = docs.length;
    docs.forEach(function (d) {
      var s = 0, g;
      for (g in d.f) {
        var w = Math.log(1 + N / (df[g] || 1)) * weightOf(g) * (d.tf[g] ? 1.8 : 1);
        d.w[g] = w;
        s += w * w;
      }
      d.norm = Math.sqrt(s) || 1;
    });
    IDX = { docs: docs, df: df, N: N, byId: {} };
    docs.forEach(function (d) { IDX.byId[d.id] = d; });
    return IDX;
  }

  // 返回 [{id, title, modName, score, hits:[...]}]
  function rank(text, topN) {
    if (!IDX) return [];
    topN = topN || 3;
    var q = feat(text), g, N = IDX.N, qn = 0, qw = {};
    for (g in q) {
      if (!IDX.df[g]) continue;
      qw[g] = Math.log(1 + N / IDX.df[g]) * weightOf(g);
      qn += qw[g] * qw[g];
    }
    qn = Math.sqrt(qn) || 1;

    // 模块特征词命中（乘性加成，避免给整模块平均抬分）
    var modBoost = {}, raw = norm(text);
    for (var mk in MOD_WORDS) {
      var c = 0;
      MOD_WORDS[mk].forEach(function (w) { if (raw.indexOf(w) >= 0) c += (w.length >= 3 ? 2 : 1); });
      if (c) modBoost[mk] = Math.min(0.45, c * 0.09);
    }

    var out = [];
    IDX.docs.forEach(function (d) {
      var dot = 0;
      for (g in qw) {
        if (d.w[g]) { dot += qw[g] * d.w[g]; }
      }
      var sc = dot / (qn * d.norm);
      if (modBoost[d.mod]) sc *= (1 + modBoost[d.mod]);
      if (sc > 0.001) out.push({ d: d, s: sc });
    });
    out.sort(function (a, b) { return b.s - a.s; });

    return out.slice(0, topN).map(function (o) {
      var hs = [];
      for (var g2 in qw) {
        if (o.d.w[g2]) hs.push({ g: g2, w: qw[g2] * o.d.w[g2] });
      }
      hs.sort(function (a, b) { return b.w - a.w; });
      var shown = [], seen = {};
      hs.forEach(function (h) {
        if (shown.length >= 5) return;
        var t = h.g.indexOf('T:') === 0 ? h.g.slice(2) : h.g.replace(/^#/, '');
        if (seen[t]) return;
        // 只展示术语、符号、以及纯中文 2-gram
        if (h.g.indexOf('T:') !== 0 && h.g.charAt(0) !== '#' && !/[\u4e00-\u9fa5]{2}/.test(t)) return;
        seen[t] = 1;
        shown.push(t);
      });
      return { id: o.d.id, title: o.d.title, modName: o.d.modName, score: Math.round(o.s * 1000) / 1000, hits: shown };
    });
  }

  var api = { build: build, rank: rank, feat: feat };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KPClassify = api;
})(typeof window !== 'undefined' ? window : this);
