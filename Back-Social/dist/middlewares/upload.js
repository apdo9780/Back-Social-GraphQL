"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadPostMedia = exports.uploadAvatar = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const uploadsRoot = path_1.default.join(process.cwd(), 'uploads');
const avatarsDir = path_1.default.join(uploadsRoot, 'avatars');
const postsDir = path_1.default.join(uploadsRoot, 'posts');
for (const directory of [uploadsRoot, avatarsDir, postsDir]) {
    if (!fs_1.default.existsSync(directory)) {
        fs_1.default.mkdirSync(directory, { recursive: true });
    }
}
const fileFilter = (_req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
        callback(new Error('Only image uploads are allowed'));
        return;
    }
    callback(null, true);
};
const buildStorage = (targetDir) => multer_1.default.diskStorage({
    destination: (_req, _file, callback) => {
        callback(null, targetDir);
    },
    filename: (_req, file, callback) => {
        const ext = path_1.default.extname(file.originalname) || '.jpg';
        const safeExt = ext.toLowerCase();
        callback(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`);
    }
});
const commonLimits = {
    fileSize: 5 * 1024 * 1024
};
exports.uploadAvatar = (0, multer_1.default)({
    storage: buildStorage(avatarsDir),
    fileFilter,
    limits: commonLimits
});
exports.uploadPostMedia = (0, multer_1.default)({
    storage: buildStorage(postsDir),
    fileFilter,
    limits: commonLimits
});
