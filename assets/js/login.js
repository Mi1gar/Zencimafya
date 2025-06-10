// Terminal animasyon ayarları
const TYPING_SPEED = 30; // Yazma hızı (ms)
const MESSAGE_DELAY = 800; // Mesajlar arası bekleme süresi (ms)
const TRANSITION_DELAY = 500; // Geçiş süresi (ms)

// Terminal mesajları
const terminalMessages = [
    "TOR BAĞLANTISI KURULUYOR...",
    "VPN TÜNELİ AKTİF EDİLİYOR...",
    "ÇOK KATMANLI ŞİFRELEME BAŞLATILIYOR...",
    "GİZLİ SERVİS BAĞLANTISI KURULUYOR...",
    "GÜVENLİK PROTOKOLLERİ YÜKLENİYOR...",
    "KİMLİK DOĞRULAMA SİSTEMİ HAZIRLANIYOR..."
];

// Sayfa durumu
const pageState = {
    isLoading: true,
    componentsLoaded: false,
    terminalVisible: false,
    loginFormVisible: false
};

// İlerleme çubuğu animasyonu
function animateProgressBar() {
    const progressBar = document.querySelector('.progress');
    if (!progressBar) return;

    let width = 0;
    const interval = setInterval(() => {
        if (width >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                pageState.isLoading = false;
                hideLoadingScreen();
            }, 500);
        } else {
            width += 1;
            progressBar.style.width = width + '%';
        }
    }, 20);
}

// Yazı animasyonu fonksiyonu
async function typeWriter(element, text) {
    for (let i = 0; i < text.length; i++) {
        element.textContent += text[i];
        await new Promise(resolve => setTimeout(resolve, TYPING_SPEED));
    }
}

// Yükleme ekranını göster/gizle
function showLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('visible');
        animateProgressBar();
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.remove('visible');
        setTimeout(() => {
            showTerminal();
        }, TRANSITION_DELAY);
    }
}

// Terminal konteynerini göster
function showTerminal() {
    const terminalContainer = document.getElementById('terminal-container');
    if (terminalContainer) {
        terminalContainer.style.display = 'block';
        terminalContainer.style.opacity = '1';
        pageState.terminalVisible = true;
        showTerminalMessages();
    }
}

// Giriş formunu göster
function showLoginForm() {
    const loginContainer = document.getElementById('login-container');
    if (loginContainer) {
        loginContainer.style.display = 'block';
        loginContainer.style.opacity = '1';
        pageState.loginFormVisible = true;
    }
}

// Terminal mesajlarını göster
async function showTerminalMessages() {
    const output = document.querySelector('.terminal-output');
    if (!output) return;
    output.innerHTML = '';
    for (const message of terminalMessages) {
        const line = document.createElement('div');
        line.className = 'output-line';
        output.appendChild(line);
        await typeWriter(line, message);
        await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY));
    }
    setTimeout(() => {
        showLoginForm();
    }, TRANSITION_DELAY);
}

// Mesaj kutularını sadece gerektiğinde göster
function showAuthMessage(type) {
    const messages = document.querySelectorAll('.auth-messages .message');
    messages.forEach(msg => msg.classList.remove('active'));
    const target = document.querySelector(`.auth-messages .message.${type}`);
    if (target) target.classList.add('active');
}

function showErrorMessage(message) {
    const errorContainer = document.querySelector('.error-messages');
    if (errorContainer) {
        // Önce tüm error-message'ları gizle
        const allErrors = errorContainer.querySelectorAll('.error-message');
        allErrors.forEach(e => e.classList.remove('active'));
        // Eğer önceden tanımlı bir error-message ise onu göster
        let found = false;
        allErrors.forEach(e => {
            if (e.dataset.message === message) {
                e.classList.add('active');
                found = true;
            }
        });
        // Değilse yeni bir error-message oluştur
        if (!found) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message active';
            errorDiv.textContent = message;
            errorContainer.appendChild(errorDiv);
        }
    }
}

// Giriş formu işlemleri
function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            if (!username || !password) {
                showAuthMessage('error');
                showErrorMessage('HATA: KULLANICI ADI VEYA ŞİFRE BOŞ BIRAKILAMAZ');
                return;
            }
            try {
                await new Promise(resolve => setTimeout(resolve, 1000));
                showAuthMessage('success');
                // Oturum bilgisini kaydet
                localStorage.setItem('isLoggedIn', 'true');
                // Ana sayfaya yönlendirme
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } catch (error) {
                showAuthMessage('error');
                showErrorMessage('HATA: GİRİŞ BAŞARISIZ');
            }
        });
    }
}

// Bileşenleri yükle
async function loadComponents() {
    try {
        const components = [
            { id: 'terminal-header', path: './components/terminal/terminal-header.html' },
            { id: 'terminal-output', path: './components/terminal/terminal-output.html' },
            { id: 'login-form', path: './components/auth/login-form.html' },
            { id: 'auth-messages', path: './components/auth/auth-messages.html' },
            { id: 'error-messages', path: './components/ui/error-messages.html' }
        ];

        for (const component of components) {
            try {
                const response = await fetch(component.path);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const content = await response.text();
                const container = document.getElementById(component.id);
                if (container) {
                    container.innerHTML = content;
                } else {
                    console.error(`${component.id} elementi bulunamadı`);
                }
            } catch (error) {
                console.error(`${component.path} yüklenirken hata:`, error);
                // Hata durumunda varsayılan içeriği göster
                const container = document.getElementById(component.id);
                if (container) {
                    if (component.id === 'terminal-header') {
                        container.innerHTML = '<div class="terminal-title">ZENCİMAFYA TERMİNAL</div><div class="terminal-status">[GÜVENLİ MOD: TOR + VPN AKTİF]</div>';
                    } else if (component.id === 'terminal-output') {
                        container.innerHTML = '<div class="output-line">SİSTEM BAŞLATILIYOR...</div>';
                    } else if (component.id === 'login-form') {
                        container.innerHTML = `
                            <form id="login-form" class="login-form">
                                <div class="form-group">
                                    <label for="username">KULLANICI ADI</label>
                                    <input type="text" id="username" name="username" required autocomplete="off">
                                </div>
                                <div class="form-group">
                                    <label for="password">ŞİFRE</label>
                                    <input type="password" id="password" name="password" required>
                                </div>
                                <button type="submit" class="login-button">GİRİŞ YAP</button>
                            </form>
                        `;
                    } else if (component.id === 'error-messages') {
                        container.innerHTML = `
                            <div class="error-message" data-type="system" data-message="SİSTEM HATASI: BAĞLANTI KESİLDİ"></div>
                            <div class="error-message" data-type="security" data-message="GÜVENLİK UYARISI: ŞÜPHELİ AKTİVİTE TESPİT EDİLDİ"></div>
                            <div class="error-message" data-type="network" data-message="AĞ HATASI: VPN BAĞLANTISI KOPUK"></div>
                            <div class="error-message" data-type="session" data-message="OTURUM HATASI: OTURUM SÜRESİ DOLDU"></div>
                        `;
                    } else if (component.id === 'auth-messages') {
                        container.innerHTML = `
                            <div class="message success" data-message="GİRİŞ BAŞARILI: YÖNLENDİRİLİYORSUNUZ"></div>
                            <div class="message error" data-message="HATA: KULLANICI ADI VEYA ŞİFRE HATALI"></div>
                            <div class="message warning" data-message="UYARI: ÇOK FAZLA BAŞARISIZ GİRİŞ DENEMESİ"></div>
                            <div class="message info" data-message="BİLGİ: OTURUM SÜRENİZ 30 DAKİKA"></div>
                        `;
                    } else {
                        container.innerHTML = `<div class="error-message">Bileşen yüklenemedi: ${component.path}</div>`;
                    }
                }
            }
        }

        pageState.componentsLoaded = true;
    } catch (error) {
        console.error('Bileşenler yüklenirken hata:', error);
        showErrorMessage('Sistem hatası: Bileşenler yüklenemedi');
    }
}

// Sayfa başlatma süreci
async function initializePage() {
    try {
        console.log('Sayfa başlatılıyor...');
        
        // 1. Yükleme ekranını göster
        await showLoadingScreen();
        
        // 2. İlerleme çubuğunu başlat
        await animateProgressBar();
        
        // 3. Bileşenleri yükle
        await loadComponents();
        
        // 4. Yükleme ekranını gizle
        await hideLoadingScreen();
        
        // 5. Terminal konteynerini göster
        await showTerminal();
        
        // 6. Terminal mesajlarını göster
        await showTerminalMessages();
        
        // 7. Giriş formunu göster
        await showLoginForm();
        
        // 8. Kullanıcı oturumu kontrolü
        const knownUser = localStorage.getItem('knownUser');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');

        if (knownUser && usernameInput && passwordInput) {
            usernameInput.value = knownUser;
            usernameInput.readOnly = true;
            passwordInput.focus();
        } else if (usernameInput) {
            usernameInput.focus();
        }

        pageState.isLoading = false;
        console.log('Sayfa başlatma tamamlandı');

    } catch (error) {
        console.error('Sayfa başlatma hatası:', error);
        showErrorMessage('Sistem hatası: Sayfa başlatılamadı');
    }
}

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', async () => {
    try {
        showLoadingScreen();
        await loadComponents();
        setupLoginForm();
        // ... mevcut kod ...
    } catch (error) {
        console.error('Sayfa yüklenirken hata:', error);
        showErrorMessage('Sistem hatası: Sayfa yüklenemedi');
    }
}); 