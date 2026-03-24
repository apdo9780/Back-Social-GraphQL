import express, { Router, RequestHandler } from 'express';
import {
    getPosts,
    getMyPosts,
    getPostsByAuthor,
    getPost,
    createPost,
    updatePost,
    deletePost,
    likePost,
    addComment
} from '../controllers/post.controller';
import { protect } from '../middlewares/auth';
import { uploadPostMedia } from '../middlewares/upload';
import { validate } from '../middlewares/validate';
import {
    postValidation,
    commentValidation,
    idValidation
} from '../validators';

const router: Router = express.Router();

// Cast middleware and controller functions to RequestHandler
router.route('/')
    .get(protect as RequestHandler, getPosts as RequestHandler)
    .post(
        protect as RequestHandler,
        uploadPostMedia.single('image') as RequestHandler,
        postValidation,
        validate as RequestHandler,
        createPost as RequestHandler
    );

router.route('/mine')
    .get(protect as RequestHandler, getMyPosts as RequestHandler);

router.route('/user/:userId')
    .get(protect as RequestHandler, getPostsByAuthor as RequestHandler);

router.route('/:id')
    .get(protect as RequestHandler, idValidation, validate as RequestHandler, getPost as RequestHandler)
    .put(
        protect as RequestHandler,
        uploadPostMedia.single('image') as RequestHandler,
        idValidation,
        postValidation,
        validate as RequestHandler,
        updatePost as RequestHandler
    )
    .delete(protect as RequestHandler, idValidation, validate as RequestHandler, deletePost as RequestHandler);

router.route('/:id/like')
    .put(protect as RequestHandler, idValidation, validate as RequestHandler, likePost as RequestHandler);

router.route('/:id/comments')
    .post(protect as RequestHandler, commentValidation, validate as RequestHandler, addComment as RequestHandler);

export default router;
