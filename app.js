(function () {
  "use strict";

  const I = (id) => document.getElementById(id);

  const RANGE = {
    age: [14, 90],
    height: [120, 230],
    weight: [35, 250],
    bodyFatPct: [3, 60],
    skeletalMuscleKg: [10, 80],
    skeletalMusclePct: [15, 60],
    muscleMassKg: [10, 90],
    bodyWaterPct: [30, 80],
    boneMassKg: [1, 6],
    visceralFat: [1, 30],
    scaleBmr: [800, 4000]
  };

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatAiText(raw) {
    let s = escapeHtml(raw);
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/^[\t ]*[\*\-][\t ]+/gm, "• ");
    s = s.replace(/\n/g, "<br>");
    return s;
  }

  function fmtDe(n, digits) {
    return Number(n).toFixed(digits).replace(".", ",");
  }

  function hasApiKey() {
    try {
      const k = localStorage.getItem(STORAGE_KEY_API);
      return !!(k && k.trim().length >= 20);
    } catch (e) {
      return false;
    }
  }

  function getApiKey() {
    try {
      return (localStorage.getItem(STORAGE_KEY_API) || "").trim();
    } catch (e) {
      return "";
    }
  }

  function toast(msg) {
    const el = I("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2400);
  }

  function emptyProfile() {
    return {
      name: "",
      age: null,
      gender: "",
      height: null,
      weight: null,
      onboarded: false,
      bodyFatPct: null,
      skeletalMuscle: null,
      skeletalMuscleUnit: "kg",
      muscleMassKg: null,
      bodyWaterPct: null,
      boneMassKg: null,
      visceralFat: null,
      scaleBmr: null
    };
  }

  let currentProfile = emptyProfile();

  let postureJpegBlob = null;
  let posturePreviewUrl = null;
  let timerInterval = null;
  let timerSecondsLeft = 45 * 60;
  let isTimerRunning = false;

  function looksLikeDemoProfile(p) {
    if (!p) return false;
    const name = String(p.name || "").trim().toLowerCase();
    const h = Number(p.height);
    const w = Number(p.weight);
    if (name !== "benutzer") return false;
    if (h !== 180) return false;
    return w === 75 || w === 78;
  }

  function requiredFieldsOk(p) {
    if (!p) return false;
    const name = String(p.name || "").trim();
    if (name.length < 1 || name.length > 60) return false;
    if (p.age == null || p.age < RANGE.age[0] || p.age > RANGE.age[1]) return false;
    if (p.gender !== "male" && p.gender !== "female" && p.gender !== "diverse") return false;
    if (p.height == null || p.height < RANGE.height[0] || p.height > RANGE.height[1]) return false;
    if (p.weight == null || p.weight < RANGE.weight[0] || p.weight > RANGE.weight[1]) return false;
    return true;
  }

  function isOnboarded() {
    if (!currentProfile || currentProfile.onboarded !== true) return false;
    return requiredFieldsOk(currentProfile);
  }

  let onbHydrated = false;

  function applyGate() {
    const needKey = !hasApiKey();
    const needProfile = !needKey && !isOnboarded();
    const locked = needKey || needProfile;
    document.body.classList.toggle("locked", locked);
    I("apiGate").classList.toggle("hidden", !needKey);
    I("profileGate").classList.toggle("hidden", !needProfile);
    if (needKey) {
      I("gateKeyInput").value = "";
      I("gateKeyInput").focus();
    } else if (needProfile) {
      if (!onbHydrated) {
        prepareOnboardingForm();
        onbHydrated = true;
      }
      refreshFormState("onb");
      if (!I("profileGate").contains(document.activeElement)) {
        I("onbName").focus();
      }
    }
    updateKeyBadge();
  }

  function updateKeyBadge() {
    const ok = hasApiKey();
    const badge = I("apiKeyBadge");
    badge.classList.toggle("ok", ok);
    badge.classList.toggle("bad", !ok);
    I("apiKeyStatusText").textContent = ok ? "API-Key aktiv" : "API-Key fehlt";
  }

  function saveKeyFromInput(inputId) {
    const val = I(inputId).value.trim();
    if (val.length < 20) {
      toast("Bitte einen gültigen Gemini-Key eintragen.");
      return false;
    }
    localStorage.setItem(STORAGE_KEY_API, val);
    I(inputId).value = "";
    applyGate();
    toast("Key nur auf diesem Gerät gespeichert.");
    return true;
  }

  function deleteApiKey() {
    localStorage.removeItem(STORAGE_KEY_API);
    I("apiKeyInputField").value = "";
    I("gateKeyInput").value = "";
    I("apiKeyModal").classList.add("hidden");
    applyGate();
    toast("Key gelöscht. App gesperrt.");
  }

  function parseLooseNumber(raw, asInt) {
    const s = String(raw == null ? "" : raw).trim().replace(",", ".");
    if (s === "") return null;
    const n = asInt ? parseInt(s, 10) : parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }

  function parseRequired(raw, min, max, asInt) {
    const n = parseLooseNumber(raw, asInt);
    if (n == null || n < min || n > max) return null;
    return n;
  }

  function parseOptional(raw, min, max, asInt) {
    const s = String(raw == null ? "" : raw).trim();
    if (s === "") return { ok: true, value: null };
    const n = parseLooseNumber(s, asInt);
    if (n == null || n < min || n > max) return { ok: false, value: null };
    return { ok: true, value: n };
  }

  function getSegValue(containerId, attr) {
    const on = I(containerId).querySelector(".on[" + attr + "]");
    return on ? on.getAttribute(attr) : "";
  }

  function setSegValue(containerId, attr, value) {
    I(containerId).querySelectorAll("[" + attr + "]").forEach((btn) => {
      const on = btn.getAttribute(attr) === String(value);
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function setInputNum(id, val) {
    I(id).value = val == null || val === "" ? "" : String(val);
  }

  function fillForm(prefix, p) {
    const src = p || emptyProfile();
    I(prefix + "Name").value = src.name || "";
    setInputNum(prefix + "Age", src.age);
    setInputNum(prefix + "Height", src.height);
    setInputNum(prefix + "Weight", src.weight);
    setSegValue(prefix + "GenderGroup", "data-gender", src.gender || "");
    setInputNum(prefix + "BodyFat", src.bodyFatPct);
    setInputNum(prefix + "SkelMuscle", src.skeletalMuscle);
    setSegValue(prefix + "SkelUnit", "data-unit", src.skeletalMuscleUnit === "%" ? "%" : "kg");
    setInputNum(prefix + "MuscleMass", src.muscleMassKg);
    setInputNum(prefix + "BodyWater", src.bodyWaterPct);
    setInputNum(prefix + "BoneMass", src.boneMassKg);
    setInputNum(prefix + "Visceral", src.visceralFat);
    setInputNum(prefix + "ScaleBmr", src.scaleBmr);
    refreshFormState(prefix);
  }

  function prepareOnboardingForm() {
    const demo = looksLikeDemoProfile(currentProfile);
    const blank = !currentProfile || (!currentProfile.name && currentProfile.age == null && !currentProfile.gender && currentProfile.height == null && currentProfile.weight == null);
    if (demo || blank) {
      fillForm("onb", emptyProfile());
      return;
    }
    fillForm("onb", currentProfile);
  }

  function readForm(prefix) {
    const name = (I(prefix + "Name").value || "").trim().slice(0, 60);
    const age = parseRequired(I(prefix + "Age").value, RANGE.age[0], RANGE.age[1], true);
    const gender = getSegValue(prefix + "GenderGroup", "data-gender");
    const height = parseRequired(I(prefix + "Height").value, RANGE.height[0], RANGE.height[1], false);
    const weight = parseRequired(I(prefix + "Weight").value, RANGE.weight[0], RANGE.weight[1], false);
    const unit = getSegValue(prefix + "SkelUnit", "data-unit") === "%" ? "%" : "kg";
    const skelRange = unit === "%" ? RANGE.skeletalMusclePct : RANGE.skeletalMuscleKg;

    const bodyFat = parseOptional(I(prefix + "BodyFat").value, RANGE.bodyFatPct[0], RANGE.bodyFatPct[1], false);
    const skel = parseOptional(I(prefix + "SkelMuscle").value, skelRange[0], skelRange[1], false);
    const muscle = parseOptional(I(prefix + "MuscleMass").value, RANGE.muscleMassKg[0], RANGE.muscleMassKg[1], false);
    const water = parseOptional(I(prefix + "BodyWater").value, RANGE.bodyWaterPct[0], RANGE.bodyWaterPct[1], false);
    const bone = parseOptional(I(prefix + "BoneMass").value, RANGE.boneMassKg[0], RANGE.boneMassKg[1], false);
    const visceral = parseOptional(I(prefix + "Visceral").value, RANGE.visceralFat[0], RANGE.visceralFat[1], true);
    const scaleBmr = parseOptional(I(prefix + "ScaleBmr").value, RANGE.scaleBmr[0], RANGE.scaleBmr[1], true);

    const missing = [];
    if (!name) missing.push("Name");
    if (age == null) missing.push("Alter (14–90)");
    if (gender !== "male" && gender !== "female" && gender !== "diverse") missing.push("Geschlecht");
    if (height == null) missing.push("Größe (120–230 cm)");
    if (weight == null) missing.push("Gewicht nüchtern (35–250 kg)");

    const optionalBad = [];
    if (!bodyFat.ok) optionalBad.push("Körperfett %");
    if (!skel.ok) optionalBad.push("Skelettmuskulatur");
    if (!muscle.ok) optionalBad.push("Muskelmasse");
    if (!water.ok) optionalBad.push("Körperwasser %");
    if (!bone.ok) optionalBad.push("Knochenmasse");
    if (!visceral.ok) optionalBad.push("Viszeralfett");
    if (!scaleBmr.ok) optionalBad.push("Grundumsatz der Waage");

    const ok = missing.length === 0 && optionalBad.length === 0;
    const profile = {
      name: name,
      age: age,
      gender: gender,
      height: height,
      weight: weight,
      onboarded: true,
      bodyFatPct: bodyFat.value,
      skeletalMuscle: skel.value,
      skeletalMuscleUnit: unit,
      muscleMassKg: muscle.value,
      bodyWaterPct: water.value,
      boneMassKg: bone.value,
      visceralFat: visceral.value,
      scaleBmr: scaleBmr.value
    };

    let error = "";
    if (missing.length) {
      error = "Bitte vollständig eintragen: " + missing.join(", ") + ".";
    } else if (optionalBad.length) {
      error = "Optionale Waagenwerte prüfen (oder leer lassen): " + optionalBad.join(", ") + ".";
    }

    return { ok: ok, error: error, profile: profile };
  }

  function calcBmi(height, weight) {
    if (height == null || weight == null) return null;
    if (height < RANGE.height[0] || height > RANGE.height[1]) return null;
    if (weight < RANGE.weight[0] || weight > RANGE.weight[1]) return null;
    return weight / ((height / 100) * (height / 100));
  }

  function updateLiveBmi(prefix) {
    const height = parseRequired(I(prefix + "Height").value, RANGE.height[0], RANGE.height[1], false);
    const weight = parseRequired(I(prefix + "Weight").value, RANGE.weight[0], RANGE.weight[1], false);
    const bmi = calcBmi(height, weight);
    const el = I(prefix + "BmiLive");
    const html =
      bmi == null
        ? "BMI (berechnet): —<span>Aus Größe und Gewicht — kein Laborwert, keine DEXA</span>"
        : "BMI (berechnet): " +
          fmtDe(bmi, 1) +
          "<span>Aus Größe und Gewicht — kein Laborwert, keine DEXA</span>";
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  function refreshFormState(prefix, showError) {
    updateLiveBmi(prefix);
    const parsed = readForm(prefix);
    if (prefix === "onb") {
      const btn = I("onbStartBtn");
      const nextDisabled = !parsed.ok;
      if (btn.disabled !== nextDisabled) btn.disabled = nextDisabled;
      if (showError || parsed.ok) I("onbError").textContent = parsed.ok ? "" : parsed.error;
    } else if (showError || parsed.ok) {
      I("profError").textContent = parsed.ok ? "" : parsed.error;
    }
    return parsed;
  }

  function persistProfile(p) {
    currentProfile = p;
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(currentProfile));
    syncHeader();
    updateNutritionMetrics();
    fillForm("prof", currentProfile);
  }

  function syncHeader() {
    if (isOnboarded()) {
      I("headerProfileLabel").textContent = "Profil: " + currentProfile.name;
    } else {
      I("headerProfileLabel").textContent = "Profil einrichten";
    }
  }

  function normalizeLoadedProfile(raw) {
    const p = emptyProfile();
    if (!raw || typeof raw !== "object") return p;
    if (typeof raw.name === "string") p.name = raw.name.trim().slice(0, 60);
    if (raw.age != null) p.age = parseRequired(raw.age, RANGE.age[0], RANGE.age[1], true);
    if (raw.gender === "male" || raw.gender === "female" || raw.gender === "diverse") p.gender = raw.gender;
    if (raw.height != null) p.height = parseRequired(raw.height, RANGE.height[0], RANGE.height[1], false);
    if (raw.weight != null) p.weight = parseRequired(raw.weight, RANGE.weight[0], RANGE.weight[1], false);
    p.onboarded = raw.onboarded === true;
    const bf = parseOptional(raw.bodyFatPct, RANGE.bodyFatPct[0], RANGE.bodyFatPct[1], false);
    p.bodyFatPct = bf.ok ? bf.value : null;
    p.skeletalMuscleUnit = raw.skeletalMuscleUnit === "%" ? "%" : "kg";
    const skelRange = p.skeletalMuscleUnit === "%" ? RANGE.skeletalMusclePct : RANGE.skeletalMuscleKg;
    const skel = parseOptional(raw.skeletalMuscle, skelRange[0], skelRange[1], false);
    p.skeletalMuscle = skel.ok ? skel.value : null;
    const muscle = parseOptional(raw.muscleMassKg, RANGE.muscleMassKg[0], RANGE.muscleMassKg[1], false);
    p.muscleMassKg = muscle.ok ? muscle.value : null;
    const water = parseOptional(raw.bodyWaterPct, RANGE.bodyWaterPct[0], RANGE.bodyWaterPct[1], false);
    p.bodyWaterPct = water.ok ? water.value : null;
    const bone = parseOptional(raw.boneMassKg, RANGE.boneMassKg[0], RANGE.boneMassKg[1], false);
    p.boneMassKg = bone.ok ? bone.value : null;
    const vis = parseOptional(raw.visceralFat, RANGE.visceralFat[0], RANGE.visceralFat[1], true);
    p.visceralFat = vis.ok ? vis.value : null;
    const bmr = parseOptional(raw.scaleBmr, RANGE.scaleBmr[0], RANGE.scaleBmr[1], true);
    p.scaleBmr = bmr.ok ? bmr.value : null;
    return p;
  }

  function loadProfile() {
    currentProfile = emptyProfile();
    const saved = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        currentProfile = normalizeLoadedProfile(parsed);
      } catch (e) {
        currentProfile = emptyProfile();
      }
    }
    if (looksLikeDemoProfile(currentProfile) && currentProfile.onboarded !== true) {
      currentProfile = emptyProfile();
    }
    fillForm("prof", currentProfile);
    onbHydrated = false;
    syncHeader();
    updateNutritionMetrics();
  }

  function submitOnboarding() {
    const parsed = refreshFormState("onb", true);
    if (!parsed.ok) {
      toast(parsed.error || "Bitte die Pflichtfelder vollständig eintragen.");
      return;
    }
    persistProfile(parsed.profile);
    applyGate();
    toast("Profil gespeichert.");
  }

  function saveProfileFromModal() {
    const parsed = refreshFormState("prof", true);
    if (!parsed.ok) {
      toast(parsed.error || "Bitte die Pflichtfelder vollständig eintragen.");
      return;
    }
    persistProfile(parsed.profile);
    I("profileModal").classList.add("hidden");
    toast("Profil gespeichert.");
  }

  function switchTab(tabId) {
    const postureTab = I("tab-posture");
    const leavingPosture =
      postureTab && !postureTab.classList.contains("hidden") && tabId !== "posture";
    if (leavingPosture) clearPhoto();
    document.querySelectorAll(".tab-content").forEach((el) => el.classList.add("hidden"));
    document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.remove("on"));
    const section = I("tab-" + tabId);
    if (section) section.classList.remove("hidden");
    const nav = document.querySelector('.nav-btn[data-tab="' + tabId + '"]');
    if (nav) nav.classList.add("on");
  }

  function renderExercises() {
    const container = I("exercisesContainer");
    container.replaceChildren();
    EXERCISES.forEach((ex) => {
      const card = document.createElement("article");
      card.className = "excard";
      const fig = document.createElement("div");
      fig.className = "exfig";
      fig.innerHTML = ex.svg;
      const dur = document.createElement("div");
      dur.className = "dur";
      dur.textContent = ex.duration;
      const h4 = document.createElement("h4");
      h4.textContent = ex.title;
      const focus = document.createElement("p");
      focus.className = "hint";
      focus.textContent = "Fokus: " + ex.target;
      const inst = document.createElement("p");
      inst.className = "hint";
      inst.style.marginTop = "8px";
      inst.style.background = "rgba(0,0,0,.25)";
      inst.style.padding = "10px";
      inst.style.borderRadius = "10px";
      inst.textContent = ex.instructions;
      const btn = document.createElement("button");
      btn.className = "btn ghost";
      btn.style.marginTop = "10px";
      btn.type = "button";
      btn.textContent = "Sprachanleitung anhören";
      btn.addEventListener("click", () => speakExercise(ex.title, ex.instructions));
      card.append(fig, dur, h4, focus, inst, btn);
      container.appendChild(card);
    });
  }

  function speakExercise(title, text) {
    if (!("speechSynthesis" in window)) {
      toast("Sprachausgabe wird nicht unterstützt.");
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(title + ". Ausführung: " + text);
    utter.lang = "de-DE";
    window.speechSynthesis.speak(utter);
  }

  function revokePreviewUrl() {
    if (posturePreviewUrl) {
      URL.revokeObjectURL(posturePreviewUrl);
      posturePreviewUrl = null;
    }
  }

  function wipeCanvas(canvas, ctx) {
    if (!canvas) return;
    try {
      if (ctx && canvas.width && canvas.height) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        imageData.data.fill(0);
        ctx.putImageData(imageData, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    } catch (e) { /* ignore */ }
    canvas.width = 0;
    canvas.height = 0;
  }

  function clearPhoto() {
    postureJpegBlob = null;
    revokePreviewUrl();
    const img = I("photoPreview");
    if (img) {
      img.removeAttribute("src");
      img.src = "";
    }
    const input = I("posturePhotoInput");
    if (input) input.value = "";
    const box = I("photoPreviewContainer");
    const placeholder = I("uploadPlaceholder");
    if (box) box.classList.add("hidden");
    if (placeholder) placeholder.classList.remove("hidden");
  }

  function showPhotoPreview(blob) {
    revokePreviewUrl();
    postureJpegBlob = blob;
    posturePreviewUrl = URL.createObjectURL(blob);
    const img = I("photoPreview");
    img.src = posturePreviewUrl;
    I("photoPreviewContainer").classList.remove("hidden");
    I("uploadPlaceholder").classList.add("hidden");
  }

  function fitMaxDim(width, height, maxDim) {
    if (width > height && width > maxDim) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else if (height > maxDim) {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
    return { width: width, height: height };
  }

  function canvasToJpegBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error("jpeg"));
      }, "image/jpeg", 0.85);
    });
  }

  async function jpegBlobToBase64(blob) {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    bytes.fill(0);
    return btoa(binary);
  }

  function drawFileOnCanvas(file, canvas, ctx) {
    return new Promise(function (resolve, reject) {
      const tmpUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        try {
          const size = fitMaxDim(img.width, img.height, 1024);
          canvas.width = size.width;
          canvas.height = size.height;
          ctx.drawImage(img, 0, 0, size.width, size.height);
          img.onload = null;
          img.onerror = null;
          img.removeAttribute("src");
          resolve();
        } catch (err) {
          reject(err);
        } finally {
          URL.revokeObjectURL(tmpUrl);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(tmpUrl);
        reject(new Error("img"));
      };
      img.src = tmpUrl;
    });
  }

  async function handlePhotoUpload(file) {
    if (!file || !file.type || file.type.indexOf("image/") !== 0) return;
    const input = I("posturePhotoInput");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    let bitmap = null;
    try {
      if (typeof createImageBitmap === "function") {
        bitmap = await createImageBitmap(file);
        if (input) input.value = "";
        const size = fitMaxDim(bitmap.width, bitmap.height, 1024);
        canvas.width = size.width;
        canvas.height = size.height;
        ctx.drawImage(bitmap, 0, 0, size.width, size.height);
        if (bitmap.close) bitmap.close();
        bitmap = null;
      } else {
        await drawFileOnCanvas(file, canvas, ctx);
        if (input) input.value = "";
      }
      const blob = await canvasToJpegBlob(canvas);
      wipeCanvas(canvas, ctx);
      showPhotoPreview(blob);
    } catch (e) {
      wipeCanvas(canvas, ctx);
      if (bitmap && bitmap.close) bitmap.close();
      if (input) input.value = "";
      toast("Foto konnte nicht gelesen werden.");
    }
  }

  function genderLabel(g) {
    if (g === "female") return "Frau";
    if (g === "diverse") return "Divers";
    return "Mann";
  }

  function mifflinBmr(w, h, a, gender) {
    const base = 10 * w + 6.25 * h - 5 * a;
    if (gender === "female") return base - 161;
    if (gender === "diverse") return base - 78;
    return base + 5;
  }

  function leanMassKg() {
    const w = currentProfile.weight;
    const bf = currentProfile.bodyFatPct;
    if (w == null || bf == null) return null;
    return w * (1 - bf / 100);
  }

  function getEnergyEstimates() {
    const w = currentProfile.weight;
    const h = currentProfile.height;
    const a = currentProfile.age;
    const mifflin = mifflinBmr(w, h, a, currentProfile.gender);
    const lbm = leanMassKg();
    let bmr = mifflin;
    let bmrSource = "Mifflin-St Jeor";
    let methodHint =
      "Mifflin-St Jeor × 1,375 (überwiegend sitzend). Schätzung aus deinem Profil, kein Laborwert.";
    if (lbm != null) {
      bmr = 370 + 21.6 * lbm;
      bmrSource = "Katch-McArdle (Magermasse aus Körperfett % der Waage)";
      methodHint =
        "Katch-McArdle aus Magermasse (Körperfett % der Waage) × 1,375. BIA-Schätzung, keine DEXA-Genauigkeit.";
    }
    if (currentProfile.scaleBmr != null) {
      bmr = currentProfile.scaleBmr;
      bmrSource = "Grundumsatz laut Waage";
      methodHint =
        "TDEE aus dem Grundumsatz der Waage × 1,375. BIA-Schätzung, keine DEXA-Genauigkeit.";
    }
    const tdee = Math.round(bmr * 1.375);
    let proteinMin;
    let proteinMax;
    let proteinNote;
    if (lbm != null) {
      proteinMin = Math.round(lbm * 1.6);
      proteinMax = Math.round(lbm * 2.2);
      proteinNote = "g/kg Magermasse (aus Körperfett %)";
    } else {
      proteinMin = Math.round(w * 1.6);
      proteinMax = Math.round(w * 2.2);
      proteinNote = "g/kg Körpergewicht";
    }
    return {
      bmr: bmr,
      bmrSource: bmrSource,
      tdee: tdee,
      proteinMin: proteinMin,
      proteinMax: proteinMax,
      proteinNote: proteinNote,
      lbm: lbm,
      mifflin: mifflin,
      methodHint: methodHint
    };
  }

  function scaleLinesForPrompt() {
    const p = currentProfile;
    const extras = [];
    if (p.bodyFatPct != null) extras.push("Körperfett ca. " + fmtDe(p.bodyFatPct, 1) + " %");
    const lbm = leanMassKg();
    if (lbm != null) extras.push("Magermasse grob " + fmtDe(lbm, 1) + " kg (Gewicht × (1 − Körperfett %))");
    if (p.skeletalMuscle != null) {
      extras.push(
        "Skelettmuskulatur " +
          fmtDe(p.skeletalMuscle, 1) +
          (p.skeletalMuscleUnit === "%" ? " %" : " kg")
      );
    }
    if (p.muscleMassKg != null) extras.push("Muskelmasse " + fmtDe(p.muscleMassKg, 1) + " kg");
    if (p.bodyWaterPct != null) extras.push("Körperwasser " + fmtDe(p.bodyWaterPct, 1) + " %");
    if (p.boneMassKg != null) extras.push("Knochenmasse " + fmtDe(p.boneMassKg, 1) + " kg");
    if (p.visceralFat != null) extras.push("Viszeralfett-Stufe " + p.visceralFat);
    if (p.scaleBmr != null) extras.push("Grundumsatz laut Waage " + p.scaleBmr + " kcal");
    if (!extras.length) return "";
    return (
      "Angaben der Waage (optional, Bioimpedanz-Schätzung, ausdrücklich keine DEXA-Genauigkeit): " +
      extras.join("; ") +
      ".\n"
    );
  }

  function buildProfileContext() {
    const p = currentProfile;
    const bmi = calcBmi(p.height, p.weight);
    const e = getEnergyEstimates();
    let s =
      "Nutzer: " +
      p.name +
      ". Alter " +
      p.age +
      ", Geschlecht " +
      genderLabel(p.gender) +
      ", Größe " +
      p.height +
      " cm, Gewicht (nüchtern) " +
      p.weight +
      " kg.\n";
    if (bmi != null) {
      s += "BMI nur aus Größe und Gewicht berechnet: " + fmtDe(bmi, 1) + " (kein Labor, keine DEXA).\n";
    }
    s += scaleLinesForPrompt();
    s +=
      "Lokale Energie-Schätzung (" +
      e.bmrSource +
      "): BMR ca. " +
      Math.round(e.bmr) +
      " kcal, TDEE (× 1,375, überwiegend sitzend) ca. " +
      e.tdee +
      " kcal. Protein-Richtwert ca. " +
      e.proteinMin +
      "–" +
      e.proteinMax +
      " g (" +
      e.proteinNote +
      "). Keine klinische Körpermessung behaupten.\n";
    return s;
  }

  function updateNutritionMetrics() {
    if (!isOnboarded()) {
      I("nutrHeightWeight").textContent = "–";
      I("nutrBmi").textContent = "–";
      I("nutrIdealWeight").textContent = "–";
      I("nutrTdee").textContent = "–";
      I("nutrLeanMass").textContent = "–";
      I("nutrProtein").textContent = "–";
      I("nutrMethodHint").textContent =
        "Schätzung aus deinem Profil. Kein Laborwert, keine DEXA-Genauigkeit.";
      return;
    }
    const h = currentProfile.height;
    const w = currentProfile.weight;
    const bmi = calcBmi(h, w);
    const minIdeal = (18.5 * ((h / 100) * (h / 100))).toFixed(1).replace(".", ",");
    const maxIdeal = (24.9 * ((h / 100) * (h / 100))).toFixed(1).replace(".", ",");
    const e = getEnergyEstimates();
    I("nutrHeightWeight").textContent = fmtDe(h, h % 1 ? 1 : 0) + " cm / " + fmtDe(w, 1) + " kg";
    I("nutrBmi").textContent = bmi != null ? fmtDe(bmi, 1) + " kg/m²" : "–";
    I("nutrIdealWeight").textContent = minIdeal + " – " + maxIdeal + " kg";
    I("nutrTdee").textContent = "~" + e.tdee + " kcal";
    I("nutrLeanMass").textContent =
      e.lbm != null ? fmtDe(e.lbm, 1) + " kg" : "– (kein Körperfett %)";
    I("nutrProtein").textContent = e.proteinMin + "–" + e.proteinMax + " g";
    I("nutrMethodHint").textContent = e.methodHint;
  }

  async function geminiGenerate(parts, loadingEl, loadingMsg) {
    const apiKey = getApiKey();
    if (!apiKey) {
      applyGate();
      return null;
    }
    loadingEl.innerHTML = '<span class="pulse" style="color:var(--brand)">' + escapeHtml(loadingMsg) + "</span>";
    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent",
        {
          method: "POST",
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ contents: [{ parts: parts }] })
        }
      );
      const data = await response.json();
      const text =
        data &&
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0] &&
        data.candidates[0].content.parts[0].text;
      if (text) {
        loadingEl.innerHTML = formatAiText(text);
        return text;
      }
      const errMsg = (data && data.error && data.error.message) || "Keine Antwort erhalten.";
      loadingEl.innerHTML = '<span style="color:var(--red)">' + escapeHtml(errMsg) + "</span>";
      return null;
    } catch (err) {
      loadingEl.innerHTML =
        '<span style="color:var(--red)">Netzwerkfehler. Prüfe die Verbindung.</span>';
      return null;
    }
  }

  async function runAiPostureAnalysis() {
    const symptoms = Array.from(document.querySelectorAll(".posture-symptom:checked")).map((c) => c.value);
    const resultBox = I("postureAiResult");
    const textBox = I("postureAiText");
    resultBox.classList.remove("hidden");

    const hasPhoto = !!postureJpegBlob;
    const promptText =
      "Du bist ein Coach für Haltung und Alltagsergonomie, kein Arzt. Keine Diagnose, keine Krankheitsnamen als Feststellung. Formuliere als mögliche Hinweise und Übungsvorschläge.\n" +
      buildProfileContext() +
      "Angegebene Muster: " + (symptoms.length ? symptoms.join(", ") : "keine Checkbox gewählt") + ".\n" +
      (hasPhoto
        ? "Ein Seitenfoto liegt bei. Beschreibe nur, was plausibel sichtbar sein könnte (Kopfposition, Schultern, Lendenbereich). Unsicherheiten benennen.\n"
        : "") +
      "Antworte auf Deutsch, knapp und klar:\n" +
      "1. Mögliche Muskelverspannungen vs. abgeschwächte Gruppen (als Hypothese).\n" +
      "2. Drei Alltags-Schritte: dehnen / kräftigen / Pause am Schreibtisch.\n" +
      "3. Zwei ergonomische Hinweise.\n" +
      "Schließe mit: Das ersetzt keine Untersuchung. Bei Schmerz, Taubheit oder Schwindel ärztlich / physiotherapeutisch abklären.";

    const parts = [{ text: promptText }];
    let base64Data = "";
    try {
      if (hasPhoto) {
        base64Data = await jpegBlobToBase64(postureJpegBlob);
        if (base64Data) {
          parts.push({ inline_data: { mime_type: "image/jpeg", data: base64Data } });
        }
      }
      await geminiGenerate(parts, textBox, "Analysiere Haltung — Einschätzung, keine Diagnose …");
    } finally {
      base64Data = "";
      parts.length = 0;
      if (hasPhoto) clearPhoto();
    }
  }

  async function generateAiMealPlan() {
    const goal = I("nutritionGoal").value;
    const allergies = (I("allergyInput").value || "Keine").trim().slice(0, 200);
    const dislikes = (I("dislikesInput").value || "Keine").trim().slice(0, 200);
    const resultBox = I("mealPlanResult");
    const textBox = I("mealPlanAiText");
    resultBox.classList.remove("hidden");

    const e = getEnergyEstimates();
    const goalNote =
      goal === "deficit"
        ? "ca. 400 kcal unter TDEE, Boden nicht unter 1900 kcal"
        : goal === "surplus"
          ? "ca. 300 kcal über TDEE"
          : "ungefähr TDEE halten";

    const promptText =
      "Du bist ein Ernährungscoach. Keine medizinischen Heilversprechen. Schätzwerte, kein Labor, keine DEXA-Genauigkeit.\n" +
      buildProfileContext() +
      "Ziel: " + goalNote + ".\n" +
      "Allergien/Unverträglichkeiten: " + allergies + ".\n" +
      "Abneigungen: " + dislikes + ".\n" +
      "Deutsch, konkret:\n" +
      "1. Kalorien und Makros in Gramm (Protein ca. " +
      e.proteinMin +
      "–" +
      e.proteinMax +
      " g, Kohlenhydrate, Fett) als grobe Zielspanne. Protein an " +
      e.proteinNote +
      " anlehnen.\n" +
      "2. Ein Tagesplan: Frühstück, Mittag, Abend, ein Snack. Allergene und Abneigungen weglassen.\n" +
      "Kein Alkohol. Kein Schweinefleisch. Schließe mit: Schätzung, kein Ersatz für ärztliche Beratung.";

    await geminiGenerate(
      [{ text: promptText }],
      textBox,
      "Berechne Makros und Mahlzeitenplan …"
    );
  }

  function renderTimerDisplay() {
    const mins = Math.floor(timerSecondsLeft / 60).toString().padStart(2, "0");
    const secs = (timerSecondsLeft % 60).toString().padStart(2, "0");
    I("timerDisplay").textContent = mins + ":" + secs;
  }

  function toggleDeskTimer() {
    const btn = I("startTimerBtn");
    if (isTimerRunning) {
      clearInterval(timerInterval);
      isTimerRunning = false;
      btn.textContent = "Start";
      return;
    }
    isTimerRunning = true;
    btn.textContent = "Pause";
    timerInterval = setInterval(() => {
      if (timerSecondsLeft > 0) {
        timerSecondsLeft--;
        renderTimerDisplay();
        return;
      }
      clearInterval(timerInterval);
      isTimerRunning = false;
      btn.textContent = "Start";
      playNotificationSound();
      triggerPushNotification(
        "Zeit für eine Dehnpause",
        "Kurz aufstehen, Brust öffnen, Nacken lockern."
      );
      timerSecondsLeft = 45 * 60;
      renderTimerDisplay();
    }, 1000);
  }

  function resetDeskTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    timerSecondsLeft = 45 * 60;
    I("startTimerBtn").textContent = "Start";
    renderTimerDisplay();
  }

  function requestNotificationPermission() {
    if (!("Notification" in window)) {
      toast("Dieser Browser unterstützt keine Benachrichtigungen.");
      return;
    }
    Notification.requestPermission().then((permission) => {
      toast(permission === "granted" ? "Benachrichtigungen aktiv." : "Keine Erlaubnis.");
    });
  }

  function triggerPushNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body: body, icon: "icon-192.png" });
      } catch (e) { /* iOS may require service worker */ }
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((reg) => {
          if (reg.showNotification) reg.showNotification(title, { body: body, icon: "icon-192.png", badge: "icon-192.png" });
        }).catch(() => {});
      }
    }
  }

  function playNotificationSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.8);
    } catch (e) { /* ignore */ }
  }

  function loadImpulses() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_IMPULSES) || "null"); } catch (e) { saved = null; }
    const boxes = document.querySelectorAll(".day-impulse");
    boxes.forEach((box, i) => {
      box.checked = saved && typeof saved[i] === "boolean" ? saved[i] : true;
      box.addEventListener("change", () => {
        const next = Array.from(document.querySelectorAll(".day-impulse")).map((b) => b.checked);
        localStorage.setItem(STORAGE_IMPULSES, JSON.stringify(next));
      });
    });
  }

  function bindSegGroup(containerId, attr, prefix) {
    I(containerId).addEventListener("click", (e) => {
      const btn = e.target.closest("[" + attr + "]");
      if (!btn || !I(containerId).contains(btn)) return;
      setSegValue(containerId, attr, btn.getAttribute(attr));
      refreshFormState(prefix);
    });
  }

  function bindFormLive(prefix) {
    const form = I(prefix + "Form");
    form.addEventListener("input", () => refreshFormState(prefix));
    form.addEventListener("change", () => refreshFormState(prefix));
    bindSegGroup(prefix + "GenderGroup", "data-gender", prefix);
    bindSegGroup(prefix + "SkelUnit", "data-unit", prefix);
  }

  function bind() {
    I("gateSaveBtn").addEventListener("click", () => saveKeyFromInput("gateKeyInput"));
    I("gateKeyInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveKeyFromInput("gateKeyInput");
    });

    I("apiKeyBadge").addEventListener("click", () => {
      I("apiKeyInputField").value = "";
      I("apiKeyModal").classList.remove("hidden");
      I("apiKeyInputField").focus();
    });
    I("closeApiKeyModal").addEventListener("click", () => {
      if (!hasApiKey()) return;
      I("apiKeyModal").classList.add("hidden");
      I("apiKeyInputField").value = "";
    });
    I("saveApiKeyBtn").addEventListener("click", () => {
      if (saveKeyFromInput("apiKeyInputField")) I("apiKeyModal").classList.add("hidden");
    });
    I("deleteApiKeyBtn").addEventListener("click", deleteApiKey);

    bindFormLive("onb");
    bindFormLive("prof");
    I("onbForm").addEventListener("submit", (e) => {
      e.preventDefault();
      submitOnboarding();
    });
    I("profForm").addEventListener("submit", (e) => {
      e.preventDefault();
      saveProfileFromModal();
    });

    I("openProfileBtn").addEventListener("click", () => {
      fillForm("prof", currentProfile);
      I("profileModal").classList.remove("hidden");
      I("profName").focus();
    });
    I("closeProfileModal").addEventListener("click", () => I("profileModal").classList.add("hidden"));

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
    });

    I("pickPhotoBtn").addEventListener("click", () => I("posturePhotoInput").click());
    I("posturePhotoInput").addEventListener("change", (e) => handlePhotoUpload(e.target.files[0]));
    I("clearPhotoBtn").addEventListener("click", clearPhoto);
    I("runPostureBtn").addEventListener("click", runAiPostureAnalysis);
    window.addEventListener("pagehide", clearPhoto);
    I("runMealBtn").addEventListener("click", generateAiMealPlan);
    I("startTimerBtn").addEventListener("click", toggleDeskTimer);
    I("resetTimerBtn").addEventListener("click", resetDeskTimer);
    I("notifyBtn").addEventListener("click", requestNotificationPermission);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (I("gateModelLabel")) I("gateModelLabel").textContent = MODEL;
    if (I("settingsModelLabel")) I("settingsModelLabel").textContent = MODEL;
    bind();
    loadProfile();
    renderExercises();
    renderTimerDisplay();
    loadImpulses();
    applyGate();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  });
})();
