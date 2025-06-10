const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { userOperations } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mafia-secret-key-2024';

app.use(cors());
app.use(express.json());

// JWT token oluşturma
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id,
            username: user.username,
            code_name: user.code_name,
            access_level: user.access_level
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
};

// Token doğrulama middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '[ ERİŞİM TOKENI GEREKLİ ]' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '[ GEÇERSİZ TOKEN ]' });
        }
        req.user = user;
        next();
    });
};

// Giriş endpoint'i
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '[ KULLANICI ADI VE ŞİFRE GEREKLİ ]' });
        }

        const user = await userOperations.login(username, password);
        const token = generateToken(user);

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                code_name: user.code_name,
                access_level: user.access_level
            }
        });
    } catch (error) {
        res.status(401).json({ error: error.error || '[ GİRİŞ HATASI ]' });
    }
});

// Kayıt endpoint'i
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, code_name } = req.body;

        if (!username || !password || !code_name) {
            return res.status(400).json({ error: '[ TÜM ALANLAR GEREKLİ ]' });
        }

        const user = await userOperations.register(username, password, code_name);
        const token = generateToken(user);

        res.status(201).json({
            token,
            user: {
                id: user.id,
                username: user.username,
                code_name: user.code_name,
                access_level: user.access_level
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.error || '[ KAYIT HATASI ]' });
    }
});

// Kullanıcı bilgilerini güncelleme endpoint'i
app.put('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        // Sadece admin veya kendi hesabını güncelleyebilir
        if (req.user.access_level < 5 && req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: '[ YETKİSİZ ERİŞİM ]' });
        }

        const updates = req.body;
        const result = await userOperations.updateUser(req.params.id, updates);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.error || '[ GÜNCELLEME HATASI ]' });
    }
});

// Kullanıcı bilgilerini getirme endpoint'i
app.get('/api/users/me', authenticateToken, (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
        code_name: req.user.code_name,
        access_level: req.user.access_level
    });
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`[ SUNUCU BAŞLATILDI: ${PORT} ]`);
}); 