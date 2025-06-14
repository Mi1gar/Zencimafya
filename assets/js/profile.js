// Profil sayfası işlevleri
document.addEventListener('DOMContentLoaded', async () => {
    // Yükleme ekranını göster
    const loadingScreen = document.getElementById('loadingScreen');
    const terminalContainer = document.querySelector('.terminal-container');
    const terminalOutput = document.getElementById('terminalOutput');

    // Terminal mesajlarını göster
    const messages = [
        'Kullanıcı profili yükleniyor...',
        'Güvenlik protokolleri kontrol ediliyor...',
        'Kullanıcı verileri alınıyor...',
        'Profil bilgileri hazırlanıyor...'
    ];

    for (const message of messages) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const line = document.createElement('div');
        line.className = 'output-line';
        line.textContent = message;
        terminalOutput.appendChild(line);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    // Kullanıcı bilgilerini yükle
    try {
        const user = await auth.getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        // Profil bilgilerini doldur
        document.getElementById('username').textContent = user.username;
        document.getElementById('userRole').textContent = user.role;
        document.getElementById('userAvatar').src = user.avatar || 'assets/images/default-avatar.png';
        document.getElementById('joinDate').textContent = `Katılım: ${new Date(user.joinDate).toLocaleDateString('tr-TR')}`;
        document.getElementById('lastSeen').textContent = `Son görülme: ${new Date().toLocaleString('tr-TR')}`;
        document.getElementById('userBio').value = user.bio || '';

        // Kullanıcı seviyesini ve XP'sini güncelle
        updateUserLevel(user.xp || 0);

        // İstatistikleri güncelle
        updateStats(user.stats || {
            topics: 0,
            comments: 0,
            points: 0,
            solutions: 0
        });

        // Rozetleri güncelle
        updateBadges(user.badges || []);

        // Aktiviteleri yükle
        loadActivities();

        // Son konuları yükle
        loadRecentTopics();

        // Başarıları yükle
        loadAchievements();

        // Giriş geçmişini yükle
        loadLoginHistory();

        // Sekme işlevselliğini ekle
        setupTabs();

        // Yükleme ekranını gizle
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            terminalContainer.style.display = 'block';
        }, 1000);

    } catch (error) {
        console.error('Profil yükleme hatası:', error);
        showError('Profil yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
    }
});

// Kullanıcı seviyesini güncelle
function updateUserLevel(xp) {
    const level = Math.floor(xp / 1000) + 1;
    const progress = (xp % 1000) / 10;
    
    document.getElementById('userLevel').textContent = `Seviye ${level}`;
    document.getElementById('levelProgress').style.width = `${progress}%`;
    document.getElementById('userXP').textContent = `${xp % 1000}/1000 XP`;
}

// İstatistikleri güncelle
function updateStats(stats) {
    document.getElementById('topicCount').textContent = stats.topics;
    document.getElementById('commentCount').textContent = stats.comments;
    document.getElementById('userPoints').textContent = stats.points;
    document.getElementById('solutionCount').textContent = stats.solutions;

    // Trend göstergelerini güncelle
    updateTrend('topicTrend', stats.topicTrend);
    updateTrend('commentTrend', stats.commentTrend);
    updateTrend('pointsTrend', stats.pointsTrend);
    updateTrend('solutionTrend', stats.solutionTrend);
}

// Trend göstergesini güncelle
function updateTrend(elementId, trend) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const value = trend || 0;
    element.textContent = `${value > 0 ? '+' : ''}${value}%`;
    element.className = `stat-trend ${value >= 0 ? 'up' : 'down'}`;
}

// Rozetleri güncelle
function updateBadges(badges) {
    const badgesContainer = document.getElementById('userBadges');
    badgesContainer.innerHTML = '';

    badges.forEach(badge => {
        const badgeElement = document.createElement('div');
        badgeElement.className = 'badge';
        badgeElement.textContent = badge.name;
        badgeElement.title = badge.description;
        badgesContainer.appendChild(badgeElement);
    });
}

// Aktiviteleri yükle
async function loadActivities() {
    try {
        const response = await fetch('/api/forum/activities');
        const activities = await response.json();

        const activityList = document.getElementById('activityList');
        activityList.innerHTML = '';

        activities.forEach(activity => {
            const activityElement = document.createElement('div');
            activityElement.className = 'activity-item';
            activityElement.innerHTML = `
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-details">${activity.details}</div>
                </div>
                <div class="activity-date">${new Date(activity.date).toLocaleString('tr-TR')}</div>
            `;
            activityList.appendChild(activityElement);
        });
    } catch (error) {
        console.error('Aktiviteler yüklenirken hata:', error);
    }
}

// Son konuları yükle
async function loadRecentTopics() {
    try {
        const response = await fetch('/api/forum/topics/recent');
        const topics = await response.json();

        const topicsList = document.getElementById('recentTopics');
        topicsList.innerHTML = '';

        topics.forEach(topic => {
            const topicElement = document.createElement('div');
            topicElement.className = 'topic-item';
            topicElement.innerHTML = `
                <div class="topic-content">
                    <div class="topic-title">${topic.title}</div>
                    <div class="topic-meta">
                        <span class="view-count">👁️ ${topic.views}</span>
                        <span class="comment-count">💬 ${topic.comments}</span>
                    </div>
                </div>
                <div class="topic-date">${new Date(topic.date).toLocaleString('tr-TR')}</div>
            `;
            topicsList.appendChild(topicElement);
        });
    } catch (error) {
        console.error('Konular yüklenirken hata:', error);
    }
}

// Başarıları yükle
async function loadAchievements() {
    try {
        const response = await fetch('/api/forum/achievements');
        const achievements = await response.json();

        const achievementsGrid = document.getElementById('achievementsGrid');
        achievementsGrid.innerHTML = '';

        achievements.forEach(achievement => {
            const achievementElement = document.createElement('div');
            achievementElement.className = 'achievement-card';
            achievementElement.innerHTML = `
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-desc">${achievement.description}</div>
            `;
            achievementsGrid.appendChild(achievementElement);
        });
    } catch (error) {
        console.error('Başarılar yüklenirken hata:', error);
    }
}

// Giriş geçmişini yükle
async function loadLoginHistory() {
    try {
        const response = await fetch('/api/auth/login-history');
        const history = await response.json();

        const historyList = document.getElementById('loginHistory');
        historyList.innerHTML = '';

        history.forEach(entry => {
            const historyElement = document.createElement('div');
            historyElement.className = 'history-item';
            historyElement.innerHTML = `
                <div class="history-details">
                    <div class="history-ip">${entry.ip}</div>
                    <div class="history-device">${entry.device}</div>
                </div>
                <div class="history-date">${new Date(entry.date).toLocaleString('tr-TR')}</div>
            `;
            historyList.appendChild(historyElement);
        });
    } catch (error) {
        console.error('Giriş geçmişi yüklenirken hata:', error);
    }
}

// Sekmeleri ayarla
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Aktif sekmeyi değiştir
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            button.classList.add('active');
            const tabId = button.dataset.tab;
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Profil ayarlarını güncelle
async function updateProfileSettings() {
    try {
        const settings = {
            displayName: document.getElementById('displayName').value,
            email: document.getElementById('email').value,
            theme: document.getElementById('theme').value,
            language: document.getElementById('language').value,
            bio: document.getElementById('userBio').value
        };

        const response = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(settings)
        });

        if (response.ok) {
            showSuccess('Profil ayarları güncellendi.');
        } else {
            throw new Error('Profil güncellenirken bir hata oluştu.');
        }
    } catch (error) {
        console.error('Profil güncelleme hatası:', error);
        showError('Profil ayarları güncellenirken bir hata oluştu.');
    }
}

// Güvenlik ayarlarını güncelle
async function updateSecuritySettings() {
    try {
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword && newPassword !== confirmPassword) {
            showError('Şifreler eşleşmiyor.');
            return;
        }

        const settings = {
            password: newPassword,
            twoFactorAuth: document.getElementById('twoFactorAuth').checked,
            loginNotifications: document.getElementById('loginNotifications').checked
        };

        const response = await fetch('/api/auth/security', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(settings)
        });

        if (response.ok) {
            showSuccess('Güvenlik ayarları güncellendi.');
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            throw new Error('Güvenlik ayarları güncellenirken bir hata oluştu.');
        }
    } catch (error) {
        console.error('Güvenlik güncelleme hatası:', error);
        showError('Güvenlik ayarları güncellenirken bir hata oluştu.');
    }
}

// Profil resmini güncelle
async function updateAvatar(file) {
    try {
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await fetch('/api/auth/avatar', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('userAvatar').src = data.avatarUrl;
            showSuccess('Profil resmi güncellendi.');
        } else {
            throw new Error('Profil resmi güncellenirken bir hata oluştu.');
        }
    } catch (error) {
        console.error('Profil resmi güncelleme hatası:', error);
        showError('Profil resmi güncellenirken bir hata oluştu.');
    }
}

// Hata mesajı göster
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Başarı mesajı göster
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);

    setTimeout(() => {
        successDiv.remove();
    }, 5000);
}

// Profil resmi yükleme olayını dinle
document.getElementById('avatarInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            showError('Profil resmi 5MB\'dan küçük olmalıdır.');
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            showError('Sadece JPEG, PNG ve GIF formatları desteklenmektedir.');
            return;
        }

        updateAvatar(file);
    }
});

// Bağlantı durumu kontrolü
function updateConnectionStatus() {
    try {
        const status = document.getElementById('connectionStatus');
        if (status) {
            if (navigator.onLine) {
                status.textContent = 'Bağlantı: Aktif';
                status.style.color = 'var(--success-color)';
            } else {
                status.textContent = 'Bağlantı: Kesik';
                status.style.color = 'var(--error-color)';
            }
        }
    } catch (error) {
        console.error('Bağlantı durumu güncelleme hatası:', error);
    }
}

// Bağlantı durumu değişikliklerini dinle
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
updateConnectionStatus(); 