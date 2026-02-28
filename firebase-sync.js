// ===== Firebase Cloud Sync =====
'use strict';

const FireSync = {
    db: null,
    auth: null,
    user: null,
    _syncing: false,

    // Firebase config
    config: {
        apiKey: "AIzaSyCPtW-B6DBE45cV3Uu1Ru2Twuc3Mu5n1cQ",
        authDomain: "bottlekeep-1771809000.firebaseapp.com",
        projectId: "bottlekeep-1771809000",
        storageBucket: "bottlekeep-1771809000.firebasestorage.app",
        messagingSenderId: "761475275319",
        appId: "1:761475275319:web:0773d2ad86c0e8fd837db2"
    },

    init() {
        try {
            firebase.initializeApp(this.config);
            this.auth = firebase.auth();
            this.db = firebase.firestore();

            // Enable offline persistence
            this.db.enablePersistence({ synchronizeTabs: true }).catch(() => { });

            // Listen for auth state changes
            this.auth.onAuthStateChanged(user => {
                this.user = user;
                this.updateUI();
                if (user) {
                    this.startRealtimeSync();
                    // Optional: Download all data forcefully on first mount
                    // this.downloadFromCloud(); 
                } else {
                    this.stopRealtimeSync();
                }
            });
        } catch (e) {
            console.warn('Firebase init failed:', e);
        }
    },

    // ===== Auth =====
    async signIn() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await this.auth.signInWithPopup(provider);
            toast('Googleアカウントでログインしました');
        } catch (e) {
            if (e.code === 'auth/popup-blocked') {
                // Fallback to redirect
                const provider = new firebase.auth.GoogleAuthProvider();
                await this.auth.signInWithRedirect(provider);
            } else if (e.code !== 'auth/popup-closed-by-user') {
                toast('ログインに失敗しました', 'error');
                console.error(e);
            }
        }
    },

    async signOut() {
        try {
            this.stopRealtimeSync();
            await this.auth.signOut();
            toast('ログアウトしました');
        } catch (e) {
            toast('ログアウトに失敗しました', 'error');
        }
    },

    // ===== UI =====
    updateUI() {
        const loginSection = document.getElementById('cloudSyncSection');
        if (!loginSection) return;

        if (this.user) {
            loginSection.innerHTML = `
                <div class="section-title">☁️ クラウド同期</div>
                <div class="cloud-user">
                    <div class="cloud-user-info">
                        <img class="cloud-avatar" src="${this.user.photoURL || ''}" alt="" onerror="this.style.display='none'">
                        <div>
                            <div class="cloud-name">${esc(this.user.displayName || 'ユーザー')}</div>
                            <div class="cloud-email">${esc(this.user.email || '')}</div>
                        </div>
                    </div>
                    <span class="cloud-status synced">✅ 同期中</span>
                </div>
                <div class="settings-actions" style="margin-top:12px">
                    <button class="btn btn-primary btn-block" id="btnCloudUpload">
                        ☁️ 今すぐクラウドに保存
                    </button>
                    <button class="btn btn-secondary btn-block" id="btnCloudDownload">
                        📥 クラウドからデータ取得
                    </button>
                    <button class="btn btn-secondary btn-block" id="btnSignOut">
                        🚪 ログアウト
                    </button>
                </div>
            `;
            document.getElementById('btnCloudUpload').addEventListener('click', () => this.uploadToCloud());
            document.getElementById('btnCloudDownload').addEventListener('click', () => this.downloadFromCloud());
            document.getElementById('btnSignOut').addEventListener('click', () => this.signOut());
        } else {
            loginSection.innerHTML = `
                <div class="section-title">☁️ クラウド同期</div>
                <p class="section-desc">
                    Googleアカウントでログインすると、データがクラウドに自動保存されます。<br>
                    端末を変えても、同じアカウントでデータを引き継げます。
                </p>
                <div class="settings-actions">
                    <button class="btn btn-google btn-block" id="btnSignIn">
                        <svg viewBox="0 0 24 24" width="18" height="18" style="margin-right:8px"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        Googleでログイン
                    </button>
                </div>
                <p class="hint" style="margin-top:8px">ログインしなくても、ローカルでそのまま使えます。</p>
            `;
            document.getElementById('btnSignIn').addEventListener('click', () => this.signIn());
        }
    },

    // ===== Sync =====

    // Upload local data to cloud (Initial migration / Manual force)
    async uploadToCloud() {
        if (!this.user || this._syncing) return;
        this._syncing = true;
        try {
            const batch = this.db.batch();
            const userRef = this.db.collection('users').doc(this.user.uid);

            // Set customers
            Store.getCustomers().forEach(c => {
                batch.set(userRef.collection('customers').doc(c.id), c, { merge: true });
            });
            // Set bottles
            Store.getBottles().forEach(b => {
                batch.set(userRef.collection('bottles').doc(b.id), b, { merge: true });
            });
            // Set locations
            Store.getLocations().forEach(l => {
                batch.set(userRef.collection('locations').doc(l.id), l, { merge: true });
            });

            await batch.commit();
            toast('☁️ クラウドに保存しました');
        } catch (e) {
            toast('クラウドへの保存に失敗しました', 'error');
            console.error(e);
        } finally {
            this._syncing = false;
        }
    },

    // Pull ALL data from cloud (Manual force fallback)
    async downloadFromCloud() {
        if (!this.user || this._syncing) return;
        this._syncing = true;
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            const [custSnap, botSnap, locSnap] = await Promise.all([
                userRef.collection('customers').get(),
                userRef.collection('bottles').get(),
                userRef.collection('locations').get()
            ]);

            const customers = [], bottles = [], locations = [];
            custSnap.forEach(doc => customers.push(doc.data()));
            botSnap.forEach(doc => bottles.push(doc.data()));
            locSnap.forEach(doc => locations.push(doc.data()));

            if (customers.length > 0) Store._set(Store.K.customers, customers);
            if (bottles.length > 0) Store._set(Store.K.bottles, bottles);
            if (locations.length > 0) Store._set(Store.K.locations, locations);

            App.renderAll();
            toast('☁️ クラウドからデータを取得しました');
        } catch (e) {
            toast('クラウドからの取得に失敗しました', 'error');
            console.error(e);
        } finally {
            this._syncing = false;
        }
    },

    // Start Realtime Listeners
    startRealtimeSync() {
        if (!this.user) return;
        const userRef = this.db.collection('users').doc(this.user.uid);

        // Listen for Customers
        this._unsubCustomers = userRef.collection('customers').onSnapshot(snap => {
            if (this._syncing) return;
            const customers = [];
            snap.forEach(doc => customers.push(doc.data()));
            if (customers.length > 0) {
                Store._set(Store.K.customers, customers);
                App.renderCustomers();
                App.renderDashboard();
            }
        });

        // Listen for Bottles
        this._unsubBottles = userRef.collection('bottles').onSnapshot(snap => {
            if (this._syncing) return;
            const bottles = [];
            snap.forEach(doc => bottles.push(doc.data()));
            if (bottles.length > 0) {
                Store._set(Store.K.bottles, bottles);
                App.renderBottles();
                App.renderDashboard();
                if (App.page === 'customers') App.renderCustomers(); // Bottle count updates
            }
        });

        // Listen for Locations
        this._unsubLocations = userRef.collection('locations').onSnapshot(snap => {
            if (this._syncing) return;
            const locations = [];
            snap.forEach(doc => locations.push(doc.data()));
            if (locations.length > 0) {
                Store._set(Store.K.locations, locations);
                App.renderLocations();
                App.renderDashboard();
            }
        });
    },

    stopRealtimeSync() {
        if (this._unsubCustomers) this._unsubCustomers();
        if (this._unsubBottles) this._unsubBottles();
        if (this._unsubLocations) this._unsubLocations();
    },

    // Save single document to Firebase
    async saveDoc(collection, id, data) {
        if (!this.user) return;
        try {
            await this.db.collection('users').doc(this.user.uid)
                .collection(collection).doc(id).set(data, { merge: true });
        } catch (e) {
            console.error(`Error saving ${collection}:`, e);
        }
    },

    // Delete single document from Firebase
    async deleteDoc(collection, id) {
        if (!this.user) return;
        try {
            await this.db.collection('users').doc(this.user.uid)
                .collection(collection).doc(id).delete();
        } catch (e) {
            console.error(`Error deleting ${collection}:`, e);
        }
    },

    // Triggered automatically by Store when saving/deleting locally
    autoSync() {
        // Obsolete flag removed since we now do atomic syncs via Store overrides
    }
};
