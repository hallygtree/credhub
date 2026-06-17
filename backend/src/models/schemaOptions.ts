/**
 * Shared toJSON transform that normalizes _id -> id and removes __v.
 * Optionally redacts additional fields (e.g. 'password').
 */
export function toJSONTransform(redactFields: string[] = []) {
  return {
    transform(_: unknown, ret: Record<string, unknown>) {
      ret.id = ret._id;
      ret._id = undefined;
      ret.__v = undefined;
      for (const field of redactFields) {
        ret[field] = undefined;
      }
      return ret;
    },
  };
}
