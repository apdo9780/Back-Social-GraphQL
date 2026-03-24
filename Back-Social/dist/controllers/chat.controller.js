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
exports.removeFromGroup = exports.addToGroup = exports.renameGroup = exports.createGroupChat = exports.fetchChats = exports.accessChat = void 0;
const chat_model_1 = require("../models/chat.model");
const socket_context_1 = require("../services/socket-context");
// @desc    Create or access one-to-one chat
// @route   POST /api/chats
// @access  Private
const accessChat = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
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
        let chat = yield chat_model_1.Chat.findOne({
            isGroupChat: false,
            users: {
                $all: [(_a = req.user) === null || _a === void 0 ? void 0 : _a._id, userId],
                $size: 2
            }
        }).populate('users', '-password')
            .populate('latestMessage');
        const socketService = (0, socket_context_1.getSocketInstance)();
        console.log('socketService', socketService);
        if (chat) {
            chat = yield chat.populate('latestMessage.sender', 'username avatar');
            // Notify the other user that chat was accessed
            socketService.emitToUser(userId, 'chat_accessed', {
                chat,
                accessedBy: req.user
            });
        }
        else {
            // Create new chat
            chat = yield chat_model_1.Chat.create({
                chatName: 'sender',
                isGroupChat: false,
                users: [(_b = req.user) === null || _b === void 0 ? void 0 : _b._id, userId]
            });
            chat = yield chat.populate('users', '-password');
            // Notify both users about new chat
            if ((_c = req.user) === null || _c === void 0 ? void 0 : _c._id) {
                socketService.emitToUser(userId, 'new_chat', { chat });
                socketService.emitToUser(req.user._id, 'new_chat', { chat });
            }
        }
        res.status(200).json({
            success: true,
            data: chat
        });
    }
    catch (error) {
        next(error);
    }
});
exports.accessChat = accessChat;
// @desc    Get all chats for a user
// @route   GET /api/chats
// @access  Private
const fetchChats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const chats = yield chat_model_1.Chat.find({ users: { $elemMatch: { $eq: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id } } })
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
        const messages = yield chat_model_1.Message.find({ chat: { $in: chats.map(chat => chat._id) } }, { 'readBy': 1 });
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
    }
    catch (error) {
        next(error);
    }
});
exports.fetchChats = fetchChats;
// @desc    Create new group chat
// @route   POST /api/chats/group
// @access  Private
const createGroupChat = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
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
        users.push((_a = req.user) === null || _a === void 0 ? void 0 : _a._id);
        const groupChat = yield chat_model_1.Chat.create({
            chatName: req.body.name,
            users: users,
            isGroupChat: true,
            groupAdmin: (_b = req.user) === null || _b === void 0 ? void 0 : _b._id,
        });
        const fullGroupChat = yield chat_model_1.Chat.findOne({ _id: groupChat._id })
            .populate('users', '-password')
            .populate('groupAdmin', '-password');
        res.status(200).json({
            success: true,
            data: fullGroupChat
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createGroupChat = createGroupChat;
// @desc    Rename group chat
// @route   PUT /api/chats/group/:id
// @access  Private
const renameGroup = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { chatId } = req.params;
        const { chatName } = req.body;
        const updatedChat = yield chat_model_1.Chat.findByIdAndUpdate(chatId, { chatName }, { new: true }).populate('users', '-password')
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
    }
    catch (error) {
        next(error);
    }
});
exports.renameGroup = renameGroup;
// @desc    Add user to group
// @route   PUT /api/chats/group/:id/add
// @access  Private
const addToGroup = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { chatId } = req.params;
        const { userId } = req.body;
        const chat = yield chat_model_1.Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({
                success: false,
                error: 'Chat not found'
            });
            return;
        }
        // Check if requester is admin
        if (((_a = chat.groupAdmin) === null || _a === void 0 ? void 0 : _a.toString()) !== ((_b = req.user) === null || _b === void 0 ? void 0 : _b._id.toString())) {
            res.status(403).json({
                success: false,
                error: 'Only admin can add members'
            });
            return;
        }
        const updatedChat = yield chat_model_1.Chat.findByIdAndUpdate(chatId, { $push: { users: userId } }, { new: true }).populate('users', '-password')
            .populate('groupAdmin', '-password');
        res.status(200).json({
            success: true,
            data: updatedChat
        });
    }
    catch (error) {
        next(error);
    }
});
exports.addToGroup = addToGroup;
// @desc    Remove user from group
// @route   PUT /api/chats/group/:id/remove
// @access  Private
const removeFromGroup = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { chatId } = req.params;
        const { userId } = req.body;
        const chat = yield chat_model_1.Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({
                success: false,
                error: 'Chat not found'
            });
            return;
        }
        // Check if requester is admin
        if (((_a = chat.groupAdmin) === null || _a === void 0 ? void 0 : _a.toString()) !== ((_b = req.user) === null || _b === void 0 ? void 0 : _b._id.toString())) {
            res.status(403).json({
                success: false,
                error: 'Only admin can remove members'
            });
            return;
        }
        // Prevent removing admin from group
        if (userId === ((_c = chat.groupAdmin) === null || _c === void 0 ? void 0 : _c.toString())) {
            res.status(403).json({
                success: false,
                error: 'Admin cannot be removed from group'
            });
            return;
        }
        const updatedChat = yield chat_model_1.Chat.findByIdAndUpdate(chatId, { $pull: { users: userId } }, { new: true }).populate('users', '-password')
            .populate('groupAdmin', '-password');
        res.status(200).json({
            success: true,
            data: updatedChat
        });
    }
    catch (error) {
        next(error);
    }
});
exports.removeFromGroup = removeFromGroup;
