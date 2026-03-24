"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Chat = exports.Message = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const messageSchema = new mongoose_1.Schema({
    chat: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Chat',
        required: true
    },
    sender: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        trim: true,
        required: [true, 'Message content is required']
    },
    readBy: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User'
        }]
}, {
    timestamps: true
});
const chatSchema = new mongoose_1.Schema({
    id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Message'
    },
    chatName: {
        type: String,
        trim: true,
        required: [true, 'Chat name is required for group chats'],
    },
    isGroupChat: {
        type: Boolean,
        default: false
    },
    users: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User'
        }],
    latestMessage: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Message'
    },
    groupAdmin: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});
chatSchema.virtual('messages', {
    ref: 'Message',
    localField: '_id',
    foreignField: 'chat',
});
chatSchema.set('toObject', { virtuals: true });
chatSchema.set('toJSON', { virtuals: true });
// Ensure a chat has at least 2 users
chatSchema.pre('save', function (next) {
    if (this.users.length < 2) {
        const err = new Error('Chat must have at least 2 users');
        return next(err);
    }
    this.id = this._id;
    next();
});
exports.Message = mongoose_1.default.model('Message', messageSchema);
exports.Chat = mongoose_1.default.model('Chat', chatSchema);
