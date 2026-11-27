const catalogs = {
  water: { name: "水专业政策法规", category: "主题", unit: "条政策" },
  policies: { name: "动力专业政策法规", category: "领域", unit: "条法规政策" },
  standards: { name: "规划与设计规范", category: "专业", unit: "部规范" },
};
const filterFields = ["level", "topic", "kind", "issuer", "from", "to"];
const perPage = 18;
const id = name => document.getElementById(name);
const nav = [...document.querySelectorAll("[data-catalog]")];
const collator = new Intl.Collator("zh-CN", { numeric: true });
const textSearch = value => (value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
const numberSearch = value => textSearch(value).replace(/[〔〕【】()[\]\/\u2010-\u2015-]/g, "");
let data;
let state = readUrl();

function readUrl() {
  const params = new URLSearchParams(location.search);
  const candidate = params.get("catalog");
  const catalog = Object.hasOwn(catalogs, candidate) ? candidate : "water";
  const sort = ["new", "old", "title"].includes(params.get("sort")) ? params.get("sort") : "new";
  const filters = Object.fromEntries(filterFields.map(name => [name, params.get(name) || ""]));
  const page = Math.max(1, parseInt(params.get("page"), 10) || 1);
  return { catalog, q: params.get("q") || "", sort, page, ...filters };
}

function writeUrl(method = "replaceState") {
  const params = new URLSearchParams();
  if (state.catalog !== "water") params.set("catalog", state.catalog);
  if (state.q) params.set("q", state.q);
  for (const name of filterFields) if (state[name]) params.set(name, state[name]);
  if (state.sort !== "new") params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  const query = params.toString();
  history[method](null, "", query ? location.pathname + "?" + query : location.pathname);
}

function syncForm(items) {
  const options = {
    level: ["国家", "北京市"].filter(level => items.some(item => item.level === level)),
    topic: [...new Set(items.flatMap(item => item.topics))].sort(collator.compare),
    kind: [...new Set(items.map(item => item.kind).filter(Boolean))].sort(collator.compare),
    issuer: [...new Set(items.map(item => item.issuer).filter(Boolean))].sort(collator.compare),
  };
  const category = catalogs[state.catalog].category;
  const emptyLabel = { level: "全部层级", topic: "全部" + category, kind: "全部类型", issuer: "全部机构" };
  for (const [name, values] of Object.entries(options)) {
    if (!values.includes(state[name])) state[name] = "";
    id(name).replaceChildren(new Option(emptyLabel[name], ""), ...values.map(value => new Option(value, value)));
    id(name).value = state[name];
  }
  id("topic-label").textContent = category;
  id("keyword").value = state.q;
  id("from").value = state.from;
  id("to").value = state.to;
  id("sort").value = state.sort;
}

function filterItems(items) {
  const query = textSearch(state.q);
  const number = numberSearch(state.q);
  return items.filter(item => {
    if (state.level && item.level !== state.level) return false;
    if (state.topic && !item.topics.includes(state.topic)) return false;
    if (state.kind && state.kind !== item.kind) return false;
    if (state.issuer && state.issuer !== item.issuer) return false;
    if (state.from && (!item.date || item.date < state.from)) return false;
    if (state.to && (!item.date || item.date > state.to)) return false;
    if (!query) return true;
    const keywords = Array.isArray(item.keywords) ? item.keywords : [];
    const fields = [item.title, item.doc, item.issuer, ...item.topics, ...keywords];
    return fields.some(field => textSearch(field).includes(query)) ||
      Boolean(number && numberSearch(item.doc).includes(number));
  }).sort((a, b) => {
    if (state.sort === "title") return collator.compare(a.title, b.title);
    if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : collator.compare(a.title, b.title);
    const byDate = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    return (state.sort === "old" ? byDate : -byDate) || collator.compare(a.title, b.title);
  });
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function sourceLink(href, label) {
  const link = node("a", "", label);
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function record(item) {
  const row = node("article", "record");
  row.dataset.level = item.level;
  const tags = node("div", "record-tags");
  const values = [item.level, item.kind, ...item.topics].filter(Boolean);
  tags.append(...[...new Set(values)].map(value => node("span", "record-tag", value)));
  const heading = node("h3");
  heading.append(sourceLink(item.url, item.title));
  const meta = node("p", "record-meta");
  const fields = [
    item.doc && "文号 " + item.doc,
    item.date && "发布 " + item.date,
    item.effective && "实施 " + item.effective,
    item.issuer && "发布机构 " + item.issuer,
  ];
  meta.append(...fields.filter(Boolean).map(value => node("span", "", value)));
  const actions = node("div", "record-actions");
  actions.append(sourceLink(item.url, state.catalog === "standards" ? "查看规范来源" : "查看政策原文"));
  for (const alternate of item.links || []) {
    actions.append(sourceLink(alternate.url, alternate.label || "其他来源"));
  }
  row.append(tags, heading, meta, actions);
  return row;
}

function render() {
  const config = catalogs[state.catalog];
  document.title = config.name + " | 市政政策与规范查询";
  const items = data.catalogs[state.catalog];
  syncForm(items);
  for (const link of nav) {
    const selected = link.dataset.catalog === state.catalog;
    if (selected) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
    link.querySelector("span").textContent = data.catalogs[link.dataset.catalog].length;
  }
  const results = filterItems(items);
  const pages = Math.max(1, Math.ceil(results.length / perPage));
  state.page = Math.min(state.page, pages);
  const start = (state.page - 1) * perPage;
  const pageRows = results.slice(start, start + perPage);
  id("result-heading").textContent = config.name;
  id("count").textContent = "共 " + results.length + " " + config.unit +
    (results.length ? "，显示 " + (start + 1) + "–" + (start + pageRows.length) : "");
  id("records").replaceChildren(...(pageRows.length ? pageRows.map(record) :
    [node("p", "empty", "暂无符合条件的资料。可以修改关键词或重置筛选。")]));
  id("pagination").hidden = pages < 2;
  id("previous").disabled = state.page === 1;
  id("next").disabled = state.page === pages;
  id("page-index").textContent = "第 " + state.page + " / " + pages + " 页";
}

function update(changes, historyMethod) {
  if (!data) return;
  state = { ...state, page: 1, ...changes };
  render();
  writeUrl(historyMethod);
}

for (const link of nav) {
  link.addEventListener("click", event => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !data) return;
    event.preventDefault();
    if (state.catalog === link.dataset.catalog) return;
    update({
      catalog: link.dataset.catalog, q: "", sort: "new",
      ...Object.fromEntries(filterFields.map(name => [name, ""])),
    }, "pushState");
  });
}
id("search").addEventListener("submit", event => {
  event.preventDefault();
  update({ q: id("keyword").value.trim() });
});
for (const name of [...filterFields, "sort"]) {
  id(name).addEventListener("change", event => update({ [name]: event.target.value, q: id("keyword").value.trim() }));
}
id("reset").addEventListener("click", () => update({
  q: "", sort: "new", ...Object.fromEntries(filterFields.map(name => [name, ""])),
}));
for (const [name, offset] of [["previous", -1], ["next", 1]]) {
  id(name).addEventListener("click", () => {
    update({ page: state.page + offset });
    id("result-heading").scrollIntoView({ block: "start" });
  });
}
addEventListener("popstate", () => {
  state = readUrl();
  if (data) render();
});

try {
  const response = await fetch("./catalog.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("catalog");
  data = await response.json();
  id("edition").textContent = "政策资料更新于 " + data.policyDate + "（北京时间）";
  id("edition").hidden = false;
  render();
} catch {
  id("count").textContent = "暂时无法加载资料";
  id("records").replaceChildren(node("p", "empty", "请刷新本页后重试。"));
}
