"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocketInstance = exports.initializeSocket = void 0;
const socket_service_1 = require("./socket.service");
// WebSocket context to make it available throughout the application
let socketInstance = null;
const initializeSocket = (server) => {
    socketInstance = new socket_service_1.SocketService(server);
    return socketInstance;
};
exports.initializeSocket = initializeSocket;
const getSocketInstance = () => {
    if (!socketInstance) {
        throw new Error('Socket.IO has not been initialized');
    }
    return socketInstance;
};
exports.getSocketInstance = getSocketInstance;
