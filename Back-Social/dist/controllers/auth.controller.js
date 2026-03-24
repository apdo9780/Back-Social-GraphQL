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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAvatar = exports.updateDetails = exports.searchUsers = exports.getFriend = exports.getMe = exports.login = exports.register = void 0;
const user_model_1 = require("../models/user.model");
const bcrypt_1 = __importDefault(require("bcrypt"));
// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username, email, password, firstName, lastName } = req.body;
        // Create user
        const user = yield user_model_1.User.create({
            username,
            email,
            password,
            firstName,
            lastName
        });
        // Create token
        const token = user.getSignedJwtToken();
        res.status(201).json({
            success: true,
            token
        });
    }
    catch (error) {
        next(error);
    }
});
exports.register = register;
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        console.log(req.body);
        // Validate email & password
        if (!email || !password) {
            res.status(400).json({
                success: false,
                error: 'Please provide an email and password'
            });
            return;
        }
        // Check for user
        const user = yield user_model_1.User.findOne({ email }).select('+password');
        if (!user) {
            res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
            return;
        }
        // Check if password matches
        const isMatch = yield user.matchPassword(password);
        if (!isMatch) {
            res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
            return;
        }
        // Update last login
        user.lastLogin = new Date();
        yield user.save();
        // Create token
        const token = user.getSignedJwtToken();
        res.status(200).json({
            success: true,
            token
        });
    }
    catch (error) {
        next(error);
    }
});
exports.login = login;
// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
            return;
        }
        const user = yield user_model_1.User.findById(req.user._id)
            .populate('friendRequests', '_id sender recipient status createdAt')
            .populate('following', ' _id sender recipient status  updatedAt ');
        let friendRequestsUSersData = [];
        let UserId;
        if (user === null || user === void 0 ? void 0 : user.friendRequests) {
            for (UserId of user === null || user === void 0 ? void 0 : user.following) {
                friendRequestsUSersData.push(UserId === null || UserId === void 0 ? void 0 : UserId.recipient.toString());
            }
        }
        const fullUser = yield user_model_1.User.find({
            _id: { $in: friendRequestsUSersData }
        }, { username: 1, firstName: 1, lastName: 1, email: 1, avatar: 1, role: 1 });
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: user,
            SentFriendsRequestsUsersData: fullUser
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getMe = getMe;
const getFriend = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
            return;
        }
        console.log();
        const user = yield user_model_1.User.findById(req.params.friendId, '_id username email avatar posts role firstName lastName bio');
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: user
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getFriend = getFriend;
// @desc    Search users by username, name, or email
// @route   GET /api/auth/search?q=term
// @access  Private
const searchUsers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
            return;
        }
        const rawQuery = (_c = (_b = req.query.q) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : '';
        if (rawQuery.length < 2) {
            res.status(200).json({
                success: true,
                data: []
            });
            return;
        }
        const escapedQuery = rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const queryRegex = new RegExp(escapedQuery, 'i');
        const users = yield user_model_1.User.find({
            _id: { $ne: req.user._id },
            $or: [
                { username: queryRegex },
                { firstName: queryRegex },
                { lastName: queryRegex },
                { email: queryRegex }
            ]
        }, '_id username email firstName lastName avatar role')
            .limit(20)
            .sort({ username: 1 });
        res.status(200).json({
            success: true,
            data: users
        });
    }
    catch (error) {
        next(error);
    }
});
exports.searchUsers = searchUsers;
// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
const updateDetails = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
            return;
        }
        const existingUser = yield user_model_1.User.findOne({ email: req.user.email }).select('+password');
        // Filter out undefined values
        if (!existingUser) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        const isMatch = yield existingUser.matchPassword(req.body.password);
        if (!isMatch) {
            res.status(401).json({
                success: false,
                error: 'Invalid password'
            });
            return;
        }
        let newHashedPassword;
        if (req.body.newPassword) {
            const salt = yield bcrypt_1.default.genSalt(10);
            newHashedPassword = yield bcrypt_1.default.hash(req.body.newPassword, salt);
        }
        const fieldsToUpdate = Object.fromEntries(Object.entries({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            username: req.body.username,
            email: req.body.email,
            password: newHashedPassword,
            bio: req.body.bio
        }).filter(([_, value]) => value !== undefined));
        const user = yield user_model_1.User.findByIdAndUpdate(req.user._id, fieldsToUpdate, {
            new: true,
            runValidators: true
        });
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: "User updated successfully"
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateDetails = updateDetails;
// @desc    Upload user avatar
// @route   PUT /api/auth/avatar
// @access  Private
const updateAvatar = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
            res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
            return;
        }
        if (!req.file) {
            res.status(400).json({
                success: false,
                error: 'Please upload an image file'
            });
            return;
        }
        const avatar = `/uploads/avatars/${req.file.filename}`;
        const user = yield user_model_1.User.findByIdAndUpdate(req.user._id, { avatar }, {
            new: true,
            runValidators: true
        });
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: user
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateAvatar = updateAvatar;
