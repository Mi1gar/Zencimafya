const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
        minlength: 1
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    topic: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Topic',
        required: true
    },
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    },
    status: {
        type: String,
        enum: ['active', 'hidden', 'deleted'],
        default: 'active'
    },
    type: {
        type: String,
        enum: ['normal', 'answer', 'solution'],
        default: 'normal'
    },
    stats: {
        likes: { type: Number, default: 0 },
        thanks: { type: Number, default: 0 },
        reports: { type: Number, default: 0 }
    },
    reactions: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        type: {
            type: String,
            enum: ['like', 'thanks', 'report']
        },
        createdAt: Date
    }],
    mentions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    attachments: [{
        filename: String,
        path: String,
        type: String,
        size: Number,
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        uploadedAt: Date
    }],
    editHistory: [{
        content: String,
        editedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        editedAt: Date,
        reason: String
    }]
}, {
    timestamps: true
});

// İndeksler
postSchema.index({ topic: 1, createdAt: 1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ content: 'text' });

// Mesaj arama metodu
postSchema.statics.search = async function(query, filters = {}) {
    const searchQuery = {
        $and: [
            { status: 'active' },
            { content: { $regex: query, $options: 'i' } }
        ]
    };

    if (filters.topic) {
        searchQuery.$and.push({ topic: filters.topic });
    }

    if (filters.author) {
        searchQuery.$and.push({ author: filters.author });
    }

    return this.find(searchQuery)
        .populate('author', 'username avatar')
        .populate('topic', 'title')
        .sort({ createdAt: -1 })
        .limit(20);
};

// Mesaj detayları için public veri
postSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        content: this.content,
        author: this.author,
        topic: this.topic,
        parent: this.parent,
        status: this.status,
        type: this.type,
        stats: this.stats,
        reactions: this.reactions,
        mentions: this.mentions,
        attachments: this.attachments,
        editHistory: this.editHistory,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

// Mesaj listesi için kısa veri
postSchema.methods.toListJSON = function() {
    return {
        id: this._id,
        content: this.content.substring(0, 200) + (this.content.length > 200 ? '...' : ''),
        author: this.author,
        topic: this.topic,
        stats: this.stats,
        createdAt: this.createdAt
    };
};

// Mesaj düzenleme metodu
postSchema.methods.edit = async function(newContent, editor, reason) {
    this.editHistory.push({
        content: this.content,
        editedBy: editor,
        editedAt: new Date(),
        reason: reason
    });
    
    this.content = newContent;
    return this.save();
};

// Mesaj reaksiyon metodu
postSchema.methods.addReaction = async function(userId, reactionType) {
    const existingReaction = this.reactions.find(
        r => r.user.toString() === userId.toString() && r.type === reactionType
    );

    if (existingReaction) {
        // Reaksiyonu kaldır
        this.reactions = this.reactions.filter(
            r => !(r.user.toString() === userId.toString() && r.type === reactionType)
        );
        this.stats[reactionType + 's']--;
    } else {
        // Yeni reaksiyon ekle
        this.reactions.push({
            user: userId,
            type: reactionType,
            createdAt: new Date()
        });
        this.stats[reactionType + 's']++;
    }

    return this.save();
};

const Post = mongoose.model('Post', postSchema);

module.exports = Post; 