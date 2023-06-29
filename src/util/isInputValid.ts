import { AnySchema } from "joi";
import { OperationResult } from "../socket/socket.types";

/**
 * Validates object input
 * @param validator Joi object schema validator
 * @param obj Object to validate
 * @param callback Callback will be called with error message when object is invalid
 * @returns true if object is valid
 */
export default function isInputValid<Type>(validator: AnySchema<Type>,
    obj: Type, callback: (result: OperationResult) => void) : boolean {
  const { error } = validator.validate(obj)
  if (error) {
    callback({success:false, error:error.message})
    return false
  }
  return true
}
