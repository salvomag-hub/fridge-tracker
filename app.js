// FridgeTracker - Main App Logic v2 (English)

// Configuration
const CONFIG = {
    STORAGE_KEY: 'fridgetracker_data_v2',
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

let data = {
    salvo: { fridge: [], pantry: [] },
    elisa: { fridge: [], pantry: [] }
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderQuickAddButtons();
    renderItems();
    updateStats();
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expiry-date').value = today;
});

// Data Management
function loadData() {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Migrate from old format if needed
            if (Array.isArray(parsed.salvo)) {
                data = {
                    salvo: { fridge: parsed.salvo, pantry: [] },
                    elisa: { fridge: parsed.elisa, pantry: [] }
                };
            } else {
                data = parsed;
            }
        } catch (e) {
            console.error('Error loading data:', e);
        }
    }
}

function saveData() {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
    updateSyncStatus('syncing');
    
    setTimeout(() => {
        updateSyncStatus('synced');
        saveToCloud();
    }, 500);
}

async function saveToCloud() {
    try {
        const syncData = {
            lastUpdated: new Date().toISOString(),
            data: data
        };
        console.log('Data saved:', syncData);
    } catch (e) {
        console.log('Cloud sync not available');
    }
}

function updateSyncStatus(status) {
    const el = document.getElementById('sync-status');
    el.className = 'sync-status ' + status;
    
    if (status === 'syncing') {
        el.innerHTML = '<span class="sync-icon">🔄</span><span class="sync-text">Saving...</span>';
    } else if (status === 'synced') {
        el.innerHTML = '<span class="sync-icon">☁️</span><span class="sync-text">Saved</span>';
    } else if (status === 'error') {
        el.innerHTML = '<span class="sync-icon">⚠️</span><span class="sync-text">Error</span>';
    }
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

// Storage Selection (Fridge/Pantry)
function selectStorage(storage) {
    currentStorage = storage;
    selectedItems.clear();
    
    document.querySelectorAll('.storage-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-${storage}`).classList.add('active');
    
    // Update body class for color theming
    if (storage === 'pantry') {
        document.body.classList.add('pantry-mode');
    } else {
        document.body.classList.remove('pantry-mode');
    }
    
    // Update title
    const title = document.getElementById('items-title');
    title.textContent = storage === 'fridge' ? '📦 In the Fridge' : '📦 In the Pantry';
    
    renderQuickAddButtons();
    renderItems();
    updateStats();
    updateExportButton();
}

// Quick Add Buttons
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
    document.getElementById('quick-edit-label').textContent = `${name}`;
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

// Selection for Export
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
    
    if (selectedItems.size > 0) {
        btn.classList.remove('hidden');
        count.textContent = selectedItems.size;
    } else {
        btn.classList.add('hidden');
    }
}

// Export
function exportSelected() {
    const items = data[currentHouse][currentStorage].filter(i => selectedItems.has(i.id));
    
    if (items.length === 0) {
        showToast('Select at least one item', 'error');
        return;
    }
    
    const storageName = currentStorage === 'fridge' ? 'fridge' : 'pantry';
    const houseName = currentHouse === 'salvo' ? "Salvo's" : "Elisa's";
    
    let text = `🍳 I have these ingredients (${houseName} ${storageName}):\n\n`;
    items.forEach(item => {
        const daysLeft = getDaysLeft(item.expiry);
        let status = '';
        if (daysLeft < 0) status = ' ⚠️ EXPIRED';
        else if (daysLeft <= 2) status = ' ⚠️ expiring soon';
        
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
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('📋 Copied!', 'success');
            closeExportModal();
            
            // Clear selection after export
            selectedItems.clear();
            renderItems();
            updateExportButton();
        });
    } else {
        // Fallback
        document.getElementById('export-text').select();
        document.execCommand('copy');
        showToast('📋 Copied!', 'success');
    }
}

// Render Items
function renderItems() {
    const container = document.getElementById('items-list');
    let items = [...data[currentHouse][currentStorage]];
    
    // Sort by expiry date
    items.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
    
    // Apply filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (currentFilter === 'expiring') {
        const twoDaysFromNow = new Date(today);
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
        items = items.filter(item => {
            const expiry = new Date(item.expiry);
            return expiry >= today && expiry <= twoDaysFromNow;
        });
    } else if (currentFilter === 'expired') {
        items = items.filter(item => new Date(item.expiry) < today);
    }
    
    if (items.length === 0) {
        const emptyIcon = currentStorage === 'fridge' ? '🧊' : '🗄️';
        const emptyText = currentFilter === 'all' 
            ? `No items in the ${currentStorage}` 
            : 'No items in this category';
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">${emptyIcon}</div>
                <p>${emptyText}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = items.map(item => {
        const daysLeft = getDaysLeft(item.expiry);
        
        let statusClass = '';
        let expiryText = '';
        
        if (daysLeft < 0) {
            statusClass = 'expired';
            expiryText = `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`;
        } else if (daysLeft === 0) {
            statusClass = 'expiring';
            expiryText = 'Expires TODAY!';
        } else if (daysLeft <= 2) {
            statusClass = 'expiring';
            expiryText = `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
        } else {
            expiryText = `Expires ${formatDate(item.expiry)}`;
        }
        
        const isSelected = selectedItems.has(item.id);
        
        return `
            <div class="item-card ${statusClass} ${isSelected ? 'selected' : ''}" onclick="openEditModal(${item.id})">
                <input type="checkbox" class="item-checkbox" 
                    ${isSelected ? 'checked' : ''} 
                    onclick="toggleSelection(${item.id}, event)">
                <div class="item-info">
                    <div class="item-name">${escapeHtml(item.name)}</div>
                    <div class="item-expiry ${statusClass}">${expiryText}</div>
                </div>
                <span class="item-quantity">x${item.quantity}</span>
                <div class="item-actions">
                    <button class="item-edit" onclick="openEditModal(${item.id}); event.stopPropagation();">✏️</button>
                    <button class="item-delete" onclick="deleteItem(${item.id}, event)">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function getDaysLeft(expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
}

// Update Stats
function updateStats() {
    const items = data[currentHouse][currentStorage];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const twoDaysFromNow = new Date(today);
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    
    const total = items.length;
    const expiring = items.filter(item => {
        const expiry = new Date(item.expiry);
        return expiry >= today && expiry <= twoDaysFromNow;
    }).length;
    const expired = items.filter(item => new Date(item.expiry) < today).length;
    
    document.getElementById('total-items').textContent = total;
    document.getElementById('expiring-soon').textContent = expiring;
    document.getElementById('expired-items').textContent = expired;
}

// Filter Items
function filterItems(filter) {
    currentFilter = filter;
    
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    renderItems();
}

// Barcode Scanner
function startBarcodeScanner() {
    const container = document.getElementById('scanner-container');
    container.classList.remove('hidden');
    
    html5QrcodeScanner = new Html5Qrcode("scanner-view");
    
    html5QrcodeScanner.start(
        { facingMode: "environment" },
        {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.777
        },
        onBarcodeScanned,
        (errorMessage) => {}
    ).catch(err => {
        console.error("Scanner error:", err);
        showToast('Camera access error', 'error');
        closeScanner();
    });
}

async function onBarcodeScanned(barcode) {
    closeScanner();
    showToast('🔍 Looking up product...', 'success');
    
    try {
        const response = await fetch(`${CONFIG.OPEN_FOOD_FACTS_API}${barcode}.json`);
        const result = await response.json();
        
        if (result.status === 1 && result.product) {
            const product = result.product;
            const name = product.product_name || product.product_name_en || 'Unknown product';
            
            document.getElementById('product-name').value = name;
            showToast(`✅ Found: ${name}`, 'success');
            document.getElementById('expiry-date').focus();
        } else {
            showToast('Product not found', 'error');
            document.getElementById('product-name').focus();
        }
    } catch (e) {
        console.error('Error looking up barcode:', e);
        showToast('Lookup error', 'error');
    }
}

function closeScanner() {
    const container = document.getElementById('scanner-container');
    container.classList.add('hidden');
    
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().catch(err => console.log('Scanner stop error:', err));
        html5QrcodeScanner = null;
    }
}

// OCR Scanner
function startOCRScanner() {
    const container = document.getElementById('ocr-container');
    container.classList.remove('hidden');
    document.getElementById('ocr-input').click();
}

async function processOCR(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const preview = document.getElementById('ocr-preview');
    const status = document.getElementById('ocr-status');
    
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
    
    status.textContent = '🔍 Analyzing image...';
    status.classList.add('visible');
    
    try {
        const result = await Tesseract.recognize(file, 'eng+ita', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    status.textContent = `🔍 Analyzing: ${Math.round(m.progress * 100)}%`;
                }
            }
        });
        
        const text = result.data.text;
        const dateMatch = extractDate(text);
        
        if (dateMatch) {
            document.getElementById('expiry-date').value = dateMatch;
            status.textContent = `✅ Found date: ${formatDate(dateMatch)}`;
            showToast('Date detected!', 'success');
        } else {
            status.textContent = '⚠️ No date found';
            showToast('Date not found', 'error');
        }
        
        setTimeout(closeOCR, 2000);
        
    } catch (e) {
        console.error('OCR error:', e);
        status.textContent = '❌ Analysis error';
        showToast('OCR error', 'error');
    }
}

function extractDate(text) {
    const patterns = [
        // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
        /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](20\d{2})/,
        // DD/MM/YY
        /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})/,
        // MM/DD/YYYY (US format)
        /(0?[1-9]|1[0-2])[\/\-\.](\d{1,2})[\/\-\.](20\d{2})/,
        // "exp" or "best before" followed by date
        /(?:exp|best\s*before|use\s*by)[:\s]*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i,
        // Month names in English
        /(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(20\d{2}|\d{2})/i,
        // Month names in Italian
        /(\d{1,2})\s*(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[a-z]*\s*(20\d{2}|\d{2})/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            let day, month, year;
            
            if (match[2].match && match[2].match(/[a-z]/i)) {
                day = parseInt(match[1]);
                month = getMonthNumber(match[2]);
                year = match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3]);
            } else {
                day = parseInt(match[1]);
                month = parseInt(match[2]);
                year = match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3]);
            }
            
            if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }
    }
    
    return null;
}

function getMonthNumber(monthName) {
    const months = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
        'gen': 1, 'mag': 5, 'giu': 6, 'lug': 7, 'ago': 8, 'set': 9, 'ott': 10, 'dic': 12
    };
    return months[monthName.toLowerCase().substring(0, 3)] || 1;
}

function closeOCR() {
    const container = document.getElementById('ocr-container');
    container.classList.add('hidden');
    document.getElementById('ocr-preview').innerHTML = '';
    document.getElementById('ocr-status').classList.remove('visible');
    document.getElementById('ocr-input').value = '';
}

// Utility Functions
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

// Export functions for MaryJane integration
function getExpiringItems(daysAhead = 2) {
    const result = { salvo: { fridge: [], pantry: [] }, elisa: { fridge: [], pantry: [] } };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() + daysAhead);
    
    for (const house of ['salvo', 'elisa']) {
        for (const storage of ['fridge', 'pantry']) {
            result[house][storage] = data[house][storage].filter(item => {
                const expiry = new Date(item.expiry);
                return expiry <= threshold;
            }).map(item => ({
                ...item,
                daysLeft: getDaysLeft(item.expiry)
            }));
        }
    }
    
    return result;
}

// Global API
window.FridgeTracker = {
    getData: () => data,
    getExpiringItems,
    addItem: (house, storage, name, expiry, quantity = 1) => {
        const item = {
            id: Date.now(),
            name,
            expiry,
            quantity,
            addedAt: new Date().toISOString()
        };
        data[house][storage].push(item);
        saveData();
        if (house === currentHouse && storage === currentStorage) {
            renderItems();
            updateStats();
        }
        return item;
    }
};
