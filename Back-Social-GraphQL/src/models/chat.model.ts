import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  chat: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  content: string;
  readBy: mongoose.Types.ObjectId[];
  createdAt: Date;
}

export interface IChat extends Document {
  id: mongoose.Types.ObjectId;
  chatName: string;
  isGroupChat: boolean;
  users: mongoose.Types.ObjectId[];
  latestMessage?: mongoose.Types.ObjectId;
  groupAdmin?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    chat: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: true
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      trim: true,
      required: [true, 'Message content is required']
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  {
    timestamps: true
  }
);

const chatSchema = new Schema<IChat>(
  {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    chatName: {
      type: String,
      trim: true,
      required: [true, 'Chat name is required for group chats']
    },
    isGroupChat: {
      type: Boolean,
      default: false
    },
    users: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    latestMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message'
    },
    groupAdmin: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

chatSchema.virtual('messages', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'chat'
});

chatSchema.set('toObject', { virtuals: true });
chatSchema.set('toJSON', { virtuals: true });

chatSchema.pre('save', function (next) {
  if (this.users.length < 2) {
    const err = new Error('Chat must have at least 2 users');
    next(err);
    return;
  }
  this.id = this._id;
  next();
});

export const Message = mongoose.model<IMessage>('Message', messageSchema);
export const Chat = mongoose.model<IChat>('Chat', chatSchema);

