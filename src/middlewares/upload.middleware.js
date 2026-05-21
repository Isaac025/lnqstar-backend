const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const ApiResponse = require("../utils/apiResponse");

// ── Multer: store in memory before sending to Cloudinary ──────────────────
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, and WebP images are allowed."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// ── Upload a buffer directly to Cloudinary ────────────────────────────────
const uploadToCloudinary = (buffer, folder, publicId) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        overwrite: true,
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    stream.end(buffer);
  });
};

// ── Delete an image from Cloudinary ──────────────────────────────────────
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary delete error:", err.message);
  }
};

// ── Extract public_id from a Cloudinary URL ───────────────────────────────
const extractPublicId = (url) => {
  if (!url) return null;
  // e.g. https://res.cloudinary.com/xxx/image/upload/v123/lynqstar/users/abc123.jpg
  const parts = url.split("/");
  const file = parts[parts.length - 1].split(".")[0];
  const folder = parts[parts.length - 2];
  return `${folder}/${file}`;
};

module.exports = {
  upload,
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicId,
};
