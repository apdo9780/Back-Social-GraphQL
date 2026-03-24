import { Request, Response, NextFunction } from 'express';
import { Chat, Message } from '../models/chat.model';
import { IUser } from '../models/user.model';
import { getSocketInstance } from '../services/socket-context';



interface IAuthRequest extends Request {
    
    user?: IUser;
}

// @desc    Create or access one-to-one chat
// @route   POST /api/chats
// @access  Private
export const accessChat = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        console.log('Accessing chat with userId:', req.body);
        const { userId } = req.body;
        

        if (!userId) {
            res.status(400).json({
                success: false,
                error: 'UserId param not sent with request'
            });
            return;
        }

        let chat = await Chat.findOne({
            isGroupChat: false,
            users: {
                $all: [req.user?._id, userId],
                $size: 2
            }
        }).populate('users', '-password')
          .populate('latestMessage');

        const socketService = getSocketInstance();
        console.log('socketService', socketService);
        

        if (chat) {
            chat = await chat.populate('latestMessage.sender', 'username avatar');
            
            // Notify the other user that chat was accessed
            socketService.emitToUser(userId, 'chat_accessed', {
                chat,
                accessedBy: req.user
            });
        } else {
            // Create new chat
            chat = await Chat.create({
                chatName: 'sender',
                isGroupChat: false,
                users: [req.user?._id, userId]
            });

            chat = await chat.populate('users', '-password');

            // Notify both users about new chat
            if (req.user?._id) {
                socketService.emitToUser(userId, 'new_chat', { chat });
                socketService.emitToUser(req.user._id, 'new_chat', { chat });
            }
        }

        res.status(200).json({
            success: true,
            data: chat
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all chats for a user
// @route   GET /api/chats
// @access  Private
export const fetchChats = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const chats = await Chat.find({ users: { $elemMatch: { $eq: req.user?._id } } })
            .populate('users', '-password')
            .populate('groupAdmin', '-password')
            .populate('latestMessage')
              .populate({
    path: 'messages',
    populate: {
      path: 'sender',
      select: 'name email',
    },
  })
            .sort({ updatedAt: -1 });

            const messages = await Message.find({ chat: { $in: chats.map(chat => chat._id) } }, {'readBy': 1});



        // const populatedChats = await Promise.all(
        //     chats.map(async (chat) => {
        //         if (chat.latestMessage) {
        //             return await chat.populate('latestMessage.sender', 'username avatar');
        //         }
        //         return chat;
        //     })
        // );

        res.status(200).json({
            success: true,
            data: chats
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new group chat
// @route   POST /api/chats/group
// @access  Private
export const createGroupChat = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.body.users || !req.body.name) {
            res.status(400).json({
                success: false,
                error: 'Please provide all required fields'
            });
            return;
        }

        let users = JSON.parse(req.body.users);

        if (users.length < 2) {
            res.status(400).json({
                success: false,
                error: 'More than 2 users are required to form a group chat'
            });
            return;
        }

        // Add current user to group
        users.push(req.user?._id);

        const groupChat = await Chat.create({
            chatName: req.body.name,
            users: users,
            isGroupChat: true,
            groupAdmin: req.user?._id,
        });

        const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
            .populate('users', '-password')
            .populate('groupAdmin', '-password');

        res.status(200).json({
            success: true,
            data: fullGroupChat
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Rename group chat
// @route   PUT /api/chats/group/:id
// @access  Private
export const renameGroup = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { chatId } = req.params;
        const { chatName } = req.body;

        const updatedChat = await Chat.findByIdAndUpdate(
            chatId,
            { chatName },
            { new: true }
        ).populate('users', '-password')
         .populate('groupAdmin', '-password');

        if (!updatedChat) {
            res.status(404).json({
                success: false,
                error: 'Chat not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: updatedChat
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Add user to group
// @route   PUT /api/chats/group/:id/add
// @access  Private
export const addToGroup = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { chatId } = req.params;
        const { userId } = req.body;

        const chat = await Chat.findById(chatId);

        if (!chat) {
            res.status(404).json({
                success: false,
                error: 'Chat not found'
            });
            return;
        }

        // Check if requester is admin
        if (chat.groupAdmin?.toString() !== req.user?._id.toString()) {
            res.status(403).json({
                success: false,
                error: 'Only admin can add members'
            });
            return;
        }

        const updatedChat = await Chat.findByIdAndUpdate(
            chatId,
            { $push: { users: userId } },
            { new: true }
        ).populate('users', '-password')
         .populate('groupAdmin', '-password');

        res.status(200).json({
            success: true,
            data: updatedChat
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Remove user from group
// @route   PUT /api/chats/group/:id/remove
// @access  Private
export const removeFromGroup = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { chatId } = req.params;
        const { userId } = req.body;

        const chat = await Chat.findById(chatId);

        if (!chat) {
            res.status(404).json({
                success: false,
                error: 'Chat not found'
            });
            return;
        }

        // Check if requester is admin
        if (chat.groupAdmin?.toString() !== req.user?._id.toString()) {
            res.status(403).json({
                success: false,
                error: 'Only admin can remove members'
            });
            return;
        }

        // Prevent removing admin from group
        if (userId === chat.groupAdmin?.toString()) {
            res.status(403).json({
                success: false,
                error: 'Admin cannot be removed from group'
            });
            return;
        }

        const updatedChat = await Chat.findByIdAndUpdate(
            chatId,
            { $pull: { users: userId } },
            { new: true }
        ).populate('users', '-password')
         .populate('groupAdmin', '-password');

        res.status(200).json({
            success: true,
            data: updatedChat
        });
    } catch (error) {
        next(error);
    }
};
