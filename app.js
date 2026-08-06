(() => {
  const data = window.READING_DATA;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const audio = $("#readingAudio");
  const imageSources = data.imageSources;
  let activeLineId = null;
  let activeImage = data.initialImage;
  let seeking = false;
  let karaokeFrame = null;

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  function wordSpan(word) {
    const span = document.createElement("span");
    span.textContent = word.text;
    span.dataset.start = String(word.start);
    span.dataset.end = String(word.end);
    return span;
  }

  function readingLine(line) {
    const paragraph = document.createElement("p");
    paragraph.className = "reading-line";
    paragraph.dataset.lineId = String(line.id);
    paragraph.dataset.start = String(line.start);
    paragraph.dataset.end = String(line.end);
    paragraph.dataset.image = line.image;
    if (line.kind === "title") paragraph.classList.add("is-title");
    if (line.kind === "caption") paragraph.classList.add("is-caption");
    if (line.kind === "question") paragraph.classList.add("is-question");
    line.words.forEach((word, index) => {
      if (index > 0) paragraph.append(" ");
      paragraph.append(wordSpan(word));
    });
    paragraph.addEventListener("click", () => {
      audio.currentTime = line.start;
      audio.play().catch(() => {});
    });
    return paragraph;
  }

  function renderReading() {
    const sectionNames = [...new Set(data.lines.map((line) => line.section))];
    const sections = new Map(
      sectionNames.map((name) => [name, document.createElement("section")]),
    );
    sections.forEach((section) => {
      section.className = "reading-section";
    });
    data.lines.forEach((line) =>
      sections.get(line.section).append(readingLine(line)),
    );
    $("#readingCopy").replaceChildren(...sections.values());

    $("#trackIntro").replaceChildren(
      ...data.introWords.flatMap((word, index) => {
        const nodes = [];
        if (index > 0) nodes.push(document.createTextNode(" "));
        nodes.push(wordSpan(word));
        return nodes;
      }),
    );
  }

  function setImage(name) {
    if (!name || name === activeImage) return;
    activeImage = name;
    const image = $("#readingImage");
    image.style.opacity = "0.35";
    window.setTimeout(() => {
      image.src = `assets/images/${imageSources[name]}`;
      image.style.opacity = "1";
    }, 90);
  }

  function clearHighlight() {
    $$(".reading-line").forEach((line) => line.classList.remove("is-current"));
    $$(".reading-line span, .track-intro span").forEach((word) => {
      word.classList.remove("is-active", "is-done");
    });
    activeLineId = null;
  }

  function keepLineVisible(line) {
    if (window.matchMedia("(max-width: 880px)").matches) return;
    const container = $("#readingCopy");
    const lineRect = line.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const safeTop = containerRect.top + 70;
    const safeBottom = containerRect.bottom - 80;
    if (lineRect.top < safeTop || lineRect.bottom > safeBottom) {
      line.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function updateWords(container, time) {
    container.querySelectorAll("span[data-start]").forEach((word) => {
      const start = Number(word.dataset.start);
      const end = Number(word.dataset.end);
      word.classList.toggle("is-active", time >= start && time < end);
      word.classList.toggle("is-done", time >= end);
    });
  }

  function updateKaraoke() {
    const time = audio.currentTime;
    updateWords($("#trackIntro"), time);
    updateWords($("#readingCopy"), time);

    const lineData = data.lines.find(
      (line) => time >= line.start && time <= line.end,
    );
    $$(".reading-line").forEach((line) => {
      line.classList.toggle(
        "is-current",
        Number(line.dataset.lineId) === lineData?.id,
      );
    });

    if (lineData && lineData.id !== activeLineId) {
      activeLineId = lineData.id;
      setImage(lineData.image);
      const line = $(`.reading-line[data-line-id="${lineData.id}"]`);
      if (line) keepLineVisible(line);
    }

    if (!seeking) $("#seekBar").value = String(time);
    $("#currentTime").textContent = formatTime(time);
  }

  function updatePlayState() {
    const playing = !audio.paused && !audio.ended;
    $("#playButton").querySelector("[aria-hidden]").textContent =
      playing ? "Ⅱ" : "▶";
    $("#playLabel").textContent = playing
      ? "Tạm dừng"
      : audio.ended
        ? "Nghe lại"
        : "Nghe bài đọc";
    $("#readingStatus").textContent = playing
      ? "Đang nghe track gốc và đọc theo"
      : audio.ended
        ? "Đã nghe xong · tự đọc lại theo đúng ngữ điệu"
        : "Sẵn sàng nghe bài đọc";
  }

  function playFromStartIfEnded() {
    if (audio.ended || audio.currentTime >= audio.duration - 0.2) {
      audio.currentTime = 0;
      clearHighlight();
    }
    audio.play().catch(() => {});
  }

  function resetAndPlay() {
    audio.pause();
    audio.currentTime = 0;
    clearHighlight();
    setImage(data.initialImage);
    $("#readingCopy").scrollTo({ top: 0, behavior: "smooth" });
    audio.play().catch(() => {});
  }

  function selectView(view) {
    if (view !== "reading") audio.pause();
    $$(".mode-tabs button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === view);
    });
    $("#readingView").classList.toggle("is-active", view === "reading");
    $("#languageView").classList.toggle("is-active", view === "language");
  }

  $$(".mode-tabs button").forEach((button) => {
    button.addEventListener("click", () => selectView(button.dataset.view));
  });
  $("#playButton").addEventListener("click", () => {
    if (audio.paused) playFromStartIfEnded();
    else audio.pause();
  });
  $("#restartButton").addEventListener("click", resetAndPlay);
  $("#seekBar").addEventListener("pointerdown", () => {
    seeking = true;
  });
  $("#seekBar").addEventListener("input", (event) => {
    audio.currentTime = Number(event.target.value);
    $("#currentTime").textContent = formatTime(audio.currentTime);
    updateKaraoke();
  });
  $("#seekBar").addEventListener("change", () => {
    seeking = false;
  });
  $$(".speed-control button").forEach((button) => {
    button.addEventListener("click", () => {
      audio.playbackRate = Number(button.dataset.speed);
      $$(".speed-control button").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
    });
  });

  function syncAudioMetadata() {
    if (!Number.isFinite(audio.duration)) return;
    $("#seekBar").max = String(audio.duration);
    $("#duration").textContent = formatTime(audio.duration);
  }

  function runKaraokeFrame() {
    updateKaraoke();
    if (audio.paused || audio.ended) {
      karaokeFrame = null;
      return;
    }
    karaokeFrame = window.requestAnimationFrame(runKaraokeFrame);
  }

  function startKaraokeLoop() {
    if (karaokeFrame !== null) return;
    karaokeFrame = window.requestAnimationFrame(runKaraokeFrame);
  }

  function stopKaraokeLoop() {
    if (karaokeFrame !== null) {
      window.cancelAnimationFrame(karaokeFrame);
      karaokeFrame = null;
    }
    updateKaraoke();
  }

  audio.addEventListener("loadedmetadata", syncAudioMetadata);
  audio.addEventListener("timeupdate", updateKaraoke);
  audio.addEventListener("play", () => {
    updatePlayState();
    startKaraokeLoop();
  });
  audio.addEventListener("pause", () => {
    stopKaraokeLoop();
    updatePlayState();
  });
  audio.addEventListener("ended", () => {
    stopKaraokeLoop();
    updatePlayState();
  });

  renderReading();
  updatePlayState();
  if (audio.readyState >= 1) syncAudioMetadata();
  else audio.load();
})();
