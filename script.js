// Global variables
let allData = [];
let filteredData = [];
let sortColumn = 'date';
let sortDirection = 'desc';

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Set today's date
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    // Load saved theme and settings
    loadTheme();
    loadSettings();
    displaySavedFilters();

    // Load saved currency
    const savedCurrency = localStorage.getItem('selectedCurrency');
    if (savedCurrency) {
        const currencyFilter = document.getElementById('currencyFilter');
        if (currencyFilter) {
            currencyFilter.value = savedCurrency;
        }
    }

    // Load data
    loadData();

    // Setup event listeners
    setupEventListeners();

    // Check PWA status
    checkPWAStatus();

    // Initialize charts
    initializeCharts();
});

// Setup event listeners
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filteredData = allData.filter(row =>
                row.transaction.toLowerCase().includes(searchTerm) ||
                row.categories.toLowerCase().includes(searchTerm) ||
                row.amount.toString().includes(searchTerm) ||
                (row.tags && row.tags.toLowerCase().includes(searchTerm))
            );
            displayData(filteredData);
            updateStats(filteredData);
        });
    }

    // Date filter
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
        dateFilter.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                const customRange = document.getElementById('customDateRange');
                if (customRange) {
                    customRange.style.display = 'flex';
                }
            } else {
                const customRange = document.getElementById('customDateRange');
                if (customRange) {
                    customRange.style.display = 'none';
                }
                applyFilters();
            }
        });
    }

    // Form submission
    const form = document.getElementById('accountingForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // Quick add form
    const quickForm = document.getElementById('quickAddForm');
    if (quickForm) {
        quickForm.addEventListener('submit', handleQuickAddSubmit);
    }

    // Tags input
    const tagsInput = document.getElementById('tags');
    if (tagsInput) {
        tagsInput.addEventListener('focus', showTagSuggestions);
        tagsInput.addEventListener('input', showTagSuggestions);
    }

    // Close modal on outside click
    window.addEventListener('click', function(event) {
        const quickModal = document.getElementById('quickAddModal');
        const exportModal = document.getElementById('exportModal');

        if (event.target === quickModal) {
            closeQuickAdd();
        }
        if (event.target === exportModal) {
            closeExportMenu();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Handle keyboard shortcuts
function handleKeyboardShortcuts(e) {
    // Alt + N: Quick Add
    if (e.altKey && e.key === 'n') {
        e.preventDefault();
        openQuickAdd();
    }

    // Alt + D: Dashboard
    if (e.altKey && e.key === 'd') {
        e.preventDefault();
        const dashboardTab = document.querySelector('.tab[onclick*="dashboard"]');
        if (dashboardTab) dashboardTab.click();
    }

    // Alt + A: Analytics
    if (e.altKey && e.key === 'a') {
        e.preventDefault();
        const analyticsTab = document.querySelector('.tab[onclick*="analytics"]');
        if (analyticsTab) analyticsTab.click();
    }

    // Alt + S: Settings
    if (e.altKey && e.key === 's') {
        e.preventDefault();
        const settingsTab = document.querySelector('.tab[onclick*="settings"]');
        if (settingsTab) settingsTab.click();
    }

    // Alt + T: Toggle Theme
    if (e.altKey && e.key === 't') {
        e.preventDefault();
        toggleTheme();
    }

    // Ctrl + F: Focus search (prevent default browser search)
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.focus();
    }

    // Escape: Close modals
    if (e.key === 'Escape') {
        closeQuickAdd();
        closeExportMenu();
    }
}

// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));

    // Find and activate the clicked tab
    const clickedTab = event ? event.target : document.querySelector(`.tab[onclick*="${tabName}"]`);
    if (clickedTab) clickedTab.classList.add('active');

    const section = document.getElementById(tabName);
    if (section) section.classList.add('active');

    if (tabName === 'dashboard') {
        applyFilters();
    } else if (tabName === 'analytics') {
        updateCharts(filteredData);
        updateHeatmap(filteredData);
        updateTagCloud(filteredData);
        generateInsights(filteredData);
    } else if (tabName === 'settings') {
        loadSettings();
    }
}

// Load data from Google Sheets
async function loadData() {
    const tableBody = document.getElementById('dataTable');
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="6" class="loading"><div class="loader" style="margin: 0 auto;"></div><div>Loading data...</div></td></tr>';
    }

    try {
        const response = await fetch(CONFIG.WEBAPP_URL);
        const result = await response.json();

        if (result.success && result.data) {
            allData = result.data.map(row => {
                const transactionType = row.transactionType || (row.amount >= 0 ? 'income' : 'expense');
                return {
                    ...row,
                    date: row.date ? new Date(row.date) : null,
                    amount: parseFloat(row.amount) || 0,
                    tags: row.tags || '',
                    transactionType: transactionType
                };
            });

            // Apply default filter from settings
            const settings = JSON.parse(localStorage.getItem('dashboardSettings') || '{}');
            if (settings.defaultView && settings.defaultView !== 'all') {
                const dateFilter = document.getElementById('dateFilter');
                if (dateFilter) {
                    dateFilter.value = settings.defaultView;
                }
            }

            applyFilters();
        } else {
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="6" class="no-data">No data available</td></tr>';
            }
        }
    } catch (error) {
        console.error('Error loading data:', error);
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" class="no-data">Error loading data: ' + error.message + '</td></tr>';
        }
    }
}

// Apply date filters
function applyFilters() {
    const dateFilter = document.getElementById('dateFilter');
    if (!dateFilter) return;

    const filterType = dateFilter.value;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    filteredData = allData.filter(row => {
        if (!row.date) return true;

        const rowDate = new Date(row.date);
        rowDate.setHours(0, 0, 0, 0);

        switch(filterType) {
            case 'today':
                return rowDate.getTime() === now.getTime();

            case 'week':
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return rowDate >= weekAgo;

            case 'month':
                return rowDate.getMonth() === now.getMonth() &&
                       rowDate.getFullYear() === now.getFullYear();

            case 'year':
                return rowDate.getFullYear() === now.getFullYear();

            case 'custom':
                const startDateInput = document.getElementById('startDate');
                const endDateInput = document.getElementById('endDate');

                if (startDateInput && endDateInput) {
                    const startDate = startDateInput.value;
                    const endDate = endDateInput.value;

                    if (startDate && endDate) {
                        const start = new Date(startDate);
                        const end = new Date(endDate);
                        start.setHours(0, 0, 0, 0);
                        end.setHours(23, 59, 59, 999);
                        return rowDate >= start && rowDate <= end;
                    }
                }
                return true;

            default:
                return true;
        }
    });

    displayData(filteredData);
    updateStats(filteredData);
    updateCharts(filteredData);
}

// Display data in table
function displayData(data) {
    const tableBody = document.getElementById('dataTable');
    if (!tableBody) return;

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="no-data">No transactions found</td></tr>';
        return;
    }

    // Sort data
    const sortedData = [...data].sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];

        if (sortColumn === 'date') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
        } else if (sortColumn === 'amount') {
            aVal = Math.abs(parseFloat(aVal)) || 0;
            bVal = Math.abs(parseFloat(bVal)) || 0;
        }

        if (sortDirection === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });

    tableBody.innerHTML = sortedData.map((row, index) => {
        const isNegative = row.amount < 0;
        const tags = row.tags ? row.tags.split(',').map(t =>
            `<span class="transaction-tag">${escapeHtml(t.trim())}</span>`
        ).join('') : '-';

        return `
            <tr style="animation-delay: ${index * 0.05}s">
                <td>${formatDate(row.date)}</td>
                <td>${escapeHtml(row.transaction)}</td>
                <td class="amount ${isNegative ? 'negative' : ''}">${formatCurrency(Math.abs(row.amount))}</td>
                <td><span class="category-tag">${escapeHtml(row.categories)}</span></td>
                <td>${tags}</td>
                <td>${row.fileImage ? `<a href="${escapeHtml(row.fileImage)}" target="_blank" class="file-link">📎 View</a>` : '-'}</td>
            </tr>
        `;
    }).join('');
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Sort table
function sortTable(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'desc';
    }

    // Update sort icons
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.textContent = '⬍';
    });

    const currentHeader = event.target;
    const icon = currentHeader.querySelector('.sort-icon');
    if (icon) {
        icon.textContent = sortDirection === 'asc' ? '⬆' : '⬇';
    }

    displayData(filteredData);
}

// Update statistics
function updateStats(data) {
    const totalEntries = data.length;
    const totalIncome = data.filter(r => r.amount >= 0).reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = Math.abs(data.filter(r => r.amount < 0).reduce((sum, r) => sum + r.amount, 0));
    const netBalance = totalIncome - totalExpenses;

    const totalEntriesEl = document.getElementById('totalEntries');
    const totalIncomeEl = document.getElementById('totalIncome');
    const totalExpensesEl = document.getElementById('totalExpenses');
    const netBalanceEl = document.getElementById('netBalance');

    if (totalEntriesEl) totalEntriesEl.textContent = totalEntries.toLocaleString();
    if (totalIncomeEl) totalIncomeEl.textContent = formatCurrency(totalIncome);
    if (totalExpensesEl) totalExpensesEl.textContent = formatCurrency(totalExpenses);

    if (netBalanceEl) {
        netBalanceEl.textContent = formatCurrency(Math.abs(netBalance));

        // Change color based on positive/negative
        const balanceCard = netBalanceEl.closest('.stat-card');
        if (balanceCard) {
            if (netBalance >= 0) {
                balanceCard.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            } else {
                balanceCard.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            }
        }
    }
}

// Update all charts
function updateCharts(data) {
    updateLineChart(data);
    updatePieChart(data);
    updateBarChart(data);
    updateStackedChart(data);
}

// Format date
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const messageDiv = document.getElementById('message');

    if (!submitBtn || !messageDiv) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Submitting<span class="loader"></span>';
    messageDiv.innerHTML = '';

    const transactionTypeInput = document.querySelector('input[name="transactionType"]:checked');
    const transactionType = transactionTypeInput ? transactionTypeInput.value : 'expense';

    let amount = parseFloat(document.getElementById('amount').value);

    // Make expenses negative
    if (transactionType === 'expense' && amount > 0) {
        amount = -amount;
    }

    const formData = {
        date: document.getElementById('date').value,
        transaction: document.getElementById('transaction').value,
        amount: amount,
        transactionType: transactionType,
        categories: document.getElementById('categories').value,
        tags: document.getElementById('tags').value,
        fileImage: document.getElementById('fileImage').value || ''
    };

    try {
        await fetch(CONFIG.WEBAPP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        messageDiv.innerHTML = '<div class="success-message">✓ Entry added successfully!</div>';
        document.getElementById('accountingForm').reset();
        document.getElementById('date').valueAsDate = new Date();

        showNotification('Transaction added successfully!', 'success');

        // Reload data after delay
        setTimeout(() => {
            messageDiv.innerHTML = '';
            loadData();
        }, 2000);

    } catch (error) {
        console.error('Error submitting form:', error);
        messageDiv.innerHTML = '<div class="success-message">✓ Entry submitted! Refreshing data...</div>';
        document.getElementById('accountingForm').reset();
        document.getElementById('date').valueAsDate = new Date();

        showNotification('Transaction submitted!', 'success');

        setTimeout(() => {
            messageDiv.innerHTML = '';
            loadData();
        }, 2000);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Entry';
    }
}

// Handle quick add form submission
async function handleQuickAddSubmit(e) {
    e.preventDefault();

    const quickAmountInput = document.getElementById('quickAmount');
    const quickDescInput = document.getElementById('quickDescription');
    const quickCatInput = document.getElementById('quickCategory');

    if (!quickAmountInput || !quickDescInput || !quickCatInput) return;

    const formData = {
        date: new Date().toISOString().split('T')[0],
        transaction: quickDescInput.value,
        amount: -Math.abs(parseFloat(quickAmountInput.value)), // Negative for expense
        transactionType: 'expense',
        categories: quickCatInput.value,
        tags: '',
        fileImage: ''
    };

    try {
        await fetch(CONFIG.WEBAPP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        showNotification('Transaction added successfully!', 'success');
        closeQuickAdd();

        // Reload data after delay
        setTimeout(() => {
            loadData();
        }, 1500);

    } catch (error) {
        console.error('Error:', error);
        showNotification('Transaction submitted!', 'success');
        closeQuickAdd();
        setTimeout(() => loadData(), 1500);
    }
}

// Check PWA status
function checkPWAStatus() {
    const status = document.getElementById('pwaStatus');
    if (!status) return;

    if (window.matchMedia('(display-mode: standalone)').matches) {
        status.textContent = 'App is running in standalone mode!';
        status.style.color = 'var(--primary-color)';

        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    } else {
        status.textContent = 'Use Chrome/Edge to install this app.';
        status.style.color = 'var(--text-secondary)';
    }
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? 'var(--success-bg)' : type === 'error' ? 'var(--error-bg)' : 'rgba(59, 130, 246, 0.1)'};
        color: ${type === 'success' ? 'var(--success-text)' : type === 'error' ? 'var(--error-text)' : '#2563eb'};
        border-radius: 10px;
        box-shadow: var(--shadow);
        z-index: 9999;
        animation: slideDown 0.3s ease-out;
        font-weight: 600;
        max-width: 400px;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease-out';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Quick Add Modal functions
function openQuickAdd() {
    const modal = document.getElementById('quickAddModal');
    if (modal) {
        modal.classList.add('active');
        const quickAmount = document.getElementById('quickAmount');
        if (quickAmount) quickAmount.focus();
    }
}

function closeQuickAdd() {
    const modal = document.getElementById('quickAddModal');
    if (modal) {
        modal.classList.remove('active');
    }
    const quickForm = document.getElementById('quickAddForm');
    if (quickForm) {
        quickForm.reset();
    }
}

// Export Menu functions
function showExportMenu() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeExportMenu() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Tag suggestions
function showTagSuggestions() {
    const input = document.getElementById('tags');
    const container = document.getElementById('tagSuggestions');

    if (!input || !container) return;

    const currentTags = input.value.split(',').map(t => t.trim());
    const suggestions = CONFIG.TAG_SUGGESTIONS.filter(tag =>
        !currentTags.includes(tag)
    );

    container.innerHTML = suggestions.slice(0, 5).map(tag =>
        `<span class="tag-suggestion" onclick="addTag('${tag}')">${tag}</span>`
    ).join('');
}

function addTag(tag) {
    const input = document.getElementById('tags');
    if (!input) return;

    const currentTags = input.value ? input.value.split(',').map(t => t.trim()) : [];
    if (!currentTags.includes(tag)) {
        currentTags.push(tag);
        input.value = currentTags.join(', ');
    }
}

// Currency functions
function getCurrentCurrencySymbol() {
    const currencyFilter = document.getElementById('currencyFilter');
    const currency = currencyFilter ? currencyFilter.value : 'THB';
    return CONFIG.CURRENCY_SYMBOLS[currency];
}

function convertAmount(amount, toCurrency = null) {
    if (!toCurrency) {
        const currencyFilter = document.getElementById('currencyFilter');
        toCurrency = currencyFilter ? currencyFilter.value : 'THB';
    }
    const rate = CONFIG.CURRENCY_RATES[toCurrency];
    return amount * rate;
}

function formatCurrency(amount, currency = null) {
    if (!currency) {
        const currencyFilter = document.getElementById('currencyFilter');
        currency = currencyFilter ? currencyFilter.value : 'THB';
    }
    const symbol = CONFIG.CURRENCY_SYMBOLS[currency];
    const convertedAmount = convertAmount(amount, currency);
    return symbol + convertedAmount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function updateCurrency() {
    const currencyFilter = document.getElementById('currencyFilter');
    if (currencyFilter) {
        const currency = currencyFilter.value;
        localStorage.setItem('selectedCurrency', currency);
    }

    // Re-display data with new currency
    displayData(filteredData);
    updateStats(filteredData);
    updateCharts(filteredData);
}

// Initialize all charts
function initializeCharts() {
    updateLineChart([]);
    updatePieChart([]);
    updateBarChart([]);
    updateStackedChart([]);
}

// Theme functions
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);

    // Update theme icon
    const icon = document.querySelector('.theme-icon');
    if (icon) {
        icon.textContent = isDark ? '☀️' : '🌙';
    }
}

function loadTheme() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
        const icon = document.querySelector('.theme-icon');
        if (icon) icon.textContent = '☀️';
    }
}

// Settings functions
function saveSettings() {
    const showStats = document.getElementById('showStats');
    const showCharts = document.getElementById('showCharts');
    const showTable = document.getElementById('showTable');
    const defaultView = document.getElementById('defaultView');

    const settings = {
        showStats: showStats ? showStats.checked : true,
        showCharts: showCharts ? showCharts.checked : true,
        showTable: showTable ? showTable.checked : true,
        defaultView: defaultView ? defaultView.value : 'month'
    };

    localStorage.setItem('dashboardSettings', JSON.stringify(settings));
    applySettings();
    showNotification('Settings saved', 'success');
}

function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('dashboardSettings') || '{}');

    const showStats = document.getElementById('showStats');
    const showCharts = document.getElementById('showCharts');
    const showTable = document.getElementById('showTable');
    const defaultView = document.getElementById('defaultView');

    if (showStats && settings.showStats !== undefined) {
        showStats.checked = settings.showStats;
    }
    if (showCharts && settings.showCharts !== undefined) {
        showCharts.checked = settings.showCharts;
    }
    if (showTable && settings.showTable !== undefined) {
        showTable.checked = settings.showTable;
    }
    if (defaultView && settings.defaultView) {
        defaultView.value = settings.defaultView;
    }

    applySettings();
}

function applySettings() {
    const settings = JSON.parse(localStorage.getItem('dashboardSettings') || '{}');

    const statsGrid = document.querySelector('.stats-grid');
    const chartsGrid = document.querySelector('.charts-grid');
    const tableContainer = document.querySelector('.table-container');

    if (statsGrid) {
        statsGrid.style.display = settings.showStats !== false ? 'grid' : 'none';
    }
    if (chartsGrid) {
        chartsGrid.style.display = settings.showCharts !== false ? 'grid' : 'none';
    }
    if (tableContainer) {
        tableContainer.style.display = settings.showTable !== false ? 'block' : 'none';
    }
}

// Saved filters functions
function displaySavedFilters() {
    const container = document.getElementById('savedFilters');
    if (!container) return;

    const savedFilters = JSON.parse(localStorage.getItem('savedFilters') || '{}');

    if (Object.keys(savedFilters).length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = Object.entries(savedFilters).map(([name, config]) => `
        <div class="saved-filter" onclick="applySavedFilter('${escapeHtml(name)}')">
            ${escapeHtml(name)}
            <span class="remove" onclick="event.stopPropagation(); removeSavedFilter('${escapeHtml(name)}')">✕</span>
        </div>
    `).join('');
}

function applySavedFilter(name) {
    const savedFilters = JSON.parse(localStorage.getItem('savedFilters') || '{}');
    const config = savedFilters[name];

    if (config) {
        const dateFilter = document.getElementById('dateFilter');
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        const searchInput = document.getElementById('searchInput');

        if (dateFilter) dateFilter.value = config.dateFilter;
        if (startDate) startDate.value = config.startDate;
        if (endDate) endDate.value = config.endDate;
        if (searchInput) searchInput.value = config.search;

        if (config.dateFilter === 'custom') {
            const customRange = document.getElementById('customDateRange');
            if (customRange) customRange.style.display = 'flex';
        }

        applyFilters();
        showNotification(`Applied filter: ${name}`, 'success');
    }
}

function removeSavedFilter(name) {
    const savedFilters = JSON.parse(localStorage.getItem('savedFilters') || '{}');
    delete savedFilters[name];
    localStorage.setItem('savedFilters', JSON.stringify(savedFilters));
    displaySavedFilters();
    showNotification('Filter removed', 'success');
}

// Clear cache
function clearCache() {
    if (confirm('Clear all cached data? This will not delete your transactions.')) {
        localStorage.clear();
        showNotification('Cache cleared successfully', 'success');
        setTimeout(() => location.reload(), 1000);
    }
}

// Clear all data (warning only)
function confirmClearData() {
    const confirmation = prompt('Type "DELETE ALL" to confirm deletion of all data:');
    if (confirmation === 'DELETE ALL') {
        alert('This action would delete all data from Google Sheets. For safety, this is disabled. Please delete manually from your sheet.');
    }
}

// Filter by tag (from tag cloud)
function filterByTag(tag) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = tag;
        const event = new Event('input');
        searchInput.dispatchEvent(event);
    }

    // Switch to dashboard
    const dashboardTab = document.querySelector('.tab[onclick*="dashboard"]');
    if (dashboardTab) dashboardTab.click();
}
