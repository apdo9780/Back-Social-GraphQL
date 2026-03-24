"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const post_controller_1 = require("../controllers/post.controller");
const auth_1 = require("../middlewares/auth");
const upload_1 = require("../middlewares/upload");
const validate_1 = require("../middlewares/validate");
const validators_1 = require("../validators");
const router = express_1.default.Router();
// Cast middleware and controller functions to RequestHandler
router.route('/')
    .get(auth_1.protect, post_controller_1.getPosts)
    .post(auth_1.protect, upload_1.uploadPostMedia.single('image'), validators_1.postValidation, validate_1.validate, post_controller_1.createPost);
router.route('/mine')
    .get(auth_1.protect, post_controller_1.getMyPosts);
router.route('/user/:userId')
    .get(auth_1.protect, post_controller_1.getPostsByAuthor);
router.route('/:id')
    .get(auth_1.protect, validators_1.idValidation, validate_1.validate, post_controller_1.getPost)
    .put(auth_1.protect, upload_1.uploadPostMedia.single('image'), validators_1.idValidation, validators_1.postValidation, validate_1.validate, post_controller_1.updatePost)
    .delete(auth_1.protect, validators_1.idValidation, validate_1.validate, post_controller_1.deletePost);
router.route('/:id/like')
    .put(auth_1.protect, validators_1.idValidation, validate_1.validate, post_controller_1.likePost);
router.route('/:id/comments')
    .post(auth_1.protect, validators_1.commentValidation, validate_1.validate, post_controller_1.addComment);
exports.default = router;
