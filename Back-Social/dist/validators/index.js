"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSendMessage = exports.validateGroupMembers = exports.validateRenameGroup = exports.validateCreateGroup = exports.idValidation = exports.commentValidation = exports.postValidation = exports.updateDetailsValidation = exports.loginValidation = exports.registerValidation = void 0;
const express_validator_1 = require("express-validator");
exports.registerValidation = [
    (0, express_validator_1.body)('username')
        .trim()
        .notEmpty()
        .withMessage('Please add a username')
        .isLength({ min: 3 })
        .withMessage('Username must be at least 3 characters long'),
    (0, express_validator_1.body)('email')
        .notEmpty()
        .withMessage('Please add an email')
        .matches(/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/)
        .withMessage('Please add a valid email')
        .normalizeEmail(),
    (0, express_validator_1.body)('password')
        .notEmpty()
        .withMessage('Please add a password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    (0, express_validator_1.body)('firstName')
        .notEmpty()
        .trim().withMessage('Please add a firstName')
        .isLength({ min: 3 }),
    (0, express_validator_1.body)('lastName')
        .notEmpty()
        .trim().withMessage('Please add a lastName')
        .isLength({ min: 3 })
];
exports.loginValidation = [
    (0, express_validator_1.body)('email')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    (0, express_validator_1.body)('password')
        .notEmpty()
        .withMessage('Password is required')
];
exports.updateDetailsValidation = [
    (0, express_validator_1.body)('username')
        .optional()
        .trim()
        .isLength({ min: 3 })
        .withMessage('Username must be at least 3 characters long'),
    (0, express_validator_1.body)('email')
        .optional()
        .matches(/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/)
        .withMessage('Please add a valid email')
        .normalizeEmail(),
    (0, express_validator_1.body)('firstName')
        .optional()
        .trim(),
    (0, express_validator_1.body)('lastName')
        .optional()
        .trim(),
    (0, express_validator_1.body)('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    (0, express_validator_1.body)('bio')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Bio cannot be more than 500 characters')
];
exports.postValidation = [
    (0, express_validator_1.body)('content')
        .trim()
        .notEmpty()
        .withMessage('Post content is required')
        .isLength({ max: 1000 })
        .withMessage('Post content cannot exceed 1000 characters'),
    (0, express_validator_1.body)('privacy')
        .optional()
        .isIn(['public', 'private', 'friends'])
        .withMessage('Invalid privacy setting'),
    (0, express_validator_1.body)('tags')
        .optional()
        .isArray()
        .withMessage('Tags must be an array'),
    (0, express_validator_1.body)('tags.*')
        .optional()
        .trim()
        .isLength({ min: 1 })
        .withMessage('Tags cannot be empty')
];
exports.commentValidation = [
    (0, express_validator_1.param)('id')
        .isMongoId()
        .withMessage('Invalid post ID'),
    (0, express_validator_1.body)('content')
        .trim()
        .notEmpty()
        .withMessage('Comment content is required')
        .isLength({ max: 500 })
        .withMessage('Comment cannot exceed 500 characters')
];
exports.idValidation = [
    (0, express_validator_1.param)('id')
        .isMongoId()
        .withMessage('Invalid ID format')
];
var chat_validator_1 = require("./chat.validator");
Object.defineProperty(exports, "validateCreateGroup", { enumerable: true, get: function () { return chat_validator_1.validateCreateGroup; } });
Object.defineProperty(exports, "validateRenameGroup", { enumerable: true, get: function () { return chat_validator_1.validateRenameGroup; } });
Object.defineProperty(exports, "validateGroupMembers", { enumerable: true, get: function () { return chat_validator_1.validateGroupMembers; } });
Object.defineProperty(exports, "validateSendMessage", { enumerable: true, get: function () { return chat_validator_1.validateSendMessage; } });
