/* =========================================================================
 * app.js — CV Builder UI: 에디터, 실시간 미리보기, 저장/불러오기, 내보내기
 * ========================================================================= */
(function () {
  'use strict';
  var M = window.CVModel;
  var LS_KEY = 'cvbuilder.v1';

  /* ---------------- 저장소 ---------------- */
  var store = null;

  function loadStore() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && Array.isArray(s.profiles) && s.profiles.length) {
          s.profiles.forEach(function (pr) { pr.settings = M.normalizeSettings(pr.settings); });
          return s;
        }
      }
    } catch (e) { console.warn('저장소 로드 실패:', e); }
    var p = newProfile('내 CV');
    return { profiles: [p], currentId: p.id };
  }

  function newProfile(name, data, settings) {
    return {
      id: M.uid(), name: name || '새 CV',
      data: data || M.newProfileData(),
      settings: M.normalizeSettings(settings),
      updatedAt: Date.now()
    };
  }

  function P() {
    for (var i = 0; i < store.profiles.length; i++)
      if (store.profiles[i].id === store.currentId) return store.profiles[i];
    store.currentId = store.profiles[0].id;
    return store.profiles[0];
  }

  var saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 350);
  }
  function persist() {
    clearTimeout(saveTimer); saveTimer = null;
    P().updatedAt = Date.now();
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(store));
      var d = new Date();
      var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2), ss = ('0' + d.getSeconds()).slice(-2);
      el('save-status').textContent = '✓ 저장됨 ' + hh + ':' + mm + ':' + ss + (fsync.linked && fsync.granted ? ' · 파일 동기화 중' : '');
    } catch (e) {
      el('save-status').textContent = '⚠ 저장 실패 — 브라우저 저장 공간을 확인하세요';
    }
    scheduleFileWrite();
  }
  window.addEventListener('beforeunload', function () { if (saveTimer) persist(); });

  /* ---------------- 파일 동기화 (File System Access API) ----------------
   * Box 등 동기화 폴더 안의 JSON 파일에 자동 저장 → 다른 PC에서 자동 불러오기.
   * 최신 데이터 우선(last-write-wins): 프로필 updatedAt 최댓값으로 비교.
   */
  var fsync = { supported: typeof window.showSaveFilePicker === 'function', handle: null, linked: false, granted: false };

  function idbOp(mode, fn) {
    return new Promise(function (resolve, reject) {
      var rq = indexedDB.open('cvbuilder-fs', 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore('kv'); };
      rq.onerror = function () { reject(rq.error); };
      rq.onsuccess = function () {
        var tx = rq.result.transaction('kv', mode);
        var out = fn(tx.objectStore('kv'));
        tx.oncomplete = function () { resolve(out && out.result); };
        tx.onerror = function () { reject(tx.error); };
      };
    });
  }
  function idbGet(key) { return idbOp('readonly', function (s) { return s.get(key); }); }
  function idbSet(key, val) { return idbOp('readwrite', function (s) { s.put(val, key); }); }
  function idbDel(key) { return idbOp('readwrite', function (s) { s.delete(key); }); }

  function newestStamp(st) {
    var t = 0;
    ((st && st.profiles) || []).forEach(function (p) { if (p.updatedAt > t) t = p.updatedAt; });
    return t;
  }

  var fileWriteTimer = null;
  function scheduleFileWrite() {
    if (!fsync.handle || !fsync.granted) return;
    clearTimeout(fileWriteTimer);
    fileWriteTimer = setTimeout(writeSyncFile, 900);
  }
  function writeSyncFile() {
    if (!fsync.handle || !fsync.granted) return Promise.resolve();
    var payload = { app: 'cv-builder', version: 1, store: store };
    return fsync.handle.createWritable()
      .then(function (w) {
        return w.write(JSON.stringify(payload, null, 2)).then(function () { return w.close(); });
      })
      .catch(function (e) {
        // 조용히 실패하지 않기: 재연결 상태로 전환하고 사용자에게 알림
        console.warn('파일 동기화 쓰기 실패:', e);
        fsync.granted = false;
        renderFsyncButton();
        el('save-status').textContent = '⚠ 파일 동기화 실패 — [파일 다시 연결]을 눌러 주세요';
      });
  }

  // 탭을 닫거나 전환할 때 대기 중인 파일 쓰기를 즉시 실행
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && fileWriteTimer) {
      clearTimeout(fileWriteTimer); fileWriteTimer = null;
      writeSyncFile();
    }
  });

  function readSyncFile() {
    return fsync.handle.getFile()
      .then(function (f) { return f.text(); })
      .then(function (txt) {
        var payload = JSON.parse(txt);
        var st = payload && payload.store;
        if (st && Array.isArray(st.profiles) && st.profiles.length) {
          st.profiles.forEach(function (pr) { pr.settings = M.normalizeSettings(pr.settings); });
          return st;
        }
        return null;
      })
      .catch(function () { return null; });
  }

  // 파일과 localStorage 중 더 최신 쪽을 채택
  function reconcileSyncFile() {
    return readSyncFile().then(function (fileStore) {
      if (fileStore && newestStamp(fileStore) > newestStamp(store)) {
        store = fileStore;
        localStorage.setItem(LS_KEY, JSON.stringify(store));
        expanded = {};
        renderProfileSelect(); renderEditor(); renderControls(); renderPreview();
        el('save-status').textContent = '✓ 동기화 파일에서 최신 데이터를 불러왔습니다';
      } else {
        writeSyncFile();
      }
    });
  }

  function renderFsyncButton() {
    var b = el('btn-fsync');
    if (!fsync.supported) { b.style.display = 'none'; return; }
    if (!fsync.linked) {
      b.textContent = '폴더에 자동 저장';
      b.title = 'Box 등 동기화 폴더의 JSON 파일에 자동 저장하면 다른 컴퓨터에서도 이어서 작성할 수 있습니다';
    } else if (!fsync.granted) {
      b.textContent = '⚠ 파일 다시 연결';
      b.title = '브라우저를 다시 열면 권한 확인이 한 번 필요합니다. 클릭하여 다시 연결하세요.';
    } else {
      b.textContent = '파일 동기화 중';
      b.title = '자동 저장 중입니다. 클릭하면 동기화를 해제합니다';
    }
  }

  function bindFsync() {
    var b = el('btn-fsync');
    renderFsyncButton();
    if (!fsync.supported) return;

    b.addEventListener('click', function () {
      if (!fsync.linked) {
        window.showSaveFilePicker({
          suggestedName: 'cv-builder-data.json',
          types: [{ description: 'CV Builder 데이터', accept: { 'application/json': ['.json'] } }]
        }).then(function (handle) {
          fsync.handle = handle; fsync.linked = true; fsync.granted = true;
          return idbSet('handle', handle).then(reconcileSyncFile).then(renderFsyncButton);
        }).catch(function (e) {
          if (e && e.name !== 'AbortError') {
            alert('이 브라우저에서는 파일 연결을 사용할 수 없습니다.\n(' + e.message + ')\nJSON 내보내기·가져오기를 이용하세요.');
          }
        });
      } else if (!fsync.granted) {
        fsync.handle.requestPermission({ mode: 'readwrite' }).then(function (perm) {
          if (perm === 'granted') {
            fsync.granted = true;
            reconcileSyncFile().then(renderFsyncButton);
          }
        });
      } else {
        if (!confirm('파일 자동 저장을 해제하시겠습니까? 파일은 삭제되지 않습니다.')) return;
        fsync.handle = null; fsync.linked = false; fsync.granted = false;
        idbDel('handle').then(renderFsyncButton);
      }
    });

    // 이전에 연결한 파일 복원
    idbGet('handle').then(function (handle) {
      if (!handle) return;
      fsync.handle = handle; fsync.linked = true;
      return handle.queryPermission({ mode: 'readwrite' }).then(function (perm) {
        if (perm === 'granted') {
          fsync.granted = true;
          return reconcileSyncFile();
        }
      });
    }).catch(function (e) { console.warn('파일 동기화 초기화 실패:', e); }).then(renderFsyncButton);
  }

  /* ---------------- 유틸 ---------------- */
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  var previewTimer = null;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 120);
  }

  var expanded = {};       // 섹션 접힘 상태 (메모리)
  var PERSONAL_ID = '__personal__';

  // 한 항목에서 사용자가 채운 텍스트 칸 수 (드롭다운/직접입력 목록은 제외)
  function fillStat(type, entry) {
    var fields = (M.SECTION_DEFS[type] || {}).fields || [];
    var tot = 0, fil = 0;
    fields.forEach(function (f) {
      if (f.type === 'select' || f.type === 'combo') return;
      tot++;
      if (M.trim(entry[f.key])) fil++;
    });
    return { fil: fil, tot: tot };
  }

  /* ================= 에디터 렌더링 ================= */
  function renderEditor() {
    var d = P().data;
    M.migrateData(d);          // 항목 id 보장(data-entry-id) + 예전 학력 라벨 분리
    var html = '';

    html += '<div class="editor-note">모든 섹션이 기본 포함됩니다. 스위치로 포함 여부를 조절하며, 내용이 없는 섹션은 미리보기와 Word 출력에서 자동 제외됩니다.</div>';

    /* 인적사항 카드 */
    var pOpen = expanded[PERSONAL_ID] !== false;
    html += '<div class="card' + (pOpen ? '' : ' collapsed') + '" data-card="' + PERSONAL_ID + '">';
    html += '<div class="card-head" data-act="collapse" data-sec="' + PERSONAL_ID + '">';
    html += '<span class="chev">' + (pOpen ? '▼' : '▶') + '</span>';
    html += '<span style="flex:1;font-weight:600;">인적사항·연락처</span><span class="ko-label">Personal Info</span>';
    html += '</div><div class="card-body">';
    html += '<div class="photo-row">';
    if (d.personal.photo) {
      html += '<img class="photo-thumb" data-act="photo-pick" title="클릭하여 사진 변경" src="' + d.personal.photo + '" alt="photo">';
    } else {
      html += '<div class="photo-thumb empty" data-act="photo-pick" title="클릭하여 사진 업로드">👤</div>';
    }
    html += '<button class="tb-btn" style="color:#2c3648;background:#eef1f6;border-color:#d6dbe3" data-act="photo-pick" type="button">사진 업로드</button>';
    if (d.personal.photo) html += '<button class="mini-btn del" data-act="photo-del" title="사진 제거" type="button">✕</button>';
    html += '<span class="photo-hint">10개 템플릿 중 7개와 공개 페이지 상단에서 지원됩니다. Harvard·Banking·Jake\'s는 관례상 사진을 넣지 않습니다.</span>';
    html += '</div>';
    html += '<div class="fgrid">';
    M.PERSONAL_FIELDS.forEach(function (f) {
      var w = (f[0] === 'title') ? 'full' : 'half';
      var pid = 'f-personal-' + f[0];
      html += '<div class="fitem ' + w + '"><label for="' + pid + '">' + esc(f[1]) + '</label>';
      html += '<input type="text" id="' + pid + '" data-pfield="' + f[0] + '" value="' + esc(d.personal[f[0]] || '') + '" placeholder="' + esc(f[2]) + '">';
      html += '</div>';
    });
    html += '</div></div></div>';

    /* 섹션 카드들 */
    d.sections.forEach(function (sec, si) {
      var def = M.SECTION_DEFS[sec.type];
      if (!def) return;
      var open = !!expanded[sec.id];
      var n = M.nonEmptyEntries(sec).length;
      html += '<div class="card' + (open ? '' : ' collapsed') + (sec.enabled ? '' : ' off') + '" data-card="' + sec.id + '">';
      html += '<div class="card-head" data-act="collapse" data-sec="' + sec.id + '">';
      html += '<span class="chev">' + (open ? '▼' : '▶') + '</span>';
      html += '<label class="switch" title="CV 포함 여부" data-stop="1"><input type="checkbox" data-act="toggle" data-sec="' + sec.id + '"' + (sec.enabled ? ' checked' : '') + '><span class="knob"></span></label>';
      html += '<input class="sec-title" data-stop="1" data-act="rename" data-sec="' + sec.id + '" value="' + esc(sec.title) + '" title="섹션 제목 (CV에 표시)">';
      html += '<span class="ko-label">' + esc(def.ko) + '</span>';
      html += '<span class="badge" title="작성된 항목 수">' + n + '</span>';
      html += '<button class="mini-btn" data-act="sec-up" data-sec="' + sec.id + '" title="위로">↑</button>';
      html += '<button class="mini-btn" data-act="sec-down" data-sec="' + sec.id + '" title="아래로">↓</button>';
      if (sec.type === 'custom') html += '<button class="mini-btn del" data-act="sec-del" data-sec="' + sec.id + '" title="섹션 삭제">✕</button>';
      html += '</div>';
      html += '<div class="card-body">';
      sec.entries.forEach(function (entry, ei) {
        html += '<div class="entry-box" data-entry-id="' + entry.id + '" data-sec="' + sec.id + '">';
        if (!def.single) {
          var fs = fillStat(sec.type, entry);
          html += '<div class="entry-tools">';
          html += '<span class="entry-fill" data-entry-fill="' + entry.id + '" title="입력한 칸 수">입력 ' + fs.fil + '/' + fs.tot + '</span>';
          html += '<button class="mini-btn" data-act="entry-up" data-sec="' + sec.id + '" data-idx="' + ei + '" title="위로" aria-label="이 항목 위로 이동">↑</button>';
          html += '<button class="mini-btn" data-act="entry-down" data-sec="' + sec.id + '" data-idx="' + ei + '" title="아래로" aria-label="이 항목 아래로 이동">↓</button>';
          html += '<button class="mini-btn del" data-act="entry-del" data-sec="' + sec.id + '" data-idx="' + ei + '" title="항목 삭제" aria-label="이 항목 삭제">✕</button>';
          html += '</div>';
        }
        html += '<div class="fgrid">';
        def.fields.forEach(function (f) {
          var fid = 'f-' + entry.id + '-' + f.key;
          html += '<div class="fitem ' + f.w + '"><label for="' + fid + '">' + esc(f.label) + '</label>';
          var common = ' id="' + fid + '" data-sec="' + sec.id + '" data-idx="' + ei + '" data-entry-id="' + entry.id + '" data-field="' + f.key + '"';
          var val = entry[f.key] == null ? '' : entry[f.key];
          if (f.type === 'textarea') {
            html += '<textarea' + common + ' placeholder="' + esc(f.ph) + '">' + esc(val) + '</textarea>';
          } else if (f.type === 'select') {
            html += '<select' + common + '>';
            (f.options || []).forEach(function (o) {
              html += '<option value="' + esc(o[0]) + '"' + (val === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
            });
            html += '</select>';
          } else if (f.type === 'combo') {
            // 목록 + 직접 입력 겸용 (native combobox)
            var listId = 'dl-' + entry.id + '-' + f.key;
            html += '<input type="text"' + common + ' list="' + listId + '" value="' + esc(val) + '" placeholder="' + esc(f.ph) + '" autocomplete="off">';
            html += '<datalist id="' + listId + '">';
            (f.options || []).forEach(function (o) {
              html += '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>';
            });
            html += '</datalist>';
          } else {
            html += '<input type="text"' + common + ' value="' + esc(val) + '" placeholder="' + esc(f.ph) + '">';
          }
          html += '</div>';
        });
        html += '</div></div>';
      });
      if (!def.single) {
        // 접근성: aria-label은 화면에 보이는 문구("<ko> 추가")를 그대로 포함해야 함 (WCAG 2.5.3 Label in Name)
        var addLabel = '+ ' + esc(def.ko) + ' 추가';
        var addAria = esc(def.ko) + ' 추가 — ' + esc(sec.title || def.title) + ' 섹션에 항목 추가';
        html += '<button class="add-entry" data-act="entry-add" data-sec="' + sec.id + '" data-add-for="' + sec.type + '" aria-label="' + addAria + '">' + addLabel + '</button>';
      }
      html += '</div></div>';
    });

    html += '<button id="add-custom" data-act="custom-add">+ 사용자 지정 섹션 추가</button>';
    el('editor-pane').innerHTML = html;
  }

  function findSection(id) {
    var arr = P().data.sections;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return { sec: arr[i], idx: i };
    return null;
  }

  // 새 항목 추가 후: 해당 항목으로 스크롤 + 첫 칸 포커스 + 잠깐 하이라이트
  function focusNewEntry(id) {
    var pane = el('editor-pane');
    var box = pane.querySelector('[data-entry-id="' + id + '"]');
    if (!box) return;
    box.classList.add('entry-new');
    try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { box.scrollIntoView(); }
    var first = box.querySelector('input, textarea, select');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e2) { first.focus(); } }
    setTimeout(function () { box.classList.remove('entry-new'); }, 1600);
  }

  /* 에디터 이벤트 (위임) */
  function bindEditor() {
    var pane = el('editor-pane');

    pane.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t.dataset.pfield) {
        P().data.personal[t.dataset.pfield] = t.value;
      } else if (t.dataset.field) {
        var f = findSection(t.dataset.sec);
        if (!f) return;
        var entry = f.sec.entries[+t.dataset.idx];
        if (!entry) return;
        entry[t.dataset.field] = t.value;
        // 섹션 배지(작성된 항목 수) 실시간 갱신
        var badge = pane.querySelector('[data-card="' + t.dataset.sec + '"] .badge');
        if (badge) badge.textContent = M.nonEmptyEntries(f.sec).length;
        // 항목별 "채운 칸 수" 실시간 갱신
        var fillEl = pane.querySelector('[data-entry-fill="' + entry.id + '"]');
        if (fillEl) { var fst = fillStat(f.sec.type, entry); fillEl.textContent = '입력 ' + fst.fil + '/' + fst.tot; }
      } else if (t.dataset.act === 'rename') {
        var f2 = findSection(t.dataset.sec);
        if (f2) f2.sec.title = t.value;
      } else return;
      scheduleSave(); schedulePreview();
    });

    pane.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.dataset.act === 'toggle') {
        var f = findSection(t.dataset.sec);
        if (!f) return;
        f.sec.enabled = t.checked;
        var card = pane.querySelector('[data-card="' + t.dataset.sec + '"]');
        if (card) card.classList.toggle('off', !t.checked);
        scheduleSave(); schedulePreview();
      }
    });

    pane.addEventListener('click', function (ev) {
      var stopEl = ev.target.closest('[data-stop]');
      var head = ev.target.closest('[data-act="collapse"]');
      var btn = ev.target.closest('button[data-act], .photo-thumb[data-act]');

      if (btn) {
        var act = btn.dataset.act, secId = btn.dataset.sec, idx = +btn.dataset.idx;
        var f = secId ? findSection(secId) : null;
        var arr = P().data.sections;
        var focusEntryId = null;   // 새로 추가한 항목 → 렌더 후 스크롤·포커스·하이라이트
        if (act === 'sec-up' && f && f.idx > 0) {
          arr.splice(f.idx - 1, 0, arr.splice(f.idx, 1)[0]);
        } else if (act === 'sec-down' && f && f.idx < arr.length - 1) {
          arr.splice(f.idx + 1, 0, arr.splice(f.idx, 1)[0]);
        } else if (act === 'sec-del' && f) {
          if (!confirm('이 사용자 지정 섹션을 삭제하시겠습니까?')) return;
          arr.splice(f.idx, 1);
        } else if (act === 'entry-add' && f) {
          var ne = M.emptyEntry(f.sec.type);
          f.sec.entries.push(ne);
          expanded[secId] = true;
          focusEntryId = ne.id;
        } else if (act === 'entry-del' && f) {
          // 내용이 있는 항목은 항상 확인 (항목이 하나뿐이어도 조용히 지우지 않음)
          if (!M.isEntryEmpty(f.sec.type, f.sec.entries[idx]) && !confirm('이 항목을 삭제하시겠습니까?')) return;
          if (f.sec.entries.length === 1) f.sec.entries = [M.emptyEntry(f.sec.type)];
          else f.sec.entries.splice(idx, 1);
        } else if (act === 'entry-up' && f && idx > 0) {
          f.sec.entries.splice(idx - 1, 0, f.sec.entries.splice(idx, 1)[0]);
        } else if (act === 'entry-down' && f && idx < f.sec.entries.length - 1) {
          f.sec.entries.splice(idx + 1, 0, f.sec.entries.splice(idx, 1)[0]);
        } else if (act === 'custom-add') {
          var s = M.newSection('custom', 'New Section', true);
          P().data.sections.push(s);
          expanded[s.id] = true;
          focusEntryId = s.entries[0] && s.entries[0].id;
        } else if (act === 'photo-pick') {
          el('photo-file').click();
          return;
        } else if (act === 'photo-del') {
          delete P().data.personal.photo;
          delete P().data.personal.photoW;
          delete P().data.personal.photoH;
        } else {
          return;
        }
        scheduleSave(); renderEditor(); schedulePreview();
        if (focusEntryId) focusNewEntry(focusEntryId);
        return;
      }

      if (head && !stopEl) {
        var id = head.dataset.sec;
        if (id === PERSONAL_ID) expanded[id] = expanded[id] === false ? true : false;
        else expanded[id] = !expanded[id];
        var card = pane.querySelector('[data-card="' + id + '"]');
        if (card) {
          var isOpen = (id === PERSONAL_ID) ? expanded[id] !== false : !!expanded[id];
          card.classList.toggle('collapsed', !isOpen);
          var chev = card.querySelector('.chev');
          if (chev) chev.textContent = isOpen ? '▼' : '▶';
        }
      }
    });
  }

  /* ================= 미리보기 렌더링 (공용 렌더러 사용) ================= */

  // 섹션/블록/헤더 HTML 생성은 cv-render.js(CVRender)로 이동 — 공개 페이지와 공유

  var PAPER_PX = window.CVRender.PAPER_PX;

  function renderPreview() {
    var prof = P();
    var r = window.CVRender.renderCv(prof.data, prof.settings);
    var page = el('cv-page');
    page.className = r.className;
    page.style.setProperty('--accent', r.accent);
    page.innerHTML = r.empty
      ? '<div class="empty-hint">왼쪽에 내용을 입력하면 CV가 실시간으로 표시됩니다.<br>상단 [샘플 데이터]로 예시를 채워 볼 수 있습니다.</div>'
      : r.html;
    page._paper = r.paper;
    page._empty = r.empty;
    setPrintPaper(prof.settings);
    layoutPreview();
    // 사진 로드 후 페이지 분할·높이 재계산
    page.querySelectorAll('img').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', layoutPreview, { once: true });
    });
  }

  // 미리보기 페이지 분할 + 배율 맞춤. 실제 인쇄(PDF)는 여백 있는 여러 장으로 나오므로,
  // 편집기 미리보기도 페이지 사이에 실제 여백(위/아래)을 보여 준다(뒷장이 맨 위에 붙는 문제 해결).
  function layoutPreview() {
    var page = el('cv-page');
    page.style.transform = '';   // 측정은 배율 1 상태에서
    Array.prototype.forEach.call(page.querySelectorAll('.pg-spacer, .pagebreak-marker'), function (n) { n.remove(); });
    if (!page._empty) {
      var paper = PAPER_PX[page._paper || 'a4'] || PAPER_PX.a4;
      // 2단(사이드바) 레이아웃은 열 분할이 어려워 경계선만 표시
      if (page.querySelector('.cols')) addPageMarkers({ paper: page._paper });
      else paginatePreview(page, paper);
    }
    fitPreview();
  }

  // 콘텐츠를 용지 높이에 맞춰 나누고, 페이지 경계마다 여백(spacer)을 끼워 넣는다.
  // 인쇄와 비슷하게: 섹션의 (제목+첫 항목)은 함께 유지하고 둘째 항목부터 사이에서 나눈다.
  // 인쇄 시 spacer는 숨겨진다(@media print).
  function paginatePreview(page, paper) {
    var cs = getComputedStyle(page);
    var padTop = parseFloat(cs.paddingTop) || 0;
    var padBottom = parseFloat(cs.paddingBottom) || 0;
    var availH = paper.h - padTop - padBottom;
    if (availH < 220) return;
    if (page.scrollHeight <= paper.h + 2) return;   // 한 페이지면 분할 불필요

    function isSec(el) { return !!(el.classList && el.classList.contains('cv-sec')); }

    // 분할 지점: { before(이 요소 앞에서 나눔), test(넘침 판정 기준 요소) }
    // 섹션은 제목+첫 항목을 함께 두고, 그리드 레이아웃(예: 2단 references) 섹션은 통째로 취급.
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

    var GUTTER = 26;                                 // 시트 사이 회색 간격
    var pageTop = page.getBoundingClientRect().top;
    var curBottom = pageTop + padTop + availH;        // 현재 페이지 콘텐츠 하단(화면 y)
    var firstOnPage = 0, pageNo = 1, guard = 0;

    // 방금 배치된 블록 이후의 다음 페이지 하단(화면 y). 한 페이지보다 큰 리프는 페이지 경계를 넘겨 잡는다.
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
      if (tr.bottom <= curBottom + 0.5) continue;      // 현재 페이지에 들어감
      if (i === firstOnPage) {                          // 첫 블록이라 앞에서 못 나눔 → 다음 경계만 갱신
        curBottom = bottomAfter(p.before, p.before.getBoundingClientRect().top);
        firstOnPage = i + 1; continue;
      }
      guard++;
      var br = p.before.getBoundingClientRect();
      // p.before 앞에서 페이지 나눔: 이전 페이지 남은 여백 + 시트 간격 + 다음 페이지 위 여백
      var h = (curBottom + padBottom + GUTTER + padTop) - br.top;
      if (h < GUTTER + 8) h = GUTTER + 8;              // 최소한 거터+라벨은 보이게
      var grayEnd = Math.max(padTop + 2, Math.min(h - 2, h - padTop));   // 다음 시트 위 여백 시작
      var whiteBot = Math.max(0, Math.min(grayEnd - 2, h - GUTTER - padTop)); // 이전 시트 끝(흰색)
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

  function fitPreview() {
    var wrap = el('page-wrap'), page = el('cv-page'), scroll = el('preview-scroll');
    var pw = page.offsetWidth || 794; // transform과 무관한 레이아웃 폭 (용지별 794/816)
    var avail = scroll.clientWidth - 44;
    var scale = Math.min(1, avail / pw);
    // 모바일에서 글자가 읽히도록 최소 배율 유지 — 넘치는 폭은 preview-scroll에서 가로 스크롤
    if (scale < 0.62) scale = 0.62;
    page.style.transform = scale < 1 ? 'scale(' + scale + ')' : '';
    wrap.style.width = Math.round(pw * scale) + 'px';
    wrap.style.height = Math.round(page.offsetHeight * scale) + 'px';
  }
  window.addEventListener('resize', fitPreview);

  /* ================= 상단 바 / 프로필 ================= */
  function renderProfileSelect() {
    var sel = el('profile-select');
    sel.innerHTML = store.profiles.map(function (pr) {
      return '<option value="' + pr.id + '"' + (pr.id === store.currentId ? ' selected' : '') + '>' + esc(pr.name) + '</option>';
    }).join('');
  }

  function switchProfile(id) {
    store.currentId = id;
    expanded = {};
    renderProfileSelect(); renderEditor(); renderControls(); renderPreview();
    persist();
  }

  function bindTopbar() {
    el('profile-select').addEventListener('change', function () { switchProfile(this.value); });

    el('btn-new').addEventListener('click', function () {
      var name = prompt('새 CV 이름:', 'CV ' + (store.profiles.length + 1));
      if (name == null) return;
      var pr = newProfile(M.trim(name) || '새 CV');
      store.profiles.push(pr);
      switchProfile(pr.id);
    });

    el('btn-dup').addEventListener('click', function () {
      var cur = P();
      var pr = newProfile(cur.name + ' (복사본)', JSON.parse(JSON.stringify(cur.data)), JSON.parse(JSON.stringify(cur.settings)));
      store.profiles.push(pr);
      switchProfile(pr.id);
    });

    el('btn-rename').addEventListener('click', function () {
      var name = prompt('CV 이름 변경:', P().name);
      if (name == null || !M.trim(name)) return;
      P().name = M.trim(name);
      renderProfileSelect(); persist();
    });

    el('btn-del').addEventListener('click', function () {
      if (!confirm('"' + P().name + '" CV를 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;
      var id = store.currentId;
      store.profiles = store.profiles.filter(function (pr) { return pr.id !== id; });
      if (!store.profiles.length) store.profiles.push(newProfile('내 CV'));
      switchProfile(store.profiles[0].id);
    });

    el('btn-sample').addEventListener('click', function () {
      // 기존 CV를 덮어쓰지 않고 새 프로필로 추가 (데이터 손실 방지)
      var pr = newProfile('샘플 CV', M.sampleData());
      pr.settings.boldName = 'Hong, G.';
      store.profiles.push(pr);
      switchProfile(pr.id);
    });

    el('btn-json-export').addEventListener('click', function () {
      var pr = P();
      var payload = { app: 'cv-builder', version: 1, profile: { name: pr.name, data: pr.data, settings: pr.settings } };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      downloadBlob(blob, (pr.name || 'CV').replace(/[\\/:*?"<>|]/g, '') + '.cvbuilder.json');
    });

    el('json-file').addEventListener('change', function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var payload = JSON.parse(reader.result);
          // 자동 저장 동기화 파일(cv-builder-data.json: 전체 store)도 가져오기 지원
          if (payload && payload.store && Array.isArray(payload.store.profiles)) {
            var added = null;
            payload.store.profiles.forEach(function (op) {
              if (!op || !op.data) return;
              var np = newProfile((op.name || '가져온 CV'), op.data, M.normalizeSettings(op.settings));
              store.profiles.push(np);
              added = np;
            });
            if (!added) throw new Error('가져올 CV가 없습니다');
            switchProfile(added.id);
            return;
          }
          var prof = payload && payload.profile;
          if (!prof || !prof.data || !Array.isArray(prof.data.sections)) throw new Error('형식이 올바르지 않습니다');
          var pr = newProfile((prof.name || '가져온 CV'), prof.data, M.normalizeSettings(prof.settings));
          store.profiles.push(pr);
          switchProfile(pr.id);
        } catch (e) {
          alert('JSON 파일을 읽을 수 없습니다: ' + e.message);
        }
      };
      reader.readAsText(file, 'utf-8');
    });
    el('btn-json-import').addEventListener('click', function () { el('json-file').click(); });
  }

  /* ================= 미리보기 컨트롤 ================= */
  function renderControls() {
    var s = P().settings;
    var spec = M.TEMPLATE_SPECS[s.template] || {};
    el('ctl-template').value = s.template;
    el('ctl-accent').value = /^#[0-9a-fA-F]{6}$/.test(s.accent || '') ? s.accent : (spec.accent || '#1f4e79');
    el('ctl-size').value = s.fontSize;
    el('ctl-density').value = s.density || 'normal';
    el('ctl-boldname').value = s.boldName || '';
    // 해당 양식의 공식 색상 팔레트 스와치
    var sw = el('swatches');
    var colors = spec.swatches || [];
    sw.innerHTML = colors.length > 1 ? colors.map(function (c) {
      return '<button class="swatch" data-color="' + c + '" style="background:' + c + '" title="' + c + '"></button>';
    }).join('') : '';
  }

  function bindControls() {
    el('ctl-template').innerHTML = M.TEMPLATES.map(function (t) {
      return '<option value="' + t[0] + '">' + esc(t[1]) + '</option>';
    }).join('');

    el('ctl-template').addEventListener('change', function () { applyTemplate(this.value); });
    el('ctl-accent').addEventListener('input', function () { P().settings.accent = this.value; scheduleSave(); schedulePreview(); });
    el('swatches').addEventListener('click', function (ev) {
      var b = ev.target.closest('.swatch');
      if (!b) return;
      P().settings.accent = b.dataset.color;
      el('ctl-accent').value = b.dataset.color;
      scheduleSave(); renderPreview();
    });
    el('ctl-size').addEventListener('change', function () { P().settings.fontSize = this.value; scheduleSave(); renderPreview(); });
    el('ctl-density').addEventListener('change', function () { P().settings.density = this.value; scheduleSave(); renderPreview(); });
    el('ctl-boldname').addEventListener('input', function () { P().settings.boldName = this.value; scheduleSave(); schedulePreview(); });

    el('btn-print').addEventListener('click', function () {
      setPrintPaper(P().settings);
      window.print();
    });

    el('btn-docx').addEventListener('click', function () {
      var btn = this;
      btn.disabled = true; btn.textContent = '생성 중...';
      var pr = P();
      var spec = M.TEMPLATE_SPECS[M.normalizeSettings(pr.settings).template] || {};
      Promise.resolve()
        .then(function () {
          // 원형 사진 템플릿(AltaCV)은 Word용으로 원형 크롭한 PNG를 사용
          if (spec.photoShape === 'circle' && pr.data.personal.photo) {
            return circledPhoto(pr.data.personal.photo).then(function (round) {
              if (!round) return pr.data;
              var d2 = JSON.parse(JSON.stringify(pr.data));
              d2.personal.photo = round.dataUrl;
              d2.personal.photoW = round.size; d2.personal.photoH = round.size;
              return d2;
            });
          }
          return pr.data;
        })
        .then(function (data) {
          var doc = window.CVDocx.buildDoc(data, pr.settings);
          return window.CVDocx.Packer.toBlob(doc);
        })
        .then(function (blob) {
          downloadBlob(blob, window.CVDocx.suggestedFilename(pr.data, pr.name));
        })
        .catch(function (e) {
          console.error(e);
          alert('Word 파일 생성 중 오류가 발생했습니다: ' + e.message);
        })
        .then(function () { btn.disabled = false; btn.textContent = 'Word로 내보내기 (.docx)'; });
    });
  }

  var circledPhoto = window.CVRender.circledPhoto;

  /* ---------------- 사진 업로드 ---------------- */
  function bindPhoto() {
    el('photo-file').addEventListener('change', function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (!file) return;
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        try {
          var MAX = 480;
          var w = img.naturalWidth, h = img.naturalHeight;
          var k = Math.min(1, MAX / Math.max(w, h));
          var cw = Math.round(w * k), ch = Math.round(h * k);
          var cv = document.createElement('canvas');
          cv.width = cw; cv.height = ch;
          cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
          P().data.personal.photo = cv.toDataURL('image/jpeg', 0.86);
          P().data.personal.photoW = cw;
          P().data.personal.photoH = ch;
          scheduleSave(); renderEditor(); schedulePreview();
        } catch (e) { alert('사진을 처리할 수 없습니다: ' + e.message); }
        URL.revokeObjectURL(url);
      };
      img.onerror = function () { URL.revokeObjectURL(url); alert('이미지 파일을 열 수 없습니다.'); };
      img.src = url;
    });
  }

  /* ---------------- 페이지 경계 표시 ---------------- */
  function addPageMarkers(spec) {
    var page = el('cv-page');
    // 용지 높이(96dpi: A4 1123px, Letter 1056px)마다 점선 표시 (Word 기준과는 근사치)
    var paper = PAPER_PX[(spec && spec.paper) || 'a4'] || PAPER_PX.a4;
    var total = page.scrollHeight;
    for (var n = 1; n * paper.h < total - 40; n++) {
      var m = document.createElement('div');
      m.className = 'pagebreak-marker';
      m.style.top = (n * paper.h) + 'px';
      m.innerHTML = '<span>페이지 ' + n + ' 경계</span>';
      page.appendChild(m);
    }
  }

  function applyTemplate(key) {
    var s = P().settings;
    var oldSpec = M.TEMPLATE_SPECS[s.template];
    var spec = M.TEMPLATE_SPECS[key];
    s.template = key;
    // 사용자가 강조색을 바꾸지 않았다면 새 템플릿의 시그니처 색으로 초기화 (커스텀 색은 유지)
    if (spec && (!oldSpec || s.accent === oldSpec.accent)) s.accent = spec.accent;
    renderControls();
    scheduleSave(); renderPreview();
  }

  /* ---------------- 템플릿 갤러리 ---------------- */
  function thumbHtml(spec) {
    var acc = spec.accent === '#000000' ? '#555' : spec.accent;
    var nameLines = '<span class="tl name"' + (spec.layout === 'single' && spec.paper === 'letter' ? ' style="align-self:center;width:55%"' : ' style="width:45%"') + '></span><span class="tl w60"></span>';
    var body = '<span class="tl acc w40"></span><span class="tl w80"></span><span class="tl"></span><span class="tl w60"></span><span class="tl acc w40"></span><span class="tl w80"></span><span class="tl w60"></span>';
    var inner;
    if (spec.layout === 'sidebar') {
      var main = '<div class="t-col">' + (spec.headerIn === 'side' ? body : nameLines + body) + '</div>';
      var side;
      if (spec.sideLeft) {
        side = '<div class="t-side-col dark" style="background:' + acc + '">' +
               '<span class="tl light" style="height:6px;width:70%"></span><span class="tl light w60"></span><span class="tl light w80"></span><span class="tl light w60"></span><span class="tl light w80"></span></div>';
        inner = side + main;
      } else {
        side = '<div class="t-side-col' + (spec.sidebarTint ? ' tint' : '') + '">' +
               '<span class="tl acc w60"></span><span class="tl w80"></span><span class="tl"></span><span class="tl acc w60"></span><span class="tl w80"></span></div>';
        inner = main + side;
      }
    } else if (spec.layout === 'left-dates') {
      inner = '<div class="t-hint"><span class="tl acc" style="width:100%;height:6px;margin-top:14px"></span><span class="tl w60"></span><span class="tl w60"></span><span class="tl acc" style="width:100%;height:6px"></span><span class="tl w60"></span></div>' +
              '<div class="t-col">' + nameLines + body + '</div>';
    } else {
      inner = '<div class="t-col">' + nameLines + body + '</div>';
    }
    return '<div class="thumb" style="--tc:' + acc + '">' + inner + '</div>';
  }

  function renderGallery() {
    var cur = P().settings.template;
    el('tpl-grid').innerHTML = M.TEMPLATES.map(function (t) {
      var spec = M.TEMPLATE_SPECS[t[0]];
      return '<button type="button" class="tpl-card' + (t[0] === cur ? ' active' : '') + '" data-tpl="' + t[0] + '">' +
        thumbHtml(spec) +
        '<div class="t-label">' + esc(spec.label) + (spec.photo ? ' <span class="t-photo" title="사진 지원">📷</span>' : '') + '</div>' +
        '<div class="t-desc">' + esc(spec.desc) + '</div></button>';
    }).join('');
  }

  function bindGallery() {
    el('btn-gallery').addEventListener('click', function () {
      renderGallery();
      el('tpl-modal').classList.remove('hidden');
    });
    el('tpl-modal-close').addEventListener('click', function () { el('tpl-modal').classList.add('hidden'); });
    el('tpl-modal').addEventListener('click', function (ev) {
      if (ev.target === this) this.classList.add('hidden');
      var card = ev.target.closest('.tpl-card');
      if (card) { applyTemplate(card.dataset.tpl); renderGallery(); }
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        el('tpl-modal').classList.add('hidden');
        el('pub-modal').classList.add('hidden');
      }
    });
  }

  /* ---------------- 공개 페이지 게시 ----------------
   * 현재 CV를 cv-publish.json으로 저장소에 올리면 사이트 루트(공개 페이지)에 표시됨.
   * 방법 1: GitHub 토큰(PAT)으로 브라우저에서 바로 게시 (토큰은 이 브라우저에만 저장)
   * 방법 2: 파일로 내려받아 폴더에 넣고 git push
   */
  var GH = { owner: 'th00tames1', repo: 'cv', path: 'cv-publish.json' };

  function publishPayload() {
    var pr = P();
    return {
      app: 'cv-builder', version: 1, publishedAt: new Date().toISOString(),
      profile: { name: pr.name, data: pr.data, settings: pr.settings }
    };
  }

  function pubStatus(msg, ok) {
    var s = el('pub-status');
    s.textContent = msg;
    s.style.color = ok ? '#1a7f37' : '#b3392f';
  }

  // 빈 CV 게시 방지 (다른 브라우저에서 열면 프로필이 비어 있어 실수로 공개본을 지울 수 있음)
  function cvIsEmpty(pr) {
    var p = pr.data.personal || {};
    if (M.trim(p.fullName) || M.trim(p.email)) return false;
    return !pr.data.sections.some(function (s) { return s.enabled && M.nonEmptyEntries(s).length; });
  }

  function publishViaGitHub() {
    if (cvIsEmpty(P())) { pubStatus('빈 CV는 게시할 수 없습니다. 내용을 작성하거나 다른 프로필을 선택하세요.'); return; }
    var pat = el('pub-pat').value.trim() || localStorage.getItem('cvbuilder.pat') || '';
    if (!pat) { pubStatus('GitHub 토큰을 입력하세요. 아래 안내를 참고하세요.'); return; }
    localStorage.setItem('cvbuilder.pat', pat);
    el('pub-pat').value = '';
    renderPubModal();
    pubStatus('게시 중...', true);
    var api = 'https://api.github.com/repos/' + GH.owner + '/' + GH.repo + '/contents/' + GH.path;
    var headers = { 'Authorization': 'Bearer ' + pat, 'Accept': 'application/vnd.github+json' };
    var content = btoa(unescape(encodeURIComponent(JSON.stringify(publishPayload(), null, 2))));
    fetch(api, { headers: headers, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (existing) {
        var body = { message: 'Publish CV (' + new Date().toISOString().slice(0, 16) + ')', content: content };
        if (existing && existing.sha) body.sha = existing.sha;
        return fetch(api, { method: 'PUT', headers: headers, body: JSON.stringify(body) });
      })
      .then(function (r) {
        if (r.ok) {
          localStorage.setItem('cvbuilder.lastPublish', new Date().toISOString());
          renderPubModal();
          var url = 'https://' + GH.owner + '.github.io/' + GH.repo + '/';
          el('pub-status').innerHTML = '✓ 게시가 완료되었습니다. 보통 1~2분, 늦으면 약 10분 후 <a href="' + url + '" target="_blank" rel="noopener">공개 페이지</a>에 반영됩니다.';
          el('pub-status').style.color = '#1a7f37';
        } else if (r.status === 401) {
          pubStatus('토큰이 유효하지 않습니다 (401). 새 토큰을 입력하세요.');
          localStorage.removeItem('cvbuilder.pat'); renderPubModal();
        } else if (r.status === 409) {
          pubStatus('저장 충돌(409)이 발생했습니다. 잠시 후 다시 게시해 주세요.');
        } else {
          return r.json().then(function (j) { pubStatus('게시 실패: ' + (j.message || r.status)); });
        }
      })
      .catch(function (e) { pubStatus('게시 실패: ' + e.message); });
  }

  function renderPubModal() {
    var hasPat = !!localStorage.getItem('cvbuilder.pat');
    el('pub-pat-state').textContent = hasPat ? '✓ 토큰이 저장되어 있습니다' : '저장된 토큰 없음';
    el('btn-pat-del').style.display = hasPat ? '' : 'none';
    var last = localStorage.getItem('cvbuilder.lastPublish');
    var lastTxt = last ? '마지막 게시: ' + new Date(last).toLocaleString('sv-SE').slice(0, 16) : '아직 게시한 적이 없습니다.';
    el('pub-last').textContent = '게시 대상: "' + P().name + '" · ' + lastTxt;
  }

  function bindPublish() {
    el('btn-publish').addEventListener('click', function () {
      renderPubModal();
      pubStatus('');
      el('pub-modal').classList.remove('hidden');
    });
    el('pub-modal-close').addEventListener('click', function () { el('pub-modal').classList.add('hidden'); });
    el('pub-modal').addEventListener('click', function (ev) { if (ev.target === this) this.classList.add('hidden'); });
    el('btn-pub-github').addEventListener('click', publishViaGitHub);
    el('btn-pub-file').addEventListener('click', function () {
      if (cvIsEmpty(P())) { pubStatus('빈 CV는 게시할 수 없습니다. 내용을 작성하거나 다른 프로필을 선택하세요.'); return; }
      var blob = new Blob([JSON.stringify(publishPayload(), null, 2)], { type: 'application/json' });
      downloadBlob(blob, 'cv-publish.json');
      pubStatus('내려받은 cv-publish.json을 저장소 폴더에 넣고 git push 하세요.', true);
    });
    el('btn-pat-del').addEventListener('click', function () {
      localStorage.removeItem('cvbuilder.pat');
      renderPubModal();
      pubStatus('저장된 토큰을 삭제했습니다.', true);
    });
  }

  // 템플릿 용지 규격(A4/Letter)에 맞춰 인쇄 용지 지정
  function setPrintPaper(settings) {
    var spec = M.TEMPLATE_SPECS[M.normalizeSettings(settings).template] || {};
    var st = document.getElementById('print-page-style');
    if (!st) { st = document.createElement('style'); st.id = 'print-page-style'; document.head.appendChild(st); }
    st.textContent = '@media print { @page { size: ' + (spec.paper === 'letter' ? 'Letter' : 'A4') + '; margin: 18mm 17mm; } }';
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 800);
  }

  /* ================= 초기화 ================= */
  store = loadStore();
  renderProfileSelect();
  bindTopbar();
  bindControls();
  bindGallery();
  bindPhoto();
  bindFsync();
  bindPublish();
  renderControls();
  bindEditor();
  renderEditor();
  renderPreview();
  persist();
})();
