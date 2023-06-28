import Joi from 'joi';

export const loginTokenUsernameValidation = Joi.object({
  username: Joi.string()
      .regex(/^[\p{L}.]+( [\p{L}.]+)*$/u)
      .min(1)
      .max(30)      
      .required(),
  code: Joi.string()
      .alphanum()
      .min(1)
      .max(10)
      .required()
})
