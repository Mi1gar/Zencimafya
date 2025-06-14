const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const mediaSchema = new Schema({
    // Temel Alanlar
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'image', 'video', 'audio', 'document', 'archive',
            'spreadsheet', 'presentation', 'code', 'custom'
        ]
    },
    mimeType: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['processing', 'ready', 'error', 'deleted'],
        default: 'processing'
    },
    // Dosya Bilgileri
    file: {
        originalName: String,
        path: String,
        url: String,
        bucket: String,
        key: String,
        etag: String,
        version: String,
        metadata: Schema.Types.Mixed
    },
    // Medya Özellikleri
    properties: {
        width: Number,
        height: Number,
        duration: Number,
        bitrate: Number,
        format: String,
        codec: String,
        fps: Number,
        channels: Number,
        sampleRate: Number,
        pages: Number,
        orientation: String,
        colorSpace: String,
        custom: Schema.Types.Mixed
    },
    // Önizleme ve Küçük Resimler
    thumbnails: [{
        size: {
            type: String,
            enum: ['xs', 'sm', 'md', 'lg', 'xl']
        },
        width: Number,
        height: Number,
        path: String,
        url: String,
        format: String
    }],
    // Optimizasyon
    optimization: {
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed'],
            default: 'pending'
        },
        originalSize: Number,
        optimizedSize: Number,
        compressionRatio: Number,
        quality: Number,
        format: String,
        settings: Schema.Types.Mixed
    },
    // Erişim ve İzinler
    access: {
        visibility: {
            type: String,
            enum: ['public', 'private', 'restricted'],
            default: 'private'
        },
        permissions: [{
            role: String,
            actions: [String]
        }],
        allowedUsers: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],
        allowedDomains: [String],
        expiryDate: Date
    },
    // Kullanım ve İstatistikler
    usage: {
        views: {
            type: Number,
            default: 0
        },
        downloads: {
            type: Number,
            default: 0
        },
        bandwidth: {
            type: Number,
            default: 0
        },
        lastAccessed: Date,
        locations: [{
            country: String,
            city: String,
            count: Number
        }]
    },
    // Metadata
    metadata: {
        title: String,
        description: String,
        tags: [String],
        category: String,
        album: String,
        artist: String,
        copyright: String,
        license: String,
        custom: Schema.Types.Mixed
    },
    // İlişkiler
    relations: {
        owner: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        uploader: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        parent: {
            type: Schema.Types.ObjectId,
            ref: 'Media'
        },
        children: [{
            type: Schema.Types.ObjectId,
            ref: 'Media'
        }]
    },
    // Geçmiş
    history: [{
        action: {
            type: String,
            enum: ['upload', 'update', 'delete', 'restore', 'optimize', 'transform']
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        details: Schema.Types.Mixed
    }]
}, {
    timestamps: true
});

// İndeksler
mediaSchema.index({ name: 1 });
mediaSchema.index({ type: 1, mimeType: 1 });
mediaSchema.index({ status: 1 });
mediaSchema.index({ 'metadata.tags': 1 });
mediaSchema.index({ 'relations.owner': 1 });
mediaSchema.index({ createdAt: -1 });

// Statik Metodlar
mediaSchema.statics.search = async function(query = {}, options = {}) {
    const {
        type,
        mimeType,
        status,
        owner,
        tags,
        visibility,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };
    if (type) filter.type = type;
    if (mimeType) filter.mimeType = mimeType;
    if (status) filter.status = status;
    if (owner) filter['relations.owner'] = owner;
    if (tags) filter['metadata.tags'] = { $in: tags };
    if (visibility) filter['access.visibility'] = visibility;

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('relations.owner', 'username email')
        .populate('relations.uploader', 'username email');
};

mediaSchema.statics.createMedia = async function(data) {
    const media = new this(data);
    await media.save();
    return media;
};

mediaSchema.statics.updateStatus = async function(id, status, userId, details = {}) {
    const media = await this.findById(id);
    if (!media) throw new Error('Medya bulunamadı');

    media.status = status;
    media.history.push({
        action: 'update',
        user: userId,
        details: { status, ...details }
    });

    await media.save();
    return media;
};

mediaSchema.statics.incrementUsage = async function(id, type = 'view', location = null) {
    const update = { $inc: {} };
    update.$inc[`usage.${type}s`] = 1;
    update.$set = { 'usage.lastAccessed': new Date() };

    if (location) {
        update.$push = {
            'usage.locations': {
                $each: [location],
                $slice: -100
            }
        };
    }

    return this.findByIdAndUpdate(id, update, { new: true });
};

// Instance Metodlar
mediaSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        name: this.name,
        type: this.type,
        mimeType: this.mimeType,
        size: this.size,
        status: this.status,
        file: {
            url: this.file.url,
            metadata: this.file.metadata
        },
        properties: this.properties,
        thumbnails: this.thumbnails,
        optimization: this.optimization,
        access: this.access,
        usage: this.usage,
        metadata: this.metadata,
        relations: {
            owner: this.relations.owner,
            uploader: this.relations.uploader
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

mediaSchema.methods.generateThumbnail = async function(size = 'md') {
    // Thumbnail oluşturma mantığı burada uygulanacak
    // Örnek: Sharp, FFmpeg vb. kütüphaneler kullanılabilir
};

const Media = mongoose.model('Media', mediaSchema);

module.exports = Media; 