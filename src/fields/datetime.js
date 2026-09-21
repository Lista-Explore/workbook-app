import { makeSimpleInputField } from "./simple-input-factory.js";

// Designer-facing type "datetime" maps to the native <input type="datetime-local">.
export const datetime = makeSimpleInputField("datetime-local");
