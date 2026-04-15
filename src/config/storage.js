const storageBuckets = {
  products: {
    name: 'products',
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxFileSize: 2 * 1024 * 1024 // 2MB
  },
  paymentProofs: {
    name: 'payment-proofs',
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxFileSize: 10 * 1024 * 1024 // 10MB
  },
  waybills: {
    name: 'waybills',
    public: true,
    allowedMimeTypes: ['application/pdf'],
    maxFileSize: 5 * 1024 * 1024 // 5MB
  },
  imports: {
    name: 'imports',
    public: false,
    allowedMimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ],
    maxFileSize: 10 * 1024 * 1024 // 10MB
  }
};

const getPublicUrl = (bucket, path) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
};

module.exports = {
  storageBuckets,
  getPublicUrl
};
