const $ = id => document.getElementById(id);
const views = ["catalogView", "introView", "gameView", "endingView"];
let world = null;
let worldEntries = [];
let selectedWorldEntry = null;
let activeLevel = null;
let sceneIndex = 0;
let state = {};
let choiceLocked = false;
let soundEnabled = true;
let musicPath = "";
let lang = "en";                 // default language: English
let uiText = null;               // platform UI strings for the active language

function detectLang() {
  const urlLang = new URLSearchParams(location.search).get("lang");
  if (urlLang === "zh" || urlLang === "en") { localStorage.setItem("glimmers-lang", urlLang); return urlLang; }
  const stored = localStorage.getItem("glimmers-lang");
  if (stored === "zh" || stored === "en") return stored;
  return "en";                    // English first for the Tripothon lane
}

function setLang(next) {
  lang = next;
  localStorage.setItem("glimmers-lang", next);
  const url = new URL(location.href);
  url.searchParams.set("lang", next);
  history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
  if (uiText) applyPlatformText();
  document.querySelectorAll(".lang-button").forEach(b => {
    b.textContent = next.toUpperCase();
    b.title = next === "en" ? "Switch to Chinese" : "切换到英文";
  });
}

/* Deep-merge a translation over the original object. Arrays keep the original
   length; every missing key falls back to the Chinese source string. */
function mergeText(base, over) {
  if (!over) return base;
  if (Array.isArray(base)) {
    if (!Array.isArray(over)) return base;
    return base.map((item, i) => mergeText(item, over[i]));
  }
  if (base && typeof base === "object") {
    const out = { ...base };
    for (const key of Object.keys(base)) {
      if (key in over && over[key] !== undefined && over[key] !== null) out[key] = mergeText(base[key], over[key]);
    }
    return out;
  }
  return (typeof over === "string" && over.trim()) ? over : base;
}

async function loadTextOverride(baseFolder, name) {
  if (lang !== "en") return null;
  /* baseFolder is the world (or platform) folder; overrides always live in <folder>i18n/ */
  const url = baseFolder.endsWith("i18n/") ? `${baseFolder}${name}` : `${baseFolder}i18n/${name}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) { return null; }
}

function showView(id) {
  views.forEach(viewId => { $(viewId).hidden = viewId !== id; });
  document.body.classList.toggle("is-playing", id === "gameView");
  window.scrollTo(0, 0);
}

function updateSoundButtons() {
  [$('catalogSound'), $('soundToggle')].forEach(button => {
    button.setAttribute("aria-label", t("soundLabel"));
    button.textContent = soundEnabled ? "♫" : "×";
    button.classList.toggle("is-muted", !soundEnabled);
  });
  // Ending videos are visual rewards only. Keep their own audio disabled so
  // the selected world's background track remains continuous underneath.
  $("endingVideo").muted = true;
  const music = $("worldMusic");
  music.muted = !soundEnabled;
  if (soundEnabled && musicPath && music.paused) music.play().catch(() => {});
  if (!soundEnabled) music.pause();
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  updateSoundButtons();
}

const STRINGS = {
  en: {
    quizHint: "Look at the picture and answer",
    quizQuestion: "What is this cat acting out?",
    quizDescription: "Watch the picture and guess what the cat is performing.",
    quizChapter: (n) => `Round ${n}`,
    quizCorrect: (text) => `Correct! The answer is: ${text}`,
    quizWrong: (text) => `Not this time - the answer is: ${text}`,
    quizVideoFail: "The cat is still rehearsing, try again",
    successTitle: (t) => `${t} · You got it`,
    successDesc: "You saw through most of the cat's performance. You know this little actor well.",
    failureTitle: (t) => `${t} · Guess again`,
    failureDesc: "The cat's performance still has a few mysteries left. Watch again next round.",
    chapterN: (n) => `Chapter ${n}`,
    sceneN: (n) => `Scene ${n}`,
    scoreLabel: "Correct",
    enterWorld: "Enter this world",
    comingSoon: "In development",
    exploring: "Explore this world",
    enterChapter: "Enter chapter →",
    openingAlt: "World opening",
    fallbackTitle: "Glimmers of Elsewhere",
    fallbackDesc: "A new world is waiting for you.",
    choiceFallback: "Choose this option",
    waterLabel: "Current state",
    stageLabel: "Current scene",
    endingEyebrow: "Your world echo",
    keepsakeLabel: "Ending keepsake",
    keepsakeHint: "Drag to rotate · scroll to zoom",
    keepsakeOpenHint: "Tap to open the 3D showroom",
    keepsakeDownload: "Download GLB",
    ksLoading: "Loading the 3D model…",
    soundLabel: "Toggle sound",
    sceneProgressHint: "Scene",
    noChange: "No change",
  },
  zh: {
    quizHint: "观察画面并作答",
    quizQuestion: "这只猫正在演什么？",
    quizDescription: "观察画面，猜猜猫咪正在演什么。",
    quizChapter: (n) => `第 ${n} 题`,
    quizCorrect: (text) => `答对了！正确答案是：${text}`,
    quizWrong: (text) => `这次猜错了，正确答案是：${text}`,
    quizVideoFail: "猫咪还在排练，再试一次吧",
    successTitle: (t) => `${t} · 猜中了`,
    successDesc: "你看穿了猫咪的大部分表演，已经很懂这位小演员了。",
    failureTitle: (t) => `${t} · 再猜一次`,
    failureDesc: "猫咪的表演还藏着一点谜题，下一轮继续观察。",
    chapterN: (n) => `第 ${n} 章`,
    sceneN: (n) => `第 ${n} 幕`,
    scoreLabel: "答对",
    enterWorld: "进入这个世界",
    comingSoon: "开发中",
    exploring: "探索这个异界",
    enterChapter: "进入篇章　→",
    openingAlt: "世界开场",
    fallbackTitle: "异境拾光",
    fallbackDesc: "一个新的世界正在等待你。",
    choiceFallback: "选择这个选项",
    waterLabel: "当前状态",
    stageLabel: "当前画面",
    endingEyebrow: "你的世界回响",
    keepsakeLabel: "获得结局信物",
    keepsakeHint: "拖动旋转 · 滚轮缩放",
    keepsakeOpenHint: "点击进入 3D 展厅",
    keepsakeDownload: "下载 GLB",
    ksLoading: "正在载入 3D 模型…",
    soundLabel: "切换声音",
    sceneProgressHint: "进度",
    noChange: "没有状态变化",
  },
};
const t = (key, ...args) => { const v = STRINGS[lang]?.[key] ?? STRINGS.zh[key]; return typeof v === "function" ? v(...args) : v; };

function escapeHtml(value = "") {
  return String(value).replace(/[&<>\"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character]));
}

function content() {
  return activeLevel || world || {};
}

function worldUi(key, fallback) {
  return world?.ui?.[key] || fallback;
}

async function loadLevelConfig(level) {
  const configPath = level.config.startsWith("worlds/") ? level.config : `${world.assetBase || `worlds/${world.id}/`}${level.config}`;
  const response = await fetch(configPath, { cache: "no-store" });
  if (!response.ok) throw new Error(`无法载入篇章配置：${configPath}`);
  const rawConfig = await response.json();
  const levelFolder = world.assetBase || `worlds/${world.id}/`;
  const levelOverride = await loadTextOverride(levelFolder, `en.${level.id}.json`);
  const config = mergeText(rawConfig, levelOverride);
  if (Array.isArray(config.scenes) && Array.isArray(config.endings)) {
    return { ...config, id: level.id || config.id, title: level.title || config.title || config.id };
  }
  const caseFiles = Array.isArray(config.caseFiles) ? config.caseFiles : [];
  const caseOverride = (await loadTextOverride(levelFolder, "en.cases.json")) || {};
  const cases = await Promise.all(caseFiles.map(async caseFile => {
    const casePath = caseFile.startsWith("worlds/") ? caseFile : `${world.assetBase || `worlds/${world.id}/`}${caseFile}`;
    const caseResponse = await fetch(casePath, { cache: "no-store" });
    if (!caseResponse.ok) throw new Error(`无法载入题目配置：${casePath}`);
    const raw = await caseResponse.json();
    return mergeText(raw, caseOverride[raw.id]);
  }));
  const scenes = cases.map((item, index) => {
    const options = Array.isArray(item.options) ? item.options : [];
    const correct = item.correctOptionId;
    const actions = options.map((option, optionIndex) => ({
      id: option.id,
      name: option.text,
      plain: option.text,
      hint: t("quizHint"),
      icon: lang === "en" ? String.fromCharCode(65 + optionIndex) : "菜",
      image: option.image || null,
    }));
    const outcomes = Object.fromEntries(options.map(option => [option.id, {
        image: option.image || null,
        stateChanges: { score: option.id === correct ? 1 : 0 },
        text: option.id === correct ? t("quizCorrect", option.text) : t("quizWrong", options.find(candidate => candidate.id === correct)?.text || option.text),
      }]));
    return {
      id: item.id,
      chapter: t("quizChapter", index + 1),
      image: item.mysteryImages?.medium || item.mysteryImage,
      title: item.title || t("quizQuestion"),
      description: t("quizDescription"),
      actions,
      outcomes,
    };
  });
  const finaleVideos = config.finaleVideos || {};
  return {
    ...config,
    id: level.id || config.id,
    title: level.title || config.title || config.id,
    scenes,
    initialState: { score: 0 },
    states: [{ id: "score", label: t("scoreLabel"), color: "#d69a38", chipBackground: "#fff0c7", max: scenes.length }],
    endings: [
      { id: "success", title: t("successTitle", level.title || config.title || t("chapterN", 1)), video: finaleVideos.success || config.finaleVideo, all: [{ state: "score", operator: ">", value: Math.floor(scenes.length / 2) }], description: t("successDesc") },
      { id: "failure", title: t("failureTitle", level.title || config.title || t("chapterN", 1)), video: finaleVideos.failure || config.finaleVideo, all: [], description: t("failureDesc") },
    ],
  };
}

async function loadLevels() {
  if (!Array.isArray(world?.levels) || !world.levels.length) return;
  world.levels = await Promise.all(world.levels.map(loadLevelConfig));
}

async function loadWorld(configPath) {
  if (!configPath) return;
  const response = await fetch(configPath, { cache: "no-store" });
  if (!response.ok) throw new Error(`无法载入异界配置：${configPath}`);
  const rawWorld = await response.json();
  const worldFolder = rawWorld.assetBase || `worlds/${rawWorld.id}/`;
  const worldOverride = await loadTextOverride(worldFolder, "en.json");
  world = mergeText(rawWorld, worldOverride);
  activeLevel = null;
  await loadLevels();
  selectedWorldEntry = worldEntries.find(entry => entry.config === configPath) || selectedWorldEntry;
  renderWorldIdentity();
}

async function loadPlatformText() {
  const over = await loadTextOverride("", "en.json");
  uiText = mergeText({
    platformTitle: "异境拾光",
    catalogNote: "世界会记住你的每一次选择。",
    soundToggle: "切换声音",
    backCatalog: "← 返回世界",
    levelSelectTitle: "选择篇章开始",
    continueButton: "继续看下去",
    finalContinueButton: "查看结果",
    replayButton: "再玩一次",
    introButton: "睁开猫眼",
    enterWorld: "进入这个世界",
    comingSoon: "开发中",
    exploring: "探索这个异界",
    enterChapter: "进入篇章　→",
    choiceFallback: "选择这个选项",
    soundLabel: "切换声音",
    catalog: { eyebrow: "", headline: "", description: "" },
  }, over || {});
}

async function loadCatalog() {
  await loadPlatformText();
  const response = await fetch("worlds/index.json?v=1", { cache: "no-store" });
  if (!response.ok) throw new Error("无法载入异界目录");
  const catalog = await response.json();
  const entries = Array.isArray(catalog.worlds) ? catalog.worlds : [];
  worldEntries = await Promise.all(entries.map(async entry => {
    if (entry.status === "coming-soon" || (!entry.config && !entry.launchUrl)) {
      return {
        ...entry,
        config: null,
        world: {
          ...entry,
          assetBase: entry.assetBase || `worlds/${entry.id}/`,
          status: entry.status || "coming-soon",
        },
      };
    }
    if (!entry.config && entry.launchUrl) {
      return {
        ...entry,
        config: null,
        world: {
          ...entry,
          assetBase: entry.assetBase || `worlds/${entry.id}/`,
          status: entry.status || "ready",
        },
      };
    }
    const configPath = entry.config.startsWith("worlds/") ? entry.config : `worlds/${entry.config}`;
    const configResponse = await fetch(configPath, { cache: "no-store" });
    if (!configResponse.ok) throw new Error(`异界配置不存在：${configPath}`);
    const rawWorld = await configResponse.json();
    const folder = rawWorld.assetBase || `worlds/${rawWorld.id}/`;
    const worldOver = await loadTextOverride(folder, "en.json");
    return { ...entry, config: configPath, world: mergeText(rawWorld, worldOver) };
  }));
  if (!worldEntries.length) throw new Error("异界目录为空");
  renderCatalog(catalog);
}

let lastCatalog = null;
function applyPlatformText() {
  const catalog = lastCatalog; if (!catalog) return;
  const platform = mergeText(catalog.catalog || {}, uiText?.catalog || {});
  $("platformTitle").textContent = uiText?.platformTitle || "异境拾光";
  $("catalogEyebrow").textContent = platform.eyebrow || "异境拾光 · 世界目录";
  $("catalogHeadline").textContent = platform.headline || "每一片异境，都有一场自己的游戏。";
  $("catalogDescription").textContent = platform.description || "选择一个世界，进入一段属于它的故事。";
  $("catalogNote").textContent = uiText.catalogNote;
}

function renderCatalog(catalog) {
  lastCatalog = catalog;
  applyPlatformText();
  $("worldCards").innerHTML = worldEntries.map((entry, index) => worldCardMarkup(entry, index)).join("");
  $("worldCards").querySelectorAll("[data-world-config]").forEach(button => {
    button.addEventListener("click", () => enterWorldFromCatalog(button.dataset.worldConfig));
  });
  $("worldCards").querySelectorAll("[data-world-launch]").forEach(button => {
    button.addEventListener("click", () => { window.location.href = button.dataset.worldLaunch; });
  });
}

function worldCardMarkup(entry, index) {
  const item = entry.world;
  const catalog = item.catalog || {};
  const useEn = lang === "en";
  const cardTitle = (useEn && (entry.titleEn || item.titleEn)) || item.title;
  const cardSubtitle = (useEn && (entry.subtitleEn || item.subtitleEn)) || item.subtitle || "一个等待探索的异界";
  const cardDesc = (useEn && (entry.descriptionEn || item.descriptionEn)) || catalog.cardDescription || item.cardDescription || "";
  const gradient = (catalog.cardGradient || ["#8172c3", "#44346e", "#28203f"]).join(", ");
  const accent = catalog.cardAccent || "#f7d582";
  const icon = catalog.cardIcon || "✦";
  const label = catalog.cardLabel || `WORLD ${String(index + 1).padStart(2, "0")}`;
  const actionSummary = (useEn && catalog.actionSummary) || (item.actions || []).map(action => action.plain || action.name).join(" · ");
  const coverRel = (item.cover && item.cover[useEn ? "en" : "zh"]) || item.cover?.default || item.coverImage || item.assets?.cover;
  const cover = coverRel ? `${item.assetBase || `worlds/${item.id}/`}${coverRel}` : "";
  const comingSoon = entry.status === "coming-soon" || item.status === "coming-soon";
  const launch = entry.launchUrl || item.launchUrl;
  const button = comingSoon
    ? `<button class="is-coming-soon" type="button" disabled>${t("comingSoon")} <b>·</b></button>`
    : launch
      ? `<button data-world-launch="${escapeHtml(launch)}" type="button">${t("enterWorld")} <b>→</b></button>`
    : `<button data-world-config="${escapeHtml(entry.config)}" type="button">${t("enterWorld")} <b>→</b></button>`;
  return `<article class="world-card">
    <div class="world-card-art${cover ? " has-cover" : ""}" style="--world-gradient:${gradient};--world-accent:${escapeHtml(accent)}" aria-hidden="true">
      ${cover ? `<img class="world-cover" src="${escapeHtml(cover)}" alt="" loading="lazy">` : ""}
      <span class="world-number">${escapeHtml(label)}</span>
      <div class="world-orbit"><i>${escapeHtml(icon)}</i></div>
      <span class="spark spark-a">✦</span><span class="spark spark-b">✧</span><span class="spark spark-c">✦</span>
    </div>
    <div class="world-card-copy"><p>${escapeHtml(cardSubtitle)}</p><h3>${escapeHtml(cardTitle)}</h3>${cardDesc ? `<div class="world-card-description">${escapeHtml(cardDesc)}</div>` : ""}<span>${escapeHtml(actionSummary || (comingSoon ? t("comingSoon") : t("exploring")))}</span>${button}</div>
  </article>`;
}

function renderWorldIdentity() {
  $("worldMiniTitle").textContent = world.shortTitle || world.title;
  $("replayButton").textContent = worldUi("replayButton", uiText.replayButton);
  $("beginJourney").textContent = worldUi("introButton", uiText.introButton);
  document.querySelectorAll("[data-back-catalog]").forEach(button => {
    button.textContent = worldUi("backToCatalog", uiText.backCatalog);
  });
  document.querySelectorAll("[data-back-catalog]").forEach(button => { button.title = uiText.backCatalog; });
}

async function enterWorldFromCatalog(configPath) {
  await loadWorld(configPath);
  enterWorld();
}

function resetGame() {
  sceneIndex = 0;
  state = { ...(content().initialState || {}) };
  renderMeters();
}

function renderLevelSelect() {
  const select = $("levelSelect");
  const levels = world?.levels || [];
  // A world with a single chapter skips the picker entirely and starts right away.
  if (levels.length === 1 && !activeLevel) { select.hidden = true; $("beginJourney").hidden = true; startLevel(levels[0].id); return; }
  select.hidden = !levels.length;
  $("beginJourney").hidden = Boolean(levels.length);
  if (!levels.length) return;
  $("openingFallback").hidden = true;
  $("levelSelectTitle").textContent = worldUi("levelSelectTitle", uiText.levelSelectTitle);
  const showNumbers = levels.length > 1;
  $("levelCards").innerHTML = levels.map((level, index) => `<button class="level-card" type="button" data-level-id="${escapeHtml(level.id)}">${showNumbers ? `<span>CHAPTER ${String(index + 1).padStart(2, "0")}</span>` : ""}<strong>${escapeHtml(level.title)}</strong><small>${level.scenes.length} ${lang === "en" ? "scenes" : "幕"} · ${lang === "en" ? "tap to start" : "选择后开始"}</small><b>${t("enterChapter")}</b></button>`).join("");
  $("levelCards").querySelectorAll("[data-level-id]").forEach(button => button.addEventListener("click", () => startLevel(button.dataset.levelId)));
}

function startLevel(levelId) {
  activeLevel = world.levels.find(level => level.id === levelId) || null;
  if (!activeLevel) return;
  resetGame();
  showView("gameView");
  renderScene();
}

function enterWorld() {
  activeLevel = null;
  resetGame();
  const opening = world.opening || { mode: "html", html: world.openingHtml };
  const video = $("openingVideo");
  const frame = $("openingFrame");
  const fallback = $("openingFallback");
  const openingImage = $("openingImage");
  fallback.hidden = true;
  openingImage.hidden = true;
  if (opening.mode === "video" && opening.video) {
    video.hidden = false;
    video.muted = true;
    frame.hidden = true;
    video.poster = opening.poster ? worldAsset(opening.poster) : "";
    video.src = worldAsset(opening.video);
    video.play().catch(() => {
      if (opening.html) {
        video.hidden = true;
        frame.hidden = false;
        frame.src = `${worldAsset(opening.html)}?lang=${lang}`;
      } else {
        video.hidden = true;
        frame.hidden = true;
        showOpeningFallback();
      }
    });
  } else if (opening.mode === "image" && opening.image) {
    video.pause();
    video.hidden = true;
    frame.hidden = true;
    fallback.hidden = true;
    openingImage.src = worldAsset(opening.image);
    openingImage.alt = world.title || t("openingAlt");
    openingImage.hidden = false;
  } else {
    video.pause();
    video.hidden = true;
    $("openingImage").hidden = true;
    if (opening.html || world.openingHtml) {
      frame.hidden = false;
      frame.src = `${worldAsset(opening.html || world.openingHtml)}?lang=${lang}`;
    } else {
      frame.hidden = true;
      showOpeningFallback();
    }
  }
  showView("introView");
  renderLevelSelect();
  setWorldMusic(world.music);
}

function showOpeningFallback() {
  const fallback = $("openingFallback");
  fallback.querySelector("h2").textContent = world.title || t("fallbackTitle");
  fallback.querySelector("p:last-child").textContent = world.description || t("fallbackDesc");
  fallback.hidden = false;
}

function setWorldMusic(relativePath) {
  const music = $("worldMusic");
  const nextPath = relativePath ? worldAsset(relativePath) : "";
  if (nextPath === musicPath && !music.paused) return;
  music.pause();
  music.currentTime = 0;
  musicPath = nextPath;
  music.src = nextPath;
  music.loop = true;
  music.volume = Number.isFinite(Number(world?.musicVolume)) ? Number(world.musicVolume) : 0.12;
  music.muted = !soundEnabled;
  if (soundEnabled && nextPath) music.play().catch(() => {});
}

function stopWorldMusic() {
  const music = $("worldMusic");
  music.pause();
  music.currentTime = 0;
  musicPath = "";
}

function startJourney() {
  if (world?.levels?.length) return;
  showView("gameView");
  renderScene();
}

function goCatalog() {
  const music = $("worldMusic");
  music.pause();
  music.currentTime = 0;
  musicPath = "";
  showView("catalogView");
  // resolve relative to the deployed folder so this also works under a
  // GitHub Pages project subpath (e.g. /GlimmersElsewhere/)
  const back = new URL(location.pathname.replace(/[^/]*$/, ""), location.origin);
  back.searchParams.set("lang", lang);
  history.replaceState({}, "", `${back.pathname}${back.search}`);
}

function labelStaticDom() {
  const set = (sel, text) => { const el = document.querySelector(sel); if (el && text) el.textContent = text; };
  set("#sceneMissing", lang === "en" ? "Scene image could not load" : "场景图片暂时没有加载出来");
  set(".ending-card .eyebrow", t("endingEyebrow"));
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = t(el.dataset.i18n); if (typeof v === "string") el.textContent = v; });
  set("#meters", "");
  const meters = document.getElementById("meters");
  if (meters) meters.setAttribute("aria-label", t("waterLabel"));
  const stage = document.getElementById("visualStage");
  if (stage) stage.setAttribute("aria-label", t("stageLabel"));
  const choices = document.getElementById("choicePanel");
  if (choices) choices.setAttribute("aria-label", lang === "en" ? "Choose an action" : "选择动作");
}

function renderMeters() {
  const definitions = content().states || Object.keys(state).map((id, index) => ({ id, label: id, color: index ? "#6d9e75" : "#d8654c", max: 14 }));
  $("meters").style.gridTemplateColumns = `repeat(${Math.min(3, definitions.length)}, minmax(0, 1fr))`;
  $("meters").innerHTML = definitions.map(definition => `
    <div class="meter" style="--meter-color:${definition.color || '#6b4bb9'}"><span><b>${definition.label}</b><em>${state[definition.id] || 0}</em></span><i><u style="width:${Math.min(100, (state[definition.id] || 0) / (definition.max || 10) * 100)}%"></u></i></div>`).join("");
}

function renderScene() {
  const current = content();
  const scene = current.scenes[sceneIndex];
  const actions = scene.actions || current.actions || [];
  choiceLocked = false;
  $("sceneProgress").textContent = `${String(sceneIndex + 1).padStart(2, "0")} / ${String(current.scenes.length).padStart(2, "0")}`;
  $("sceneChapter").textContent = scene.chapter;
  $("sceneTitle").textContent = scene.title;
  $("sceneDescription").textContent = scene.description;
  $("outcomePanel").hidden = true;
  $("choicePanel").hidden = false;
  $("choicePanel").innerHTML = actions.map(action => `
    <button class="choice-button" type="button" data-action="${action.id}">
      ${action.image ? `<span class="choice-thumb"><img src="${escapeHtml(worldAsset(action.image))}" alt=""></span>` : `<span class="choice-icon">${escapeHtml(lang === "en" ? (action.icon && /^[A-Za-z0-9]$/.test(action.icon) ? action.icon : String.fromCharCode(65 + (scene.actions || current.actions || []).indexOf(action))) : (action.icon || "✦"))}</span>`}
      <span><strong>${escapeHtml(action.name)}</strong><small>${escapeHtml(action.hint || action.plain || t("choiceFallback"))}</small></span>
      <b>›</b>
    </button>`).join("");
  $("choicePanel").querySelectorAll("button").forEach(button => {
    button.addEventListener("click", event => {
      if (choiceLocked) return;
      choiceLocked = true;
      const rect = button.getBoundingClientRect();
      button.style.setProperty("--tap-x", `${Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))}%`);
      button.style.setProperty("--tap-y", `${Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))}%`);
      button.classList.add("is-choosing");
      window.setTimeout(() => resolveChoice(button.dataset.action), 150);
    });
  });
  renderSceneImage(scene);
  preloadOutcomeImages(scene);
}

function worldAsset(relativePath) {
  return `${world.assetBase || `worlds/${world.id}/`}${relativePath}`;
}

function renderSceneImage(scene) {
  const image = $("sceneImage");
  const missing = $("sceneMissing");
  image.hidden = false;
  missing.hidden = true;
  image.alt = scene.description;
  image.onload = () => { missing.hidden = true; };
  image.onerror = () => {
    image.hidden = true;
    missing.hidden = false;
  };
  image.src = worldAsset(scene.image);
}

function preloadOutcomeImages(scene) {
  Object.values(scene.outcomes || {}).forEach(outcome => {
    if (!outcome.image) return;
    const preload = new Image();
    preload.src = worldAsset(outcome.image);
  });
}

function renderOutcomeImage(scene, outcome) {
  if (!outcome.image) return;
  const image = $("sceneImage");
  const missing = $("sceneMissing");
  image.hidden = false;
  missing.hidden = true;
  image.alt = `${scene.description} ${outcome.text}`;
  image.onload = () => { missing.hidden = true; };
  image.onerror = () => {
    image.hidden = true;
    missing.hidden = false;
  };
  image.src = worldAsset(outcome.image);
}

function resolveChoice(actionId) {
  const current = content();
  const scene = current.scenes[sceneIndex];
  const outcome = scene.outcomes[actionId];
  for (const definition of current.states || []) {
    state[definition.id] = (state[definition.id] || 0) + (outcome.stateChanges?.[definition.id] ?? outcome[definition.id] ?? 0);
  }
  renderMeters();
  renderOutcomeImage(scene, outcome);
  $("resultFlash").hidden = false;
  $("resultFlash").classList.remove("result-flash");
  void $("resultFlash").offsetWidth;
  $("resultFlash").classList.add("result-flash");
  setTimeout(() => { $("resultFlash").hidden = true; }, 600);
  $("choicePanel").hidden = true;
  $("outcomePanel").hidden = false;
  $("outcomeText").textContent = outcome.text;
  const chips = [];
  for (const definition of current.states || []) {
    const delta = outcome.stateChanges?.[definition.id] ?? outcome[definition.id] ?? 0;
    if (delta) chips.push(`<span style="color:${definition.color};background:${definition.chipBackground || '#eee'}">${definition.label} ${delta > 0 ? '+' : ''}${delta}</span>`);
  }
  if (!chips.length) chips.push(`<span>${escapeHtml(t("noChange"))}</span>`);
  $("deltaChips").innerHTML = chips.join("");
  $("continueButton").innerHTML = sceneIndex === current.scenes.length - 1 ? `${escapeHtml(worldUi("finalContinueButton", uiText.finalContinueButton))} <b>→</b>` : `${escapeHtml(worldUi("continueButton", uiText.continueButton))} <b>→</b>`;
}

function continueJourney() {
  if (sceneIndex >= content().scenes.length - 1) {
    showEnding();
  } else {
    sceneIndex += 1;
    renderScene();
  }
}

function compareCondition(condition) {
  if (!condition) return true;
  const left = state[condition.state] || 0;
  const right = condition.otherState ? (state[condition.otherState] || 0) + (condition.offset || 0) : condition.value;
  if (condition.operator === ">") return left > right;
  if (condition.operator === ">=") return left >= right;
  if (condition.operator === "<=") return left <= right;
  if (condition.operator === "=") return left === right;
  return left < right;
}

function endingMatches(ending) {
  return (ending.all || []).every(compareCondition);
}

function showEnding() {
  const ending = content().endings.find(endingMatches) || content().endings.at(-1);
  $("endingTitle").textContent = ending.title;
  $("endingDescription").textContent = ending.description;
  $("finalStats").innerHTML = (content().states || []).map(definition => `<span>${definition.label} <b>${state[definition.id] || 0}</b></span>`).join("");
  const video = $("endingVideo");
  const image = $("endingImage");
  const endingVideo = ending.video || world.endingVideo;
  if (endingVideo) {
    video.src = worldAsset(endingVideo);
    video.currentTime = 0;
    video.muted = true;
    video.hidden = false;
    image.hidden = true;
    $("endingArt").hidden = true;
    video.play().catch(() => {
      video.hidden = true;
      image.hidden = !ending.image;
      $("endingArt").hidden = Boolean(ending.image);
    });
    video.onerror = () => { video.hidden = true; image.hidden = !ending.image; $("endingArt").hidden = Boolean(ending.image); };
  } else if (ending.image) {
    video.hidden = true;
    image.src = worldAsset(ending.image);
    image.alt = ending.title;
    image.hidden = false;
    $("endingArt").hidden = true;
  } else {
    video.hidden = true;
    image.hidden = true;
    $("endingArt").hidden = false;
  }
  const keepsake = content().keepsakes?.find(item => item.endingId === ending.id) || content().keepsakes?.[0] || world.keepsakes?.find(item => item.endingId === ending.id) || world.keepsakes?.[0];
  $("keepsakeBox").hidden = !keepsake;
  showView("endingView");
  if (keepsake) {
    const glbUrl = worldAsset(keepsake.glb);
    $("keepsakeTitle").textContent = keepsake.title;
    $("keepsakeDownload").href = glbUrl;
    $("ksDownload").href = glbUrl;
    $("ksTitle").textContent = keepsake.title;
    const thumb = $("keepsakeThumb");
    if (keepsake.preview) { thumb.src = worldAsset(keepsake.preview); thumb.hidden = false; }
    else { thumb.removeAttribute("src"); thumb.hidden = true; }
    closeKeepsake();
  }
}

function openKeepsake() {
  const box = $("keepsakeBox");
  if (!box || box.hidden) return;
  const modal = $("keepsakeModal");
  modal.hidden = false;
  document.body.classList.add("ks-open");
  const glb = $("ksDownload").getAttribute("href");
  window.dispatchEvent(new CustomEvent("keepsake:show", { detail: { url: glb } }));
}
function closeKeepsake() {
  const modal = $("keepsakeModal");
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.body.classList.remove("ks-open");
  window.dispatchEvent(new CustomEvent("keepsake:hide"));
}

function replay() {
  resetGame();
  activeLevel = null;
  showView("introView");
  renderLevelSelect();
}

async function init() {
  try {
    setLang(detectLang());
    labelStaticDom();
    await loadCatalog();
    $("beginJourney").addEventListener("click", startJourney);
    $("continueButton").addEventListener("click", continueJourney);
    $("replayButton").addEventListener("click", replay);
    $("keepsakeOpen").addEventListener("click", openKeepsake);
    document.querySelectorAll("[data-ks-close]").forEach(el => el.addEventListener("click", closeKeepsake));
    document.addEventListener("keydown", event => { if (event.key === "Escape") closeKeepsake(); });
    $("catalogSound").addEventListener("click", toggleSound);
    $("soundToggle").addEventListener("click", toggleSound);
    document.querySelectorAll(".lang-button").forEach(button => button.addEventListener("click", async () => {
      setLang(lang === "en" ? "zh" : "en");
      const configPath = selectedWorldEntry?.config;
      // refresh platform copy AND world-card data for the new language, otherwise the
      // catalogue keeps showing the previous language after toggling inside a world
      await loadPlatformText();
      await loadCatalog();
      if (configPath) { await loadWorld(configPath); enterWorld(); } else { showView("catalogView"); }
    }));
    document.querySelectorAll("[data-back-catalog]").forEach(button => button.addEventListener("click", goCatalog));
    updateSoundButtons();
  } catch (error) {
    document.body.innerHTML = `<main style="max-width:480px;margin:80px auto;padding:24px;font-family:system-ui"><h1>异境暂时没有打开</h1><p>${error.message}</p></main>`;
  }
}

init();
