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

  /* ---------- 필드 정의 헬퍼 ----------
   * type: text | textarea | select(고정 목록) | combo(목록 + 직접 입력 가능)
   * def : 새 항목의 기본값 (없으면 select는 첫 옵션, 나머지는 빈 값)
   */
  function F(key, label, ph, w, type, options, def) {
    return { key: key, label: label, ph: ph || '', w: w || 'half', type: type || 'text', options: options || null, def: def };
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
        F('thesisLabel', '논문·작품 라벨 (직접 입력 가능)', '예: Dissertation', 'half', 'combo',
          [['Dissertation', 'Dissertation (박사 학위논문)'], ['Thesis', 'Thesis (석사 학위논문)'],
           ['Master\'s Thesis', 'Master\'s Thesis'], ['Doctoral Dissertation', 'Doctoral Dissertation'],
           ['Capstone Project', 'Capstone Project (캡스톤)'], ['Graduation Work', 'Graduation Work (졸업작품)'],
           ['Final Project', 'Final Project'], ['', '(라벨 없음 / None)']], 'Dissertation'),
        F('thesis', '논문·졸업작품 제목', '예: Real-time forest slash pile volume estimation', 'full'),
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
        F('status', '상태 (직접 입력 가능)', '예: Published', 'half', 'combo', [['Published', 'Published'], ['Accepted', 'Accepted (In Press)'], ['Under Review', 'Under Review'], ['In Preparation', 'In Preparation'], ['Submitted', 'Submitted']]),
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
        F('pres_type', '형식 (직접 입력 가능)', '예: Oral', 'half', 'combo', [['Oral', 'Oral (구두)'], ['Poster', 'Poster (포스터)'], ['Invited Talk', 'Invited Talk (초청)'], ['Keynote', 'Keynote']]),
        F('date', '날짜', 'Jul 2025'),
        F('authors', '발표자', 'Hong, G., & Kim, J.', 'full'),
        F('title', '제목', '', 'full'),
        F('event', '학회/행사', 'ICML 2025'),
        F('location', '장소', 'Vancouver, Canada')
      ]
    },
    conferences: {
      // 참석 기록용. 기본은 꺼둔 상태(defaultOff) — 내용은 저장되지만 CV/Word/공개 페이지에는 나오지 않음.
      title: 'Conferences & Workshops', ko: '행사·학회 참석', tight: true, defaultOff: true,
      fields: [
        F('name', '행사명', 'ICML 2025', 'full'),
        F('etype', '유형 (직접 입력 가능)', '예: Conference', 'half', 'combo',
          [['Conference', 'Conference (학회)'], ['Workshop', 'Workshop (워크숍)'], ['Seminar', 'Seminar (세미나)'],
           ['Symposium', 'Symposium (심포지엄)'], ['Training', 'Training (교육)'], ['Summer School', 'Summer School (하계학교)']]),
        F('role', '역할 (직접 입력 가능)', '예: Attendee', 'half', 'combo',
          [['Attendee', 'Attendee (참석)'], ['Presenter', 'Presenter (발표)'], ['Poster', 'Poster (포스터)'],
           ['Panelist', 'Panelist (패널)'], ['Session Chair', 'Session Chair (좌장)'], ['Organizer', 'Organizer (주최·운영)']]),
        F('organizer', '주최', 'International Machine Learning Society'),
        F('location', '장소', 'Vancouver, Canada'),
        F('date', '날짜', 'Jul 2025'),
        F('note', '비고 (선택)', '', 'full')
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
        F('level', '수준 (직접 입력 가능)', '예: C1, 상급', 'half', 'combo', [['Native', 'Native (모국어)'], ['Fluent', 'Fluent (유창)'], ['Advanced', 'Advanced (상급)'], ['Intermediate', 'Intermediate (중급)'], ['Basic', 'Basic (기초)']]),
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
    media: {
      // 언론·매체가 나/연구를 다룬 것 (신문·방송·잡지·온라인·마케팅). 기본 꺼짐.
      title: 'Media Coverage', ko: '언론·미디어 보도', tight: true, defaultOff: true,
      fields: [
        F('outlet', '매체명', '예: Oregon Public Broadcasting', 'full'),
        F('mtype', '유형 (직접 입력 가능)', '예: Broadcast', 'half', 'combo',
          [['Newspaper', 'Newspaper (신문)'], ['Broadcast', 'Broadcast (방송·TV/라디오)'], ['Magazine', 'Magazine (잡지)'],
           ['Online', 'Online (온라인)'], ['Marketing', 'Marketing (마케팅)'], ['Interview', 'Interview (인터뷰)']]),
        F('date', '날짜', 'May 2025', 'half'),
        F('title', '제목·설명', '예: Drones and iPads reshape forest measurement', 'full')
      ]
    },
    outreach: {
      // 내가 직접 연구를 시연·발표·전시한 홍보 활동 (학과 행사, 기관 방문 등). 기본 꺼짐.
      title: 'Outreach & Demonstrations', ko: '연구 홍보·시연', tight: true, defaultOff: true,
      fields: [
        F('event', '행사·대상', '예: OSU Board of Visitors', 'full'),
        F('role', '역할 (직접 입력 가능)', '예: Demonstration', 'half', 'combo',
          [['Demonstration', 'Demonstration (시연)'], ['Presentation', 'Presentation (발표)'], ['Exhibit', 'Exhibit (전시)'],
           ['Host / Tour', 'Host / Tour (안내)'], ['Judge', 'Judge (심사)']], 'Demonstration'),
        F('location', '장소', 'Corvallis, OR', 'half'),
        F('date', '날짜', '2025', 'half'),
        F('note', '설명 (선택)', '', 'full')
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
        F('pstatus', '상태 (직접 입력 가능)', '예: Granted', 'half', 'combo', [['Granted', 'Granted (등록)'], ['Pending', 'Pending (출원)']]),
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
      title: 'Additional Information', ko: '사용자 지정',
      fields: [
        F('heading', '제목', ''),
        F('sub', '부제목', ''),
        F('right', '날짜/기간', ''),
        F('desc', '내용 (한 줄에 하나씩)', '', 'full', 'textarea')
      ]
    }
  };

  /* 항목형 섹션에 공통 '링크' 칸 추가 — 채우면 항목 끝에 [Link]가 표시되고 하이퍼링크가 걸린다.
   * (projects는 이미 자체 link 칸이 있어 제외, 요약/관심사/스킬/언어/추천인은 링크가 무의미해 제외) */
  ['education', 'experience', 'research', 'publications', 'presentations', 'conferences',
   'teaching', 'awards', 'grants', 'certifications', 'service', 'media', 'outreach', 'volunteer',
   'memberships', 'patents', 'custom'].forEach(function (t) {
    if (SECTION_DEFS[t]) SECTION_DEFS[t].fields.push(F('link', '링크 (선택)', 'https://…', 'full'));
  });

  var DEFAULT_ORDER = [
    'summary', 'research_interests', 'education', 'experience', 'research',
    'publications', 'presentations', 'conferences', 'projects', 'teaching', 'awards', 'grants',
    'skills', 'languages', 'certifications', 'service', 'outreach', 'media', 'volunteer',
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

  var DEFAULT_SETTINGS = { template: 'harvard', accent: '', fontSize: 'large', density: 'normal', boldName: '', linkStyle: 'label' };

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
      layout: 'single', entryStyle: 'org-first', paper: 'letter', marginMm: { tb: 19, lr: 19 },
      nameHp: 32, headingDsize: 0, citeHang: false,
      accent: '#000000', swatches: ['#000000'],
      photo: false, nameStyle: 'caps', refsTwoCol: true
    },
    moderncv: {
      label: 'ModernCV — LaTeX 표준 (CTAN/Overleaf)',
      desc: '2006년부터 모든 TeX 배포판에 포함된 표준 LaTeX 이력서. 왼쪽 날짜 열과 파란 섹션 바.',
      layout: 'left-dates', entryStyle: 'inline', paper: 'a4', contactRight: true, marginMm: { tb: 24, lr: 24 },
      nameHp: 54, headingDsize: 7, citeHang: true,
      photo: true, photoIn: 'head', photoShape: 'framed', photoSize: 96,
      accent: '#3873B3',
      swatches: ['#3873B3', '#F23333', '#F28C26', '#59B34D', '#980000', '#8054CC', '#0081A7', '#4D908E'],
      nameStyle: 'two-tone'
    },
    awesome: {
      label: 'Awesome CV — GitHub 28k★ 개발자 이력서',
      desc: 'posquit0의 Awesome-CV. 가는 이름과 굵은 성, 섹션 첫 세 글자 강조색. 개발자 이력서를 대표하는 양식.',
      layout: 'single', entryStyle: 'awesome', paper: 'a4', headingFirst3: true, marginMm: { tb: 20, lr: 20 }, tightScale: 0.85,
      nameHp: 58, headingDsize: 9, citeHang: true,
      accent: '#DC3522',
      swatches: ['#DC3522', '#00A388', '#0395DE', '#EF4089', '#FF6138', '#27AE60', '#95A5A6', '#131A28'],
      photo: true, photoIn: 'head', photoSide: 'left', photoSize: 92, nameStyle: 'first-light'
    },
    altacv: {
      label: 'AltaCV — Marissa Mayer 스타일 2단',
      desc: '마리사 메이어 이력서를 재현한 LaTeX 양식. 원형 사진, 오른쪽 사이드바, 점선 구분선.',
      layout: 'sidebar', entryStyle: 'altacv', paper: 'a4', marginMm: { tb: 15, lr: 12.5 },
      nameHp: 48, headingDsize: 6, citeHang: true,
      accent: '#8F0D0D', swatches: ['#8F0D0D', '#450808', '#0000B3', '#2E6B47', '#584B8C'],
      photo: true, photoIn: 'head', photoShape: 'circle',
      side: ['skills', 'languages', 'certifications', 'memberships'],
      sideWidgets: { skills: 'tags', languages: 'dots' },
      nameStyle: 'caps', dividers: true
    },
    europass: {
      label: 'Europass — EU 공식 (2020+ 현행)',
      desc: 'EU 공식 CV 빌더의 현행 기본형(Formal). 회색 헤더 밴드, 대문자 섹션과 가는 밑줄. 수천만 건 작성된 공식 양식.',
      layout: 'single', entryStyle: 'europass', paper: 'a4', marginMm: { tb: 20, lr: 20 },
      nameHp: 36, headingDsize: 1, citeHang: true,
      accent: '#004B80', swatches: ['#004B80', '#4D9ACB', '#0D5942', '#3B9E80', '#6C3088', '#C65094'],
      photo: true, photoIn: 'head', photoShape: 'circle', photoSize: 86, nameStyle: 'plain'
    },
    banking: {
      label: 'Banking / Consulting — 월가 표준 (WSO/M&I)',
      desc: '투자은행·컨설팅 이력서 표준. Times New Roman, 일반 굵기 이름, 이탤릭 직함, 대문자 섹션 + 밑줄.',
      layout: 'single', entryStyle: 'org-first', entryTitleItalic: true, paper: 'letter', marginMm: { tb: 19, lr: 19 }, tightScale: 0.78,
      nameHp: 38, headingDsize: 1, citeHang: false,
      accent: '#000000', swatches: ['#000000'],
      photo: false, nameStyle: 'plain'
    },
    jake: {
      label: "Jake's Resume — 개발자 이력서 표준",
      desc: 'Overleaf/GitHub 개발자 이력서 표준(jakegut/resume). 스몰캡스 섹션 + 얇은 밑줄, 촘촘한 불릿, 0.5인치 여백.',
      layout: 'single', entryStyle: 'title-first', entryStyleEdu: 'org-first', paper: 'letter', marginMm: { tb: 13, lr: 13 }, tightScale: 0.85,
      nameHp: 48, headingDsize: 3, citeHang: true,
      accent: '#000000', swatches: ['#000000'],
      photo: false, nameStyle: 'smallcaps'
    },
    stockholm: {
      label: 'Stockholm — Resume.io 1,700만+ 사용',
      desc: 'Resume.io(현 Essential)의 대표 템플릿. 2단 화이트, 차콜 제목, 파란 스킬 바.',
      layout: 'sidebar', entryStyle: 'stockholm', paper: 'a4', marginMm: { tb: 20, lr: 20 },
      nameHp: 46, headingDsize: 3, citeHang: true,
      accent: '#3095D5', swatches: ['#3095D5', '#E44C4C', '#20C997', '#7950F2', '#F59F00', '#343A40'],
      side: ['skills', 'languages'], sideWidgets: { languages: 'bars' },
      photo: true, photoIn: 'head', photoSize: 62, nameStyle: 'plain'
    },
    cascade: {
      label: 'Cascade — Zety 대표 (네이비 사이드바)',
      desc: 'Zety에서 150만+ 명이 사용한 템플릿. 네이비 사이드바에 인적사항·스킬, 흰 본문.',
      layout: 'sidebar', sideLeft: true, headerIn: 'side', entryStyle: 'title-first', paper: 'a4', marginMm: { tb: 15, lr: 15 }, tightScale: 0.9,
      nameHp: 40, headingDsize: 4, citeHang: true,
      accent: '#1F4E79', swatches: ['#1F4E79', '#163A57', '#343A40', '#0F6674', '#7A263A', '#2E5E33'],
      side: ['skills', 'languages', 'certifications', 'memberships'],
      photo: true, photoIn: 'side', nameStyle: 'plain'
    },
    canva: {
      label: 'Canva Style — 파스텔 사이드바',
      desc: 'Canva(월 2.6억 사용자) 이력서 템플릿의 대표적인 미학. 연회색 사이드바, 자간 넓은 대문자 이름, 얇은 구분선.',
      layout: 'sidebar', entryStyle: 'title-first', paper: 'a4', marginMm: { tb: 18, lr: 18 },
      nameHp: 40, headingDsize: 2, citeHang: true,
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

  /* ---------- 간격 상수 (미리보기·Word 공용 단일 소스) ----------
   * 값은 twip(1pt = 20twip). 미리보기는 px(= twip/15)로 환산해 CSS 변수로 사용.
   * 줄 높이는 양쪽 모두 폰트 기본(single)을 사용 — 줄 간격 옵션은 문단 사이 간격만 조절.
   */
  var DENSITY = { compact: 0.68, normal: 1, relaxed: 1.35 };
  var SP_BASE = { line: 20, block: 110, tight: 40, headBefore: 220, headAfter: 90, cite: 80 };

  // 글자 크기 (half-point 단위, 24 = 12pt) — 미리보기(px 환산)와 Word가 동일 표 사용
  var SIZES = {
    small:  { base: 21, title: 23, meta: 19 },   // 10.5pt
    medium: { base: 22, title: 24, meta: 20 },   // 11pt
    large:  { base: 24, title: 26, meta: 21 }    // 12pt
  };

  function spacingFor(settings) {
    var s = normalizeSettings(settings);
    var spec = TEMPLATE_SPECS[s.template] || {};
    var m = (DENSITY[s.density] || 1) * (spec.tightScale || 1);
    var sp = {};
    Object.keys(SP_BASE).forEach(function (k) { sp[k] = Math.round(SP_BASE[k] * m); });
    return sp;
  }

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
    // id: 재렌더링/저장 후에도 바뀌지 않는 안정적 식별자 (data-entry-id 로 노출)
    var e = { id: uid() };
    SECTION_DEFS[type].fields.forEach(function (f) {
      if (f.def != null) e[f.key] = f.def;
      else if (f.type === 'select' && f.options && f.options.length) e[f.key] = f.options[0][0];
      else e[f.key] = '';
    });
    return e;
  }

  // 학력 제목 앞에 흔히 직접 써 넣던 라벨 (예전 데이터 이관 및 이중 접두어 방지에 사용)
  var THESIS_LABEL_RE = /^(Doctoral Dissertation|Master's Thesis|Master Thesis|Dissertation|Thesis|Capstone Project|Capstone|Graduation Work|Final Project|Honou?rs Thesis)\s*:\s*/i;

  // 저장/가져온 데이터를 현재 스키마로 이관:
  //  1) 각 항목에 안정적 id 부여
  //  2) 학력: 예전엔 라벨 필드가 없어 제목에 "Dissertation: ..." 등을 직접 적었음 → 라벨을 분리해
  //     드롭다운이 실제 접두어와 일치하도록(빈칸으로 보이지 않게) + 이중 접두어 방지
  function migrateData(data) {
    if (!data || !data.sections) return data;
    data.sections.forEach(function (sec) {
      (sec.entries || []).forEach(function (en) {
        if (!en) return;
        if (!en.id) en.id = uid();
        if (sec.type === 'education' && en.thesisLabel == null) {
          var t = trim(en.thesis);
          var m = t && t.match(THESIS_LABEL_RE);
          if (m) { en.thesisLabel = t.slice(0, m[0].length).replace(/\s*:\s*$/, ''); en.thesis = t.slice(m[0].length); }
          else { en.thesisLabel = 'Dissertation'; }   // 예전 기본 동작 유지 + 드롭다운에 표시
        }
      });
    });

    // 앱 업데이트로 새로 생긴 기본 섹션을 기존 프로필에도 추가.
    // 기존 CV 결과가 바뀌지 않도록 항상 꺼진 상태로 넣고, 기본 순서상 앞 섹션 뒤에 배치한다.
    var have = {};
    data.sections.forEach(function (s) { if (s) have[s.type] = true; });
    function indexOfType(t) {
      for (var j = 0; j < data.sections.length; j++) if (data.sections[j].type === t) return j;
      return -1;
    }
    DEFAULT_ORDER.forEach(function (type, i) {
      if (have[type] || !SECTION_DEFS[type]) return;
      var at = -1, k, idx;
      for (k = i - 1; k >= 0 && at < 0; k--) {          // 앞쪽에 있는 기본 섹션 뒤에
        idx = indexOfType(DEFAULT_ORDER[k]);
        if (idx >= 0) at = idx + 1;
      }
      for (k = i + 1; k < DEFAULT_ORDER.length && at < 0; k++) {  // 없으면 뒤쪽 기본 섹션 앞에
        idx = indexOfType(DEFAULT_ORDER[k]);
        if (idx >= 0) at = idx;
      }
      if (at < 0) at = data.sections.length;
      data.sections.splice(at, 0, newSection(type, null, false));
      have[type] = true;
    });
    return data;
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
    var sections = DEFAULT_ORDER.map(function (t) { return newSection(t, null, !SECTION_DEFS[t].defaultOff); });
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
      if (f.type === 'select' || f.type === 'combo') continue;
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
      if (opts.href) r.href = opts.href;   // 하이퍼링크 (HTML <a> / Word ExternalHyperlink)
    }
    return r;
  }

  // 항목 끝에 붙는 [Link] 런
  function linkRun(url) { return R('[Link]', { href: webHref(url) }); }

  // 런 목록 끝에 [Link] 이어 붙이기 (이미 공백으로 끝나면 공백을 더하지 않음 → Word에서 이중 공백 방지)
  function withLink(runs, url) {
    var last = runs[runs.length - 1];
    var sep = (last && /\s$/.test(String(last.t))) ? [] : [R(' ')];
    return runs.concat(sep, [linkRun(url)]);
  }

  // 항목의 마지막 줄(또는 인용문) 끝에 [Link] 추가
  function appendLink(vm, url) {
    if (!vm || !trim(url)) return vm;
    if (vm.cite) vm.cite = withLink(vm.cite, url);
    else if (vm.lines && vm.lines.length) vm.lines[vm.lines.length - 1].left = withLink(vm.lines[vm.lines.length - 1].left, url);
    else if (vm.lines) vm.lines.push({ left: [linkRun(url)], right: null });
    return vm;
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
      if (trim(e.thesis)) {
        var thesis = trim(e.thesis);
        if (e.thesisLabel == null) {
          // 예전 데이터(라벨 필드 없음, 주로 공개 뷰어): 제목 앞에 이미 라벨을 직접 써 둔 경우
          // (예: "Graduation Work: ...", "Thesis: ...")는 그대로 두어 이중 접두어를 막고,
          // 그렇지 않으면 기존 동작대로 "Dissertation:" 을 붙인다. (편집기는 migrateData가 라벨을 분리함)
          var m = thesis.match(THESIS_LABEL_RE);
          if (m) details.push([RB(thesis.slice(0, m[0].length)), R(thesis.slice(m[0].length))]);
          else details.push([RB('Dissertation: '), R(thesis)]);
        } else {
          // 라벨은 사용자가 지정(Dissertation/Thesis/Capstone/직접 입력); 비우면 접두어 없이 제목만.
          var tlabel = trim(e.thesisLabel);
          if (tlabel) {
            // 제목이 같은 라벨로 시작하면(직접 중복 입력) 이중 접두어 방지
            var dup = new RegExp('^' + tlabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*', 'i');
            details.push([RB(tlabel + ': '), R(thesis.replace(dup, ''))]);
          } else {
            details.push([R(thesis)]);
          }
        }
      }
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
      // 프로젝트에는 '기관'이 없다. 기술 스택을 기관 자리에 넣으면 기관 우선 조판(Harvard·Awesome 등)에서
      // 기술 스택이 제목처럼 굵게 나오므로 별도 줄로 분리한다. link는 항목 끝 [Link]로 표시.
      var details = [];
      if (trim(e.tech)) details.push([R(trim(e.tech), { c: 'muted', sz: 'small' })]);
      return { title: title, org: '', loc: '', period: trim(e.period), details: details, bullets: linesOf(e.desc) };
    },
    grants: function (e) {
      var details = [];
      if (trim(e.desc)) details.push([R(e.desc)]);
      // titlePrimary: 기관 우선 조판에서도 과제명이 굵게 앞서도록 (지원 기관이 제목처럼 보이는 것 방지)
      return { title: trim(e.name), org: trim(e.funder), loc: joinParts([e.role, e.amount], ' · '), period: trim(e.period), details: details, bullets: [], titlePrimary: true };
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
      if (!h.org || h.titlePrimary) {
        // 기관이 없거나(프로젝트) 제목이 우선인 항목(연구비): 항상 '제목 굵게'로 시작해
        // 섹션마다 굵은 줄의 의미가 달라지지 않도록 한다.
        var p1 = []; if (h.title) p1.push(RB(h.title));
        if (h.gpa) p1.push(R((p1.length ? '  ·  ' : '') + h.gpa));
        push(p1, h.period ? [R(h.period)] : null);
        var p2 = []; if (h.org) p2.push(RI(h.org));
        push(p2, h.loc ? [R(h.loc)] : null);
        if (!h.title && !h.org && h.period) push([], [R(h.period)]);
      } else {
        // Harvard/Banking: 기관 굵게 + 지역 오른쪽 / 직함·학위(뱅킹은 이탤릭) + 기간 오른쪽
        var l1 = []; l1.push(RB(h.org));
        push(l1, h.loc ? [R(h.loc)] : null);
        var l2 = [];
        if (h.title) l2.push(R(h.title, spec.entryTitleItalic ? { i: 1 } : null));
        if (h.gpa) l2.push(R((l2.length ? '  ·  ' : '') + h.gpa));
        push(l2, h.period ? [R(h.period)] : null);
      }
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
      if (!h.org || h.titlePrimary) {
        // 기관 없는 항목(프로젝트)·제목 우선 항목(연구비): 제목 굵게 + 기간 오른쪽
        var b1 = []; if (h.title) b1.push(RB(h.title));
        if (h.gpa) b1.push(R('  ·  ' + h.gpa, { c: 'muted' }));
        push(b1, h.period ? [R(h.period, { i: 1, c: 'muted' })] : null);
        var b2 = []; if (h.org) b2.push(R(h.org, { sc: 1, c: 'muted' }));
        push(b2, h.loc ? [R(h.loc, { i: 1, c: 'accent' })] : null);
      } else {
        // Awesome-CV: 기관 굵게 + 지역(강조색 이탤릭) 오른쪽 / 직함 스몰캡스 회색 + 기간(회색 이탤릭) 오른쪽
        var a1 = []; a1.push(RB(h.org));
        push(a1, h.loc ? [R(h.loc, { i: 1, c: 'accent' })] : null);
        var a2 = [];
        if (h.title) a2.push(R(h.title, { sc: 1, c: 'muted' }));
        if (h.gpa) a2.push(R('  ·  ' + h.gpa, { c: 'muted' }));
        push(a2, h.period ? [R(h.period, { i: 1, c: 'muted' })] : null);
      }
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

    // [Link]는 상세줄(지도교수·심사위원 등)보다 앞, 머리줄 끝에 붙인다
    if (trim(h.link)) {
      if (lines.length) lines[lines.length - 1].left = withLink(lines[lines.length - 1].left, h.link);
      else lines.push({ left: [linkRun(h.link)], right: null });
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
      if (trim(e.doi)) { runs.push(R(dot(e.doi), { href: webHref(e.doi) })); runs.push(R(' ')); }
      var st = trim(e.status);
      if (st && st !== 'Published') {
        // 알려진 상태는 관례적 표기로, 직접 입력한 상태는 그대로 표시
        var known = { 'Accepted': 'Accepted, in press', 'Under Review': 'Under review', 'In Preparation': 'In preparation' };
        runs.push(RI('(' + (known[st] || st) + ')'));
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
    conferences: function (e) {
      // 1줄: 행사명(굵게) · 유형        [오른쪽] 날짜
      // 2줄: 역할 · 주최 · 장소   /   3줄: 비고
      var l1 = [];
      if (trim(e.name)) l1.push(RB(e.name));
      if (trim(e.etype)) l1.push(R((l1.length ? '  ·  ' : '') + trim(e.etype)));
      var lines = [{ left: l1, right: trim(e.date) ? [R(e.date)] : null }];
      var l2 = joinParts([e.role, e.organizer, e.location], '  ·  ');
      if (l2) lines.push({ left: [R(l2)], right: null });
      if (trim(e.note)) lines.push({ left: [R(e.note)], right: null });
      return { lines: lines, bullets: [] };
    },
    media: function (e) {
      // 매체명(굵게) · 유형        [오른쪽] 날짜   /   제목·설명
      var l1 = [];
      if (trim(e.outlet)) l1.push(RB(e.outlet));
      if (trim(e.mtype)) l1.push(R((l1.length ? '  ·  ' : '') + trim(e.mtype)));
      var lines = [{ left: l1, right: trim(e.date) ? [R(e.date)] : null }];
      if (trim(e.title)) lines.push({ left: [R(e.title)], right: null });
      return { lines: lines, bullets: [] };
    },
    outreach: function (e) {
      // 행사·대상(굵게) · 역할        [오른쪽] 날짜   /   장소   /   설명
      var l1 = [];
      if (trim(e.event)) l1.push(RB(e.event));
      if (trim(e.role)) l1.push(R((l1.length ? '  ·  ' : '') + trim(e.role)));
      var lines = [{ left: l1, right: trim(e.date) ? [R(e.date)] : null }];
      if (trim(e.location)) lines.push({ left: [R(e.location)], right: null });
      if (trim(e.note)) lines.push({ left: [R(e.note)], right: null });
      return { lines: lines, bullets: [] };
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
          .map(function (e) { return appendLink(VMS.publications(e, settings), e.link); })
          .filter(Boolean);
        if (items.length) groups.push({ label: g[1], numbered: true, items: items });
      });
      if (groups.length === 1) groups[0].label = null;
    } else if (HEADS[section.type]) {
      // 블록형: 구조화 → 템플릿 스타일로 조판
      // 기관을 굵게 앞세우는 조판들 — 프로젝트는 '기관'이 없으므로 프로젝트명을 그 자리에 둔다
      var ORG_FIRST = { 'org-first': 1, awesome: 1, stockholm: 1, europass: 1 };
      var items2 = entries.map(function (e) {
        var h = HEADS[section.type](e);
        h.link = trim(e.link);
        if (section.type === 'projects' && ORG_FIRST[style]) { h.org = trim(e.name); h.title = trim(e.role); }
        var lines = composeHead(style, h, spec);
        if (!lines.length && !h.bullets.length) return null;
        return { lines: lines, bullets: h.bullets };
      }).filter(Boolean);
      if (!items2.length) return null;
      groups = [{ label: null, numbered: false, items: items2 }];
    } else {
      var items3 = entries.map(function (e) { return appendLink(VMS[section.type](e, settings), e.link); }).filter(Boolean);
      if (!items3.length) return null;
      groups = [{ label: null, numbered: false, items: items3 }];
    }
    if (!groups.length) return null;
    return { title: section.title || def.title, tight: !!def.tight, type: section.type, groups: groups };
  }

  /* ---------- 연락처 ----------
   * contactItems(personal, settings) → [[{ text, href? }, ...], ...]  (최대 2줄)
   * settings.linkStyle: 'label'(기본) = LinkedIn·GitHub 등 짧은 라벨 / 'url' = 전체 주소
   * 두 경우 모두 href를 함께 돌려주므로 HTML·Word에서 하이퍼링크로 걸 수 있다.
   */
  function webHref(v) {
    v = trim(v);
    if (!v) return '';
    return /^(https?:|mailto:|tel:)/i.test(v) ? v : 'https://' + v;
  }
  function stripUrl(v) {   // 프로토콜·www·끝 슬래시 제거 (경로는 유지)
    return trim(v).replace(/^(https?:\/\/)?(www\.)?/i, '').replace(/\/+$/, '');
  }
  function hostOnly(v) { return stripUrl(v).split('/')[0]; }
  function orcidId(v) {
    return trim(v).replace(/^(https?:\/\/)?(www\.)?orcid\.org\//i, '').replace(/\/+$/, '');
  }

  function contactItems(personal, settings) {
    var p = personal || {};
    var labelMode = ((settings || {}).linkStyle || 'label') !== 'url';
    var line1 = [], line2 = [];
    function add(arr, text, href, icon) {
      text = trim(text);
      if (!text) return;
      var it = { text: text };
      if (href) it.href = href;
      if (icon) it.icon = icon;
      arr.push(it);
    }
    // 1줄(이메일·전화·주소)은 내용만으로 무엇인지 알 수 있어 아이콘을 붙이지 않는다.
    add(line1, p.email, trim(p.email) ? 'mailto:' + trim(p.email) : '', '');
    add(line1, p.phone, trim(p.phone) ? 'tel:' + trim(p.phone).replace(/[^+\d]/g, '') : '', '');
    add(line1, p.pronouns, '', '');
    add(line1, p.address, '', '');

    // 웹사이트는 라벨 모드에서도 도메인을 남긴다(짧고 본인 식별에 쓰이므로)
    if (trim(p.website)) add(line2, labelMode ? hostOnly(p.website) : stripUrl(p.website), webHref(p.website), 'globe');
    if (trim(p.linkedin)) add(line2, labelMode ? 'LinkedIn' : stripUrl(p.linkedin), webHref(p.linkedin), 'linkedin');
    if (trim(p.github)) add(line2, labelMode ? 'GitHub' : stripUrl(p.github), webHref(p.github), 'github');
    if (trim(p.scholar)) add(line2, labelMode ? 'Google Scholar' : stripUrl(p.scholar), webHref(p.scholar), 'scholar');
    var oid = orcidId(p.orcid);
    if (oid) add(line2, labelMode ? 'ORCID' : 'ORCID: ' + oid, 'https://orcid.org/' + oid, 'orcid');

    var out = [];
    if (line1.length) out.push(line1);
    if (line2.length) out.push(line2);
    return out;
  }

  // 평문 버전 (하이퍼링크가 필요 없는 곳)
  function contactLines(personal, settings) {
    return contactItems(personal, settings).map(function (items) {
      return items.map(function (it) { return it.text; }).join('  |  ');
    });
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
    SIZES: SIZES, DENSITY: DENSITY, spacingFor: spacingFor,
    TEMPLATE_SPECS: TEMPLATE_SPECS, TEMPLATE_MIGRATE: TEMPLATE_MIGRATE, normalizeSettings: normalizeSettings,
    newProfileData: newProfileData, newSection: newSection, emptyEntry: emptyEntry,
    migrateData: migrateData,
    isEntryEmpty: isEntryEmpty, nonEmptyEntries: nonEmptyEntries,
    sectionContent: sectionContent, contactLines: contactLines, contactItems: contactItems, sampleData: sampleData
  };
});
