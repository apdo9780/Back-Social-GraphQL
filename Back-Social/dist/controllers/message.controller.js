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
Object.defineProperty(exports, "__esModule", { value: true });
exports.markMessagesAsRead = exports.allMessages = exports.sendMessage = void 0;
const chat_model_1 = require("../models/chat.model");
const socket_context_1 = require("../services/socket-context");
// @desc    Send new message
// @route   POST /api/messages
// @access  Private
const sendMessage = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
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
            sender: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id,
            content: content,
            chat: chatId,
        };
        const createdMessage = yield chat_model_1.Message.create(newMessage);
        if (!createdMessage) {
            res.status(500).json({
                success: false,
                error: 'Failed to create message'
            });
            return;
        }
        const populatedMessage = yield chat_model_1.Message.findById(createdMessage._id)
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
        console.log(populatedMessage, "populatedMessage");
        // Update latest message in chat
        yield chat_model_1.Chat.findByIdAndUpdate(chatId, { latestMessage: populatedMessage });
        const socketService = (0, socket_context_1.getSocketInstance)();
        const chatUsers = populatedMessage.chat.users;
        if (Array.isArray(chatUsers)) {
            // Send the message to all users in the chat except the sender
            chatUsers.forEach((user) => {
                var _a;
                if (user._id.toString() !== ((_a = req.user) === null || _a === void 0 ? void 0 : _a._id.toString())) {
                    socketService.emitToUser(user._id.toString(), 'new_message', {
                        message: populatedMessage,
                        chat: populatedMessage.chat
                    });
                }
            });
        }
        // Send delivered status back to sender
        if ((_b = req.user) === null || _b === void 0 ? void 0 : _b._id) {
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
    }
    catch (error) {
        next(error);
    }
});
exports.sendMessage = sendMessage;
// @desc    Get all messages for a chat
// @route   GET /api/messages/:chatId
// @access  Private
const allMessages = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const messages = yield chat_model_1.Message.find({ chat: req.params.chatId })
            .populate('sender', '-_id username email firstName lastName avatar');
        // .populate('chat');
        res.status(200).json({
            success: true,
            data: messages
        });
    }
    catch (error) {
        next(error);
    }
});
exports.allMessages = allMessages;
// @desc    Mark messages as read
// @route   PUT /api/messages/read/:chatId
// @access  Private
const markMessagesAsRead = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        yield chat_model_1.Message.updateMany({
            chat: req.params.chatId,
            readBy: { $ne: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id }
        }, {
            $addToSet: { readBy: (_b = req.user) === null || _b === void 0 ? void 0 : _b._id }
        });
        res.status(200).json({
            success: true,
            message: 'Messages marked as read'
        });
    }
    catch (error) {
        next(error);
    }
});
exports.markMessagesAsRead = markMessagesAsRead;
