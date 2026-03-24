import mongoose, { Document, Schema } from 'mongoose';

export interface IPost extends Document {
    author: mongoose.Types.ObjectId;
    content: string;
    media?: string[];
    likes: mongoose.Types.ObjectId[];
    comments: {
        _id?: mongoose.Types.ObjectId;
        user: mongoose.Types.ObjectId;
        content: string;
        createdAt: Date;
    }[];
    privacy: 'public' | 'private' | 'friends';
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

const postSchema = new Schema<IPost>({
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: [true, 'Please add content to your post'],
        trim: true,
        maxlength: [1000, 'Post content cannot be more than 1000 characters']
    },
    media: [{
        type: String
    }],
    likes: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    comments: [{
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        content: {
            type: String,
            required: [true, 'Please add content to your comment'],
            trim: true,
            maxlength: [500, 'Comment cannot be more than 500 characters']
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    privacy: {
        type: String,
        enum: ['public', 'private', 'friends'],
        default: 'public'
    },
    tags: [{
        type: String,
        trim: true
    }]
}, {
    timestamps: true
});

// Index for faster searches
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ content: 'text', tags: 'text' });

export const Post = mongoose.model<IPost>('Post', postSchema);
