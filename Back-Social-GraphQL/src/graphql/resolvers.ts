import { GraphQLScalarType, Kind } from 'graphql';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import {GraphQLUpload} from 'graphql-upload-ts';
import { withFilter } from 'graphql-subscriptions';
import type { GraphQLContext } from '../types/context';
import { User } from '../models/user.model';
import { Post } from '../models/post.model';
import { FriendRequest } from '../models/friend-request.model';
import { Chat, Message } from '../models/chat.model';
import { storeImageUpload } from '../uploads/store-upload';
import { pubsub, TOPICS } from '../subscriptions/pubsub';
import {redis} from '../Loaders/redis';

function requireUser(ctx: GraphQLContext) {
  if (!ctx.user?._id) {
    throw new Error('Not authorized to access this route');
  }
  return ctx.user;
}
const getPublicUrl = (key: string | null): string | null => {
  if (!key) return null;
  if (key.startsWith('http')) return key;

  const endpoint = process.env.AWS_ENDPOINT_URL || 'https://t3.storageapi.dev';
  const bucket = process.env.AWS_S3_BUCKET_NAME || 'roomy-chamber-fae8rvab1ih';
  
  const cleanEndpoint = endpoint.replace('https://', '').replace('http://', '');
  
  // تطبيق الـ Virtual-Hosted-Style
  return `https://${bucket}.${cleanEndpoint}/${key}`;
};

const DateTime = new GraphQLScalarType({
  name: 'DateTime',
  serialize(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    return new Date(value as any).toISOString();
  },
  parseValue(value) {
    return new Date(value as any);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) return new Date(ast.value);
    return null;
  }
});

const populatedPost = () =>
  Post.find()
    .populate('author', '_id username avatar email firstName lastName role bio')
    .populate('comments.user', '_id username email avatar firstName lastName role bio')
    .populate('likes', '_id username avatar email firstName lastName role bio');

export const resolvers = {
  Upload: GraphQLUpload,
  DateTime,
User: {
    avatar: (parent: any) => getPublicUrl(parent.avatar),
  },
  
  Post: {
    media: (parent: any) => {
      if (!parent.media || !Array.isArray(parent.media)) return [];
      return parent.media.map((key: string) => getPublicUrl(key));
    },
  },
  
  Query: {
    health: () => ({
      status: 'success',
      message: 'GraphQL API is running',
      apiVersion: process.env.API_VERSION || 'v1',
      timestamp: new Date().toISOString()
    }),

    me: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      const cacheKey = `user:profile:${user._id}`;
    
      const cachedMe = await redis.get(cacheKey);
      if (cachedMe) {
        console.log(`⚡ Serving 'me' profile for ${user._id} from Redis!`);
        return JSON.parse(cachedMe);
      }
       const meData = await User.findById(user._id)
        .populate('friendRequests')
        .populate('following')
        .exec();

        if (meData) {
        await redis.set(cacheKey, JSON.stringify(meData), 'EX', 300);
      }
      return meData;
    },

    user: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireUser(ctx);
      const cacheKey = `user:public_profile:${args.id}`;
      const cachedProfile = await redis.get(cacheKey);
      if (cachedProfile) {
        console.log(`⚡ Serving public profile for ${args.id} from Redis!`);
        return JSON.parse(cachedProfile);
      }
      console.log(`🐌 Fetching public profile for ${args.id} from MongoDB...`);
      const userData = await User.findById(args.id, '_id username email avatar posts role firstName lastName bio').exec();

      if (userData) {
        await redis.set(cacheKey, JSON.stringify(userData), 'EX', 600);
      }
      return userData;
    },

    searchUsers: async (_: unknown, args: { q: string }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const rawQuery = (args.q ?? '').trim();
      if (rawQuery.length < 2) return [];

      const escapedQuery = rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const queryRegex = new RegExp(escapedQuery, 'i');

      return await User.find(
        {
          _id: { $ne: me._id },
          $or: [{ username: queryRegex }, { firstName: queryRegex }, { lastName: queryRegex }, { email: queryRegex }]
        },
        '_id username email firstName lastName avatar role'
      )
        .limit(20)
        .sort({ username: 1 })
        .exec();
    },

    post: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const post = await Post.findById(args.id)
        .populate('author', '_id username avatar email firstName lastName role bio')
        .populate('comments.user', '_id username email avatar firstName lastName role bio')
        .populate('likes', '_id username avatar email firstName lastName role bio')
        .exec();
      if (!post) return null;

      if (post.privacy === 'private' && post.author?._id?.toString() !== me._id.toString()) {
        throw new Error('User not authorized to view this post');
      }
      return post;
    },

    feedPosts: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const me = requireUser(ctx);

      const cacheKey = `feed:${me._id}`;

  const cachedFeed = await redis.get(cacheKey);
  if (cachedFeed) {
    console.log(`⚡ Serving feed for user ${me._id} from Redis!`);
    return JSON.parse(cachedFeed); 
  }

      const currentUser = await User.findById(me._id).select('friends').exec();
      const visibleFriendAuthors = [me._id, ...(((currentUser?.friends ?? []) as any) || [])];

      const posts = await populatedPost()
        .find({
          $or: [
            { privacy: 'public' },
            {
              privacy: 'friends',
              author: { $in: visibleFriendAuthors }
            }
          ]
        })
        .sort('-createdAt')
        .exec();

        await redis.set(cacheKey, JSON.stringify(posts), 'EX', 180);
  return posts;
    },

    myPosts: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      return await Post.find({ author: me._id })
        .populate('author', '_id username avatar email firstName lastName role bio')
        .populate('comments.user', '_id username email avatar firstName lastName role bio')
        .populate('likes', '_id username avatar email firstName lastName role bio')
        .sort('-createdAt')
        .exec();
    },

    postsByUser: async (_: unknown, args: { userId: string }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      if (!mongoose.Types.ObjectId.isValid(args.userId)) throw new Error('Invalid user ID format');

      const isCurrentUser = me._id.toString() === args.userId;
      const filter = isCurrentUser ? { author: args.userId } : { author: args.userId, privacy: { $ne: 'private' } };
      return await Post.find(filter)
        .populate('author', '_id username avatar email firstName lastName role bio')
        .populate('comments.user', '_id username email avatar firstName lastName role bio')
        .populate('likes', '_id username avatar email firstName lastName role bio')
        .sort('-createdAt')
        .exec();
    },

    friendRequests: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      return await FriendRequest.find({
        recipient: me._id,
        status: 'pending'
      })
        .populate('sender', '-_id username email firstName lastName avatar')
        .populate('recipient', '-_id username email firstName lastName avatar')
        .exec();
    },

    friends: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const user = await User.findById(me._id).populate('friends', 'username avatar email').exec();
      return (user?.friends as any) ?? [];
    },

    chats: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const cacheKey = `user:chats:${me._id}`

      const cachedChats = await redis.get(cacheKey);
      if (cachedChats) {
        console.log(`⚡ Serving chats for ${me._id} from Redis!`);
        return JSON.parse(cachedChats);
      }

   console.log(`🐌 Fetching chats for ${me._id} from MongoDB...`);
      const chatsData = await Chat.find({ users: { $elemMatch: { $eq: me._id } } })
        .populate('users', '-password')
        .populate('groupAdmin', '-password')
        .populate('latestMessage')
        .sort({ updatedAt: -1 })
        .exec();

      // نحفظه لمدة دقيقة واحدة بس
      await redis.set(cacheKey, JSON.stringify(chatsData), 'EX', 60);
      return chatsData;
    },

    messages: async (_: unknown, args: { chatId: string }, ctx: GraphQLContext) => {
      requireUser(ctx);
      return await Message.find({ chat: args.chatId })
        .populate('sender', '-_id username email firstName lastName avatar')
        .populate('chat')
        .exec();
    }
  },

  Mutation: {
    register: async (_: unknown, args: { input: any }) => {
      const { username, email, password, firstName, lastName } = args.input;
      const user = await User.create({ username, email, password, firstName, lastName });
      return { token: user.getSignedJwtToken() };
    },

    login: async (_: unknown, args: { input: { email: string; password: string } }) => {
      const { email, password } = args.input;
      if (!email || !password) throw new Error('Please provide an email and password');

      const user = await User.findOne({ email }).select('+password').exec();
      if (!user) throw new Error('Invalid credentials');

      const isMatch = await user.matchPassword(password);
      if (!isMatch) throw new Error('Invalid credentials');

      user.lastLogin = new Date();
      await user.save();

      return { token: user.getSignedJwtToken() };
    },

    updateDetails: async (_: unknown, args: { input: any }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);

      const existingUser = await User.findOne({ email: me.email }).select('+password').exec();
      if (!existingUser) throw new Error('User not found');

      const isMatch = await existingUser.matchPassword(args.input.password);
      if (!isMatch) throw new Error('Invalid password');

      let newHashedPassword: string | undefined;
      if (args.input.newPassword) {
        const salt = await bcrypt.genSalt(10);
        newHashedPassword = await bcrypt.hash(args.input.newPassword, salt);
      }

      const fieldsToUpdate = Object.fromEntries(
        Object.entries({
          firstName: args.input.firstName,
          lastName: args.input.lastName,
          username: args.input.username,
          email: args.input.email,
          password: newHashedPassword,
          bio: args.input.bio
        }).filter(([_, value]) => value !== undefined)
      );

      const updated = await User.findByIdAndUpdate(me._id, fieldsToUpdate, { new: true, runValidators: true }).exec();
      if (!updated) throw new Error('User not found');
      return true;
    },

    uploadAvatar: async (_: unknown, args: { file: any }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const stored = await storeImageUpload({ target: 'avatars', file: args.file });
      const user = await User.findByIdAndUpdate(
        me._id,
        { avatar: stored.relativeUrlPath },
        { new: true, runValidators: true }
      ).exec();
      if (!user) throw new Error('User not found');
      return user;
    },

    createPost: async (_: unknown, args: { input: any; imageFile?: any }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const media = args.imageFile ? [(await storeImageUpload({ target: 'posts', file: args.imageFile })).relativeUrlPath] : [];
      const post = await Post.create({
        author: me._id,
        content: args.input.content,
        privacy: args.input.privacy ?? 'public',
        tags: Array.isArray(args.input.tags) ? args.input.tags : [],
        media
      });

      await User.findByIdAndUpdate(me._id, { $push: { posts: post._id } }, { new: true, runValidators: true }).exec();

      const hydrated = await Post.findById(post._id)
        .populate('author', '_id username avatar email firstName lastName role bio')
        .populate('comments.user', '_id username email avatar firstName lastName role bio')
        .populate('likes', '_id username avatar email firstName lastName role bio')
        .exec();
      const fullPost = hydrated ?? post;
      await pubsub.publish(TOPICS.POST_UPDATED, { postUpdated: fullPost, _meta: { postId: post._id.toString() } });
       redis.del(`feed:${me._id}`);
      return fullPost;
    },

    updatePost: async (_: unknown, args: { id: string; input: any; imageFile?: any }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const post = await Post.findById(args.id).exec();
      if (!post) throw new Error('Post not found');
      if (post.author.toString() !== me._id.toString()) throw new Error('User not authorized to update this post');

      const media = args.imageFile ? [(await storeImageUpload({ target: 'posts', file: args.imageFile })).relativeUrlPath] : post.media;
      const updatePayload = {
        content: args.input.content,
        privacy: args.input.privacy ?? post.privacy,
        tags: Array.isArray(args.input.tags) ? args.input.tags : post.tags,
        media
      };

      const updated = await Post.findByIdAndUpdate(args.id, updatePayload, { new: true, runValidators: true })
        .populate('author', '_id username avatar email firstName lastName role bio')
        .populate('comments.user', '_id username email avatar firstName lastName role bio')
        .populate('likes', '_id username avatar email firstName lastName role bio')
        .exec();

      if (!updated) throw new Error('Post not found');
      await pubsub.publish(TOPICS.POST_UPDATED, { postUpdated: updated, _meta: { postId: args.id } });

       redis.del(`feed:${me._id}`);
      return updated;
    },

    deletePost: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const post = await Post.findById(args.id).exec();
      if (!post) throw new Error('Post not found');
      if (post.author.toString() !== me._id.toString()) throw new Error('User not authorized to delete this post');
      await post.deleteOne();
      await User.findByIdAndUpdate(me._id, { $pull: { posts: post._id } }).exec();
      await redis.del(`feed:${me._id}`);
      return true;
    },

    toggleLike: async (_: unknown, args: { postId: string }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const post = await Post.findById(args.postId).exec();
      if (!post) throw new Error('Post not found');

      const userId = new mongoose.Types.ObjectId(me._id);
      const isLiked = post.likes.some((like) => like.equals(userId));
      post.likes = isLiked ? post.likes.filter((like) => !like.equals(userId)) : [...post.likes, userId];
      await post.save();

      const hydrated = await Post.findById(post._id)
        .populate('author', '_id username avatar email firstName lastName role bio')
        .populate('comments.user', '_id username email avatar firstName lastName role bio')
        .populate('likes', '_id username avatar email firstName lastName role bio')
        .exec();

      const fullPost = hydrated ?? post;
      await pubsub.publish(TOPICS.POST_UPDATED, { postUpdated: fullPost, _meta: { postId: args.postId } });

      const authorId = post.author.toString();
      if (authorId !== me._id.toString()) {
        await pubsub.publish(TOPICS.POST_INTERACTION, {
          postInteraction: {
            type: 'like',
            postId: args.postId,
            actorId: me._id.toString(),
            actorName: me.username,
            post: fullPost
          },
          _meta: { userId: authorId }
        });
      }
      return fullPost;
    },

    addComment: async (_: unknown, args: { postId: string; content: string }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const post = await Post.findById(args.postId).exec();
      if (!post) throw new Error('Post not found');

      post.comments.unshift({
        user: new mongoose.Types.ObjectId(me._id),
        content: args.content,
        createdAt: new Date()
      } as any);
      await post.save();

      const updated = await Post.findById(post._id)
        .populate('author', '_id username avatar email firstName lastName role bio')
        .populate('comments.user', '_id username email avatar email firstName lastName role bio')
        .populate('likes', '_id username avatar email firstName lastName role bio')
        .exec();
      if (!updated) throw new Error('Post not found');

      await pubsub.publish(TOPICS.POST_UPDATED, { postUpdated: updated, _meta: { postId: args.postId } });

      const authorId = post.author.toString();
      if (authorId !== me._id.toString()) {
        await pubsub.publish(TOPICS.POST_INTERACTION, {
          postInteraction: {
            type: 'comment',
            postId: args.postId,
            commentId: (updated.comments?.[0] as any)?._id?.toString(),
            actorId: me._id.toString(),
            actorName: me.username,
            post: updated
          },
          _meta: { userId: authorId }
        });
      }
      return updated;
    },

    sendFriendRequest: async (_: unknown, args: { userId: string }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const recipientId = args.userId;
      const senderId = me._id;

      const [sender, recipient] = await Promise.all([User.findById(senderId).exec(), User.findById(recipientId).exec()]);
      if (!recipient || !sender) throw new Error('User not found');

      const existingRequest = await FriendRequest.findOne({
        $or: [
          { sender: senderId, recipient: recipientId },
          { sender: recipientId, recipient: senderId }
        ]
      }).exec();
      if (existingRequest) throw new Error('Friend request already exists');
      if ((sender.friends as any).includes(recipientId)) throw new Error('Users are already friends');

      const friendRequest = await FriendRequest.create({ sender: senderId, recipient: recipientId });

      (sender.following as any).push(friendRequest._id);
      await sender.save();
      (recipient.friendRequests as any).push(friendRequest._id);
      await recipient.save();

      const hydrated = await FriendRequest.findById(friendRequest._id)
        .populate('sender')
        .populate('recipient')
        .exec();
      await pubsub.publish(TOPICS.FRIEND_REQUEST_RECEIVED, {
        friendRequestReceived: hydrated ?? friendRequest,
        _meta: { userId: recipientId }
      });
      return hydrated ?? friendRequest;
    },

    acceptFriendRequest: async (_: unknown, args: { requestId: string }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const friendRequest = await FriendRequest.findById(args.requestId).exec();
      if (!friendRequest) throw new Error('Friend request not found');
      if (friendRequest.recipient.toString() !== me._id.toString()) throw new Error('Not authorized to accept this request');

      const senderId = friendRequest.sender.toString();
      await friendRequest.deleteOne();

      const [sender, recipient] = await Promise.all([
        User.findById(friendRequest.sender).exec(),
        User.findById(friendRequest.recipient).exec()
      ]);
      if (!sender || !recipient) throw new Error('User not found');

      (sender.friends as any).push(recipient._id);
      (recipient.friends as any).push(sender._id);

      recipient.friendRequests = (recipient.friendRequests as any).filter((id: any) => id.toString() !== args.requestId.toString());
      sender.following = (sender.following as any).filter((id: any) => id.toString() !== args.requestId.toString());

      await Promise.all([sender.save(), recipient.save()]);
      await pubsub.publish(TOPICS.FRIEND_REQUEST_RESPONDED, {
        friendRequestResponded: { status: 'accepted', user: me, requestId: args.requestId },
        _meta: { userId: senderId }
      });
      return true;
    },

    rejectFriendRequest: async (_: unknown, args: { requestId: string }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const friendRequest = await FriendRequest.findById(args.requestId).exec();
      if (!friendRequest) throw new Error('Friend request not found');
      if (friendRequest.recipient.toString() !== me._id.toString()) throw new Error('Not authorized to reject this request');

      const senderId = friendRequest.sender.toString();
      await friendRequest.deleteOne();

      const [recipient, sender] = await Promise.all([User.findById(me._id).exec(), User.findById(friendRequest.sender).exec()]);
      if (recipient && sender) {
        recipient.friendRequests = (recipient.friendRequests as any).filter((id: any) => id.toString() !== args.requestId.toString());
        sender.following = (sender.following as any).filter((id: any) => id.toString() !== args.requestId.toString());
        await Promise.all([recipient.save(), sender.save()]);
      }

      await pubsub.publish(TOPICS.FRIEND_REQUEST_RESPONDED, {
        friendRequestResponded: { status: 'rejected', user: me, requestId: args.requestId },
        _meta: { userId: senderId }
      });
      return true;
    },

    removeFriend: async (_: unknown, args: { friendId: string }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const [user, friend] = await Promise.all([User.findById(me._id).exec(), User.findById(args.friendId).exec()]);
      if (!user || !friend) throw new Error('User not found');

      user.friends = (user.friends as any).filter((id: any) => id.toString() !== args.friendId.toString());
      friend.friends = (friend.friends as any).filter((id: any) => id.toString() !== me._id.toString());
      await Promise.all([user.save(), friend.save()]);
      return true;
    },

    createOrAccessChat: async (_: unknown, args: { userId: string }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      if (!args.userId) throw new Error('UserId param not sent with request');

      let chat = await Chat.findOne({
        isGroupChat: false,
        users: {
          $all: [me._id, args.userId],
          $size: 2
        }
      })
        .populate('users', '-password')
        .populate('latestMessage')
        .exec();

      if (!chat) {
        chat = await Chat.create({
          chatName: 'sender',
          isGroupChat: false,
          users: [me._id, args.userId]
        });

        chat = await Chat.findById(chat._id).populate('users', '-password').exec();
      } else {
        await chat.populate('latestMessage.sender', 'username avatar');
      }

      if (!chat) throw new Error('Chat not found');
      return chat;
    },

    createGroupChat: async (_: unknown, args: { input: { name: string; userIds: string[] } }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const users = [...(args.input.userIds || [])];
      if (!args.input.name || users.length < 2) throw new Error('More than 2 users are required to form a group chat');
      users.push(me._id.toString());

      const groupChat = await Chat.create({
        chatName: args.input.name,
        users,
        isGroupChat: true,
        groupAdmin: me._id
      });

      const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
        .populate('users', '-password')
        .populate('groupAdmin', '-password')
        .exec();
      if (!fullGroupChat) throw new Error('Chat not found');
      return fullGroupChat;
    },

    renameGroup: async (_: unknown, args: { chatId: string; name: string }, ctx: GraphQLContext) => {
      requireUser(ctx);
      const updatedChat = await Chat.findByIdAndUpdate(args.chatId, { chatName: args.name }, { new: true })
        .populate('users', '-password')
        .populate('groupAdmin', '-password')
        .exec();
      if (!updatedChat) throw new Error('Chat not found');
      return updatedChat;
    },

    addToGroup: async (_: unknown, args: { chatId: string; userId: string }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const chat = await Chat.findById(args.chatId).exec();
      if (!chat) throw new Error('Chat not found');
      if (chat.groupAdmin?.toString() !== me._id.toString()) throw new Error('Only admin can add members');

      const updatedChat = await Chat.findByIdAndUpdate(args.chatId, { $push: { users: args.userId } }, { new: true })
        .populate('users', '-password')
        .populate('groupAdmin', '-password')
        .exec();
      if (!updatedChat) throw new Error('Chat not found');
      return updatedChat;
    },

    removeFromGroup: async (_: unknown, args: { chatId: string; userId: string }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const chat = await Chat.findById(args.chatId).exec();
      if (!chat) throw new Error('Chat not found');
      if (chat.groupAdmin?.toString() !== me._id.toString()) throw new Error('Only admin can remove members');
      if (args.userId === chat.groupAdmin?.toString()) throw new Error('Admin cannot be removed from group');

      const updatedChat = await Chat.findByIdAndUpdate(args.chatId, { $pull: { users: args.userId } }, { new: true })
        .populate('users', '-password')
        .populate('groupAdmin', '-password')
        .exec();
      if (!updatedChat) throw new Error('Chat not found');
      return updatedChat;
    },

    sendMessage: async (_: unknown, args: { chatId: string; content: string }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      if (!args.content || !args.chatId) throw new Error('Invalid data passed into request');

      const createdMessage = await Message.create({ sender: me._id, content: args.content, chat: args.chatId });
      const populatedMessage = await Message.findById(createdMessage._id)
        .populate('sender', 'username avatar')
        .populate({
          path: 'chat',
          populate: {
            path: 'users',
            select: 'username avatar _id'
          }
        })
        .exec();

      if (!populatedMessage) throw new Error('Failed to populate message');

      await Chat.findByIdAndUpdate(args.chatId, { latestMessage: populatedMessage }).exec();
      await pubsub.publish(TOPICS.MESSAGE_ADDED, { messageAdded: populatedMessage, _meta: { chatId: args.chatId } });
      return populatedMessage;
    },

    markChatRead: async (_: unknown, args: { chatId: string }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      await Message.updateMany({ chat: args.chatId, readBy: { $ne: me._id } }, { $addToSet: { readBy: me._id } }).exec();
      return true;
    },

    setTypingStatus: async (_: unknown, args: { chatId: string; isTyping: boolean }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      await pubsub.publish(TOPICS.TYPING_STATUS, {
        typingStatus: { chatId: args.chatId, user: me, isTyping: args.isTyping },
        _meta: { chatId: args.chatId }
      });
      return true;
    },

    setUserStatus: async (_: unknown, args: { status: string }, ctx: GraphQLContext) => {
      const me = requireUser(ctx);
      const status = args.status === 'away' ? 'away' : 'online';
      const lastSeen = status === 'online' ? null : new Date();

      await User.updateOne({ _id: me._id }, { userStatus: status, lastSeen }).exec();
      await pubsub.publish(TOPICS.USER_STATUS_CHANGED, {
        userStatusChanged: { userId: me._id.toString(), status, lastSeen }
      });
      return true;
    }
  },

  Subscription: {
    messageAdded: {
      subscribe: withFilter(
        () => (pubsub as any).asyncIterator([TOPICS.MESSAGE_ADDED]),
        (payload: any, variables?: { chatId: string }) =>
          !!variables && payload?._meta?.chatId?.toString() === variables.chatId.toString()
      )
    },
    typingStatus: {
      subscribe: withFilter(
        () => (pubsub as any).asyncIterator([TOPICS.TYPING_STATUS]),
        (payload: any, variables?: { chatId: string }) =>
          !!variables && payload?._meta?.chatId?.toString() === variables.chatId.toString()
      )
    },
    userStatusChanged: {
      subscribe: () => (pubsub as any).asyncIterator([TOPICS.USER_STATUS_CHANGED])
    },
    friendRequestReceived: {
      subscribe: withFilter(
        () => (pubsub as any).asyncIterator([TOPICS.FRIEND_REQUEST_RECEIVED]),
        (payload: any, variables?: { userId: string }) =>
          !!variables && payload?._meta?.userId?.toString() === variables.userId.toString()
      )
    },
    friendRequestResponded: {
      subscribe: withFilter(
        () => (pubsub as any).asyncIterator([TOPICS.FRIEND_REQUEST_RESPONDED]),
        (payload: any, variables?: { userId: string }) =>
          !!variables && payload?._meta?.userId?.toString() === variables.userId.toString()
      )
    },
    postUpdated: {
      subscribe: withFilter(
        () => (pubsub as any).asyncIterator([TOPICS.POST_UPDATED]),
        (payload: any, variables?: { postId: string }) =>
          !!variables && payload?._meta?.postId?.toString() === variables.postId.toString()
      )
    },
    postInteraction: {
      subscribe: withFilter(
        () => (pubsub as any).asyncIterator([TOPICS.POST_INTERACTION]),
        (payload: any, variables?: { userId: string }) =>
          !!variables && payload?._meta?.userId?.toString() === variables.userId.toString()
      )
    }
  }
};

