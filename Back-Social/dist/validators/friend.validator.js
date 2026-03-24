"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFriendRequest = void 0;
const express_validator_1 = require("express-validator");
exports.validateFriendRequest = [
    (0, express_validator_1.param)('userId')
        .isMongoId()
        .withMessage('Invalid user ID format'),
    (0, express_validator_1.body)('message')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Message cannot exceed 200 characters')
];
