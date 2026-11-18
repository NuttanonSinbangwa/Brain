/* WORKDESK shared hub code: storage helpers, accounts (login / register / profile), game registry.
   Used by index.html (Home) and games.html (all tests). Exposes window.WD.

   Storage contract used by the games (unchanged):
     arcade_current_user  -> { username, displayName }
     arcade_users_db      -> { [username]: { username, displayName, passHash, createdAt } }
     arcade_*_scores      -> per-game best scores, keyed by username (or "<username>_<mode>")
   NOTE: everything lives in this browser's localStorage. It separates players on one device;
   it is not server-side security. */
(function () {
    'use strict';

    // ---------- storage ----------
    const KEY_USER = 'arcade_current_user', KEY_DB = 'arcade_users_db', KEY_LOCK = 'workdesk_login_lock', KEY_MUTE = 'workdesk_muted';
    function readJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null) return fallback;
            const v = JSON.parse(raw);
            return v === null || v === undefined ? fallback : v;
        } catch (e) { return fallback; }
    }
    function writeJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
    const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const $ = (id) => document.getElementById(id);

    // ---------- game registry ----------
    const CATS = [
        { id: 'memory', name: 'ความจำและสมาธิ', icon: 'fa-brain', desc: 'จำให้แม่น โฟกัสให้นิ่ง ไม่หลงกับสิ่งรบกวน' },
        { id: 'speed', name: 'ความไวและจังหวะ', icon: 'fa-bolt', desc: 'ตอบสนองไว กะเวลาแม่น คาดการณ์การเคลื่อนที่' },
        { id: 'logic', name: 'ตรรกะและการวางแผน', icon: 'fa-puzzle-piece', desc: 'อนุมาน วางเส้นทาง จับความผิดปกติ' },
        { id: 'pressure', name: 'ตัดสินใจภายใต้แรงกดดัน', icon: 'fa-fire', desc: 'จัดลำดับความสำคัญ ทำหลายอย่างพร้อมกัน' }
    ];

    const pick = (key, u) => { const m = readJSON(key, {}); return has(m, u) ? m[u] : null; };
    const fmtTime = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    const join = (parts) => parts.length ? parts.join(' · ') : null;

    const GAMES = [
        { id: 'memory', href: 'memory.html', cat: 'memory', icon: 'fa-folder-open', chip: 'Visual Memory', title: 'Document Match',
          desc: 'เปิดเอกสารและจับคู่รายการที่ตรงกัน ให้ครบด้วยเวลาและจำนวนครั้งน้อยที่สุด', label: 'เวลาดีที่สุด',
          best: (u) => { const v = pick('arcade_memory_scores', u); return v ? fmtTime(v) : null; } },
        { id: 'pattern', href: 'pattern.html', cat: 'memory', icon: 'fa-pen-to-square', chip: 'Sequence Sync', title: 'Form Sequence',
          desc: 'จำลำดับช่องที่ต้องกรอก แล้วกรอกตามให้ถูกต้อง ลำดับสุ่มใหม่ทุกชุด', label: 'ชุดสูงสุด',
          best: (u) => { const v = pick('arcade_pattern_scores', u); return v ? String(v) : null; } },
        { id: 'pa', href: 'pa.html', cat: 'memory', icon: 'fa-list-ol', chip: 'Optical Scan', title: 'Optical Sync',
          desc: 'ล็อกโฟกัสที่จุดกึ่งกลางตาราง ตรวจจับและกดโหนด 01–25 ให้ไวที่สุด (กดผิดบวกเวลา +1.5 วินาที)', label: 'เวลาดีที่สุด',
          best: (u) => {
              const s = readJSON('arcade_scan_scores', {}), p = [];
              if (s[u + '_STD']) p.push('STD ' + s[u + '_STD'].toFixed(2) + 's');
              if (s[u + '_GLITCH']) p.push('GLITCH ' + s[u + '_GLITCH'].toFixed(2) + 's');
              return join(p);
          } },
        { id: 'filter', href: 'filter.html', cat: 'memory', icon: 'fa-filter', chip: 'Selective Attention', title: 'Focus Filter',
          desc: 'มองเฉพาะลูกศรตัวกลางท่ามกลางตัวรอบข้างที่คอยหลอก กลุ่มลูกศรโผล่ตำแหน่งสุ่มทั้งแนวนอนและแนวตั้ง', label: 'เฉลี่ยดีที่สุด',
          best: (u) => {
              const a = pick('arcade_filter_scores', u), b = pick('arcade_filter_busy_scores', u), p = [];
              if (a) p.push('ปกติ ' + a + 'ms');
              if (b) p.push('พลุกพล่าน ' + b + 'ms');
              return join(p);
          } },

        { id: 'reflex', href: 'reflex.html', cat: 'speed', icon: 'fa-clipboard-check', chip: 'Signal Response', title: 'Approval Queue',
          desc: 'เห็นสถานะเขียวให้อนุมัติ เห็นสีแดงให้ส่งกลับ ยิ่งตัดสินใจเร็วยิ่งดี', label: 'เฉลี่ยดีที่สุด',
          best: (u) => { const v = pick('arcade_reflex_ms', u); return v ? v + ' ms' : null; } },
        { id: 'typing', href: 'typing.html', cat: 'speed', icon: 'fa-keyboard', chip: 'Typing Speed', title: 'Rapid Input',
          desc: 'พิมพ์ข้อความให้เร็วและแม่นยำ เลือกภาษาไทยหรืออังกฤษ และเลือกเวลา 30 / 60 / 120 วินาที', label: 'WPM สูงสุด',
          best: (u) => {
              // keys look like "<username>_<th|en>_<seconds>"; match that exact shape so user "a" never picks up "a_b"
              const t = readJSON('arcade_typing_scores', {}), prefix = u + '_';
              let best = 0;
              Object.keys(t).forEach((k) => {
                  if (k.indexOf(prefix) === 0 && /^(th|en)_\d+$/.test(k.slice(prefix.length)) && t[k] > best) best = t[k];
              });
              return best ? best + ' WPM' : null;
          } },
        { id: 'chrono', href: 'chrono.html', cat: 'speed', icon: 'fa-hourglass-half', chip: 'Time Sense', title: 'Deadline Sense',
          desc: 'เห็นเวลาเดินแค่ 2 วินาทีแรก แล้วนับในใจและกดหยุดให้ตรงเป้า 5 วินาที หรือเป้าสุ่มทุกรอบมากที่สุด', label: 'คลาดเฉลี่ยน้อยสุด',
          best: (u) => {
              const c = readJSON('arcade_chrono_scores', {}), p = [];
              if (c[u + '_5'] !== undefined) p.push('5s ±' + c[u + '_5'] + 'ms');
              if (c[u + '_random'] !== undefined) p.push('สุ่ม ±' + c[u + '_random'] + 'ms');
              return join(p);
          } },
        { id: 'intercept', href: 'intercept.html', cat: 'speed', icon: 'fa-crosshairs', chip: 'Motion Prediction', title: 'Packet Catch',
          desc: 'แพ็กเก็ตวิ่งเข้าโซนรบกวนที่บังสายตา คำนวณความเร็วในใจแล้วกดดักให้ตรงเส้นเป้าหมาย', label: 'คลาดเฉลี่ยน้อยสุด',
          best: (u) => {
              const a = pick('arcade_intercept_scores', u), b = pick('arcade_intercept_bounce_scores', u), p = [];
              if (a !== null) p.push('ตรง ±' + a + 'ms');
              if (b !== null) p.push('ชิ่ง ±' + b + 'ms');
              return join(p);
          } },

        { id: 'vault', href: 'vault.html', cat: 'logic', icon: 'fa-lock', chip: 'Deductive Logic', title: 'Vault Code',
          desc: 'เจาะรหัสตู้นิรภัย 4 หรือ 5 หลักจากสีใบ้ถูกตำแหน่ง/ผิดตำแหน่ง ใช้ตรรกะตัดตัวเลือกให้เหลือน้อยที่สุด', label: 'ผลดีที่สุด',
          best: (u) => {
              const a = pick('arcade_vault_scores', u), b = pick('arcade_vault5_scores', u), p = [];
              if (a) p.push('4 หลัก ' + a);
              if (b) p.push('5 หลัก ' + b);
              return join(p);
          } },
        { id: 'route', href: 'route.html', cat: 'logic', icon: 'fa-diagram-project', chip: 'Spatial Planning', title: 'Route Planner',
          desc: 'จำตำแหน่งไฟร์วอลล์ในแผนผังเครือข่ายสั้น ๆ แล้ววางเส้นทางจาก S ไป E โดยไม่ชน', label: 'ผลดีที่สุด',
          best: (u) => { const v = pick('arcade_route_scores', u); return v ? String(v) : null; } },
        { id: 'audit', href: 'audit.html', cat: 'logic', icon: 'fa-magnifying-glass-chart', chip: 'Anomaly Spotter', title: 'Data Audit',
          desc: 'เทียบตารางข้อมูล Binary หรือ HEX สองชุด หาช่องที่ผิดปกติ 1 จุดให้เจอเร็วที่สุด', label: 'ผลดีที่สุด',
          best: (u) => {
              const a = readJSON('arcade_audit_scores', {}), p = [];
              if (a[u + '_BIN']) p.push('BIN ' + a[u + '_BIN']);
              if (a[u + '_HEX']) p.push('HEX ' + a[u + '_HEX']);
              return join(p);
          } },
        { id: 'arrow', href: 'arrow.html', cat: 'logic', icon: 'fa-route', chip: 'Logic Override', title: 'Routing Desk',
          desc: 'ส่งงานไปตามทิศ หรือสวนทางเมื่อกฎเปลี่ยน ยิ่งต่อเนื่องผลงานยิ่งคูณ', label: 'ผลดีที่สุด',
          best: (u) => { const v = pick('arcade_override_scores', u); return v ? String(v) : null; } },

        { id: 'triage', href: 'triage.html', cat: 'pressure', icon: 'fa-bell', chip: 'Priority Triage', title: 'Alert Triage',
          desc: 'แจ้งเตือนเด้งพร้อมกันหลายระดับ ผู้ดูแลทำได้ทีละงาน เลือกให้ถูกก่อนระบบล่ม', label: 'ผลดีที่สุด',
          best: (u) => { const v = pick('arcade_triage_scores', u); return v ? String(v) : null; } },
        { id: 'dual', href: 'dual.html', cat: 'pressure', icon: 'fa-table-columns', chip: 'Multitasking', title: 'Dual Desk',
          desc: 'ใช้เมาส์ประคองเป้าฝั่งซ้าย พร้อมกดคีย์บอร์ดหลบสิ่งกีดขวางฝั่งขวา ทำสองงานให้ได้พร้อมกัน', label: 'ผลดีที่สุด',
          best: (u) => { const v = pick('arcade_dual_scores', u); return v ? String(v) : null; } }
    ];

    // where each game keeps this player's records (used to move guest scores over / wipe an account)
    const FLAT_STORES = ['arcade_memory_scores', 'arcade_pattern_scores', 'arcade_reflex_ms', 'arcade_override_scores', 'arcade_dual_scores',
        'arcade_route_scores', 'arcade_intercept_scores', 'arcade_intercept_bounce_scores', 'arcade_filter_scores',
        'arcade_filter_busy_scores', 'arcade_triage_scores', 'arcade_vault_scores', 'arcade_vault5_scores', 'arcade_flanker_scores'];
    const SUFFIX_STORES = { arcade_scan_scores: /^(STD|GLITCH)$/, arcade_typing_scores: /^(th|en)_\d+$/, arcade_chrono_scores: /^(5|random)$/, arcade_audit_scores: /^(BIN|HEX)$/ };

    function userKeys(map, u, suffixRe) {
        return Object.keys(map).filter((k) => k.indexOf(u + '_') === 0 && suffixRe.test(k.slice(u.length + 1)));
    }
    function hasScores(u) {
        return GAMES.some((g) => g.best(u) !== null);
    }
    function copyScores(from, to) {
        FLAT_STORES.forEach((store) => {
            const m = readJSON(store, null);
            if (m && has(m, from) && !has(m, to)) { m[to] = m[from]; writeJSON(store, m); }
        });
        Object.keys(SUFFIX_STORES).forEach((store) => {
            const m = readJSON(store, null);
            if (!m) return;
            let changed = false;
            userKeys(m, from, SUFFIX_STORES[store]).forEach((k) => {
                const nk = to + k.slice(from.length);
                if (!has(m, nk)) { m[nk] = m[k]; changed = true; }
            });
            if (changed) writeJSON(store, m);
        });
    }
    function wipeScores(u) {
        FLAT_STORES.forEach((store) => {
            const m = readJSON(store, null);
            if (m && has(m, u)) { delete m[u]; writeJSON(store, m); }
        });
        Object.keys(SUFFIX_STORES).forEach((store) => {
            const m = readJSON(store, null);
            if (!m) return;
            const ks = userKeys(m, u, SUFFIX_STORES[store]);
            ks.forEach((k) => delete m[k]);
            if (ks.length) writeJSON(store, m);
        });
    }

    // ---------- password hashing ----------
    const toHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    const canSubtle = () => !!(window.crypto && crypto.subtle);
    async function pbkdf2(pw, saltHex, iter) {
        const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
        return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, key, 256));
    }
    function weakHash(username, password) {          // only for non-secure contexts; never plain text
        const data = new TextEncoder().encode('workdesk:' + username + ':' + password);
        let h = 5381;
        data.forEach((b) => { h = ((h << 5) + h + b) | 0; });
        return 'weak:' + (h >>> 0).toString(16);
    }
    async function legacySha(username, password) {
        const data = new TextEncoder().encode('workdesk:' + username + ':' + password);
        return 'sha256:' + toHex(await crypto.subtle.digest('SHA-256', data));
    }
    async function makeHash(username, password) {
        if (!canSubtle()) return weakHash(username, password);
        const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
        return 'pbkdf2$100000$' + salt + '$' + await pbkdf2(password, salt, 100000);
    }
    async function checkPassword(rec, password) {
        const h = rec.passHash || '';
        if (h.indexOf('pbkdf2$') === 0) {
            if (!canSubtle()) return false;
            const p = h.split('$');
            return (await pbkdf2(password, p[2], parseInt(p[1], 10))) === p[3];
        }
        if (h.indexOf('sha256:') === 0) return canSubtle() && h === await legacySha(rec.username, password);
        if (h.indexOf('weak:') === 0) return h === weakHash(rec.username, password);
        if (typeof rec.password === 'string') return rec.password === password;      // very old plain-text accounts
        return false;
    }
    // try the typed password, then the trimmed one (older versions trimmed passwords before hashing)
    async function verify(rec, password) {
        if (await checkPassword(rec, password)) return true;
        const t = password.trim();
        return t !== password && await checkPassword(rec, t);
    }

    // ---------- login throttling (per username, this browser) ----------
    const MAX_FAILS = 5, LOCK_MS = 30000;
    function lockLeft(name) {
        const e = readJSON(KEY_LOCK, {})[name.toLowerCase()];
        return e && e.until > Date.now() ? Math.ceil((e.until - Date.now()) / 1000) : 0;
    }
    function noteFail(name) {
        const all = readJSON(KEY_LOCK, {}), k = name.toLowerCase(), e = all[k] || { n: 0, until: 0 };
        e.n++;
        if (e.n >= MAX_FAILS) { e.n = 0; e.until = Date.now() + LOCK_MS; }
        all[k] = e; writeJSON(KEY_LOCK, all);
    }
    function clearFails(name) {
        const all = readJSON(KEY_LOCK, {});
        if (has(all, name.toLowerCase())) { delete all[name.toLowerCase()]; writeJSON(KEY_LOCK, all); }
    }

    // ---------- accounts ----------
    let currentUser = (function () {
        const u = readJSON(KEY_USER, null);
        return u && typeof u.username === 'string' ? { username: u.username, displayName: u.displayName || u.username } : null;
    })();
    const listeners = [];
    const getDB = () => readJSON(KEY_DB, {});
    const saveDB = (db) => writeJSON(KEY_DB, db);
    function findUser(db, name) {
        if (has(db, name)) return db[name];
        const l = name.toLowerCase();
        const k = Object.keys(db).find((x) => x.toLowerCase() === l);
        return k ? db[k] : null;
    }
    const activeName = () => (currentUser ? currentUser.username : 'guest');
    function notify() { listeners.forEach((fn) => { try { fn(currentUser); } catch (e) { console.error(e); } }); }

    function setSession(rec) {
        currentUser = { username: rec.username, displayName: rec.displayName || rec.username };
        writeJSON(KEY_USER, currentUser);
        renderUserBar();
        notify();
    }
    function logout() {
        currentUser = null;
        try { localStorage.removeItem(KEY_USER); } catch (e) {}
        renderUserBar();
        notify();
        toast('ออกจากระบบแล้ว');
    }

    // ---------- UI ----------
    let toastTimer = null;
    function toast(msg) {
        const t = $('wd-toast');
        if (!t) return;
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
    }

    // click sound for the hub pages (muted state is remembered)
    let muted = readJSON(KEY_MUTE, false) === true, clickCtx = null;
    function playClick() {
        if (muted) return;
        try {
            if (!clickCtx) clickCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (clickCtx.state === 'suspended') clickCtx.resume();
            const o = clickCtx.createOscillator(), g = clickCtx.createGain(), t = clickCtx.currentTime;
            o.type = 'sine'; o.frequency.setValueAtTime(587.33, t);
            g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
            o.connect(g); g.connect(clickCtx.destination); o.start(t); o.stop(t + 0.12);
        } catch (e) {}
    }

    const MODALS_HTML = `
    <div id="auth-modal" class="modal-backdrop" aria-hidden="true">
        <div class="modal left" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button class="modal-close" data-close aria-label="ปิด"><i class="fa-solid fa-xmark"></i></button>
            <h3 id="auth-title" class="hidden">บัญชีผู้ใช้</h3>
            <div class="tabs" role="tablist">
                <button type="button" id="tab-login" class="tab on" role="tab">เข้าสู่ระบบ</button>
                <button type="button" id="tab-register" class="tab" role="tab">สมัครสมาชิก</button>
            </div>
            <div id="auth-alert" class="alert hidden" role="alert"></div>
            <form id="auth-form" novalidate>
                <div class="field">
                    <label for="auth-username">ชื่อผู้ใช้</label>
                    <input type="text" id="auth-username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="ชื่อผู้ใช้">
                    <div id="username-hint" class="hint hidden">3–20 ตัว ใช้ตัวอักษรหรือตัวเลขเท่านั้น (ไม่มีช่องว่างหรือ _)</div>
                </div>
                <div class="field">
                    <label for="auth-password">รหัสผ่าน</label>
                    <div class="pw-wrap">
                        <input type="password" id="auth-password" autocomplete="current-password" placeholder="รหัสผ่าน">
                        <button type="button" class="pw-toggle" data-pw="auth-password" aria-label="แสดงรหัสผ่าน"><i class="fa-solid fa-eye"></i></button>
                    </div>
                    <div id="pw-hint" class="hint hidden">อย่างน้อย 6 ตัวอักษร</div>
                </div>
                <div id="confirm-group" class="field hidden">
                    <label for="auth-confirm">ยืนยันรหัสผ่าน</label>
                    <input type="password" id="auth-confirm" autocomplete="new-password" placeholder="กรอกรหัสผ่านอีกครั้ง">
                </div>
                <div id="display-group" class="field hidden">
                    <label for="auth-display">ชื่อที่แสดง (ไม่บังคับ)</label>
                    <input type="text" id="auth-display" maxlength="24" placeholder="เช่น สมชาย">
                </div>
                <label id="merge-group" class="check hidden"><input type="checkbox" id="auth-merge" checked><span>นำคะแนนที่เล่นแบบ Guest ในเครื่องนี้มาเป็นของบัญชีนี้</span></label>
                <button type="submit" id="auth-submit" class="btn block">เข้าสู่ระบบ</button>
            </form>
            <p class="modal-note"><i class="fa-solid fa-circle-info"></i> บัญชีและคะแนนเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น ถ้าล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่อง ข้อมูลจะไม่ตามไปด้วย</p>
        </div>
    </div>

    <div id="profile-modal" class="modal-backdrop" aria-hidden="true">
        <div class="modal left" role="dialog" aria-modal="true" aria-labelledby="profile-name">
            <button class="modal-close" data-close aria-label="ปิด"><i class="fa-solid fa-xmark"></i></button>
            <div class="profile-head">
                <span class="avatar lg" id="profile-avatar"></span>
                <div style="min-width:0">
                    <div class="nm" id="profile-name"></div>
                    <div class="un" id="profile-username"></div>
                    <div class="un" id="profile-count"></div>
                </div>
            </div>
            <div id="profile-alert" class="alert hidden" role="alert"></div>
            <div class="field">
                <label for="profile-display">ชื่อที่แสดง</label>
                <input type="text" id="profile-display" maxlength="24">
            </div>
            <button type="button" id="profile-save" class="btn block">บันทึกชื่อ</button>

            <details class="fold">
                <summary>เปลี่ยนรหัสผ่าน</summary>
                <div class="fold-body">
                    <div class="field"><label for="pw-old">รหัสผ่านปัจจุบัน</label><input type="password" id="pw-old" autocomplete="current-password"></div>
                    <div class="field"><label for="pw-new">รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)</label><input type="password" id="pw-new" autocomplete="new-password"></div>
                    <div class="field"><label for="pw-new2">ยืนยันรหัสผ่านใหม่</label><input type="password" id="pw-new2" autocomplete="new-password"></div>
                    <button type="button" id="pw-save" class="btn-ghost">เปลี่ยนรหัสผ่าน</button>
                </div>
            </details>

            <details class="fold danger">
                <summary>ลบบัญชี</summary>
                <div class="fold-body">
                    <p class="hint" style="margin-bottom:12px">ลบบัญชีนี้และคะแนนทั้งหมดของบัญชีออกจากเครื่องนี้ ย้อนกลับไม่ได้</p>
                    <div class="field"><label for="del-pw">กรอกรหัสผ่านเพื่อยืนยัน</label><input type="password" id="del-pw" autocomplete="current-password"></div>
                    <button type="button" id="del-btn" class="btn-ghost btn-danger">ลบบัญชีและคะแนน</button>
                </div>
            </details>

            <button type="button" id="profile-logout" class="btn-ghost" style="margin-top:18px"><i class="fa-solid fa-right-from-bracket"></i> ออกจากระบบ</button>
        </div>
    </div>
    <div id="wd-toast" class="toast" role="status" aria-live="polite"></div>`;

    let authMode = 'login', lastFocus = null;

    function openModal(id) {
        lastFocus = document.activeElement;
        const m = $(id);
        m.classList.add('open'); m.setAttribute('aria-hidden', 'false');
        const first = m.querySelector('input:not([disabled]):not([type=checkbox])');
        if (first) setTimeout(() => first.focus(), 30);
    }
    function closeModals() {
        ['auth-modal', 'profile-modal'].forEach((id) => { const m = $(id); if (m) { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); } });
        if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
        lastFocus = null;
    }
    function showAlert(boxId, msg, ok) {
        const b = $(boxId);
        b.textContent = msg;
        b.className = 'alert' + (ok ? ' ok' : '');
    }
    const hideAlert = (boxId) => $(boxId).classList.add('hidden');

    function switchTab(mode) {
        authMode = mode;
        const login = mode === 'login';
        $('tab-login').className = 'tab' + (login ? ' on' : '');
        $('tab-register').className = 'tab' + (login ? '' : ' on');
        ['confirm-group', 'display-group', 'username-hint', 'pw-hint'].forEach((id) => $(id).classList.toggle('hidden', login));
        $('merge-group').classList.toggle('hidden', login || !hasScores('guest'));
        $('auth-password').autocomplete = login ? 'current-password' : 'new-password';
        $('auth-submit').textContent = login ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';
        hideAlert('auth-alert');
    }
    function openAuth(mode) {
        $('auth-form').reset();
        switchTab(mode || 'login');
        openModal('auth-modal');
    }

    const USERNAME_RE = /^[\p{L}\p{N}]{3,20}$/u;      // letters / digits only: "_" is used as a separator inside score keys

    let busy = false;
    async function submitAuth(e) {
        e.preventDefault();
        if (busy) return;
        const username = $('auth-username').value.trim();
        const password = $('auth-password').value;
        hideAlert('auth-alert');
        if (!username || !password) return showAlert('auth-alert', 'กรอกชื่อผู้ใช้และรหัสผ่านก่อน');
        busy = true; $('auth-submit').disabled = true;
        try {
            const db = getDB();
            if (authMode === 'register') {
                if (!USERNAME_RE.test(username)) return showAlert('auth-alert', 'ชื่อผู้ใช้ต้องยาว 3–20 ตัว และใช้ตัวอักษรหรือตัวเลขเท่านั้น (ห้ามเว้นวรรคหรือใช้ _)');
                if (username.toLowerCase() === 'guest') return showAlert('auth-alert', 'ชื่อ guest ถูกสงวนไว้ กรุณาใช้ชื่ออื่น');
                if (findUser(db, username)) return showAlert('auth-alert', 'ชื่อผู้ใช้นี้มีในระบบแล้ว (ไม่แยกตัวพิมพ์เล็ก/ใหญ่) กรุณาใช้ชื่ออื่น');
                if (password.length < 6) return showAlert('auth-alert', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
                if (password !== $('auth-confirm').value) return showAlert('auth-alert', 'รหัสผ่านทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
                const rec = {
                    username,
                    displayName: $('auth-display').value.trim() || username,
                    passHash: await makeHash(username, password),
                    createdAt: Date.now()
                };
                db[username] = rec;
                saveDB(db);
                if ($('auth-merge').checked && !$('merge-group').classList.contains('hidden')) copyScores('guest', username);
                closeModals();
                setSession(rec);
                toast('สมัครสมาชิกสำเร็จ ยินดีต้อนรับ ' + rec.displayName);
            } else {
                const wait = lockLeft(username);
                if (wait) return showAlert('auth-alert', `ลองผิดหลายครั้ง กรุณารอ ${wait} วินาทีแล้วลองใหม่`);
                const rec = findUser(db, username);
                const ok = rec ? await verify(rec, password) : false;
                if (!ok) {
                    noteFail(username);
                    const w = lockLeft(username);
                    return showAlert('auth-alert', w ? `ลองผิดหลายครั้ง กรุณารอ ${w} วินาทีแล้วลองใหม่` : 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
                }
                clearFails(username);
                if (!(rec.passHash || '').startsWith('pbkdf2$') && canSubtle()) {     // upgrade old hashes to salted PBKDF2
                    rec.passHash = await makeHash(rec.username, password);
                    delete rec.password; delete rec.scores;
                    saveDB(db);
                }
                closeModals();
                setSession(rec);
                toast('ยินดีต้อนรับกลับ ' + (rec.displayName || rec.username));
            }
        } finally {
            busy = false; $('auth-submit').disabled = false;
        }
    }

    function openProfile() {
        if (!currentUser) return openAuth('login');
        const name = currentUser.displayName || currentUser.username;
        $('profile-avatar').textContent = name.charAt(0).toUpperCase();
        $('profile-name').textContent = name;
        $('profile-username').textContent = '@' + currentUser.username;
        const played = GAMES.filter((g) => g.best(currentUser.username) !== null).length;
        $('profile-count').textContent = `ลองแล้ว ${played}/${GAMES.length} งาน`;
        $('profile-display').value = name;
        ['pw-old', 'pw-new', 'pw-new2', 'del-pw'].forEach((id) => { $(id).value = ''; });
        document.querySelectorAll('#profile-modal details').forEach((d) => { d.open = false; });
        hideAlert('profile-alert');
        openModal('profile-modal');
    }
    function saveProfile() {
        const name = $('profile-display').value.trim();
        if (!name) return showAlert('profile-alert', 'ชื่อที่แสดงต้องไม่ว่าง');
        currentUser.displayName = name;
        writeJSON(KEY_USER, currentUser);
        const db = getDB();
        if (has(db, currentUser.username)) { db[currentUser.username].displayName = name; saveDB(db); }
        closeModals(); renderUserBar(); notify(); toast('บันทึกชื่อแล้ว');
    }
    async function changePassword() {
        const db = getDB(), rec = has(db, currentUser.username) ? db[currentUser.username] : null;
        const oldPw = $('pw-old').value, n1 = $('pw-new').value, n2 = $('pw-new2').value;
        if (!rec) return showAlert('profile-alert', 'ไม่พบข้อมูลบัญชีในเครื่องนี้');
        if (!(await verify(rec, oldPw))) return showAlert('profile-alert', 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
        if (n1.length < 6) return showAlert('profile-alert', 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
        if (n1 !== n2) return showAlert('profile-alert', 'รหัสผ่านใหม่สองช่องไม่ตรงกัน');
        rec.passHash = await makeHash(rec.username, n1);
        saveDB(db);
        ['pw-old', 'pw-new', 'pw-new2'].forEach((id) => { $(id).value = ''; });
        closeModals(); toast('เปลี่ยนรหัสผ่านแล้ว');
    }
    async function deleteAccount() {
        const db = getDB(), u = currentUser.username, rec = has(db, u) ? db[u] : null;
        if (!rec) return showAlert('profile-alert', 'ไม่พบข้อมูลบัญชีในเครื่องนี้');
        if (!(await verify(rec, $('del-pw').value))) return showAlert('profile-alert', 'รหัสผ่านไม่ถูกต้อง');
        delete db[u]; saveDB(db);
        wipeScores(u);
        currentUser = null;
        try { localStorage.removeItem(KEY_USER); } catch (e) {}
        closeModals(); renderUserBar(); notify(); toast('ลบบัญชีแล้ว');
    }

    function renderUserBar() {
        const bar = $('user-bar');
        if (!bar) return;
        bar.textContent = '';
        if (currentUser) {
            const name = currentUser.displayName || currentUser.username;
            const btn = document.createElement('button');
            btn.className = 'user-btn';
            btn.setAttribute('aria-label', 'โปรไฟล์ของ ' + name);
            const av = document.createElement('span'); av.className = 'avatar'; av.textContent = name.charAt(0).toUpperCase();
            const nm = document.createElement('span'); nm.className = 'uname'; nm.textContent = name;        // textContent: no HTML injection
            btn.append(av, nm);
            btn.addEventListener('click', openProfile);
            bar.append(btn);
        } else {
            const btn = document.createElement('button');
            btn.className = 'user-btn primary';
            btn.innerHTML = '<i class="fa-solid fa-user"></i><span class="uname">เข้าสู่ระบบ</span>';
            btn.addEventListener('click', () => openAuth('login'));
            bar.append(btn);
        }
    }

    function mount() {
        const wrap = document.createElement('div');
        wrap.innerHTML = MODALS_HTML;
        while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

        $('tab-login').addEventListener('click', () => switchTab('login'));
        $('tab-register').addEventListener('click', () => switchTab('register'));
        $('auth-form').addEventListener('submit', submitAuth);
        $('profile-save').addEventListener('click', saveProfile);
        $('pw-save').addEventListener('click', changePassword);
        $('del-btn').addEventListener('click', deleteAccount);
        $('profile-logout').addEventListener('click', () => { closeModals(); logout(); });
        document.querySelectorAll('.modal-backdrop').forEach((bd) => {
            bd.addEventListener('mousedown', (e) => { if (e.target === bd) closeModals(); });
            bd.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModals));
        });
        document.querySelectorAll('.pw-toggle').forEach((b) => b.addEventListener('click', () => {
            const inp = $(b.dataset.pw), show = inp.type === 'password';
            inp.type = show ? 'text' : 'password';
            b.innerHTML = show ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
            b.setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
        }));
        // live hints while registering
        $('auth-username').addEventListener('input', () => {
            if (authMode !== 'register') return;
            const v = $('auth-username').value.trim(), h = $('username-hint');
            h.className = 'hint' + (!v ? '' : USERNAME_RE.test(v) ? ' ok' : ' bad');
        });
        $('auth-password').addEventListener('input', () => {
            if (authMode !== 'register') return;
            const v = $('auth-password').value, h = $('pw-hint');
            h.className = 'hint' + (!v ? '' : v.length >= 6 ? ' ok' : ' bad');
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });
        // keep several tabs in sync
        window.addEventListener('storage', (e) => {
            if (e.key !== KEY_USER && e.key !== null) return;
            const u = readJSON(KEY_USER, null);
            currentUser = u && typeof u.username === 'string' ? { username: u.username, displayName: u.displayName || u.username } : null;
            renderUserBar(); notify();
        });

        const soundBtn = $('sound-btn'), soundIcon = $('sound-icon');
        if (soundBtn) {
            const paint = () => { soundIcon.className = muted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high'; soundBtn.classList.toggle('muted', muted); };
            paint();
            soundBtn.addEventListener('click', () => { muted = !muted; writeJSON(KEY_MUTE, muted); paint(); });
        }
        document.addEventListener('click', (e) => { if (e.target.closest('a.btn, a.nav-link, a.play')) playClick(); });
        renderUserBar();
        notify();
    }

    window.WD = {
        GAMES, CATS, readJSON, writeJSON, fmtTime,
        user: () => currentUser,
        name: activeName,
        bestOf: (g) => g.best(activeName()),
        playedCount: () => GAMES.filter((g) => g.best(activeName()) !== null).length,
        onUser: (fn) => { listeners.push(fn); },
        openAuth, openProfile, logout, toast, mount
    };
})();