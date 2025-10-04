// Configuration
const CONFIG = {
    WEBAPP_URL: '<https://script.google.com/macros/s/AKfycbyOLIN5JExngKPVAyF6qeBoMHm5lK-UUdpjKgh-Yf_IU-vAS6D-1lR6RTh1Yp3VAXSu/exec>',

    CURRENCY_RATES: {
        THB: 1,
        USD: 0.029,
        EUR: 0.026,
        GBP: 0.023,
        JPY: 4.2
    },

    CURRENCY_SYMBOLS: {
        THB: '฿',
        USD: '$',
        EUR: '€',
        GBP: '£',
        JPY: '¥'
    },

    THEMES: {
        light: {
            primary: '#10b981',
            background: 'linear-gradient(135deg, #667eea 0%, #34d399 100%)',
            cardBg: '#ffffff',
            textColor: '#374151'
        },
        dark: {
            primary: '#10b981',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            cardBg: '#1e293b',
            textColor: '#e5e7eb'
        }
    },

    TAG_SUGGESTIONS: [
        'urgent', 'business', 'personal', 'work', 'home',
        'recurring', 'one-time', 'essential', 'luxury', 'investment'
    ]
};
