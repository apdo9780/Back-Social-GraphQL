import fs from 'fs';
import path from 'path';
import multer from 'multer';

const uploadsRoot = path.join(process.cwd(), 'uploads');
const avatarsDir = path.join(uploadsRoot, 'avatars');
const postsDir = path.join(uploadsRoot, 'posts');

for (const directory of [uploadsRoot, avatarsDir, postsDir]) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

const fileFilter: multer.Options['fileFilter'] = (_req, file, callback) => {
  if (!file.mimetype.startsWith('image/')) {
    callback(new Error('Only image uploads are allowed'));
    return;
  }

  callback(null, true);
};

const buildStorage = (targetDir: string) =>
  multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, targetDir);
    },
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname) || '.jpg';
      const safeExt = ext.toLowerCase();
      callback(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`);
    }
  });

const commonLimits: multer.Options['limits'] = {
  fileSize: 5 * 1024 * 1024
};

export const uploadAvatar = multer({
  storage: buildStorage(avatarsDir),
  fileFilter,
  limits: commonLimits
});

export const uploadPostMedia = multer({
  storage: buildStorage(postsDir),
  fileFilter,
  limits: commonLimits
});
