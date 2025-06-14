const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true,
        trim: true
    },
    originalName: {
        type: String,
        required: true,
        trim: true
    },
    path: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'image',     // Resim dosyaları
            'document',  // Belge dosyaları
            'archive',   // Arşiv dosyaları
            'video',     // Video dosyaları
            'audio',     // Ses dosyaları
            'other'      // Diğer dosyalar
        ]
    },
    mimeType: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true,
        min: 0
    },
    dimensions: {
        width: Number,   // Resim/video genişliği
        height: Number,  // Resim/video yüksekliği
        duration: Number // Video/ses süresi (saniye)
    },
    metadata: {
        title: String,
        description: String,
        tags: [String],
        author: String,
        copyright: String,
        location: String,
        device: String,
        software: String,
        additionalData: mongoose.Schema.Types.Mixed
    },
    status: {
        type: String,
        enum: ['active', 'processing', 'error', 'deleted'],
        default: 'active'
    },
    visibility: {
        type: String,
        enum: ['public', 'private', 'restricted'],
        default: 'public'
    },
    permissions: {
        view: {
            type: String,
            enum: ['all', 'members', 'moderators'],
            default: 'all'
        },
        download: {
            type: String,
            enum: ['all', 'members', 'moderators'],
            default: 'all'
        }
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    parentItem: {
        type: {
            type: String,
            enum: ['topic', 'post', 'message', 'comment', 'user'],
            required: true
        },
        item: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'parentItem.type'
        }
    },
    stats: {
        downloads: { type: Number, default: 0 },
        views: { type: Number, default: 0 },
        lastDownloaded: Date,
        lastViewed: Date
    },
    processing: {
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed'],
            default: 'pending'
        },
        progress: { type: Number, default: 0 },
        error: String,
        attempts: { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 3 },
        startedAt: Date,
        completedAt: Date
    },
    versions: [{
        type: {
            type: String,
            enum: ['thumbnail', 'preview', 'optimized', 'watermarked'],
            required: true
        },
        path: String,
        size: Number,
        dimensions: {
            width: Number,
            height: Number
        },
        createdAt: Date
    }],
    security: {
        isVirusScanned: { type: Boolean, default: false },
        scanResult: String,
        scanDate: Date,
        isEncrypted: { type: Boolean, default: false },
        encryptionKey: String,
        hash: String
    },
    expiresAt: Date
}, {
    timestamps: true
});

// İndeksler
fileSchema.index({ filename: 1 });
fileSchema.index({ 'parentItem.item': 1, 'parentItem.type': 1 });
fileSchema.index({ owner: 1, status: 1 });
fileSchema.index({ type: 1, status: 1 });
fileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
fileSchema.index({ 'security.isVirusScanned': 1, 'security.scanResult': 1 });

// Dosya arama metodu
fileSchema.statics.search = async function(query = {}, options = {}) {
    const {
        type,
        status = 'active',
        visibility,
        owner,
        parentItem,
        startDate,
        endDate,
        limit = 20,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const searchQuery = {
        ...query,
        status
    };

    if (type) searchQuery.type = type;
    if (visibility) searchQuery.visibility = visibility;
    if (owner) searchQuery.owner = owner;
    if (parentItem) {
        searchQuery['parentItem.type'] = parentItem.type;
        searchQuery['parentItem.item'] = parentItem.item;
    }
    if (startDate || endDate) {
        searchQuery.createdAt = {};
        if (startDate) searchQuery.createdAt.$gte = new Date(startDate);
        if (endDate) searchQuery.createdAt.$lte = new Date(endDate);
    }

    return this.find(searchQuery)
        .populate('owner', 'username avatar')
        .populate('uploadedBy', 'username avatar')
        .sort(sort)
        .skip(skip)
        .limit(limit);
};

// Dosya işleme durumunu güncelleme metodu
fileSchema.methods.updateProcessingStatus = async function(status, progress = 0, error = null) {
    this.processing.status = status;
    this.processing.progress = progress;
    
    if (error) {
        this.processing.error = error;
        this.processing.attempts += 1;
    }

    if (status === 'processing') {
        this.processing.startedAt = new Date();
    } else if (status === 'completed') {
        this.processing.completedAt = new Date();
        this.status = 'active';
    } else if (status === 'failed') {
        this.status = 'error';
    }

    return this.save();
};

// Dosya versiyonu ekleme metodu
fileSchema.methods.addVersion = async function(versionData) {
    const {
        type,
        path,
        size,
        dimensions
    } = versionData;

    this.versions.push({
        type,
        path,
        size,
        dimensions,
        createdAt: new Date()
    });

    return this.save();
};

// Dosya silme metodu
fileSchema.methods.delete = async function() {
    if (this.status === 'deleted') {
        throw new Error('Dosya zaten silinmiş');
    }

    this.status = 'deleted';
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 gün sonra tamamen sil

    return this.save();
};

// Dosya detayları için public veri
fileSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        filename: this.filename,
        originalName: this.originalName,
        type: this.type,
        mimeType: this.mimeType,
        size: this.size,
        dimensions: this.dimensions,
        metadata: {
            title: this.metadata.title,
            description: this.metadata.description,
            tags: this.metadata.tags
        },
        status: this.status,
        visibility: this.visibility,
        permissions: this.permissions,
        owner: this.owner,
        stats: {
            downloads: this.stats.downloads,
            views: this.stats.views,
            lastDownloaded: this.stats.lastDownloaded,
            lastViewed: this.stats.lastViewed
        },
        versions: this.versions.map(v => ({
            type: v.type,
            path: v.path,
            size: v.size,
            dimensions: v.dimensions
        })),
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

// Dosya oluşturma yardımcı metodu
fileSchema.statics.createFile = async function(data) {
    const {
        filename,
        originalName,
        path,
        type,
        mimeType,
        size,
        dimensions,
        metadata = {},
        owner,
        uploadedBy,
        parentItem,
        visibility = 'public',
        permissions = {},
        security = {}
    } = data;

    const file = new this({
        filename,
        originalName,
        path,
        type,
        mimeType,
        size,
        dimensions,
        metadata,
        owner,
        uploadedBy,
        parentItem,
        visibility,
        permissions,
        security,
        processing: {
            status: 'pending',
            progress: 0
        }
    });

    return file.save();
};

const File = mongoose.model('File', fileSchema);

module.exports = File; 