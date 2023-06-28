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

const talkIdString = Joi.string()
  .regex(/^[a-z0-9-]+$/)
  .min(1)
  .max(250)

const messageString = Joi.string()
  .max(1000)  // in client, only 500 allowed, but emojis are usually counted as 2

const ratingNumber = Joi.number()
  .min(1)
  .max(5)

export const loginTokenUsernameValidation = Joi.object({
  username: usernameString.required(),
  code: loginTokenString.required()
})

export const talkRatingValidation = Joi.object({
  talkId: talkIdString.required(),
  rating: ratingNumber,
  comment: messageString
})
