import { createBraai } from './braai.js';
import { buildChart } from './cuts.js';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = window.matchMedia('(max-width: 700px), (pointer: coarse)').matches;
const root = document.documentElement;
document.querySelector('[data-year]').textContent = new Date().getFullYear();

/* ---------------- smooth scroll ---------------- */
let lenis = null;
if (!reduced && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const el = id === '#top' ? document.body : document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6 });
    else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  });
});

/* ---------------- nav ---------------- */
const nav = document.querySelector('.nav');
ScrollTrigger.create({
  start: 80, end: 'max',
  onToggle: (s) => nav.classList.toggle('is-solid', s.isActive),
});

/* ---------------- the braai ---------------- */
let braai = null;
try {
  braai = createBraai(document.getElementById('braai'), { reducedMotion: reduced, mobile });
} catch (err) {
  console.warn('WebGL unavailable, showing photo fallback.', err);
  root.classList.add('no-webgl');
}

function intro() {
  root.classList.add('is-ready');
  const lines = gsap.utils.toArray('.hero__title .line > span');
  if (reduced) return;
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  if (braai) {
    tl.to(braai.uniforms.uIgnite, { value: 1, duration: 3.2, ease: 'power2.inOut' }, 0.2)
      .to(braai.state, { intro: 1, duration: 4.2, ease: 'power3.inOut' }, 0);
  }
  tl.from('.hero__mark', { autoAlpha: 0, y: 16, duration: 1.4 }, 0.9)
    .from(lines, { yPercent: 115, duration: 1.5, stagger: 0.11 }, 1.0)
    .from('.hero__lede', { autoAlpha: 0, y: 18, duration: 1.2 }, 1.5)
    .from('.hero__actions > *', { autoAlpha: 0, y: 18, duration: 1.1, stagger: 0.08 }, 1.65)
    .from('.nav', { autoAlpha: 0, duration: 1.2 }, 1.8);
}
// give the first frames (shader compile) a moment before lifting the curtain
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(intro, braai ? 350 : 0)));

if (braai) {
  let heroOn = true, visitOn = false;
  const sync = () => braai.setActive(heroOn || visitOn);
  ScrollTrigger.create({
    trigger: '.hero', start: 'top top', end: 'bottom top',
    onUpdate: (s) => braai.setHero(s.progress),
    onToggle: (s) => { heroOn = s.isActive || s.progress < 1; sync(); },
    onLeave: () => { heroOn = false; sync(); },
    onEnterBack: () => { heroOn = true; sync(); },
  });
  ScrollTrigger.create({
    trigger: '.visit', start: 'top bottom', end: 'top 10%',
    onUpdate: (s) => braai.setEnd(s.progress),
    onEnter: () => { visitOn = true; sync(); },
    onLeaveBack: () => { visitOn = false; sync(); },
  });
  // the hero copy drifts up and dims as the camera rises overhead
  gsap.to('.hero__inner', {
    yPercent: -18, autoAlpha: 0.15, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
}

/* ---------------- the counter: 3D reel ---------------- */
const reel = document.querySelector('[data-reel]');
const track = document.querySelector('[data-track]');
const slabs = gsap.utils.toArray('[data-slab]');
const bar = document.querySelector('[data-progress]');

function layoutSlabs() {
  const mid = window.innerWidth / 2;
  const unit = slabs[0].offsetWidth + parseFloat(getComputedStyle(track).columnGap || 32);
  slabs.forEach((el) => {
    const r = el.getBoundingClientRect();
    const d = (r.left + r.width / 2 - mid) / unit;          // slabs from centre
    const c = Math.max(-2.2, Math.min(2.2, d));
    const rot = -c * 24;
    const z = -Math.abs(c) * 160;
    el.style.transform = `translateZ(${z}px) rotateY(${rot}deg)`;
    el.style.opacity = String(1 - Math.min(Math.abs(c) * 0.22, 0.6));
    const img = el.querySelector('.slab__img img');
    if (img) img.style.transform = `scale(1.12) translateX(${c * -5}%)`;
    const sheen = el.querySelector('.slab__img');
    if (sheen) sheen.style.setProperty('--sheen', `${c * 90}%`);
  });
}

const navBtns = {
  first: document.querySelector('[data-reel-go="first"]'),
  prev: document.querySelector('[data-reel-go="prev"]'),
  next: document.querySelector('[data-reel-go="next"]'),
};
const lastIdx = slabs.length - 1;
function setNavState(idx) {
  navBtns.first.disabled = idx <= 0;
  navBtns.prev.disabled = idx <= 0;
  navBtns.next.disabled = idx >= lastIdx;
}
setNavState(0);

let reelST = null;
if (!reduced) {
  const distance = () => track.scrollWidth - window.innerWidth;
  gsap.to(track, {
    x: () => -distance(),
    ease: 'none',
    scrollTrigger: {
      trigger: '.counter',
      pin: '.counter__pin',
      start: 'top top',
      end: () => '+=' + distance() * 1.1,
      scrub: 0.6,
      invalidateOnRefresh: true,
      onUpdate: (s) => {
        bar.style.transform = `scaleX(${s.progress})`;
        setNavState(Math.round(s.progress * lastIdx));
      },
    },
  });
  reelST = gsap.getTweensOf(track)[0].scrollTrigger;
  gsap.ticker.add(layoutSlabs);
} else {
  reel.addEventListener('scroll', () => {
    layoutSlabs();
    setNavState(Math.round(reel.scrollLeft / (reel.scrollWidth - reel.clientWidth || 1) * lastIdx));
  }, { passive: true });
  layoutSlabs();
}

// arrow controls: step the scroll-driven reel one slab at a time
function currentIdx() {
  if (reelST) return Math.round(reelST.progress * lastIdx);
  return Math.round(reel.scrollLeft / (reel.scrollWidth - reel.clientWidth || 1) * lastIdx);
}
function goToSlab(idx) {
  idx = Math.max(0, Math.min(lastIdx, idx));
  if (reelST) {
    const y = reelST.start + (reelST.end - reelST.start) * (idx / lastIdx);
    if (lenis) lenis.scrollTo(y, { duration: 1.1 });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  } else {
    slabs[idx].scrollIntoView({ inline: 'center', block: 'nearest' });
  }
}
Object.entries(navBtns).forEach(([dir, btn]) => btn.addEventListener('click', () => {
  const i = currentIdx();
  goToSlab(dir === 'first' ? 0 : dir === 'prev' ? i - 1 : i + 1);
}));

// pointer tilt on each slab image, layered on the scroll rotation
slabs.forEach((el) => {
  const img = el.querySelector('.slab__img, .note');
  if (!img || mobile) return;
  el.addEventListener('pointermove', (e) => {
    const r = img.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    gsap.to(img, { rotateY: px * 10, rotateX: -py * 10, duration: 0.6, ease: 'power3.out', transformPerspective: 900 });
  });
  el.addEventListener('pointerleave', () => gsap.to(img, { rotateY: 0, rotateX: 0, duration: 0.9, ease: 'power3.out' }));
});

/* ---------------- cut chart ---------------- */
buildChart(document.querySelector('.cuts'));

/* ---------------- story parallax ---------------- */
if (!reduced) {
  gsap.fromTo('.story__karoo', { yPercent: -8 }, {
    yPercent: 4, ease: 'none',
    scrollTrigger: { trigger: '.story', start: 'top bottom', end: 'bottom top', scrub: true },
  });
  gsap.fromTo('.story__hang img', { yPercent: -12 }, {
    yPercent: 0, ease: 'none',
    scrollTrigger: { trigger: '.story__hang', start: 'top bottom', end: 'bottom top', scrub: true },
  });
  gsap.fromTo('.story__hang', { y: 80 }, {
    y: -40, ease: 'none',
    scrollTrigger: { trigger: '.story', start: 'top bottom', end: 'bottom top', scrub: true },
  });
}

window.addEventListener('load', () => ScrollTrigger.refresh());
