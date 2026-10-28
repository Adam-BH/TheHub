(function () {
  "use strict";

  const fallbackPages = Array.isArray(window.HUB_FALLBACK_PAGES) ? window.HUB_FALLBACK_PAGES : [];

  const state = {
    pages: [],
    filtered: [],
    source: "local",
    repo: null,
    filters: {
      query: "",
      program: "all",
      term: "all"
    }
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindElements();
    bindEvents();
    setStatus("Lecture du dossier pages...");

    const githubPages = await discoverFromGitHub();
    const directoryPages = githubPages.length ? [] : await discoverFromDirectoryListing("pages/");
    const discoveredPages = githubPages.length ? githubPages : directoryPages;
    const seedPages = discoveredPages.length ? mergeFallbackMetadata(discoveredPages) : fallbackPages;
    state.source = githubPages.length ? "github" : (directoryPages.length ? "directory" : "local");
    state.pages = await enrichPages(dedupePages(seedPages.map(normalizePage).filter(Boolean)));

    populateFilters();
    updateRepoLink();
    render();
  }

  function bindElements() {
    els.search = document.querySelector("#hubSearch");
    els.program = document.querySelector("#programFilter");
    els.term = document.querySelector("#termFilter");
    els.reset = document.querySelector("#resetFilters");
    els.groups = document.querySelector("#pageGroups");
    els.tree = document.querySelector("#folderTree");
    els.empty = document.querySelector("#emptyState");
    els.status = document.querySelector("#hubStatus");
    els.repoLink = document.querySelector("#repoLink");
    els.count = document.querySelector("#statCount");
    els.tracks = document.querySelector("#statTracks");
    els.terms = document.querySelector("#statTerms");
  }

  function bindEvents() {
    if (els.search) {
      els.search.addEventListener("input", function (event) {
        state.filters.query = event.target.value.trim().toLowerCase();
        render();
      });
    }

    if (els.program) {
      els.program.addEventListener("change", function (event) {
        state.filters.program = event.target.value;
        render();
      });
    }

    if (els.term) {
      els.term.addEventListener("change", function (event) {
        state.filters.term = event.target.value;
        render();
      });
    }

    if (els.reset) {
      els.reset.addEventListener("click", function () {
        state.filters.query = "";
        state.filters.program = "all";
        state.filters.term = "all";
        if (els.search) els.search.value = "";
        if (els.program) els.program.value = "all";
        if (els.term) els.term.value = "all";
        render();
      });
    }
  }

  async function discoverFromGitHub() {
    const repo = resolveRepo();
    if (!repo) return [];

    state.repo = repo;

    try {
      const files = await listGitHubDirectory(repo, "pages");
      return files.map(function (file) {
        return {
          path: file.path,
          downloadUrl: file.download_url || "",
          source: "github"
        };
      });
    } catch (error) {
      setStatus("Index local prêt. La découverte GitHub prendra le relais une fois publié.");
      return [];
    }
  }

  async function discoverFromDirectoryListing(dir) {
    const directory = dir.endsWith("/") ? dir : dir + "/";

    try {
      const response = await fetch(directory, { cache: "no-store" });
      if (!response.ok) return [];

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const links = Array.from(doc.querySelectorAll("a[href]"))
        .map(function (anchor) { return anchor.getAttribute("href") || ""; })
        .map(function (href) { return href.split("#")[0].split("?")[0]; })
        .filter(function (href) {
          return href && href !== "../" && href !== "./" && !href.startsWith("..") && !href.startsWith("http");
        });

      const nested = await Promise.all(links.map(function (href) {
        const decoded = decodeURIComponent(href);
        const nextPath = joinPath(directory, decoded);
        if (decoded.endsWith("/")) return discoverFromDirectoryListing(nextPath);
        if (/\.html$/i.test(decoded)) return [{ path: nextPath, source: "directory" }];
        return [];
      }));

      return nested.flat();
    } catch (error) {
      return [];
    }
  }

  function resolveRepo() {
    if (window.HUB_REPO && window.HUB_REPO.owner && window.HUB_REPO.repo) {
      return {
        owner: window.HUB_REPO.owner,
        repo: window.HUB_REPO.repo
      };
    }

    const host = window.location.hostname.toLowerCase();
    if (!host.endsWith(".github.io")) return null;

    const owner = host.replace(".github.io", "");
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const repo = pathParts.length ? pathParts[0] : owner + ".github.io";

    return { owner, repo };
  }

  async function listGitHubDirectory(repo, dir) {
    const apiPath = dir.split("/").map(encodeURIComponent).join("/");
    const url = "https://api.github.com/repos/" + encodeURIComponent(repo.owner) + "/" + encodeURIComponent(repo.repo) + "/contents/" + apiPath;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json"
      }
    });

    if (!response.ok) {
      throw new Error("GitHub API returned " + response.status);
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) return [];

    const nested = await Promise.all(payload.map(function (item) {
      if (item.type === "dir") return listGitHubDirectory(repo, item.path);
      if (item.type === "file" && /\.html$/i.test(item.name || "") && /^pages\//i.test(item.path || "")) {
        return [item];
      }
      return [];
    }));

    return nested.flat();
  }

  function normalizePage(page) {
    const path = String(page.path || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!path || !/\.html$/i.test(path)) return null;

    const parts = path.split("/");
    const pagesIndex = parts.indexOf("pages");
    const scoped = pagesIndex >= 0 ? parts.slice(pagesIndex + 1) : parts;
    const fileName = scoped[scoped.length - 1] || "";
    const folders = scoped.slice(0, -1);
    const slug = fileName.replace(/\.html$/i, "");
    const programKey = folders[0] || "general";
    const termKey = folders[1] || "cours";

    const explicitSummary = cleanText(page.summary);
    const explicitTopics = Array.isArray(page.topics) ? page.topics.map(cleanText).filter(Boolean) : [];

    return {
      path,
      href: path,
      folders,
      fileName,
      slug,
      programKey,
      termKey,
      program: labelSegment(programKey),
      term: labelSegment(termKey),
      title: cleanText(page.title) || titleFromSlug(slug),
      summary: explicitSummary || summaryForSlug(slug),
      summaryExplicit: Boolean(explicitSummary),
      topics: explicitTopics,
      topicsExplicit: Boolean(explicitTopics.length),
      source: page.source || "local",
      downloadUrl: page.downloadUrl || ""
    };
  }

  function mergeFallbackMetadata(pages) {
    const metadata = new Map();
    fallbackPages.forEach(function (page) {
      if (page && page.path) metadata.set(normalizePath(page.path), page);
    });

    const merged = pages.map(function (page) {
      const match = metadata.get(normalizePath(page.path));
      if (!match) return page;
      return Object.assign({}, page, {
        title: match.title || page.title,
        summary: match.summary || page.summary,
        topics: match.topics || page.topics
      });
    });

    // Always keep pages listed locally (HUB_FALLBACK_PAGES), even if GitHub doesn't have them yet.
    const known = new Set(merged.map(function (page) { return normalizePath(page.path); }));
    fallbackPages.forEach(function (page) {
      if (page && page.path && !known.has(normalizePath(page.path))) merged.push(page);
    });
    return merged;
  }

  function normalizePath(path) {
    return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
  }

  function dedupePages(pages) {
    const seen = new Map();
    pages.forEach(function (page) {
      seen.set(page.path, page);
    });
    return Array.from(seen.values()).sort(comparePages);
  }

  async function enrichPages(pages) {
    const enriched = await Promise.all(pages.map(enrichPage));
    return enriched.sort(comparePages);
  }

  async function enrichPage(page) {
    try {
      const response = await fetch(page.href, { cache: "no-store" });
      if (!response.ok) return page;
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const h1 = cleanText(doc.querySelector("h1") && doc.querySelector("h1").textContent);
      const docTitle = cleanTitle(cleanText(doc.querySelector("title") && doc.querySelector("title").textContent));
      const subtitle = cleanText(doc.querySelector(".subtitle") && doc.querySelector(".subtitle").textContent);
      const byline = cleanText(doc.querySelector(".byline") && doc.querySelector(".byline").textContent);
      const headingTopics = Array.from(doc.querySelectorAll("h2, .ssec-head h3"))
        .map(function (heading) { return cleanTopic(heading.textContent); })
        .filter(Boolean)
        .slice(0, 6);

      return Object.assign({}, page, {
        title: h1 || docTitle || page.title,
        summary: page.summaryExplicit ? page.summary : (subtitle || byline || summaryFromTopics(headingTopics) || page.summary),
        topics: page.topicsExplicit ? page.topics : (headingTopics.length ? headingTopics : page.topics)
      });
    } catch (error) {
      return page;
    }
  }

  function populateFilters() {
    fillSelect(els.program, "Tous les niveaux", uniqueBy(state.pages, "programKey").map(function (page) {
      return { value: page.programKey, label: page.program };
    }));

    fillSelect(els.term, "Tous les semestres", uniqueBy(state.pages, "termKey").map(function (page) {
      return { value: page.termKey, label: page.term };
    }).sort(function (a, b) {
      return rankTerm(a.value) - rankTerm(b.value) || a.label.localeCompare(b.label);
    }));
  }

  function fillSelect(select, allLabel, items) {
    if (!select) return;
    const current = select.value || "all";
    select.innerHTML = "";
    select.appendChild(new Option(allLabel, "all"));
    items.forEach(function (item) {
      select.appendChild(new Option(item.label, item.value));
    });
    select.value = Array.from(select.options).some(function (option) { return option.value === current; }) ? current : "all";
  }

  function render() {
    state.filtered = state.pages.filter(matchesFilters);
    renderStats();
    renderTree();
    renderGroups();
    renderStatus();
  }

  function matchesFilters(page) {
    const query = state.filters.query;
    const matchesQuery = !query || [
      page.title,
      page.summary,
      page.program,
      page.term,
      page.path,
      page.topics.join(" ")
    ].join(" ").toLowerCase().includes(query);

    const matchesProgram = state.filters.program === "all" || page.programKey === state.filters.program;
    const matchesTerm = state.filters.term === "all" || page.termKey === state.filters.term;

    return matchesQuery && matchesProgram && matchesTerm;
  }

  function renderStats() {
    if (els.count) els.count.textContent = String(state.pages.length);
    if (els.tracks) els.tracks.textContent = String(uniqueValues(state.pages, "programKey").length);
    if (els.terms) els.terms.textContent = String(uniqueValues(state.pages, "termKey").length);
  }

  function renderStatus() {
    const count = state.filtered.length;
    const total = state.pages.length;
    const sourceText = state.source === "github" && state.repo
      ? "source GitHub"
      : (state.source === "directory" ? "source pages/" : "source locale");
    setStatus(count + " fiche" + (count > 1 ? "s" : "") + " affichée" + (count > 1 ? "s" : "") + " sur " + total + " · " + sourceText + ".");
  }

  function updateRepoLink() {
    if (!els.repoLink) return;

    const explicitUrl = cleanText(window.HUB_REPO_URL);
    const repoUrl = explicitUrl || (state.repo ? "https://github.com/" + state.repo.owner + "/" + state.repo.repo : "");

    if (repoUrl) {
      els.repoLink.href = repoUrl;
      els.repoLink.title = "Ouvrir le dépôt GitHub";
      return;
    }

    els.repoLink.href = "https://github.com/";
    els.repoLink.title = "Ajoute window.HUB_REPO_URL dans index.html après avoir créé le dépôt";
  }

  function renderTree() {
    if (!els.tree) return;
    const root = buildTree(state.pages);
    els.tree.innerHTML = "";
    Object.keys(root).sort().forEach(function (programKey) {
      const programNode = root[programKey];
      const programItem = document.createElement("li");
      programItem.className = "tree-node";
      programItem.innerHTML = "<strong>" + escapeHtml(labelSegment(programKey)) + "</strong><span>" + countFiles(programNode) + " fiche" + (countFiles(programNode) > 1 ? "s" : "") + "</span>";

      const termList = document.createElement("ul");
      termList.className = "folder-tree";
      Object.keys(programNode).sort(function (a, b) {
        return rankTerm(a) - rankTerm(b) || a.localeCompare(b);
      }).forEach(function (termKey) {
        const termItem = document.createElement("li");
        termItem.className = "tree-node";
        termItem.innerHTML = "<strong>" + escapeHtml(labelSegment(termKey)) + "</strong><span>" + programNode[termKey].map(function (page) { return page.slug; }).join(", ") + "</span>";
        termList.appendChild(termItem);
      });

      programItem.appendChild(termList);
      els.tree.appendChild(programItem);
    });
  }

  function renderGroups() {
    if (!els.groups || !els.empty) return;
    els.groups.innerHTML = "";

    if (!state.filtered.length) {
      els.empty.classList.add("is-visible");
      return;
    }

    els.empty.classList.remove("is-visible");

    groupPages(state.filtered).forEach(function (group) {
      const section = document.createElement("section");
      section.className = "semester-section";
      section.setAttribute("aria-labelledby", group.id);

      const head = document.createElement("div");
      head.className = "semester-head";
      head.innerHTML = [
        "<div>",
        "<span class=\"section-kicker\">" + escapeHtml(group.program) + " / " + escapeHtml(group.term) + "</span>",
        "<h2 class=\"section-title\" id=\"" + group.id + "\">" + escapeHtml(group.term) + "</h2>",
        "<p class=\"section-note\">" + escapeHtml(group.pages.length + " fiche" + (group.pages.length > 1 ? "s" : "") + " dans " + group.pathLabel + ".") + "</p>",
        "</div>",
        "<span class=\"pill\">" + escapeHtml(group.program) + "</span>"
      ].join("");

      const grid = document.createElement("div");
      grid.className = "subject-grid";
      group.pages.forEach(function (page) {
        grid.appendChild(renderCard(page));
      });

      section.appendChild(head);
      section.appendChild(grid);
      els.groups.appendChild(section);
    });
  }

  function renderCard(page) {
    const card = document.createElement("a");
    card.className = "subject-card";
    card.href = page.href;
    card.innerHTML = [
      "<span class=\"card-path\">" + escapeHtml(page.path) + "</span>",
      "<h3 class=\"card-title\">" + escapeHtml(page.title) + "</h3>",
      "<p class=\"card-summary\">" + escapeHtml(page.summary || summaryForSlug(page.slug)) + "</p>",
      "<div class=\"topic-list\">" + topicsHtml(page.topics, page.slug) + "</div>",
      "<div class=\"card-footer\"><span>Ouvrir la fiche</span><span aria-hidden=\"true\">HTML</span></div>"
    ].join("");
    return card;
  }

  function groupPages(pages) {
    const map = new Map();

    pages.forEach(function (page) {
      const key = page.programKey + "/" + page.termKey;
      if (!map.has(key)) {
        map.set(key, {
          key,
          id: "group-" + slugify(key),
          program: page.program,
          term: page.term,
          termKey: page.termKey,
          pathLabel: "pages/" + [page.programKey, page.termKey].filter(Boolean).join("/"),
          pages: []
        });
      }
      map.get(key).pages.push(page);
    });

    return Array.from(map.values()).sort(function (a, b) {
      return a.program.localeCompare(b.program) || rankTerm(a.termKey) - rankTerm(b.termKey) || a.term.localeCompare(b.term);
    });
  }

  function buildTree(pages) {
    return pages.reduce(function (tree, page) {
      if (!tree[page.programKey]) tree[page.programKey] = {};
      if (!tree[page.programKey][page.termKey]) tree[page.programKey][page.termKey] = [];
      tree[page.programKey][page.termKey].push(page);
      return tree;
    }, {});
  }

  function countFiles(node) {
    return Object.keys(node).reduce(function (total, key) {
      return total + node[key].length;
    }, 0);
  }

  function uniqueBy(items, key) {
    const seen = new Set();
    return items.filter(function (item) {
      if (seen.has(item[key])) return false;
      seen.add(item[key]);
      return true;
    }).sort(function (a, b) {
      return a[key].localeCompare(b[key]);
    });
  }

  function uniqueValues(items, key) {
    return Array.from(new Set(items.map(function (item) { return item[key]; })));
  }

  function topicsHtml(topics, slug) {
    const list = topics.length ? topics : defaultTopics(slug);
    return list.slice(0, 5).map(function (topic) {
      return "<span class=\"topic\">" + escapeHtml(topic) + "</span>";
    }).join("");
  }

  function labelSegment(segment) {
    const safe = String(segment || "").replace(/[-_]+/g, " ");
    const gl = safe.match(/^gl\s*(\d+)$/i);
    if (gl) return "GL" + gl[1];

    const sem = safe.match(/^(sem|semestre|s)\s*(\d+)$/i);
    if (sem) return "Semestre " + sem[2];

    return safe.replace(/\b\w/g, function (letter) {
      return letter.toUpperCase();
    }) || "Cours";
  }

  function titleFromSlug(slug) {
    return labelSegment(slug).replace(/\bHtml\b/g, "HTML");
  }

  function summaryForSlug(slug) {
    const key = String(slug || "").toLowerCase();
    const summaries = {
      analyse: "Topologie de R^m, normes, continuité, différentielles, Taylor et recherche d'extrema.",
      algebre: "Sommes directes, diagonalisation, formes bilinéaires, orthogonalité, Gram-Schmidt et théorème spectral."
    };
    return summaries[key] || "Fiche de révision structurée avec définitions, méthodes, résultats clés et synthèse.";
  }

  function defaultTopics(slug) {
    const key = String(slug || "").toLowerCase();
    const topics = {
      analyse: ["Topologie", "Différentielle", "Taylor", "Extrema"],
      algebre: ["Diagonalisation", "Euclidien", "Orthogonalité", "Spectral"]
    };
    return topics[key] || ["Cours", "Méthodes", "Révision"];
  }

  function summaryFromTopics(topics) {
    if (!topics.length) return "";
    return "Résumé autour de " + topics.slice(0, 3).join(", ") + ".";
  }

  function cleanTopic(value) {
    return cleanText(value)
      .replace(/^§\s*[A-Z0-9.]+\s*/i, "")
      .replace(/\$/g, "")
      .slice(0, 80);
  }

  function cleanTitle(value) {
    return cleanText(value)
      .replace(/\s*[·|-]\s*INSAT.*$/i, "")
      .replace(/\s*[—-]\s*Fiche.*$/i, "")
      .trim();
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/&amp;/g, "&")
      .trim();
  }

  function comparePages(a, b) {
    return a.program.localeCompare(b.program)
      || rankTerm(a.termKey) - rankTerm(b.termKey)
      || a.title.localeCompare(b.title);
  }

  function rankTerm(value) {
    const match = String(value || "").match(/(\d+)/);
    return match ? Number(match[1]) : 99;
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function joinPath(base, child) {
    const trimmedBase = String(base || "").replace(/^\/+/, "").replace(/\/+$/, "");
    const trimmedChild = String(child || "").replace(/^\/+/, "");
    return (trimmedBase ? trimmedBase + "/" : "") + trimmedChild;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setStatus(message) {
    if (els.status) els.status.textContent = message;
  }
}());
