// ─── 通用工具 ───

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

async function api(url, options = {}) {
    if (options.body && typeof options.body === 'object') {
        options.body = JSON.stringify(options.body);
        options.headers = { 'Content-Type': 'application/json', ...options.headers };
    }
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '操作失敗');
    return data;
}

// ─── 員工端功能 ───

function addPlateField() {
    const container = document.getElementById('plate-fields');
    const row = document.createElement('div');
    row.className = 'plate-row';
    row.innerHTML = `
        <input type="text" class="plate-input" placeholder="ABC-1234" required
               style="text-transform:uppercase">
        <button type="button" class="plate-remove" onclick="removePlateField(this)" title="移除">×</button>
    `;
    container.appendChild(row);
}

function removePlateField(btn) {
    btn.closest('.plate-row').remove();
}

async function submitRegistration(e) {
    e.preventDefault();
    const plates = Array.from(document.querySelectorAll('.plate-input'))
        .map(el => el.value.trim().toUpperCase())
        .filter(v => v);

    if (!plates.length) {
        showToast('請輸入至少一個車牌號碼');
        return;
    }

    const baseData = {
        date: document.getElementById('reg_date').value,
        applicant_name: document.getElementById('applicant_name').value,
        deceased_name: document.getElementById('deceased_name')?.value || '',
        service_type: document.getElementById('service_type')?.value || '',
        visit_time: document.getElementById('visit_time')?.value || '',
        source: document.getElementById('source')?.value || '',
    };

    try {
        for (const plate of plates) {
            await api('/api/registrations', { method: 'POST', body: { ...baseData, plate_number: plate } });
        }
        showToast(`登記成功！共 ${plates.length} 台車`);
        // 切換列表到剛登記的日期
        const regDate = baseData.date;
        const queryDateEl = document.getElementById('query-date');
        if (queryDateEl && regDate) {
            queryDateEl.value = regDate;
        }
        resetForm();
        loadRegistrations();
    } catch (err) {
        showToast('錯誤：' + err.message);
    }
}

function resetForm() {
    document.getElementById('register-form').reset();
    // 移除多餘的車牌欄位，只保留第一個
    const container = document.getElementById('plate-fields');
    if (container) {
        const rows = container.querySelectorAll('.plate-row');
        rows.forEach((row, i) => { if (i > 0) row.remove(); });
    }
}

async function loadRegistrations() {
    const dateEl = document.getElementById('query-date');
    if (!dateEl) return;
    const dateVal = dateEl.value;
    const today = new Date().toISOString().split('T')[0];
    const titleEl = document.getElementById('list-title');
    titleEl.textContent = dateVal === today ? '今日登記列表' : `${dateVal} 登記列表`;

    try {
        const list = await api(`/api/registrations?date=${dateVal}`);
        renderAdminList(list);
    } catch (err) {
        showToast('載入失敗：' + err.message);
    }
}

function renderAdminList(list) {
    const tbody = document.getElementById('reg-list');
    const empty = document.getElementById('empty-state');
    if (!list.length) {
        tbody.innerHTML = '';
        empty.style.display = '';
        return;
    }
    empty.style.display = 'none';
    tbody.innerHTML = list.map(r => `
        <tr>
            <td><strong>${esc(r.plate_number)}</strong></td>
            <td>${esc(r.applicant_name)}</td>
            <td>${esc(r.deceased_name)}</td>
            <td>${esc(r.service_type)}</td>
            <td>${esc(r.visit_time)}</td>
            <td>${esc(r.source)}</td>
            <td>${r.arrived
                ? `<span class="badge badge-arrived">✓ 已到 ${r.arrived_at || ''}</span>`
                : '<span class="badge badge-pending">未到</span>'
            }</td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="openEditModal(${r.id})">編輯</button>
                <button class="btn btn-danger btn-sm" onclick="deleteReg(${r.id})">刪除</button>
            </td>
        </tr>
    `).join('');
}

// 暫存資料供編輯用
let regCache = [];

async function loadRegistrationsWithCache() {
    const dateEl = document.getElementById('query-date');
    if (!dateEl) return;
    const dateVal = dateEl.value;
    try {
        regCache = await api(`/api/registrations?date=${dateVal}`);
        renderAdminList(regCache);
    } catch (err) {
        showToast('載入失敗：' + err.message);
    }
}

// 覆寫 loadRegistrations 使用 cache 版本
if (typeof PAGE !== 'undefined' && PAGE === 'admin') {
    // 延遲覆寫，確保 PAGE 變數已定義
    document.addEventListener('DOMContentLoaded', () => {});
}

function openEditModal(id) {
    const r = regCache.find(x => x.id === id);
    if (!r) { loadRegistrations(); return; }
    document.getElementById('edit-id').value = r.id;
    document.getElementById('edit-date').value = r.date;
    document.getElementById('edit-plate').value = r.plate_number;
    document.getElementById('edit-name').value = r.applicant_name;
    document.getElementById('edit-deceased').value = r.deceased_name;
    document.getElementById('edit-service').value = r.service_type;
    document.getElementById('edit-time').value = r.visit_time;
    document.getElementById('edit-source').value = r.source;
    document.getElementById('edit-modal').classList.add('show');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('show');
}

async function saveEdit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const data = {
        date: document.getElementById('edit-date').value,
        plate_number: document.getElementById('edit-plate').value,
        applicant_name: document.getElementById('edit-name').value,
        deceased_name: document.getElementById('edit-deceased').value,
        service_type: document.getElementById('edit-service').value,
        visit_time: document.getElementById('edit-time').value,
        source: document.getElementById('edit-source').value,
    };
    try {
        await api(`/api/registrations/${id}`, { method: 'PUT', body: data });
        showToast('已更新！');
        closeEditModal();
        loadRegistrations();
    } catch (err) {
        showToast('錯誤：' + err.message);
    }
}

async function deleteReg(id) {
    if (!confirm('確定要刪除這筆登記嗎？')) return;
    try {
        await api(`/api/registrations/${id}`, { method: 'DELETE' });
        showToast('已刪除');
        loadRegistrations();
    } catch (err) {
        showToast('錯誤：' + err.message);
    }
}

// ─── 交管端功能 ───

let searchTimer = null;

function searchPlate(value) {
    clearTimeout(searchTimer);
    const plate = value.trim().toUpperCase();
    const resultDiv = document.getElementById('search-result');

    if (!plate) {
        resultDiv.innerHTML = '';
        return;
    }

    searchTimer = setTimeout(async () => {
        try {
            const results = await api(`/api/search?plate=${encodeURIComponent(plate)}`);
            if (results.length > 0) {
                resultDiv.innerHTML = results.map(r => `
                    <div class="search-result found">
                        ✅ 車牌 <strong>${esc(r.plate_number)}</strong> 在今日名單中
                        <div class="search-result-details">
                            <p><strong>申請人：</strong>${esc(r.applicant_name)}</p>
                            ${r.deceased_name ? `<p><strong>亡者：</strong>${esc(r.deceased_name)}</p>` : ''}
                            <p><strong>佛事：</strong>${esc(r.service_type)}</p>
                            <p><strong>時間：</strong>${esc(r.visit_time)}</p>
                            <p><strong>來源：</strong>${esc(r.source)}</p>
                            <p><strong>狀態：</strong>${r.arrived ? '✓ 已到達 ' + (r.arrived_at || '') : '未到達'}</p>
                        </div>
                        ${!r.arrived ? `<button class="btn btn-success btn-sm" style="margin-top:0.5rem" onclick="markArrived(${r.id}, true)">標記已到</button>` : ''}
                    </div>
                `).join('');
            } else {
                resultDiv.innerHTML = `
                    <div class="search-result not-found">
                        ❌ 車牌 <strong>${esc(plate)}</strong> 不在今日名單中
                    </div>`;
            }
        } catch (err) {
            resultDiv.innerHTML = '';
        }
    }, 300);
}

// 記錄上次已知的登記 ID 集合，用來偵測新資料
let knownIds = new Set();
let isFirstLoad = true;

function showNewRegBanner(count) {
    let banner = document.getElementById('new-reg-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'new-reg-banner';
        banner.className = 'new-reg-banner';
        const container = document.querySelector('.container');
        container.insertBefore(banner, container.firstChild);
    }
    banner.textContent = `新增 ${count} 筆登記`;
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 180000);
}

async function loadGuardData() {
    try {
        const [list, stats] = await Promise.all([
            api('/api/registrations'),
            api('/api/stats')
        ]);

        // 偵測新資料
        const currentIds = new Set(list.map(r => r.id));
        if (!isFirstLoad) {
            const newIds = list.filter(r => !knownIds.has(r.id)).map(r => r.id);
            if (newIds.length > 0) {
                showNewRegBanner(newIds.length);
                // 記錄新 ID 用於高亮
                window._newHighlightIds = new Set(newIds);
                setTimeout(() => { window._newHighlightIds = null; }, 180000);
            }
        }
        knownIds = currentIds;
        isFirstLoad = false;

        // 統計數字
        document.getElementById('stat-total').textContent = stats.total;
        document.getElementById('stat-arrived').textContent = stats.arrived;
        document.getElementById('stat-pending').textContent = stats.not_arrived;

        // 佛事分佈
        const serviceCard = document.getElementById('service-stats-card');
        const serviceList = document.getElementById('service-stats');
        if (stats.services.length > 0) {
            serviceCard.style.display = '';
            const max = Math.max(...stats.services.map(s => s.count));
            serviceList.innerHTML = stats.services.map(s => `
                <li class="service-item">
                    <span>${esc(s.name)}</span>
                    <div class="service-bar">
                        <div class="service-bar-fill" style="width:${(s.count / max * 100)}%"></div>
                    </div>
                    <span style="font-weight:600;color:var(--primary-hover)">${s.count}</span>
                </li>
            `).join('');
        } else {
            serviceCard.style.display = 'none';
        }

        // 車輛列表
        renderGuardList(list);
    } catch (err) {
        // 靜默失敗，下次刷新會重試
    }
}

function renderGuardList(list) {
    const tbody = document.getElementById('guard-list');
    const empty = document.getElementById('guard-empty');
    if (!list.length) {
        tbody.innerHTML = '';
        empty.style.display = '';
        return;
    }
    empty.style.display = 'none';
    const highlightIds = window._newHighlightIds || new Set();
    tbody.innerHTML = list.map(r => `
        <tr class="${highlightIds.has(r.id) ? 'new-row-highlight' : ''}" style="${r.arrived ? 'opacity:0.6' : ''}">
            <td><strong>${esc(r.plate_number)}</strong></td>
            <td>${esc(r.applicant_name)}</td>
            <td>${esc(r.deceased_name)}</td>
            <td>${esc(r.service_type)}</td>
            <td>${esc(r.visit_time)}</td>
            <td>${r.arrived
                ? `<span class="badge badge-arrived">✓ 已到 ${r.arrived_at || ''}</span>`
                : '<span class="badge badge-pending">未到</span>'
            }</td>
            <td>
                ${r.arrived
                    ? `<button class="btn btn-outline btn-sm" onclick="markArrived(${r.id}, false)">取消</button>`
                    : `<button class="btn btn-success btn-sm" onclick="markArrived(${r.id}, true)">已到</button>`
                }
            </td>
        </tr>
    `).join('');
}

async function markArrived(id, arrived) {
    try {
        const endpoint = arrived ? 'arrive' : 'unarrive';
        await api(`/api/registrations/${id}/${endpoint}`, { method: 'POST' });
        showToast(arrived ? '已標記到達' : '已取消標記');
        if (typeof loadGuardData === 'function' && document.getElementById('guard-list')) {
            loadGuardData();
        }
        // 重新查詢搜尋結果
        const searchInput = document.getElementById('search-plate');
        if (searchInput && searchInput.value) {
            searchPlate(searchInput.value);
        }
    } catch (err) {
        showToast('錯誤：' + err.message);
    }
}

// ─── HTML 跳脫 ───
function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// ─── 日期導覽 ───

function changeDate(offset) {
    const dateEl = document.getElementById('query-date');
    if (!dateEl) return;
    const current = new Date(dateEl.value);
    current.setDate(current.getDate() + offset);
    dateEl.value = current.toISOString().split('T')[0];
    loadRegistrations();
}

function goToday() {
    const dateEl = document.getElementById('query-date');
    if (!dateEl) return;
    dateEl.value = new Date().toISOString().split('T')[0];
    loadRegistrations();
}

// ─── 員工端初始化：使用 cache 版本的 loadRegistrations ───
(function () {
    const origLoad = window.loadRegistrations;
    window.loadRegistrations = async function () {
        const dateEl = document.getElementById('query-date');
        if (!dateEl) return;
        const dateVal = dateEl.value;
        const today = new Date().toISOString().split('T')[0];
        const titleEl = document.getElementById('list-title');
        if (titleEl) {
            titleEl.textContent = dateVal === today ? '今日登記列表' : `${dateVal} 登記列表`;
        }
        const btnToday = document.getElementById('btn-today');
        if (btnToday) {
            btnToday.style.display = dateVal === today ? 'none' : '';
        }
        try {
            regCache = await api(`/api/registrations?date=${dateVal}`);
            renderAdminList(regCache);
        } catch (err) {
            showToast('載入失敗：' + err.message);
        }
        // 載入統計
        loadAdminStats(dateVal, today);
    };
})();

async function loadAdminStats(dateVal, today) {
    try {
        const stats = await api(`/api/stats?date=${dateVal}`);
        document.getElementById('admin-stat-total').textContent = stats.total;
        document.getElementById('admin-stat-arrived').textContent = stats.arrived;
        document.getElementById('admin-stat-pending').textContent = stats.not_arrived;
        const label = document.getElementById('admin-stat-total-label');
        if (label) {
            label.textContent = dateVal === today ? '今日登記' : `${dateVal} 登記`;
        }

        const serviceCard = document.getElementById('admin-service-stats-card');
        const serviceList = document.getElementById('admin-service-stats');
        if (stats.services.length > 0) {
            serviceCard.style.display = '';
            const max = Math.max(...stats.services.map(s => s.count));
            serviceList.innerHTML = stats.services.map(s => `
                <li class="service-item">
                    <span>${esc(s.name)}</span>
                    <div class="service-bar">
                        <div class="service-bar-fill" style="width:${(s.count / max * 100)}%"></div>
                    </div>
                    <span style="font-weight:600;color:var(--primary-hover)">${s.count}</span>
                </li>
            `).join('');
        } else {
            serviceCard.style.display = 'none';
        }
    } catch (err) {
        // 靜默失敗
    }
}
