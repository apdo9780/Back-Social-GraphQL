"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const chat_controller_1 = require("../controllers/chat.controller");
const validators_1 = require("../validators");
const router = (0, express_1.Router)();
// Individual chats
router.route('/').get(auth_1.protect, chat_controller_1.fetchChats)
    .post(auth_1.protect, chat_controller_1.accessChat);
// Group chat routes
router.route('/group').post(auth_1.protect, validators_1.validateCreateGroup, chat_controller_1.createGroupChat);
router.route('/group/:chatId').put(auth_1.protect, validators_1.validateRenameGroup, chat_controller_1.renameGroup);
router.route('/group/:chatId/add').put(auth_1.protect, validators_1.validateGroupMembers, chat_controller_1.addToGroup);
router.route('/group/:chatId/remove').put(auth_1.protect, validators_1.validateGroupMembers, chat_controller_1.removeFromGroup);
exports.default = router;
