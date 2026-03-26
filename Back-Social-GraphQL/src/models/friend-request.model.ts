import { Schema, model, Document } from 'mongoose';

export interface IFriendRequest extends Document {
  sender: Schema.Types.ObjectId;
  recipient: Schema.Types.ObjectId;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const friendRequestSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    }
  },
  {
    timestamps: true
  }
);

friendRequestSchema.index({ sender: 1, recipient: 1 }, { unique: true });

export const FriendRequest = model<IFriendRequest>('FriendRequest', friendRequestSchema);

