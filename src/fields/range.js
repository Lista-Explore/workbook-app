import { makeSimpleInputField } from "./simple-input-factory.js";

export const range = makeSimpleInputField("range", {
  validate: () => true, // a range input always has a value; nothing to require
});
