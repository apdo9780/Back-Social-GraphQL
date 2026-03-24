import express, { Router, RequestHandler } from 'express';
import { register, login, getMe, updateDetails, getFriend, updateAvatar, searchUsers } from '../controllers/auth.controller';
import { protect } from '../middlewares/auth';
import { uploadAvatar } from '../middlewares/upload';
import { validate } from '../middlewares/validate';
import {
    registerValidation,
    loginValidation,
    updateDetailsValidation
} from '../validators';

const router: Router = express.Router();

router.route('/register')
    .post(registerValidation, validate as RequestHandler, register as RequestHandler);

router.route('/login')
    .post(loginValidation, validate as RequestHandler, login as RequestHandler);

router.route('/me')
    .get(protect as RequestHandler, getMe as RequestHandler);
router.route('/search')
    .get(protect as RequestHandler, searchUsers as RequestHandler);
router.route('/friend/:friendId')
    .get(protect as RequestHandler, getFriend as RequestHandler);

router.route('/updatedetails')
    .put(protect as RequestHandler, updateDetailsValidation, validate as RequestHandler, updateDetails as RequestHandler);

router.route('/avatar')
    .put(protect as RequestHandler, uploadAvatar.single('avatar') as RequestHandler, updateAvatar as RequestHandler);

export default router;
