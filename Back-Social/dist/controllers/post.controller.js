"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addComment = exports.likePost = exports.deletePost = exports.updatePost = exports.getPostsByAuthor = exports.getMyPosts = exports.getPost = exports.getPosts = exports.createPost = void 0;
const post_model_1 = require("../models/post.model");
const user_model_1 = require("../models/user.model");
const mongoose_1 = __importDefault(require("mongoose"));
const socket_context_1 = require("../services/socket-context");
const populatedPostQuery = post_model_1.Post.find()
    .populate('author', '_id username avatar email firstName lastName role bio')
    .populate('comments.user', '_id username email avatar firstName lastName role bio')
    .populate('likes', '_id username avatar email firstName lastName role bio');
const toArrayOfTags = (value) => {
    if (Array.isArray(value)) {
        return value
            .map((tag) => String(tag).trim())
            .filter((tag) => tag.length > 0);
    }
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);
    }
    return [];
};
// @desc    Create new post
// @route   POST /api/posts
// @access  Private
const createPost = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
            return;
        }
        const media = req.file ? [`/uploads/posts/${req.file.filename}`] : [];
        const payload = {
            author: req.user._id,
            content: req.body.content,
            privacy: req.body.privacy,
            tags: toArrayOfTags(req.body.tags),
            media
        };
        const post = yield post_model_1.Post.create(payload);
        yield user_model_1.User.findByIdAndUpdate(req.user._id, { $push: { posts: post._id } }, {
            new: true,
            runValidators: true
        });
        const hydratedPost = yield post_model_1.Post.findById(post._id)
            .populate('author', '_id username avatar email firstName lastName role bio')
            .populate('comments.user', '_id username email avatar firstName lastName role bio')
            .populate('likes', '_id username avatar email firstName lastName role bio');
        res.status(201).json({
            success: true,
            data: hydratedPost
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createPost = createPost;
// @desc    Get all posts
// @route   GET /api/posts
// @access  Private
const getPosts = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
            return;
        }
        const currentUser = yield user_model_1.User.findById(req.user._id).select('friends');
        const visibleFriendAuthors = [
            req.user._id,
            ...((_b = currentUser === null || currentUser === void 0 ? void 0 : currentUser.friends) !== null && _b !== void 0 ? _b : [])
        ];
        const posts = yield populatedPostQuery.clone()
            .find({
            $or: [
                { privacy: 'public' },
                {
                    privacy: 'friends',
                    author: { $in: visibleFriendAuthors }
                }
            ]
        })
            .sort('-createdAt');
        res.status(200).json({
            success: true,
            count: posts.length,
            data: posts
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getPosts = getPosts;
// @desc    Get single post
// @route   GET /api/posts/:id
// @access  Private
const getPost = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const post = yield post_model_1.Post.findById(req.params.id)
            .populate('author', '_id username avatar email firstName lastName role bio')
            .populate('comments.user', '_id username email avatar firstName lastName role bio')
            .populate('likes', '_id username avatar email firstName lastName role bio');
        if (!post) {
            res.status(404).json({
                success: false,
                error: 'Post not found'
            });
            return;
        }
        if (post.privacy === 'private' &&
            ((_b = (_a = post.author) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) !== ((_d = (_c = req.user) === null || _c === void 0 ? void 0 : _c._id) === null || _d === void 0 ? void 0 : _d.toString())) {
            res.status(403).json({
                success: false,
                error: 'User not authorized to view this post'
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: post
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getPost = getPost;
// @desc    Get current user posts
// @route   GET /api/posts/mine
// @access  Private
const getMyPosts = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
            return;
        }
        const posts = yield post_model_1.Post.find({ author: req.user._id })
            .populate('author', '_id username avatar email firstName lastName role bio')
            .populate('comments.user', '_id username email avatar firstName lastName role bio')
            .populate('likes', '_id username avatar email firstName lastName role bio')
            .sort('-createdAt');
        res.status(200).json({
            success: true,
            count: posts.length,
            data: posts
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getMyPosts = getMyPosts;
// @desc    Get posts by author
// @route   GET /api/posts/user/:userId
// @access  Private
const getPostsByAuthor = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { userId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid user ID format'
            });
            return;
        }
        const isCurrentUser = ((_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) === userId;
        const filter = isCurrentUser
            ? { author: userId }
            : { author: userId, privacy: { $ne: 'private' } };
        const posts = yield post_model_1.Post.find(filter)
            .populate('author', '_id username avatar email firstName lastName role bio')
            .populate('comments.user', '_id username email avatar firstName lastName role bio')
            .populate('likes', '_id username avatar email firstName lastName role bio')
            .sort('-createdAt');
        res.status(200).json({
            success: true,
            count: posts.length,
            data: posts
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getPostsByAuthor = getPostsByAuthor;
// @desc    Update post
// @route   PUT /api/posts/:id
// @access  Private
const updatePost = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        let post = yield post_model_1.Post.findById(req.params.id);
        if (!post) {
            res.status(404).json({
                success: false,
                error: 'Post not found'
            });
            return;
        }
        // Make sure user is post owner
        if (post.author.toString() !== ((_a = req.user) === null || _a === void 0 ? void 0 : _a._id.toString())) {
            res.status(401).json({
                success: false,
                error: 'User not authorized to update this post'
            });
            return;
        }
        const media = req.file ? [`/uploads/posts/${req.file.filename}`] : post.media;
        const updatePayload = {
            content: req.body.content,
            privacy: req.body.privacy,
            tags: req.body.tags ? toArrayOfTags(req.body.tags) : post.tags,
            media
        };
        post = yield post_model_1.Post.findByIdAndUpdate(req.params.id, updatePayload, {
            new: true,
            runValidators: true,
        })
            .populate('author', '_id username avatar email firstName lastName role bio')
            .populate('comments.user', '_id username email avatar firstName lastName role bio')
            .populate('likes', '_id username avatar email firstName lastName role bio');
        res.status(200).json({
            success: true,
            data: post
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updatePost = updatePost;
// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
const deletePost = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const post = yield post_model_1.Post.findById(req.params.id);
        if (!post) {
            res.status(404).json({
                success: false,
                error: 'Post not found'
            });
            return;
        }
        // Make sure user is post owner
        if (post.author.toString() !== ((_a = req.user) === null || _a === void 0 ? void 0 : _a._id.toString())) {
            res.status(401).json({
                success: false,
                error: 'User not authorized to delete this post'
            });
            return;
        }
        yield post.deleteOne();
        yield user_model_1.User.findByIdAndUpdate((_b = req.user) === null || _b === void 0 ? void 0 : _b._id, { $pull: { posts: post._id } });
        res.status(200).json({
            success: true,
            data: {}
        });
    }
    catch (error) {
        next(error);
    }
});
exports.deletePost = deletePost;
// @desc    Like/Unlike post
// @route   PUT /api/posts/:id/like
// @access  Private
const likePost = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const socketService = (0, socket_context_1.getSocketInstance)();
        const post = yield post_model_1.Post.findById(req.params.id);
        if (!post) {
            res.status(404).json({
                success: false,
                error: 'Post not found'
            });
            return;
        }
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        if (!userId) {
            res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
            return;
        }
        const wasLiked = post.likes.some(like => like.equals(userId));
        // Check if post has already been liked
        if (post.likes.some(like => like.equals(userId))) {
            // Unlike
            post.likes = post.likes.filter(like => !like.equals(userId));
        }
        else {
            // Like
            post.likes.push(userId);
        }
        yield post.save();
        const hydratedPost = yield post_model_1.Post.findById(post._id)
            .populate('author', '_id username avatar email firstName lastName role bio')
            .populate('comments.user', '_id username email avatar firstName lastName role bio')
            .populate('likes', '_id username avatar email firstName lastName role bio');
        if (hydratedPost) {
            const actorName = (_c = (_b = req.user) === null || _b === void 0 ? void 0 : _b.username) !== null && _c !== void 0 ? _c : 'Someone';
            const actorId = userId.toString();
            const authorId = post.author.toString();
            const interactionPayload = {
                type: 'like',
                postId: req.params.id,
                actorId,
                actorName,
                post: hydratedPost
            };
            // Keep all clients in sync for this post in feed views.
            socketService.broadcastEvent('post_updated', interactionPayload);
            if (!wasLiked && authorId !== actorId) {
                socketService.emitToUser(authorId, 'post_interaction', interactionPayload);
                socketService.emitToUser(authorId, 'new Like', {
                    message: `Your post got a new like.`,
                    postId: req.params.id,
                    actorId,
                    actorName
                });
            }
        }
        res.status(200).json({
            success: true,
            data: hydratedPost !== null && hydratedPost !== void 0 ? hydratedPost : post
        });
    }
    catch (error) {
        next(error);
    }
});
exports.likePost = likePost;
// @desc    Add comment to post
// @route   POST /api/posts/:id/comments
// @access  Private
const addComment = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    try {
        const post = yield post_model_1.Post.findById(req.params.id);
        const socketService = (0, socket_context_1.getSocketInstance)();
        if (!post) {
            res.status(404).json({
                success: false,
                error: 'Post not found'
            });
            return;
        }
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
            return;
        }
        const newComment = {
            user: req.user._id,
            content: req.body.content,
            createdAt: new Date()
        };
        post.comments.unshift(newComment);
        yield post.save();
        const updatedPost = yield post_model_1.Post.findById(post._id)
            .populate('author', '_id username avatar email firstName lastName role bio')
            .populate('comments.user', '_id username email avatar firstName lastName role bio')
            .populate('likes', '_id username avatar email firstName lastName role bio');
        if (updatedPost) {
            const actorId = req.user._id.toString();
            const actorName = (_b = req.user.username) !== null && _b !== void 0 ? _b : 'Someone';
            const authorId = post.author.toString();
            const interactionPayload = {
                type: 'comment',
                postId: req.params.id,
                commentId: (_d = (_c = post.comments[0]) === null || _c === void 0 ? void 0 : _c._id) === null || _d === void 0 ? void 0 : _d.toString(),
                actorId,
                actorName,
                post: updatedPost
            };
            // Keep all clients in sync for this post in feed views.
            socketService.broadcastEvent('post_updated', interactionPayload);
            if (authorId !== actorId) {
                socketService.emitToUser(authorId, 'post_interaction', interactionPayload);
                socketService.emitToUser(authorId, 'new Comment', {
                    message: `Your post got a new comment.`,
                    postId: req.params.id,
                    commentId: (_f = (_e = post.comments[0]) === null || _e === void 0 ? void 0 : _e._id) === null || _f === void 0 ? void 0 : _f.toString(),
                    actorId,
                    actorName
                });
            }
        }
        res.status(200).json({
            success: true,
            data: updatedPost
        });
    }
    catch (error) {
        next(error);
    }
});
exports.addComment = addComment;
