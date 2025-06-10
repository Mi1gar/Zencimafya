// Terminal animasyon ayarları
const TYPING_SPEED = 10; // ms
const MESSAGE_DELAY = 150; // ms
const TRANSITION_DELAY = 150; // ms

// Terminal mesajları
const messages = [
    "TOR AĞI: GİZLİ SERVİS BAĞLANTISI KURULUYOR",
    "VPN TUNNEL: ÇOKLU KATMAN ŞİFRELEME AKTİF",
    "GÜVENLİK PROTOKOLÜ: AES-256 ŞİFRELEME BAŞLATILDI",
    "KİMLİK DOĞRULAMA: PARMAK İZİ TARAMASI TAMAMLANDI",
    "SİSTEM: GÜVENLİ GİRİŞ MODU AKTİF"
];

// Terminal yazı animasyonu
async function typeWriter(text, element, delay = TYPING_SPEED) {
    return new Promise((resolve) => {
        let i = 0;
        const interval = setInterval(() => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
            } else {
                clearInterval(interval);
                resolve();
            }
        }, delay);
    });
}

// Terminal mesajlarını göster
async function showLoadingMessages() {
    const terminalOutput = document.querySelector('.terminal-output');
    const loadingScreen = document.getElementById('loading-screen');
    const loginContainer = document.getElementById('login-container');
    
    // Başlangıçta login container'ı gizle
    loginContainer.style.display = 'none';
    loadingScreen.style.display = 'block';
    
    // Terminal başlığını göster
    const header = document.querySelector('.terminal-header');
    header.style.display = 'block';
    
    // Mesajları göster
    for (const message of messages) {
        const line = document.createElement('div');
        line.className = 'output-line';
        terminalOutput.appendChild(line);
        await typeWriter(message, line);
        await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY));
    }

    // Kullanıcı kontrolü
    const knownUser = localStorage.getItem('username');
    if (knownUser) {
        const userLine = document.createElement('div');
        userLine.className = 'output-line';
        terminalOutput.appendChild(userLine);
        await typeWriter(`KULLANICI DOĞRULANDI: ${knownUser}`, userLine);
    }

    // Geçiş animasyonu
    setTimeout(() => {
        loadingScreen.style.display = 'none';
        loginContainer.style.display = 'block';
        
        // Kullanıcı bilgilerini ayarla
        if (knownUser) {
            const usernameInput = document.getElementById('username');
            usernameInput.value = knownUser;
            usernameInput.readOnly = true;
            document.getElementById('password').focus();
        } else {
            document.getElementById('username').focus();
        }
    }, TRANSITION_DELAY);
}

// Form gönderimi
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const terminalOutput = document.querySelector('.terminal-output');
            const loginContainer = document.getElementById('login-container');

            // Form doğrulama
            if (!username || !password) {
                const errorLine = document.createElement('div');
                errorLine.className = 'output-line error';
                terminalOutput.appendChild(errorLine);
                await typeWriter('HATA: KULLANICI ADI VE ŞİFRE GEREKLİ', errorLine);
                return;
            }

            // Giriş animasyonu
            const loginLine = document.createElement('div');
            loginLine.className = 'output-line';
            terminalOutput.appendChild(loginLine);
            await typeWriter('GİRİŞ DOĞRULANIYOR...', loginLine);
            await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY));

            // Başarılı giriş
            const successLine = document.createElement('div');
            successLine.className = 'output-line success';
            terminalOutput.appendChild(successLine);
            await typeWriter('GİRİŞ BAŞARILI: YÖNLENDİRİLİYORSUNUZ', successLine);

            // Kullanıcı bilgisini kaydet
            if (!localStorage.getItem('username')) {
                localStorage.setItem('username', username);
            }

            // Yönlendirme
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        });
    }

    // Sayfa yüklendiğinde animasyonu başlat
    showLoadingMessages();
}); 