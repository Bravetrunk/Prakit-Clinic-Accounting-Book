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
                document.getElementById('customDateRange').style.display = 'flex';
            } else {
                document.getElementById('customDateRange').style.display = 'none';
                applyFilters();
            }
        });
    }

    // Form submission
    const form = document.getElementById('accountingForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
}

// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');

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
                document.getElementById('dateFilter').value = settings.defaultView;
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
            tableBody.innerHTML = '<tr><td colspan="6" class="no-data">Error: ' + error.message + '</td></tr>';
        }
    }
}

// Apply date filters
function applyFilters() {
    const filterType = document.getElementById('dateFilter').value;
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
                const startDate = document.getElementById('startDate').value;
                const endDate = document.getElementById('endDate').value;

                if (startDate && endDate) {
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    start.setHours(0, 0, 0, 0);
                    end.setHours(23, 59, 59, 999);
                    return rowDate >= start && rowDate <= end;
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
            `<span class="transaction-tag">${t.trim()}</span>`
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
    displayData(filteredData);
}

// Update statistics
function updateStats(data) {
    const totalEntries = data.length;
    const totalIncome = data.filter(r => r.amount >= 0).reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = Math.abs(data.filter(r => r.amount < 0).reduce((sum, r) => sum + r.amount, 0));
    const netBalance = totalIncome - totalExpenses;

    document.getElementById('totalEntries').textContent = totalEntries.toLocaleString();
    document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
    document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);

    const netBalanceEl = document.getElementById('netBalance');
    netBalanceEl.textContent = formatCurrency(Math.abs(netBalance));

    // Change color based on positive/negative
    const balanceCard = netBalanceEl.closest('.stat-card');
    if (netBalance >= 0) {
        balanceCard.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    } else {
        balanceCard.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
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

    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Submitting<span class="loader"></span>';
    messageDiv.innerHTML = '';

    const transactionType = document.querySelector('input[name="transactionType"]:checked').value;
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

        setTimeout(() => {
            messageDiv.innerHTML = '';
            loadData();
        }, 2000);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Entry';
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
