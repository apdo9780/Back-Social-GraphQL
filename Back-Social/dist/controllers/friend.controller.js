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
exports.removeFriend = exports.getFriends = exports.getFriendRequests = exports.rejectFriendRequest = exports.acceptFriendRequest = exports.sendFriendRequest = void 0;
const friend_request_model_1 = require("../models/friend-request.model");
const user_model_1 = require("../models/user.model");
const socket_context_1 = require("../services/socket-context");
// @desc    Send friend request
// @route   POST /api/v1/friends/request/:userId
// @access  Private
const sendFriendRequest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const recipientId = req.params.userId;
        const senderId = req.user._id;
        // Check if users exist
        const [sender, recipient] = yield Promise.all([
            user_model_1.User.findById(senderId),
            user_model_1.User.findById(recipientId)
        ]);
        if (!recipient || !sender) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        // Check if request already exists
        const existingRequest = yield friend_request_model_1.FriendRequest.findOne({
            $or: [
                { sender: senderId, recipient: recipientId },
                { sender: recipientId, recipient: senderId }
            ]
        });
        if (existingRequest) {
            return res.status(400).json({
                success: false,
                error: 'Friend request already exists'
            });
        }
        // Check if users are already friends
        if (sender.friends.includes(recipientId)) {
            return res.status(400).json({
                success: false,
                error: 'Users are already friends'
            });
        }
        // Create friend request
        const friendRequest = yield friend_request_model_1.FriendRequest.create({
            sender: senderId,
            recipient: recipientId
        });
        // Add request to recipient's friendRequests
        sender.following.push(friendRequest._id);
        yield sender.save();
        recipient.friendRequests.push(friendRequest._id);
        yield recipient.save();
        const socketService = (0, socket_context_1.getSocketInstance)();
        const recId = friendRequest.recipient.toString(); // اللي جاله الطلب
        const senId = friendRequest.sender.toString(); // اللي بعت الطلب
        socketService.emitToUser(recId, 'new_friend_request', {
            sender: {
                _id: senId,
            },
            timestamp: new Date()
        });
        res.status(201).json({
            success: true,
            data: friendRequest
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
exports.sendFriendRequest = sendFriendRequest;
// @desc    Accept friend request
// @route   PUT /api/v1/friends/accept/:requestId
// @access  Private
const acceptFriendRequest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const requestId = req.params.requestId;
        const userId = req.user._id;
        const friendRequest = yield friend_request_model_1.FriendRequest.findById(requestId);
        if (!friendRequest) {
            return res.status(404).json({
                success: false,
                error: 'Friend request not found'
            });
        }
        // Check if user is the recipient
        if (friendRequest.recipient.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to accept this request'
            });
        }
        if (friendRequest.status == 'accepted') {
            return res.status(404).json({
                success: false,
                error: 'Already accepted '
            });
        }
        if (friendRequest.status == 'rejected') {
            return res.status(404).json({
                success: false,
                error: 'Already rejected '
            });
        }
        // Update request status
        // friendRequest.status = 'accepted';
        // await friendRequest.save();
        yield friendRequest.deleteOne();
        // Add users to each other's friends lists
        const [sender, recipient] = yield Promise.all([
            user_model_1.User.findById(friendRequest.sender),
            user_model_1.User.findById(friendRequest.recipient)
        ]);
        if (!sender || !recipient) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        sender.friends.push(recipient._id);
        recipient.friends.push(sender._id);
        // Remove request from recipient's friendRequests
        recipient.friendRequests = recipient.friendRequests.filter((req) => req.toString() !== requestId.toString());
        sender.following = sender.following.filter((req) => req.toString() !== requestId.toString());
        yield Promise.all([sender.save(), recipient.save()]);
        res.status(200).json({
            success: true,
            data: friendRequest
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
exports.acceptFriendRequest = acceptFriendRequest;
// @desc    Reject friend request
// @route   PUT /api/v1/friends/reject/:requestId
// @access  Private
const rejectFriendRequest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const requestId = req.params.requestId;
        const userId = req.user._id;
        const friendRequest = yield friend_request_model_1.FriendRequest.findById(requestId);
        if (!friendRequest) {
            return res.status(404).json({
                success: false,
                error: 'Friend request not found'
            });
        }
        // Check if user is the recipient
        if (friendRequest.recipient.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to reject this request'
            });
        }
        if (friendRequest.status == 'accepted') {
            return res.status(404).json({
                success: false,
                error: 'Already accepted '
            });
        }
        if (friendRequest.status == 'rejected') {
            return res.status(404).json({
                success: false,
                error: 'Already rejected '
            });
        }
        // Update request status
        // friendRequest.status = 'rejected';
        // await friendRequest.save();
        yield friendRequest.deleteOne();
        // Remove request from recipient's friendRequests
        const recipient = yield user_model_1.User.findById(userId);
        const sender = yield user_model_1.User.findById(friendRequest.sender);
        if (recipient && sender) {
            recipient.friendRequests = recipient.friendRequests.filter(req => req.toString() !== requestId.toString());
            sender.following = sender.following.filter((req) => req.toString() !== requestId.toString());
            yield recipient.save();
            yield sender.save();
        }
        res.status(200).json({
            success: true,
            data: friendRequest
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
exports.rejectFriendRequest = rejectFriendRequest;
// @desc    Get all friend requests
// @route   GET /api/v1/friends/requests
// @access  Private
const getFriendRequests = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const requests = yield friend_request_model_1.FriendRequest.find({
            recipient: req.user._id,
            status: 'pending'
        }).populate('sender', '-_id username email firstName lastName avatar');
        res.status(200).json({
            success: true,
            data: requests
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
exports.getFriendRequests = getFriendRequests;
// @desc    Get all friends
// @route   GET /api/v1/friends
// @access  Private
const getFriends = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield user_model_1.User.findById(req.user._id)
            .populate('friends', 'username avatar email');
        res.status(200).json({
            success: true,
            data: (user === null || user === void 0 ? void 0 : user.friends) || []
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
exports.getFriends = getFriends;
// @desc    Remove friend
// @route   DELETE /api/v1/friends/:friendId
// @access  Private
const removeFriend = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const friendId = req.params.friendId;
        const userId = req.user._id;
        const [user, friend] = yield Promise.all([
            user_model_1.User.findById(userId),
            user_model_1.User.findById(friendId)
        ]);
        if (!user || !friend) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        // Remove from each other's friends lists
        user.friends = user.friends.filter(id => id.toString() !== friendId.toString());
        friend.friends = friend.friends.filter(id => id.toString() !== userId.toString());
        yield Promise.all([user.save(), friend.save()]);
        res.status(200).json({
            success: true,
            message: 'Friend removed successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
exports.removeFriend = removeFriend;
