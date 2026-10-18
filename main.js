(() => {
  const root = document.documentElement;
  const themeButton = document.querySelector('.theme-toggle');
  const soundButton = document.querySelector('.sound-toggle');
  const heroArt = document.querySelector('.hero-art');
  const portrait = document.querySelector('.portrait-frame');
  const pipImage = document.querySelector('.pip-image');
  const welcomeNote = document.querySelector('.welcome-note');
  const welcomeGreeting = document.querySelector('.welcome-greeting');
  const secretButton = document.querySelector('.secret-star');
  const secretMessage = document.querySelector('.secret-message');
  const musicStars = [...document.querySelectorAll('.music-star')];
  const musicStatus = document.querySelector('.music-status');
  const musicControls = [...document.querySelectorAll('[data-music-control]')];
  const stopMusicButton = document.querySelector('[data-music-action="stop"]');
  const lullabyPanel = document.querySelector('.lullaby-panel');
  const musicStateLabel = document.querySelector('[data-music-state-label]');
  const nowPlayingNote = document.querySelector('.now-playing-note');
  const recordedSequence = document.querySelector('.recorded-sequence');
  const tuneCount = document.querySelector('.tune-count');
  const musicSoundButton = document.querySelector('[data-music-sound-toggle]');
  const nightlightScene = document.querySelector('.nightlight-scene');
  const lightToggle = document.querySelector('.light-toggle');
  const lightReset = document.querySelector('.light-reset');
  const lampsFound = document.querySelector('.lamps-found');
  const dreamLamps = [...document.querySelectorAll('.dream-lamp')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pentatonicNotes = [523.25, 587.33, 659.25, 783.99, 880];
  const musicNotes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
  const musicNoteNames = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6'];
  const twinkleNotes = [0, 0, 3, 3, 4, 4, 3, 2, 2, 1, 1, 0, 3, 3, 2, 2, 1, 1, 0, 3, 3, 2, 2, 1, 1, 0, 0, 0, 3, 3, 4, 4, 3, 2, 2, 1, 1, 0];
  const soundOffMessage = 'Turn sound on to hear the music box.';
  const recordedNotes = [];
  const musicStarTimeouts = new Map();
  const playbackTimeouts = new Set();
  const activeAudioVoices = new Set();
  let soundEnabled = false;
  let audioContext;
  let secretMessageTimeout;
  let playbackRunning = false;
  let playbackToken = 0;

  const ordinal = (number) => {
    const remainder = number % 100;
    if (remainder >= 11 && remainder <= 13) return `${number}th`;
    switch (number % 10) {
      case 1: return `${number}st`;
      case 2: return `${number}nd`;
      case 3: return `${number}rd`;
      default: return `${number}th`;
    }
  };

  // Keep visit counts local, while allowing the page to work when storage is unavailable.
  try {
    const visits = Number.parseInt(localStorage.getItem('pip-visits') || '0', 10);
    const visitNumber = Number.isFinite(visits) && visits > 0 ? visits + 1 : 1;
    localStorage.setItem('pip-visits', String(visitNumber));
    welcomeGreeting.textContent = visitNumber > 1 ? 'Welcome back! Pip missed you.' : 'Welcome! Pip saved you a cloud.';
    document.querySelector('.visit-number').textContent = ordinal(visitNumber);
    document.querySelector('.visitor-counter').textContent = String(visitNumber).padStart(5, '0');
  } catch {
    welcomeGreeting.textContent = 'Welcome! Pip saved you a cloud.';
    document.querySelector('.visit-number').textContent = '1st';
    document.querySelector('.visitor-counter').textContent = '00001';
  }

  // Restore bedtime mode when possible; storage failures leave the page in daytime mode.
  try {
    if (localStorage.getItem('pip-bedtime') === 'true') root.dataset.theme = 'night';
  } catch {
    root.dataset.theme = 'day';
  }
  const updateThemeButton = () => {
    const isNight = root.dataset.theme === 'night';
    themeButton.setAttribute('aria-pressed', String(isNight));
    themeButton.setAttribute('aria-label', `Turn bedtime mode ${isNight ? 'off' : 'on'}`);
    themeButton.querySelector('.toggle-icon').textContent = isNight ? '☀' : '☾';
    document.querySelector('.hero-caption').textContent = isNight
      ? 'The nursery is tucked in. I’m keeping watch over the dreams tonight.'
      : 'Small skull. Big dream energy. I make sure every night has a little wonder in it.';
  };
  updateThemeButton();
  themeButton.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'night' ? 'day' : 'night';
    updateThemeButton();
    try {
      localStorage.setItem('pip-bedtime', String(root.dataset.theme === 'night'));
    } catch {
      // The theme remains usable for this page view without storage.
    }
  });

  const setMusicState = (state, label, currentNote = 'Waiting for a note') => {
    lullabyPanel.dataset.musicState = state;
    musicStateLabel.textContent = label;
    nowPlayingNote.textContent = currentNote;
  };
  const updateSoundControls = () => {
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    soundButton.setAttribute('aria-label', `Turn sound ${soundEnabled ? 'off' : 'on'}`);
    musicSoundButton.setAttribute('aria-pressed', String(soundEnabled));
    musicSoundButton.setAttribute('aria-label', `Turn sound ${soundEnabled ? 'off' : 'on'}`);
    musicSoundButton.querySelector('.sound-action-label').textContent = `Sound ${soundEnabled ? 'on' : 'off'}`;
    musicSoundButton.querySelector('.sound-action-icon').textContent = soundEnabled ? '♬' : '♫';
  };
  const toggleSound = () => {
    soundEnabled = !soundEnabled;
    updateSoundControls();
    if (!soundEnabled) {
      cancelMusicPlayback();
      musicStatus.textContent = soundOffMessage;
      setMusicState('muted', 'Sound is off', 'Sound is off');
    } else {
      musicStatus.textContent = recordedNotes.length
        ? 'Sound is on. Your pocket lullaby is ready.'
        : 'Sound is on. Play a charm to begin.';
      setMusicState(recordedNotes.length ? 'recording' : 'empty', recordedNotes.length ? 'Tune in progress' : 'Ready to record');
    }
  };
  // Sound changes only through the two explicit Sound controls.
  soundButton.addEventListener('click', toggleSound);
  musicSoundButton.addEventListener('click', toggleSound);
  updateSoundControls();

  const releaseAudioVoice = (voice) => {
    if (voice.cleaned) return;
    voice.cleaned = true;
    activeAudioVoices.delete(voice);
    try { voice.oscillator.disconnect(); } catch {}
    try { voice.gain.disconnect(); } catch {}
  };
  const stopActiveAudio = () => {
    const now = audioContext?.currentTime || 0;
    activeAudioVoices.forEach((voice) => {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(0.0001, now);
      } catch {}
      try { voice.oscillator.stop(now); } catch {}
      releaseAudioVoice(voice);
    });
    activeAudioVoices.clear();
  };
  const createAudioVoice = ({ type, frequency, level, offset = 0, duration }) => {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = audioContext.currentTime + offset;
    const voice = { oscillator, gain, cleaned: false };
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.onended = () => releaseAudioVoice(voice);
    activeAudioVoices.add(voice);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  };
  const playNote = (frequency, offset = 0) => {
    if (!soundEnabled) return;
    try {
      createAudioVoice({ type: 'sine', frequency, level: 0.15, offset, duration: 0.28 });
    } catch {
      // Audio is an enhancement; unsupported contexts should not interrupt navigation.
    }
  };

  // Share the AudioContext and cancelable timers across manual notes and playback.
  const clearMusicStarLights = () => {
    musicStarTimeouts.forEach((timeout) => window.clearTimeout(timeout));
    musicStarTimeouts.clear();
    musicStars.forEach((star) => star.classList.remove('is-lit'));
  };
  const renderRecordedNotes = () => {
    recordedSequence.replaceChildren();
    tuneCount.textContent = `${recordedNotes.length} / 16 ${recordedNotes.length === 1 ? 'note' : 'notes'}`;
    if (!recordedNotes.length) {
      const emptyMessage = document.createElement('p');
      emptyMessage.className = 'tune-empty';
      emptyMessage.textContent = 'No notes tucked away yet. Play a charm to begin.';
      recordedSequence.append(emptyMessage);
      return;
    }
    recordedNotes.forEach((noteIndex, position) => {
      const note = document.createElement('span');
      note.className = 'sequence-note';
      note.setAttribute('role', 'listitem');
      note.setAttribute('aria-label', `Note ${position + 1}: ${musicNoteNames[noteIndex]}`);
      note.textContent = musicNoteNames[noteIndex];
      recordedSequence.append(note);
    });
    recordedSequence.scrollLeft = recordedSequence.scrollWidth;
  };
  const releaseMusicParticles = (star) => {
    if (reducedMotion) return;
    ['♪', '✦', '·'].forEach((symbol, particleIndex) => {
      const particle = document.createElement('span');
      particle.className = 'music-particle';
      particle.setAttribute('aria-hidden', 'true');
      particle.textContent = symbol;
      particle.style.setProperty('--particle-x', `${28 + particleIndex * 22}%`);
      particle.style.setProperty('--particle-drift', `${(particleIndex - 1) * 12}px`);
      star.append(particle);
      particle.addEventListener('animationend', () => particle.remove(), { once: true });
    });
  };
  const cancelMusicPlayback = () => {
    playbackToken += 1;
    playbackTimeouts.forEach((timeout) => window.clearTimeout(timeout));
    playbackTimeouts.clear();
    playbackRunning = false;
    musicControls.forEach((button) => { button.disabled = button === stopMusicButton; });
    musicStars.forEach((star) => { star.disabled = false; });
    clearMusicStarLights();
    stopActiveAudio();
    nowPlayingNote.textContent = 'Waiting for a note';
  };
  const lightMusicStar = (index) => {
    const star = musicStars[index];
    const existingTimeout = musicStarTimeouts.get(index);
    if (existingTimeout) window.clearTimeout(existingTimeout);
    star.classList.add('is-lit');
    releaseMusicParticles(star);
    const timeout = window.setTimeout(() => {
      star.classList.remove('is-lit');
      musicStarTimeouts.delete(index);
    }, 520);
    musicStarTimeouts.set(index, timeout);
  };
  const bouncePip = () => {
    if (reducedMotion) return;
    pipImage.classList.remove('is-bouncing');
    void pipImage.offsetWidth;
    pipImage.classList.add('is-bouncing');
  };
  const playMusicBoxNote = (index, record = false) => {
    const noteName = musicNoteNames[index];
    lightMusicStar(index);
    bouncePip();
    nowPlayingNote.textContent = `${noteName} is ringing`;
    if (record) {
      recordedNotes.push(index);
      if (recordedNotes.length > 16) recordedNotes.shift();
      renderRecordedNotes();
    }
    if (!soundEnabled) {
      musicStatus.textContent = `${noteName} saved silently. Turn Sound on to hear it.`;
      setMusicState('muted', 'Recording silently', `${noteName} saved silently`);
      return;
    }
    if (!playbackRunning) {
      musicStatus.textContent = `${noteName} added to your pocket lullaby.`;
      setMusicState('recording', 'Recording your tune', `${noteName} is ringing`);
    }
    try {
      [
        { type: 'triangle', frequency: musicNotes[index], level: 0.12 },
        { type: 'sine', frequency: musicNotes[index] * 2, level: 0.035 }
      ].forEach(({ type, frequency, level }) => {
        createAudioVoice({ type, frequency, level, duration: 1.5 });
      });
    } catch {
      // Keep the visual note and recording usable if Web Audio is unavailable.
    }
  };
  const playSequence = (notes, interval, label) => {
    if (playbackRunning) return;
    if (!soundEnabled) {
      musicStatus.textContent = soundOffMessage;
      setMusicState('muted', 'Sound is off', 'Turn Sound on to play');
      return;
    }
    if (!notes.length) {
      musicStatus.textContent = 'Play a few notes to record a tune first.';
      setMusicState('empty', 'Waiting for your tune');
      return;
    }
    stopActiveAudio();
    clearMusicStarLights();
    playbackRunning = true;
    const token = ++playbackToken;
    musicControls.forEach((button) => { button.disabled = button !== stopMusicButton; });
    musicStars.forEach((star) => { star.disabled = true; });
    musicStatus.textContent = `Playing ${label}.`;
    setMusicState('playing', `Playing ${label}`, 'The music box is winding up');
    let position = 0;
    const playNext = () => {
      if (!playbackRunning || token !== playbackToken) return;
      playMusicBoxNote(notes[position]);
      position += 1;
      const timeout = window.setTimeout(() => {
        playbackTimeouts.delete(timeout);
        if (!playbackRunning || token !== playbackToken) return;
        if (position >= notes.length) {
          cancelMusicPlayback();
          musicStatus.textContent = `${label} finished.`;
          setMusicState('stopped', 'Playback finished', 'The last note is dreaming');
          return;
        }
        playNext();
      }, position >= notes.length ? 1550 : interval);
      playbackTimeouts.add(timeout);
    };
    playNext();
  };
  musicStars.forEach((star, index) => {
    star.addEventListener('click', () => playMusicBoxNote(index, true));
  });
  renderRecordedNotes();
  musicControls.forEach((button) => {
    button.addEventListener('click', () => {
      switch (button.dataset.musicAction) {
        case 'lullaby':
          playSequence(twinkleNotes, 600, "Pip's lullaby");
          break;
        case 'my-tune':
          playSequence(recordedNotes.slice(), 400, 'your tune');
          break;
        case 'clear':
          recordedNotes.length = 0;
          renderRecordedNotes();
          musicStatus.textContent = soundEnabled
            ? 'Your pocket lullaby is clear and ready for new notes.'
            : 'Your pocket lullaby is clear. Sound is still off.';
          setMusicState(soundEnabled ? 'empty' : 'muted', soundEnabled ? 'Ready to record' : 'Sound is off', soundEnabled ? 'Waiting for a note' : 'Sound is off');
          break;
        case 'stop':
          cancelMusicPlayback();
          musicStatus.textContent = 'Playback stopped.';
          setMusicState('stopped', 'Playback stopped', 'The music box is resting');
          break;
      }
    });
  });
  // Keep letter shortcuts inactive while an editable control has focus.
  document.addEventListener('keydown', (event) => {
    const editableTarget = event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]');
    if (event.altKey || event.ctrlKey || event.metaKey || editableTarget) return;
    const index = 'asdfghjk'.indexOf(event.key.toLowerCase());
    if (index < 0) return;
    if (playbackRunning) return;
    event.preventDefault();
    musicStars[index].click();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelMusicPlayback();
  });
  const playChime = () => {
    if (!playbackRunning) playNote(pentatonicNotes[Math.floor(Math.random() * pentatonicNotes.length)]);
  };
  portrait.addEventListener('click', (event) => {
    if (event.target === pipImage || (portrait.classList.contains('image-missing') && !event.target.closest('button'))) playChime();
  });

  // Tilt Pip toward pointer and touch input, then ease back when the pointer leaves.
  const tiltPortrait = (event) => {
    if (reducedMotion) return;
    const bounds = portrait.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    portrait.style.setProperty('--pip-transform', `translate(${x * 8}px, ${y * 7}px) rotate(${x * 3}deg)`);
  };
  portrait.addEventListener('pointermove', tiltPortrait);
  portrait.addEventListener('pointerdown', tiltPortrait);
  portrait.addEventListener('pointerleave', () => portrait.style.removeProperty('--pip-transform'));
  portrait.addEventListener('pointerup', () => portrait.style.removeProperty('--pip-transform'));

  // Show the CSS illustrations only if a local photo cannot be loaded.
  document.querySelectorAll('.pip-image, .polaroid-art img, .nightlight-background').forEach((image) => {
    image.addEventListener('error', () => {
      image.hidden = true;
      if (image === pipImage) portrait.classList.add('image-missing');
      else if (image.classList.contains('nightlight-background')) nightlightScene.classList.add('image-missing');
      else image.closest('.project-card')?.classList.add('image-missing');
    }, { once: true });
  });

  // Keep the welcome note dismissible without changing the portrait layout.
  welcomeNote.querySelector('.dismiss-note').addEventListener('click', () => welcomeNote.remove());

  // The hidden star plays a four-note phrase and skips confetti for reduced-motion users.
  secretButton.addEventListener('click', () => {
    if (soundEnabled && !playbackRunning) pentatonicNotes.slice(0, 4).forEach((note, index) => playNote(note, index * 0.16));
    secretMessage.hidden = false;
    secretButton.setAttribute('aria-expanded', 'true');
    heroArt.classList.add('has-secret-message');
    clearTimeout(secretMessageTimeout);
    secretMessageTimeout = window.setTimeout(() => {
      secretMessage.hidden = true;
      secretButton.setAttribute('aria-expanded', 'false');
      heroArt.classList.remove('has-secret-message');
    }, 6000);
    if (!reducedMotion && typeof window.confetti === 'function') {
      window.confetti({ particleCount: 55, spread: 62, origin: { y: 0.48 }, colors: ['#e9a23b', '#f4c9d6', '#cdbbe8', '#a34063'] });
    }
  });

  // Search Pip's dark nursery with pointer, touch, or keyboard input.
  let lightPosition = { x: 50, y: 50 };
  let nightlightDragging = false;
  const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);
  const updateLampCounter = () => {
    const foundCount = dreamLamps.filter((lamp) => lamp.classList.contains('is-found')).length;
    lampsFound.textContent = String(foundCount);
    document.querySelector('.lamp-counter').classList.toggle('is-complete', foundCount === dreamLamps.length);
  };
  const findNearbyLamps = () => {
    if (nightlightScene.dataset.lightOn !== 'true') return;
    const bounds = nightlightScene.getBoundingClientRect();
    const lightX = bounds.width * lightPosition.x / 100;
    const lightY = bounds.height * lightPosition.y / 100;
    const discoveryRadius = Math.min(bounds.width, bounds.height) * 0.24;
    dreamLamps.forEach((lamp) => {
      const lampX = bounds.width * Number(lamp.dataset.lampX) / 100;
      const lampY = bounds.height * Number(lamp.dataset.lampY) / 100;
      if (Math.hypot(lightX - lampX, lightY - lampY) <= discoveryRadius) lamp.classList.add('is-found');
    });
    updateLampCounter();
  };
  const moveNightlight = (x, y) => {
    lightPosition = { x: clamp(x, 3, 97), y: clamp(y, 4, 96) };
    nightlightScene.style.setProperty('--light-x', `${lightPosition.x}%`);
    nightlightScene.style.setProperty('--light-y', `${lightPosition.y}%`);
    nightlightScene.classList.add('is-used');
    findNearbyLamps();
  };
  const moveNightlightFromPointer = (event) => {
    const bounds = nightlightScene.getBoundingClientRect();
    moveNightlight(
      (event.clientX - bounds.left) / bounds.width * 100,
      (event.clientY - bounds.top) / bounds.height * 100
    );
  };
  const setNightlightEnabled = (enabled) => {
    nightlightScene.dataset.lightOn = String(enabled);
    lightToggle.setAttribute('aria-pressed', String(enabled));
    lightToggle.textContent = `Turn light ${enabled ? 'off' : 'on'}`;
    if (enabled) findNearbyLamps();
  };
  nightlightScene.addEventListener('pointerdown', (event) => {
    nightlightDragging = true;
    nightlightScene.focus({ preventScroll: true });
    try { nightlightScene.setPointerCapture(event.pointerId); } catch {}
    moveNightlightFromPointer(event);
  });
  nightlightScene.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' || nightlightDragging) moveNightlightFromPointer(event);
  });
  const endNightlightDrag = (event) => {
    nightlightDragging = false;
    try {
      if (nightlightScene.hasPointerCapture(event.pointerId)) nightlightScene.releasePointerCapture(event.pointerId);
    } catch {}
  };
  nightlightScene.addEventListener('pointerup', endNightlightDrag);
  nightlightScene.addEventListener('pointercancel', endNightlightDrag);
  nightlightScene.addEventListener('keydown', (event) => {
    const movements = {
      ArrowUp: [0, -7],
      ArrowDown: [0, 7],
      ArrowLeft: [-7, 0],
      ArrowRight: [7, 0]
    };
    const movement = movements[event.key];
    if (!movement) return;
    event.preventDefault();
    moveNightlight(lightPosition.x + movement[0], lightPosition.y + movement[1]);
  });
  lightToggle.addEventListener('click', () => setNightlightEnabled(nightlightScene.dataset.lightOn !== 'true'));
  lightReset.addEventListener('click', () => {
    dreamLamps.forEach((lamp) => lamp.classList.remove('is-found'));
    lightPosition = { x: 50, y: 50 };
    nightlightScene.style.setProperty('--light-x', '50%');
    nightlightScene.style.setProperty('--light-y', '50%');
    nightlightScene.classList.remove('is-used');
    setNightlightEnabled(true);
    updateLampCounter();
  });
  updateLampCounter();

  // Scroll scenes in once; reduced-motion styles keep them visible without animation.
  const scenes = document.querySelectorAll('.story-scene');
  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    scenes.forEach((scene, index) => {
      scene.style.transitionDelay = `${index * 90}ms`;
      observer.observe(scene);
    });
  } else {
    scenes.forEach((scene) => scene.classList.add('is-visible'));
  }
})();
