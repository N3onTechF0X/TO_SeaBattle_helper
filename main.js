let fullTree = null;
let currentPath = [];
let currentNode = null;
let searchTerm = "";
let sortMode = "name";

const init = async () => {
  const res = await fetch("api/tree");
  const { root } = await res.json();
  fullTree = { type: "dir", name: "root", children: root, path: "" };

  const urlParams = new URLSearchParams(window.location.search);
  const pathQuery = urlParams.get("path");
  currentPath = pathQuery ? pathQuery.split("/").filter(Boolean) : [];
  currentNode = findNodeByPath(currentPath, fullTree) || fullTree;

  const sortQuery = urlParams.get("sort");
  if (sortQuery && sortModes.some((m) => m.key === sortQuery)) {
    sortMode = sortQuery;
  }

  render();
  updateSortButton();

  document.querySelector("#search").addEventListener("input", ({ target }) => {
    searchTerm = target.value.trim().toLowerCase();
    render();
  });
};

const findNodeByPath = (pathParts, node) => {
  if (!pathParts.length) return node;
  const [head, ...rest] = pathParts;
  const child = node.children.find(({ name }) => name === head);
  return child ? findNodeByPath(rest, child) : null;
};

const updateURL = () => {
  const url = new URL(window.location);

  if (currentPath.length === 0)
    url.searchParams.delete("path");
  else
    url.searchParams.set("path", "/" + currentPath.join("/"));

  if (sortMode === "name")
    url.searchParams.delete("sort");
  else
    url.searchParams.set("sort", sortMode);

  history.replaceState(null, "", url);
};

const sortModes = [
  { key: "name", label: "↑ Имя" },
  { key: "name-desc", label: "↓ Имя" },
  { key: "size", label: "↑ Размер" },
  { key: "size-desc", label: "↓ Размер" },
  { key: "ext", label: "↑ Расширение" },
  { key: "ext-desc", label: "↓ Расширение" },
];

const sortBtn = document.getElementById("sort-btn");

const updateSortButton = () => {
  const mode = sortModes.find((m) => m.key === sortMode);
  sortBtn.textContent = `${mode.label}`;
};

sortBtn.addEventListener("click", () => {
  const idx = sortModes.findIndex((m) => m.key === sortMode);
  const nextIdx = (idx + 1) % sortModes.length;
  sortMode = sortModes[nextIdx].key;
  updateSortButton();
  updateURL();
  render();
});

updateSortButton();

const upBtn = document.getElementById("up-btn");

upBtn.addEventListener("click", () => {
  if (currentPath.length) {
    currentPath.pop();
    currentNode = findNodeByPath(currentPath, fullTree);
    updateURL();
    render();
  }
});

const renderBreadcrumbs = () => {
  const container = document.querySelector("#breadcrumbs");
  const crumbs = ["Корень", ...currentPath];
  container.innerHTML = crumbs
    .map((p, i) => `<span data-i="${i}">${p}</span>`)
    .join("/");

  upBtn.disabled = currentPath.length === 0;

  for (const el of container.querySelectorAll("span")) {
    el.addEventListener("click", () => {
      const idx = Number(el.dataset.i);
      currentPath = currentPath.slice(0, idx);
      currentNode = findNodeByPath(currentPath, fullTree);
      updateURL();
      render();
    });
  }
};

const searchFiles = (node, term, path = "") => {
  const results = [];
  for (const item of node.children) {
    const itemPath = path ? `${path}/${item.name}` : item.name;
    if (item.name.toLowerCase().includes(term))
      results.push({ ...item, relPath: itemPath });
    if (item.type === "dir")
      results.push(...searchFiles(item, term, itemPath));
  }
  return results;
};

const getFolderCount = (node) => {
  if (!node || !node.children) return 0;

  let count = 0;
  for (const child of node.children) {
    if (child.type === "dir")
      count += getFolderCount(child);
    else
      count++;
  }
  return count;
};

const getFolderSize = (node) => {
  if (!node || !node.children) return 0;

  let total = 0;
  for (const child of node.children) {
    if (child.type === "file") total += child.size || 0;
    else if (child.type === "dir") total += getFolderSize(child);
  }
  return total;
};

const getAutoDivePath = (node) => {
  let pathParts = [];
  let cur = node;

  while (
    cur.children &&
    cur.children.length === 1 &&
    cur.children[0].type === "dir"
  ) {
    cur = cur.children[0];
    pathParts.push(cur.name);
  }

  return pathParts;
};

const sortItems = (items) => {
  const getExt = (name) => {
    const parts = name.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  };

  const compare = (a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;

    const sizeA = a.type === "file" ? (a.size || 0) : getFolderSize(a);
    const sizeB = b.type === "file" ? (b.size || 0) : getFolderSize(b);

    switch (sortMode) {
      case "name":
        return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
      case "name-desc":
        return b.name.localeCompare(a.name, "ru", { sensitivity: "base" });
      case "size":
        return sizeA - sizeB;
      case "size-desc":
        return sizeB - sizeA;
      case "ext":
        return getExt(a.name).localeCompare(getExt(b.name)) || 
               a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
      case "ext-desc":
        return getExt(b.name).localeCompare(getExt(a.name)) ||
               b.name.localeCompare(a.name, "ru", { sensitivity: "base" });
      default:
        return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
    }
  };

  return [...items].sort(compare);
};

const formatSize = (bytes) => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const renderFiles = () => {
  const list = document.querySelector("#file-list");
  list.innerHTML = "";

  let itemsToRender = searchTerm
    ? searchFiles(currentNode, searchTerm)
    : currentNode.children.map((c) => ({ ...c, relPath: c.name }));

  itemsToRender = sortItems(itemsToRender);

  for (const item of itemsToRender) {
    const li = document.createElement("li");
    li.className = "file-card";

    const name = document.createElement("div");
    name.className = "file-name";

    if (searchTerm) {
      const safeTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      name.innerHTML = item.name.replace(
        new RegExp(`(${safeTerm})`, "ig"),
        "<mark>$1</mark>"
      );
    } else {
      const divePath = getAutoDivePath(item);
      if (divePath.length)
        name.innerHTML = `
          <span>${item.name}</span>
          <span class="autodive"> ▸ ${divePath.join(" ▸ ")}</span>
        `;
      else
        name.textContent = item.name;
    }

    const pathDiv = document.createElement("div");
    pathDiv.style.fontSize = "0.75rem";
    pathDiv.style.color = "#999";
    pathDiv.style.wordBreak = "break-all";
    pathDiv.textContent = searchTerm ? item.relPath : "";

    const size = document.createElement("div");
    size.className = "file-size";
    size.textContent = item.type === "file" 
      ? formatSize(item.size) 
      : `📁 (${getFolderCount(item)}) ${formatSize(getFolderSize(item))}`;

    li.append(name);
    if (searchTerm) li.append(pathDiv);
    li.append(size);

    li.addEventListener("click", () => {
      if (item.type === "dir" && !searchTerm) {
        currentPath.push(item.name);
        currentNode = item;

        while (
          currentNode.children &&
          currentNode.children.length === 1 &&
          currentNode.children[0].type === "dir"
        ) {
          currentNode = currentNode.children[0];
          currentPath.push(currentNode.name);
        }
        
        updateURL();
        render();
      } else if (item.type === "file")
        window.open(`textures/${item.path}`, "_blank");
    });

    list.append(li);
  }
};

const render = () => {
  renderBreadcrumbs();
  renderFiles();
};

init();