const User = require("../models/User.model");
const ApiResponse = require("../utils/apiResponse");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicId,
} = require("../middlewares/upload.middleware");

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/users/profile
// @desc    Get current user's full profile
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return ApiResponse.notFound(res, "User not found.");

    return ApiResponse.success(
      res,
      user.toSafeObject(),
      "Profile fetched successfully.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   PUT /api/users/profile
// @desc    Update profile details (name, username, phone, country, interests, etc.)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const {
      fullName,
      username,
      phone,
      country,
      address,
      interests,
      notificationPreferences,
    } = req.body;

    // Check username uniqueness if being changed
    if (username && username !== req.user.username) {
      const taken = await User.findOne({ username: username.toLowerCase() });
      if (taken) {
        return ApiResponse.error(res, "This username is already taken.", 409);
      }
    }

    // Build update object (only include provided fields)
    const updates = {};
    if (fullName) updates.fullName = fullName;
    if (username) updates.username = username.toLowerCase();
    if (phone) updates.phone = phone;
    if (country) updates.country = country;
    if (address !== undefined) updates.address = address;
    if (interests) updates.interests = interests;
    if (notificationPreferences) {
      updates.notificationPreferences = {
        ...req.user.notificationPreferences,
        ...notificationPreferences,
      };
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true },
    );

    return ApiResponse.success(
      res,
      user.toSafeObject(),
      "Profile updated successfully.",
    );
  } catch (error) {
    if (error.code === 11000) {
      return ApiResponse.error(
        res,
        "Username or email is already in use.",
        409,
      );
    }
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   PUT /api/users/profile/picture
// @desc    Upload / update profile picture
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.updateProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return ApiResponse.error(res, "Please upload an image file.");
    }

    const user = await User.findById(req.user._id);

    // Delete old picture from Cloudinary if exists
    if (user.profilePicture) {
      const oldPublicId = extractPublicId(user.profilePicture);
      await deleteFromCloudinary(oldPublicId);
    }

    // Upload new picture
    const result = await uploadToCloudinary(
      req.file.buffer,
      "lynqstar/users",
      `user_${user._id}`,
    );

    user.profilePicture = result.secure_url;
    await user.save({ validateBeforeSave: false });

    return ApiResponse.success(
      res,
      {
        profilePicture: result.secure_url,
      },
      "Profile picture updated successfully.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/users/profile/picture
// @desc    Remove profile picture
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.removeProfilePicture = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.profilePicture) {
      return ApiResponse.error(res, "No profile picture to remove.");
    }

    const publicId = extractPublicId(user.profilePicture);
    await deleteFromCloudinary(publicId);

    user.profilePicture = null;
    await user.save({ validateBeforeSave: false });

    return ApiResponse.success(res, null, "Profile picture removed.");
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   PUT /api/users/profile/address
// @desc    Add or update delivery/billing address
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.updateAddress = async (req, res) => {
  try {
    const { address } = req.body;

    if (!address || !address.trim()) {
      return ApiResponse.error(res, "Address cannot be empty.");
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { address: address.trim() } },
      { new: true },
    );

    return ApiResponse.success(
      res,
      { address: user.address },
      "Address updated successfully.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/users/account
// @desc    Get account information summary (member since, status, total bookings, last activity)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.getAccountInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    const accountInfo = {
      memberSince: user.createdAt,
      accountStatus: user.accountStatus,
      totalBookings: user.totalBookings,
      lastActivity: user.lastActivity,
      isEmailVerified: user.isEmailVerified,
      role: user.role,
    };

    return ApiResponse.success(
      res,
      accountInfo,
      "Account info fetched successfully.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   PUT /api/users/notifications
// @desc    Update notification preferences
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.updateNotificationPreferences = async (req, res) => {
  try {
    const { exclusiveEvents, platformUpdates } = req.body;

    const updates = {};
    if (exclusiveEvents !== undefined)
      updates["notificationPreferences.exclusiveEvents"] = exclusiveEvents;
    if (platformUpdates !== undefined)
      updates["notificationPreferences.platformUpdates"] = platformUpdates;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true },
    );

    return ApiResponse.success(
      res,
      user.notificationPreferences,
      "Notification preferences updated.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/users/account
// @desc    Deactivate account (soft delete)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.deactivateAccount = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return ApiResponse.error(
        res,
        "Please provide your password to confirm account deactivation.",
      );
    }

    const user = await User.findById(req.user._id).select("+password");
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return ApiResponse.error(res, "Incorrect password.", 401);
    }

    user.accountStatus = "deactivated";
    user.refreshToken = null;
    await user.save({ validateBeforeSave: false });

    // Clear cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    return ApiResponse.success(
      res,
      null,
      "Your account has been deactivated. We're sorry to see you go.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/users/:id  (Admin only)
// @desc    Get any user by ID
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return ApiResponse.notFound(res, "User not found.");
    return ApiResponse.success(res, user.toSafeObject());
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/users  (Admin only)
// @desc    Get all users with pagination
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.accountStatus = req.query.status;
    if (req.query.country) filter.country = req.query.country;

    const [users, total] = await Promise.all([
      User.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);

    return ApiResponse.success(res, {
      users: users.map((u) => u.toSafeObject()),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/users/:id/status  (Admin only)
// @desc    Suspend or reactivate a user
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────
exports.updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["active", "suspended", "deactivated"];

    if (!allowed.includes(status)) {
      return ApiResponse.error(
        res,
        `Status must be one of: ${allowed.join(", ")}`,
      );
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { accountStatus: status } },
      { new: true },
    );

    if (!user) return ApiResponse.notFound(res, "User not found.");

    return ApiResponse.success(
      res,
      { accountStatus: user.accountStatus },
      `User status updated to ${status}.`,
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};
