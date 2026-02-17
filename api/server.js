const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const cors = require('cors');

// drand quicknet chain parameters
const QUICKNET_GENESIS_TIME = 1692803367; // Unix timestamp (seconds)
const QUICKNET_PERIOD = 3; // seconds per round

const AGE_ARMOR_HEADER = '-----BEGIN AGE ENCRYPTED FILE-----';
const AGE_ARMOR_FOOTER = '-----END AGE ENCRYPTED FILE-----';

/**
 * Parse a tlock ciphertext and extract the round number from the "-> tlock" stanza.
 */
function extractRoundNumber(fileContent) {
    let searchContent = fileContent;

    // If the file is AGE armored, decode the base64 payload first
    if (fileContent.includes(AGE_ARMOR_HEADER)) {
        try {
            const start = fileContent.indexOf(AGE_ARMOR_HEADER) + AGE_ARMOR_HEADER.length;
            const end = fileContent.indexOf(AGE_ARMOR_FOOTER);
            if (end > start) {
                const base64Payload = fileContent.slice(start, end).replace(/\s+/g, '');
                searchContent = Buffer.from(base64Payload, 'base64').toString('binary');
            }
        } catch (e) {
            console.error('Failed to decode AGE armor:', e);
        }
    }

    // Search for "-> tlock" stanza in the decoded content
    const lines = searchContent.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-> tlock ')) {
            const parts = trimmed.split(/\s+/);
            // parts: ['->', 'tlock', roundNumber, chainHash, ...]
            if (parts.length >= 3) {
                const round = parseInt(parts[2], 10);
                if (!isNaN(round) && round > 0) {
                    return round;
                }
            }
        }
    }
    return null;
}

/**
 * Convert a drand quicknet round number to a Unix timestamp (ms).
 * Formula: timestamp = (genesis_time + round_number * period) * 1000
 */
function roundToTimestamp(roundNumber) {
    return (QUICKNET_GENESIS_TIME + roundNumber * QUICKNET_PERIOD) * 1000;
}

const app = express();
const PORT = 3001;

// Data directory for uploads
const DATA_DIR = process.env.DATA_DIR || '/data/uploads';
const META_DIR = path.join(DATA_DIR, 'meta');

// Ensure directories exist
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(META_DIR, { recursive: true });

// Max file size: 50MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, DATA_DIR);
    },
    filename: (req, file, cb) => {
        // Will be renamed after upload with the generated ID
        cb(null, `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE }
});

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
    const checks = {
        uptime: {
            status: 'ok',
            uptime_seconds: process.uptime()
        }
    };

    // Check disk space for DATA_DIR
    exec(`df -B1 ${DATA_DIR}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            checks.disk_space = { status: 'error', error: error.message };
        } else {
            // Output format: Filesystem 1B-blocks Used Available Use% Mounted on
            // Skip header line
            const lines = stdout.trim().split('\n');
            if (lines.length >= 2) {
                const parts = lines[lines.length - 1].split(/\s+/);
                if (parts.length >= 4) {
                    const total = parseInt(parts[1], 10);
                    const available = parseInt(parts[3], 10);
                    const freeGb = (available / (1024 * 1024 * 1024)).toFixed(2);
                    const freePercent = ((available / total) * 100).toFixed(1) + '%';
                    
                    checks.disk_space = {
                        status: available > 1024 * 1024 * 100 ? 'ok' : 'warning', // Warn if < 100MB
                        free_gb: parseFloat(freeGb),
                        free_percent: freePercent
                    };
                }
            }
        }

        res.json({
            status: 'ok',
            timestamp: Math.floor(Date.now() / 1000),
            checks: checks
        });
    });
});

/**
 * POST /api/vault/upload
 * Upload an encrypted .tlock file.
 * The unlock time is automatically extracted from the tlock ciphertext.
 * Form data:
 *   - file: the .tlock encrypted file
 *   - originalName: original file name (before encryption)
 *   - message: optional message/description
 */
app.post('/api/vault/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'ファイルが見つかりません' });
        }

        const { originalName, message } = req.body;

        // Read the uploaded file content to extract round number
        const ciphertext = fs.readFileSync(req.file.path, 'utf-8');
        const roundNumber = extractRoundNumber(ciphertext);

        if (!roundNumber) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'tlockファイルからラウンド番号を読み取れませんでした。正しい .tlock ファイルをアップロードしてください。' });
        }

        const unlockTimestamp = roundToTimestamp(roundNumber);
        const unlockDate = new Date(unlockTimestamp);

        const id = uuidv4();
        const fileExt = '.vault';
        const storedFileName = `${id}${fileExt}`;

        // Rename the temp file
        const finalPath = path.join(DATA_DIR, storedFileName);
        fs.renameSync(req.file.path, finalPath);

        // Save metadata
        const metadata = {
            id,
            originalName: originalName || 'unknown',
            unlockTime: unlockDate.toISOString(),
            roundNumber,
            message: message || '',
            uploadedAt: new Date().toISOString(),
            fileSize: req.file.size,
            storedFileName
        };

        fs.writeFileSync(
            path.join(META_DIR, `${id}.json`),
            JSON.stringify(metadata, null, 2)
        );

        console.log(`[UPLOAD] id=${id}, file=${metadata.originalName}, round=${roundNumber}, unlock=${metadata.unlockTime}`);

        res.json({
            id,
            originalName: metadata.originalName,
            unlockTime: metadata.unlockTime,
            roundNumber,
            message: metadata.message,
            fileSize: metadata.fileSize,
            uploadedAt: metadata.uploadedAt
        });
    } catch (err) {
        console.error('Upload error:', err);
        // Clean up temp file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'アップロードに失敗しました' });
    }
});

/**
 * GET /api/vault/info/:id
 * Get metadata about a vault file (always available).
 */
app.get('/api/vault/info/:id', (req, res) => {
    try {
        const metaPath = path.join(META_DIR, `${req.params.id}.json`);

        if (!fs.existsSync(metaPath)) {
            return res.status(404).json({ error: 'ファイルが見つかりません' });
        }

        const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        const now = new Date();
        const unlockDate = new Date(metadata.unlockTime);
        const isUnlocked = now >= unlockDate;

        res.json({
            id: metadata.id,
            originalName: metadata.originalName,
            unlockTime: metadata.unlockTime,
            message: metadata.message,
            fileSize: metadata.fileSize,
            uploadedAt: metadata.uploadedAt,
            isUnlocked
        });
    } catch (err) {
        console.error('Info error:', err);
        res.status(500).json({ error: 'メタデータの取得に失敗しました' });
    }
});

/**
 * GET /api/vault/download/:id
 * Download an encrypted vault file.
 * Only available BEFORE the unlock time.
 * After unlock time, the file is no longer downloadable.
 */
app.get('/api/vault/download/:id', (req, res) => {
    try {
        const metaPath = path.join(META_DIR, `${req.params.id}.json`);

        if (!fs.existsSync(metaPath)) {
            return res.status(404).json({ error: 'ファイルが見つかりません' });
        }

        const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        const now = new Date();
        const unlockDate = new Date(metadata.unlockTime);

        // After unlock time, downloading is forbidden
        if (now >= unlockDate) {
            return res.status(403).json({
                error: '解除時刻を過ぎたため、ダウンロードできません',
                unlockTime: metadata.unlockTime
            });
        }

        const filePath = path.join(DATA_DIR, metadata.storedFileName);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'ファイルデータが見つかりません' });
        }

        const downloadName = `${metadata.originalName}.tlock`;
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', metadata.fileSize);

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    } catch (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'ダウンロードに失敗しました' });
    }
});

/**
 * GET /api/vault/list
 * List recent vault entries (limited to 50, newest first).
 */
app.get('/api/vault/list', (req, res) => {
    try {
        const files = fs.readdirSync(META_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const meta = JSON.parse(fs.readFileSync(path.join(META_DIR, f), 'utf-8'));
                const now = new Date();
                const unlockDate = new Date(meta.unlockTime);
                return {
                    id: meta.id,
                    originalName: meta.originalName,
                    unlockTime: meta.unlockTime,
                    message: meta.message,
                    fileSize: meta.fileSize,
                    uploadedAt: meta.uploadedAt,
                    isUnlocked: now >= unlockDate
                };
            })
            .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
            .slice(0, 50);

        res.json(files);
    } catch (err) {
        console.error('List error:', err);
        res.status(500).json({ error: 'リストの取得に失敗しました' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Timevault API server running on port ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});
