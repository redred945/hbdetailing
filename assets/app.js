(function () {
"use strict";
/* studio-master · core/js/_prelude.js — toujours inclus, en tête du bundle app.js.
   Les modules suivants sont concaténés dans la même IIFE et réutilisent ces helpers. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.prototype.slice.call(r.querySelectorAll(s));
const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const hasIO = 'IntersectionObserver' in window;
const isMobile = () => window.matchMedia('(max-width: 560px)').matches;

/* header — pilule flottante au scroll, burger mobile, scrollspy des ancres.
   Hooks : [data-header] · [data-burger] · [data-nav] (liens #ancre = scrollspy) */
(function () {
  const bar = $('[data-header]');
  if (bar) {
    const onScroll = () => bar.classList.toggle('is-float', window.scrollY > 60);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  const burger = $('[data-burger]');
  const nav = $('[data-nav]');
  if (burger && nav) {
    const set = (open) => {
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    burger.addEventListener('click', () => set(!nav.classList.contains('is-open')));
    nav.addEventListener('click', (e) => { if (e.target.tagName === 'A') set(false); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  }

  // scrollspy : n'a de sens que sur la page qui porte les ancres
  const links = nav ? $$('a[href^="#"]', nav).filter((a) => a.getAttribute('href').length > 1) : [];
  if (links.length && hasIO) {
    const targets = links.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    if (targets.length) {
      const setActive = (id) => links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
      const spy = new IntersectionObserver((entries) => {
        let best = null;
        entries.forEach((en) => { if (en.isIntersecting && (!best || en.intersectionRatio > best.intersectionRatio)) best = en; });
        if (best) setActive(best.target.id);
      }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });
      targets.forEach((el) => spy.observe(el));
    }
  }
})();

/* slider — rail scroll-snap mobile générique + points + défilement auto optionnel.
   Hooks : [data-slider] sur le conteneur de cartes.
   Options : data-dots (génère les points) · data-auto="2800" (auto-avance en ms, mobile seulement) */
(function () {
  $$('[data-slider]').forEach((track) => {
    let dots = [];
    if (track.hasAttribute('data-dots') && track.children.length > 1) {
      const wrap = document.createElement('div');
      wrap.className = 'slider-dots';
      wrap.setAttribute('aria-hidden', 'true');
      Array.prototype.forEach.call(track.children, (_, i) => {
        const d = document.createElement('span');
        if (i === 0) d.className = 'is-active';
        wrap.appendChild(d);
      });
      track.insertAdjacentElement('afterend', wrap);
      dots = $$('span', wrap);
    }

    // empreinte réelle d'une carte (largeur + gap) — PAS clientWidth, qui compte aussi le padding du rail
    const step = () => {
      const first = track.children[0];
      if (!first) return track.clientWidth;
      return first.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0);
    };
    const setActive = (i) => dots.forEach((d, k) => d.classList.toggle('is-active', k === i));

    let scrollT;
    track.addEventListener('scroll', () => {
      clearTimeout(scrollT);
      scrollT = setTimeout(() => { const s = step(); if (s && dots.length) setActive(Math.round(track.scrollLeft / s)); }, 80);
    }, { passive: true });

    const interval = parseInt(track.getAttribute('data-auto'), 10);
    if (interval && !reduced) {
      let timer = null, resume;
      const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
      const start = () => {
        if (timer || !isMobile()) return;
        timer = setInterval(() => {
          const n = track.children.length, s = step();
          if (!n || !s) return;
          track.scrollTo({ left: ((Math.round(track.scrollLeft / s) + 1) % n) * s, behavior: 'smooth' });
        }, interval);
      };
      const pause = () => { stop(); clearTimeout(resume); resume = setTimeout(start, 4000); };
      track.addEventListener('pointerdown', pause);
      track.addEventListener('touchstart', pause, { passive: true });
      window.addEventListener('resize', () => { stop(); start(); });
      start();
    }
  });
})();

/* counters — les nombres montent de 0 à leur valeur quand ils entrent à l'écran.
   Hooks : [data-count="33.862"] [data-decimals="3"]. La valeur finale est toujours le texte d'origine :
   sans JS, avec reduced-motion ou sans IntersectionObserver, le bon nombre est déjà affiché. */
(function () {
  const els = $$('[data-count]');
  if (!els.length || reduced || !hasIO) return;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const fmt = (v, d) => { const s = v.toFixed(d); return d > 0 ? s.replace('.', ',') : s; };
  const run = (el) => {
    const target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;
    const d = el.hasAttribute('data-decimals') ? parseInt(el.getAttribute('data-decimals'), 10) : 0;
    let t0 = null;
    const step = (ts) => {
      if (t0 === null) t0 = ts;
      const p = Math.min(1, (ts - t0) / 1300);
      el.textContent = fmt(target * ease(p), d);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.4 });
  els.forEach((el) => io.observe(el));
})();

/* couture — comparateur avant/après « fil de couture » (habitacle/couture, créé pour hb-detailling).
   Hooks : [data-couture] > [data-couture-tab] (boutons) + [data-couture-panel] > [data-couture-stage] (role=slider).
   - pointeur : pointer events + touch-action: pan-y (le scroll vertical reste libre) ;
   - clavier : flèches (±2), Maj+flèches (±10), Début/Fin, PageUp/PageDown (±10) ;
   - une seule démo automatique (50 → 62 → 50 en ~1,2 s) à la première entrée dans le viewport, jamais si reduced-motion. */
(function () {
  $$('[data-couture]').forEach((root) => {
    const tabs = $$('[data-couture-tab]', root);
    const panels = $$('[data-couture-panel]', root);

    const wire = (stage) => {
      let pos = 50, demoTimer = null, dragging = false;
      const set = (v) => {
        pos = Math.max(0, Math.min(100, v));
        stage.style.setProperty('--pos', pos + '%');
        stage.setAttribute('aria-valuenow', String(Math.round(pos)));
        stage.setAttribute('aria-valuetext', Math.round(pos) + ' % — ' + (pos < 50 ? 'plus d’après' : pos > 50 ? 'plus d’avant' : 'moitié avant, moitié après'));
      };
      const stopDemo = () => { if (demoTimer) { clearInterval(demoTimer); demoTimer = null; } };
      const fromEvent = (e) => {
        const r = stage.getBoundingClientRect();
        return ((e.clientX - r.left) / r.width) * 100;
      };

      stage.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        stopDemo(); dragging = true;
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignoré */ }
        stage.classList.add('is-drag');
        set(fromEvent(e));
      });
      stage.addEventListener('pointermove', (e) => { if (dragging) set(fromEvent(e)); });
      const end = (e) => {
        if (!dragging) return;
        dragging = false; stage.classList.remove('is-drag');
        try { stage.releasePointerCapture(e.pointerId); } catch (err) { /* ignoré */ }
      };
      stage.addEventListener('pointerup', end);
      stage.addEventListener('pointercancel', end);
      stage.addEventListener('lostpointercapture', end);

      stage.addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 10 : 2;
        let v = null;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v = pos - step;
        else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v = pos + step;
        else if (e.key === 'PageDown') v = pos - 10;
        else if (e.key === 'PageUp') v = pos + 10;
        else if (e.key === 'Home') v = 0;
        else if (e.key === 'End') v = 100;
        if (v === null) return;
        e.preventDefault(); stopDemo(); set(v);
      });

      stage._couture = { reset: () => { stopDemo(); set(50); } };
      set(50);

      if (hasIO && !reduced) {
        const io = new IntersectionObserver((entries) => {
          entries.forEach((en) => {
            if (!en.isIntersecting || stage.offsetParent === null) return;
            io.unobserve(stage);
            let t = 0;
            demoTimer = setInterval(() => {
              t += 1;
              set(50 + 12 * Math.sin(Math.PI * Math.min(t / 40, 1)));
              if (t >= 40) { stopDemo(); set(50); }
            }, 30);
          });
        }, { threshold: 0.6 });
        io.observe(stage);
      }
    };

    $$('[data-couture-stage]', root).forEach(wire);

    tabs.forEach((tab) => tab.addEventListener('click', () => {
      tabs.forEach((t) => { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.classList.toggle('is-active', on); t.tabIndex = on ? 0 : -1; });
      panels.forEach((p) => {
        const on = p.id === tab.getAttribute('aria-controls');
        p.hidden = !on;
        const st = $('[data-couture-stage]', p);
        if (on && st && st._couture) st._couture.reset();
      });
    }));
    /* flèches gauche/droite entre onglets */
    tabs.forEach((tab, i) => tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      n.focus(); n.click(); e.preventDefault();
    }));
  });
})();

/* devis — formulaire de demande de devis (habitacle/devis, créé pour hb-detailling).
   Hooks : <form data-devis data-dm="https://ig.me/m/…" data-mailto="…"> · [data-devis-status] pour les messages.
   Envoi Web3Forms si une vraie clé est renseignée (input[name=access_key]). Sinon : mailto: si une adresse est connue,
   à défaut message clair qui renvoie vers le DM Instagram (jamais d'envoi vers une adresse inventée).
   Aucune donnée sensible demandée : pas de plaque, pas de donnée bancaire. */
(function () {
  const ENDPOINT = 'https://api.web3forms.com/submit';
  $$('form[data-devis]').forEach((form) => {
    const status = $('[data-devis-status]', form);
    const dm = form.getAttribute('data-dm') || '';
    const val = (el) => String(el.value || '').trim();
    const say = (cls, msg, linkText, href) => {
      if (!status) return;
      status.className = 'devis__status ' + cls;
      status.textContent = msg + (linkText ? ' ' : '');
      if (linkText && href) {
        const a = document.createElement('a');
        a.href = href; a.textContent = linkText; a.target = '_blank'; a.rel = 'noopener';
        status.appendChild(a);
      }
    };
    const summary = () => {
      const lines = [];
      Array.prototype.forEach.call(form.elements, (el) => {
        if (!el.name || /^(access_key|botcheck|from_name|subject)$/.test(el.name) || el.type === 'submit') return;
        if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
        if (!val(el) && el.type !== 'checkbox') return;
        lines.push((el.getAttribute('data-label') || el.name) + ' : ' + (el.type === 'checkbox' ? 'oui' : val(el)));
      });
      return lines.join('\n');
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;
      const keyEl = form.elements.access_key;
      const key = keyEl ? val(keyEl) : '';
      if (!key || /A_COMPLETER|VOTRE_CLE/.test(key)) {
        const to = form.getAttribute('data-mailto') || '';
        if (to) {
          window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent('Demande de devis') + '&body=' + encodeURIComponent(summary());
        } else {
          say('is-info', 'Le formulaire n’est pas encore relié à une boîte de réception (version de présentation). Pour l’instant, écrivez-nous directement en message privé :', 'ouvrir la conversation Instagram', dm);
        }
        return;
      }
      say('is-info', 'Envoi en cours…');
      fetch(ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) })
        .then((r) => r.json())
        .then((d) => {
          if (!d || !d.success) throw new Error('fail');
          form.reset();
          say('is-ok', 'Merci, votre demande est bien partie. Vous pouvez aussi nous envoyer des photos de l’habitacle par message pour affiner le devis.');
        })
        .catch(() => say('is-err', 'L’envoi a échoué. Réessayez, ou écrivez-nous directement :', 'message privé Instagram', dm));
    });
  });
})();

/* actions — barre d'actions collante mobile (habitacle/actions, créé pour hb-detailling).
   Hook : [data-actions]. Apparaît après environ un écran de scroll, se range quand un champ de saisie a le focus
   (clavier mobile ouvert). Sans JS la barre reste visible (CSS seul). reduced-motion : pas de transition (CSS). */
(function () {
  const bar = $('[data-actions]');
  if (!bar) return;
  let typing = false, scrolled = window.scrollY > window.innerHeight * 0.9;
  const sync = () => bar.classList.toggle('is-wait', !scrolled || typing);
  bar.classList.add('is-js');
  sync();
  window.addEventListener('scroll', () => {
    const s = window.scrollY > window.innerHeight * 0.9;
    if (s !== scrolled) { scrolled = s; sync(); }
  }, { passive: true });
  const isField = (t) => t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !/^(checkbox|radio|submit|button)$/.test(t.type || '');
  document.addEventListener('focusin', (e) => { if (isField(e.target)) { typing = true; sync(); } });
  document.addEventListener('focusout', (e) => { if (isField(e.target)) { typing = false; sync(); } });
})();

/* reveal — montée douce au scroll. Hook : .reveal. Toujours inclus, en dernier du bundle
   (il peut retourner tôt sans gêner les autres modules). */
(function () {
  const items = $$('.reveal');
  const showAll = () => items.forEach((el) => el.classList.add('in'));
  if (reduced || !hasIO || !items.length) { showAll(); return; }

  document.documentElement.classList.add('reveal-on');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
  items.forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) el.classList.add('in');
    else io.observe(el);
  });
  // filet de sécurité : rien ne doit rester invisible si l'observer ne se déclenche pas
  window.addEventListener('load', () => setTimeout(showAll, 1400));
})();
})();
