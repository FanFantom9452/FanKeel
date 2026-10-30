// The station's reply editor for a served weekly report (lib/weekly-reply.js
// injects it; the archived file never carries it): each question's read-only
// reply becomes a textarea and a 儲存 button that POSTs to
// /station/weekly/<until>/reply. A failed save says why and keeps the text.
(function () {
    var cfg = document.getElementById('wk-reply');
    if (!cfg) return;
    var until = cfg.getAttribute('data-until');
    var nonce = cfg.getAttribute('data-nonce') || '';
    function stamp(iso) {
        var d = new Date(iso);
        var p = function (x) { return (x < 10 ? '0' : '') + x; };
        return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
    [].forEach.call(document.querySelectorAll('.q[data-q]'), function (row, i) {
        var box = row.querySelector('.q-reply');
        if (!box) return;
        var ans = box.querySelector('.ans:not(.none)');
        var meta = box.querySelector('.ans-meta .mono');
        var id = 'wk-q-' + i;
        box.className = 'q-reply edit';
        box.innerHTML = '';
        var label = document.createElement('label');
        label.className = 'k';
        label.htmlFor = id;
        label.textContent = '回覆';
        var area = document.createElement('textarea');
        area.id = id;
        area.rows = 2;
        area.value = ans ? ans.textContent : '';
        var act = document.createElement('div');
        act.className = 'q-act';
        var save = document.createElement('button');
        save.type = 'button';
        save.className = 'save';
        save.textContent = '儲存';
        var st = document.createElement('span');
        st.className = ans ? 'q-st saved' : 'q-st';
        st.textContent = ans ? '已存 ' + (meta ? meta.textContent : '') : '尚未回覆';
        act.appendChild(save);
        act.appendChild(st);
        box.appendChild(label);
        box.appendChild(area);
        box.appendChild(act);
        area.addEventListener('input', function () {
            st.className = 'q-st';
            st.textContent = '有未儲存的修改';
        });
        save.addEventListener('click', function () {
            save.disabled = true;
            var body = new URLSearchParams({ nonce: nonce, id: row.getAttribute('data-q'), reply: area.value });
            fetch('/station/weekly/' + until + '/reply', { method: 'POST', body: body }).then(function (res) {
                return res.text().then(function (t) {
                    if (!res.ok) throw new Error(t.trim() || String(res.status));
                    return JSON.parse(t);
                });
            }).then(function (out) {
                st.className = 'q-st saved';
                st.textContent = out.repliedAt ? '已存 ' + stamp(out.repliedAt) : '已清除回覆';
            }, function (e) {
                st.className = 'q-st err';
                st.textContent = '沒存成：' + ((e && e.message) || '站台沒有回應') + '。文字還留在框裡，再按一次儲存。';
            }).then(function () { save.disabled = false; });
        });
    });
})();
