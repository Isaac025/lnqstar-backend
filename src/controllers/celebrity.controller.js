const Celebrity = require("../models/Celebrity.model");
const ApiResponse = require("../utils/apiResponse");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicId,
} = require("../middlewares/upload.middleware");

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/celebrities
// @desc    List all celebrities — filter by category, search, featured, available
// @access  Public
// ─────────────────────────────────────────────────────────────────────────
exports.getCelebrities = async (req, res) => {
  try {
    const {
      category,
      search,
      featured,
      available,
      minFee,
      maxFee,
      sort = "createdAt",
      order = "desc",
      page = 1,
      limit = 12,
    } = req.query;

    const filter = {};

    // Category filter (matches user interests)
    if (category) filter.category = category;

    // Availability filter
    if (available !== undefined) filter.available = available === "true";

    // Featured filter
    if (featured !== undefined) filter.featured = featured === "true";

    // Fee range filter
    if (minFee || maxFee) {
      filter.baseBookingFee = {};
      if (minFee) filter.baseBookingFee.$gte = Number(minFee);
      if (maxFee) filter.baseBookingFee.$lte = Number(maxFee);
    }

    // Full-text search (name, bio, tags)
    if (search) {
      filter.$text = { $search: search };
    }

    // Sort options
    const sortMap = {
      createdAt: { createdAt: order === "asc" ? 1 : -1 },
      name: { name: order === "asc" ? 1 : -1 },
      baseBookingFee: { baseBookingFee: order === "asc" ? 1 : -1 },
      totalBookings: { totalBookings: order === "asc" ? 1 : -1 },
    };
    const sortObj = sortMap[sort] || sortMap.createdAt;

    const skip = (Number(page) - 1) * Number(limit);

    const [celebrities, total] = await Promise.all([
      Celebrity.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit))
        .select("-gallery -createdBy"), // exclude heavy fields from list view
      Celebrity.countDocuments(filter),
    ]);

    return ApiResponse.success(
      res,
      {
        celebrities,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      "Celebrities fetched successfully.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/celebrities/featured
// @desc    Get featured celebrities (homepage spotlight)
// @access  Public
// ─────────────────────────────────────────────────────────────────────────
exports.getFeaturedCelebrities = async (req, res) => {
  try {
    const celebrities = await Celebrity.find({
      featured: true,
      available: true,
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("-gallery -createdBy");

    return ApiResponse.success(
      res,
      celebrities,
      "Featured celebrities fetched.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/celebrities/categories
// @desc    Get all categories with celebrity counts
// @access  Public
// ─────────────────────────────────────────────────────────────────────────
exports.getCategories = async (req, res) => {
  try {
    const counts = await Celebrity.aggregate([
      { $match: { available: true } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const categories = counts.map((c) => ({ category: c._id, count: c.count }));

    return ApiResponse.success(res, categories, "Categories fetched.");
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/celebrities/recommended
// @desc    Get celebrities matching the logged-in user's interests
// @access  Private
// ─────────────────────────────────────────────────────────────────────────
exports.getRecommended = async (req, res) => {
  try {
    const userInterests = req.user?.interests || [];

    const filter = { available: true };
    if (userInterests.length > 0) filter.category = { $in: userInterests };

    const celebrities = await Celebrity.find(filter)
      .sort({ featured: -1, totalBookings: -1 })
      .limit(12)
      .select("-gallery -createdBy");

    return ApiResponse.success(
      res,
      celebrities,
      "Recommended celebrities fetched.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   GET /api/celebrities/:id
// @desc    Get single celebrity by ID or slug (full detail with gallery)
// @access  Public
// ─────────────────────────────────────────────────────────────────────────
exports.getCelebrity = async (req, res) => {
  try {
    const { id } = req.params;

    // Support both MongoDB _id and slug
    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { slug: id };

    const celebrity = await Celebrity.findOne(query);
    if (!celebrity) return ApiResponse.notFound(res, "Celebrity not found.");

    return ApiResponse.success(
      res,
      celebrity,
      "Celebrity fetched successfully.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   POST /api/celebrities  (Admin)
// @desc    Create a new celebrity
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────
exports.createCelebrity = async (req, res) => {
  try {
    if (!req.file) {
      return ApiResponse.error(res, "A profile picture is required.");
    }

    // Upload main picture to Cloudinary
    const result = await uploadToCloudinary(
      req.file.buffer,
      "lynqstar/celebrities",
      `celeb_${Date.now()}`,
    );

    const {
      name,
      bio,
      category,
      nationality,
      tags,
      baseBookingFee,
      serviceFee,
      fanCardPrice,
      donationsEnabled,
      featured,
      socialLinks,
    } = req.body;

    const celebrity = await Celebrity.create({
      name,
      bio,
      category,
      nationality,
      tags: (() => {
        if (!tags) return [];
        if (Array.isArray(tags)) return tags;

        if (typeof tags === "string") {
          const trimmed = tags.trim();
          if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
              return JSON.parse(trimmed);
            } catch (e) {}
          }
          // Comma separated fallback
          return trimmed
            .split(",")
            .map((t) => t.trim().replace(/^["']|["']$/g, ""))
            .filter(Boolean);
        }
        return [];
      })(),
      baseBookingFee: Number(baseBookingFee),
      serviceFee: Number(serviceFee),
      fanCardPrice: fanCardPrice ? Number(fanCardPrice) : 0,
      donationsEnabled: donationsEnabled === "true",
      featured: featured === "true",
      socialLinks: socialLinks ? JSON.parse(socialLinks) : {},
      picture: result.secure_url,
      createdBy: req.user._id,
    });

    return ApiResponse.created(
      res,
      celebrity,
      "Celebrity created successfully.",
    );
  } catch (error) {
    if (error.code === 11000) {
      return ApiResponse.error(
        res,
        "A celebrity with this name already exists.",
        409,
      );
    }
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   PUT /api/celebrities/:id  (Admin)
// @desc    Update celebrity details
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────
exports.updateCelebrity = async (req, res) => {
  try {
    const celebrity = await Celebrity.findById(req.params.id);
    if (!celebrity) return ApiResponse.notFound(res, "Celebrity not found.");

    const {
      name,
      bio,
      category,
      nationality,
      tags,
      baseBookingFee,
      serviceFee,
      fanCardPrice,
      donationsEnabled,
      available,
      featured,
      socialLinks,
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (category !== undefined) updates.category = category;
    if (nationality !== undefined) updates.nationality = nationality;
    if (tags !== undefined) updates.tags = JSON.parse(tags);
    if (baseBookingFee !== undefined)
      updates.baseBookingFee = Number(baseBookingFee);
    if (serviceFee !== undefined) updates.serviceFee = Number(serviceFee);
    if (fanCardPrice !== undefined) updates.fanCardPrice = Number(fanCardPrice);
    if (donationsEnabled !== undefined)
      updates.donationsEnabled =
        donationsEnabled === "true" || donationsEnabled === true;
    if (available !== undefined)
      updates.available = available === "true" || available === true;
    if (featured !== undefined)
      updates.featured = featured === "true" || featured === true;
    if (socialLinks !== undefined)
      updates.socialLinks =
        typeof socialLinks === "string" ? JSON.parse(socialLinks) : socialLinks;

    // If a new picture is uploaded, swap it out
    if (req.file) {
      const oldPublicId = extractPublicId(celebrity.picture);
      await deleteFromCloudinary(oldPublicId);

      const result = await uploadToCloudinary(
        req.file.buffer,
        "lynqstar/celebrities",
        `celeb_${celebrity._id}`,
      );
      updates.picture = result.secure_url;
    }

    const updated = await Celebrity.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true },
    );

    return ApiResponse.success(res, updated, "Celebrity updated successfully.");
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   POST /api/celebrities/:id/gallery  (Admin)
// @desc    Add images to celebrity gallery (up to 6 images)
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────
exports.addGalleryImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return ApiResponse.error(res, "Please upload at least one image.");
    }

    const celebrity = await Celebrity.findById(req.params.id);
    if (!celebrity) return ApiResponse.notFound(res, "Celebrity not found.");

    const remaining = 6 - celebrity.gallery.length;
    if (remaining <= 0) {
      return ApiResponse.error(
        res,
        "Gallery is full. Maximum 6 images allowed. Delete some to add more.",
      );
    }

    const filesToUpload = req.files.slice(0, remaining);

    const uploadPromises = filesToUpload.map((file, i) =>
      uploadToCloudinary(
        file.buffer,
        "lynqstar/celebrities/gallery",
        `celeb_${celebrity._id}_gallery_${Date.now()}_${i}`,
      ),
    );

    const results = await Promise.all(uploadPromises);
    const newUrls = results.map((r) => r.secure_url);

    celebrity.gallery.push(...newUrls);
    await celebrity.save({ validateBeforeSave: false });

    return ApiResponse.success(
      res,
      { gallery: celebrity.gallery },
      "Gallery updated successfully.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/celebrities/:id/gallery  (Admin)
// @desc    Remove an image from gallery
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────
exports.removeGalleryImage = async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) return ApiResponse.error(res, "Image URL is required.");

    const celebrity = await Celebrity.findById(req.params.id);
    if (!celebrity) return ApiResponse.notFound(res, "Celebrity not found.");

    // Remove from Cloudinary
    const publicId = extractPublicId(imageUrl);
    await deleteFromCloudinary(publicId);

    // Remove from gallery array
    celebrity.gallery = celebrity.gallery.filter((url) => url !== imageUrl);
    await celebrity.save({ validateBeforeSave: false });

    return ApiResponse.success(
      res,
      { gallery: celebrity.gallery },
      "Image removed from gallery.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/celebrities/:id/toggle-availability  (Admin)
// @desc    Toggle celebrity availability on/off
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────
exports.toggleAvailability = async (req, res) => {
  try {
    const celebrity = await Celebrity.findById(req.params.id);
    if (!celebrity) return ApiResponse.notFound(res, "Celebrity not found.");

    celebrity.available = !celebrity.available;
    await celebrity.save({ validateBeforeSave: false });

    return ApiResponse.success(
      res,
      { available: celebrity.available },
      `Celebrity is now ${celebrity.available ? "available" : "unavailable"} for bookings.`,
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/celebrities/:id  (Admin)
// @desc    Delete a celebrity and their Cloudinary assets
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────
exports.deleteCelebrity = async (req, res) => {
  try {
    const celebrity = await Celebrity.findById(req.params.id);
    if (!celebrity) return ApiResponse.notFound(res, "Celebrity not found.");

    // Delete all Cloudinary images
    const toDelete = [celebrity.picture, ...celebrity.gallery].filter(Boolean);
    await Promise.all(
      toDelete.map((url) => deleteFromCloudinary(extractPublicId(url))),
    );

    await celebrity.deleteOne();

    return ApiResponse.success(res, null, "Celebrity deleted successfully.");
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};
