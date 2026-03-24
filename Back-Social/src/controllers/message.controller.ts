import { Request, Response, NextFunction } from 'express';
import { Chat, Message } from '../models/chat.model';
import { IUser } from '../models/user.model';
import mongoose from 'mongoose';
import { getSocketInstance } from '../services/socket-context';

interface IAuthRequest extends Request {
    user?: IUser & {
        _id: mongoose.Types.ObjectId;
    };
}

// @desc    Send new message
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { content, chatId } = req.body;

        if (!content || !chatId) {
            res.status(400).json({
                success: false,
                error: 'Invalid data passed into request'
            });
            return;
        }

        const newMessage = {
            sender: req.user?._id,
            content: content,
            chat: chatId,
        };

        const createdMessage = await Message.create(newMessage);
        
        if (!createdMessage) {
            res.status(500).json({
                success: false,
                error: 'Failed to create message'
            });
            return;
        }

        const populatedMessage = await Message.findById(createdMessage._id)
            .populate('sender', 'username avatar')
            .populate({
                path: 'chat',
                populate: {
                    path: 'users',
                    select: 'username avatar _id'
                }
            });

        if (!populatedMessage) {
            res.status(500).json({
                success: false,
                error: 'Failed to populate message'
            });
            return;
        }
console.log(populatedMessage ,"populatedMessage");

        // Update latest message in chat
        await Chat.findByIdAndUpdate(chatId, { latestMessage: populatedMessage });

        const socketService = getSocketInstance();
        const chatUsers = (populatedMessage.chat as any).users;

        if (Array.isArray(chatUsers)) {
            // Send the message to all users in the chat except the sender
            chatUsers.forEach((user: IUser) => {
                if (user._id.toString() !== req.user?._id.toString()) {
                    socketService.emitToUser(user._id.toString(), 'new_message', {
                        message: populatedMessage,
                        chat: populatedMessage.chat
                    });
                }
            });
        }

        // Send delivered status back to sender
        if (req.user?._id) {
            socketService.emitToUser(req.user._id.toString(), 'message_delivered', {
                messageId: populatedMessage._id,
                chatId: populatedMessage.chat._id
            });
        }

        // Update req.params if needed before sending response
        req.params.chatId = chatId;

        res.status(200).json({
            success: true,
            data: populatedMessage
        });
        // Remove the next() call since we've already sent a response
    } catch (error) {
        next(error);
    }
};

// @desc    Get all messages for a chat
// @route   GET /api/messages/:chatId
// @access  Private
export const allMessages = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const messages = await Message.find({ chat: req.params.chatId })
            .populate('sender', '-_id username email firstName lastName avatar')
            // .populate('chat');

        res.status(200).json({
            success: true,
            data: messages
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark messages as read
// @route   PUT /api/messages/read/:chatId
// @access  Private
export const markMessagesAsRead = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        await Message.updateMany(
            {
                chat: req.params.chatId,
                readBy: { $ne: req.user?._id }
            },
            {
                $addToSet: { readBy: req.user?._id }
            }
        );

        res.status(200).json({
            success: true,
            message: 'Messages marked as read'
        });
    } catch (error) {
        next(error);
    }
};
