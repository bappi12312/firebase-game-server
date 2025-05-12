import { NextResponse, type NextRequest } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { auth } from '@/lib/firebase'; // Assuming Firebase auth for user checks
import { onAuthStateChanged } from 'firebase/auth';

// Configure Cloudinary
cloudinary.config({
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
    return 'dummy-user-id'; // Replace with actual server-side auth check if available
}


export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  // Basic auth check (replace with robust verification)
  const userId = await getCurrentUserId(); // Use your server-side auth check here
  if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: User must be logged in.' }, { status: 401 });
  }


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
    // Upload the file to Cloudinary
    const uploadResult = await new Promise<cloudinary.UploadApiResponse | undefined>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          // Optional: specify folder, tags, etc.
          folder: `server_assets/${userId}`, // Store uploads in user-specific folders
          // public_id: `unique_filename`, // Optional: define a unique name
          resource_type: 'image',
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      ).end(buffer);
    });

    if (!uploadResult) {
      throw new Error('Cloudinary upload failed, no result returned.');
    }

    // Return the secure URL of the uploaded image
    return NextResponse.json({ url: uploadResult.secure_url }, { status: 200 });

  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    // Provide a more specific error message if possible
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload image.';
    return NextResponse.json({ error: `Upload failed: ${errorMessage}` }, { status: 500 });
  }
}
