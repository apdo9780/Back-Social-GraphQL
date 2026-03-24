"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_1 = require("../middlewares/auth");
const upload_1 = require("../middlewares/upload");
const validate_1 = require("../middlewares/validate");
const validators_1 = require("../validators");
const router = express_1.default.Router();
router.route('/register')
    .post(validators_1.registerValidation, validate_1.validate, auth_controller_1.register);
router.route('/login')
    .post(validators_1.loginValidation, validate_1.validate, auth_controller_1.login);
router.route('/me')
    .get(auth_1.protect, auth_controller_1.getMe);
router.route('/search')
    .get(auth_1.protect, auth_controller_1.searchUsers);
router.route('/friend/:friendId')
    .get(auth_1.protect, auth_controller_1.getFriend);
router.route('/updatedetails')
    .put(auth_1.protect, validators_1.updateDetailsValidation, validate_1.validate, auth_controller_1.updateDetails);
router.route('/avatar')
    .put(auth_1.protect, upload_1.uploadAvatar.single('avatar'), auth_controller_1.updateAvatar);
exports.default = router;
