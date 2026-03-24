import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models/user.model';
import bcrypt from 'bcrypt';
interface IAuthRequest extends Request {
    user?: IUser;
    file?: Express.Multer.File;
}

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { username, email, password, firstName, lastName } = req.body;

        // Create user
        const user = await User.create({
            username,
            email,
            password,
            firstName,
            lastName
        });

        // Create token
        const token = user.getSignedJwtToken();

        res.status(201).json({
            success: true,
            token
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { email, password } = req.body;
console.log(req.body);

        // Validate email & password
        if (!email || !password) {
            res.status(400).json({
                success: false,
                error: 'Please provide an email and password'
            });
            return;
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
            return;
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
            return;
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Create token
        const token = user.getSignedJwtToken();

        res.status(200).json({
            success: true,
            token
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user?._id) {
            res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
            return;
        }

        const user = await User.findById(req.user._id)
        .populate('friendRequests', '_id sender recipient status createdAt')
        .populate('following', ' _id sender recipient status  updatedAt ');
        
       let friendRequestsUSersData = []
       let UserId :any
       if(user?.friendRequests){
       for ( UserId of user?.following){

friendRequestsUSersData.push(UserId?.recipient.toString())
       }
       
    }
        
   const fullUser = await User.find({
  _id: { $in:friendRequestsUSersData  }
},{username:1, firstName:1, lastName:1, email:1, avatar:1, role:1})
 
   



        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: user,
            SentFriendsRequestsUsersData: fullUser
        });
    } catch (error) {
        next(error);
    }
};
export const getFriend = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user?._id) {
            res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
            return;
        }
console.log();

        const user = await User.findById(req.params.friendId, '_id username email avatar posts role firstName lastName bio');

        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Search users by username, name, or email
// @route   GET /api/auth/search?q=term
// @access  Private
export const searchUsers = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user?._id) {
            res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
            return;
        }

        const rawQuery = (req.query.q as string | undefined)?.trim() ?? '';

        if (rawQuery.length < 2) {
            res.status(200).json({
                success: true,
                data: []
            });
            return;
        }

        const escapedQuery = rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const queryRegex = new RegExp(escapedQuery, 'i');

        const users = await User.find(
            {
                _id: { $ne: req.user._id },
                $or: [
                    { username: queryRegex },
                    { firstName: queryRegex },
                    { lastName: queryRegex },
                    { email: queryRegex }
                ]
            },
            '_id username email firstName lastName avatar role'
        )
            .limit(20)
            .sort({ username: 1 });

        res.status(200).json({
            success: true,
            data: users
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
export const updateDetails = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user?._id) {
            res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
            return;
        }


        const existingUser = await User.findOne({ email: req.user.email }).select('+password');
        // Filter out undefined values
        if (!existingUser) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        const isMatch = await existingUser.matchPassword(req.body.password);
        
        if (!isMatch) {
            res.status(401).json({
                success: false,
                error: 'Invalid password'
            });
            return;
        }
        let newHashedPassword: string | undefined;
        if (req.body.newPassword) {
            const salt = await bcrypt.genSalt(10);
            newHashedPassword = await bcrypt.hash(req.body.newPassword, salt);
        }

        const fieldsToUpdate = Object.fromEntries(
            Object.entries({
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                username: req.body.username,
                email: req.body.email,
                password: newHashedPassword,
                bio: req.body.bio
            }).filter(([_, value]) => value !== undefined)
        );


        const user = await User.findByIdAndUpdate(req.user._id, fieldsToUpdate, {
            new: true,
            runValidators: true
        });

        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: "User updated successfully"
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Upload user avatar
// @route   PUT /api/auth/avatar
// @access  Private
export const updateAvatar = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user?._id) {
            res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
            return;
        }

        if (!req.file) {
            res.status(400).json({
                success: false,
                error: 'Please upload an image file'
            });
            return;
        }

        const avatar = `/uploads/avatars/${req.file.filename}`;
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { avatar },
            {
                new: true,
                runValidators: true
            }
        );

        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
};
