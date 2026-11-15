# 高三数学 · 知识点清单 + 错题本

纯静态页面，无框架、无构建、无依赖。双击 `index.html` 就能用。

```
math/
├── index.html          入口导航
├── gaosan/             知识点清单（11 模块 88 个考点）
│   ├── index.html
│   └── assets/         style.css · app.js · data.js
└── review/             错题本（自动归类到知识点）
    ├── index.html
    └── assets/         style.css · app.js · classify.js · data.js
```

## 两个页面

| 页面 | 用途 | 数据存哪 |
|---|---|---|
| `gaosan/` | 知识点梳理，勾「已掌握」记录进度，可搜索 | `localStorage` → `gsmath.mastered.v1` |
| `review/` | 错题本：抄题 → 自动归到知识点 → 按知识点汇总 → 标「已弄懂」 | `localStorage` → `gsmath.review.v1` |

## 数据说明

`*/assets/data.js` 里的 `window.MATH_DATA` 是唯一数据源，结构：

```js
window.MATH_DATA = [{
  id: 'm1', name: '模块名',
  items: [{
    id: 'm1-1',
    t: '知识点标题',
    star: 1,                    // 1 基础必会 / 2 重点常考 / 3 难点压轴
    core: '一句话核心',
    keys: ['公式或要点', '...'],
    trap: '易错点',
    eg: { q: '例题', a: '答案' }
  }]
}]
```

改知识点只动 `data.js`，两个页面同时生效（各存一份副本，改完记得两份同步）。

## 错题自动归类怎么做的

`review/assets/classify.js`，纯前端本地计算，不联网、不调模型：

1. 把每个知识点的标题、核心、公式、易错点、例题拼成文档，抽特征
2. 特征 = 数学术语（命中权重 3.0）+ 中文 2-gram（1.0）+ 英文字母/符号（1.6）
3. IDF 加权后算余弦相似度，再叠加模块特征词加成
4. 题干里出现「选法」「取球」「a+b=」这类口语说法，先做一次同义扩展
5. 输出 top3 候选，界面默认选第一个，可手动改

自测 20 道典型题，top1 命中 20/20、top3 命中 20/20。这是在自己的题上调参的结果，实际用仍然给 3 个候选让人确认，不硬判。

## 本地预览

```bash
cd math
python3 -m http.server 8080
# 打开 http://127.0.0.1:8080
```

## 部署

推到 GitHub 后，Vercel 导入该仓库：Framework 选 **Other**，Build Command 留空，Output Directory 留空。之后每次 `git push` 自动重新部署。

## 已知限制

- 进度存浏览器本地，不跨设备。错题本支持「备份 → 导出 JSON」，换设备导入。
- 无后端、无账号、无云端。
