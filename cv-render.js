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
      var t = esc(it.text);
      // rel=noopener: 새 탭으로 열릴 때 opener 접근 차단
      return it.href ? '<a href="' + esc(it.href) + '" target="_blank" rel="noopener">' + t + '</a>' : t;
    }
    var hasHeader = M.trim(p.fullName) || M.trim(p.title) || contactRows.length;
    var photoCls = 'cv-photo' + (spec.photoShape === 'circle' ? ' round' : '') + (spec.photoShape === 'framed' ? ' framed' : '');
    var photoHtml = (spec.photo && p.photo) ? '<img class="' + photoCls + '" src="' + p.photo + '" alt="">' : '';

    var headerHtml = '';
    if (hasHeader || photoHtml) {
      headerHtml += '<header class="cv-head' + (spec.contactRight ? ' head-split' : '') + '">';
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

    return { html: html, className: className, accent: accent, paper: spec.paper || 'a4', empty: !hasHeader && !any };
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

  return { PAPER_PX: PAPER_PX, esc: esc, runsToHtml: runsToHtml, renderCv: renderCv, circledPhoto: circledPhoto };
});
