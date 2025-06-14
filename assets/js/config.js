// API URL yapılandırması
const config = {
    // Geliştirme ortamında localhost, production'da gerçek URL
    API_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api'
        : 'https://zencimafya-api.herokuapp.com/api', // Örnek production URL
    
    // Diğer yapılandırma değerleri
    APP_NAME: 'ZENCIMAFYA',
    VERSION: '1.0.0',
    DEBUG: window.location.hostname === 'localhost'
};

// Global olarak erişilebilir yap
window.APP_CONFIG = config; 