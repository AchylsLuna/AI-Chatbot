import nodemailer from 'nodemailer'
import { appConfig } from '../Config/env.js'

const emailUser = String(process.env.EMAIL_USER || '').trim()
const emailPass = String(process.env.EMAIL_PASS || '').trim()
const emailFrom = String(
  process.env.EMAIL_FROM || process.env.EMAIL_HOST || 'no-reply@aihealthcare.local'
).trim()

const hasConfiguredTransport = Boolean(emailUser) && Boolean(emailPass)

const transporter = hasConfiguredTransport
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    })
  : null

export const sendOTP = async (email, otp) => {
  if (!transporter) {
    if (!appConfig.isProduction) {
      console.warn(`[otp] Email transport is not configured. Demo OTP for ${email}: ${otp}`)
      return { delivered: false, preview: otp }
    }

    throw new Error('OTP email transport is not configured.')
  }

  try {
    await transporter.sendMail({
      from: emailFrom,
      to: email,
      subject: 'Your Login Code',
      text: `Your OTP for login is: ${otp}. It expires in 10 minutes.`,
    })
    return { delivered: true, preview: undefined }
  } catch (error) {
    if (appConfig.isProduction) {
      throw error
    }

    console.warn(`[otp] Failed to send OTP email. Falling back to demo OTP for ${email}.`, error)
    return { delivered: false, preview: otp }
  }
}
