const Booking = require("../models/Booking.model");
const Celebrity = require("../models/Celebrity.model");
const User = require("../models/User.model");
const ApiResponse = require("../utils/apiResponse");
const { notify } = require("../services/notification.service");

// POST /api/bookings — Create booking
exports.createBooking = async (req, res) => {
  try {
    const {
      celebrity: celebrityId,
      eventType,
      eventLocation,
      eventDate,
      eventTime,
      duration,
      fullName,
      email,
      phone,
      gender,
      specialRequest,
    } = req.body;

    const celebrity = await Celebrity.findById(celebrityId);
    if (!celebrity) return ApiResponse.notFound(res, "Celebrity not found.");
    if (!celebrity.available)
      return ApiResponse.error(
        res,
        "This celebrity is currently unavailable for bookings.",
        400,
      );

    const baseBookingFee = celebrity.baseBookingFee;
    const serviceFee = celebrity.serviceFee;
    const totalAmount = baseBookingFee + serviceFee;

    const booking = await Booking.create({
      user: req.user._id,
      celebrity: celebrity._id,
      eventType,
      eventLocation,
      eventDate: new Date(eventDate),
      eventTime,
      duration,
      fullName,
      email,
      phone,
      gender,
      specialRequest: specialRequest || null,
      baseBookingFee,
      serviceFee,
      totalAmount,
      currency: celebrity.currency || "USD",
    });

    await Celebrity.findByIdAndUpdate(celebrityId, {
      $inc: { totalBookings: 1 },
    });
    await User.findByIdAndUpdate(req.user._id, { $inc: { totalBookings: 1 } });
    await notify.bookingCreated(req.app, req.user._id, booking);

    const populated = await Booking.findById(booking._id).populate(
      "celebrity",
      "name picture category baseBookingFee serviceFee",
    );

    return ApiResponse.created(
      res,
      populated,
      "Booking created. Please proceed to payment.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// GET /api/bookings/my — My bookings with tab filter
exports.getMyBookings = async (req, res) => {
  try {
    const { tab = "all", page = 1, limit = 10 } = req.query;
    const now = new Date();
    const skip = (Number(page) - 1) * Number(limit);
    const base = { user: req.user._id };

    let filter;
    switch (tab) {
      case "upcoming":
        filter = {
          ...base,
          status: { $in: ["pending", "confirmed"] },
          eventDate: { $gte: now },
        };
        break;
      case "past":
        filter = {
          ...base,
          eventDate: { $lt: now },
          status: { $ne: "cancelled" },
        };
        break;
      case "cancelled":
        filter = { ...base, status: "cancelled" };
        break;
      default:
        filter = base;
    }

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate("celebrity", "name picture category")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Booking.countDocuments(filter),
    ]);

    const [allC, upcomingC, pastC, cancelledC] = await Promise.all([
      Booking.countDocuments({ user: req.user._id }),
      Booking.countDocuments({
        user: req.user._id,
        status: { $in: ["pending", "confirmed"] },
        eventDate: { $gte: now },
      }),
      Booking.countDocuments({
        user: req.user._id,
        eventDate: { $lt: now },
        status: { $ne: "cancelled" },
      }),
      Booking.countDocuments({ user: req.user._id, status: "cancelled" }),
    ]);

    return ApiResponse.success(
      res,
      {
        bookings,
        counts: {
          all: allC,
          upcoming: upcomingC,
          past: pastC,
          cancelled: cancelledC,
        },
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      "Bookings fetched successfully.",
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// GET /api/bookings/:id — Single booking
exports.getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate(
        "celebrity",
        "name picture category baseBookingFee serviceFee socialLinks",
      )
      .populate("user", "fullName email");
    if (!booking) return ApiResponse.notFound(res, "Booking not found.");

    const isOwner = booking.user._id.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin")
      return ApiResponse.forbidden(res);

    return ApiResponse.success(res, booking);
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// GET /api/bookings/ref/:bookingRef — By reference
exports.getBookingByRef = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      bookingRef: req.params.bookingRef.toUpperCase(),
    }).populate("celebrity", "name picture category");
    if (!booking) return ApiResponse.notFound(res, "Booking not found.");
    const isOwner = booking.user.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin")
      return ApiResponse.forbidden(res);
    return ApiResponse.success(res, booking);
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// PUT /api/bookings/:id/cancel — Cancel booking
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return ApiResponse.notFound(res, "Booking not found.");

    const isOwner = booking.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) return ApiResponse.forbidden(res);
    if (booking.status === "cancelled")
      return ApiResponse.error(res, "Booking is already cancelled.");
    if (booking.status === "completed")
      return ApiResponse.error(res, "Completed bookings cannot be cancelled.");

    if (isOwner && !isAdmin) {
      const hoursUntil =
        (new Date(booking.eventDate) - new Date()) / (1000 * 60 * 60);
      if (hoursUntil < 24)
        return ApiResponse.error(
          res,
          "Bookings cannot be cancelled within 24 hours of the event. Please contact support.",
        );
    }

    booking.status = "cancelled";
    booking.cancelledBy = isAdmin ? "admin" : "user";
    booking.cancellationReason = req.body.reason || null;
    booking.cancelledAt = new Date();
    await booking.save();
    await notify.bookingCancelled(req.app, booking.user, booking);

    return ApiResponse.success(res, booking, "Booking cancelled successfully.");
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// GET /api/bookings — All bookings (Admin)
exports.getAllBookings = async (req, res) => {
  try {
    const {
      status,
      paymentStatus,
      celebrity,
      page = 1,
      limit = 20,
    } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (celebrity) filter.celebrity = celebrity;
    const skip = (Number(page) - 1) * Number(limit);

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate("celebrity", "name picture category")
        .populate("user", "fullName email username")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Booking.countDocuments(filter),
    ]);

    return ApiResponse.success(res, {
      bookings,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};

// PATCH /api/bookings/:id/status — Update status (Admin)
exports.updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["pending", "confirmed", "cancelled", "completed"];
    if (!allowed.includes(status))
      return ApiResponse.error(
        res,
        `Status must be one of: ${allowed.join(", ")}`,
      );

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true },
    );
    if (!booking) return ApiResponse.notFound(res, "Booking not found.");

    if (status === "confirmed")
      await notify.bookingConfirmed(req.app, booking.user, booking);
    if (status === "cancelled")
      await notify.bookingCancelled(req.app, booking.user, booking);

    return ApiResponse.success(
      res,
      booking,
      `Booking status updated to ${status}.`,
    );
  } catch (error) {
    return ApiResponse.serverError(res, error.message);
  }
};
