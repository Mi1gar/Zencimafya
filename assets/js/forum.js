// Forum veri yöneticisi
const forum = {
    // Verileri localStorage'dan al
    getData(key) {
        const data = localStorage.getItem(`forum_${key}`);
        return data ? JSON.parse(data) : null;
    },

    // Verileri localStorage'a kaydet
    setData(key, value) {
        localStorage.setItem(`forum_${key}`, JSON.stringify(value));
    },

    // Kategoriler
    categories: [
        {
            id: 1,
            name: 'Operasyonlar',
            description: 'Gizli operasyonlar ve görevler',
            icon: '🎭',
            order: 1
        },
        {
            id: 2,
            name: 'Stratejiler',
            description: 'Taktik ve strateji planları',
            icon: '📊',
            order: 2
        },
        {
            id: 3,
            name: 'Güvenlik',
            description: 'Güvenlik protokolleri ve önlemler',
            icon: '🔒',
            order: 3
        }
    ],

    // Konular
    topics: [],

    // Yorumlar
    comments: [],

    // Kategorileri getir
    getCategories() {
        return this.categories;
    },

    // Konuları getir
    getTopics(categoryId = null) {
        let topics = this.getData('topics') || [];
        
        if (categoryId) {
            topics = topics.filter(t => t.categoryId === categoryId);
        }
        
        return topics.sort((a, b) => b.createdAt - a.createdAt);
    },

    // Konu detayını getir
    getTopic(id) {
        const topics = this.getData('topics') || [];
        return topics.find(t => t.id === id);
    },

    // Yorumları getir
    getComments(topicId) {
        const comments = this.getData('comments') || [];
        return comments
            .filter(c => c.topicId === topicId)
            .sort((a, b) => a.createdAt - b.createdAt);
    },

    // Yeni konu oluştur
    createTopic(data) {
        const topics = this.getData('topics') || [];
        const user = auth.getCurrentUser();
        
        if (!user) throw new Error('Oturum açmanız gerekiyor');
        
        const topic = {
            id: Date.now(),
            ...data,
            authorId: user.id,
            authorName: user.username,
            authorAvatar: user.avatar,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            viewCount: 0,
            replyCount: 0,
            status: 'active'
        };
        
        topics.push(topic);
        this.setData('topics', topics);
        
        return topic;
    },

    // Yorum ekle
    addComment(topicId, content) {
        const comments = this.getData('comments') || [];
        const topics = this.getData('topics') || [];
        const user = auth.getCurrentUser();
        
        if (!user) throw new Error('Oturum açmanız gerekiyor');
        
        const comment = {
            id: Date.now(),
            topicId,
            content,
            authorId: user.id,
            authorName: user.username,
            authorAvatar: user.avatar,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            status: 'active'
        };
        
        comments.push(comment);
        this.setData('comments', comments);
        
        // Konunun yanıt sayısını güncelle
        const topic = topics.find(t => t.id === topicId);
        if (topic) {
            topic.replyCount = (topic.replyCount || 0) + 1;
            topic.updatedAt = Date.now();
            this.setData('topics', topics);
        }
        
        return comment;
    },

    // Konuyu güncelle
    updateTopic(id, data) {
        const topics = this.getData('topics') || [];
        const user = auth.getCurrentUser();
        
        if (!user) throw new Error('Oturum açmanız gerekiyor');
        
        const topic = topics.find(t => t.id === id);
        if (!topic) throw new Error('Konu bulunamadı');
        
        if (topic.authorId !== user.id && !auth.isAdmin()) {
            throw new Error('Bu işlem için yetkiniz yok');
        }
        
        Object.assign(topic, data, { updatedAt: Date.now() });
        this.setData('topics', topics);
        
        return topic;
    },

    // Konuyu sil
    deleteTopic(id) {
        const topics = this.getData('topics') || [];
        const comments = this.getData('comments') || [];
        const user = auth.getCurrentUser();
        
        if (!user) throw new Error('Oturum açmanız gerekiyor');
        
        const topic = topics.find(t => t.id === id);
        if (!topic) throw new Error('Konu bulunamadı');
        
        if (topic.authorId !== user.id && !auth.isAdmin()) {
            throw new Error('Bu işlem için yetkiniz yok');
        }
        
        // Konuyu ve yorumlarını sil
        const newTopics = topics.filter(t => t.id !== id);
        const newComments = comments.filter(c => c.topicId !== id);
        
        this.setData('topics', newTopics);
        this.setData('comments', newComments);
        
        return true;
    },

    // Yorumu güncelle
    updateComment(id, content) {
        const comments = this.getData('comments') || [];
        const user = auth.getCurrentUser();
        
        if (!user) throw new Error('Oturum açmanız gerekiyor');
        
        const comment = comments.find(c => c.id === id);
        if (!comment) throw new Error('Yorum bulunamadı');
        
        if (comment.authorId !== user.id && !auth.isAdmin()) {
            throw new Error('Bu işlem için yetkiniz yok');
        }
        
        comment.content = content;
        comment.updatedAt = Date.now();
        comment.isEdited = true;
        
        this.setData('comments', comments);
        
        return comment;
    },

    // Yorumu sil
    deleteComment(id) {
        const comments = this.getData('comments') || [];
        const topics = this.getData('topics') || [];
        const user = auth.getCurrentUser();
        
        if (!user) throw new Error('Oturum açmanız gerekiyor');
        
        const comment = comments.find(c => c.id === id);
        if (!comment) throw new Error('Yorum bulunamadı');
        
        if (comment.authorId !== user.id && !auth.isAdmin()) {
            throw new Error('Bu işlem için yetkiniz yok');
        }
        
        // Yorumu sil
        const newComments = comments.filter(c => c.id !== id);
        this.setData('comments', newComments);
        
        // Konunun yanıt sayısını güncelle
        const topic = topics.find(t => t.id === comment.topicId);
        if (topic) {
            topic.replyCount = Math.max(0, (topic.replyCount || 0) - 1);
            this.setData('topics', topics);
        }
        
        return true;
    },

    // Görüntülenme sayısını artır
    incrementViewCount(topicId) {
        const topics = this.getData('topics') || [];
        const topic = topics.find(t => t.id === topicId);
        
        if (topic) {
            topic.viewCount = (topic.viewCount || 0) + 1;
            this.setData('topics', topics);
        }
    }
};

// Global olarak erişilebilir yap
window.forum = forum; 