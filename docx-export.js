/* =========================================================================
 * docx-export.js — 뷰모델 → Word(.docx) 문서 생성 (docx 라이브러리 사용)
 * 실존 양식 8종 재현. 상수는 공식 가이드/소스 코드 실측값 기반:
 *   Harvard GSAS 2025 가이드(실측), moderncv v2.6.1, Awesome-CV, AltaCV v1.7.4
 * 레이아웃 엔진: single / left-dates(ModernCV) / sidebar(AltaCV) / left-labels(Europass)
 * UMD: 브라우저에서는 window.CVDocx, Node에서는 module.exports
 * ========================================================================= */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('docx'), require('./cv-model.js'));
  } else {
    root.CVDocx = factory(root.docx, root.CVModel);
  }
})(typeof self !== 'undefined' ? self : this, function (docx, M) {
  'use strict';

  var Document = docx.Document, Paragraph = docx.Paragraph, TextRun = docx.TextRun,
      Tab = docx.Tab, AlignmentType = docx.AlignmentType, BorderStyle = docx.BorderStyle,
      TabStopType = docx.TabStopType, ShadingType = docx.ShadingType, Packer = docx.Packer,
      Table = docx.Table, TableRow = docx.TableRow, TableCell = docx.TableCell,
      WidthType = docx.WidthType, TableLayoutType = docx.TableLayoutType,
      VerticalAlign = docx.VerticalAlign, ImageRun = docx.ImageRun,
      Header = docx.Header, Footer = docx.Footer, PageNumber = docx.PageNumber,
      LevelFormat = docx.LevelFormat;

  var PAPERS = {
    a4: { w: 11906, h: 16838 },
    letter: { w: 12240, h: 15840 }
  };
  var NO_B = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  var NO_BORDERS = { top: NO_B, bottom: NO_B, left: NO_B, right: NO_B, insideHorizontal: NO_B, insideVertical: NO_B };

  /* ---------- 템플릿별 Word 설정 (실측 기반) ---------- */
  var DTPL = {
    // Harvard GSAS 2025 가이드 Sample #1 실측: Times 11pt, 이름 16pt 굵은 대문자 중앙,
    // 섹션 = 본문 크기 굵은 대문자 '중앙', 선 없음, 순수 검정, 하이픈 불릿, 2쪽부터 이름+쪽번호
    harvard: {
      font: 'Times New Roman', margin: 1080,
      header: { align: 'center', nameCaps: true, nameBold: true, nameSize: 32, titleItalic: false, rule: null },
      heading: { caps: true, bold: true, align: 'center', dsize: 0, accent: false, border: 'none' },
      date: { italic: false, accent: false },
      bulletDash: true, citeHang: false, pageHeader: true
    },
    // moderncv classic (v2.6.1 소스): 이름 34pt 일반 굵기 투톤(#B9B9B9/#737373), 연락처 오른쪽 상단,
    // 섹션 = 14.4pt 일반 굵기 #3873B3 + 힌트 열의 파란 바, 날짜는 왼쪽 힌트 열
    moderncv: {
      font: 'Calibri', margin: 1360,
      header: { align: 'left', nameSize: 54, nameTwoTone: { firstColor: 'B9B9B9', lastColor: '737373', firstBold: false, lastBold: false }, titleItalic: true, titleColor: '737373', contactRight: true, rule: null },
      heading: { caps: false, bold: false, dsize: 7, accent: true, border: 'hint-bar' },
      date: { italic: false, accent: false },
      dateColW: 1720, citeHang: true
    },
    // Awesome-CV (소스): 이름 32pt 가는 회색 이름+굵은 진회색 성, 직함 스몰캡스 강조색,
    // 섹션 16pt 굵게 첫 3글자 강조색 + 회색 밑줄, 기관 굵게/지역 강조색 이탤릭, 푸터
    awesome: {
      font: 'Calibri', margin: 1134,
      header: { align: 'center', nameSize: 58, nameTwoTone: { firstColor: '5D5D5D', lastColor: '333333', firstBold: false, lastBold: true }, titleSC: true, titleAccent: true, rule: null },
      heading: { caps: false, bold: true, dsize: 9, accent: false, first3Accent: true, border: 'single', borderSize: 7, borderColor: '5D5D5D' },
      date: { italic: true, accent: false, color: '5D5D5D' },
      tightScale: 0.85, citeHang: true, footer: true
    },
    // AltaCV v1.7.4 (샘플 배색): 여백 1.25cm/1.5cm, 사이드바 오른쪽 40%, 제목 대문자 #450808 + 금색 2pt 밑줄,
    // 항목: 직함 일반/기관 굵게 강조색/날짜·지역 작게, 점선 구분선
    altacv: {
      font: 'Calibri', margin: 709, marginTB: 850,
      header: { align: 'left', nameCaps: true, nameBold: true, nameSize: 48, titleBoldAccent: true, rule: null },
      heading: { caps: true, bold: true, dsize: 6, accent: true, border: 'single', borderSize: 16, borderColor: 'E7D192' },
      date: { italic: false, accent: false },
      sidebarW: 3480, gapW: 500, dividers: true, citeHang: true
    },
    // Europass 2020+ Formal (공식 colors.css 실측): 회색 헤더 밴드, 이름/제목 #565656 ExtraBold,
    // 대문자 섹션 + 1pt #979797 밑줄, Open Sans → Segoe UI
    europass: {
      font: 'Segoe UI', margin: 1134,
      header: { align: 'left', nameBold: true, nameColor: '565656', nameSize: 36, rule: { size: 14, color: '979797' }, headBand: 'F5F5F5' },
      heading: { caps: true, bold: true, dsize: 1, accent: false, color: '444444', border: 'single', borderSize: 6, borderColor: '979797' },
      date: { italic: false, accent: false },
      citeHang: true
    },
    // 월가 IB/컨설팅 표준 (WSO/M&I 공식 샘플 실측): 이름 ~19pt 일반 굵기 중앙, Times 10pt,
    // 대문자 섹션 + 전체 폭 밑줄, 기관 굵게/직함 이탤릭, 매우 촘촘
    banking: {
      font: 'Times New Roman', margin: 1080,
      header: { align: 'center', nameBold: false, nameSize: 38, rule: null },
      heading: { caps: true, bold: true, dsize: 1, accent: false, border: 'single', borderSize: 6, borderColor: '000000' },
      date: { italic: false, accent: false },
      tightScale: 0.7, citeHang: false
    },
    // Jake's Resume (jakegut/resume 실측): 0.5in 여백, 스몰캡스 굵은 이름, 스몰캡스 섹션 + 얇은 선
    jake: {
      font: 'Cambria', margin: 720,
      header: { align: 'center', nameBold: true, nameSC: true, nameSize: 48, rule: null },
      heading: { caps: false, bold: false, smallCaps: true, dsize: 3, accent: false, border: 'single', borderSize: 4, borderColor: '000000' },
      date: { italic: false, accent: false },
      tightScale: 0.85, citeHang: true
    },
    // Resume.io Stockholm (실측): 2단 화이트, 차콜 이름/제목, 직함만 강조색, 스킬 언더라인 바
    stockholm: {
      font: 'Calibri', margin: 1134,
      header: { align: 'left', nameBold: true, nameColor: '2B2E33', nameSize: 46, titleAccent: true, rule: null },
      heading: { caps: false, bold: true, dsize: 3, accent: false, color: '2B2E33', border: 'none' },
      date: { italic: false, accent: false, color: '999999' },
      sidebarW: 2960, gapW: 420, citeHang: true
    },
    // Zety Cascade (실측): 네이비 사이드바(이름·인적사항·스킬) + 흰 본문, 촘촘
    cascade: {
      font: 'Calibri', margin: 850,
      header: { align: 'left', nameBold: true, nameSize: 40, rule: null },
      heading: { caps: false, bold: true, dsize: 4, accent: true, border: 'single', borderSize: 4, borderColor: 'DDDDDD' },
      date: { italic: false, accent: false, color: '777777' },
      sidebarW: 3280, gapW: 380, sideDark: true, tightScale: 0.9, citeHang: true
    },
    // Canva 계열 대표 미학: 연회색 사이드바, 자간 넓은 대문자 이름, 얇은 회색 구분선
    canva: {
      font: 'Calibri', margin: 1000,
      header: { align: 'left', nameBold: true, nameCaps: true, nameSize: 40, nameCharSpace: true, rule: { size: 4, color: 'C9CED6' } },
      heading: { caps: true, bold: true, dsize: 2, accent: false, color: '37474F', charSpace: true, border: 'single', borderSize: 4, borderColor: 'C9CED6' },
      date: { italic: false, accent: false, color: '8A9199' },
      sidebarW: 3100, gapW: 400, sidebarFill: 'F0F2F5', citeHang: true
    }
  };

  // half-point 단위 (20 = 10pt)
  var SIZES = {
    small:  { base: 19, title: 21, meta: 17 },
    medium: { base: 21, title: 23, meta: 19 },
    large:  { base: 22, title: 24, meta: 20 }
  };
  var DENSITY = { compact: 0.68, normal: 1, relaxed: 1.35 };

  function hex(accent, fallback) {
    var m = /^#?([0-9a-fA-F]{6})$/.exec(M.trim(accent || ''));
    return m ? m[1].toUpperCase() : (fallback || '000000');
  }

  var RUN_COLORS = { muted: '5D5D5D', light: '999999' };

  // 어두운 배경 등에서 색을 강제로 통일할 때 forceColor 사용
  function runsToDocx(o, runs, extra) {
    extra = extra || {};
    return (runs || []).map(function (r) {
      var color = extra.color;
      if (r.c === 'accent') color = o.accent;
      else if (r.c && RUN_COLORS[r.c]) color = RUN_COLORS[r.c];
      if (extra.forceColor) color = extra.forceColor;
      var size = extra.size || o.sz.base;
      if (r.sz === 'small') size = o.sz.meta;
      else if (r.sz === 'big') size = o.sz.base + 3;
      return new TextRun({
        text: r.t, bold: !!r.b || !!extra.bold, italics: !!r.i || !!extra.italics,
        smallCaps: !!r.sc, size: size, color: color, font: extra.font
      });
    });
  }

  function dataUrlToImage(dataUrl) {
    var m = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(dataUrl || '');
    if (!m) return null;
    var b64 = m[2];
    var bin = (typeof atob === 'function') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { type: m[1] === 'png' ? 'png' : 'jpg', data: bytes };
  }

  function photoRun(p, targetW, maxH) {
    var img = dataUrlToImage(p.photo);
    if (!img) return null;
    var w = targetW, h = Math.round(targetW * 1.25);
    if (p.photoW && p.photoH) {
      h = Math.round(targetW * p.photoH / p.photoW);
      if (h > maxH) { h = maxH; w = Math.round(maxH * p.photoW / p.photoH); }
    }
    return new ImageRun({ type: img.type, data: img.data, transformation: { width: w, height: h } });
  }

  /* ---------- 문서 상태(옵션) 객체 ---------- */
  function makeCtx(data, settings) {
    var s = M.normalizeSettings(settings);
    var spec = M.TEMPLATE_SPECS[s.template];
    var cfg = DTPL[s.template];
    var sz = SIZES[s.fontSize] || SIZES.medium;
    var m = DENSITY[s.density] || 1;
    if (cfg.tightScale) m *= cfg.tightScale;
    var paper = PAPERS[spec.paper] || PAPERS.a4;
    var margin = cfg.margin || 1134;
    return {
      s: s, spec: spec, cfg: cfg, sz: sz,
      paper: paper, margin: margin, marginTB: cfg.marginTB || margin,
      contentW: paper.w - margin * 2,
      accent: hex(s.accent, hex(spec.accent)),
      sp: {
        line: Math.round(20 * m),
        block: Math.round(110 * m),
        tight: Math.round(40 * m),
        headBefore: Math.round(220 * m),
        headAfter: Math.round(90 * m),
        cite: Math.round(80 * m)
      },
      boldName: s.boldName
    };
  }

  /* ---------- 공통 조각 ---------- */
  function headingParagraph(o, title, opts) {
    opts = opts || {};
    var h = o.cfg.heading;
    var color = opts.color || h.color || (h.accent ? o.accent : '000000');
    var size = opts.size || (o.sz.base + (h.dsize || 0));
    var text = h.caps ? String(title).toUpperCase() : String(title);
    var border;
    if (h.border === 'single') {
      border = { bottom: { color: h.borderColor === 'accent' ? o.accent : (h.borderColor || (h.accent ? o.accent : '000000')), space: 2, style: BorderStyle.SINGLE, size: h.borderSize || 6 } };
    }
    var children;
    if (h.first3Accent && text.length > 3) {
      children = [
        new TextRun({ text: text.slice(0, 3), bold: h.bold !== false, size: size, color: o.accent }),
        new TextRun({ text: text.slice(3), bold: h.bold !== false, size: size, color: '333333' })
      ];
    } else {
      children = [new TextRun({
        text: text, bold: h.bold !== false, size: size, color: color,
        smallCaps: !!h.smallCaps, characterSpacing: h.charSpace ? 20 : undefined
      })];
    }
    return new Paragraph({
      alignment: h.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before: opts.first ? Math.round(o.sp.headBefore * 0.4) : o.sp.headBefore, after: o.sp.headAfter },
      border: border,
      children: children
    });
  }

  function subheadingParagraph(o, label) {
    return new Paragraph({
      spacing: { before: Math.round(o.sp.tight * 2), after: Math.round(o.sp.tight) },
      children: [new TextRun({ text: label, bold: true, italics: true, size: o.sz.base, color: '333333' })]
    });
  }

  function citeParagraph(o, block, numbered, num) {
    var runs = [];
    if (numbered) runs.push(new TextRun({ text: '[' + num + '] ', size: o.sz.base }));
    runs = runs.concat(runsToDocx(o, block.cite));
    return new Paragraph({
      children: runs,
      indent: o.cfg.citeHang ? { left: 360, hanging: 360 } : undefined,
      spacing: { after: o.sp.cite }
    });
  }

  function dividerParagraph(o, width) {
    return new Paragraph({
      spacing: { before: 20, after: Math.round(o.sp.block * 0.7) },
      border: { bottom: { color: 'D1D1D1', space: 1, style: BorderStyle.DASHED, size: 5 } },
      children: []
    });
  }

  /* 일반 블록 → 문단 배열 */
  function blockParagraphs(o, block, opts) {
    opts = opts || {};
    var out = [];
    var lines = block.lines || [];
    var bullets = block.bullets || [];
    var strippedOnce = false;
    lines.forEach(function (line, li) {
      var children = runsToDocx(o, line.left, { forceColor: opts.textColor });
      var hasRight = line.right && line.right.length;
      if (hasRight && opts.stripFirstRight && !strippedOnce) { hasRight = false; strippedOnce = true; }
      if (hasRight) {
        children.push(new TextRun({ children: [new Tab()] }));
        children = children.concat(runsToDocx(o, line.right, {
          size: o.sz.meta,
          color: opts.textColor ? 'D3DEE9' : (o.cfg.date.color || (o.cfg.date.accent ? o.accent : '555555')),
          forceColor: opts.textColor ? 'D3DEE9' : undefined,
          italics: o.cfg.date.italic
        }));
      }
      var isLastLine = li === lines.length - 1 && !bullets.length;
      out.push(new Paragraph({
        children: children,
        tabStops: hasRight ? [{ type: TabStopType.RIGHT, position: opts.tabPos || o.contentW }] : undefined,
        spacing: { after: isLastLine ? (opts.tight ? o.sp.tight : (opts.isLastBlock ? o.sp.tight : o.sp.block)) : o.sp.line }
      }));
    });
    bullets.forEach(function (b, ii) {
      var lastBullet = ii === bullets.length - 1;
      out.push(new Paragraph({
        children: [new TextRun({ text: b, size: o.sz.base, color: opts.textColor })],
        bullet: o.cfg.bulletDash ? undefined : { level: 0 },
        numbering: o.cfg.bulletDash ? { reference: 'cv-dash', level: 0 } : undefined,
        spacing: { after: lastBullet ? (opts.isLastBlock ? o.sp.tight : o.sp.block) : o.sp.line }
      }));
    });
    return out;
  }

  /* 섹션 내용(그룹+블록) → 문단 배열 (single 계열) */
  function sectionBodyParagraphs(o, vm, opts) {
    opts = opts || {};
    var out = [];
    var useDividers = o.cfg.dividers && !vm.tight && !opts.noDividers;
    vm.groups.forEach(function (group) {
      if (group.label) out.push(subheadingParagraph(o, group.label));
      group.items.forEach(function (block, bi) {
        var isLast = bi === group.items.length - 1;
        if (block.cite) { out.push(citeParagraph(o, block, group.numbered, bi + 1)); return; }
        out = out.concat(blockParagraphs(o, block, {
          tabPos: opts.tabPos, tight: vm.tight, isLastBlock: isLast, textColor: opts.textColor
        }));
        if (useDividers && !isLast) out.push(dividerParagraph(o));
      });
    });
    return out;
  }

  /* 추천인 2단 배치 (Harvard 샘플의 나란한 연락처 블록) */
  function referencesTwoColumn(o, vm) {
    var blocks = [];
    vm.groups.forEach(function (g) { g.items.forEach(function (b) { if (b.lines) blocks.push(b); }); });
    if (blocks.length < 2) return sectionBodyParagraphs(o, vm, { tabPos: o.contentW });
    var half = o.contentW / 2;
    var rows = [];
    for (var i = 0; i < blocks.length; i += 2) {
      var cells = [blocks[i], blocks[i + 1]].map(function (b) {
        var paras = b ? (b.lines || []).map(function (line, li) {
          return new Paragraph({
            children: runsToDocx(o, line.left),
            spacing: { after: li === b.lines.length - 1 ? o.sp.block : o.sp.line }
          });
        }) : [new Paragraph({ children: [] })];
        return new TableCell({
          width: { size: half, type: WidthType.DXA }, borders: NO_BORDERS,
          margins: { top: 0, bottom: 0, left: 0, right: 200 },
          children: paras
        });
      });
      rows.push(new TableRow({ children: cells }));
    }
    return [
      new Table({
        width: { size: o.contentW, type: WidthType.DXA }, columnWidths: [half, half],
        borders: NO_BORDERS, layout: TableLayoutType.FIXED, rows: rows
      }),
      new Paragraph({ children: [], spacing: { after: 0 } })
    ];
  }

  /* ---------- 헤더 (이름/직함/연락처/사진) ---------- */
  function nameRunsDocx(o, fullName, forceColor) {
    var h = o.cfg.header;
    var size = h.nameSize || 44;
    var name = M.trim(fullName);
    if (h.nameCaps) name = name.toUpperCase();
    if (h.nameTwoTone && !forceColor) {
      var tt = h.nameTwoTone;
      var parts = name.split(/\s+/);
      if (parts.length > 1) {
        var last = parts.pop();
        return [
          new TextRun({ text: parts.join(' ') + ' ', bold: !!tt.firstBold, size: size, color: tt.firstColor }),
          new TextRun({ text: last, bold: !!tt.lastBold, size: size, color: tt.lastColor })
        ];
      }
      return [new TextRun({ text: name, bold: !!tt.lastBold, size: size, color: tt.lastColor })];
    }
    return [new TextRun({
      text: name, bold: h.nameBold !== false, size: size, smallCaps: !!h.nameSC,
      characterSpacing: h.nameCharSpace ? 40 : undefined,
      color: forceColor || h.nameColor || (h.nameAccent ? o.accent : '000000')
    })];
  }

  // 색 어둡게 (f < 1)
  function shadeHex(hex6, f) {
    var n = parseInt(hex6, 16);
    var r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    var s = ((r << 16) | (g << 8) | b).toString(16);
    while (s.length < 6) s = '0' + s;
    return s.toUpperCase();
  }

  function contactSep(o) { return o.cfg.header.contactSep || '  |  '; }

  function headBand(o) {
    return o.cfg.header.headBand ? { type: ShadingType.CLEAR, fill: o.cfg.header.headBand } : undefined;
  }

  function contactParagraphs(o, p, align, small) {
    var sep = contactSep(o);
    return M.contactLines(p).map(function (line) {
      return new Paragraph({
        alignment: align, spacing: { after: 30 }, shading: headBand(o),
        children: [new TextRun({
          text: sep === '  |  ' ? line : line.split('  |  ').join(sep),
          size: small ? o.sz.meta - 1 : o.sz.meta,
          color: '444444', italics: !!o.cfg.header.contactItalic
        })]
      });
    });
  }

  function headerTextParagraphs(o, p, align) {
    var h = o.cfg.header;
    var out = [];
    if (M.trim(p.fullName)) {
      out.push(new Paragraph({ alignment: align, spacing: { after: 40 }, shading: headBand(o), children: nameRunsDocx(o, p.fullName) }));
    }
    if (M.trim(p.title)) {
      out.push(new Paragraph({
        alignment: align, spacing: { after: 60 }, shading: headBand(o),
        children: [new TextRun({
          text: M.trim(p.title), italics: !!h.titleItalic, smallCaps: !!h.titleSC,
          size: h.titleSC ? o.sz.meta : o.sz.title, bold: !!h.titleBoldAccent,
          color: h.titleBoldAccent || h.titleAccent ? o.accent : (h.titleColor || '333333')
        })]
      }));
    }
    return out;
  }

  function headerChildren(o, p) {
    var h = o.cfg.header;
    var align = h.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT;
    var out = [];
    var img = (o.spec.photo && o.spec.photoIn === 'head' && p.photo)
      ? photoRun(p, o.spec.photoSize || (o.spec.photoShape === 'circle' ? 106 : 96), o.spec.photoSize ? Math.round(o.spec.photoSize * 1.1) : 132)
      : null;

    if (h.contactRight) {
      // moderncv: 이름·직함 왼쪽 / 연락처 오른쪽 / (선택) 액자형 사진 맨 오른쪽
      var photoW = img ? 1700 : 0;
      var leftW = Math.round((o.contentW - photoW) * 0.58), rightW = o.contentW - leftW - photoW;
      var cells = [
        new TableCell({
          width: { size: leftW, type: WidthType.DXA }, borders: NO_BORDERS,
          children: headerTextParagraphs(o, p, AlignmentType.LEFT)
        }),
        new TableCell({
          width: { size: rightW, type: WidthType.DXA }, borders: NO_BORDERS,
          verticalAlign: VerticalAlign.BOTTOM,
          children: M.contactLines(p).map(function (line) {
            return new Paragraph({
              alignment: AlignmentType.RIGHT, spacing: { after: 20 },
              children: line.split('  |  ').map(function (piece, i) {
                return new TextRun({ text: (i ? ' · ' : '') + piece, size: o.sz.meta - 1, color: '737373', italics: true });
              })
            });
          })
        })
      ];
      var widths = [leftW, rightW];
      if (img) {
        // moderncv 공식 사진: 강조색 얇은 액자 (셀 테두리로 재현)
        var FRAME = { style: BorderStyle.SINGLE, size: 6, color: o.accent };
        cells.push(new TableCell({
          width: { size: photoW, type: WidthType.DXA },
          borders: { top: FRAME, bottom: FRAME, left: FRAME, right: FRAME },
          margins: { top: 40, bottom: 40, left: 40, right: 40 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [img] })]
        }));
        widths.push(photoW);
      }
      out.push(new Table({
        width: { size: o.contentW, type: WidthType.DXA }, columnWidths: widths,
        borders: NO_BORDERS, layout: TableLayoutType.FIXED,
        rows: [new TableRow({ children: cells })]
      }));
      out.push(new Paragraph({ children: [], spacing: { after: Math.round(o.sp.block * 0.8) } }));
      return out;
    }

    if (img) {
      // 사진 위치: 기본 오른쪽, Awesome-CV는 왼쪽 (원본 클래스의 photo 옵션)
      var photoLeft = o.spec.photoSide === 'left';
      var pcw = 1800;
      var textW = o.contentW - pcw;
      var textCell = new TableCell({
        width: { size: textW, type: WidthType.DXA }, borders: NO_BORDERS,
        verticalAlign: VerticalAlign.CENTER,
        shading: headBand(o),
        children: headerTextParagraphs(o, p, align).concat(contactParagraphs(o, p, align))
      });
      var photoCell = new TableCell({
        width: { size: pcw, type: WidthType.DXA }, borders: NO_BORDERS,
        verticalAlign: VerticalAlign.CENTER,
        shading: headBand(o),
        children: [new Paragraph({
          alignment: photoLeft ? AlignmentType.LEFT : AlignmentType.RIGHT,
          shading: headBand(o), children: [img]
        })]
      });
      out.push(new Table({
        width: { size: o.contentW, type: WidthType.DXA },
        columnWidths: photoLeft ? [pcw, textW] : [textW, pcw],
        borders: NO_BORDERS, layout: TableLayoutType.FIXED,
        rows: [new TableRow({ children: photoLeft ? [photoCell, textCell] : [textCell, photoCell] })]
      }));
      out.push(new Paragraph({ children: [], spacing: { after: 20 } }));
    } else {
      out = out.concat(headerTextParagraphs(o, p, align)).concat(contactParagraphs(o, p, align));
    }

    if (h.rule) {
      out.push(new Paragraph({
        spacing: { after: Math.round(o.sp.block * 0.9) },
        border: { bottom: { color: h.rule.color || (h.rule.accent ? o.accent : '000000'), space: 2, style: BorderStyle.SINGLE, size: h.rule.size } },
        children: []
      }));
    } else {
      out.push(new Paragraph({ children: [], spacing: { after: Math.round(o.sp.tight) } }));
    }
    return out;
  }

  /* ---------- 레이아웃 엔진 ---------- */

  // 1) 단일 컬럼
  function engineSingle(o, data) {
    var children = [];
    var first = true;
    (data.sections || []).forEach(function (section) {
      var vm = M.sectionContent(section, o.s);
      if (!vm) return;
      children.push(headingParagraph(o, vm.title, { first: first }));
      first = false;
      if (o.spec.refsTwoCol && vm.type === 'references') {
        children = children.concat(referencesTwoColumn(o, vm));
      } else {
        children = children.concat(sectionBodyParagraphs(o, vm, { tabPos: o.contentW }));
      }
    });
    return children;
  }

  // 2) 왼쪽 날짜/힌트 열 (ModernCV)
  function engineLeftDates(o, data) {
    var children = [];
    var dcw = o.cfg.dateColW || 1720;
    var gap = 240;
    var ccw = o.contentW - dcw - gap;
    var first = true;

    function hintRow(hintChildren, contentChildren) {
      return new TableRow({
        children: [
          new TableCell({
            width: { size: dcw, type: WidthType.DXA }, borders: NO_BORDERS,
            children: hintChildren
          }),
          new TableCell({
            width: { size: gap, type: WidthType.DXA }, borders: NO_BORDERS,
            children: [new Paragraph({ children: [] })]
          }),
          new TableCell({
            width: { size: ccw, type: WidthType.DXA }, borders: NO_BORDERS,
            children: contentChildren
          })
        ]
      });
    }

    (data.sections || []).forEach(function (section) {
      var vm = M.sectionContent(section, o.s);
      if (!vm) return;
      var rows = [];

      // 섹션 제목 행: 힌트 열의 파란 바 + 제목 (moderncv 시그니처)
      rows.push(hintRow(
        [new Paragraph({
          spacing: { before: first ? 60 : o.sp.headBefore, after: 0 },
          border: { bottom: { color: o.accent, space: 1, style: BorderStyle.SINGLE, size: 36 } },
          children: []
        })],
        [new Paragraph({
          spacing: { before: first ? 0 : Math.round(o.sp.headBefore * 0.7), after: o.sp.headAfter },
          children: [new TextRun({ text: vm.title, bold: false, size: o.sz.base + (o.cfg.heading.dsize || 7), color: o.accent })]
        })]
      ));
      first = false;

      vm.groups.forEach(function (group) {
        if (group.label) {
          rows.push(hintRow([new Paragraph({ children: [] })], [subheadingParagraph(o, group.label)]));
        }
        group.items.forEach(function (block, bi) {
          var isLast = bi === group.items.length - 1;
          if (block.cite) {
            // moderncv 서지: [n] 라벨을 힌트 열에 오른쪽 정렬
            rows.push(hintRow(
              [new Paragraph({
                alignment: AlignmentType.RIGHT, spacing: { after: o.sp.cite },
                children: group.numbered ? [new TextRun({ text: '[' + (bi + 1) + ']', size: o.sz.base })] : []
              })],
              [new Paragraph({ children: runsToDocx(o, block.cite), spacing: { after: o.sp.cite } })]
            ));
            return;
          }
          var dateRuns = null;
          for (var i = 0; i < (block.lines || []).length; i++) {
            var r = block.lines[i].right;
            if (r && r.length) { dateRuns = r; break; }
          }
          rows.push(hintRow(
            [new Paragraph({
              alignment: AlignmentType.RIGHT, spacing: { after: o.sp.line },
              children: dateRuns ? runsToDocx(o, dateRuns, { size: o.sz.meta }) : []
            })],
            blockParagraphs(o, block, { stripFirstRight: true, tight: vm.tight, isLastBlock: isLast, tabPos: ccw - 200 })
          ));
        });
      });

      children.push(new Table({
        width: { size: o.contentW, type: WidthType.DXA },
        columnWidths: [dcw, gap, ccw],
        borders: NO_BORDERS, layout: TableLayoutType.FIXED,
        rows: rows
      }));
      children.push(new Paragraph({ children: [], spacing: { after: Math.round(o.sp.tight * 0.5) } }));
    });
    return children;
  }

  // 3) 사이드바: AltaCV(오른쪽 화이트) / Stockholm(오른쪽 화이트) / Cascade(왼쪽 네이비, 헤더 포함)
  function engineSidebar(o, data, p) {
    var sideW = o.cfg.sidebarW || 3480;
    var gap = o.cfg.gapW || 500;
    var mainW = o.contentW - sideW - gap;
    var sideTypes = o.spec.side || [];
    var widgets = o.spec.sideWidgets || {};
    var dark = !!o.cfg.sideDark;
    var sideText = dark ? 'FFFFFF' : undefined;
    var sideTab = sideW - (dark ? 480 : 260);

    var mainKids = [], sideKids = [];
    var firstMain = true, firstSide = true;

    function sideHeading(title) {
      if (dark) {
        // Cascade: 사이드바 폭의 더 어두운 밴드 위 흰 제목
        return new Paragraph({
          spacing: { before: firstSide ? 60 : o.sp.headBefore, after: o.sp.headAfter },
          shading: { type: ShadingType.CLEAR, fill: shadeHex(o.accent, 0.72) },
          children: [new TextRun({ text: title, bold: true, size: o.sz.base + 1, color: 'FFFFFF' })]
        });
      }
      return headingParagraph(o, title, { first: firstSide, size: o.sz.base + 2 });
    }

    // Cascade: 사진 + 이름/직함/연락처를 사이드바 상단에
    if (o.spec.photoIn === 'side' && p.photo) {
      var img = photoRun(p, 110, 140);
      if (img) {
        sideKids.push(new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 60, after: o.sp.block },
          children: [img]
        }));
      }
    }
    if (o.spec.headerIn === 'side') {
      if (M.trim(p.fullName)) {
        sideKids.push(new Paragraph({ spacing: { after: 40 }, children: nameRunsDocx(o, p.fullName, 'FFFFFF') }));
      }
      if (M.trim(p.title)) {
        sideKids.push(new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: M.trim(p.title), size: o.sz.title - 2, color: 'E8EEF5' })]
        }));
      }
      M.contactLines(p).forEach(function (line) {
        line.split('  |  ').forEach(function (piece) {
          sideKids.push(new Paragraph({
            spacing: { after: 20 },
            children: [new TextRun({ text: piece, size: o.sz.meta - 1, color: 'D3DEE9' })]
          }));
        });
      });
      firstSide = false;
    }

    (data.sections || []).forEach(function (section) {
      var vm = M.sectionContent(section, o.s);
      if (!vm) return;
      var isSide = sideTypes.indexOf(section.type) >= 0;
      if (isSide) {
        sideKids.push(sideHeading(vm.title));
        firstSide = false;
        if (widgets[section.type] === 'dots') {
          // AltaCV \cvskill: 라벨 + 5점 도트
          vm.groups.forEach(function (g) {
            g.items.forEach(function (block) {
              var wd = block.widgetData || {};
              var runs = [new TextRun({ text: wd.label || '', bold: true, size: o.sz.base, color: sideText })];
              if (wd.dots) {
                runs.push(new TextRun({ children: [new Tab()] }));
                for (var di = 1; di <= 5; di++) {
                  runs.push(new TextRun({ text: '●', size: o.sz.base, color: di <= wd.dots ? o.accent : 'D1D1D1' }));
                }
              }
              var paras = [new Paragraph({
                children: runs,
                tabStops: [{ type: TabStopType.RIGHT, position: sideTab }],
                spacing: { after: wd.note ? 10 : o.sp.tight }
              })];
              if (wd.note) paras.push(new Paragraph({
                children: [new TextRun({ text: wd.note, size: o.sz.meta - 1, color: sideText || '5D5D5D' })],
                spacing: { after: o.sp.tight }
              }));
              sideKids = sideKids.concat(paras);
            });
          });
        } else if (widgets[section.type] === 'bars') {
          // Stockholm: 라벨 + 가는 강조색 언더라인 바
          vm.groups.forEach(function (g) {
            g.items.forEach(function (block) {
              var wd = block.widgetData || {};
              sideKids.push(new Paragraph({
                spacing: { after: 10 },
                children: [new TextRun({ text: wd.label || '', bold: true, size: o.sz.base, color: sideText })]
              }));
              sideKids.push(new Paragraph({
                spacing: { after: o.sp.tight },
                border: { bottom: { color: o.accent, space: 1, style: BorderStyle.SINGLE, size: 12 } },
                children: [new TextRun({ text: wd.note || ' ', size: wd.note ? o.sz.meta - 1 : 8, color: '888888' })]
              }));
            });
          });
        } else {
          sideKids = sideKids.concat(sectionBodyParagraphs(o, vm, { tabPos: sideTab, noDividers: true, textColor: sideText }));
        }
      } else {
        mainKids.push(headingParagraph(o, vm.title, { first: firstMain }));
        firstMain = false;
        mainKids = mainKids.concat(sectionBodyParagraphs(o, vm, { tabPos: mainW - 100 }));
      }
    });

    if (!sideKids.length) return mainKids;
    if (!mainKids.length) mainKids.push(new Paragraph({ children: [] }));

    var sideFill = dark ? o.accent : o.cfg.sidebarFill;
    var sideCell = new TableCell({
      width: { size: sideW, type: WidthType.DXA }, borders: NO_BORDERS,
      shading: sideFill ? { type: ShadingType.CLEAR, fill: sideFill } : undefined,
      margins: sideFill ? { top: 200, bottom: 200, left: 220, right: 220 } : undefined,
      children: sideKids
    });
    var mainCell = new TableCell({ width: { size: mainW, type: WidthType.DXA }, borders: NO_BORDERS, children: mainKids });
    var gapCell = new TableCell({ width: { size: gap, type: WidthType.DXA }, borders: NO_BORDERS, children: [new Paragraph({ children: [] })] });

    var cells = o.spec.sideLeft ? [sideCell, gapCell, mainCell] : [mainCell, gapCell, sideCell];
    var widths = o.spec.sideLeft ? [sideW, gap, mainW] : [mainW, gap, sideW];

    return [
      new Table({
        width: { size: o.contentW, type: WidthType.DXA },
        columnWidths: widths,
        borders: NO_BORDERS, layout: TableLayoutType.FIXED,
        rows: [new TableRow({ children: cells })]
      })
    ];
  }

  // 4) 왼쪽 라벨 열 (Europass)
  function engineLeftLabels(o, data) {
    var children = [];
    var lw = o.cfg.labelColW || 2300;
    var cw = o.contentW - lw;
    (data.sections || []).forEach(function (section) {
      var vm = M.sectionContent(section, o.s);
      if (!vm) return;
      children.push(new Table({
        width: { size: o.contentW, type: WidthType.DXA },
        columnWidths: [lw, cw],
        borders: NO_BORDERS, layout: TableLayoutType.FIXED,
        rows: [new TableRow({
          children: [
            new TableCell({
              width: { size: lw, type: WidthType.DXA }, borders: NO_BORDERS,
              margins: { top: 0, bottom: 0, left: 0, right: 200 },
              children: [new Paragraph({
                spacing: { before: 40 },
                children: [new TextRun({ text: vm.title, bold: true, size: o.sz.base + (o.cfg.heading.dsize || 3), color: o.accent })]
              })]
            }),
            new TableCell({
              width: { size: cw, type: WidthType.DXA }, borders: NO_BORDERS,
              children: sectionBodyParagraphs(o, vm, { tabPos: cw - 100 })
            })
          ]
        })]
      }));
      children.push(new Paragraph({
        spacing: { before: 60, after: Math.round(o.sp.block * 0.9) },
        border: { top: { color: o.accent, space: 2, style: BorderStyle.SINGLE, size: 4 } },
        children: []
      }));
    });
    return children;
  }

  /* ---------- 문서 조립 ---------- */
  function buildDoc(data, settings) {
    var o = makeCtx(data, settings);
    var p = data.personal || {};
    // Cascade처럼 헤더가 사이드바 안에 들어가는 템플릿은 상단 헤더 생략
    var children = o.spec.headerIn === 'side' ? [] : headerChildren(o, p);

    var body;
    if (o.spec.layout === 'left-dates') body = engineLeftDates(o, data);
    else if (o.spec.layout === 'sidebar') body = engineSidebar(o, data, p);
    else if (o.spec.layout === 'left-labels') body = engineLeftLabels(o, data);
    else body = engineSingle(o, data);
    children = children.concat(body);

    var sectionProps = {
      page: {
        size: { width: o.paper.w, height: o.paper.h },
        margin: { top: o.marginTB, bottom: o.marginTB, left: o.margin, right: o.margin }
      }
    };
    var headers, footers;
    var fullName = M.trim(p.fullName) || 'CV';

    if (o.cfg.pageHeader) {
      // Harvard: 2쪽부터 "이름  N"
      sectionProps.titlePage = true;
      headers = {
        default: new Header({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: o.contentW }],
            children: [
              new TextRun({ text: fullName, size: o.sz.meta, font: o.cfg.font }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ children: [PageNumber.CURRENT], size: o.sz.meta, font: o.cfg.font })
            ]
          })]
        }),
        first: new Header({ children: [] })
      };
    }
    if (o.cfg.footer) {
      // Awesome-CV: 이름 · CURRICULUM VITAE 중앙 스몰캡스 + 쪽번호 오른쪽
      footers = {
        default: new Footer({
          children: [new Paragraph({
            tabStops: [
              { type: TabStopType.CENTER, position: Math.round(o.contentW / 2) },
              { type: TabStopType.RIGHT, position: o.contentW }
            ],
            children: [
              new TextRun({ children: [new Tab()] }),
              new TextRun({ text: fullName + ' · Curriculum Vitae', size: 16, smallCaps: true, color: '999999', font: o.cfg.font }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '999999', font: o.cfg.font })
            ]
          })]
        })
      };
    }
    if (headers) sectionProps.titlePage = true;

    return new Document({
      creator: 'CV Builder',
      title: fullName + ' — Curriculum Vitae',
      styles: {
        default: {
          document: { run: { font: o.cfg.font, size: o.sz.base, color: '1A1A1A' } }
        }
      },
      numbering: {
        config: [{
          reference: 'cv-dash',
          levels: [{
            level: 0, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 180 } } }
          }]
        }]
      },
      sections: [{
        properties: sectionProps,
        headers: headers,
        footers: footers,
        children: children
      }]
    });
  }

  function suggestedFilename(data, profileName) {
    var name = M.trim((data.personal || {}).fullName) || M.trim(profileName) || 'CV';
    return name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_') + '_CV.docx';
  }

  return { buildDoc: buildDoc, suggestedFilename: suggestedFilename, Packer: Packer, DTPL: DTPL };
});
