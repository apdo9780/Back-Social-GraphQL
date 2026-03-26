import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  avatar?: string;
  followers: mongoose.Types.ObjectId[];
  following: mongoose.Types.ObjectId[];
  friends: mongoose.Types.ObjectId[];
  friendRequests: mongoose.Types.ObjectId[];
  posts: mongoose.Types.ObjectId[];
  role: 'user' | 'admin';
  isActive: boolean;
  lastLogin: Date;
  lastSeen?: Date;
  userStatus: 'online' | 'offline' | 'away';
  matchPassword: (enteredPassword: string) => Promise<boolean>;
  getSignedJwtToken: () => string;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, 'Please add a username'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters long']
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/, 'Please add a valid email']
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false
    },
    firstName: {
      type: String,
      trim: true
    },
    lastName: {
      type: String,
      trim: true
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot be more than 500 characters']
    },
    avatar: {
      type: String,
      default: 'default-avatar.png'
    },
    followers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    following: [
      {
        type: Schema.Types.ObjectId,
        ref: 'FriendRequest'
      }
    ],
    friends: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    friendRequests: [
      {
        type: Schema.Types.ObjectId,
        ref: 'FriendRequest'
      }
    ],
    posts: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Post'
      }
    ],
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date,
      default: Date.now
    },
    userStatus: {
      type: String,
      enum: ['online', 'offline', 'away'],
      default: 'offline'
    },
    lastSeen: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.getSignedJwtToken = function (): string {
  const secret = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
  return jwt.sign({ id: this._id }, secret, { expiresIn: process.env.JWT_EXPIRE || '30d' } as jwt.SignOptions);
};

userSchema.methods.matchPassword = async function (enteredPassword: string) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export const User = mongoose.model<IUser>('User', userSchema);

