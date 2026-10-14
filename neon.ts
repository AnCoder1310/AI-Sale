import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  preview: {
    buckets: {
      "p043-vinfast-documents": { access: "private" },
    },
  },
});
