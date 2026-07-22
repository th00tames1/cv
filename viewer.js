/* =========================================================================
 * viewer.js — 공개 CV 페이지: cv-publish.json을 읽어 렌더링
 * ========================================================================= */
(function () {
  'use strict';
  var M = window.CVModel, R = window.CVRender;

  function el(id) { return document.getElementById(id); }
  var esc = R.esc;

  function chipHtml(href, icon, label) {
    if (!M.trim(label)) return '';
    var inner = (icon ? icon + ' ' : '') + esc(label);
    if (href) {
      // 새 탭은 웹 링크에만 (mailto:/tel:은 현재 탭)
      var ext = /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : '';
      return '<a class="hero-chip" href="' + esc(href) + '"' + ext + '>' + inner + '</a>';
    }
    return '<span class="hero-chip">' + inner + '</span>';
  }

  function webHref(v) {
    v = M.trim(v);
    if (!v) return '';
    return /^https?:\/\//i.test(v) ? v : 'https://' + v;
  }

  function orcidId(v) {
    return M.trim(v).replace(/^(https?:\/\/)?(www\.)?orcid\.org\//i, '');
  }

  var current = null;

  function show(payload) {
    var prof = payload && payload.profile;
    if (!prof || !prof.data) { showEmpty(); return; }
    current = { data: prof.data, settings: M.normalizeSettings(prof.settings), name: prof.name };

    var p = prof.data.personal || {};
    el('viewer-main').classList.remove('hidden');
    el('viewer-empty').classList.add('hidden');

    if (M.trim(p.fullName)) document.title = M.trim(p.fullName) + ' — Curriculum Vitae';
    el('hero-name').textContent = M.trim(p.fullName) || 'Curriculum Vitae';
    el('hero-title').textContent = M.trim(p.title);
    if (p.photo) { el('hero-photo').src = p.photo; el('hero-photo').classList.remove('hidden'); }

    // 알려진 서비스는 긴 URL 대신 고정 라벨로 (모바일 히어로 깔끔하게)
    var chips = '';
    chips += chipHtml(p.email ? 'mailto:' + M.trim(p.email) : '', '✉', p.email);
    chips += chipHtml(p.phone ? 'tel:' + M.trim(p.phone).replace(/[^+\d]/g, '') : '', '☎', p.phone);
    chips += chipHtml(webHref(p.website), '🌐', p.website);
    chips += chipHtml(webHref(p.linkedin), '', M.trim(p.linkedin) ? 'LinkedIn' : '');
    chips += chipHtml(webHref(p.github), '', M.trim(p.github) ? 'GitHub' : '');
    chips += chipHtml(webHref(p.scholar), '🎓', M.trim(p.scholar) ? 'Google Scholar' : '');
    chips += chipHtml(orcidId(p.orcid) ? 'https://orcid.org/' + orcidId(p.orcid) : '', '', orcidId(p.orcid) ? 'ORCID' : '');
    el('hero-chips').innerHTML = chips;

    if (payload.publishedAt) {
      // 로컬 시간대 기준 YYYY-MM-DD
      var d = new Date(payload.publishedAt);
      el('pub-date').textContent = 'Updated ' + (isNaN(d) ? String(payload.publishedAt).slice(0, 10) : d.toLocaleDateString('en-CA'));
    }

    var r = R.renderCv(prof.data, current.settings);
    var page = el('cv-page');
    page.className = r.className;
    page.style.setProperty('--accent', r.accent);
    page.style.setProperty('--link', r.link);
    page.innerHTML = r.html;
    setPrintPaper(current.settings);
    fitPage();
    // 사진 등 이미지가 늦게 로드되면 높이 재계산 (하단 잘림 방지)
    page.querySelectorAll('img').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', fitPage, { once: true });
    });
  }

  function showEmpty() {
    el('viewer-empty').classList.remove('hidden');
    el('viewer-main').classList.add('hidden');
    if (location.protocol === 'file:') {
      // 로컬에서는 게시본을 읽을 수 없음 — 안내 문구 교체
      var box = document.querySelector('.ve-box p');
      if (box) box.textContent = '로컬에서는 편집 페이지(edit.html)를 사용하세요. 게시본은 웹사이트에서만 표시됩니다.';
    }
  }

  function fitPage() {
    var wrap = el('v-page-wrap'), page = el('cv-page');
    if (!page.offsetWidth) return;
    var pw = page.offsetWidth;
    var avail = wrap.clientWidth;
    var scale = Math.min(1, avail / pw);
    // 모바일에서 글자가 너무 작아지지 않도록 최소 배율 유지 (가로 스와이프로 열람)
    if (scale < 0.62) scale = 0.62;
    page.style.transform = scale < 1 ? 'scale(' + scale + ')' : '';
    page.style.transformOrigin = 'top left';
    wrap.style.height = Math.round(page.offsetHeight * scale) + 'px';
  }
  window.addEventListener('resize', fitPage);

  // Word 라이브러리는 필요할 때만 로드 (초기 페이지를 가볍게)
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error(src + ' 로드 실패')); };
      document.body.appendChild(s);
    });
  }
  function ensureDocx() {
    if (window.CVDocx) return Promise.resolve();
    return loadScript('docx.iife.js').then(function () { return loadScript('docx-export.js?v=22'); });
  }

  function setPrintPaper(settings) {
    var spec = M.TEMPLATE_SPECS[settings.template] || {};
    var st = document.getElementById('print-page-style');
    if (!st) { st = document.createElement('style'); st.id = 'print-page-style'; document.head.appendChild(st); }
    st.textContent = '@media print { @page { size: ' + (spec.paper === 'letter' ? 'Letter' : 'A4') + '; margin: 18mm 17mm; } }';
  }

  function bind() {
    el('btn-v-print').addEventListener('click', function () {
      if (current) setPrintPaper(current.settings);
      window.print();
    });
    el('btn-v-docx').addEventListener('click', function () {
      if (!current) return;
      var btn = this;
      btn.disabled = true; btn.textContent = 'Generating…';
      var spec = M.TEMPLATE_SPECS[current.settings.template] || {};
      ensureDocx()
        .then(function () {
          if (spec.photoShape === 'circle' && current.data.personal.photo) {
            return R.circledPhoto(current.data.personal.photo).then(function (round) {
              if (!round) return current.data;
              var d2 = JSON.parse(JSON.stringify(current.data));
              d2.personal.photo = round.dataUrl;
              d2.personal.photoW = round.size; d2.personal.photoH = round.size;
              return d2;
            });
          }
          return current.data;
        })
        .then(function (data) {
          var doc = window.CVDocx.buildDoc(data, current.settings);
          return window.CVDocx.Packer.toBlob(doc);
        })
        .then(function (blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = window.CVDocx.suggestedFilename(current.data, current.name);
          document.body.appendChild(a); a.click();
          setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 800);
        })
        .catch(function (e) { alert('Failed to generate Word file: ' + e.message); })
        .then(function () { btn.disabled = false; btn.textContent = 'Download Word (.docx)'; });
    });
  }

  // 테스트/수동 렌더용
  window.__viewerRender = show;

  bind();
  // 쿼리로 CDN 캐시 우회 → 게시 직후에도 최신본 표시
  fetch('cv-publish.json?ts=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('not published'); return r.json(); })
    .then(show)
    .catch(showEmpty);
})();
