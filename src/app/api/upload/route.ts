import { NextResponse, type NextRequest } from 'next/server';
import { v2 as cloudinaryApi, type UploadApiResponse, type UploadApiErrorResponse } from 'cloudinary';

// Configure Cloudinary using the aliased import
cloudinaryApi.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const userId = formData.get('userId') as string | null; // Get userId from formData

  if (!userId) {
      // This means the client didn't send it or it was removed.
      // console.log("API Upload: Unauthorized - userId not found in form data.");
      return NextResponse.json({ error: 'Unauthorized: User identification missing.' }, { status: 401 });
  }
  // console.log(`API Upload: User ${userId} attempting to upload via form data.`);


  if (!file) {
    return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
  const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

  if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: `File size exceeds limit of ${MAX_FILE_SIZE_MB / (1024*1024)}MB.` }, { status: 413 });
  }
   if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPG, PNG, WEBP, GIF allowed.' }, { status: 415 });
  }


  try {
    // console.log(`API Upload: Uploading file for user ${userId}. File: ${file.name}, Type: ${file.type}, Size: ${file.size}`);
    const uploadResult = await new Promise<UploadApiResponse | undefined>((resolve, reject) => {
      cloudinaryApi.uploader.upload_stream(
        {
          folder: `server_assets/${userId}`, 
          resource_type: 'image',
        },
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => { // Added type for error
          if (error) {
            // console.error('Cloudinary stream upload error:', error);
            reject(error);
          } else {
            // console.log('Cloudinary stream upload success:', result);
            resolve(result);
          }
        }
      ).end(buffer);
    });

    if (!uploadResult || !uploadResult.secure_url) {
      // console.error('Cloudinary upload failed, no result or secure_url returned.', uploadResult);
      throw new Error('Cloudinary upload failed, no result or secure_url returned.');
    }
    
    // console.log(`API Upload: Successfully uploaded file. URL: ${uploadResult.secure_url}`);
    return NextResponse.json({ url: uploadResult.secure_url }, { status: 200 });

  } catch (error) {
    console.error('Error uploading to Cloudinary (API Route):', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload image.';
    return NextResponse.json({ error: `Upload failed: ${errorMessage}` }, { status: 500 });
  }
}
