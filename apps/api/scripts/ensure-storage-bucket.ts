import { env } from "../src/config/env.js";
import { supabaseStorageAdmin } from "../src/config/supabase-storage.js";

const FILE_SIZE_LIMIT = 25 * 1024 * 1024;

async function main() {
  const bucketName = env.SUPABASE_STORAGE_BUCKET;

  const { data: existing, error: getError } =
    await supabaseStorageAdmin.storage.getBucket(bucketName);

  if (getError && !/not found/i.test(getError.message)) {
    throw getError;
  }

  if (!existing) {
    const { error } =
      await supabaseStorageAdmin.storage.createBucket(
        bucketName,
        {
          public: false,
          fileSizeLimit: FILE_SIZE_LIMIT,
        },
      );

    if (error) throw error;

    console.log(
      `Created private storage bucket "${bucketName}" with 25 MB limit.`,
    );
    return;
  }

  const { error } =
    await supabaseStorageAdmin.storage.updateBucket(
      bucketName,
      {
        public: false,
        fileSizeLimit: FILE_SIZE_LIMIT,
      },
    );

  if (error) throw error;

  console.log(
    `Verified private storage bucket "${bucketName}" with 25 MB limit.`,
  );
}

main().catch((error) => {
  console.error("Storage bucket setup failed.");
  console.error(error);
  process.exitCode = 1;
});
