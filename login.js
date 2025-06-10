document.addEventListener('DOMContentLoaded', function() {
    const loadingScreen = document.getElementById('loading-screen');
    const loginScreen = document.getElementById('login-screen');
    const progressBar = document.querySelector('.progress');
    const progressText = document.querySelector('.progress-text');
    const loginBtn = document.getElementById('login-btn');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const locationText = document.querySelector('.warning-text p:first-child');

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