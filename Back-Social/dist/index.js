"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const database_1 = __importDefault(require("./config/database"));
const error_1 = require("./middlewares/error");
const morgan_1 = __importDefault(require("morgan"));
// Route imports
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const post_routes_1 = __importDefault(require("./routes/post.routes"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const message_routes_1 = __importDefault(require("./routes/message.routes"));
const friend_routes_1 = __importDefault(require("./routes/friend.routes"));
// Load env vars
dotenv_1.default.config();
const API_PREFIX = `/api/${process.env.API_VERSION || 'v1'}`;
// Connect to database
(0, database_1.default)();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
// Initialize Socket.IO
const socket_context_1 = require("./services/socket-context");
const socketService = (0, socket_context_1.initializeSocket)(httpServer);
// Body parser
app.use(express_1.default.json());
app.use((0, morgan_1.default)('dev'));
// Enable CORS
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || 'http://localhost:4200',
    credentials: true
}));
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// Health check route
app.get(`${API_PREFIX}/health`, (req, res) => {
    res.json({
        status: 'success',
        message: 'API is running',
        version: process.env.API_VERSION,
        timestamp: new Date()
    });
});
// Mount routers
app.use(`${API_PREFIX}/auth`, auth_routes_1.default);
app.use(`${API_PREFIX}/posts`, post_routes_1.default);
app.use(`${API_PREFIX}/chats`, chat_routes_1.default);
app.use(`${API_PREFIX}/messages`, message_routes_1.default);
app.use(`${API_PREFIX}/friends`, friend_routes_1.default);
// 404 handler
app.use((req, res, next) => {
    const error = new Error('Not Found');
    error.status = 404;
    next(error);
});
// Error handler
app.use(error_1.errorHandler);
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
