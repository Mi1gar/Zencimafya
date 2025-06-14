const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const backupSchema = new Schema({
    // Temel Alanlar
    type: {
        type: String,
        required: true,
        enum: [
            'full', 'database', 'files', 'config', 'logs',
            'audit', 'users', 'content', 'custom'
        ]
    },
    status: {
        type: String,
        required: true,
        enum: [
            'pending', 'in_progress', 'completed', 'failed',
            'restoring', 'restored', 'deleted', 'corrupted'
        ],
        default: 'pending'
    },
    size: {
        type: Number,
        required: true,
        min: 0
    },
    location: {
        type: {
            type: String,
            enum: ['local', 's3', 'gcs', 'azure', 'custom'],
            required: true
        },
        path: {
            type: String,
            required: true
        },
        bucket: String,
        region: String,
        credentials: {
            type: Map,
            of: String,
            select: false
        }
    },
    metadata: {
        version: {
            type: String,
            required: true
        },
        compression: {
            type: String,
            enum: ['none', 'gzip', 'zip', 'tar.gz', 'custom'],
            default: 'gzip'
        },
        encryption: {
            enabled: {
                type: Boolean,
                default: false
            },
            method: {
                type: String,
                enum: ['none', 'aes-256-gcm', 'custom'],
                default: 'none'
            },
            key: {
                type: String,
                select: false
            }
        },
        checksum: {
            algorithm: {
                type: String,
                enum: ['md5', 'sha1', 'sha256', 'sha512'],
                default: 'sha256'
            },
            value: String
        },
        includedCollections: [{
            type: String
        }],
        excludedCollections: [{
            type: String
        }],
        includedPaths: [{
            type: String
        }],
        excludedPaths: [{
            type: String
        }]
    },
    schedule: {
        type: {
            type: String,
            enum: ['manual', 'daily', 'weekly', 'monthly', 'custom'],
            default: 'manual'
        },
        lastRun: Date,
        nextRun: Date,
        cronExpression: String,
        retention: {
            count: Number,
            days: Number
        }
    },
    progress: {
        current: {
            type: Number,
            default: 0
        },
        total: {
            type: Number,
            required: true
        },
        stage: {
            type: String,
            enum: [
                'initializing', 'collecting', 'compressing',
                'encrypting', 'uploading', 'verifying',
                'cleaning', 'completed'
            ]
        },
        startedAt: Date,
        completedAt: Date,
        error: {
            code: String,
            message: String,
            stack: String,
            details: Schema.Types.Mixed
        }
    },
    restore: {
        status: {
            type: String,
            enum: ['not_started', 'in_progress', 'completed', 'failed'],
            default: 'not_started'
        },
        startedAt: Date,
        completedAt: Date,
        target: {
            type: String,
            enum: ['original', 'custom'],
            default: 'original'
        },
        customPath: String,
        error: {
            code: String,
            message: String,
            stack: String,
            details: Schema.Types.Mixed
        }
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    notes: String,
    tags: [{
        type: String,
        trim: true
    }]
}, {
    timestamps: true
});

// İndeksler
backupSchema.index({ type: 1, status: 1, createdAt: -1 });
backupSchema.index({ 'schedule.type': 1, 'schedule.nextRun': 1 });
backupSchema.index({ createdBy: 1, createdAt: -1 });
backupSchema.index({ tags: 1 });
backupSchema.index({ 'metadata.version': 1 });

// Statik Metodlar
backupSchema.statics.search = async function(query = {}, options = {}) {
    const {
        type,
        status,
        createdBy,
        startDate,
        endDate,
        tags,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (createdBy) filter.createdBy = createdBy;
    if (tags) filter.tags = { $in: tags };
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = startDate;
        if (endDate) filter.createdAt.$lte = endDate;
    }

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'username avatar');
};

backupSchema.statics.createBackup = async function(data) {
    const backup = new this(data);
    await backup.save();
    return backup;
};

backupSchema.statics.getBackupStats = async function(options = {}) {
    const {
        startDate,
        endDate,
        type,
        status
    } = options;

    const match = {};

    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = startDate;
        if (endDate) match.createdAt.$lte = endDate;
    }
    if (type) match.type = type;
    if (status) match.status = status;

    const pipeline = [
        { $match: match },
        {
            $group: {
                _id: {
                    type: '$type',
                    status: '$status'
                },
                count: { $sum: 1 },
                totalSize: { $sum: '$size' },
                avgSize: { $avg: '$size' },
                lastBackup: { $max: '$createdAt' }
            }
        },
        {
            $group: {
                _id: '$_id.type',
                statuses: {
                    $push: {
                        status: '$_id.status',
                        count: '$count',
                        totalSize: '$totalSize',
                        avgSize: '$avgSize',
                        lastBackup: '$lastBackup'
                    }
                },
                totalCount: { $sum: '$count' },
                totalSize: { $sum: '$totalSize' }
            }
        }
    ];

    return this.aggregate(pipeline);
};

backupSchema.statics.cleanupOldBackups = async function(options = {}) {
    const {
        before,
        types,
        statuses,
        retention
    } = options;

    const filter = {};

    if (before) filter.createdAt = { $lt: before };
    if (types) filter.type = { $in: types };
    if (statuses) filter.status = { $in: statuses };
    if (retention) {
        filter['schedule.retention'] = retention;
    }

    const backups = await this.find(filter);
    const deletedBackups = [];

    for (const backup of backups) {
        try {
            // Yedek dosyalarını sil
            await backup.deleteFiles();
            // Veritabanı kaydını sil
            await backup.delete();
            deletedBackups.push(backup._id);
        } catch (error) {
            console.error(`Yedek silme hatası (${backup._id}):`, error);
        }
    }

    return deletedBackups;
};

// Instance Metodlar
backupSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        type: this.type,
        status: this.status,
        size: this.size,
        location: {
            type: this.location.type,
            path: this.location.path
        },
        metadata: {
            version: this.metadata.version,
            compression: this.metadata.compression,
            encryption: {
                enabled: this.metadata.encryption.enabled,
                method: this.metadata.encryption.method
            },
            checksum: this.metadata.checksum,
            includedCollections: this.metadata.includedCollections,
            excludedCollections: this.metadata.excludedCollections
        },
        schedule: {
            type: this.schedule.type,
            lastRun: this.schedule.lastRun,
            nextRun: this.schedule.nextRun
        },
        progress: {
            current: this.progress.current,
            total: this.progress.total,
            stage: this.progress.stage,
            startedAt: this.progress.startedAt,
            completedAt: this.progress.completedAt
        },
        restore: {
            status: this.restore.status,
            startedAt: this.restore.startedAt,
            completedAt: this.restore.completedAt,
            target: this.restore.target
        },
        createdBy: this.createdBy,
        notes: this.notes,
        tags: this.tags,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

backupSchema.methods.startBackup = async function() {
    if (this.status !== 'pending') {
        throw new Error('Sadece bekleyen yedekler başlatılabilir');
    }

    this.status = 'in_progress';
    this.progress.startedAt = new Date();
    this.progress.stage = 'initializing';
    await this.save();

    try {
        // Yedekleme işlemini başlat
        // Bu kısım gerçek yedekleme mantığını içerecek
        this.status = 'completed';
        this.progress.stage = 'completed';
        this.progress.completedAt = new Date();
        this.progress.current = this.progress.total;
    } catch (error) {
        this.status = 'failed';
        this.progress.error = {
            code: error.code,
            message: error.message,
            stack: error.stack,
            details: error
        };
    }

    await this.save();
    return this;
};

backupSchema.methods.startRestore = async function(options = {}) {
    if (this.status !== 'completed') {
        throw new Error('Sadece tamamlanmış yedekler geri yüklenebilir');
    }

    if (this.restore.status === 'in_progress') {
        throw new Error('Bu yedek zaten geri yükleniyor');
    }

    this.restore.status = 'in_progress';
    this.restore.startedAt = new Date();
    this.restore.target = options.target || 'original';
    this.restore.customPath = options.customPath;

    await this.save();

    try {
        // Geri yükleme işlemini başlat
        // Bu kısım gerçek geri yükleme mantığını içerecek
        this.restore.status = 'completed';
        this.restore.completedAt = new Date();
    } catch (error) {
        this.restore.status = 'failed';
        this.restore.error = {
            code: error.code,
            message: error.message,
            stack: error.stack,
            details: error
        };
    }

    await this.save();
    return this;
};

backupSchema.methods.deleteFiles = async function() {
    // Yedek dosyalarını silme mantığı
    // Bu kısım gerçek dosya silme işlemlerini içerecek
    return true;
};

const Backup = mongoose.model('Backup', backupSchema);

module.exports = Backup; 