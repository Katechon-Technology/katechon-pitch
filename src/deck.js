const isMobile = window.matchMedia('(max-width: 768px)').matches;

let _slides = [];
let _mountedEls = [];
let _current = 0;
let _total = 0;

let _deckStarted = false;
let _bgStarted = false;
let _musicEnabled = true;
let _avatarVisible = true;

const _payloadCache = {};
let _bgMusic = null;
let _avatarIframe = null;

export function initDeck(slideModules) {
  _slides = slideModules;
  _total = slideModules.length;

  _bgMusic = new Audio('/assets/Cloud_Sync_2026-03-09T120527.mp3');
  _bgMusic.loop = true;
  _bgMusic.volume = 0.15;

  injectStyles(slideModules);
  _mountedEls = mountSlides(slideModules);

  _avatarIframe = document.getElementById('avatar-pet');

  document.getElementById('total').textContent = _total;
  document.getElementById('current').textContent = '1';
  document.getElementById('progress').style.width = (1 / _total * 100) + '%';

  initOverlay();
  initControls();

  if (isMobile) {
    _mountedEls.forEach(el => el.classList.add('active'));
    initMobileScrollTracking();
  }

  for (let i = 0; i < Math.min(3, _total); i++) {
    loadPayload(_slides[i].id);
  }
}

function mountSlides(slideModules) {
  const deck = document.getElementById('deck-content');
  return slideModules.map((slide, i) => {
    const el = document.createElement('div');
    el.className = `slide slide-${slide.id}`;
    el.dataset.slide = String(i);
    el.innerHTML = slide.html;
    if (i === 0 && !isMobile) el.classList.add('active');
    deck.appendChild(el);
    if (slide.init) slide.init(el);
    return el;
  });
}

function injectStyles(slideModules) {
  slideModules.forEach(slide => {
    if (!slide.css) return;
    const style = document.createElement('style');
    style.dataset.slide = slide.id;
    style.textContent = slide.css;
    document.head.appendChild(style);
  });
}

async function loadPayload(slug) {
  if (_payloadCache[slug]) return _payloadCache[slug];
  try {
    const resp = await fetch(`/assets/narration/${slug}.json`);
    if (!resp.ok) return null;
    const payload = await resp.json();
    _payloadCache[slug] = payload;
    return payload;
  } catch (e) {
    console.error('[deck] failed to load payload for slug', slug, e);
    return null;
  }
}

function stopNarration() {
  if (_avatarIframe && _avatarIframe.contentWindow) {
    _avatarIframe.contentWindow.postMessage({ type: 'stop' }, '*');
  }
}

async function playNarration(slug) {
  if (isMobile) return;
  if (!_avatarIframe || !_avatarIframe.contentWindow) return;
  const payload = await loadPayload(slug);
  if (!payload) return;
  _avatarIframe.contentWindow.postMessage(payload, '*');
}

function ensureBgMusic() {
  if (isMobile) return;
  if (!_bgStarted) {
    _bgStarted = true;
    _bgMusic.play().catch(() => {});
  }
}

export function goTo(n) {
  if (n < 0 || n >= _total) return;
  stopNarration();

  if (!isMobile) _mountedEls[_current].classList.remove('active');
  const vid = _mountedEls[_current].querySelector('video');
  if (vid) vid.pause();

  const wasVideoSlide = Boolean(_slides[_current].isVideoSlide);
  _current = n;

  if (!isMobile) _mountedEls[_current].classList.add('active');
  document.getElementById('current').textContent = _current + 1;
  document.getElementById('progress').style.width = ((_current + 1) / _total * 100) + '%';

  if (_slides[_current].isVideoSlide) {
    _bgMusic.pause();
    _avatarIframe.style.display = 'none';
  } else {
    if (wasVideoSlide) {
      if (_musicEnabled) _bgMusic.play().catch(() => {});
      _avatarIframe.style.display = _avatarVisible ? '' : 'none';
    } else {
      ensureBgMusic();
    }
    if (_avatarVisible) playNarration(_slides[_current].id);
  }

  const newVid = _mountedEls[_current].querySelector('video');
  if (newVid) { newVid.currentTime = 0; newVid.play().catch(() => {}); }

  if (isMobile) _mountedEls[_current].scrollIntoView({ behavior: 'smooth' });
}

function initOverlay() {
  const overlay = document.getElementById('start-overlay');

  function dismiss() {
    if (_deckStarted) return;
    _deckStarted = true;
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 400);
    ensureBgMusic();
    if (_avatarVisible) playNarration(_slides[0].id);
  }

  overlay.addEventListener('click', dismiss);

  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' && !_deckStarted) {
      e.preventDefault();
      dismiss();
    }
  });
}

function initControls() {
  const avatarToggleBtn = document.getElementById('avatar-toggle');
  const musicToggleBtn  = document.getElementById('music-toggle');

  avatarToggleBtn.addEventListener('click', () => {
    _avatarVisible = !_avatarVisible;
    _avatarIframe.style.display = _avatarVisible ? '' : 'none';
    avatarToggleBtn.style.opacity = _avatarVisible ? '1' : '0.4';
    if (!_avatarVisible) stopNarration();
    else playNarration(_slides[_current].id);
  });

  musicToggleBtn.addEventListener('click', () => {
    _musicEnabled = !_musicEnabled;
    musicToggleBtn.style.opacity = _musicEnabled ? '1' : '0.4';
    if (_musicEnabled) _bgMusic.play().catch(() => {});
    else _bgMusic.pause();
  });

  document.getElementById('prev').addEventListener('click', () => goTo(_current - 1));
  document.getElementById('next').addEventListener('click', () => goTo(_current + 1));

  document.addEventListener('keydown', (e) => {
    if (!_deckStarted) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      goTo(_current + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      goTo(_current - 1);
    } else if (e.key === 'Home') {
      goTo(0);
    } else if (e.key === 'End') {
      goTo(_total - 1);
    }
  });

  if (!isMobile) {
    let touchStartX = 0;
    document.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; });
    document.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) dx > 0 ? goTo(_current - 1) : goTo(_current + 1);
    });
  }
}

function initMobileScrollTracking() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting || entry.intersectionRatio <= 0.4) return;
      const idx = parseInt(entry.target.dataset.slide);
      if (isNaN(idx) || idx === _current) return;

      const wasVideo = Boolean(_slides[_current].isVideoSlide);
      stopNarration();
      const vid = _mountedEls[_current].querySelector('video');
      if (vid) vid.pause();
      _current = idx;

      document.getElementById('current').textContent = _current + 1;
      document.getElementById('progress').style.width = ((_current + 1) / _total * 100) + '%';

      if (_slides[_current].isVideoSlide) {
        _bgMusic.pause();
        _avatarIframe.style.display = 'none';
      } else {
        if (wasVideo) {
          if (_musicEnabled) _bgMusic.play().catch(() => {});
          _avatarIframe.style.display = _avatarVisible ? '' : 'none';
        } else {
          ensureBgMusic();
        }
        if (_avatarVisible) playNarration(_slides[_current].id);
      }

      const newVid = _mountedEls[_current].querySelector('video');
      if (newVid) { newVid.currentTime = 0; newVid.play().catch(() => {}); }
    });
  }, { threshold: 0.4 });

  _mountedEls.forEach(el => observer.observe(el));
}
