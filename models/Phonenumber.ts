import { Schema, models, model, type InferSchemaType } from "mongoose";

const PhoneNumberSchema = new Schema({
  // Normalized to 8801XXXXXXXXX before it ever reaches this model.
  number: {
    type: String,
    required: true,
    unique: true,
    match: /^8801\d{9}$/,
  },
  date: {
    type: String, // "YYYY-MM-DD"
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export type PhoneNumberDoc = InferSchemaType<typeof PhoneNumberSchema>;

// `models.PhoneNumber ||` avoids Mongoose's "Cannot overwrite model" error
// when this module gets re-evaluated on every hot reload in dev.
export default models.PhoneNumber || model("PhoneNumber", PhoneNumberSchema);
