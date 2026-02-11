// FridgeTracker - Main App Logic

// Configuration
const CONFIG = {
    STORAGE_KEY: 'fridgetracker_data',
    SYNC_URL: null, // Will be set up for cloud sync
    OPEN_FOOD_FACTS_API: 'https://world.openfoodfacts.org/api/v0/product/'
};

// State
let currentHouse = 'salvo';
let currentFilter = 'all';
let html5QrcodeScanner = null;
let data = {
    salvo: [],
    elisa: []
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadData();
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
            data = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading data:', e);
        }
    }
}

function saveData() {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
    updateSyncStatus('syncing');
    
    // Simulate cloud sync (will be replaced with actual sync)
    setTimeout(() => {
        updateSyncStatus('synced');
        // Also save to a file for MaryJane to read
        saveToCloud();
    }, 500);
}

async function saveToCloud() {
    // This will be implemented to sync with MaryJane's backend
    // For now, we'll use a webhook or file-based approach
    try {
        // Store data in a format MaryJane can read
        const syncData = {
            lastUpdated: new Date().toISOString(),
            houses: data
        };
        
        // Try to sync via webhook if available
        if (CONFIG.SYNC_URL) {
            await fetch(CONFIG.SYNC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(syncData)
            });
        }
    } catch (e) {
        console.log('Cloud sync not available, using local storage');
    }
}

function updateSyncStatus(status) {
    const el = document.getElementById('sync-status');
    el.className = 'sync-status ' + status;
    
    if (status === 'syncing') {
        el.innerHTML = '<span class="sync-icon">🔄</span><span class="sync-text">Sincronizzazione...</span>';
    } else if (status === 'synced') {
        el.innerHTML = '<span class="sync-icon">☁️</span><span class="sync-text">Sincronizzato</span>';
    } else if (status === 'error') {
        el.innerHTML = '<span class="sync-icon">⚠️</span><span class="sync-text">Errore sync</span>';
    }
}

// House Selection
function selectHouse(house) {
    currentHouse = house;
    
    // Update button styles
    document.querySelectorAll('.house-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-casa-${house}`).classList.add('active');
    
    renderItems();
    updateStats();
}

// Add Item
function addItem(event) {
    event.preventDefault();
    
    const name = document.getElementById('product-name').value.trim();
    const expiry = document.getElementById('expiry-date').value;
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    
    if (!name || !expiry) {
        showToast('Compila tutti i campi!', 'error');
        return;
    }
    
    const item = {
        id: Date.now(),
        name: name,
        expiry: expiry,
        quantity: quantity,
        addedAt: new Date().toISOString()
    };
    
    data[currentHouse].push(item);
    saveData();
    renderItems();
    updateStats();
    
    // Reset form
    document.getElementById('product-name').value = '';
    document.getElementById('quantity').value = '1';
    
    showToast(`✅ ${name} aggiunto!`, 'success');
}

// Quick Add
function quickAdd(name, daysToExpiry) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + daysToExpiry);
    
    const item = {
        id: Date.now(),
        name: name,
        expiry: expiry.toISOString().split('T')[0],
        quantity: 1,
        addedAt: new Date().toISOString()
    };
    
    data[currentHouse].push(item);
    saveData();
    renderItems();
    updateStats();
    
    showToast(`✅ ${name} aggiunto!`, 'success');
}

// Delete Item
function deleteItem(id) {
    data[currentHouse] = data[currentHouse].filter(item => item.id !== id);
    saveData();
    renderItems();
    updateStats();
    showToast('🗑️ Prodotto rimosso', 'success');
}

// Update Quantity
function updateQuantity(id, delta) {
    const item = data[currentHouse].find(item => item.id === id);
    if (item) {
        item.quantity = Math.max(1, item.quantity + delta);
        saveData();
        renderItems();
    }
}

// Render Items
function renderItems() {
    const container = document.getElementById('items-list');
    let items = [...data[currentHouse]];
    
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
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">🧊</div>
                <p>${currentFilter === 'all' ? 'Nessun prodotto nel frigo' : 'Nessun prodotto in questa categoria'}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = items.map(item => {
        const expiry = new Date(item.expiry);
        const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        
        let statusClass = '';
        let expiryText = '';
        
        if (daysLeft < 0) {
            statusClass = 'expired';
            expiryText = `Scaduto da ${Math.abs(daysLeft)} giorn${Math.abs(daysLeft) === 1 ? 'o' : 'i'}`;
        } else if (daysLeft === 0) {
            statusClass = 'expiring';
            expiryText = 'Scade OGGI!';
        } else if (daysLeft <= 2) {
            statusClass = 'expiring';
            expiryText = `Scade tra ${daysLeft} giorn${daysLeft === 1 ? 'o' : 'i'}`;
        } else {
            expiryText = `Scade il ${formatDate(item.expiry)}`;
        }
        
        return `
            <div class="item-card ${statusClass}">
                <div class="item-info">
                    <div class="item-name">${escapeHtml(item.name)}</div>
                    <div class="item-expiry ${statusClass}">${expiryText}</div>
                </div>
                <span class="item-quantity">x${item.quantity}</span>
                <button class="item-delete" onclick="deleteItem(${item.id})">🗑️</button>
            </div>
        `;
    }).join('');
}

// Update Stats
function updateStats() {
    const items = data[currentHouse];
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
        (errorMessage) => {
            // Ignore scan errors
        }
    ).catch(err => {
        console.error("Scanner error:", err);
        showToast('Errore accesso fotocamera', 'error');
        closeScanner();
    });
}

async function onBarcodeScanned(barcode) {
    // Stop scanner
    closeScanner();
    
    showToast('🔍 Cerco prodotto...', 'success');
    
    try {
        // Look up product in Open Food Facts
        const response = await fetch(`${CONFIG.OPEN_FOOD_FACTS_API}${barcode}.json`);
        const result = await response.json();
        
        if (result.status === 1 && result.product) {
            const product = result.product;
            const name = product.product_name_it || product.product_name || 'Prodotto sconosciuto';
            
            document.getElementById('product-name').value = name;
            showToast(`✅ Trovato: ${name}`, 'success');
            
            // Focus on expiry date
            document.getElementById('expiry-date').focus();
        } else {
            showToast('Prodotto non trovato nel database', 'error');
            document.getElementById('product-name').focus();
        }
    } catch (e) {
        console.error('Error looking up barcode:', e);
        showToast('Errore ricerca prodotto', 'error');
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
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
    
    // Show status
    status.textContent = '🔍 Analizzo immagine...';
    status.classList.add('visible');
    
    try {
        // Run OCR
        const result = await Tesseract.recognize(file, 'ita+eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    status.textContent = `🔍 Analisi: ${Math.round(m.progress * 100)}%`;
                }
            }
        });
        
        // Extract date from text
        const text = result.data.text;
        const dateMatch = extractDate(text);
        
        if (dateMatch) {
            document.getElementById('expiry-date').value = dateMatch;
            status.textContent = `✅ Trovata data: ${formatDate(dateMatch)}`;
            showToast('Data scadenza rilevata!', 'success');
        } else {
            status.textContent = '⚠️ Nessuna data trovata. Inseriscila manualmente.';
            showToast('Data non trovata', 'error');
        }
        
        // Close OCR after a delay
        setTimeout(closeOCR, 2000);
        
    } catch (e) {
        console.error('OCR error:', e);
        status.textContent = '❌ Errore analisi immagine';
        showToast('Errore OCR', 'error');
    }
}

function extractDate(text) {
    // Common Italian date formats
    const patterns = [
        // DD/MM/YYYY or DD-MM-YYYY
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/,
        // DD/MM/YY or DD-MM-YY
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/,
        // "scad" followed by date
        /scad[a-z]*[:\s]*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
        // Month names in Italian
        /(\d{1,2})\s*(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[a-z]*\s*(20\d{2}|\d{2})/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            let day, month, year;
            
            if (match[2].match(/[a-z]/i)) {
                // Month name format
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
        'gen': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'mag': 5, 'giu': 6,
        'lug': 7, 'ago': 8, 'set': 9, 'ott': 10, 'nov': 11, 'dic': 12
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
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach(t => t.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

// Export data for MaryJane integration
function exportData() {
    return JSON.stringify(data, null, 2);
}

// Import data (for MaryJane to add items)
function importItem(house, name, expiry, quantity = 1) {
    const item = {
        id: Date.now(),
        name: name,
        expiry: expiry,
        quantity: quantity,
        addedAt: new Date().toISOString()
    };
    
    data[house].push(item);
    saveData();
    
    if (house === currentHouse) {
        renderItems();
        updateStats();
    }
    
    return item;
}

// Check expiring items (called by MaryJane)
function getExpiringItems(daysAhead = 2) {
    const result = { salvo: [], elisa: [] };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() + daysAhead);
    
    for (const house of ['salvo', 'elisa']) {
        result[house] = data[house].filter(item => {
            const expiry = new Date(item.expiry);
            return expiry <= threshold;
        }).map(item => ({
            ...item,
            daysLeft: Math.ceil((new Date(item.expiry) - today) / (1000 * 60 * 60 * 24))
        }));
    }
    
    return result;
}

// Make functions available globally for debugging
window.FridgeTracker = {
    exportData,
    importItem,
    getExpiringItems,
    data: () => data
};
