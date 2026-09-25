const num = (v: string | undefined, d: number) => (v !== undefined && v !== '' ? Number(v) : d);

export const config = {
  port: num(process.env.PORT, 4000),
  dbFile: process.env.DB_FILE ?? 'movigo-local.db',
  jwtSecret: process.env.JWT_SECRET ?? 'movigo-local-demo-secret',

  // DEMO ONLY: every phone number logs in with this OTP and no SMS is sent.
  // Replace DemoOtpService in services/otp.ts before going live.
  demoOtp: process.env.DEMO_OTP ?? '1234',

  // How long a store has to accept an order before it is auto-cancelled.
  storeResponseSeconds: num(process.env.STORE_RESPONSE_SECONDS, 120),

  // Pricing (rupees)
  deliveryFee: 30,
  freeDeliveryAbove: 999,
  platformFee: 5,
  deliverySlaMinutes: 30,

  // Mock driver speed-up: 1 = realistic timings, 10 = ten times faster for demos.
  demoSpeed: num(process.env.DEMO_SPEED, 6),

  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5180,http://localhost:3000').split(','),
};
