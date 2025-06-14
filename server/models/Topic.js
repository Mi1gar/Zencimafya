const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 200
    },
    content: {
        type: String,
        required: true,
        minlength: 10
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    tags: [{
        type: String,
        trim: true
    }],
    status: {
        type: String,
        enum: ['active', 'locked', 'hidden', 'deleted'],
        default: 'active'
    },
    type: {
        type: String,
        enum: ['normal', 'sticky', 'announcement', 'poll'],
        default: 'normal'
    },
    poll: {
        question: String,
        options: [{
            text: String,
            votes: [{
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                },
                votedAt: Date
            }]
        }],
        endDate: Date,
        multipleChoice: Boolean
    },
    stats: {
        views: { type: Number, default: 0 },
        replies: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        thanks: { type: Number, default: 0 }
    },
    lastReply: {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        date: Date
    },
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
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
    }]
}, {
    timestamps: true
});

// İndeksler
topicSchema.index({ title: 'text', content: 'text' });
topicSchema.index({ category: 1, createdAt: -1 });
topicSchema.index({ author: 1, createdAt: -1 });
topicSchema.index({ status: 1, type: 1 });

// Konu arama metodu
topicSchema.statics.search = async function(query, filters = {}) {
    const searchQuery = {
        $and: [
            { status: 'active' },
            {
                $or: [
                    { title: { $regex: query, $options: 'i' } },
                    { content: { $regex: query, $options: 'i' } },
                    { tags: { $in: [new RegExp(query, 'i')] } }
                ]
            }
        ]
    };

    if (filters.category) {
        searchQuery.$and.push({ category: filters.category });
    }

    if (filters.author) {
        searchQuery.$and.push({ author: filters.author });
    }

    if (filters.tags && filters.tags.length > 0) {
        searchQuery.$and.push({ tags: { $all: filters.tags } });
    }

    return this.find(searchQuery)
        .populate('author', 'username avatar')
        .populate('category', 'name')
        .sort({ createdAt: -1 })
        .limit(20);
};

// Konu detayları için public veri
topicSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        title: this.title,
        content: this.content,
        author: this.author,
        category: this.category,
        tags: this.tags,
        status: this.status,
        type: this.type,
        poll: this.poll,
        stats: this.stats,
        lastReply: this.lastReply,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

// Konu listesi için kısa veri
topicSchema.methods.toListJSON = function() {
    return {
        id: this._id,
        title: this.title,
        author: this.author,
        category: this.category,
        stats: this.stats,
        lastReply: this.lastReply,
        createdAt: this.createdAt
    };
};

const Topic = mongoose.model('Topic', topicSchema);

module.exports = Topic; 