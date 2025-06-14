const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Örnek veritabanı (gerçek uygulamada MongoDB kullanılmalı)
let categories = [
    { id: 1, name: 'Genel', description: 'Genel konular', icon: '💬', order: 1 },
    { id: 2, name: 'Duyurular', description: 'Önemli duyurular', icon: '📢', order: 2 },
    { id: 3, name: 'Yardım', description: 'Yardım ve destek', icon: '❓', order: 3 }
];

let topics = [];
let comments = [];

// Token doğrulama middleware'i
const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Yetkilendirme gerekli' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'gizli-anahtar');
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Geçersiz token' });
    }
};

// Kategorileri getir
router.get('/categories', (req, res) => {
    res.json(categories);
});

// Konuları getir
router.get('/topics', (req, res) => {
    const { categoryId, page = 1, limit = 10, sort = 'newest' } = req.query;
    let filteredTopics = [...topics];

    if (categoryId) {
        filteredTopics = filteredTopics.filter(t => t.categoryId === parseInt(categoryId));
    }

    // Sıralama
    switch (sort) {
        case 'newest':
            filteredTopics.sort((a, b) => b.createdAt - a.createdAt);
            break;
        case 'oldest':
            filteredTopics.sort((a, b) => a.createdAt - b.createdAt);
            break;
        case 'mostViewed':
            filteredTopics.sort((a, b) => b.viewCount - a.viewCount);
            break;
        case 'mostReplied':
            filteredTopics.sort((a, b) => b.replyCount - a.replyCount);
            break;
    }

    // Sayfalama
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedTopics = filteredTopics.slice(startIndex, endIndex);

    res.json({
        topics: paginatedTopics,
        total: filteredTopics.length,
        page: parseInt(page),
        totalPages: Math.ceil(filteredTopics.length / limit)
    });
});

// Konu detayını getir
router.get('/topics/:id', (req, res) => {
    const topic = topics.find(t => t.id === parseInt(req.params.id));
    if (!topic) {
        return res.status(404).json({ error: 'Konu bulunamadı' });
    }

    // Görüntülenme sayısını artır
    topic.viewCount++;
    res.json(topic);
});

// Yeni konu oluştur
router.post('/topics', authenticateToken, (req, res) => {
    const { title, categoryId, content, tags } = req.body;

    if (!title || !categoryId || !content) {
        return res.status(400).json({ error: 'Tüm alanları doldurun' });
    }

    const newTopic = {
        id: topics.length + 1,
        title,
        categoryId: parseInt(categoryId),
        content,
        tags: tags || [],
        authorId: req.user.id,
        authorName: req.user.username,
        createdAt: new Date(),
        updatedAt: new Date(),
        viewCount: 0,
        replyCount: 0,
        isLocked: false,
        isPinned: false
    };

    topics.push(newTopic);
    res.status(201).json(newTopic);
});

// Konuyu güncelle
router.put('/topics/:id', authenticateToken, (req, res) => {
    const topic = topics.find(t => t.id === parseInt(req.params.id));
    if (!topic) {
        return res.status(404).json({ error: 'Konu bulunamadı' });
    }

    if (topic.authorId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }

    const { title, categoryId, content, tags } = req.body;
    Object.assign(topic, {
        title: title || topic.title,
        categoryId: categoryId ? parseInt(categoryId) : topic.categoryId,
        content: content || topic.content,
        tags: tags || topic.tags,
        updatedAt: new Date()
    });

    res.json(topic);
});

// Konuyu sil
router.delete('/topics/:id', authenticateToken, (req, res) => {
    const topicIndex = topics.findIndex(t => t.id === parseInt(req.params.id));
    if (topicIndex === -1) {
        return res.status(404).json({ error: 'Konu bulunamadı' });
    }

    const topic = topics[topicIndex];
    if (topic.authorId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }

    // Konuya ait yorumları sil
    comments = comments.filter(c => c.topicId !== topic.id);
    topics.splice(topicIndex, 1);

    res.json({ message: 'Konu başarıyla silindi' });
});

// Yorumları getir
router.get('/topics/:topicId/comments', (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const topicComments = comments
        .filter(c => c.topicId === parseInt(req.params.topicId))
        .sort((a, b) => a.createdAt - b.createdAt);

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedComments = topicComments.slice(startIndex, endIndex);

    res.json({
        comments: paginatedComments,
        total: topicComments.length,
        page: parseInt(page),
        totalPages: Math.ceil(topicComments.length / limit)
    });
});

// Yorum ekle
router.post('/topics/:topicId/comments', authenticateToken, (req, res) => {
    const { content } = req.body;
    if (!content) {
        return res.status(400).json({ error: 'Yorum içeriği gerekli' });
    }

    const topic = topics.find(t => t.id === parseInt(req.params.topicId));
    if (!topic) {
        return res.status(404).json({ error: 'Konu bulunamadı' });
    }

    if (topic.isLocked && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Bu konu kilitli' });
    }

    const newComment = {
        id: comments.length + 1,
        topicId: parseInt(req.params.topicId),
        content,
        authorId: req.user.id,
        authorName: req.user.username,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    comments.push(newComment);
    topic.replyCount++;
    topic.updatedAt = new Date();

    res.status(201).json(newComment);
});

// Yorumu güncelle
router.put('/comments/:id', authenticateToken, (req, res) => {
    const comment = comments.find(c => c.id === parseInt(req.params.id));
    if (!comment) {
        return res.status(404).json({ error: 'Yorum bulunamadı' });
    }

    if (comment.authorId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }

    const { content } = req.body;
    if (!content) {
        return res.status(400).json({ error: 'Yorum içeriği gerekli' });
    }

    comment.content = content;
    comment.updatedAt = new Date();

    res.json(comment);
});

// Yorumu sil
router.delete('/comments/:id', authenticateToken, (req, res) => {
    const commentIndex = comments.findIndex(c => c.id === parseInt(req.params.id));
    if (commentIndex === -1) {
        return res.status(404).json({ error: 'Yorum bulunamadı' });
    }

    const comment = comments[commentIndex];
    if (comment.authorId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }

    const topic = topics.find(t => t.id === comment.topicId);
    if (topic) {
        topic.replyCount--;
        topic.updatedAt = new Date();
    }

    comments.splice(commentIndex, 1);
    res.json({ message: 'Yorum başarıyla silindi' });
});

module.exports = router; 