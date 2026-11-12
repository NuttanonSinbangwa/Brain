/* Workdesk — theme switcher
   Applies the saved theme immediately (no flash), then adds a settings
   button + dropdown to the top nav of every page. */
(function () {
    var KEY = 'workdesk_theme';
    var THEMES = [
        { id: 'minimal', name: 'Minimal', desc: 'เรียบ นุ่ม สบายตา', sw: ['#efede7', '#4a6670', '#5b8a72'] },
        { id: 'office', name: 'Office', desc: 'โทนฟ้าแบบโปรแกรมออฟฟิศ', sw: ['#2b579a', '#217346', '#d24726'] }
    ];

    function getTheme() {
        try {
            var t = localStorage.getItem(KEY);
            for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === t) return t;
        } catch (e) {}
        return 'minimal';
    }

    function applyTheme(id) {
        document.documentElement.setAttribute('data-theme', id);
    }

    function saveTheme(id) {
        try { localStorage.setItem(KEY, id); } catch (e) {}
    }

    // Apply right away, before the page paints
    applyTheme(getTheme());

    function build() {
        var actions = document.querySelector('.game-nav .nav-actions');
        if (!actions) return;

        var btn = document.createElement('button');
        btn.className = 'nav-icon-btn';
        btn.id = 'settings-btn';
        btn.setAttribute('aria-label', 'ตั้งค่า');
        btn.setAttribute('aria-haspopup', 'true');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '<i class="fa-solid fa-gear"></i>';

        var menu = document.createElement('div');
        menu.className = 'settings-menu';
        menu.setAttribute('role', 'menu');

        var html = '<h4>ธีมสี</h4>';
        THEMES.forEach(function (t) {
            html += '<button class="theme-opt" role="menuitemradio" data-theme-id="' + t.id + '">' +
                '<span class="sw">' + t.sw.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span>' +
                '<span><b>' + t.name + '</b><small>' + t.desc + '</small></span>' +
                '<i class="fa-solid fa-check tick"></i>' +
                '</button>';
        });
        menu.innerHTML = html;

        actions.appendChild(btn);
        actions.appendChild(menu);

        function refresh() {
            var cur = getTheme();
            var opts = menu.querySelectorAll('.theme-opt');
            for (var i = 0; i < opts.length; i++) {
                var on = opts[i].getAttribute('data-theme-id') === cur;
                opts[i].classList.toggle('on', on);
                opts[i].setAttribute('aria-checked', on ? 'true' : 'false');
            }
        }

        function setOpen(open) {
            menu.classList.toggle('open', open);
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            setOpen(!menu.classList.contains('open'));
        });

        menu.addEventListener('click', function (e) {
            e.stopPropagation();
            var opt = e.target.closest('.theme-opt');
            if (!opt) return;
            var id = opt.getAttribute('data-theme-id');
            saveTheme(id);
            applyTheme(id);
            refresh();
        });

        document.addEventListener('click', function () { setOpen(false); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') setOpen(false);
        });

        // keep other open tabs in sync
        window.addEventListener('storage', function (e) {
            if (e.key === KEY) { applyTheme(getTheme()); refresh(); }
        });

        refresh();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', build);
    } else {
        build();
    }
})();