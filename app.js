const TRACKS = [
  { title: "サンパチ", file: "./audio/song1.mp3" },
  { title: "アーユーレディ・ディージェイ・サトリ", file: "./audio/song2.mp3" },
  { title: "シン・サトヤン", file: "./audio/song4.mp3" },
  { title: "さとうた", file: "./audio/song5.mp3" },
  { title: "シン・サトヤン ナイトドライブバージョン", file: "./audio/song6.mp3" }
];

const STORAGE_KEY = "dj-satori-ep-spotify-ui-config";
const VISIT_KEY = "dj-satori-ep-spotify-ui-visits";

const cover = document.getElementById("cover");
const tracklist = document.getElementById("tracklist");
const nowPlaying = document.getElementById("nowPlaying");
const visitCounter = document.getElementById("visitCounter");
const countdown = document.getElementById("countdown");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");
const seekBar = document.getElementById("seekBar");
const finalMessage = document.getElementById("finalMessage");

const config = loadConfig();
let currentIndex = 0;
let isSeeking = false;

const visits = Number(localStorage.getItem(VISIT_KEY) || "0") + 1;
visitCounter.textContent = String(visits);
localStorage.setItem(VISIT_KEY, String(visits));

const ws = WaveSurfer.create({
  container: "#waveform",
  waveColor: "rgba(255,255,255,.24)",
  progressColor: "#1ed760",
  cursorColor: "rgba(255,255,255,.95)",
  height: 90,
  barWidth: 3,
  barGap: 2,
  barRadius: 3,
  normalize: true,
  dragToSeek: true,
  responsive: true,
  url: TRACKS[0].file
});

renderTracklist();
loadTrack(0, false);
setupButtons();
setupWave();
startCountdown();

function loadConfig() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) { }
  }

  const cfg = {
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  return cfg;
}

function formatTime(sec) {
  if (!Number.isFinite(sec)) return "00:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatCountdown(ms) {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const msPart = Math.floor(total % 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(msPart).padStart(3, "0")}`;
}

function renderTracklist() {
  tracklist.innerHTML = "";

  TRACKS.forEach((track, idx) => {
    const btn = document.createElement("button");
    btn.className = "track";
    btn.type = "button";
    btn.innerHTML = `
      <span class="track-index">${idx + 1}</span>
      <span class="track-title">${track.title}</span>
      <span class="track-duration">--:--</span>
    `;
    btn.addEventListener("click", () => loadTrack(idx, true));
    tracklist.appendChild(btn);
  });
}

function setActiveTrack(idx) {
  [...tracklist.children].forEach((el, i) => {
    el.classList.toggle("active", i === idx);
  });
  nowPlaying.textContent = `${idx + 1}. ${TRACKS[idx].title}`;
}

function loadTrack(idx, autoplay) {
  currentIndex = idx;
  setActiveTrack(idx);
  ws.load(TRACKS[idx].file);

  if (autoplay) {
    ws.once("ready", () => ws.play());
  }
}

function setupButtons() {
  document.getElementById("playBtn").addEventListener("click", () => {
    ws.playPause();
  });

  document.getElementById("pauseBtn").addEventListener("click", () => {
    ws.pause();
  });

  document.getElementById("prevBtn").addEventListener("click", () => {
    const next = currentIndex === 0 ? TRACKS.length - 1 : currentIndex - 1;
    loadTrack(next, true);
  });

  document.getElementById("nextBtn").addEventListener("click", () => {
    const next = (currentIndex + 1) % TRACKS.length;
    loadTrack(next, true);
  });

  seekBar.addEventListener("input", () => {
    isSeeking = true;
    const duration = ws.getDuration();
    const target = (Number(seekBar.value) / 1000) * duration;
    currentTimeEl.textContent = formatTime(target);
  });

  seekBar.addEventListener("change", () => {
    const duration = ws.getDuration();
    const target = (Number(seekBar.value) / 1000) * duration;
    ws.setTime(target);
    isSeeking = false;
  });
}

function setupWave() {
  ws.on("ready", () => {
    const d = ws.getDuration();
    durationEl.textContent = formatTime(d);
    currentTimeEl.textContent = "00:00";

    const active = tracklist.children[currentIndex];
    if (active) {
      const durationCell = active.querySelector(".track-duration");
      if (durationCell) {
        durationCell.textContent = formatTime(d);
      }
    }
  });

  ws.on("play", () => {
    cover.classList.add("spinning");
    finalMessage.hidden = true;
  });

  ws.on("pause", () => {
    cover.classList.remove("spinning");
  });

  ws.on("timeupdate", (t) => {
    if (!isSeeking) {
      const d = ws.getDuration() || 0;
      currentTimeEl.textContent = formatTime(t);
      seekBar.value = d ? Math.min(1000, Math.round((t / d) * 1000)) : 0;
    }
  });

  ws.on("finish", () => {
    cover.classList.remove("spinning");

    if (currentIndex < TRACKS.length - 1) {
      loadTrack(currentIndex + 1, true);
    } else {
      finalMessage.hidden = false;
    }
  });
}

function startCountdown() {
  const tick = () => {
    const diff = config.expiresAt - Date.now();

    if (diff <= 0) {
      document.body.innerHTML = `
        <main class="expired">
          <section class="expired-card">
            <h1>DJ SATORI EP</h1>
            <p>この公開は終了しました。</p>
          </section>
        </main>
      `;
      return;
    }

    countdown.textContent = formatCountdown(diff);
    requestAnimationFrame(tick);
  };

  tick();
}