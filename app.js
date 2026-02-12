// FridgeTracker - Main App Logic v6 (Real Cloud Sync!)

// Configuration
const CONFIG = {
    STORAGE_KEY: 'fridgetracker_data_v2',
    CLOUD_URL: 'https://seems-losses-prepared-strategic.trycloudflare.com/fridge',
    OPEN_FOOD_FACTS_API: 'https://world.openfoodfacts.org/api/v0/product/'
};

// Quick add presets
const QUICK_ADD_PRESETS = {
    fridge: [
        { name: 'Milk', emoji: '🥛', days: 7 },
        { name: 'Yogurt', emoji: '🥄', days: 21 },
        { name: 'Eggs', emoji: '🥚', days: 28 },
        { name: 'Mozzarella', emoji: '🧀', days: 7 },
        { name: 'Ham', emoji: '🥓', days: 5 },
        { name: 'Chicken', emoji: '🍗', days: 3 },
        { name: 'Cheese', emoji: '🧀', days: 14 },
        { name: 'Butter', emoji: '🧈', days: 30 }
    ],
    pantry: [
        { name: 'Pasta', emoji: '🍝', days: 365 },
        { name: 'Rice', emoji: '🍚', days: 365 },
        { name: 'Tuna', emoji: '🐟', days: 730 },
        { name: 'Tomato Sauce', emoji: '🍅', days: 365 },
        { name: 'Olive Oil', emoji: '🫒', days: 545 },
        { name: 'Cookies', emoji: '🍪', days: 180 },
        { name: 'Cereal', emoji: '🥣', days: 180 },
        { name: 'Crackers', emoji: '🥨', days: 180 }
    ]
};

// State
let currentHouse = 'salvo';
let currentStorage = 'fridge';
let currentFilter = 'all';
let selectedItems = new Set();
let html5QrcodeScanner = null;
let isSyncing = false;

let data = {
    salvo: { fridge: [], pantry: [] },
    elisa: { fridge: [], pantry: [] }
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Load from cloud first
    await loadFromCloud();
    
    renderQuickAddButtons();
    renderItems();
    updateStats();
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expiry-date').value = today;
});

// Cloud Sync
async function loadFromCloud() {
    updateSyncStatus('syncing');
    try {
        const response = await fetch(CONFIG.CLOUD_URL, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
            const cloudData = await response.json();
            if (cloudData.salvo && cloudData.elisa) {
                data = {
                    salvo: cloudData.salvo,
                    elisa: cloudData.elisa
                };
                // Backup to localStorage
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
                updateSyncStatus('synced');
                console.log('✅ Loaded from cloud');
                return true;
            }
        }
        throw new Error('Cloud load failed');
    } catch (e) {
        console.error('Cloud error:', e);
        // Fallback to localStorage
        loadFromLocal();
        updateSyncStatus('offline');
        return false;
    }
}

function loadFromLocal() {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.salvo && parsed.elisa) {
                data = parsed;
            }
        } catch (e) {
            console.error('Local load error:', e);
        }
    }
}

async function saveToCloud() {
    if (isSyncing) return;
    isSyncing = true;
    updateSyncStatus('syncing');
    
    try {
        const payload = {
            lastUpdated: new Date().toISOString(),
            salvo: data.salvo,
            elisa: data.elisa
        };
        
        const response = await fetch(CONFIG.CLOUD_URL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            updateSyncStatus('synced');
            console.log('✅ Saved to cloud');
        } else {
            throw new Error('Save failed');
        }
    } catch (e) {
        console.error('Cloud save error:', e);
        updateSyncStatus('offline');
    }
    
    isSyncing = false;
}

function saveData() {
    // Save locally first (instant)
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
    // Then sync to cloud
    saveToCloud();
}

function updateSyncStatus(status) {
    const el = document.getElementById('sync-status');
    el.className = 'sync-status ' + status;
    
    const icons = {
        syncing: '🔄',
        synced: '☁️',
        offline: '📱'
    };
    const texts = {
        syncing: 'Syncing...',
        synced: 'Synced',
        offline: 'Offline'
    };
    
    el.innerHTML = `<span class="sync-icon">${icons[status] || '📱'}</span><span class="sync-text">${texts[status] || 'Local'}</span>`;
}

// Manual sync
async function manualSync() {
    showToast('🔄 Syncing...', 'info');
    const success = await loadFromCloud();
    renderItems();
    updateStats();
    showToast(success ? '✅ Synced!' : '⚠️ Offline mode', success ? 'success' : 'error');
}

// House Selection
function selectHouse(house) {
    currentHouse = house;
    selectedItems.clear();
    
    document.querySelectorAll('.house-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-casa-${house}`).classList.add('active');
    
    renderItems();
    updateStats();
    updateExportButton();
}

// Storage Selection
function selectStorage(storage) {
    currentStorage = storage;
    selectedItems.clear();
    
    document.querySelectorAll('.storage-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-${storage}`).classList.add('active');
    
    document.body.classList.toggle('pantry-mode', storage === 'pantry');
    
    document.getElementById('items-title').textContent = 
        storage === 'fridge' ? '📦 In the Fridge' : '📦 In the Pantry';
    
    renderQuickAddButtons();
    renderItems();
    updateStats();
    updateExportButton();
}

// Quick Add
function renderQuickAddButtons() {
    const container = document.getElementById('quick-buttons');
    const presets = QUICK_ADD_PRESETS[currentStorage];
    
    container.innerHTML = presets.map(p => `
        <button onclick="openQuickAddModal('${p.name}', ${p.days})">
            ${p.emoji} ${p.name} <span class="days">(+${p.days}d)</span>
        </button>
    `).join('');
}

function openQuickAddModal(name, days) {
    document.getElementById('quick-product-name').value = name;
    document.getElementById('quick-edit-label').textContent = name;
    document.getElementById('quick-days').value = days;
    document.getElementById('quick-edit-modal').classList.remove('hidden');
}

function closeQuickEditModal() {
    document.getElementById('quick-edit-modal').classList.add('hidden');
}

function confirmQuickAdd(event) {
    event.preventDefault();
    
    const name = document.getElementById('quick-product-name').value;
    const days = parseInt(document.getElementById('quick-days').value);
    
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    
    const item = {
        id: Date.now(),
        name: name,
        expiry: expiry.toISOString().split('T')[0],
        quantity: 1,
        addedAt: new Date().toISOString()
    };
    
    data[currentHouse][currentStorage].push(item);
    saveData();
    renderItems();
    updateStats();
    
    closeQuickEditModal();
    showToast(`✅ ${name} added!`, 'success');
}

// Add Item
function addItem(event) {
    event.preventDefault();
    
    const name = document.getElementById('product-name').value.trim();
    const expiry = document.getElementById('expiry-date').value;
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    
    if (!name || !expiry) {
        showToast('Please fill all fields!', 'error');
        return;
    }
    
    const item = {
        id: Date.now(),
        name: name,
        expiry: expiry,
        quantity: quantity,
        addedAt: new Date().toISOString()
    };
    
    data[currentHouse][currentStorage].push(item);
    saveData();
    renderItems();
    updateStats();
    
    document.getElementById('product-name').value = '';
    document.getElementById('quantity').value = '1';
    
    showToast(`✅ ${name} added!`, 'success');
}

// Edit Item
function openEditModal(id) {
    const item = data[currentHouse][currentStorage].find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('edit-item-id').value = id;
    document.getElementById('edit-name').value = item.name;
    document.getElementById('edit-expiry').value = item.expiry;
    document.getElementById('edit-quantity').value = item.quantity;
    
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

function saveEdit(event) {
    event.preventDefault();
    
    const id = parseInt(document.getElementById('edit-item-id').value);
    const item = data[currentHouse][currentStorage].find(i => i.id === id);
    
    if (item) {
        item.name = document.getElementById('edit-name').value.trim();
        item.expiry = document.getElementById('edit-expiry').value;
        item.quantity = parseInt(document.getElementById('edit-quantity').value) || 1;
        
        saveData();
        renderItems();
        updateStats();
        showToast('✅ Updated!', 'success');
    }
    
    closeEditModal();
}

// Delete Item
function deleteItem(id, event) {
    if (event) event.stopPropagation();
    
    data[currentHouse][currentStorage] = data[currentHouse][currentStorage].filter(item => item.id !== id);
    selectedItems.delete(id);
    
    saveData();
    renderItems();
    updateStats();
    updateExportButton();
    showToast('🗑️ Removed', 'success');
}

// Selection
function toggleSelection(id, event) {
    event.stopPropagation();
    
    if (selectedItems.has(id)) {
        selectedItems.delete(id);
    } else {
        selectedItems.add(id);
    }
    
    renderItems();
    updateExportButton();
}

function updateExportButton() {
    const btn = document.getElementById('export-btn');
    const count = document.getElementById('selected-count');
    
    btn.classList.toggle('hidden', selectedItems.size === 0);
    count.textContent = selectedItems.size;
}

// Export
function exportSelected() {
    const items = data[currentHouse][currentStorage].filter(i => selectedItems.has(i.id));
    
    if (items.length === 0) {
        showToast('Select at least one item', 'error');
        return;
    }
    
    const storageName = currentStorage;
    const houseName = currentHouse === 'salvo' ? "Salvo's" : "Elisa's";
    
    let text = `🍳 I have these ingredients (${houseName} ${storageName}):\n\n`;
    items.forEach(item => {
        const daysLeft = getDaysLeft(item.expiry);
        let status = daysLeft < 0 ? ' ⚠️ EXPIRED' : daysLeft <= 2 ? ' ⚠️ expiring soon' : '';
        text += `• ${item.name} (x${item.quantity})${status}\n`;
    });
    text += `\nWhat can I cook?`;
    
    document.getElementById('export-text').value = text;
    document.getElementById('export-modal').classList.remove('hidden');
}

function closeExportModal() {
    document.getElementById('export-modal').classList.add('hidden');
}

function copyExport() {
    const text = document.getElementById('export-text').value;
    navigator.clipboard?.writeText(text).then(() => {
        showToast('📋 Copied!', 'success');
        closeExportModal();
        selectedItems.clear();
        renderItems();
        updateExportButton();
    }) || (document.getElementById('export-text').select(), document.execCommand('copy'), showToast('📋 Copied!', 'success'));
}

// Render
function renderItems() {
    const container = document.getElementById('items-list');
    let items = [...(data[currentHouse]?.[currentStorage] || [])];
    
    items.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (currentFilter === 'expiring') {
        const threshold = new Date(today);
        threshold.setDate(threshold.getDate() + 2);
        items = items.filter(item => {
            const exp = new Date(item.expiry);
            return exp >= today && exp <= threshold;
        });
    } else if (currentFilter === 'expired') {
        items = items.filter(item => new Date(item.expiry) < today);
    }
    
    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">${currentStorage === 'fridge' ? '🧊' : '🗄️'}</div>
                <p>${currentFilter === 'all' ? `No items in the ${currentStorage}` : 'No items in this category'}</p>
            </div>`;
        return;
    }
    
    container.innerHTML = items.map(item => {
        const daysLeft = getDaysLeft(item.expiry);
        const statusClass = daysLeft < 0 ? 'expired' : daysLeft <= 2 ? 'expiring' : '';
        const expiryText = daysLeft < 0 ? `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`
            : daysLeft === 0 ? 'Expires TODAY!'
            : daysLeft <= 2 ? `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
            : `Expires ${formatDate(item.expiry)}`;
        
        return `
            <div class="item-card ${statusClass} ${selectedItems.has(item.id) ? 'selected' : ''}" onclick="openEditModal(${item.id})">
                <input type="checkbox" class="item-checkbox" ${selectedItems.has(item.id) ? 'checked' : ''} onclick="toggleSelection(${item.id}, event)">
                <div class="item-info">
                    <div class="item-name">${escapeHtml(item.name)}</div>
                    <div class="item-expiry ${statusClass}">${expiryText}</div>
                </div>
                <span class="item-quantity">x${item.quantity}</span>
                <div class="item-actions">
                    <button class="item-edit" onclick="openEditModal(${item.id}); event.stopPropagation();">✏️</button>
                    <button class="item-delete" onclick="deleteItem(${item.id}, event)">🗑️</button>
                </div>
            </div>`;
    }).join('');
}

function getDaysLeft(expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((new Date(expiryDate) - today) / (1000 * 60 * 60 * 24));
}

function updateStats() {
    const items = data[currentHouse]?.[currentStorage] || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() + 2);
    
    document.getElementById('total-items').textContent = items.length;
    document.getElementById('expiring-soon').textContent = items.filter(i => {
        const exp = new Date(i.expiry);
        return exp >= today && exp <= threshold;
    }).length;
    document.getElementById('expired-items').textContent = items.filter(i => new Date(i.expiry) < today).length;
}

function filterItems(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderItems();
}

// Barcode Scanner
function startBarcodeScanner() {
    document.getElementById('scanner-container').classList.remove('hidden');
    html5QrcodeScanner = new Html5Qrcode("scanner-view");
    html5QrcodeScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.777 },
        onBarcodeScanned,
        () => {}
    ).catch(err => {
        showToast('Camera access error', 'error');
        closeScanner();
    });
}

async function onBarcodeScanned(barcode) {
    closeScanner();
    showToast('🔍 Looking up...', 'success');
    try {
        const res = await fetch(`${CONFIG.OPEN_FOOD_FACTS_API}${barcode}.json`);
        const result = await res.json();
        if (result.status === 1 && result.product) {
            const name = result.product.product_name || result.product.product_name_en || 'Unknown';
            document.getElementById('product-name').value = name;
            showToast(`✅ Found: ${name}`, 'success');
            document.getElementById('expiry-date').focus();
        } else {
            showToast('Product not found', 'error');
        }
    } catch (e) {
        showToast('Lookup error', 'error');
    }
}

function closeScanner() {
    document.getElementById('scanner-container').classList.add('hidden');
    html5QrcodeScanner?.stop().catch(() => {});
    html5QrcodeScanner = null;
}

// OCR
function startOCRScanner() {
    document.getElementById('ocr-container').classList.remove('hidden');
    document.getElementById('ocr-input').click();
}

async function processOCR(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const preview = document.getElementById('ocr-preview');
    const status = document.getElementById('ocr-status');
    
    const reader = new FileReader();
    reader.onload = e => { preview.innerHTML = `<img src="${e.target.result}">`; };
    reader.readAsDataURL(file);
    
    status.textContent = '🔍 Analyzing...';
    status.classList.add('visible');
    
    try {
        const result = await Tesseract.recognize(file, 'eng+ita', {
            logger: m => { if (m.status === 'recognizing text') status.textContent = `🔍 ${Math.round(m.progress * 100)}%`; }
        });
        const dateMatch = extractDate(result.data.text);
        if (dateMatch) {
            document.getElementById('expiry-date').value = dateMatch;
            status.textContent = `✅ Found: ${formatDate(dateMatch)}`;
            showToast('Date detected!', 'success');
        } else {
            status.textContent = '⚠️ No date found';
        }
        setTimeout(closeOCR, 2000);
    } catch (e) {
        status.textContent = '❌ Error';
    }
}

function extractDate(text) {
    const patterns = [
        /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](20\d{2})/,
        /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})/,
        /(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|gen|mag|giu|lug|ago|set|ott|dic)[a-z]*\s*(20\d{2}|\d{2})/i
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) {
            let [_, d, mo, y] = m;
            if (mo.match?.(/[a-z]/i)) mo = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,gen:1,mag:5,giu:6,lug:7,ago:8,set:9,ott:10,dic:12}[mo.slice(0,3).toLowerCase()];
            y = y.length === 2 ? 2000 + +y : +y;
            if (+d >= 1 && +d <= 31 && +mo >= 1 && +mo <= 12) return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        }
    }
    return null;
}

function closeOCR() {
    document.getElementById('ocr-container').classList.add('hidden');
    document.getElementById('ocr-preview').innerHTML = '';
    document.getElementById('ocr-status').classList.remove('visible');
    document.getElementById('ocr-input').value = '';
}

// Utils
const formatDate = d => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
const escapeHtml = t => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; };
const showToast = (msg, type = 'info') => {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

// API
window.FridgeTracker = {
    getData: () => data,
    manualSync,
    getExpiringItems: (days = 2) => {
        const result = { salvo: { fridge: [], pantry: [] }, elisa: { fridge: [], pantry: [] } };
        const today = new Date(); today.setHours(0,0,0,0);
        const threshold = new Date(today); threshold.setDate(threshold.getDate() + days);
        for (const h of ['salvo', 'elisa']) for (const s of ['fridge', 'pantry'])
            result[h][s] = (data[h]?.[s] || []).filter(i => new Date(i.expiry) <= threshold).map(i => ({ ...i, daysLeft: getDaysLeft(i.expiry) }));
        return result;
    }
};
