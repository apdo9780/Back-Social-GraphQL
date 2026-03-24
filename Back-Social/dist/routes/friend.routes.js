"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const friend_controller_1 = require("../controllers/friend.controller");
const friend_validator_1 = require("../validators/friend.validator");
const router = (0, express_1.Router)();
// Friend requests
router.post('/request/:userId', auth_1.protect, friend_validator_1.validateFriendRequest, friend_controller_1.sendFriendRequest);
router.put('/accept/:requestId', auth_1.protect, friend_controller_1.acceptFriendRequest);
router.put('/reject/:requestId', auth_1.protect, friend_controller_1.rejectFriendRequest);
router.get('/requests', auth_1.protect, friend_controller_1.getFriendRequests);
// Friends management
router.get('/', auth_1.protect, friend_controller_1.getFriends);
router.delete('/:friendId', auth_1.protect, friend_controller_1.removeFriend);
exports.default = router;
