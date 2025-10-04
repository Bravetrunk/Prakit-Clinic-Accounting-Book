// Chart instances
let lineChart = null;
let pieChart = null;
let barChart = null;
let stackedChart = null;

// Chart colors
const chartColors = {
    income: '#10b981',
    expense: '#ef4444',
    primary: '#10b981',
    secondary: '#3b82f6',
    purple: '#8b5cf6',
    orange: '#f59e0b',
    pink: '#ec4899'
};

// Initialize all charts
function initializeCharts() {
    updateLineChart([]);
    updatePieChart([]);
    updateBarChart([]);
    updateStackedChart([]);
}

// Update line chart (Amount Trend)
function updateLineChart(data) {
    const ctx = document.getElementById('lineChart');
    if (!ctx) return;

    const period = parseInt(document.getElementById('trendPeriod')?.value || 30);

    // Group by date
    const dateMap = {};
    data.forEach(row => {
        if (row.date) {
            const dateStr = formatDate(row.date);
            if (!dateMap[dateStr]) {
                dateMap[dateStr] = { income: 0, expense: 0 };
            }
            const amount = Math.abs(row.amount);
            if (row.amount >= 0) {
                dateMap[dateStr].income += amount;
            } else {
                dateMap[dateStr].expense += amount;
            }
        }
    });

    // Sort dates chronologically
    const sortedEntries = Object.entries(dateMap).sort((a, b) => {
        return new Date(a[0]) - new Date(b[0]);
    });

    const dates = sortedEntries.map(entry => entry[0]);
    const incomes = sortedEntries.map(entry => entry[1].income);
    const expenses = sortedEntries.map(entry => entry[1].expense);

    // Take last N entries based on period
    const displayDates = dates.slice(-period);
    const displayIncomes = incomes.slice(-period);
    const displayExpenses = expenses.slice(-period);

    if (lineChart) {
        lineChart.destroy();
    }

    lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: displayDates,
            datasets: [
                {
                    label: 'Income',
                    data: displayIncomes,
                    borderColor: chartColors.income,
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: chartColors.income,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Expenses',
                    data: displayExpenses,
                    borderColor: chartColors.expense,
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: chartColors.expense,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    callbacks: {
                        label: function(context) {
                            const symbol = getCurrentCurrencySymbol();
                            return context.dataset.label + ': ' + symbol + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            const symbol = getCurrentCurrencySymbol();
                            return symbol + value.toLocaleString();
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Update pie chart (Category Distribution)
function updatePieChart(data) {
    const ctx = document.getElementById('pieChart');
    if (!ctx) return;

    // Group by category (only expenses)
    const categoryMap = {};
    data.forEach(row => {
        if (row.amount < 0) { // Only expenses
            const category = row.categories || 'Uncategorized';
            categoryMap[category] = (categoryMap[category] || 0) + Math.abs(row.amount);
        }
    });

    const categories = Object.keys(categoryMap);
    const amounts = Object.values(categoryMap);

    // Generate colors
    const colors = categories.map((_, i) => {
        const hue = 140 + (i * 40) % 120;
        const saturation = 60 + (i * 10) % 30;
        const lightness = 50 + (i * 5) % 20;
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    });

    if (pieChart) {
        pieChart.destroy();
    }

    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: amounts,
                backgroundColor: colors,
                borderWidth: 3,
                borderColor: '#fff',
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            const symbol = getCurrentCurrencySymbol();
                            return `${label}: ${symbol}${value.toFixed(2)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Update bar chart (Income vs Expenses by month)
function updateBarChart(data) {
    const ctx = document.getElementById('barChart');
    if (!ctx) return;

    // Group by month
    const monthMap = {};
    data.forEach(row => {
        if (row.date) {
            const date = new Date(row.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthMap[monthKey]) {
                monthMap[monthKey] = { income: 0, expense: 0 };
            }
            const amount = Math.abs(row.amount);
            if (row.amount >= 0) {
                monthMap[monthKey].income += amount;
            } else {
                monthMap[monthKey].expense += amount;
            }
        }
    });

    // Sort by month
    const sortedMonths = Object.keys(monthMap).sort();
    const labels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });
    const incomes = sortedMonths.map(m => monthMap[m].income);
    const expenses = sortedMonths.map(m => monthMap[m].expense);

    if (barChart) {
        barChart.destroy();
    }

    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.slice(-12), // Last 12 months
            datasets: [
                {
                    label: 'Income',
                    data: incomes.slice(-12),
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: chartColors.income,
                    borderWidth: 2
                },
                {
                    label: 'Expenses',
                    data: expenses.slice(-12),
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: chartColors.expense,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const symbol = getCurrentCurrencySymbol();
                            return context.dataset.label + ': ' + symbol + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            const symbol = getCurrentCurrencySymbol();
                            return symbol + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Update stacked chart (Category trends over time)
function updateStackedChart(data) {
    const ctx = document.getElementById('stackedChart');
    if (!ctx) return;

    // Get top 5 categories
    const categoryTotals = {};
    data.filter(row => row.amount < 0).forEach(row => {
        const category = row.categories || 'Other';
        categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(row.amount);
    });

    const topCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat]) => cat);

    // Group by month and category
    const monthCategoryMap = {};
    data.filter(row => row.amount < 0).forEach(row => {
        if (row.date) {
            const date = new Date(row.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthCategoryMap[monthKey]) {
                monthCategoryMap[monthKey] = {};
            }
            const category = topCategories.includes(row.categories) ? row.categories : 'Other';
            monthCategoryMap[monthKey][category] = (monthCategoryMap[monthKey][category] || 0) + Math.abs(row.amount);
        }
    });

    const sortedMonths = Object.keys(monthCategoryMap).sort().slice(-6); // Last 6 months
    const labels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short' });
    });

    const datasets = [...topCategories, 'Other'].map((category, index) => {
        const colors = [
            chartColors.primary,
            chartColors.secondary,
            chartColors.purple,
            chartColors.orange,
            chartColors.pink,
            '#6b7280'
        ];

        return {
            label: category,
            data: sortedMonths.map(month => monthCategoryMap[month][category] || 0),
            backgroundColor: colors[index],
            borderWidth: 0
        };
    });

    if (stackedChart) {
        stackedChart.destroy();
    }

    stackedChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const symbol = getCurrentCurrencySymbol();
                            return context.dataset.label + ': ' + symbol + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            const symbol = getCurrentCurrencySymbol();
                            return symbol + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Update heatmap
function updateHeatmap(data) {
    const heatmapDiv = document.getElementById('heatmapChart');
    if (!heatmapDiv) return;

    // Group by day of week
    const dayMap = {0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat'};
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];

    data.filter(row => row.amount < 0).forEach(row => {
        if (row.date) {
            const day = new Date(row.date).getDay();
            dayTotals[day] += Math.abs(row.amount);
            dayCounts[day]++;
        }
    });

    const maxAmount = Math.max(...dayTotals);

    heatmapDiv.innerHTML = Object.entries(dayMap).map(([index, day]) => {
        const amount = dayTotals[index];
        const intensity = maxAmount > 0 ? amount / maxAmount : 0;
        const color = intensity > 0
            ? `rgba(239, 68, 68, ${0.2 + intensity * 0.8})`
            : 'rgba(156, 163, 175, 0.2)';

        return `
            <div class="heatmap-cell"
                 style="background: ${color}; color: ${intensity > 0.5 ? 'white' : '#374151'}"
                 title="${day}: ${getCurrentCurrencySymbol()}${amount.toFixed(2)}">
                ${day}
            </div>
        `;
    }).join('');
}

// Update tag cloud
function updateTagCloud(data) {
    const tagCloudDiv = document.getElementById('tagCloud');
    if (!tagCloudDiv) return;

    const tagMap = {};
    data.forEach(row => {
        if (row.tags) {
            const tags = row.tags.split(',').map(t => t.trim()).filter(t => t);
            tags.forEach(tag => {
                tagMap[tag] = (tagMap[tag] || 0) + 1;
            });
        }
    });

    const sortedTags = Object.entries(tagMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

    if (sortedTags.length === 0) {
        tagCloudDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No tags found</p>';
        return;
    }

    const maxCount = sortedTags[0][1];

    tagCloudDiv.innerHTML = sortedTags.map(([tag, count]) => {
        const size = 12 + (count / maxCount) * 12;
        return `
            <div class="tag-cloud-item"
                 style="font-size: ${size}px"
                 onclick="filterByTag('${tag}')"
                 title="Used ${count} times">
                ${tag}
            </div>
        `;
    }).join('');
}

// Export chart as image
function exportChart(chartId) {
    const canvas = document.getElementById(chartId);
    if (!canvas) return;

    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${chartId}-${new Date().getTime()}.png`;
    link.href = url;
    link.click();
}

// Helper function to get current currency symbol
function getCurrentCurrencySymbol() {
    const currency = document.getElementById('currencyFilter')?.value || 'THB';
    return CONFIG.CURRENCY_SYMBOLS[currency];
}
