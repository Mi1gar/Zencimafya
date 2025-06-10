document.addEventListener('DOMContentLoaded', function() {
    const loadingScreen = document.getElementById('loading-screen');
    const loginScreen = document.getElementById('login-screen');
    const progressBar = document.querySelector('.progress');
    const progressText = document.querySelector('.progress-text');
    const loginBtn = document.getElementById('login-btn');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const locationText = document.querySelector('.warning-text p:first-child');
    const loginForm = document.getElementById('loginForm');
    const loginOutput = document.getElementById('loginOutput');
    const usernameGroup = document.getElementById('usernameGroup');
    const terminalOutput = document.getElementById('terminalOutput');

    // Sabit konum mesajı
    locationText.innerHTML = 'Otomatik Giriş reddedildi. Konumunuz tespit edildi. 🛰️<br><span style="font-size: 0.9em; color: #0f0;">(Güvenlik protokolü aktif)</span>';

    // Yükleme ekranını göster
    loadingScreen.classList.add('active');
    loginScreen.style.display = 'none';

    // Progress bar animasyonu
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 1;
        progressBar.style.width = `${progress}%`;
        
        // Progress text güncelleme
        const filledBlocks = Math.floor(progress / 10);
        const emptyBlocks = 10 - filledBlocks;
        progressText.textContent = `[Terminal yükleniyor... ${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)}]`;

        if (progress >= 100) {
            clearInterval(progressInterval);
            setTimeout(() => {
                loadingScreen.classList.remove('active');
                loginScreen.style.display = 'block';
            }, 500);
        }
    }, 30);

    // Kullanıcı oturumunu kontrol et
    function checkUserSession() {
        const savedUser = localStorage.getItem('username');
        const savedPassword = localStorage.getItem('password');
        const lastLogin = localStorage.getItem('lastLogin');
        
        if (savedUser && savedPassword) {
            // Son giriş zamanını kontrol et (24 saat)
            const now = new Date().getTime();
            const lastLoginTime = lastLogin ? parseInt(lastLogin) : 0;
            const hoursSinceLastLogin = (now - lastLoginTime) / (1000 * 60 * 60);
            
            if (hoursSinceLastLogin < 24) {
                // Otomatik giriş yap
                usernameInput.value = savedUser;
                passwordInput.value = savedPassword;
                return true;
            } else {
                // Oturum süresi dolmuş, bilgileri temizle
                clearUserSession();
            }
        }
        return false;
    }

    // Kullanıcı oturumunu kaydet
    function saveUserSession(username, password) {
        localStorage.setItem('username', username);
        localStorage.setItem('password', password);
        localStorage.setItem('lastLogin', new Date().getTime().toString());
    }

    // Kullanıcı oturumunu temizle
    function clearUserSession() {
        localStorage.removeItem('username');
        localStorage.removeItem('password');
        localStorage.removeItem('lastLogin');
    }

    // Çıkış yapma fonksiyonu
    function logout() {
        clearUserSession();
        window.location.href = 'login.html';
    }

    // Sayfa yüklendiğinde oturum kontrolü
    if (checkUserSession()) {
        usernameGroup.style.display = 'none';
        loginOutput.innerHTML = `> SİSTEM: KULLANICI OTURUMU TESPİT EDİLDİ_\n> GÜVENLİK PROTOKOLÜ: OTOMATİK GİRİŞ BAŞLATILIYOR..._`;
        setTimeout(() => {
            loginForm.submit();
        }, 2000);
    }

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!username || !password) {
            loginOutput.innerHTML = "> HATA: KULLANICI ADI VE ŞİFRE GEREKLİ_";
            return;
        }

        loginOutput.innerHTML = "> SİSTEM: KULLANICI DOĞRULANıYOR..._";
        
        // Simüle edilmiş giriş gecikmesi
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Başarılı giriş simülasyonu
        loginOutput.innerHTML = "> SİSTEM: KULLANICI DOĞRULANDI_\n> GÜVENLİK PROTOKOLÜ: GİRİŞ ONAYLANDI_";
        
        // Kullanıcı bilgilerini kaydet
        saveUserSession(username, password);
        
        // Ana sayfaya yönlendirme
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    });

    // Çıkış butonu için event listener
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', function(e) {
            e.preventDefault();
            loginOutput.innerHTML = "> SİSTEM: ÇIKIŞ YAPILIYOR..._\n> GÜVENLİK PROTOKOLÜ: OTURUM SONLANDIRILIYOR_";
            setTimeout(logout, 1500);
        });
    }

    // Giriş işlemi
    loginBtn.addEventListener('click', function() {
        const username = usernameInput.value.trim();
        
        if (username) {
            // Kullanıcı adını localStorage'a kaydet
            localStorage.setItem('zencimafya_username', username);
            localStorage.setItem('zencimafya_logged_in', 'true');
            
            // Ana sayfaya yönlendir
            window.location.href = 'index.html';
        }
    });

    // Enter tuşu ile giriş
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loginBtn.click();
        }
    });

    // Sayfa yüklendiğinde giriş kontrolü
    if (localStorage.getItem('zencimafya_logged_in') === 'true') {
        window.location.href = 'index.html';
    }
}); 