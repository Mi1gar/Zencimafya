// API URL
const API_URL = 'http://localhost:3000/api';

// Token kontrolü
const token = localStorage.getItem('mafia_token');
if (!token) {
    window.location.href = '/login.html';
}

// DOM Elementleri
const userMenu = document.getElementById('userMenu');
const userAvatar = document.getElementById('userAvatar');
const notificationCount = document.getElementById('notificationCount');
const newTopicBtn = document.getElementById('newTopicBtn');
const newTopicModal = document.getElementById('newTopicModal');
const newTopicForm = document.getElementById('newTopicForm');
const notificationsModal = document.getElementById('notificationsModal');
const notificationsList = document.getElementById('notificationsList');
const categoriesGrid = document.getElementById('categoriesGrid');
const topicsList = document.getElementById('topicsList');
const activeUsersList = document.getElementById('activeUsersList');
const topicFilter = document.getElementById('topicFilter');
const logoutBtn = document.getElementById('logoutBtn');

// Kullanıcı bilgilerini yükle
async function loadUserProfile() {
    try {
        const response = await fetch(`${API_URL}/users/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Profil yüklenemedi');
        
        const user = await response.json();
        userAvatar.src = user.avatar_url || '../assets/default-avatar.png';
        
        // Bildirim sayısını güncelle
        updateNotificationCount();
    } catch (error) {
        console.error('Profil yükleme hatası:', error);
    }
}

// Bildirim sayısını güncelle
async function updateNotificationCount() {
    try {
        const response = await fetch(`${API_URL}/notifications`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Bildirimler yüklenemedi');
        
        const notifications = await response.json();
        const unreadCount = notifications.filter(n => !n.is_read).length;
        notificationCount.textContent = unreadCount;
        notificationCount.style.display = unreadCount > 0 ? 'flex' : 'none';
    } catch (error) {
        console.error('Bildirim sayısı güncelleme hatası:', error);
    }
}

// Kategorileri yükle
async function loadCategories() {
    try {
        const response = await fetch(`${API_URL}/categories`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Kategoriler yüklenemedi');
        
        const categories = await response.json();
        categoriesGrid.innerHTML = categories.map(category => `
            <div class="category-card">
                <div class="category-header">
                    <h3 class="category-title">${category.name}</h3>
                    <div class="category-stats">
                        <span><i class="fas fa-comments"></i> ${category.topic_count}</span>
                        <span><i class="fas fa-eye"></i> ${category.view_count}</span>
                    </div>
                </div>
                <p>${category.description}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Kategori yükleme hatası:', error);
    }
}

// Konuları yükle
async function loadTopics(filter = 'all') {
    try {
        const response = await fetch(`${API_URL}/topics?filter=${filter}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Konular yüklenemedi');
        
        const topics = await response.json();
        topicsList.innerHTML = topics.map(topic => `
            <div class="topic-item">
                <div class="topic-avatar">
                    <img src="${topic.user.avatar_url || '../assets/default-avatar.png'}" alt="${topic.user.username}">
                </div>
                <div class="topic-content">
                    <a href="/topic.html?id=${topic.id}" class="topic-title">${topic.title}</a>
                    <div class="topic-meta">
                        <span><i class="fas fa-user"></i> ${topic.user.username}</span>
                        <span><i class="fas fa-clock"></i> ${formatDate(topic.created_at)}</span>
                    </div>
                </div>
                <div class="topic-stats">
                    <span><i class="fas fa-comments"></i> ${topic.post_count}</span>
                    <span><i class="fas fa-eye"></i> ${topic.view_count}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Konu yükleme hatası:', error);
    }
}

// Aktif kullanıcıları yükle
async function loadActiveUsers() {
    try {
        const response = await fetch(`${API_URL}/users/active`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Aktif kullanıcılar yüklenemedi');
        
        const users = await response.json();
        activeUsersList.innerHTML = users.map(user => `
            <div class="user-item">
                <img src="${user.avatar_url || '../assets/default-avatar.png'}" alt="${user.username}">
                <div class="user-info">
                    <div class="user-name">${user.username}</div>
                    <div class="user-status">${user.status}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Aktif kullanıcı yükleme hatası:', error);
    }
}

// Bildirimleri yükle
async function loadNotifications() {
    try {
        const response = await fetch(`${API_URL}/notifications`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Bildirimler yüklenemedi');
        
        const notifications = await response.json();
        notificationsList.innerHTML = notifications.map(notification => `
            <div class="notification-item ${notification.is_read ? 'read' : 'unread'}">
                <div class="notification-content">
                    <p>${notification.content}</p>
                    <small>${formatDate(notification.created_at)}</small>
                </div>
                ${!notification.is_read ? `
                    <button onclick="markNotificationAsRead(${notification.id})" class="mark-read-btn">
                        <i class="fas fa-check"></i>
                    </button>
                ` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('Bildirim yükleme hatası:', error);
    }
}

// Bildirimi okundu olarak işaretle
async function markNotificationAsRead(notificationId) {
    try {
        const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Bildirim güncellenemedi');
        
        // Bildirimleri ve sayacı güncelle
        await loadNotifications();
        await updateNotificationCount();
    } catch (error) {
        console.error('Bildirim güncelleme hatası:', error);
    }
}

// Yeni konu oluştur
async function createNewTopic(event) {
    event.preventDefault();
    
    const formData = {
        title: document.getElementById('topicTitle').value,
        content: document.getElementById('topicContent').value,
        category_id: document.getElementById('topicCategory').value
    };
    
    try {
        const response = await fetch(`${API_URL}/topics`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) throw new Error('Konu oluşturulamadı');
        
        const topic = await response.json();
        newTopicModal.classList.remove('active');
        newTopicForm.reset();
        
        // Konuları yeniden yükle
        await loadTopics();
    } catch (error) {
        console.error('Konu oluşturma hatası:', error);
        alert('Konu oluşturulurken bir hata oluştu');
    }
}

// Yardımcı fonksiyonlar
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // 24 saatten az
    if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        if (hours === 0) {
            const minutes = Math.floor(diff / (60 * 1000));
            return `${minutes} dakika önce`;
        }
        return `${hours} saat önce`;
    }
    
    // 7 günden az
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return `${days} gün önce`;
    }
    
    // Tarih formatı
    return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
    loadCategories();
    loadTopics();
    loadActiveUsers();
    
    // Her 5 dakikada bir aktif kullanıcıları güncelle
    setInterval(loadActiveUsers, 5 * 60 * 1000);
    
    // Her 30 saniyede bir bildirimleri kontrol et
    setInterval(updateNotificationCount, 30 * 1000);
});

// Modal işlemleri
newTopicBtn.addEventListener('click', () => {
    newTopicModal.classList.add('active');
});

document.querySelectorAll('.close-modal').forEach(button => {
    button.addEventListener('click', () => {
        newTopicModal.classList.remove('active');
        notificationsModal.classList.remove('active');
    });
});

// Form işlemleri
newTopicForm.addEventListener('submit', createNewTopic);

// Filtre değişikliği
topicFilter.addEventListener('change', (e) => {
    loadTopics(e.target.value);
});

// Bildirim modalı
notificationCount.addEventListener('click', () => {
    loadNotifications();
    notificationsModal.classList.add('active');
});

// Çıkış işlemi
logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('mafia_token');
    window.location.href = '/login.html';
}); 