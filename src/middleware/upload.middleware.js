const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { UPLOAD } = require('../config/constants');
const { BadRequestError } = require('../utils/errors');

const memoryStorage = multer.memoryStorage();

const imageFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!UPLOAD.ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new BadRequestError(`Invalid file type. Allowed: ${UPLOAD.ALLOWED_EXTENSIONS.join(', ')}`), false);
  }

  if (!UPLOAD.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return cb(new BadRequestError(`Invalid mime type. Allowed: ${UPLOAD.ALLOWED_IMAGE_TYPES.join(', ')}`), false);
  }

  cb(null, true);
};

const documentFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!UPLOAD.ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)) {
    return cb(new BadRequestError(`Invalid file type. Allowed: ${UPLOAD.ALLOWED_DOCUMENT_EXTENSIONS.join(', ')}`), false);
  }

  if (!UPLOAD.ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
    return cb(new BadRequestError(`Invalid mime type. Allowed: ${UPLOAD.ALLOWED_DOCUMENT_TYPES.join(', ')}`), false);
  }

  cb(null, true);
};

const proofFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!UPLOAD.ALLOWED_PROOF_EXTENSIONS.includes(ext)) {
    return cb(new BadRequestError(`Invalid file type. Allowed: ${UPLOAD.ALLOWED_PROOF_EXTENSIONS.join(', ')}`), false);
  }

  if (!UPLOAD.ALLOWED_PROOF_TYPES.includes(file.mimetype)) {
    return cb(new BadRequestError(`Invalid mime type. Allowed: ${UPLOAD.ALLOWED_PROOF_TYPES.join(', ')}`), false);
  }

  cb(null, true);
};

const generateFilename = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const uniqueId = crypto.randomUUID();
  const timestamp = Date.now();
  return `${timestamp}-${uniqueId}${ext}`;
};

const uploadSingleImage = (fieldName = 'image') => {
  const upload = multer({
    storage: memoryStorage,
    limits: {
      fileSize: UPLOAD.MAX_FILE_SIZE,
      files: 1
    },
    fileFilter: imageFileFilter
  });
  return upload.single(fieldName);
};

const uploadDocument = (fieldName = 'file') => {
  const upload = multer({
    storage: memoryStorage,
    limits: {
      fileSize: UPLOAD.MAX_DOCUMENT_SIZE,
      files: 1
    },
    fileFilter: documentFileFilter
  });
  return upload.single(fieldName);
};

const uploadPaymentProof = (fieldName = 'payment_proof') => {
  const upload = multer({
    storage: memoryStorage,
    limits: {
      fileSize: UPLOAD.MAX_PROOF_SIZE,
      files: 1
    },
    fileFilter: proofFileFilter
  });
  return upload.single(fieldName);
};

const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new BadRequestError(`File too large. Maximum size: ${UPLOAD.MAX_FILE_SIZE / (1024 * 1024)}MB`));
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return next(new BadRequestError(`Too many files. Maximum: ${UPLOAD.MAX_FILES}`));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new BadRequestError('Unexpected file field'));
    }
    return next(new BadRequestError(err.message));
  }
  next(err);
};

module.exports = {
  uploadSingleImage,
  uploadDocument,
  uploadPaymentProof,
  handleUploadError,
  generateFilename
};
