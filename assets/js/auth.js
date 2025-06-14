// Auth sistemi
const auth = {
    // API endpoint'leri
    API_URL: 'http://localhost:3000/api',
    
    // Giriş işlemi
    async login(username, password) {
        try {
            const response = await fetch(`${this.API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Giriş başarısız');
            }

            // Token ve kullanıcı bilgilerini kaydet
            localStorage.setItem('mafia_token', data.token);
            localStorage.setItem('mafia_user', JSON.stringify(data.user));
            
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Giriş hatası:', error);
            return { success: false, error: error.message };
        }
    },

    // Çıkış işlemi
    logout() {
        localStorage.removeItem('mafia_token');
        localStorage.removeItem('mafia_user');
        window.location.href = 'login.html';
    },

    // Mevcut kullanıcıyı kontrol et
    async getCurrentUser() {
        const token = localStorage.getItem('mafia_token');
        if (!token) return null;
        
        try {
            const response = await fetch(`${this.API_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Token geçersiz');
            }

            const data = await response.json();
            return data.user;
        } catch (error) {
            console.error('Kullanıcı bilgisi alınamadı:', error);
            this.logout();
            return null;
        }
    },

    // Yetki kontrolü
    async isAuthenticated() {
        return !!(await this.getCurrentUser());
    },

    // Admin kontrolü
    async isAdmin() {
        const user = await this.getCurrentUser();
        return user && user.role === 'admin';
    }
};

// Global olarak erişilebilir yap
window.auth = auth; 