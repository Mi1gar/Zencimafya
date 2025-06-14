const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const importExportSchema = new Schema({
    // Temel Alanlar
    type: {
        type: String,
        required: true,
        enum: ['import', 'export']
    },
    operation: {
        type: String,
        required: true,
        enum: [
            'users', 'topics', 'posts', 'comments', 'messages',
            'categories', 'tags', 'files', 'settings', 'custom'
        ]
    },
    status: {
        type: String,
        required: true,
        enum: [
            'pending', 'validating', 'processing', 'completed',
            'failed', 'cancelled', 'partially_completed'
        ],
        default: 'pending'
    },
    format: {
        type: {
            type: String,
            enum: ['json', 'csv', 'xml', 'excel', 'custom'],
            required: true
        },
        version: String,
        encoding: {
            type: String,
            default: 'utf-8'
        },
        delimiter: String,
        hasHeader: Boolean,
        customFormat: Schema.Types.Mixed
    },
    source: {
        type: {
            type: String,
            enum: ['file', 'url', 'api', 'database', 'custom'],
            required: true
        },
        path: String,
        url: String,
        credentials: {
            type: Map,
            of: String,
            select: false
        },
        options: Schema.Types.Mixed
    },
    destination: {
        type: {
            type: String,
            enum: ['file', 'url', 'api', 'database', 'custom'],
            required: true
        },
        path: String,
        url: String,
        credentials: {
            type: Map,
            of: String,
            select: false
        },
        options: Schema.Types.Mixed
    },
    data: {
        total: {
            type: Number,
            required: true,
            min: 0
        },
        processed: {
            type: Number,
            default: 0,
            min: 0
        },
        successful: {
            type: Number,
            default: 0,
            min: 0
        },
        failed: {
            type: Number,
            default: 0,
            min: 0
        },
        skipped: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    mapping: {
        fields: [{
            source: String,
            target: String,
            type: String,
            required: Boolean,
            defaultValue: Schema.Types.Mixed,
            transform: String
        }],
        relationships: [{
            type: String,
            sourceField: String,
            targetField: String,
            reference: String
        }],
        validations: [{
            field: String,
            type: String,
            rule: String,
            message: String
        }]
    },
    options: {
        validateOnly: {
            type: Boolean,
            default: false
        },
        updateExisting: {
            type: Boolean,
            default: false
        },
        skipErrors: {
            type: Boolean,
            default: false
        },
        batchSize: {
            type: Number,
            default: 1000
        },
        timeout: {
            type: Number,
            default: 3600000 // 1 saat
        },
        retryCount: {
            type: Number,
            default: 3
        },
        customOptions: Schema.Types.Mixed
    },
    progress: {
        stage: {
            type: String,
            enum: [
                'initializing', 'validating', 'preparing',
                'processing', 'finalizing', 'completed'
            ],
            default: 'initializing'
        },
        startedAt: Date,
        completedAt: Date,
        currentBatch: Number,
        totalBatches: Number,
        errors: [{
            row: Number,
            field: String,
            value: Schema.Types.Mixed,
            error: String,
            timestamp: Date
        }],
        warnings: [{
            row: Number,
            field: String,
            value: Schema.Types.Mixed,
            message: String,
            timestamp: Date
        }]
    },
    result: {
        summary: {
            totalTime: Number,
            averageSpeed: Number,
            peakMemory: Number,
            successRate: Number
        },
        files: [{
            name: String,
            path: String,
            size: Number,
            type: String,
            checksum: String
        }],
        statistics: {
            byType: Map,
            byStatus: Map,
            byError: Map
        }
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    schedule: {
        type: {
            type: String,
            enum: ['once', 'daily', 'weekly', 'monthly', 'custom'],
            default: 'once'
        },
        nextRun: Date,
        cronExpression: String,
        timezone: String
    },
    metadata: {
        description: String,
        tags: [String],
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
        },
        retention: {
            type: {
                type: String,
                enum: ['temporary', 'permanent'],
                default: 'temporary'
            },
            expiresAt: Date
        }
    }
}, {
    timestamps: true
});

// İndeksler
importExportSchema.index({ type: 1, operation: 1, status: 1, createdAt: -1 });
importExportSchema.index({ createdBy: 1, createdAt: -1 });
importExportSchema.index({ 'schedule.nextRun': 1 });
importExportSchema.index({ 'metadata.tags': 1 });
importExportSchema.index({ 'metadata.retention.expiresAt': 1 }, { expireAfterSeconds: 0 });

// Statik Metodlar
importExportSchema.statics.search = async function(query = {}, options = {}) {
    const {
        type,
        operation,
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
    if (operation) filter.operation = operation;
    if (status) filter.status = status;
    if (createdBy) filter.createdBy = createdBy;
    if (tags) filter['metadata.tags'] = { $in: tags };
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

importExportSchema.statics.createJob = async function(data) {
    const job = new this(data);
    await job.save();
    return job;
};

importExportSchema.statics.getStats = async function(options = {}) {
    const {
        startDate,
        endDate,
        type,
        operation,
        status
    } = options;

    const match = {};

    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = startDate;
        if (endDate) match.createdAt.$lte = endDate;
    }
    if (type) match.type = type;
    if (operation) match.operation = operation;
    if (status) match.status = status;

    const pipeline = [
        { $match: match },
        {
            $group: {
                _id: {
                    type: '$type',
                    operation: '$operation',
                    status: '$status'
                },
                count: { $sum: 1 },
                totalItems: { $sum: '$data.total' },
                successfulItems: { $sum: '$data.successful' },
                failedItems: { $sum: '$data.failed' },
                avgProcessingTime: { $avg: '$result.summary.totalTime' }
            }
        },
        {
            $group: {
                _id: {
                    type: '$_id.type',
                    operation: '$_id.operation'
                },
                statuses: {
                    $push: {
                        status: '$_id.status',
                        count: '$count',
                        totalItems: '$totalItems',
                        successfulItems: '$successfulItems',
                        failedItems: '$failedItems',
                        avgProcessingTime: '$avgProcessingTime'
                    }
                },
                totalJobs: { $sum: '$count' },
                totalItems: { $sum: '$totalItems' }
            }
        }
    ];

    return this.aggregate(pipeline);
};

// Instance Metodlar
importExportSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        type: this.type,
        operation: this.operation,
        status: this.status,
        format: {
            type: this.format.type,
            version: this.format.version,
            encoding: this.format.encoding
        },
        data: {
            total: this.data.total,
            processed: this.data.processed,
            successful: this.data.successful,
            failed: this.data.failed,
            skipped: this.data.skipped
        },
        progress: {
            stage: this.progress.stage,
            startedAt: this.progress.startedAt,
            completedAt: this.progress.completedAt,
            currentBatch: this.progress.currentBatch,
            totalBatches: this.progress.totalBatches,
            errorCount: this.progress.errors.length,
            warningCount: this.progress.warnings.length
        },
        result: {
            summary: this.result.summary,
            files: this.result.files.map(file => ({
                name: file.name,
                size: file.size,
                type: file.type
            }))
        },
        createdBy: this.createdBy,
        schedule: {
            type: this.schedule.type,
            nextRun: this.schedule.nextRun
        },
        metadata: {
            description: this.metadata.description,
            tags: this.metadata.tags,
            priority: this.metadata.priority
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

importExportSchema.methods.start = async function() {
    if (this.status !== 'pending') {
        throw new Error('Sadece bekleyen işler başlatılabilir');
    }

    this.status = 'processing';
    this.progress.startedAt = new Date();
    this.progress.stage = 'initializing';
    await this.save();

    try {
        // İşlemi başlat
        // Bu kısım gerçek içe/dışa aktarma mantığını içerecek
        this.status = 'completed';
        this.progress.stage = 'completed';
        this.progress.completedAt = new Date();
        this.progress.currentBatch = this.progress.totalBatches;
    } catch (error) {
        this.status = 'failed';
        this.progress.errors.push({
            row: 0,
            field: 'system',
            value: null,
            error: error.message,
            timestamp: new Date()
        });
    }

    await this.save();
    return this;
};

importExportSchema.methods.cancel = async function() {
    if (!['pending', 'validating', 'processing'].includes(this.status)) {
        throw new Error('Bu iş iptal edilemez');
    }

    this.status = 'cancelled';
    this.progress.completedAt = new Date();
    await this.save();

    // İşlemi iptal et
    // Bu kısım gerçek iptal mantığını içerecek

    return this;
};

importExportSchema.methods.retry = async function() {
    if (this.status !== 'failed') {
        throw new Error('Sadece başarısız işler yeniden denenebilir');
    }

    this.status = 'pending';
    this.progress.stage = 'initializing';
    this.progress.startedAt = null;
    this.progress.completedAt = null;
    this.progress.currentBatch = 0;
    this.progress.errors = [];
    this.progress.warnings = [];
    await this.save();

    return this.start();
};

const ImportExport = mongoose.model('ImportExport', importExportSchema);

module.exports = ImportExport; 