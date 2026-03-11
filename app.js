const TRACKS = [
  { title: "サンパチ", file: "./audio/song1.mp3" },
  { title: "アーユーレディ・ディージェイ・サトリ", file: "./audio/song2.mp3" },
  { title: "シン・サトヤン", file: "./audio/song4.mp3" },
  { title: "さとうた", file: "./audio/song5.mp3" },
  { title: "シン・サトヤン ナイトドライブバージョン", file: "./audio/song6.mp3" }
];

// JST 2026-03-21 23:59 = UTC 2026-03-21 14:59:00
const EXPIRE_TIME = new Date("2026-03-21T14:59:00Z").getTime();
const VISIT_KEY = "dj-satori-visits";

const tracklist = document.getElementById("tracklist");
const nowPlaying = document.getElementById("nowPlaying");
const visitCounter = document.getElementById("visitCounter");
const countdown = document.getElementById("countdown");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");
const seekBar = document.getElementById("seekBar");

let index = 0;
let isSeeking = false;
let currentAudio = null;
let isReady = false;

// 先読み用 audio を全曲分用意
const AUDIO_POOL = TRACKS.map((track) => {
  const audio = new Audio(track.file);
  audio.preload = "auto";
  return audio;
});

const visits = Number(localStorage.getItem(VISIT_KEY) || "0") + 1;
visitCounter.textContent = String(visits);
localStorage.setItem(VISIT_KEY, String(visits));

const ws = WaveSurfer.create({
  container: "#waveform",
  waveColor: "rgba(255,255,255,.24)",
  progressColor: "#1ed760",
  cursorColor: "rgba(255,255,255,.95)",
  height: 90,
  barWidth: 2,
  barGap: 2,
  barRadius: 2,
  normalize: true,
  dragToSeek: true,
  responsive: true
});

renderTracks();
setupButtons();
setupWave();
startCountdown();
initStars();
startShootingStars();
bindEndedHandlers();
loadTrack(0, false);

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
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function renderTracks() {
  tracklist.innerHTML = "";

  TRACKS.forEach((track, i) => {
    const btn = document.createElement("button");
    btn.className = "track";
    btn.type = "button";
    btn.innerHTML = `
      <span class="track-index">${i + 1}</span>
      <span class="track-title">${track.title}</span>
      <span class="track-duration">--:--</span>
    `;
    btn.addEventListener("click", () => {
      loadTrack(i, true);
    });
    tracklist.appendChild(btn);
  });
}

function setActiveTrack() {
  [...tracklist.children].forEach((el, i) => {
    el.classList.toggle("active", i === index);
  });
  nowPlaying.textContent = `${index + 1}. ${TRACKS[index].title}`;
}

function stopOtherAudios(exceptIndex) {
  AUDIO_POOL.forEach((audio, i) => {
    if (i !== exceptIndex) {
      audio.pause();
    }
  });
}

function updateTrackDurationDisplay() {
  const active = tracklist.children[index];
  if (!active || !currentAudio) return;
  const durationCell = active.querySelector(".track-duration");
  if (durationCell) {
    durationCell.textContent = formatTime(currentAudio.duration || 0);
  }
}

function loadTrack(i, autoplay = false) {
  index = i;
  setActiveTrack();

  currentAudio = AUDIO_POOL[index];
  stopOtherAudios(index);
  isReady = false;

  ws.load(currentAudio);

  if (autoplay) {
    ws.once("ready", () => {
      isReady = true;
      currentAudio.play().catch(() => {});
    });
  }
}

function setupButtons() {
  document.getElementById("playBtn").addEventListener("click", () => {
    if (!currentAudio) return;

    if (!isReady) {
      ws.once("ready", () => {
        isReady = true;
        currentAudio.play().catch(() => {});
      });
      return;
    }

    if (currentAudio.paused) {
      currentAudio.play().catch(() => {});
    } else {
      currentAudio.pause();
    }
  });

  document.getElementById("pauseBtn").addEventListener("click", () => {
    if (currentAudio) currentAudio.pause();
  });

  document.getElementById("nextBtn").addEventListener("click", () => {
    const next = (index + 1) % TRACKS.length;
    loadTrack(next, true);
  });

  document.getElementById("prevBtn").addEventListener("click", () => {
    const prev = (index - 1 + TRACKS.length) % TRACKS.length;
    loadTrack(prev, true);
  });

  seekBar.addEventListener("input", () => {
    isSeeking = true;
    const duration = currentAudio?.duration || 0;
    const target = (Number(seekBar.value) / 1000) * duration;
    currentTimeEl.textContent = formatTime(target);
  });

  seekBar.addEventListener("change", () => {
    if (!currentAudio) return;
    const duration = currentAudio.duration || 0;
    const target = (Number(seekBar.value) / 1000) * duration;
    currentAudio.currentTime = target;
    isSeeking = false;
  });
}

function setupWave() {
  ws.on("ready", () => {
    isReady = true;
    const d = currentAudio?.duration || ws.getDuration() || 0;
    durationEl.textContent = formatTime(d);
    currentTimeEl.textContent = formatTime(currentAudio?.currentTime || 0);
    seekBar.value = d
      ? Math.min(1000, Math.round(((currentAudio?.currentTime || 0) / d) * 1000))
      : 0;
    updateTrackDurationDisplay();
  });

  ws.on("timeupdate", (t) => {
    if (!isSeeking) {
      const d = currentAudio?.duration || ws.getDuration() || 0;
      currentTimeEl.textContent = formatTime(t);
      seekBar.value = d ? Math.min(1000, Math.round((t / d) * 1000)) : 0;
    }
  });
}

function bindEndedHandlers() {
  AUDIO_POOL.forEach((audio, i) => {
    audio.onended = () => {
      if (i !== index) return;

      if (index < TRACKS.length - 1) {
        loadTrack(index + 1, true);
      } else {
        loadTrack(0, false);
      }
    };

    audio.addEventListener("loadedmetadata", () => {
      if (AUDIO_POOL[index] === audio) {
        durationEl.textContent = formatTime(audio.duration || 0);
        updateTrackDurationDisplay();
      }
    });
  });
}

function startCountdown() {
  const tick = () => {
    const diff = EXPIRE_TIME - Date.now();

    if (diff <= 0) {
      document.body.innerHTML = `
        <main class="expired">
          <section class="expired-card">
            <h1>DJ SATORI EP</h1>
            <p>公開は終了しました。</p>
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

function initStars() {
  const canvas = document.getElementById("starCanvas");
  const ctx = canvas.getContext("2d");
  const stars = [];
  const count = 130;

  function resize() {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  function makeStar() {
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.8 + 0.3,
      a: Math.random() * 0.5 + 0.2,
      v: Math.random() * 0.18 + 0.03
    };
  }

  for (let i = 0; i < count; i++) {
    stars.push(makeStar());
  }

  function draw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const star of stars) {
      star.y += star.v;
      if (star.y > window.innerHeight) {
        star.y = -4;
        star.x = Math.random() * window.innerWidth;
      }

      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${star.a})`;
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener("resize", resize);
}

function startShootingStars() {
  const layer = document.getElementById("shootingStars");

  setInterval(() => {
    const star = document.createElement("div");
    star.className = "shooting-star";
    star.style.left = `${Math.random() * (window.innerWidth * 0.7)}px`;
    star.style.top = `${Math.random() * (window.innerHeight * 0.35)}px`;
    layer.appendChild(star);

    setTimeout(() => {
      star.remove();
    }, 1900);
  }, 4200);
}
