// ===== BottleKeep PWA - Mobile-First Application =====
'use strict';

// ===== Data Store (localStorage) =====
const Store = {
    K: { customers: 'bk_customers', bottles: 'bk_bottles', locations: 'bk_locations' },

    _id() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 9); },
    _get(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } },
    _set(k, d) { localStorage.setItem(k, JSON.stringify(d)); },

    // Customers
    getCustomers() { return this._get(this.K.customers); },
    saveCustomer(c) {
        const list = this.getCustomers();
        const now = new Date().toISOString();
        if (c.id) {
            const i = list.findIndex(x => x.id === c.id);
            if (i !== -1) list[i] = { ...list[i], ...c, updatedAt: now };
        } else {
            c.id = this._id(); c.createdAt = now; c.updatedAt = now;
            list.push(c);
        }
        this._set(this.K.customers, list);
        return c;
    },
    deleteCustomer(id) {
        this._set(this.K.customers, this.getCustomers().filter(c => c.id !== id));
        this._set(this.K.bottles, this.getBottles().filter(b => b.customerId !== id));
    },

    // Bottles
    getBottles() { return this._get(this.K.bottles); },
    saveBottle(b) {
        const list = this.getBottles();
        const now = new Date().toISOString();
        if (b.id) {
            const i = list.findIndex(x => x.id === b.id);
            if (i !== -1) list[i] = { ...list[i], ...b, updatedAt: now };
        } else {
            b.id = this._id(); b.createdAt = now; b.updatedAt = now;
            list.push(b);
        }
        this._set(this.K.bottles, list);
        return b;
    },
    deleteBottle(id) {
        this._set(this.K.bottles, this.getBottles().filter(b => b.id !== id));
    },

    // Locations
    getLocations() { return this._get(this.K.locations); },
    saveLocation(l) {
        const list = this.getLocations();
        const now = new Date().toISOString();
        if (l.id) {
            const i = list.findIndex(x => x.id === l.id);
            if (i !== -1) list[i] = { ...list[i], ...l, updatedAt: now };
        } else {
            l.id = this._id(); l.createdAt = now; l.updatedAt = now;
            list.push(l);
        }
        this._set(this.K.locations, list);
        return l;
    },
    deleteLocation(id) {
        this._set(this.K.locations, this.getLocations().filter(l => l.id !== id));
    },

    // Export / Import
    exportAll() {
        return JSON.stringify({
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            customers: this.getCustomers(),
            bottles: this.getBottles(),
            locations: this.getLocations(),
        }, null, 2);
    },
    importAll(json) {
        const d = JSON.parse(json);
        if (d.customers) this._set(this.K.customers, d.customers);
        if (d.bottles) this._set(this.K.bottles, d.bottles);
        if (d.locations) this._set(this.K.locations, d.locations);
    },
    clearAll() {
        Object.values(this.K).forEach(k => localStorage.removeItem(k));
    }
};

// ===== Constants =====
const CAT_LABEL = { whisky: 'ウイスキー', wine: 'ワイン', shochu: '焼酎', sake: '日本酒', brandy: 'ブランデー', other: 'その他' };
const CAT_ICON = { whisky: '🥃', wine: '🍷', shochu: '🍶', sake: '🍶', brandy: '🥃', other: '🍾' };
const STATUS_LABEL = { keeping: '保管中', finished: '空き', expired: '期限切れ' };

// ===== Helpers =====
function fmtDate(s) {
    if (!s) return '—';
    const d = new Date(s);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function daysUntil(s) {
    if (!s) return Infinity;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const t = new Date(s); t.setHours(0, 0, 0, 0);
    return Math.ceil((t - now) / 86400000);
}

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function toast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    document.body.style.overflow = '';
}

// ===== App =====
const App = {
    page: 'dashboard',
    deleteCb: null,

    init() {
        this.bindTabs();
        this.bindModals();
        this.bindForms();
        this.bindFilters();
        this.bindSettings();
        this.setDate();
        this.renderAll();
        this.registerSW();
    },

    // -- Service Worker --
    registerSW() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(() => { });
        }
    },

    // -- Tabs --
    bindTabs() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.page = tab.dataset.page;
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                document.getElementById(`page-${this.page}`).classList.add('active');
                this.renderPage(this.page);
                // Scroll to top
                document.getElementById(`page-${this.page}`).scrollTop = 0;
            });
        });
    },

    renderPage(p) {
        switch (p) {
            case 'dashboard': this.renderDashboard(); break;
            case 'customers': this.renderCustomers(); break;
            case 'bottles': this.renderBottles(); break;
            case 'locations': this.renderLocations(); break;
        }
    },

    renderAll() {
        this.renderDashboard();
        this.renderCustomers();
        this.renderBottles();
        this.renderLocations();
    },

    setDate() {
        const n = new Date();
        const w = ['日', '月', '火', '水', '木', '金', '土'];
        document.getElementById('currentDate').textContent =
            `${n.getMonth() + 1}/${n.getDate()} (${w[n.getDay()]})`;
    },

    // -- Modals --
    bindModals() {
        document.querySelectorAll('[data-close]').forEach(b => {
            b.addEventListener('click', () => closeModal(b.dataset.close));
        });
        document.querySelectorAll('.modal-overlay').forEach(o => {
            o.addEventListener('click', e => { if (e.target === o) closeModal(o.id); });
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
        });

        document.getElementById('btnAddCustomer').addEventListener('click', () => this.openCustomerForm());
        document.getElementById('btnAddBottle').addEventListener('click', () => this.openBottleForm());
        document.getElementById('btnAddLocation').addEventListener('click', () => this.openLocationForm());
        document.getElementById('confirmDelete').addEventListener('click', () => {
            if (this.deleteCb) this.deleteCb();
            closeModal('modalConfirm');
        });

        // Inline add: toggle inline form within bottle modal
        document.getElementById('btnAddCustomerInline').addEventListener('click', () => {
            const form = document.getElementById('inlineCustomerForm');
            form.style.display = form.style.display === 'none' ? 'flex' : 'none';
            if (form.style.display === 'flex') {
                document.getElementById('inlineCustomerName').value = '';
                document.getElementById('inlineCustomerPhone').value = '';
                document.getElementById('inlineCustomerName').focus();
            }
        });
        document.getElementById('inlineCustCancel').addEventListener('click', () => {
            document.getElementById('inlineCustomerForm').style.display = 'none';
        });
        document.getElementById('inlineCustSave').addEventListener('click', () => {
            const name = document.getElementById('inlineCustomerName').value.trim();
            if (!name) { toast('顧客名を入力してください', 'error'); return; }
            const saved = Store.saveCustomer({
                name,
                phone: document.getElementById('inlineCustomerPhone').value.trim(),
            });
            document.getElementById('inlineCustomerForm').style.display = 'none';
            // Refresh customer select and auto-select the new one
            this._refreshBottleSelects(saved.id, null);
            this.renderAll();
            toast('顧客を登録しました');
        });

        document.getElementById('btnAddLocationInline').addEventListener('click', () => {
            const form = document.getElementById('inlineLocationForm');
            form.style.display = form.style.display === 'none' ? 'flex' : 'none';
            if (form.style.display === 'flex') {
                document.getElementById('inlineLocationName').value = '';
                document.getElementById('inlineLocationArea').value = '';
                document.getElementById('inlineLocationName').focus();
            }
        });
        document.getElementById('inlineLocCancel').addEventListener('click', () => {
            document.getElementById('inlineLocationForm').style.display = 'none';
        });
        document.getElementById('inlineLocSave').addEventListener('click', () => {
            const name = document.getElementById('inlineLocationName').value.trim();
            if (!name) { toast('場所名を入力してください', 'error'); return; }
            const saved = Store.saveLocation({
                name,
                area: document.getElementById('inlineLocationArea').value.trim(),
                capacity: 10,
            });
            document.getElementById('inlineLocationForm').style.display = 'none';
            this._refreshBottleSelects(null, saved.id);
            this.renderAll();
            toast('場所を登録しました');
        });
    },

    // Refresh selects inside bottle form without losing other inputs
    _refreshBottleSelects(selectCustomerId, selectLocationId) {
        const cs = document.getElementById('bottleCustomer');
        const currentCust = selectCustomerId || cs.value;
        const customers = Store.getCustomers();
        cs.innerHTML = '<option value="">顧客を選択...</option>' +
            customers.map(c => `<option value="${c.id}" ${c.id === currentCust ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
        document.getElementById('btnAddCustomerInline').classList.remove('pulse');

        const ls = document.getElementById('bottleLocation');
        const currentLoc = selectLocationId || ls.value;
        const locations = Store.getLocations();
        ls.innerHTML = '<option value="">場所を選択...</option>' +
            locations.map(l => `<option value="${l.id}" ${l.id === currentLoc ? 'selected' : ''}>${esc(l.name)}${l.area ? ' (' + esc(l.area) + ')' : ''}</option>`).join('');
        document.getElementById('btnAddLocationInline').classList.remove('pulse');
    },

    // -- Forms --
    bindForms() {
        document.getElementById('customerForm').addEventListener('submit', e => { e.preventDefault(); this.saveCustomer(); });
        document.getElementById('bottleForm').addEventListener('submit', e => { e.preventDefault(); this.saveBottle(); });
        document.getElementById('locationForm').addEventListener('submit', e => { e.preventDefault(); this.saveLocation(); });
        document.getElementById('bottleRemaining').addEventListener('input', e => {
            document.getElementById('remainingValue').textContent = e.target.value + '%';
        });
    },

    // -- Filters --
    bindFilters() {
        document.getElementById('customerSearch').addEventListener('input', () => this.renderCustomers());
        document.getElementById('customerSort').addEventListener('change', () => this.renderCustomers());
        document.getElementById('bottleSearch').addEventListener('input', () => this.renderBottles());
        document.getElementById('bottleCategory').addEventListener('change', () => this.renderBottles());
        document.getElementById('bottleStatus').addEventListener('change', () => this.renderBottles());
        document.getElementById('locationSearch').addEventListener('input', () => this.renderLocations());
    },

    // -- Settings --
    bindSettings() {
        // Export
        document.getElementById('btnExport').addEventListener('click', () => {
            const data = Store.exportAll();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bottlekeep_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast('バックアップをダウンロードしました');
        });

        // Import
        document.getElementById('btnImport').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });

        document.getElementById('importFile').addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    Store.importAll(ev.target.result);
                    this.renderAll();
                    toast('データを復元しました');
                } catch {
                    toast('復元に失敗しました。ファイルを確認してください', 'error');
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        });

        // Clear all
        document.getElementById('btnClearAll').addEventListener('click', () => {
            document.getElementById('confirmMessage').textContent = 'すべてのデータを削除しますか？この操作は元に戻せません。';
            this.deleteCb = () => {
                Store.clearAll();
                this.renderAll();
                toast('すべてのデータを削除しました');
            };
            openModal('modalConfirm');
        });
    },

    // ===== CUSTOMER =====
    openCustomerForm(c = null) {
        document.getElementById('customerModalTitle').textContent = c ? '顧客の編集' : '新規顧客';
        document.getElementById('customerId').value = c ? c.id : '';
        document.getElementById('customerName').value = c ? c.name : '';
        document.getElementById('customerPhone').value = c ? c.phone || '' : '';
        document.getElementById('customerEmail').value = c ? c.email || '' : '';
        document.getElementById('customerNote').value = c ? c.note || '' : '';
        openModal('modalCustomer');
    },

    saveCustomer() {
        const c = {
            id: document.getElementById('customerId').value || undefined,
            name: document.getElementById('customerName').value.trim(),
            phone: document.getElementById('customerPhone').value.trim(),
            email: document.getElementById('customerEmail').value.trim(),
            note: document.getElementById('customerNote').value.trim(),
        };
        if (!c.name) { toast('顧客名を入力してください', 'error'); return; }
        const saved = Store.saveCustomer(c);
        closeModal('modalCustomer');
        this.renderAll();
        toast(c.id ? '顧客情報を更新しました' : '顧客を登録しました');
    },

    confirmDeleteCustomer(id, name) {
        document.getElementById('confirmMessage').textContent = `「${name}」を削除しますか？\n関連するボトルも削除されます。`;
        this.deleteCb = () => {
            Store.deleteCustomer(id);
            this.renderAll();
            toast('顧客を削除しました');
        };
        openModal('modalConfirm');
    },

    renderCustomers() {
        const q = document.getElementById('customerSearch').value.toLowerCase().trim();
        const sort = document.getElementById('customerSort').value;
        let list = Store.getCustomers();
        const bottles = Store.getBottles();

        if (q) list = list.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.phone && c.phone.includes(q)) ||
            (c.email && c.email.toLowerCase().includes(q))
        );

        const bCount = {};
        bottles.forEach(b => { bCount[b.customerId] = (bCount[b.customerId] || 0) + 1; });

        if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        else if (sort === 'bottles') list.sort((a, b) => (bCount[b.id] || 0) - (bCount[a.id] || 0));
        else if (sort === 'recent') list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const el = document.getElementById('customerList');
        if (!list.length) { el.innerHTML = '<div class="empty">顧客が見つかりません</div>'; return; }

        el.innerHTML = list.map(c => `
            <div class="list-item" onclick="App.openCustomerForm(Store.getCustomers().find(x=>x.id==='${c.id}'))">
                <div class="item-icon">👤</div>
                <div class="item-body">
                    <div class="item-name">${esc(c.name)}</div>
                    <div class="item-meta">
                        ${c.phone ? `<span>📞 ${esc(c.phone)}</span>` : ''}
                        <span>🍾 ${bCount[c.id] || 0}本</span>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn-sm danger" onclick="event.stopPropagation();App.confirmDeleteCustomer('${c.id}','${esc(c.name).replace(/'/g, "\\'")}')">🗑</button>
                </div>
            </div>
        `).join('');
    },

    // ===== BOTTLE =====
    openBottleForm(b = null) {
        document.getElementById('bottleModalTitle').textContent = b ? 'ボトルの編集' : '新規ボトル';
        document.getElementById('bottleId').value = b ? b.id : '';

        // Customer select
        const cs = document.getElementById('bottleCustomer');
        const customers = Store.getCustomers();
        const custBtn = document.getElementById('btnAddCustomerInline');
        if (customers.length === 0) {
            cs.innerHTML = '<option value="">← ＋ボタンで顧客を追加</option>';
            custBtn.classList.add('pulse');
        } else {
            cs.innerHTML = '<option value="">顧客を選択...</option>' +
                customers.map(c => `<option value="${c.id}" ${b && b.customerId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
            custBtn.classList.remove('pulse');
        }

        // Location select
        const ls = document.getElementById('bottleLocation');
        const locations = Store.getLocations();
        const locBtn = document.getElementById('btnAddLocationInline');
        if (locations.length === 0) {
            ls.innerHTML = '<option value="">← ＋ボタンで場所を追加</option>';
            locBtn.classList.add('pulse');
        } else {
            ls.innerHTML = '<option value="">場所を選択...</option>' +
                locations.map(l => `<option value="${l.id}" ${b && b.locationId === l.id ? 'selected' : ''}>${esc(l.name)}${l.area ? ' (' + esc(l.area) + ')' : ''}</option>`).join('');
            locBtn.classList.remove('pulse');
        }

        document.getElementById('bottleCategorySelect').value = b ? b.category : '';
        document.getElementById('bottleName').value = b ? b.name : '';
        document.getElementById('bottleStatusSelect').value = b ? b.status : 'keeping';
        document.getElementById('bottleDate').value = b ? b.keepDate || '' : new Date().toISOString().slice(0, 10);
        document.getElementById('bottleExpiry').value = b ? b.expiryDate || '' : '';
        document.getElementById('bottleRemaining').value = b ? b.remaining : 100;
        document.getElementById('remainingValue').textContent = (b ? b.remaining : 100) + '%';
        document.getElementById('bottleNote').value = b ? b.note || '' : '';
        openModal('modalBottle');
    },

    saveBottle() {
        const b = {
            id: document.getElementById('bottleId').value || undefined,
            customerId: document.getElementById('bottleCustomer').value,
            category: document.getElementById('bottleCategorySelect').value,
            name: document.getElementById('bottleName').value.trim(),
            locationId: document.getElementById('bottleLocation').value,
            status: document.getElementById('bottleStatusSelect').value,
            keepDate: document.getElementById('bottleDate').value,
            expiryDate: document.getElementById('bottleExpiry').value,
            remaining: parseInt(document.getElementById('bottleRemaining').value),
            note: document.getElementById('bottleNote').value.trim(),
        };
        if (!b.name) { toast('ボトル名を入力してください', 'error'); return; }
        if (!b.customerId) { toast('顧客を選択してください', 'error'); return; }
        if (!b.category) { toast('カテゴリを選択してください', 'error'); return; }
        if (!b.locationId) { toast('保管場所を選択してください', 'error'); return; }

        Store.saveBottle(b);
        closeModal('modalBottle');
        this.renderAll();
        toast(b.id ? 'ボトルを更新しました' : 'ボトルを登録しました');
    },

    confirmDeleteBottle(id, name) {
        document.getElementById('confirmMessage').textContent = `ボトル「${name}」を削除しますか？`;
        this.deleteCb = () => {
            Store.deleteBottle(id);
            this.renderAll();
            toast('ボトルを削除しました');
        };
        openModal('modalConfirm');
    },

    renderBottles() {
        const q = document.getElementById('bottleSearch').value.toLowerCase().trim();
        const cat = document.getElementById('bottleCategory').value;
        const st = document.getElementById('bottleStatus').value;
        let list = Store.getBottles();

        if (q) list = list.filter(b =>
            b.name.toLowerCase().includes(q) ||
            (CAT_LABEL[b.category] || '').includes(q)
        );
        if (cat) list = list.filter(b => b.category === cat);
        if (st) list = list.filter(b => b.status === st);

        list.sort((a, b) => new Date(b.keepDate || b.createdAt) - new Date(a.keepDate || a.createdAt));

        const el = document.getElementById('bottleList');
        const custMap = {}; Store.getCustomers().forEach(c => custMap[c.id] = c);
        const locMap = {}; Store.getLocations().forEach(l => locMap[l.id] = l);

        if (!list.length) { el.innerHTML = '<div class="empty">ボトルが見つかりません</div>'; return; }

        el.innerHTML = list.map(b => {
            const cust = custMap[b.customerId];
            const loc = locMap[b.locationId];
            const icon = CAT_ICON[b.category] || '🍾';
            const rc = b.remaining > 60 ? 'remain-hi' : b.remaining > 30 ? 'remain-md' : 'remain-lo';
            const days = daysUntil(b.expiryDate);
            const warn = days <= 30 && days >= 0;

            return `
                <div class="list-item" onclick="App.openBottleForm(Store.getBottles().find(x=>x.id==='${b.id}'))">
                    <div class="item-icon">${icon}</div>
                    <div class="item-body">
                        <div class="item-name">
                            ${esc(b.name)}
                            <span class="cat-tag">${CAT_LABEL[b.category] || ''}</span>
                        </div>
                        <div class="item-meta">
                            <span>👤 ${cust ? esc(cust.name) : '—'}</span>
                            <span>📍 ${loc ? esc(loc.name) : '—'}</span>
                        </div>
                        <div class="item-meta">
                            <span class="badge badge-${b.status}">${STATUS_LABEL[b.status]}</span>
                            ${warn ? '<span class="badge badge-expired">⚠️ 期限近</span>' : ''}
                            <span>${b.remaining}% <span class="remain-bar"><span class="remain-fill ${rc}" style="width:${b.remaining}%"></span></span></span>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-sm danger" onclick="event.stopPropagation();App.confirmDeleteBottle('${b.id}','${esc(b.name).replace(/'/g, "\\'")}')">🗑</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    // ===== LOCATION =====
    openLocationForm(l = null) {
        document.getElementById('locationModalTitle').textContent = l ? '場所の編集' : '新規保管場所';
        document.getElementById('locationId').value = l ? l.id : '';
        document.getElementById('locationName').value = l ? l.name : '';
        document.getElementById('locationArea').value = l ? l.area || '' : '';
        document.getElementById('locationCapacity').value = l ? l.capacity || 10 : 10;
        document.getElementById('locationNote').value = l ? l.note || '' : '';
        openModal('modalLocation');
    },

    saveLocation() {
        const l = {
            id: document.getElementById('locationId').value || undefined,
            name: document.getElementById('locationName').value.trim(),
            area: document.getElementById('locationArea').value.trim(),
            capacity: parseInt(document.getElementById('locationCapacity').value) || 10,
            note: document.getElementById('locationNote').value.trim(),
        };
        if (!l.name) { toast('場所名を入力してください', 'error'); return; }
        const saved = Store.saveLocation(l);
        closeModal('modalLocation');
        this.renderAll();
        toast(l.id ? '場所を更新しました' : '場所を登録しました');
    },

    confirmDeleteLocation(id, name) {
        const cnt = Store.getBottles().filter(b => b.locationId === id).length;
        const msg = cnt > 0
            ? `「${name}」には${cnt}本のボトルがあります。削除しますか？`
            : `「${name}」を削除しますか？`;
        document.getElementById('confirmMessage').textContent = msg;
        this.deleteCb = () => {
            Store.deleteLocation(id);
            this.renderAll();
            toast('場所を削除しました');
        };
        openModal('modalConfirm');
    },

    renderLocations() {
        const q = document.getElementById('locationSearch').value.toLowerCase().trim();
        let list = Store.getLocations();
        if (q) list = list.filter(l =>
            l.name.toLowerCase().includes(q) ||
            (l.area && l.area.toLowerCase().includes(q))
        );
        list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

        const el = document.getElementById('locationList');
        const bottles = Store.getBottles();
        const locCount = {};
        bottles.forEach(b => { if (b.status === 'keeping') locCount[b.locationId] = (locCount[b.locationId] || 0) + 1; });

        if (!list.length) { el.innerHTML = '<div class="empty">場所が見つかりません</div>'; return; }

        el.innerHTML = list.map(l => {
            const cnt = locCount[l.id] || 0;
            const cap = l.capacity || 10;
            const pct = Math.min((cnt / cap) * 100, 100);
            const full = cnt >= cap;

            return `
                <div class="loc-card" onclick="App.openLocationForm(Store.getLocations().find(x=>x.id==='${l.id}'))">
                    <div class="loc-name">📍 ${esc(l.name)}</div>
                    ${l.area ? `<div class="loc-area">${esc(l.area)}</div>` : ''}
                    <div class="usage-bar"><div class="usage-fill ${full ? 'full' : ''}" style="width:${pct}%"></div></div>
                    <div class="usage-text">${cnt} / ${cap} 本${full ? ' (満杯)' : ''}</div>
                    ${l.note ? `<div style="font-size:0.75rem;color:var(--c-muted);margin-top:6px">${esc(l.note)}</div>` : ''}
                    <div class="loc-actions">
                        <button class="btn-sm danger" onclick="event.stopPropagation();App.confirmDeleteLocation('${l.id}','${esc(l.name).replace(/'/g, "\\'")}')">🗑</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    // ===== DASHBOARD =====
    renderDashboard() {
        const customers = Store.getCustomers();
        const bottles = Store.getBottles();
        const locations = Store.getLocations();

        const keeping = bottles.filter(b => b.status === 'keeping');

        // Stats
        document.getElementById('statCustomers').textContent = customers.length;
        document.getElementById('statBottles').textContent = keeping.length;
        document.getElementById('statLocations').textContent = locations.length;

        // Expiring (within 30 days) or already expired
        const expSoon = keeping.filter(b => b.expiryDate && daysUntil(b.expiryDate) <= 30);
        document.getElementById('statExpiring').textContent = expSoon.length;

        const custMap = {};
        customers.forEach(c => custMap[c.id] = c);

        // Expiring list
        const expEl = document.getElementById('expiringBottles');
        const sortedExp = [...expSoon].sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate)).slice(0, 5);

        if (!sortedExp.length) {
            expEl.innerHTML = '<div class="empty">期限間近のボトルはありません 👍</div>';
        } else {
            expEl.innerHTML = sortedExp.map(b => {
                const d = daysUntil(b.expiryDate);
                const txt = d < 0 ? `${Math.abs(d)}日超過` : d === 0 ? '本日' : `残り${d}日`;
                const cls = d < 0 ? 'badge-expired' : 'badge-keeping';
                return `
                    <div class="dash-row">
                        <div class="dash-icon">${CAT_ICON[b.category] || '🍾'}</div>
                        <div class="dash-info">
                            <div class="dash-name">${esc(b.name)}</div>
                            <div class="dash-sub">${custMap[b.customerId] ? esc(custMap[b.customerId].name) : '—'}</div>
                        </div>
                        <div class="dash-badge"><span class="badge ${cls}">${txt}</span></div>
                    </div>
                `;
            }).join('');
        }

        // Recent
        const recEl = document.getElementById('recentBottles');
        const recent = [...bottles].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

        if (!recent.length) {
            recEl.innerHTML = '<div class="empty">まだボトルが登録されていません</div>';
        } else {
            recEl.innerHTML = recent.map(b => `
                <div class="dash-row">
                    <div class="dash-icon">${CAT_ICON[b.category] || '🍾'}</div>
                    <div class="dash-info">
                        <div class="dash-name">${esc(b.name)}</div>
                        <div class="dash-sub">${custMap[b.customerId] ? esc(custMap[b.customerId].name) : '—'} • ${fmtDate(b.keepDate)}</div>
                    </div>
                    <div class="dash-badge"><span class="badge badge-${b.status}">${STATUS_LABEL[b.status]}</span></div>
                </div>
            `).join('');
        }
    },
};

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => App.init());
