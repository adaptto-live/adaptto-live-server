import Joi from 'joi';

const usernameString = Joi.string()
  .regex(/^[\p{L}.\-0-9]+( [\p{L}.\-0-9]+)*$/u)
  .min(1)
  .max(30)
  .required()

const loginTokenString = Joi.string()
  .alphanum()
  .min(1)
  .max(10)

const messageString = Joi.string()
  .max(1000)  // in client, only 500 allowed, but emojis are usually counted as 2

const ratingNumber = Joi.number()
  .min(1)
  .max(5)

export const talkIdString = Joi.string()
  .regex(/^[a-z0-9-]+$/)
  .min(1)
  .max(250)

export const uuidString = Joi.string()
  .uuid()

export const loginTokenUsernameObject = Joi.object({
  username: usernameString.required(),
  code: loginTokenString.required()
})

export const talkRatingObject = Joi.object({
  talkId: talkIdString.required(),
  rating: ratingNumber,
  comment: messageString
})

export const messageToServerObject = Joi.object({
  id: uuidString.required(),
  talkId: talkIdString.required(),
  text: messageString.required()
})

export const qaEntryToServerObject = Joi.object({
  id: uuidString.required(),
  talkId: talkIdString.required(),
  text: messageString.required(),
  anonymous: Joi.bool(),
  replyTo: talkIdString
})

export const userObject = Joi.object({
  id: uuidString.required(),
  username: usernameString.required(),
  admin: Joi.bool(),
  blocked: Joi.bool()
})
