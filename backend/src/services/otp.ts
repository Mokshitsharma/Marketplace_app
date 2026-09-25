import { config } from '../config.js';

export interface OtpService {
  send(phone: string): Promise<void>;
  verify(phone: string, code: string): Promise<boolean>;
}

/**
 * DEMO ONLY. No SMS is sent; every phone number accepts the fixed OTP from
 * config.demoOtp (1234). Swap for an MSG91/Twilio-backed implementation before
 * any real user touches this.
 */
export class DemoOtpService implements OtpService {
  async send(phone: string) {
    console.log(`[otp] demo OTP for ${phone} is ${config.demoOtp}`);
  }
  async verify(_phone: string, code: string) {
    return code === config.demoOtp;
  }
}

export const otpService: OtpService = new DemoOtpService();
