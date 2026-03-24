import { Request, Response, NextFunction } from 'express';
import { Post } from '../models/post.model';
import { IUser, User } from '../models/user.model';
import mongoose from 'mongoose';
import { getSocketInstance } from '../services/socket-context';


interface IAuthRequest extends Request {
    user?: IUser & {
        _id: mongoose.Types.ObjectId;
    };
    file?: Express.Multer.File;
}

interface IPostInteractionPayload {
    type: 'like' | 'comment';
    postId: string;
    commentId?: string;
    actorId: string;
    actorName: string;
    post: unknown;
}

const populatedPostQuery = Post.find()
    .populate('author', '_id username avatar email firstName lastName role bio')
    .populate('comments.user', '_id username email avatar firstName lastName role bio')
    .populate('likes', '_id username avatar email firstName lastName role bio');

const toArrayOfTags = (value: unknown): string[] => {
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
export const createPost = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user?._id) {
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

        const post = await Post.create(payload);
        await User.findByIdAndUpdate(
            req.user._id,
            { $push: { posts: post._id } },
            {
                new: true,
                runValidators: true
            }
        );

        const hydratedPost = await Post.findById(post._id)
            .populate('author', '_id username avatar email firstName lastName role bio')
            .populate('comments.user', '_id username email avatar firstName lastName role bio')
            .populate('likes', '_id username avatar email firstName lastName role bio');

        res.status(201).json({
            success: true,
            data: hydratedPost
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all posts
// @route   GET /api/posts
// @access  Private
export const getPosts = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user?._id) {
            res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
            return;
        }

        const currentUser = await User.findById(req.user._id).select('friends');
        const visibleFriendAuthors = [
            req.user._id,
            ...((currentUser?.friends ?? []) as mongoose.Types.ObjectId[])
        ];

        const posts = await populatedPostQuery.clone()
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
    } catch (error) {
        next(error);
    }
};

// @desc    Get single post
// @route   GET /api/posts/:id
// @access  Private
export const getPost = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const post = await Post.findById(req.params.id)
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

        if (
            post.privacy === 'private' &&
            post.author?._id?.toString() !== req.user?._id?.toString()
        ) {
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
    } catch (error) {
        next(error);
    }
};

// @desc    Get current user posts
// @route   GET /api/posts/mine
// @access  Private
export const getMyPosts = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user?._id) {
            res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
            return;
        }

        const posts = await Post.find({ author: req.user._id })
            .populate('author', '_id username avatar email firstName lastName role bio')
            .populate('comments.user', '_id username email avatar firstName lastName role bio')
            .populate('likes', '_id username avatar email firstName lastName role bio')
            .sort('-createdAt');

        res.status(200).json({
            success: true,
            count: posts.length,
            data: posts
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get posts by author
// @route   GET /api/posts/user/:userId
// @access  Private
export const getPostsByAuthor = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid user ID format'
            });
            return;
        }

        const isCurrentUser = req.user?._id?.toString() === userId;
        const filter = isCurrentUser
            ? { author: userId }
            : { author: userId, privacy: { $ne: 'private' } };

        const posts = await Post.find(filter)
            .populate('author', '_id username avatar email firstName lastName role bio')
            .populate('comments.user', '_id username email avatar firstName lastName role bio')
            .populate('likes', '_id username avatar email firstName lastName role bio')
            .sort('-createdAt');

        res.status(200).json({
            success: true,
            count: posts.length,
            data: posts
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update post
// @route   PUT /api/posts/:id
// @access  Private
export const updatePost = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        let post = await Post.findById(req.params.id);

        if (!post) {
            res.status(404).json({
                success: false,
                error: 'Post not found'
            });
            return;
        }

        // Make sure user is post owner
        if (post.author.toString() !== req.user?._id.toString()) {
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

        post = await Post.findByIdAndUpdate(req.params.id, updatePayload, {
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
    } catch (error) {
        next(error);
    }
};

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
export const deletePost = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            res.status(404).json({
                success: false,
                error: 'Post not found'
            });
            return;
        }

        // Make sure user is post owner
        if (post.author.toString() !== req.user?._id.toString()) {
            res.status(401).json({
                success: false,
                error: 'User not authorized to delete this post'
            });
            return;
        }

        await post.deleteOne();
        await User.findByIdAndUpdate(req.user?._id, { $pull: { posts: post._id } });

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Like/Unlike post
// @route   PUT /api/posts/:id/like
// @access  Private
export const likePost = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const socketService = getSocketInstance();
        
        const post = await Post.findById(req.params.id);

        if (!post) {
            res.status(404).json({
                success: false,
                error: 'Post not found'
            });
            return;
        }

        const userId = req.user?._id;
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
        } else {
            // Like
            post.likes.push(userId);
        }

        await post.save();

        const hydratedPost = await Post.findById(post._id)
            .populate('author', '_id username avatar email firstName lastName role bio')
            .populate('comments.user', '_id username email avatar firstName lastName role bio')
            .populate('likes', '_id username avatar email firstName lastName role bio');

        if (hydratedPost) {
            const actorName = req.user?.username ?? 'Someone';
            const actorId = userId.toString();
            const authorId = post.author.toString();

            const interactionPayload: IPostInteractionPayload = {
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
            data: hydratedPost ?? post
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Add comment to post
// @route   POST /api/posts/:id/comments
// @access  Private
export const addComment = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const post = await Post.findById(req.params.id);
        const socketService = getSocketInstance();


        if (!post) {
            res.status(404).json({
                success: false,
                error: 'Post not found'
            });
            return;
        }

        if (!req.user?._id) {
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

        await post.save();

        const updatedPost = await Post.findById(post._id)
            .populate('author', '_id username avatar email firstName lastName role bio')
            .populate('comments.user', '_id username email avatar firstName lastName role bio')
            .populate('likes', '_id username avatar email firstName lastName role bio');

        if (updatedPost) {
            const actorId = req.user._id.toString();
            const actorName = req.user.username ?? 'Someone';
            const authorId = post.author.toString();

            const interactionPayload: IPostInteractionPayload = {
                type: 'comment',
                postId: req.params.id,
                commentId: post.comments[0]?._id?.toString(),
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
                    commentId: post.comments[0]?._id?.toString(),
                    actorId,
                    actorName
                });
            }
        }

        res.status(200).json({
            success: true,
            data: updatedPost
        });
    } catch (error) {
        next(error);
    }
};
