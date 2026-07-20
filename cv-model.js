/* =========================================================================
 * cv-model.js — CV Builder 데이터 모델 + 뷰모델(공용: 미리보기/Word 내보내기)
 * 템플릿은 실존하는 널리 쓰이는 양식을 소스/공식 가이드 실측 기반으로 재현:
 *   - Harvard GSAS 가이드(2025) 실측 스펙
 *   - moderncv v2.6.1 / Awesome-CV / AltaCV v1.7.4 소스 코드 검증 값
 * UMD: 브라우저에서는 window.CVModel, Node에서는 module.exports
 * ========================================================================= */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.CVModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function uid() { return 'x' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function trim(s) { return (s == null ? '' : String(s)).trim(); }
  function linesOf(text) { return trim(text).split(/\r?\n/).map(trim).filter(Boolean); }

  /* ---------- 필드 정의 헬퍼 ---------- */
  function F(key, label, ph, w, type, options) {
    return { key: key, label: label, ph: ph || '', w: w || 'half', type: type || 'text', options: options || null };
  }

  var SECTION_DEFS = {
    summary: {
      title: 'Professional Summary', ko: '전문 요약', single: true,
      fields: [F('text', '요약 (2–4문장)', 'Ph.D. candidate in ... with N years of industry experience in ...', 'full', 'textarea')]
    },
    research_interests: {
      title: 'Research Interests', ko: '연구 관심사', single: true,
      fields: [F('text', '관심 분야 (한 줄에 하나씩)', 'Machine Learning\nHuman-Computer Interaction\nData Visualization', 'full', 'textarea')]
    },
    education: {
      title: 'Education', ko: '학력',
      fields: [
        F('degree', '학위/전공', 'Ph.D. in Computer Science'),
        F('institution', '학교', 'Seoul National University'),
        F('location', '위치', 'Seoul, South Korea'),
        F('period', '기간 (재학 중이면 Expected 사용)', 'Expected May 2027'),
        F('gpa', 'GPA', 'GPA 3.95/4.0'),
        F('advisor', '지도교수', 'Prof. Jane Kim'),
        F('thesis', '학위논문 제목', 'Dissertation: ...', 'full'),
        F('committee', '논문 심사위원 (선택)', 'Prof. A, Prof. B, Prof. C', 'full'),
        F('notes', '추가 사항 (한 줄에 하나씩)', '', 'full', 'textarea')
      ]
    },
    experience: {
      title: 'Professional Experience', ko: '경력',
      fields: [
        F('position', '직책', 'Software Engineer'),
        F('organization', '회사/기관', 'Samsung Electronics'),
        F('location', '위치', 'Suwon, South Korea'),
        F('period', '기간', 'Jan 2019 – Aug 2022'),
        F('bullets', '주요 업무·성과 (한 줄에 하나씩)', 'Developed ...\nLed a team of ...', 'full', 'textarea')
      ]
    },
    research: {
      title: 'Research Experience', ko: '연구 경력',
      fields: [
        F('role', '역할', 'Graduate Research Assistant'),
        F('lab', '연구실/기관', 'AI Lab, Seoul National University'),
        F('location', '위치', 'Seoul, South Korea'),
        F('period', '기간', 'Sep 2022 – Present'),
        F('bullets', '연구 내용 (한 줄에 하나씩)', '', 'full', 'textarea')
      ]
    },
    publications: {
      title: 'Publications', ko: '논문/출판',
      fields: [
        F('ptype', '구분', '', 'half', 'select', [['journal', 'Journal Article'], ['conference', 'Conference Paper'], ['book', 'Book Chapter'], ['preprint', 'Preprint'], ['other', 'Other']]),
        F('status', '상태', '', 'half', 'select', [['Published', 'Published'], ['Accepted', 'Accepted (In Press)'], ['Under Review', 'Under Review'], ['In Preparation', 'In Preparation']]),
        F('authors', '저자', 'Hong, G., Kim, J., & Lee, S.', 'full'),
        F('year', '연도', '2025'),
        F('title', '제목', 'A study on ...', 'full'),
        F('venue', '저널/학회명', 'Nature Communications', 'full'),
        F('volpages', '권(호), 페이지', '16(2), 112–128'),
        F('doi', 'DOI/URL', 'https://doi.org/10.xxxx/xxxxx'),
        F('tags', '태그 (선택: SCI(E)/KCI, IF, 역할 등)', 'SCI(E), IF 8.2', 'full')
      ]
    },
    presentations: {
      title: 'Presentations', ko: '학회 발표',
      fields: [
        F('pres_type', '형식', '', 'half', 'select', [['Oral', 'Oral (구두)'], ['Poster', 'Poster (포스터)'], ['Invited Talk', 'Invited Talk (초청)']]),
        F('date', '날짜', 'Jul 2025'),
        F('authors', '발표자', 'Hong, G., & Kim, J.', 'full'),
        F('title', '제목', '', 'full'),
        F('event', '학회/행사', 'ICML 2025'),
        F('location', '장소', 'Vancouver, Canada')
      ]
    },
    projects: {
      title: 'Projects', ko: '프로젝트',
      fields: [
        F('name', '프로젝트명', ''),
        F('role', '역할', 'Lead Developer'),
        F('period', '기간', '2023 – 2024'),
        F('link', '링크', 'github.com/...'),
        F('tech', '기술 스택', 'Python, PyTorch, AWS', 'full'),
        F('desc', '설명 (한 줄에 하나씩)', '', 'full', 'textarea')
      ]
    },
    teaching: {
      title: 'Teaching Experience', ko: '강의/조교',
      fields: [
        F('role', '역할', 'Teaching Assistant'),
        F('course', '과목', 'CS101: Introduction to Programming'),
        F('institution', '기관', 'Seoul National University'),
        F('period', '기간', 'Spring 2023'),
        F('desc', '설명 (한 줄에 하나씩)', '', 'full', 'textarea')
      ]
    },
    awards: {
      title: 'Honors & Awards', ko: '수상', tight: true,
      fields: [
        F('name', '수상명', 'Best Paper Award'),
        F('issuer', '수여 기관', 'ACM CHI'),
        F('date', '날짜', '2024'),
        F('note', '설명 (경쟁률·금액 등 규모를 적으면 좋음)', 'Top 1 of 1,200 submissions', 'full')
      ]
    },
    grants: {
      title: 'Grants & Fellowships', ko: '연구비/장학금',
      fields: [
        F('name', '과제/장학금명', '', 'full'),
        F('funder', '지원 기관', 'National Research Foundation of Korea'),
        F('role', '역할', 'PI / Co-PI / 참여연구원'),
        F('amount', '금액', '₩50,000,000'),
        F('period', '기간', '2023 – 2025'),
        F('desc', '설명', '', 'full')
      ]
    },
    skills: {
      title: 'Skills', ko: '스킬', tight: true,
      fields: [
        F('category', '분류', 'Programming'),
        F('items', '항목 (쉼표로 구분)', 'Python, R, MATLAB, SQL', 'full')
      ]
    },
    languages: {
      title: 'Languages', ko: '언어', tight: true,
      fields: [
        F('language', '언어', 'English'),
        F('level', '수준', '', 'half', 'select', [['', '— 선택 —'], ['Native', 'Native (모국어)'], ['Fluent', 'Fluent (유창)'], ['Advanced', 'Advanced (상급)'], ['Intermediate', 'Intermediate (중급)'], ['Basic', 'Basic (기초)']]),
        F('test', '시험 점수 (선택)', 'TOEFL 112, OPIc IH')
      ]
    },
    certifications: {
      title: 'Certifications & Licenses', ko: '자격증', tight: true,
      fields: [
        F('name', '자격증명', 'AWS Certified Solutions Architect'),
        F('issuer', '발급 기관', 'Amazon Web Services'),
        F('date', '취득일', 'Mar 2023'),
        F('cid', '자격 번호 (선택)', '')
      ]
    },
    service: {
      title: 'Academic Service', ko: '학술 활동', tight: true,
      fields: [
        F('role', '역할', 'Reviewer'),
        F('organization', '대상 (저널/학회/위원회)', 'Journal of Machine Learning Research'),
        F('period', '기간', '2024 – Present'),
        F('desc', '설명', '', 'full')
      ]
    },
    volunteer: {
      title: 'Volunteer Experience', ko: '봉사활동',
      fields: [
        F('role', '역할', 'Volunteer Tutor'),
        F('organization', '단체', ''),
        F('location', '위치', ''),
        F('period', '기간', ''),
        F('desc', '활동 내용 (한 줄에 하나씩)', '', 'full', 'textarea')
      ]
    },
    memberships: {
      title: 'Professional Memberships', ko: '학회 회원', tight: true,
      fields: [
        F('organization', '학회/협회', 'IEEE'),
        F('role', '자격', 'Student Member'),
        F('period', '기간', '2022 – Present')
      ]
    },
    patents: {
      title: 'Patents', ko: '특허',
      fields: [
        F('title', '발명 명칭', '', 'full'),
        F('inventors', '발명자', 'Hong, G., Kim, J.', 'full'),
        F('number', '출원/등록번호', 'KR 10-2023-0012345'),
        F('pstatus', '상태', '', 'half', 'select', [['', '— 선택 —'], ['Granted', '등록 (Granted)'], ['Pending', '출원 (Pending)']]),
        F('date', '날짜', '2023')
      ]
    },
    references: {
      title: 'References', ko: '추천인',
      fields: [
        F('name', '이름', 'Prof. Jane Kim'),
        F('title', '직함', 'Professor'),
        F('institution', '소속', 'Dept. of Computer Science, Seoul National University'),
        F('email', '이메일', 'jkim@university.edu'),
        F('phone', '전화', '')
      ]
    },
    custom: {
      title: 'Additional Information', ko: '커스텀 섹션',
      fields: [
        F('heading', '제목', ''),
        F('sub', '부제목', ''),
        F('right', '날짜/기간', ''),
        F('desc', '내용 (한 줄에 하나씩)', '', 'full', 'textarea')
      ]
    }
  };

  var DEFAULT_ORDER = [
    'summary', 'research_interests', 'education', 'experience', 'research',
    'publications', 'presentations', 'projects', 'teaching', 'awards', 'grants',
    'skills', 'languages', 'certifications', 'service', 'volunteer',
    'memberships', 'patents', 'references'
  ];

  var PERSONAL_FIELDS = [
    ['fullName', '이름 (영문)', 'Gildong Hong'],
    ['title', '직함/소속 (한 줄)', 'Ph.D. Candidate, Dept. of Computer Science, Seoul National University'],
    ['email', '이메일', 'you@university.edu'],
    ['phone', '전화', '+82-10-1234-5678'],
    ['pronouns', '대명사 (선택)', 'she/her'],
    ['address', '주소/지역', 'Seoul, South Korea'],
    ['website', '웹사이트', 'yourname.github.io'],
    ['linkedin', 'LinkedIn', 'linkedin.com/in/yourname'],
    ['github', 'GitHub', 'github.com/yourname'],
    ['scholar', 'Google Scholar', 'scholar.google.com/citations?user=...'],
    ['orcid', 'ORCID', '0000-0002-1234-5678']
  ];

  var DEFAULT_SETTINGS = { template: 'harvard', accent: '', fontSize: 'medium', density: 'normal', boldName: '' };

  /* ---------- 템플릿 스펙 (실존 양식 기반) ----------
   * layout: single | left-dates | sidebar | left-labels
   * entryStyle: org-first | title-first | inline | awesome | altacv
   * paper: letter | a4
   * accent: 시그니처 색 / swatches: 해당 양식의 공식 색상 팔레트
   */
  var TEMPLATE_SPECS = {
    harvard: {
      label: 'Harvard Academic — 미국 대학 표준 학술 CV',
      desc: '하버드 GSAS 공식 가이드 실측 재현. Times New Roman, 검정 단색, 굵은 대문자 섹션. 미국 대학원생이 실제 제출하는 표준.',
      layout: 'single', entryStyle: 'org-first', paper: 'letter',
      accent: '#000000', swatches: ['#000000'],
      photo: false, nameStyle: 'caps', refsTwoCol: true
    },
    moderncv: {
      label: 'ModernCV — LaTeX 표준 (CTAN/Overleaf)',
      desc: '2006년부터 모든 TeX 배포판에 포함된 "그 LaTeX CV". 왼쪽 날짜 열 + 파란 섹션 바.',
      layout: 'left-dates', entryStyle: 'inline', paper: 'a4', contactRight: true,
      photo: true, photoIn: 'head', photoShape: 'framed', photoSize: 96,
      accent: '#3873B3',
      swatches: ['#3873B3', '#F23333', '#F28C26', '#59B34D', '#980000', '#8054CC', '#0081A7', '#4D908E'],
      nameStyle: 'two-tone'
    },
    awesome: {
      label: 'Awesome CV — GitHub 28k★ 최고 인기',
      desc: 'posquit0 Awesome-CV. 가는 이름+굵은 성, 섹션 첫 3글자 강조색. 개발자 CV의 대명사.',
      layout: 'single', entryStyle: 'awesome', paper: 'a4', headingFirst3: true,
      accent: '#DC3522',
      swatches: ['#DC3522', '#00A388', '#0395DE', '#EF4089', '#FF6138', '#27AE60', '#95A5A6', '#131A28'],
      photo: true, photoIn: 'head', photoSide: 'left', photoSize: 92, nameStyle: 'first-light'
    },
    altacv: {
      label: 'AltaCV — Marissa Mayer 스타일 2단',
      desc: '유명한 마리사 메이어 이력서를 재현한 LaTeX 인기 양식. 원형 사진, 오른쪽 사이드바, 점선 구분선.',
      layout: 'sidebar', entryStyle: 'altacv', paper: 'a4',
      accent: '#8F0D0D', swatches: ['#8F0D0D', '#450808', '#0000B3', '#2E6B47', '#584B8C'],
      photo: true, photoIn: 'head', photoShape: 'circle',
      side: ['skills', 'languages', 'certifications', 'memberships'],
      sideWidgets: { skills: 'tags', languages: 'dots' },
      nameStyle: 'caps', dividers: true
    },
    europass: {
      label: 'Europass — EU 공식 (2020+ 현행)',
      desc: 'EU 공식 CV 빌더의 현행 기본형(Formal). 회색 헤더 밴드, 대문자 섹션 + 가는 밑줄. 수천만 건 작성된 공식 양식.',
      layout: 'single', entryStyle: 'europass', paper: 'a4',
      accent: '#004B80', swatches: ['#004B80', '#4D9ACB', '#0D5942', '#3B9E80', '#6C3088', '#C65094'],
      photo: true, photoIn: 'head', photoShape: 'circle', photoSize: 86, nameStyle: 'plain'
    },
    banking: {
      label: 'Banking / Consulting — 월가 표준 (WSO/M&I)',
      desc: '투자은행·컨설팅 이력서 표준. Times New Roman, 일반 굵기 이름, 이탤릭 직함, 대문자 섹션 + 밑줄.',
      layout: 'single', entryStyle: 'org-first', entryTitleItalic: true, paper: 'letter',
      accent: '#000000', swatches: ['#000000'],
      photo: false, nameStyle: 'plain'
    },
    jake: {
      label: "Jake's Resume — 테크 업계 최고 인기",
      desc: 'Overleaf/GitHub 개발자 이력서 표준(jakegut/resume). 스몰캡스 섹션 + 얇은 밑줄, 촘촘한 불릿, 0.5인치 여백.',
      layout: 'single', entryStyle: 'title-first', entryStyleEdu: 'org-first', paper: 'letter',
      accent: '#000000', swatches: ['#000000'],
      photo: false, nameStyle: 'smallcaps'
    },
    stockholm: {
      label: 'Stockholm — Resume.io 1,700만+ 사용',
      desc: 'Resume.io(현 Essential)의 세계 최다 사용 템플릿. 2단 화이트, 차콜 제목, 파란 스킬 바.',
      layout: 'sidebar', entryStyle: 'stockholm', paper: 'a4',
      accent: '#3095D5', swatches: ['#3095D5', '#E44C4C', '#20C997', '#7950F2', '#F59F00', '#343A40'],
      side: ['skills', 'languages'], sideWidgets: { languages: 'bars' },
      photo: true, photoIn: 'head', photoSize: 62, nameStyle: 'plain'
    },
    cascade: {
      label: 'Cascade — Zety 대표 (네이비 사이드바)',
      desc: 'Zety에서 150만+ 명이 쓴 대표 템플릿. 네이비 사이드바에 인적사항·스킬, 흰 본문.',
      layout: 'sidebar', sideLeft: true, headerIn: 'side', entryStyle: 'title-first', paper: 'a4',
      accent: '#1F4E79', swatches: ['#1F4E79', '#163A57', '#343A40', '#0F6674', '#7A263A', '#2E5E33'],
      side: ['skills', 'languages', 'certifications', 'memberships'],
      photo: true, photoIn: 'side', nameStyle: 'plain'
    },
    canva: {
      label: 'Canva Style — 파스텔 사이드바',
      desc: 'Canva(월 2.6억 사용자) 이력서 템플릿의 대표 미학. 연회색 사이드바, 자간 넓은 대문자 이름, 얇은 구분선.',
      layout: 'sidebar', entryStyle: 'title-first', paper: 'a4',
      accent: '#4A6FA5', swatches: ['#4A6FA5', '#8A9BA8', '#C77E6F', '#6B8F71', '#9A7AA0', '#37474F'],
      side: ['skills', 'languages', 'certifications', 'memberships'],
      photo: true, photoIn: 'head', photoShape: 'circle',
      nameStyle: 'caps', sidebarTint: true
    }
  };

  // 구버전 템플릿 키 → 새 키
  var TEMPLATE_MIGRATE = {
    classic: 'harvard', academic: 'harvard', modern: 'awesome',
    minimal: 'stockholm', compact: 'banking'
  };

  function normalizeSettings(settings) {
    var s = settings || {};
    var out = {};
    Object.keys(DEFAULT_SETTINGS).forEach(function (k) { out[k] = s[k] != null ? s[k] : DEFAULT_SETTINGS[k]; });
    if (TEMPLATE_MIGRATE[out.template]) out.template = TEMPLATE_MIGRATE[out.template];
    if (!TEMPLATE_SPECS[out.template]) out.template = 'harvard';
    if (!trim(out.accent)) out.accent = TEMPLATE_SPECS[out.template].accent;
    return out;
  }

  var TEMPLATES = Object.keys(TEMPLATE_SPECS).map(function (k) { return [k, TEMPLATE_SPECS[k].label]; });

  /* ---------- 프로필 생성 ---------- */
  function emptyEntry(type) {
    var e = {};
    SECTION_DEFS[type].fields.forEach(function (f) {
      e[f.key] = (f.type === 'select' && f.options && f.options.length) ? f.options[0][0] : '';
    });
    return e;
  }

  function newSection(type, title, enabled) {
    return {
      id: uid(), type: type,
      title: title || SECTION_DEFS[type].title,
      enabled: enabled !== false,
      entries: [emptyEntry(type)]
    };
  }

  function newProfileData() {
    var sections = DEFAULT_ORDER.map(function (t) { return newSection(t); });
    sections.push(newSection('custom', 'Additional Information', false));
    var personal = {};
    PERSONAL_FIELDS.forEach(function (f) { personal[f[0]] = ''; });
    return { personal: personal, sections: sections };
  }

  /* ---------- 빈 항목/섹션 판정 ---------- */
  function isEntryEmpty(type, entry) {
    var fields = SECTION_DEFS[type].fields;
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (f.type === 'select') continue;
      if (trim(entry[f.key])) return false;
    }
    return true;
  }

  function nonEmptyEntries(section) {
    return (section.entries || []).filter(function (e) { return !isEntryEmpty(section.type, e); });
  }

  /* ---------- 텍스트 런(runs) 헬퍼 ----------
   * run = { t, b(굵게), i(이탤릭), sc(스몰캡스), c('accent'|'muted'|'light'), sz('small') }
   */
  function R(t, opts) {
    var r = { t: t };
    if (opts) {
      if (opts.b) r.b = 1;
      if (opts.i) r.i = 1;
      if (opts.sc) r.sc = 1;
      if (opts.c) r.c = opts.c;
      if (opts.sz) r.sz = opts.sz;
    }
    return r;
  }
  function RB(t) { return R(t, { b: 1 }); }
  function RI(t) { return R(t, { i: 1 }); }

  // boldName(세미콜론으로 여러 표기 구분)이 나타나는 부분을 굵게
  function nameRuns(text, boldName) {
    text = trim(text);
    if (!text) return [];
    var variants = trim(boldName).split(';').map(trim).filter(Boolean);
    if (!variants.length) return [R(text)];
    var pattern = variants.map(function (v) { return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|');
    var parts = text.split(new RegExp('(' + pattern + ')'));
    var runs = [];
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      runs.push(i % 2 === 1 ? RB(parts[i]) : R(parts[i]));
    }
    return runs;
  }

  function joinParts(parts, sep) { return parts.filter(function (p) { return trim(p); }).join(sep); }
  function dot(s) { s = trim(s); if (!s) return ''; return /[.!?]$/.test(s) ? s : s + '.'; }

  /* ---------- 블록형 항목의 구조화 뷰모델 ----------
   * 각 타입 → { title, org, loc, period, gpa, details:[runs...], bullets:[string] }
   * 이후 템플릿의 entryStyle에 따라 composeHead가 실제 줄 배치를 결정.
   */
  var HEADS = {
    education: function (e) {
      var details = [];
      if (trim(e.thesis)) details.push([RB('Dissertation: '), R(e.thesis)]);
      if (trim(e.advisor)) details.push([RB('Advisor: '), R(e.advisor)]);
      if (trim(e.committee)) details.push([RB('Committee: '), R(e.committee)]);
      return {
        title: trim(e.degree), org: trim(e.institution), loc: trim(e.location),
        period: trim(e.period), gpa: trim(e.gpa), details: details, bullets: linesOf(e.notes)
      };
    },
    experience: function (e) {
      return { title: trim(e.position), org: trim(e.organization), loc: trim(e.location), period: trim(e.period), details: [], bullets: linesOf(e.bullets) };
    },
    research: function (e) {
      return { title: trim(e.role), org: trim(e.lab), loc: trim(e.location), period: trim(e.period), details: [], bullets: linesOf(e.bullets) };
    },
    teaching: function (e) {
      return { title: trim(e.role), org: joinParts([e.course, e.institution], ', '), loc: '', period: trim(e.period), details: [], bullets: linesOf(e.desc) };
    },
    projects: function (e) {
      var title = trim(e.name);
      if (trim(e.role)) title = title ? title + ' — ' + trim(e.role) : trim(e.role);
      return { title: title, org: joinParts([e.tech, e.link], '  ·  '), loc: '', period: trim(e.period), details: [], bullets: linesOf(e.desc) };
    },
    grants: function (e) {
      var details = [];
      if (trim(e.desc)) details.push([R(e.desc)]);
      return { title: trim(e.name), org: trim(e.funder), loc: joinParts([e.role, e.amount], ' · '), period: trim(e.period), details: details, bullets: [] };
    },
    volunteer: function (e) {
      return { title: trim(e.role), org: trim(e.organization), loc: trim(e.location), period: trim(e.period), details: [], bullets: linesOf(e.desc) };
    },
    custom: function (e) {
      return { title: trim(e.heading), org: trim(e.sub), loc: '', period: trim(e.right), details: [], bullets: linesOf(e.desc) };
    }
  };

  /* entryStyle별 줄 구성 (실제 양식의 조판 규칙)
   * 반환: lines[] = { left: runs, right: runs|null }
   */
  function composeHead(style, h, spec) {
    spec = spec || {};
    var lines = [];
    function push(left, right) { if (left.length || (right && right.length)) lines.push({ left: left, right: right && right.length ? right : null }); }

    if (style === 'org-first') {
      // Harvard/Banking: 기관 굵게 + 지역 오른쪽 / 직함·학위(뱅킹은 이탤릭) + 기간 오른쪽
      var l1 = []; if (h.org) l1.push(RB(h.org));
      push(l1, h.loc ? [R(h.loc)] : null);
      var l2 = [];
      if (h.title) l2.push(R(h.title, spec.entryTitleItalic ? { i: 1 } : null));
      if (h.gpa) l2.push(R((l2.length ? '  ·  ' : '') + h.gpa));
      push(l2, h.period ? [R(h.period)] : null);
      if (!h.org && !h.title && h.period) push([], [R(h.period)]);
    } else if (style === 'europass') {
      // Europass(2020+): 'TITLE – EMPLOYER' 대문자 굵게 + ' – 기간 – 지역' 작은 글씨, 한 줄
      var euHead = joinParts([h.title, h.org], ' – ').toUpperCase();
      var eu = [];
      if (euHead) eu.push(R(euHead, { b: 1, c: 'muted' }));
      var euTail = joinParts([h.period, h.loc ? h.loc.toUpperCase() : ''], ' – ');
      if (euTail) eu.push(R((euHead ? ' – ' : '') + euTail, { sz: 'small' }));
      push(eu, null);
      if (h.gpa) push([R(h.gpa, { sz: 'small' })], null);
    } else if (style === 'title-first') {
      // Jake's/Stockholm: 직함 굵게 + 기간 오른쪽 / 기관 이탤릭 + 지역 오른쪽
      var t1 = [];
      if (h.title) t1.push(RB(h.title));
      if (h.gpa) t1.push(R('  ·  ' + h.gpa));
      push(t1, h.period ? [R(h.period)] : null);
      var t2 = []; if (h.org) t2.push(RI(h.org));
      push(t2, h.loc ? [RI(h.loc)] : null);
    } else if (style === 'inline') {
      // moderncv \cventry: 한 줄에 "직함, 기관, 지역" — 기간은 왼쪽 힌트 열(레이아웃이 분리)
      var m = [];
      if (h.title) m.push(RB(h.title));
      if (h.org) m.push(R(m.length ? ', ' : ''), RI(h.org));
      if (h.loc) m.push(R((m.length ? ', ' : '') + h.loc));
      if (h.gpa) m.push(R((m.length ? ', ' : '') + h.gpa));
      push(m, h.period ? [R(h.period)] : null);
    } else if (style === 'awesome') {
      // Awesome-CV: 기관 굵게 + 지역(강조색 이탤릭) 오른쪽 / 직함 스몰캡스 회색 + 기간(회색 이탤릭) 오른쪽
      var a1 = []; if (h.org) a1.push(RB(h.org));
      push(a1, h.loc ? [R(h.loc, { i: 1, c: 'accent' })] : null);
      var a2 = [];
      if (h.title) a2.push(R(h.title, { sc: 1, c: 'muted' }));
      if (h.gpa) a2.push(R('  ·  ' + h.gpa, { c: 'muted' }));
      push(a2, h.period ? [R(h.period, { i: 1, c: 'muted' })] : null);
    } else if (style === 'stockholm') {
      // Resume.io Stockholm: "직함 at 회사, 도시" 전부 굵게 한 줄 / 날짜는 아래 회색 줄
      var joined = h.title;
      if (h.org) joined = joined ? joined + ' at ' + h.org : h.org;
      if (h.loc) joined = joined ? joined + ', ' + h.loc : h.loc;
      var s1 = [];
      if (joined) s1.push(RB(joined));
      if (h.gpa) s1.push(R('  ·  ' + h.gpa));
      push(s1, null);
      if (h.period) push([R(h.period, { c: 'muted', sz: 'small' })], null);
    } else if (style === 'altacv') {
      // AltaCV \cvevent: 직함(일반 굵기·큰 글자) / 기관(굵게·강조색) / 날짜·지역(작게·회색)
      if (h.title) push([R(h.title, { sz: 'big' })], null);
      var o2 = []; if (h.org) o2.push(R(h.org, { b: 1, c: 'accent' }));
      if (h.gpa) o2.push(R('  ·  ' + h.gpa));
      push(o2, null);
      var meta = joinParts([h.period, h.loc], '   ·   ');
      if (meta) push([R(meta, { c: 'muted', sz: 'small' })], null);
    } else {
      // 기본(stack): 직함 굵게 + 기간 오른쪽 / 기관 이탤릭, 지역
      var d1 = []; if (h.title) d1.push(RB(h.title));
      if (h.gpa) d1.push(R('  ·  ' + h.gpa));
      push(d1, h.period ? [R(h.period)] : null);
      var org = joinParts([h.org, h.loc], ', ');
      if (org) push([RI(org)], null);
    }

    (h.details || []).forEach(function (runs) { lines.push({ left: runs, right: null }); });
    return lines;
  }

  /* ---------- 항목별 뷰모델 (블록형 이외) ---------- */
  function ln(left, right) { return { left: left, right: right ? [R(right)] : null }; }

  var VMS = {
    summary: function (e) {
      return { lines: linesOf(e.text).map(function (p) { return ln([R(p)], null); }), bullets: [] };
    },
    research_interests: function (e) {
      var items = linesOf(e.text);
      if (!items.length) return null;
      return { lines: [ln([R(items.join('  ·  '))], null)], bullets: [] };
    },
    publications: function (e, settings) {
      var runs = nameRuns(e.authors, settings.boldName);
      if (runs.length) runs.push(R(trim(e.year) ? ' (' + trim(e.year) + '). ' : '. '));
      else if (trim(e.year)) runs.push(R('(' + trim(e.year) + '). '));
      if (trim(e.title)) runs.push(R(dot(e.title) + ' '));
      if (trim(e.venue)) runs.push(RI(e.venue));
      if (trim(e.volpages)) runs.push(R(', ' + trim(e.volpages)));
      if (trim(e.venue) || trim(e.volpages)) runs.push(R('. '));
      if (trim(e.doi)) runs.push(R(dot(e.doi) + ' '));
      var st = trim(e.status);
      if (st && st !== 'Published') {
        var note = st === 'Accepted' ? 'Accepted, in press' : st === 'Under Review' ? 'Under review' : 'In preparation';
        runs.push(RI('(' + note + ')'));
      }
      if (trim(e.tags)) runs.push(R(' [' + trim(e.tags) + ']', { c: 'muted' }));
      return runs.length ? { cite: runs } : null;
    },
    presentations: function (e, settings) {
      var runs = nameRuns(e.authors, settings.boldName);
      if (runs.length) runs.push(R(trim(e.date) ? ' (' + trim(e.date) + '). ' : '. '));
      else if (trim(e.date)) runs.push(R('(' + trim(e.date) + '). '));
      if (trim(e.title)) runs.push(R(dot(e.title) + ' '));
      var where = joinParts([e.event, e.location], ', ');
      if (where) { runs.push(RI(where)); runs.push(R('. ')); }
      var pt = trim(e.pres_type);
      if (pt && pt !== 'Oral') runs.push(R('[' + pt + ']'));
      return runs.length ? { cite: runs } : null;
    },
    awards: function (e) {
      var l1 = [];
      if (trim(e.name)) l1.push(RB(e.name));
      if (trim(e.issuer)) l1.push(R((l1.length ? ', ' : '') + e.issuer));
      var lines = [{ left: l1, right: trim(e.date) ? [R(e.date)] : null }];
      if (trim(e.note)) lines.push({ left: [R(e.note)], right: null });
      return { lines: lines, bullets: [] };
    },
    skills: function (e) {
      var l = [];
      if (trim(e.category)) l.push(RB(e.category + ': '));
      if (trim(e.items)) l.push(R(e.items));
      return { lines: [{ left: l, right: null }], bullets: [], widgetData: { label: trim(e.category), items: trim(e.items).split(',').map(trim).filter(Boolean) } };
    },
    languages: function (e) {
      var l = [];
      if (trim(e.language)) l.push(RB(e.language));
      if (trim(e.level)) l.push(R((l.length ? ' — ' : '') + e.level));
      if (trim(e.test)) l.push(R(' (' + trim(e.test) + ')'));
      var LEVELS = { Native: 5, Fluent: 4, Advanced: 3, Intermediate: 2, Basic: 1 };
      return {
        lines: [{ left: l, right: null }], bullets: [],
        widgetData: { label: trim(e.language), dots: LEVELS[trim(e.level)] || 0, note: trim(e.test) }
      };
    },
    certifications: function (e) {
      var l = [];
      if (trim(e.name)) l.push(RB(e.name));
      if (trim(e.issuer)) l.push(R((l.length ? ', ' : '') + e.issuer));
      if (trim(e.cid)) l.push(R(' (No. ' + trim(e.cid) + ')'));
      return { lines: [{ left: l, right: trim(e.date) ? [R(e.date)] : null }], bullets: [] };
    },
    service: function (e) {
      var l = [];
      if (trim(e.role)) l.push(RB(e.role));
      if (trim(e.organization)) { l.push(R(' — ')); l.push(RI(e.organization)); }
      var lines = [{ left: l, right: trim(e.period) ? [R(e.period)] : null }];
      if (trim(e.desc)) lines.push({ left: [R(e.desc)], right: null });
      return { lines: lines, bullets: [] };
    },
    memberships: function (e) {
      var l = [];
      if (trim(e.organization)) l.push(RB(e.organization));
      if (trim(e.role)) l.push(R((l.length ? ' — ' : '') + e.role));
      return { lines: [{ left: l, right: trim(e.period) ? [R(e.period)] : null }], bullets: [] };
    },
    patents: function (e, settings) {
      var runs = nameRuns(e.inventors, settings.boldName);
      if (runs.length) runs.push(R(trim(e.date) ? ' (' + trim(e.date) + '). ' : '. '));
      else if (trim(e.date)) runs.push(R('(' + trim(e.date) + '). '));
      if (trim(e.title)) runs.push(RI(dot(e.title) + ' '));
      if (trim(e.number)) runs.push(R(trim(e.number) + '. '));
      if (trim(e.pstatus)) runs.push(R('(' + trim(e.pstatus) + ')'));
      return runs.length ? { cite: runs } : null;
    },
    references: function (e) {
      var lines = [];
      if (trim(e.name)) lines.push({ left: [RB(e.name)], right: null });
      var l2 = joinParts([e.title, e.institution], ', ');
      if (l2) lines.push({ left: [R(l2)], right: null });
      var l3 = joinParts([e.email, e.phone], '  ·  ');
      if (l3) lines.push({ left: [R(l3)], right: null });
      return { lines: lines, bullets: [], refBlock: true };
    }
  };

  var PUB_GROUPS = [
    ['journal', 'Journal Articles'],
    ['conference', 'Conference Papers'],
    ['book', 'Book Chapters'],
    ['preprint', 'Preprints'],
    ['other', 'Other Publications']
  ];

  /* ---------- 섹션 → 뷰모델 ---------- */
  function sectionContent(section, settings) {
    if (!section.enabled) return null;
    var def = SECTION_DEFS[section.type];
    if (!def) return null;
    var entries = nonEmptyEntries(section);
    if (!entries.length) return null;
    settings = settings || {};
    var spec = TEMPLATE_SPECS[settings.template] || TEMPLATE_SPECS.harvard;
    var style = spec.entryStyle || 'title-first';
    if (section.type === 'education' && spec.entryStyleEdu) style = spec.entryStyleEdu;

    var groups;
    if (section.type === 'publications') {
      groups = [];
      PUB_GROUPS.forEach(function (g) {
        var items = entries
          .filter(function (e) { return (e.ptype || 'other') === g[0]; })
          .map(function (e) { return VMS.publications(e, settings); })
          .filter(Boolean);
        if (items.length) groups.push({ label: g[1], numbered: true, items: items });
      });
      if (groups.length === 1) groups[0].label = null;
    } else if (HEADS[section.type]) {
      // 블록형: 구조화 → 템플릿 스타일로 조판
      var items2 = entries.map(function (e) {
        var h = HEADS[section.type](e);
        var lines = composeHead(style, h, spec);
        if (!lines.length && !h.bullets.length) return null;
        return { lines: lines, bullets: h.bullets };
      }).filter(Boolean);
      if (!items2.length) return null;
      groups = [{ label: null, numbered: false, items: items2 }];
    } else {
      var items3 = entries.map(function (e) { return VMS[section.type](e, settings); }).filter(Boolean);
      if (!items3.length) return null;
      groups = [{ label: null, numbered: false, items: items3 }];
    }
    if (!groups.length) return null;
    return { title: section.title || def.title, tight: !!def.tight, type: section.type, groups: groups };
  }

  /* ---------- 연락처 라인 ---------- */
  function contactLines(personal) {
    var p = personal || {};
    var line1 = [p.email, p.phone, p.pronouns, p.address].map(trim).filter(Boolean);
    var orcid = trim(p.orcid).replace(/^(https?:\/\/)?(www\.)?orcid\.org\//i, '');
    var line2 = [p.website, p.linkedin, p.github, p.scholar, orcid ? 'ORCID: ' + orcid : ''].map(trim).filter(Boolean);
    var out = [];
    if (line1.length) out.push(line1.join('  |  '));
    if (line2.length) out.push(line2.join('  |  '));
    return out;
  }

  /* ---------- 샘플 데이터 ---------- */
  function sampleData() {
    var d = newProfileData();
    d.personal = {
      fullName: 'Gildong Hong',
      title: 'Ph.D. Candidate, Department of Computer Science, Seoul National University',
      email: 'gdhong@snu.ac.kr', phone: '+82-10-1234-5678', pronouns: '', address: 'Seoul, South Korea',
      website: 'gdhong.github.io', linkedin: 'linkedin.com/in/gdhong', github: 'github.com/gdhong',
      scholar: 'scholar.google.com/citations?user=abc123', orcid: '0000-0002-1234-5678'
    };
    function sec(type) { for (var i = 0; i < d.sections.length; i++) if (d.sections[i].type === type) return d.sections[i]; }
    function fill(type, entries) {
      var s = sec(type);
      s.entries = entries.map(function (e) { var base = emptyEntry(type); Object.keys(e).forEach(function (k) { base[k] = e[k]; }); return base; });
    }
    fill('summary', [{ text: 'Ph.D. candidate in Computer Science with 3+ years of industry experience in large-scale machine learning systems. Research focuses on efficient deep learning and human-centered AI. Author of 6 peer-reviewed publications; experienced in leading cross-functional projects from research prototypes to production.' }]);
    fill('research_interests', [{ text: 'Efficient Deep Learning\nHuman-Centered AI\nLarge Language Models\nData Visualization' }]);
    fill('education', [
      { degree: 'Ph.D. in Computer Science', institution: 'Seoul National University', location: 'Seoul, South Korea', period: 'Expected Aug 2027', gpa: 'GPA 3.95/4.0', advisor: 'Prof. Jane Kim', thesis: 'Resource-Efficient Training of Large Language Models (in progress)', committee: 'Prof. Jane Kim (chair), Prof. Minsu Lee, Prof. Sarah Park' },
      { degree: 'M.S. in Computer Science', institution: 'Seoul National University', location: 'Seoul, South Korea', period: 'Feb 2019', gpa: 'GPA 3.9/4.0', advisor: 'Prof. Minsu Lee', thesis: 'Lightweight Neural Architectures for Edge Devices' },
      { degree: 'B.S. in Computer Science and Engineering', institution: 'Korea University', location: 'Seoul, South Korea', period: 'Feb 2017', gpa: 'GPA 3.8/4.0, Summa Cum Laude' }
    ]);
    fill('experience', [
      { position: 'Machine Learning Engineer', organization: 'NAVER Corp.', location: 'Seongnam, South Korea', period: 'Mar 2019 – Aug 2022', bullets: 'Built and operated a large-scale recommendation system serving 20M+ daily active users\nReduced model inference cost by 40% through quantization and distillation\nLed a team of 4 engineers for the search-ranking model refresh project\nCo-developed internal MLOps pipeline adopted by 10+ teams' },
      { position: 'Software Engineering Intern', organization: 'Kakao Corp.', location: 'Pangyo, South Korea', period: 'Jul 2016 – Aug 2016', bullets: 'Developed data-pipeline monitoring dashboard used by the data platform team' }
    ]);
    fill('research', [
      { role: 'Graduate Research Assistant', lab: 'Machine Intelligence Lab, Seoul National University', location: 'Seoul, South Korea', period: 'Sep 2022 – Present', bullets: 'Research on memory-efficient fine-tuning of large language models\nDeveloped an open-source library for parameter-efficient training (1.2k GitHub stars)\nCollaborating with hospital partners on clinical NLP applications' },
      { role: 'Undergraduate Research Intern', lab: 'Data Science Lab, Korea University', location: 'Seoul, South Korea', period: 'Jun 2016 – Dec 2016', bullets: 'Studied graph-based anomaly detection on financial transaction data' }
    ]);
    fill('publications', [
      { ptype: 'journal', status: 'Published', authors: 'Hong, G., Kim, J., & Lee, S.', year: '2025', title: 'Memory-efficient fine-tuning of large language models via selective activation recomputation', venue: 'Journal of Machine Learning Research', volpages: '26(4), 1–28', doi: 'https://doi.org/10.5555/jmlr.2025.26', tags: 'SCI(E), IF 6.0' },
      { ptype: 'journal', status: 'Under Review', authors: 'Hong, G., Park, H., & Kim, J.', year: '2026', title: 'A survey on parameter-efficient adaptation of foundation models', venue: 'ACM Computing Surveys' },
      { ptype: 'conference', status: 'Published', authors: 'Hong, G., Choi, D., & Kim, J.', year: '2024', title: 'FastLoRA: Accelerating low-rank adaptation with structured sparsity', venue: 'Proceedings of NeurIPS 2024', volpages: 'pp. 1123–1135', doi: 'https://doi.org/10.5555/neurips.2024.1123' },
      { ptype: 'conference', status: 'Published', authors: 'Lee, S., Hong, G., & Kim, J.', year: '2023', title: 'Understanding user trust in AI-assisted writing tools', venue: 'Proceedings of ACM CHI 2023', volpages: 'pp. 442–455', doi: 'https://doi.org/10.5555/chi.2023.442' },
      { ptype: 'preprint', status: 'Published', authors: 'Hong, G., & Kim, J.', year: '2025', title: 'Scaling laws for parameter-efficient fine-tuning', venue: 'arXiv preprint', volpages: 'arXiv:2501.01234' }
    ]);
    fill('presentations', [
      { pres_type: 'Oral', date: 'Dec 2024', authors: 'Hong, G.', title: 'FastLoRA: Accelerating low-rank adaptation with structured sparsity', event: 'NeurIPS 2024', location: 'Vancouver, Canada' },
      { pres_type: 'Poster', date: 'Jul 2024', authors: 'Hong, G., & Choi, D.', title: 'Efficient adaptation of LLMs under memory constraints', event: 'ICML 2024 Workshop on Efficient ML', location: 'Vienna, Austria' },
      { pres_type: 'Invited Talk', date: 'May 2025', authors: 'Hong, G.', title: 'Parameter-efficient fine-tuning in practice', event: 'Korea AI Summit', location: 'Seoul, South Korea' }
    ]);
    fill('projects', [
      { name: 'PEFT-Kit', role: 'Creator & Maintainer', period: '2023 – Present', link: 'github.com/gdhong/peft-kit', tech: 'Python, PyTorch, HuggingFace', desc: 'Open-source library for parameter-efficient fine-tuning (1.2k stars, 40+ contributors)\nAdopted in 3 published papers by external groups' },
      { name: 'ClinNote', role: 'Research Lead', period: '2024 – Present', link: '', tech: 'Python, FastAPI, React', desc: 'Clinical note summarization system piloted at two university hospitals' }
    ]);
    fill('teaching', [
      { role: 'Teaching Assistant', course: 'CS470: Introduction to Machine Learning', institution: 'Seoul National University', period: 'Spring 2023, Spring 2024', desc: 'Led weekly lab sessions for 120+ students; redesigned programming assignments' },
      { role: 'Instructor', course: 'Python Bootcamp for Graduate Researchers', institution: 'SNU Graduate School', period: 'Winter 2023', desc: 'Designed and taught a 2-week intensive course (60 participants)' }
    ]);
    fill('awards', [
      { name: 'Best Paper Award', issuer: 'ICML 2024 Workshop on Efficient ML', date: '2024' },
      { name: 'National Ph.D. Fellowship', issuer: 'National Research Foundation of Korea', date: '2023 – 2025', note: 'Awarded to 50 of 1,800 applicants nationwide' },
      { name: 'Excellence Award, Corporate Hackathon', issuer: 'NAVER Corp.', date: '2021' }
    ]);
    fill('grants', [
      { name: 'Efficient On-Device LLM Adaptation', funder: 'National Research Foundation of Korea', role: 'Student PI', amount: '₩60,000,000', period: '2024 – 2026' },
      { name: 'AI Graduate Fellowship', funder: 'Ministry of Science and ICT', role: 'Fellow', amount: '₩24,000,000/yr', period: '2022 – Present' }
    ]);
    fill('skills', [
      { category: 'Programming', items: 'Python, C++, JavaScript/TypeScript, SQL' },
      { category: 'ML / Data', items: 'PyTorch, JAX, HuggingFace, scikit-learn, Spark, Airflow' },
      { category: 'Systems & Tools', items: 'Linux, Docker, Kubernetes, AWS, Git, CI/CD' },
      { category: 'Research', items: 'Experimental design, statistical analysis, technical writing, LaTeX' }
    ]);
    fill('languages', [
      { language: 'Korean', level: 'Native' },
      { language: 'English', level: 'Fluent', test: 'TOEFL 112, OPIc AL' },
      { language: 'Japanese', level: 'Intermediate', test: 'JLPT N2' }
    ]);
    fill('certifications', [
      { name: 'AWS Certified Solutions Architect – Associate', issuer: 'Amazon Web Services', date: 'Mar 2022' },
      { name: 'Engineer Information Processing (정보처리기사)', issuer: 'HRD Korea', date: 'Nov 2018' }
    ]);
    fill('service', [
      { role: 'Reviewer', organization: 'NeurIPS 2025, ICML 2025, ACL 2025', period: '2024 – Present' },
      { role: 'Student Volunteer', organization: 'ACM CHI 2023', period: '2023' },
      { role: 'Lab Seminar Organizer', organization: 'Machine Intelligence Lab, SNU', period: '2023 – Present' }
    ]);
    fill('volunteer', [
      { role: 'Coding Mentor', organization: 'Hope Coding School (비영리 교육봉사)', location: 'Seoul, South Korea', period: '2020 – Present', desc: 'Monthly programming classes for underprivileged middle-school students\nMentored 30+ students; 5 advanced to national software competitions' },
      { role: 'Translation Volunteer', organization: 'TED Translators', location: 'Remote', period: '2019 – 2021', desc: 'Translated 25+ technology talks into Korean' }
    ]);
    fill('memberships', [
      { organization: 'ACM', role: 'Student Member', period: '2022 – Present' },
      { organization: 'IEEE', role: 'Student Member', period: '2022 – Present' },
      { organization: 'Korean Institute of Information Scientists and Engineers (KIISE)', role: 'Student Member', period: '2017 – Present' }
    ]);
    fill('patents', [
      { title: 'Method and apparatus for compressing neural network models', inventors: 'Hong, G., Kim, M.', number: 'KR 10-2021-0123456', pstatus: 'Granted', date: '2021' }
    ]);
    fill('references', [
      { name: 'Prof. Jane Kim', title: 'Professor', institution: 'Department of Computer Science, Seoul National University', email: 'jkim@snu.ac.kr' },
      { name: 'Dr. Minho Seo', title: 'Director of AI Research', institution: 'NAVER Corp.', email: 'minho.seo@navercorp.com' }
    ]);
    return d;
  }

  return {
    uid: uid, trim: trim, linesOf: linesOf,
    SECTION_DEFS: SECTION_DEFS, DEFAULT_ORDER: DEFAULT_ORDER, PERSONAL_FIELDS: PERSONAL_FIELDS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS, TEMPLATES: TEMPLATES,
    TEMPLATE_SPECS: TEMPLATE_SPECS, TEMPLATE_MIGRATE: TEMPLATE_MIGRATE, normalizeSettings: normalizeSettings,
    newProfileData: newProfileData, newSection: newSection, emptyEntry: emptyEntry,
    isEntryEmpty: isEntryEmpty, nonEmptyEntries: nonEmptyEntries,
    sectionContent: sectionContent, contactLines: contactLines, sampleData: sampleData
  };
});
