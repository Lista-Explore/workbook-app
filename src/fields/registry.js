const registry = new Map();

/**
 * A field module implements:
 *   render(field, value) -> HTMLElement   (the whole field wrapper, including label)
 *   getValue(el) -> any                   (el is the wrapper returned by render)
 *   setValue(el, value) -> void
 *   validate(field, value) -> true | string (error message)
 */
export const FieldRegistry = {
  register(type, module) {
    registry.set(type, module);
  },
  get(type) {
    const module = registry.get(type);
    if (!module) {
      throw new Error(`Unknown field type: ${type}`);
    }
    return module;
  },
  has(type) {
    return registry.has(type);
  },
  types() {
    return [...registry.keys()];
  },
};
