"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSendMessage = exports.validateGroupMembers = exports.validateRenameGroup = exports.validateCreateGroup = void 0;
const express_validator_1 = require("express-validator");
exports.validateCreateGroup = [
    (0, express_validator_1.body)('name')
        .trim()
        .notEmpty()
        .withMessage('Group name is required')
        .isLength({ min: 3, max: 50 })
        .withMessage('Group name must be between 3 and 50 characters'),
    (0, express_validator_1.body)('users')
        .isArray({ min: 2 })
        .withMessage('Group must have at least 2 other members')
        .custom((users) => {
        if (!users.every((user) => typeof user === 'string' && user.length === 24)) {
            throw new Error('Invalid user ID in the users array');
        }
        return true;
    }),
];
exports.validateRenameGroup = [
    (0, express_validator_1.body)('name')
        .trim()
        .notEmpty()
        .withMessage('Group name is required')
        .isLength({ min: 3, max: 50 })
        .withMessage('Group name must be between 3 and 50 characters'),
];
exports.validateGroupMembers = [
    (0, express_validator_1.body)('userId')
        .trim()
        .notEmpty()
        .withMessage('User ID is required')
        .isLength({ min: 24, max: 24 })
        .withMessage('Invalid user ID format'),
];
exports.validateSendMessage = [
    (0, express_validator_1.body)('content')
        .trim()
        .notEmpty()
        .withMessage('Message content is required')
        .isLength({ max: 2000 })
        .withMessage('Message content cannot exceed 2000 characters'),
    (0, express_validator_1.body)('chatId')
        .trim()
        .notEmpty()
        .withMessage('Chat ID is required')
        .isLength({ min: 24, max: 24 })
        .withMessage('Invalid chat ID format'),
];
