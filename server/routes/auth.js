const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Örnek kullanıcılar (gerçek uygulamada veritabanından gelecek)
const users = [
    {
        id: 1,
        username: 'admin',
        password: 'admin123', // Gerçek uygulamada hash'lenmiş olmalı
        role: 'admin',
        avatar: 'assets/images/admin-avatar.png',
        joinDate: '2024-01-01'
    },
    {
        id: 2,
        username: 'user',
        password: 'user123',
        role: 'user',
        avatar: 'assets/images/default-avatar.png',
        joinDate: '2024-01-02'
    }
];

// JWT secret key (gerçek uygulamada .env dosyasında saklanmalı)
const JWT_SECRET = 'zencimafya-secret-key';

// Token doğrulama middleware'i
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token gerekli' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Geçersiz token' });
        }
        req.user = user;
        next();
    });
};

// Giriş endpoint'i
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
    }

    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    // Hassas bilgileri çıkar
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
});

// Kullanıcı bilgisi endpoint'i
router.get('/me', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    // Hassas bilgileri çıkar
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
});

// Şifre güncelleme endpoint'i
router.post('/update-password', authenticateToken, (req, res) => {
    const { newPassword } = req.body;
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Geçersiz şifre' });
    }

    // Gerçek uygulamada şifre hash'lenmeli
    user.password = newPassword;

    res.json({ message: 'Şifre başarıyla güncellendi' });
});

module.exports = router; 