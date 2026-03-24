"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
    let error = {
        name: err.name,
        message: err.message,
        statusCode: err.statusCode || 500,
        code: err.code,
    };
    error.message = err.message;
    // Log to console for dev
    if (process.env.NODE_ENV === 'development') {
        console.error(err);
    }
    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        error.message = 'Resource not found';
        error.statusCode = 404;
    }
    // Mongoose duplicate key
    if (err.code === 11000) {
        error.message = 'Duplicate field value entered';
        error.statusCode = 400;
    }
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        error.message = Object.values(err).map((val) => val.message).join(', ');
        error.statusCode = 400;
    }
    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Server Error'
    });
};
exports.errorHandler = errorHandler;
