
import { NextResponse, type NextRequest } from 'next/server';
import { v2 as cloudinaryApi, type UploadApiResponse } from 'cloudinary'; // Updated import
import { auth } from '@/lib/firebase'; // Assuming Firebase auth for user checks

// Configure Cloudinary using the aliased import
cloudinaryApi.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Function to get current user ID (simplified, assumes client sends auth token if needed or relies on server session)
// In a real app, proper auth verification (e.g., checking Firebase ID token) is crucial here.
// For simplicity, we'll assume the user is logged in on the client-side before calling this.
// A more robust way would involve verifying a token sent from the client.
async function getCurrentUserId(): Promise<string | null> {
    // This is a placeholder. In a real app, verify the user's session/token.
    // For now, we return a dummy ID or null if Firebase Auth isn't ready client-side first.
    // return auth?.currentUser?.uid || null; // This won't work reliably server-side without session management
    
    // Placeholder until proper server-side session/token verification is implemented
    // For now, this will prevent uploads unless a user is somehow found by auth.currentUser, 
    // which is unlikely to be set reliably in an API route without session management.
    // A better approach for real-world scenarios would be to pass an ID token from client and verify it here.
    const user = auth?.currentUser;
    if (user) {
        return user.uid;
    }
    // Fallback to a dummy ID for testing if no auth session available server-side.
    // Remove or secure this for production.
    // console.warn("API Upload: No authenticated user found, using dummy ID. Secure this for production.");
    // return 'dummy-user-id-for-testing-only'; 
    return null; // More secure default: disallow if no user.
}


export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  // Basic auth check (replace with robust verification)
  const userId = await getCurrentUserId(); // Use your server-side auth check here
  if (!userId) {
      // console.log("API Upload: Unauthorized access attempt. No userId provided or resolved.");
      return NextResponse.json({ error: 'Unauthorized: User must be logged in to upload images.' }, { status: 401 });
  }
  // console.log(`API Upload: Authorized user ${userId} attempting to upload.`);


  if (!file) {
    return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
  }

  // Convert file to buffer
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Optional: Add validation for file type and size here if not handled client-side
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
  const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

  if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: `File size exceeds limit of ${MAX_FILE_SIZE_BYTES / (1024*1024)}MB.` }, { status: 413 });
  }
   if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPG, PNG, WEBP, GIF allowed.' }, { status: 415 });
  }


  try {
    // console.log(`API Upload: Uploading file for user ${userId}. File: ${file.name}, Type: ${file.type}, Size: ${file.size}`);
    // Upload the file to Cloudinary
    const uploadResult = await new Promise<UploadApiResponse | undefined>((resolve, reject) => {
      cloudinaryApi.uploader.upload_stream( // Use aliased cloudinaryApi
        {
          folder: `server_assets/${userId}`, 
          resource_type: 'image',
        },
        (error, result) => {
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
    // Return the secure URL of the uploaded image
    return NextResponse.json({ url: uploadResult.secure_url }, { status: 200 });

  } catch (error) {
    console.error('Error uploading to Cloudinary (API Route):', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload image.';
    return NextResponse.json({ error: `Upload failed: ${errorMessage}` }, { status: 500 });
  }
}

