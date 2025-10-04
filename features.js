// Features: Advanced functionality

// Dark Mode
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

// Load saved theme
function loadTheme() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
        const icon = document.querySelector('.theme-icon');
        if (icon) icon.textContent = '☀️';
    }
}

// Currency Conversion
function updateCurrency() {
    const currency = document.getElementById('currencyFilter').value;
    localStorage.setItem('selectedCurrency', currency);

    // Re-display data with new currency
    displayData(filteredData);
    updateStats(filteredData);
    updateCharts(filteredData);
}

function convertAmount(amount, toCurrency = null) {
    if (!toCurrency) {
        toCurrency = document.getElementById('currencyFilter')?.value || 'THB';
    }
    const rate = CONFIG.CURRENCY_RATES[toCurrency];
    return amount * rate;
}

function formatCurrency(amount, currency = null) {
    if (!currency) {
        currency = document.getElementById('currencyFilter')?.value || 'THB';
    }
    const symbol = CONFIG.CURRENCY_SYMBOLS[currency];
    const convertedAmount = convertAmount(amount, currency);
    return symbol + convertedAmount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Quick Add Modal
function openQuickAdd() {
    const modal = document.getElementById('quickAddModal');
    modal.classList.add('active');
    document.getElementById('quickAmount').focus();
}

function closeQuickAdd() {
    const modal = document.getElementById('quickAddModal');
    modal.classList.remove('active');
    document.getElementById('quickAddForm').reset();
}

// Handle quick add form
document.addEventListener('DOMContentLoaded', function() {
    const quickForm = document.getElementById('quickAddForm');
    if (quickForm) {
        quickForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const formData = {
                date: new Date().toISOString().split('T')[0],
                transaction: document.getElementById('quickDescription').value,
                amount: -Math.abs(parseFloat(document.getElementById('quickAmount').value)), // Negative for expense
                categories: document.getElementById('quickCategory').value,
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
        });
    }
});

// Close modal when clicking outside
window.onclick = function(event) {
    const quickModal = document.getElementById('quickAddModal');
    const exportModal = document.getElementById('exportModal');

    if (event.target === quickModal) {
        closeQuickAdd();
    }
    if (event.target === exportModal) {
        closeExportMenu();
    }
};

// Export Menu
function showExportMenu() {
    const modal = document.getElementById('exportModal');
    modal.classList.add('active');
}

function closeExportMenu() {
    const modal = document.getElementById('exportModal');
    modal.classList.remove('active');
}

// Export to PDF
async function exportToPDF() {
    try {
        showNotification('Generating PDF...', 'info');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Add title
        doc.setFontSize(20);
        doc.setTextColor(16, 185, 129);
        doc.text('Accounting Report', 20, 20);

        // Add date
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 30);

        // Add statistics
        doc.setFontSize(12);
        doc.setTextColor(0);
        let yPos = 45;

        const stats = {
            'Total Entries': document.getElementById('totalEntries').textContent,
            'Total Income': document.getElementById('totalIncome').textContent,
            'Total Expenses': document.getElementById('totalExpenses').textContent,
            'Net Balance': document.getElementById('netBalance').textContent
        };

        Object.entries(stats).forEach(([key, value]) => {
            doc.text(`${key}: ${value}`, 20, yPos);
            yPos += 10;
        });

        // Add table
        yPos += 10;
        doc.setFontSize(14);
        doc.text('Recent Transactions', 20, yPos);
        yPos += 10;

        // Get table data
        const tableData = filteredData.slice(0, 20).map(row => [
            formatDate(row.date),
            row.transaction.substring(0, 30),
            formatCurrency(Math.abs(row.amount)),
            row.categories
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['Date', 'Transaction', 'Amount', 'Category']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129] }
        });

        // Save PDF
        doc.save(`accounting-report-${new Date().getTime()}.pdf`);
        showNotification('PDF exported successfully!', 'success');
        closeExportMenu();

    } catch (error) {
        console.error('PDF export error:', error);
        showNotification('Error exporting PDF. Make sure jsPDF is loaded.', 'error');
    }
}

// Export to CSV
function exportToCSV() {
    try {
        const headers = ['Date', 'Transaction', 'Amount', 'Type', 'Category', 'Tags'];
        const rows = filteredData.map(row => [
            formatDate(row.date),
            `"${row.transaction.replace(/"/g, '""')}"`,
            Math.abs(row.amount).toFixed(2),
            row.amount >= 0 ? 'Income' : 'Expense',
            row.categories,
            row.tags || ''
        ]);

        let csvContent = headers.join(',') + '\\n';
        rows.forEach(row => {
            csvContent += row.join(',') + '\\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `transactions-${new Date().getTime()}.csv`;
        link.click();

        showNotification('CSV exported successfully!', 'success');
        closeExportMenu();

    } catch (error) {
        console.error('CSV export error:', error);
        showNotification('Error exporting CSV', 'error');
    }
}

// Export to Excel (HTML table format)
function exportToExcel() {
    try {
        const headers = '<tr><th>Date</th><th>Transaction</th><th>Amount</th><th>Type</th><th>Category</th><th>Tags</th></tr>';
        const rows = filteredData.map(row => `
            <tr>
                <td>${formatDate(row.date)}</td>
                <td>${row.transaction}</td>
                <td>${Math.abs(row.amount).toFixed(2)}</td>
                <td>${row.amount >= 0 ? 'Income' : 'Expense'}</td>
                <td>${row.categories}</td>
                <td>${row.tags || ''}</td>
            </tr>
        `).join('');

        const html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
            <head><meta charset="utf-8"></head>
            <body>
                <table border="1">
                    <thead>${headers}</thead>
                    <tbody>${rows}</tbody>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `transactions-${new Date().getTime()}.xls`;
        link.click();

        showNotification('Excel file exported successfully!', 'success');
        closeExportMenu();

    } catch (error) {
        console.error('Excel export error:', error);
        showNotification('Error exporting Excel file', 'error');
    }
}

// Generate Insights
function generateInsights(data) {
    const insightsContainer = document.getElementById('insightsContainer');
    if (!insightsContainer) return;

    const insights = [];

    // Calculate totals
    const totalIncome = data.filter(r => r.amount >= 0).reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = Math.abs(data.filter(r => r.amount < 0).reduce((sum, r) => sum + r.amount, 0));
    const netBalance = totalIncome - totalExpenses;

    // Insight 1: Net balance status
    if (netBalance > 0) {
        insights.push({
            type: 'info',
            title: '💰 Positive Cash Flow',
            text: `You're saving ${formatCurrency(netBalance)} this period. Great job!`
        });
    } else if (netBalance < 0) {
        insights.push({
            type: 'warning',
            title: '⚠️ Negative Cash Flow',
            text: `You're spending ${formatCurrency(Math.abs(netBalance))} more than you earn. Consider reducing expenses.`
        });
    }

    // Insight 2: Top spending category
    const categoryTotals = {};
    data.filter(r => r.amount < 0).forEach(row => {
        const cat = row.categories || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(row.amount);
    });

    if (Object.keys(categoryTotals).length > 0) {
        const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
        const percentage = ((topCategory[1] / totalExpenses) * 100).toFixed(1);
        insights.push({
            type: 'info',
            title: '📊 Top Spending Category',
            text: `${topCategory[0]} accounts for ${percentage}% of your expenses (${formatCurrency(topCategory[1])})`
        });
    }

    // Insight 3: Average daily spending
    const daysWithExpenses = new Set(
        data.filter(r => r.amount < 0 && r.date).map(r => formatDate(r.date))
    ).size;

    if (daysWithExpenses > 0) {
        const avgDaily = totalExpenses / daysWithExpenses;
        insights.push({
            type: 'info',
            title: '📅 Daily Average',
            text: `You spend an average of ${formatCurrency(avgDaily)} per day`
        });
    }

    // Insight 4: Spending trend
    if (data.length >= 14) {
        const midpoint = Math.floor(data.length / 2);
        const firstHalf = data.slice(0, midpoint).filter(r => r.amount < 0).reduce((sum, r) => sum + Math.abs(r.amount), 0);
        const secondHalf = data.slice(midpoint).filter(r => r.amount < 0).reduce((sum, r) => sum + Math.abs(r.amount), 0);

        if (secondHalf > firstHalf * 1.2) {
            insights.push({
                type: 'warning',
                title: '📈 Increasing Expenses',
                text: `Your spending has increased by ${((secondHalf - firstHalf) / firstHalf * 100).toFixed(1)}% recently`
            });
        } else if (secondHalf < firstHalf * 0.8) {
            insights.push({
                type: 'info',
                title: '📉 Decreasing Expenses',
                text: `Great! You've reduced spending by ${((firstHalf - secondHalf) / firstHalf * 100).toFixed(1)}%`
            });
        }
    }

    // Insight 5: Most used tags
    const tagCounts = {};
    data.forEach(row => {
        if (row.tags) {
            row.tags.split(',').forEach(tag => {
                const trimmedTag = tag.trim();
                if (trimmedTag) {
                    tagCounts[trimmedTag] = (tagCounts[trimmedTag] || 0) + 1;
                }
            });
        }
    });

    if (Object.keys(tagCounts).length > 0) {
        const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0];
        insights.push({
            type: 'info',
            title: '🏷️ Most Used Tag',
            text: `"${topTag[0]}" used ${topTag[1]} times`
        });
    }

    // Render insights
    if (insights.length === 0) {
        insightsContainer.innerHTML = '<p style="color: var(--text-secondary);">Add more transactions to see insights</p>';
    } else {
        insightsContainer.innerHTML = insights.map(insight => `
            <div class="insight-card ${insight.type}">
                <div class="insight-title">${insight.title}</div>
                <div class="insight-text">${insight.text}</div>
            </div>
        `).join('');
    }
}

// Filter by tag
function filterByTag(tag) {
    document.getElementById('searchInput').value = tag;
    const event = new Event('input');
    document.getElementById('searchInput').dispatchEvent(event);
    switchTab('dashboard');
    document.querySelector('.tab[onclick*="dashboard"]').click();
}

// Saved Filters
function saveFilter() {
    const filterName = prompt('Enter a name for this filter:');
    if (!filterName) return;

    const filterConfig = {
        dateFilter: document.getElementById('dateFilter').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        search: document.getElementById('searchInput').value
    };

    const savedFilters = JSON.parse(localStorage.getItem('savedFilters') || '{}');
    savedFilters[filterName] = filterConfig;
    localStorage.setItem('savedFilters', JSON.stringify(savedFilters));

    displaySavedFilters();
    showNotification('Filter saved successfully!', 'success');
}

function displaySavedFilters() {
    const container = document.getElementById('savedFilters');
    if (!container) return;

    const savedFilters = JSON.parse(localStorage.getItem('savedFilters') || '{}');

    if (Object.keys(savedFilters).length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = Object.entries(savedFilters).map(([name, config]) => `
        <div class="saved-filter" onclick="applySavedFilter('${name}')">
            ${name}
            <span class="remove" onclick="event.stopPropagation(); removeSavedFilter('${name}')">✕</span>
        </div>
    `).join('');
}

function applySavedFilter(name) {
    const savedFilters = JSON.parse(localStorage.getItem('savedFilters') || '{}');
    const config = savedFilters[name];

    if (config) {
        document.getElementById('dateFilter').value = config.dateFilter;
        document.getElementById('startDate').value = config.startDate;
        document.getElementById('endDate').value = config.endDate;
        document.getElementById('searchInput').value = config.search;

        if (config.dateFilter === 'custom') {
            document.getElementById('customDateRange').style.display = 'flex';
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

// Settings
function saveSettings() {
    const settings = {
        showStats: document.getElementById('showStats').checked,
        showCharts: document.getElementById('showCharts').checked,
        showTable: document.getElementById('showTable').checked,
        defaultView: document.getElementById('defaultView').value
    };

    localStorage.setItem('dashboardSettings', JSON.stringify(settings));
    applySettings();
    showNotification('Settings saved', 'success');
}

function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('dashboardSettings') || '{}');

    if (settings.showStats !== undefined) {
        document.getElementById('showStats').checked = settings.showStats;
    }
    if (settings.showCharts !== undefined) {
        document.getElementById('showCharts').checked = settings.showCharts;
    }
    if (settings.showTable !== undefined) {
        document.getElementById('showTable').checked = settings.showTable;
    }
    if (settings.defaultView) {
        document.getElementById('defaultView').value = settings.defaultView;
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

// Clear cache
function clearCache() {
    if (confirm('Clear all cached data? This will not delete your transactions.')) {
        localStorage.clear();
        showNotification('Cache cleared successfully', 'success');
        setTimeout(() => location.reload(), 1000);
    }
}

// Clear all data (dangerous)
function confirmClearData() {
    const confirmation = prompt('Type "DELETE ALL" to confirm deletion of all data:');
    if (confirmation === 'DELETE ALL') {
        alert('This action would delete all data from Google Sheets. For safety, this is disabled. Please delete manually from your sheet.');
    }
}

// Keyboard Shortcuts
document.addEventListener('keydown', function(e) {
    // Alt + N: Quick Add
    if (e.altKey && e.key === 'n') {
        e.preventDefault();
        openQuickAdd();
    }

    // Alt + D: Dashboard
    if (e.altKey && e.key === 'd') {
        e.preventDefault();
        document.querySelector('.tab[onclick*="dashboard"]').click();
    }

    // Alt + A: Analytics
    if (e.altKey && e.key === 'a') {
        e.preventDefault();
        document.querySelector('.tab[onclick*="analytics"]').click();
    }

    // Alt + S: Settings
    if (e.altKey && e.key === 's') {
        e.preventDefault();
        document.querySelector('.tab[onclick*="settings"]').click();
    }

    // Alt + T: Toggle Theme
    if (e.altKey && e.key === 't') {
        e.preventDefault();
        toggleTheme();
    }

    // Ctrl + F: Focus search
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }

    // Escape: Close modals
    if (e.key === 'Escape') {
        closeQuickAdd();
        closeExportMenu();
    }
});

// PWA Installation
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.style.display = 'block';
    }

    const status = document.getElementById('pwaStatus');
    if (status) {
        status.textContent = 'App ready to install!';
        status.style.color = 'var(--primary-color)';
    }
});

function installPWA() {
    if (!deferredPrompt) {
        showNotification('App already installed or not supported', 'info');
        return;
    }

    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            showNotification('App installed successfully!', 'success');
        }
        deferredPrompt = null;

        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    });
}

// Check if already installed
window.addEventListener('appinstalled', () => {
    const status = document.getElementById('pwaStatus');
    if (status) {
        status.textContent = 'App is installed!';
        status.style.color = 'var(--primary-color)';
    }

    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.style.display = 'none';
    }

    showNotification('App installed successfully!', 'success');
});

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
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
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

// Initialize tag suggestions
document.addEventListener('DOMContentLoaded', function() {
    const tagsInput = document.getElementById('tags');
    if (tagsInput) {
        tagsInput.addEventListener('focus', showTagSuggestions);
        tagsInput.addEventListener('input', showTagSuggestions);
    }
});
