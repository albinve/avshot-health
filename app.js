(function () {
  "use strict";

  const I = (id) => document.getElementById(id);

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

  let currentProfile = {
    name: "Benutzer",
    age: 26,
    gender: "male",
    height: 180,
    weight: 78
  };

  let uploadedBase64Photo = null;
  let timerInterval = null;
  let timerSecondsLeft = 45 * 60;
  let isTimerRunning = false;

  function applyGate() {
    const locked = !hasApiKey();
    document.body.classList.toggle("locked", locked);
    I("apiGate").classList.toggle("hidden", !locked);
    if (locked) {
      I("gateKeyInput").value = "";
      I("gateKeyInput").focus();
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

  function loadProfile() {
    const saved = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p && typeof p === "object") currentProfile = Object.assign(currentProfile, p);
      } catch (e) { /* ignore corrupt profile */ }
    }
    const g = currentProfile.gender;
    if (g !== "male" && g !== "female" && g !== "diverse") currentProfile.gender = "male";
    I("headerProfileLabel").textContent = "Profil: " + (currentProfile.name || "Benutzer");
    I("profName").value = currentProfile.name || "";
    I("profAge").value = currentProfile.age || 26;
    I("profGender").value = currentProfile.gender || "male";
    I("profHeight").value = currentProfile.height || 180;
    I("profWeight").value = currentProfile.weight || 78;
    updateNutritionMetrics();
  }

  function saveProfile() {
    const gender = I("profGender").value;
    currentProfile.name = (I("profName").value || "Benutzer").trim().slice(0, 60);
    currentProfile.age = Math.min(120, Math.max(12, parseInt(I("profAge").value, 10) || 26));
    currentProfile.gender = gender === "female" || gender === "diverse" ? gender : "male";
    currentProfile.height = Math.min(230, Math.max(120, parseFloat(I("profHeight").value) || 180));
    currentProfile.weight = Math.min(250, Math.max(35, parseFloat(I("profWeight").value) || 75));
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(currentProfile));
    I("headerProfileLabel").textContent = "Profil: " + currentProfile.name;
    updateNutritionMetrics();
    I("profileModal").classList.add("hidden");
    toast("Profil gespeichert.");
  }

  function switchTab(tabId) {
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

  function handlePhotoUpload(file) {
    if (!file || !file.type || file.type.indexOf("image/") !== 0) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxDim = 1024;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        uploadedBase64Photo = canvas.toDataURL("image/jpeg", 0.85);
        I("photoPreview").src = uploadedBase64Photo;
        I("photoPreviewContainer").classList.remove("hidden");
        I("uploadPlaceholder").classList.add("hidden");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    uploadedBase64Photo = null;
    I("posturePhotoInput").value = "";
    I("photoPreview").removeAttribute("src");
    I("photoPreviewContainer").classList.add("hidden");
    I("uploadPlaceholder").classList.remove("hidden");
  }

  function genderLabel(g) {
    if (g === "female") return "weiblich";
    if (g === "diverse") return "divers";
    return "männlich";
  }

  function mifflinBmr(w, h, a, gender) {
    const base = 10 * w + 6.25 * h - 5 * a;
    if (gender === "female") return base - 161;
    if (gender === "diverse") return base - 78;
    return base + 5;
  }

  function updateNutritionMetrics() {
    const h = currentProfile.height || 180;
    const w = currentProfile.weight || 75;
    const a = currentProfile.age || 26;
    const bmi = w / ((h / 100) * (h / 100));
    const minIdeal = (18.5 * ((h / 100) * (h / 100))).toFixed(1);
    const maxIdeal = (24.9 * ((h / 100) * (h / 100))).toFixed(1);
    const bmr = mifflinBmr(w, h, a, currentProfile.gender);
    const tdee = Math.round(bmr * 1.375);
    I("nutrHeightWeight").textContent = h + " cm / " + w + " kg";
    I("nutrBmi").textContent = bmi.toFixed(1) + " kg/m²";
    I("nutrIdealWeight").textContent = minIdeal + " – " + maxIdeal + " kg";
    I("nutrTdee").textContent = "~" + tdee + " kcal";
  }

  async function geminiGenerate(parts, loadingEl, loadingMsg) {
    const apiKey = getApiKey();
    if (!apiKey) {
      applyGate();
      return null;
    }
    loadingEl.innerHTML = '<span class="pulse" style="color:var(--brand)">' + escapeHtml(loadingMsg) + "</span>";
    try {
      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({ contents: [{ parts: parts }] })
      });
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

    const promptText =
      "Du bist ein Coach für Haltung und Alltagsergonomie, kein Arzt. Keine Diagnose, keine Krankheitsnamen als Feststellung. Formuliere als mögliche Hinweise und Übungsvorschläge.\n" +
      "Nutzerdaten: Alter " + currentProfile.age + ", Größe " + currentProfile.height + " cm, Gewicht " + currentProfile.weight + " kg, Geschlecht " + genderLabel(currentProfile.gender) + ".\n" +
      "Angegebene Muster: " + (symptoms.length ? symptoms.join(", ") : "keine Checkbox gewählt") + ".\n" +
      (uploadedBase64Photo
        ? "Ein Seitenfoto liegt bei. Beschreibe nur, was plausibel sichtbar sein könnte (Kopfposition, Schultern, Lendenbereich). Unsicherheiten benennen.\n"
        : "") +
      "Antworte auf Deutsch, knapp und klar:\n" +
      "1. Mögliche Muskelverspannungen vs. abgeschwächte Gruppen (als Hypothese).\n" +
      "2. Drei Alltags-Schritte: dehnen / kräftigen / Pause am Schreibtisch.\n" +
      "3. Zwei ergonomische Hinweise.\n" +
      "Schließe mit: Das ersetzt keine Untersuchung. Bei Schmerz, Taubheit oder Schwindel ärztlich / physiotherapeutisch abklären.";

    const parts = [{ text: promptText }];
    if (uploadedBase64Photo) {
      const base64Data = uploadedBase64Photo.split(",")[1];
      if (base64Data) {
        parts.push({ inline_data: { mime_type: "image/jpeg", data: base64Data } });
      }
    }
    await geminiGenerate(parts, textBox, "Analysiere Haltung — Einschätzung, keine Diagnose …");
  }

  async function generateAiMealPlan() {
    const goal = I("nutritionGoal").value;
    const allergies = (I("allergyInput").value || "Keine").trim().slice(0, 200);
    const dislikes = (I("dislikesInput").value || "Keine").trim().slice(0, 200);
    const resultBox = I("mealPlanResult");
    const textBox = I("mealPlanAiText");
    resultBox.classList.remove("hidden");

    const h = currentProfile.height || 180;
    const w = currentProfile.weight || 75;
    const a = currentProfile.age || 26;
    const tdee = Math.round(mifflinBmr(w, h, a, currentProfile.gender) * 1.375);
    const goalNote =
      goal === "deficit"
        ? "ca. 400 kcal unter TDEE, Boden nicht unter 1900 kcal"
        : goal === "surplus"
          ? "ca. 300 kcal über TDEE"
          : "ungefähr TDEE halten";

    const promptText =
      "Du bist ein Ernährungscoach. Keine medizinischen Heilversprechen. Schätzwerte, kein Labor.\n" +
      "Alter " + a + ", Größe " + h + " cm, Gewicht " + w + " kg, Geschlecht " + genderLabel(currentProfile.gender) + ".\n" +
      "TDEE-Schätzung (Mifflin-St Jeor × 1,375): ca. " + tdee + " kcal. Ziel: " + goalNote + ".\n" +
      "Allergien/Unverträglichkeiten: " + allergies + ".\n" +
      "Abneigungen: " + dislikes + ".\n" +
      "Deutsch, konkret:\n" +
      "1. Kalorien und Makros in Gramm (Protein, Kohlenhydrate, Fett) als grobe Zielspanne.\n" +
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

    I("openProfileBtn").addEventListener("click", () => I("profileModal").classList.remove("hidden"));
    I("closeProfileModal").addEventListener("click", () => I("profileModal").classList.add("hidden"));
    I("saveProfileBtn").addEventListener("click", saveProfile);

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
    });

    I("pickPhotoBtn").addEventListener("click", () => I("posturePhotoInput").click());
    I("posturePhotoInput").addEventListener("change", (e) => handlePhotoUpload(e.target.files[0]));
    I("clearPhotoBtn").addEventListener("click", clearPhoto);
    I("runPostureBtn").addEventListener("click", runAiPostureAnalysis);
    I("runMealBtn").addEventListener("click", generateAiMealPlan);
    I("startTimerBtn").addEventListener("click", toggleDeskTimer);
    I("resetTimerBtn").addEventListener("click", resetDeskTimer);
    I("notifyBtn").addEventListener("click", requestNotificationPermission);
  }

  document.addEventListener("DOMContentLoaded", () => {
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
