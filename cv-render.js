/* =========================================================================
 * cv-render.js — CV HTML 렌더러 (편집기 미리보기와 공개 페이지가 공유)
 * UMD: 브라우저에서는 window.CVRender
 * ========================================================================= */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./cv-model.js'));
  else root.CVRender = factory(root.CVModel);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var PAPER_PX = { a4: { w: 794, h: 1123 }, letter: { w: 816, h: 1056 } };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 연락처 아이콘 (16x16, currentColor — 글자 색·크기를 따라감) */
  var ICON_PATHS = {
    mail: '<rect x="1.5" y="3" width="13" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
          '<path d="M2.2 4.4 8 8.7l5.8-4.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    phone: '<path d="M3.2 1.6a1.2 1.2 0 0 1 1.7.2l1.4 1.9a1.2 1.2 0 0 1-.2 1.6L5 6.3a8.9 8.9 0 0 0 4.7 4.7l1-1.1a1.2 1.2 0 0 1 1.6-.2l1.9 1.4a1.2 1.2 0 0 1 .2 1.7l-.9 1c-.5.6-1.3.8-2 .5C7.9 14 2 8.1.6 3.3c-.2-.7 0-1.5.6-2z" fill="currentColor"/>',
    pin: '<path d="M8 1.7c-2.5 0-4.5 2-4.5 4.5C3.5 9.7 8 14.3 8 14.3s4.5-4.6 4.5-8.1C12.5 3.7 10.5 1.7 8 1.7z" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
         '<circle cx="8" cy="6.1" r="1.7" fill="currentColor"/>',
    globe: '<circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
           '<path d="M1.7 8h12.6M8 1.7c3.1 3.4 3.1 9.2 0 12.6-3.1-3.4-3.1-9.2 0-12.6z" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    linkedin: '<rect x="1.2" y="1.2" width="13.6" height="13.6" rx="2.6" fill="currentColor"/>' +
              '<text x="8" y="11.5" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="8.4" font-weight="700" fill="#fff">in</text>',
    github: '<path d="M8 1.3a6.7 6.7 0 0 0-2.1 13.1c.33.06.45-.15.45-.33v-1.15c-1.87.4-2.26-.9-2.26-.9-.3-.78-.75-.99-.75-.99-.61-.42.05-.41.05-.41.68.05 1.03.7 1.03.7.6 1.03 1.58.73 1.97.56.06-.44.24-.74.43-.91-1.49-.17-3.06-.75-3.06-3.32 0-.73.26-1.33.69-1.8-.07-.17-.3-.85.07-1.78 0 0 .56-.18 1.84.69a6.4 6.4 0 0 1 3.35 0c1.28-.87 1.84-.69 1.84-.69.37.93.14 1.61.07 1.78.43.47.69 1.07.69 1.8 0 2.58-1.57 3.15-3.07 3.31.24.21.46.62.46 1.25v1.85c0 .18.12.39.46.33A6.7 6.7 0 0 0 8 1.3z" fill="currentColor"/>',
    scholar: '<path d="M8 1.9.9 5.6 8 9.3l7.1-3.7z" fill="currentColor"/>' +
             '<path d="M3.9 7.4v3.1c0 1.2 1.8 2.2 4.1 2.2s4.1-1 4.1-2.2V7.4" fill="none" stroke="currentColor" stroke-width="1.3"/>',
    orcid: '<circle cx="8" cy="8" r="6.6" fill="currentColor"/>' +
           '<text x="8" y="11.1" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="7.4" font-weight="700" fill="#fff">iD</text>'
  };
  function iconSvg(name) {
    var body = ICON_PATHS[name];
    if (!body) return '';
    return '<svg class="ci" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  // 강조색이 거의 검정이면 링크가 본문과 구분되지 않으므로 링크용 파랑을 쓴다
  function linkColor(accent) {
    var m = /^#?([0-9a-fA-F]{6})$/.exec(String(accent || '').trim());
    if (!m) return '#0f4c81';
    var n = parseInt(m[1], 16);
    var lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    return lum < 60 ? '#0f4c81' : (accent.charAt(0) === '#' ? accent : '#' + accent);
  }

  function runsToHtml(runs) {
    return (runs || []).map(function (r) {
      var t = esc(r.t);
      if (r.i) t = '<i>' + t + '</i>';
      if (r.b) t = '<b>' + t + '</b>';
      var cls = [];
      if (r.sc) cls.push('r-sc');
      if (r.c) cls.push('r-' + r.c);
      if (r.sz) cls.push('r-' + r.sz);
      if (cls.length) t = '<span class="' + cls.join(' ') + '">' + t + '</span>';
      if (r.href) t = '<a href="' + esc(r.href) + '" target="_blank" rel="noopener">' + t + '</a>';
      return t;
    }).join('');
  }

  function blockHtml(block, vm, layout) {
    var html = '';
    if (block.cite) return html;
    if (layout === 'left-dates') {
      var dateRuns = null;
      for (var i = 0; i < (block.lines || []).length; i++) {
        if (block.lines[i].right && block.lines[i].right.length) { dateRuns = block.lines[i].right; break; }
      }
      html += '<div class="entry ld' + (vm.tight ? ' tight' : '') + '">';
      html += '<div class="dcol">' + (dateRuns ? runsToHtml(dateRuns) : '') + '</div>';
      html += '<div class="econtent">';
      (block.lines || []).forEach(function (line) {
        html += '<div class="line"><span class="left">' + runsToHtml(line.left) + '</span></div>';
      });
      if (block.bullets && block.bullets.length) {
        html += '<ul>' + block.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';
      }
      html += '</div></div>';
      return html;
    }
    html += '<div class="entry' + (vm.tight ? ' tight' : '') + '">';
    (block.lines || []).forEach(function (line) {
      html += '<div class="line"><span class="left">' + runsToHtml(line.left) + '</span>';
      if (line.right && line.right.length) html += '<span class="right">' + runsToHtml(line.right) + '</span>';
      html += '</div>';
    });
    if (block.bullets && block.bullets.length) {
      html += '<ul>' + block.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';
    }
    html += '</div>';
    return html;
  }

  function sectionInnerHtml(vm, layout) {
    var html = '';
    vm.groups.forEach(function (group) {
      if (group.label) html += '<div class="cv-sub">' + esc(group.label) + '</div>';
      group.items.forEach(function (block, bi) {
        if (block.cite) {
          if (layout === 'left-dates') {
            html += '<div class="entry ld cite-ld"><div class="dcol">' + (group.numbered ? '[' + (bi + 1) + ']' : '') + '</div>' +
                    '<div class="econtent"><div class="cite nohang">' + runsToHtml(block.cite) + '</div></div></div>';
          } else {
            html += '<div class="cite">' + (group.numbered ? '[' + (bi + 1) + '] ' : '') + runsToHtml(block.cite) + '</div>';
          }
        } else {
          html += blockHtml(block, vm, layout);
        }
      });
    });
    return html;
  }

  function sideWidgetHtml(vm, widget) {
    var html = '';
    vm.groups.forEach(function (group) {
      group.items.forEach(function (block) {
        var wd = block.widgetData || {};
        if (widget === 'dots') {
          html += '<div class="lang-dot-row"><span class="ld-label">' + esc(wd.label || '') + '</span><span class="dots">';
          for (var i = 1; i <= 5; i++) html += '<span class="dot' + (i <= (wd.dots || 0) ? ' on' : '') + '"></span>';
          html += '</span></div>';
          if (wd.note) html += '<div class="ld-note">' + esc(wd.note) + '</div>';
        } else if (widget === 'bars') {
          html += '<div class="bar-row"><span class="bar-label">' + esc(wd.label || '') + '</span>' +
                  '<span class="bar"><span class="bar-fill" style="width:' + ((wd.dots || 3) * 20) + '%"></span></span>';
          if (wd.note) html += '<span class="bar-note">' + esc(wd.note) + '</span>';
          html += '</div>';
        } else if (widget === 'tags') {
          if (wd.label) html += '<div class="tag-label">' + esc(wd.label) + '</div>';
          html += '<div class="tags">' + (wd.items || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>';
        }
      });
    });
    return html;
  }

  function headingHtml(vm, spec) {
    if (spec.headingFirst3 && vm.title.length > 3) {
      return '<h2><span class="h-acc">' + esc(vm.title.slice(0, 3)) + '</span>' + esc(vm.title.slice(3)) + '<span class="hfill"></span></h2>';
    }
    return '<h2>' + esc(vm.title) + '</h2>';
  }

  function sectionHtml(vm, spec, opts) {
    opts = opts || {};
    var layout = opts.side ? 'single' : (spec.layout || 'single');
    var cls = 'cv-sec sec-' + vm.type + (opts.side ? ' in-side' : '');
    if (spec.refsTwoCol && vm.type === 'references') cls += ' refs-2col';
    var widget = opts.side && spec.sideWidgets && spec.sideWidgets[vm.type];
    var body = widget ? sideWidgetHtml(vm, widget) : sectionInnerHtml(vm, layout);
    return '<section class="' + cls + '">' + headingHtml(vm, spec) + body + '</section>';
  }

  function nameHtml(fullName, spec) {
    var name = M.trim(fullName);
    if (spec.nameStyle === 'two-tone' || spec.nameStyle === 'first-light' || spec.nameStyle === 'last-bold') {
      var parts = name.split(/\s+/);
      if (parts.length > 1) {
        var last = parts.pop();
        return '<span class="nm-first">' + esc(parts.join(' ')) + '</span> <span class="nm-last">' + esc(last) + '</span>';
      }
      return '<span class="nm-last">' + esc(name) + '</span>';
    }
    return esc(name);
  }

  /* CV 전체 → { html, className, accent, paper } */
  function renderCv(data, settings) {
    var s = M.normalizeSettings(settings);
    var spec = M.TEMPLATE_SPECS[s.template] || { layout: 'single' };
    var className = 'page tpl-' + s.template + ' layout-' + (spec.layout || 'single') +
      ' paper-' + (spec.paper || 'a4') + ' size-' + s.fontSize + ' density-' + (s.density || 'normal');
    var accent = s.accent || spec.accent || '#1f4e79';

    var p = data.personal || {};
    var html = '';
    var contactRows = M.contactItems(p, s);
    var contactSep = spec.contactSep || '  |  ';
    function contactHtml(it) {
      var inner = iconSvg(it.icon) + '<span>' + esc(it.text) + '</span>';
      // rel=noopener: 새 탭으로 열릴 때 opener 접근 차단
      return it.href
        ? '<a href="' + esc(it.href) + '" target="_blank" rel="noopener">' + inner + '</a>'
        : '<span class="cv-ci">' + inner + '</span>';
    }
    var hasHeader = M.trim(p.fullName) || M.trim(p.title) || contactRows.length;
    var photoCls = 'cv-photo' + (spec.photoShape === 'circle' ? ' round' : '') + (spec.photoShape === 'framed' ? ' framed' : '');
    var photoHtml = (spec.photo && p.photo) ? '<img class="' + photoCls + '" src="' + p.photo + '" alt="">' : '';

    var headerHtml = '';
    if (hasHeader || photoHtml) {
      // 헤더가 짙은 사이드바 안에 들어가는 템플릿(Cascade)은 강조색 링크가 배경에 묻히므로 흰색으로
      var linkCol = spec.headerIn === 'side' ? '#ffffff' : linkColor(accent);
      headerHtml += '<header class="cv-head' + (spec.contactRight ? ' head-split' : '') + '" style="--link:' + esc(linkCol) + '">';
      if (photoHtml) headerHtml += photoHtml;
      headerHtml += '<div class="cv-head-text">';
      if (M.trim(p.fullName)) headerHtml += '<h1 class="cv-name">' + nameHtml(p.fullName, spec) + '</h1>';
      if (M.trim(p.title)) headerHtml += '<p class="cv-title">' + esc(p.title) + '</p>';
      if (!spec.contactRight) {
        contactRows.forEach(function (items) {
          headerHtml += '<p class="cv-contact">' + items.map(contactHtml).join(esc(contactSep)) + '</p>';
        });
      }
      headerHtml += '</div>';
      if (spec.contactRight && contactRows.length) {
        headerHtml += '<div class="cv-head-contact">';
        contactRows.forEach(function (items) {
          items.forEach(function (it) { headerHtml += '<div>' + contactHtml(it) + '</div>'; });
        });
        headerHtml += '</div>';
      }
      headerHtml += '<hr class="cv-headrule">';
      headerHtml += '</header>';
    }

    var any = false;
    var mainParts = [], sideParts = [];
    (data.sections || []).forEach(function (sec) {
      var vm = M.sectionContent(sec, s);
      if (!vm) return;
      any = true;
      var isSide = spec.layout === 'sidebar' && (spec.side || []).indexOf(sec.type) >= 0;
      if (isSide) sideParts.push(sectionHtml(vm, spec, { side: true }));
      else mainParts.push(sectionHtml(vm, spec));
    });

    var headerInSide = spec.layout === 'sidebar' && spec.headerIn === 'side';
    if (!headerInSide) html += headerHtml;

    if (spec.layout === 'sidebar' && (sideParts.length || headerInSide)) {
      var sideHtml = (headerInSide ? headerHtml : '') + sideParts.join('');
      var colsCls = 'cols' + (spec.sideLeft ? ' side-left' : '');
      var mainDiv = '<div class="col-main">' + mainParts.join('') + '</div>';
      var sideDiv = '<div class="col-side">' + sideHtml + '</div>';
      html += '<div class="' + colsCls + '">' + (spec.sideLeft ? sideDiv + mainDiv : mainDiv + sideDiv) + '</div>';
    } else {
      html += mainParts.join('');
    }

    return { html: html, className: className, accent: accent, link: linkColor(accent), paper: spec.paper || 'a4', empty: !hasHeader && !any };
  }

  /* ---------- 페이지 분할 (편집기 미리보기 · 공개 페이지 공용) ----------
   * 실제 인쇄(PDF)는 여백 있는 여러 장으로 나오므로, 화면에서도 페이지 사이에
   * 위/아래 여백을 보여 준다. 인쇄 시 spacer는 @media print에서 숨겨진다.
   */
  function addPageMarkers(page, paperKey) {
    var paper = PAPER_PX[paperKey || 'a4'] || PAPER_PX.a4;
    var total = page.scrollHeight;
    for (var n = 1; n * paper.h < total - 40; n++) {
      var m = document.createElement('div');
      m.className = 'pagebreak-marker';
      m.style.top = (n * paper.h) + 'px';
      m.innerHTML = '<span>페이지 ' + n + ' 경계</span>';
      page.appendChild(m);
    }
  }

  // 인쇄와 비슷하게: 섹션의 (제목+첫 항목)은 함께 유지하고 둘째 항목부터 사이에서 나눈다.
  function paginate(page, paper) {
    var cs = getComputedStyle(page);
    var padTop = parseFloat(cs.paddingTop) || 0;
    var padBottom = parseFloat(cs.paddingBottom) || 0;
    var availH = paper.h - padTop - padBottom;
    if (availH < 220) return;
    if (page.scrollHeight <= paper.h + 2) return;   // 한 페이지면 분할 불필요

    function isSec(el) { return !!(el.classList && el.classList.contains('cv-sec')); }

    // 분할 지점: { before(이 요소 앞에서 나눔), test(넘침 판정 기준 요소) }
    var pts = [];
    Array.prototype.forEach.call(page.children, function (child) {
      if (!child.classList || child.classList.contains('pg-spacer') || child.classList.contains('pagebreak-marker')) return;
      if (isSec(child)) {
        var disp = getComputedStyle(child).display;
        var entries = Array.prototype.filter.call(child.children, function (gc) { return gc.tagName !== 'H2'; });
        if (/grid|flex/.test(disp) || entries.length <= 1) {
          pts.push({ before: child, test: child });                 // 통째로
        } else {
          pts.push({ before: child, test: entries[0] });            // 제목+첫 항목이 안 들어가면 통째로 넘김
          for (var k = 1; k < entries.length; k++) pts.push({ before: entries[k], test: entries[k] });
        }
      } else {
        pts.push({ before: child, test: child });
      }
    });

    var GUTTER = 26;
    var pageTop = page.getBoundingClientRect().top;
    var curBottom = pageTop + padTop + availH;
    var firstOnPage = 0, pageNo = 1, guard = 0;

    function bottomAfter(before, topY) {
      var b = topY + availH;
      if (!isSec(before)) {   // 섹션은 내부 항목이 따로 분할되므로 그대로, 리프만 넘김 처리
        var bot = before.getBoundingClientRect().bottom, g = 0;
        while (bot > b + 0.5 && g++ < 40) b += availH;
      }
      return b;
    }

    for (var i = 0; i < pts.length && guard < 80; i++) {
      var p = pts[i];
      var tr = p.test.getBoundingClientRect();
      if (tr.height === 0) continue;
      if (tr.bottom <= curBottom + 0.5) continue;
      if (i === firstOnPage) {
        curBottom = bottomAfter(p.before, p.before.getBoundingClientRect().top);
        firstOnPage = i + 1; continue;
      }
      guard++;
      var br = p.before.getBoundingClientRect();
      var h = (curBottom + padBottom + GUTTER + padTop) - br.top;
      if (h < GUTTER + 8) h = GUTTER + 8;
      var grayEnd = Math.max(padTop + 2, Math.min(h - 2, h - padTop));
      var whiteBot = Math.max(0, Math.min(grayEnd - 2, h - GUTTER - padTop));
      var spacer = document.createElement('div');
      spacer.className = 'pg-spacer';
      spacer.style.height = h + 'px';
      spacer.style.background = 'linear-gradient(to bottom, #fff 0, #fff ' + whiteBot + 'px, #e9ecf1 ' + whiteBot + 'px, #e9ecf1 ' + grayEnd + 'px, #fff ' + grayEnd + 'px, #fff 100%)';
      var lbl = document.createElement('div');
      lbl.className = 'pg-gaplabel';
      lbl.style.top = ((whiteBot + grayEnd) / 2) + 'px';
      lbl.textContent = '페이지 경계 (' + pageNo + ' → ' + (pageNo + 1) + ')';
      spacer.appendChild(lbl);
      p.before.parentNode.insertBefore(spacer, p.before);
      pageNo++;
      curBottom = bottomAfter(p.before, p.before.getBoundingClientRect().top);
      firstOnPage = i;
    }
  }

  // 배율을 지운 상태에서 측정 → 분할. 호출한 쪽이 이어서 배율을 적용한다.
  function layoutPages(page, paperKey, isEmpty) {
    if (!page) return;
    page.style.transform = '';
    Array.prototype.forEach.call(page.querySelectorAll('.pg-spacer, .pagebreak-marker'), function (n) { n.remove(); });
    if (isEmpty) return;
    // 2단(사이드바) 레이아웃은 열 분할이 어려워 경계선만 표시
    if (page.querySelector('.cols')) addPageMarkers(page, paperKey);
    else paginate(page, PAPER_PX[paperKey || 'a4'] || PAPER_PX.a4);
  }

  // 원형 크롭 (Word 내보내기용, AltaCV 등)
  function circledPhoto(dataUrl) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        try {
          var sz = Math.min(img.naturalWidth, img.naturalHeight);
          var cv = document.createElement('canvas');
          cv.width = sz; cv.height = sz;
          var ctx = cv.getContext('2d');
          ctx.beginPath(); ctx.arc(sz / 2, sz / 2, sz / 2, 0, Math.PI * 2); ctx.clip();
          ctx.drawImage(img, (img.naturalWidth - sz) / 2, (img.naturalHeight - sz) / 2, sz, sz, 0, 0, sz, sz);
          resolve({ dataUrl: cv.toDataURL('image/png'), size: sz });
        } catch (e) { resolve(null); }
      };
      img.onerror = function () { resolve(null); };
      img.src = dataUrl;
    });
  }

  return {
    PAPER_PX: PAPER_PX, esc: esc, runsToHtml: runsToHtml, renderCv: renderCv,
    layoutPages: layoutPages, circledPhoto: circledPhoto
  };
});
