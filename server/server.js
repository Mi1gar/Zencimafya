const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { userOperations } = require('./database');
const Topic = require('./models/Topic');
const Post = require('./models/Post');
const Category = require('./models/Category');
const Comment = require('./models/Comment');
const Notification = require('./models/Notification');

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

// Forum Kategorileri
app.get('/api/forum/categories', async (req, res) => {
    try {
        const categories = await Category.find()
            .populate('lastTopic')
            .populate('lastPost')
            .sort('order');
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: '[ KATEGORİLER YÜKLENEMEDİ ]' });
    }
});

// Konular
app.get('/api/forum/topics', async (req, res) => {
    try {
        const { 
            category, 
            page = 1, 
            limit = 20, 
            sort = 'latest',
            search 
        } = req.query;

        const query = {};
        if (category) query.category = category;
        if (search) query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { content: { $regex: search, $options: 'i' } }
        ];

        const sortOptions = {
            latest: { createdAt: -1 },
            popular: { viewCount: -1 },
            active: { lastActivity: -1 }
        };

        const topics = await Topic.find(query)
            .populate('author', 'username avatar')
            .populate('lastReply.author', 'username avatar')
            .sort(sortOptions[sort])
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Topic.countDocuments(query);

        res.json({
            topics,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });
    } catch (error) {
        res.status(500).json({ error: '[ KONULAR YÜKLENEMEDİ ]' });
    }
});

app.post('/api/forum/topics', authenticateToken, async (req, res) => {
    try {
        const { title, content, category, tags } = req.body;
        
        if (!title || !content || !category) {
            return res.status(400).json({ error: '[ BAŞLIK, İÇERİK VE KATEGORİ GEREKLİ ]' });
        }

        const topic = await Topic.create({
            title,
            content,
            category,
            author: req.user.id,
            tags
        });

        // Kategori son aktiviteyi güncelle
        await Category.findByIdAndUpdate(category, {
            lastTopic: topic._id,
            lastActivity: new Date()
        });

        // Bildirim oluştur
        await Notification.create({
            type: 'new_topic',
            recipient: req.user.id,
            target: {
                type: 'topic',
                id: topic._id
            },
            content: {
                title: 'Yeni Konu',
                body: `${req.user.username} yeni bir konu açtı: ${title}`
            }
        });

        res.status(201).json(topic);
    } catch (error) {
        res.status(500).json({ error: '[ KONU OLUŞTURULAMADI ]' });
    }
});

app.get('/api/forum/topics/:id', async (req, res) => {
    try {
        const topic = await Topic.findById(req.params.id)
            .populate('author', 'username avatar')
            .populate('category', 'name')
            .populate('lastReply.author', 'username avatar');

        if (!topic) {
            return res.status(404).json({ error: '[ KONU BULUNAMADI ]' });
        }

        // Görüntülenme sayısını artır
        topic.viewCount += 1;
        await topic.save();

        res.json(topic);
    } catch (error) {
        res.status(500).json({ error: '[ KONU YÜKLENEMEDİ ]' });
    }
});

app.put('/api/forum/topics/:id', authenticateToken, async (req, res) => {
    try {
        const topic = await Topic.findById(req.params.id);
        
        if (!topic) {
            return res.status(404).json({ error: '[ KONU BULUNAMADI ]' });
        }

        // Sadece yazar veya admin düzenleyebilir
        if (topic.author.toString() !== req.user.id && req.user.access_level < 5) {
            return res.status(403).json({ error: '[ YETKİSİZ ERİŞİM ]' });
        }

        const updates = req.body;
        Object.assign(topic, updates);
        await topic.save();

        res.json(topic);
    } catch (error) {
        res.status(500).json({ error: '[ KONU GÜNCELLENEMEDİ ]' });
    }
});

app.delete('/api/forum/topics/:id', authenticateToken, async (req, res) => {
    try {
        const topic = await Topic.findById(req.params.id);
        
        if (!topic) {
            return res.status(404).json({ error: '[ KONU BULUNAMADI ]' });
        }

        // Sadece yazar veya admin silebilir
        if (topic.author.toString() !== req.user.id && req.user.access_level < 5) {
            return res.status(403).json({ error: '[ YETKİSİZ ERİŞİM ]' });
        }

        await topic.remove();
        res.json({ message: '[ KONU SİLİNDİ ]' });
    } catch (error) {
        res.status(500).json({ error: '[ KONU SİLİNEMEDİ ]' });
    }
});

// Yorumlar
app.get('/api/forum/topics/:topicId/comments', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const comments = await Comment.find({ target: { type: 'topic', id: req.params.topicId } })
            .populate('author', 'username avatar')
            .sort('createdAt')
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Comment.countDocuments({ target: { type: 'topic', id: req.params.topicId } });

        res.json({
            comments,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });
    } catch (error) {
        res.status(500).json({ error: '[ YORUMLAR YÜKLENEMEDİ ]' });
    }
});

app.post('/api/forum/topics/:topicId/comments', authenticateToken, async (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content) {
            return res.status(400).json({ error: '[ YORUM İÇERİĞİ GEREKLİ ]' });
        }

        const topic = await Topic.findById(req.params.topicId);
        if (!topic) {
            return res.status(404).json({ error: '[ KONU BULUNAMADI ]' });
        }

        const comment = await Comment.create({
            content,
            author: req.user.id,
            target: {
                type: 'topic',
                id: req.params.topicId
            }
        });

        // Konu son aktiviteyi güncelle
        topic.lastReply = {
            author: req.user.id,
            date: new Date()
        };
        topic.replyCount += 1;
        await topic.save();

        // Bildirim oluştur
        if (topic.author.toString() !== req.user.id) {
            await Notification.create({
                type: 'new_comment',
                recipient: topic.author,
                target: {
                    type: 'comment',
                    id: comment._id
                },
                content: {
                    title: 'Yeni Yorum',
                    body: `${req.user.username} konunuza yorum yaptı: ${content.substring(0, 50)}...`
                }
            });
        }

        res.status(201).json(comment);
    } catch (error) {
        res.status(500).json({ error: '[ YORUM OLUŞTURULAMADI ]' });
    }
});

// Bildirimler
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const notifications = await Notification.find({ recipient: req.user.id })
            .sort('-createdAt')
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Notification.countDocuments({ recipient: req.user.id });

        res.json({
            notifications,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });
    } catch (error) {
        res.status(500).json({ error: '[ BİLDİRİMLER YÜKLENEMEDİ ]' });
    }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user.id },
            { status: 'read' },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ error: '[ BİLDİRİM BULUNAMADI ]' });
        }

        res.json(notification);
    } catch (error) {
        res.status(500).json({ error: '[ BİLDİRİM GÜNCELLENEMEDİ ]' });
    }
});

// Arama
app.get('/api/forum/search', async (req, res) => {
    try {
        const { q, type = 'all', page = 1, limit = 20 } = req.query;
        
        if (!q) {
            return res.status(400).json({ error: '[ ARAMA TERİMİ GEREKLİ ]' });
        }

        let results = [];
        let total = 0;

        if (type === 'all' || type === 'topics') {
            const topics = await Topic.find({
                $or: [
                    { title: { $regex: q, $options: 'i' } },
                    { content: { $regex: q, $options: 'i' } }
                ]
            })
            .populate('author', 'username avatar')
            .sort('-createdAt')
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

            results = results.concat(topics.map(t => ({ ...t.toObject(), type: 'topic' })));
            total += await Topic.countDocuments({
                $or: [
                    { title: { $regex: q, $options: 'i' } },
                    { content: { $regex: q, $options: 'i' } }
                ]
            });
        }

        if (type === 'all' || type === 'comments') {
            const comments = await Comment.find({
                content: { $regex: q, $options: 'i' }
            })
            .populate('author', 'username avatar')
            .sort('-createdAt')
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

            results = results.concat(comments.map(c => ({ ...c.toObject(), type: 'comment' })));
            total += await Comment.countDocuments({
                content: { $regex: q, $options: 'i' }
            });
        }

        // Sonuçları tarihe göre sırala
        results.sort((a, b) => b.createdAt - a.createdAt);

        res.json({
            results,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });
    } catch (error) {
        res.status(500).json({ error: '[ ARAMA YAPILAMADI ]' });
    }
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`[ SUNUCU BAŞLATILDI: ${PORT} ]`);
}); 