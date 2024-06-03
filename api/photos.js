/*
 * API sub-router for businesses collection endpoints.
 */

const { Router, static } = require("express");
const express = require("express");
const { validateAgainstSchema } = require("../lib/validation");
const {
  PhotoSchema,
  insertNewPhoto,
  getPhotoById,
  saveNewPhoto,
  getImageDownloadStreamByFilename,
} = require("../models/photo");
const crypto = require("node:crypto");

const imageTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
};

const multer = require("multer");
const { getChannel } = require("../lib/rabbitmq");

const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, callback) => {
      const filename = crypto.pseudoRandomBytes(16).toString("hex");
      const extenstion = imageTypes[file.mimetype];
      callback(null, `${filename}.${extenstion}`);
    },
  }),
  fileFilter: (req, file, callback) => {
    callback(null, !!imageTypes[file.mimetype]);
  },
});

const router = Router();

router.post("/new", upload.single("photo"), async (req, res, next) => {
  console.log(req.file);
  console.log(req.body);
  if (req.file && req.body && req.body.userId) {
    const photo = {
      contentType: req.file.mimetype,
      filename: req.file.filename,
      path: req.file.path,
      userId: req.body.userId,
      businessId: req.body.businessId,
      caption: req.body.businessId,
    };

    try {
      const id = await saveNewPhoto(photo);
      const channel = getChannel();
      channel.sendToQueue("photos", Buffer.from(id.toString()));
      // await fs.unlink(req.file.path);
      res.status(200).send({
        id: id,
      });
    } catch (err) {
      next(err);
    }
  } else {
    res.status(400).send({
      err: "Invalid file",
    });
  }
});
/*
 * POST /photos - Route to create a new photo.
 */
router.post("/", async (req, res) => {
  if (validateAgainstSchema(req.body, PhotoSchema)) {
    try {
      const id = await insertNewPhoto(req.body);
      res.status(201).send({
        id: id,
      });
    } catch (err) {
      next(err);
    }
  } else {
    res.status(400).send({
      error: "Request body is not a valid photo object",
    });
  }
});

/*
 * GET /photos/{id} - Route to fetch info about a specific photo.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const photo = await getPhotoById(req.params.id);
    // console.log("🚀 ~ file: photos.js:84 ~ router.get ~ req.params.id:", req.params.id)
    if (photo) {
      delete photo.path;

      const resBody = {
        id: photo._id,
        filename: photo.filename,
        contentType: photo.metadata.contentType,
        userId: photo.metadata.userId,
        tags: photo.metadata.tags,
        url: `/media/photos/${photo.filename}`,
        thumbURL: `/media/thumbs/${photo.filename}`,
      };

      res.status(200).send(resBody);
    } else {
      next();
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
