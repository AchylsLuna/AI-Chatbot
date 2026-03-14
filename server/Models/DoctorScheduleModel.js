import mongoose from 'mongoose'

const DaySessionSchema = new mongoose.Schema(
  {
    morning: { type: Boolean, default: false },
    afternoon: { type: Boolean, default: false },
  },
  { _id: false }
)

const DoctorScheduleSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    weekStart: {
      type: Date,
      required: true,
    },
    timezone: {
      type: String,
      default: 'Asia/Manila',
      trim: true,
    },
    days: {
      monday: { type: DaySessionSchema, default: () => ({}) },
      tuesday: { type: DaySessionSchema, default: () => ({}) },
      wednesday: { type: DaySessionSchema, default: () => ({}) },
      thursday: { type: DaySessionSchema, default: () => ({}) },
      friday: { type: DaySessionSchema, default: () => ({}) },
      saturday: { type: DaySessionSchema, default: () => ({}) },
      sunday: { type: DaySessionSchema, default: () => ({}) },
    },
  },
  {
    timestamps: true,
  }
)

DoctorScheduleSchema.index({ doctor: 1, weekStart: 1 }, { unique: true })

export default mongoose.model('DoctorSchedule', DoctorScheduleSchema)
