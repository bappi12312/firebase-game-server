
'use client';

import { useEffect, useState, useTransition } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { submitServerAction, type SubmitServerFormState } from '@/lib/actions';
import { serverFormSchema } from '@/lib/schemas';
import type { Game } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle, UploadCloud, ArrowLeft, CheckCircle, XCircle, ImageUp } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';

type ServerFormValues = z.infer<typeof serverFormSchema>;

interface ServerSubmissionFormProps {
  games: Game[];
}

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];


export function ServerSubmissionForm({ games }: ServerSubmissionFormProps) {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const initialState: SubmitServerFormState = { message: '', error: false, serverId: null };
  const [currentFormActionState, formAction] = useActionState(submitServerAction, initialState);
  const [isSubmittingForm, startSubmitTransition] = useTransition();

  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: {
      name: '',
      ipAddress: '',
      port: 25565,
      game: '',
      description: '',
      bannerUrl: '',
      logoUrl: '',
      tags: '',
    },
  });

  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const handleApiFileUpload = async (
    file: File,
    type: 'banner' | 'logo',
    setPreviewState: React.Dispatch<React.SetStateAction<string | null>>,
    setIsUploadingState: React.Dispatch<React.SetStateAction<boolean>>,
    formFieldName: 'bannerUrl' | 'logoUrl'
  ) => {
    console.log(`[Upload] Initiating ${type} upload via API. File: ${file.name}, Size: ${file.size} bytes`);

    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in to upload files.", variant: "destructive" });
      setIsUploadingState(false);
      return;
    }

    // Client-side validation (optional, but good practice)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({ title: "File too large", description: `Max file size is ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / (1024*1024)).toFixed(2)}MB.`, variant: "destructive"});
      setIsUploadingState(false);
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast({ title: "Invalid file type", description: `File type "${file.type}" is not supported. Only JPG, PNG, WEBP, GIF are allowed.`, variant: "destructive"});
      setIsUploadingState(false);
      return;
    }

    console.log(`[Upload] Starting ${type}. Setting isUploadingState to true.`);
    setIsUploadingState(true);
    const objectURL = URL.createObjectURL(file);
    setPreviewState(objectURL);

    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log(`[Upload] Sending POST request to /api/upload for ${type}.`);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        // Include authorization header if your API route requires it
        // headers: { 'Authorization': `Bearer ${await user.getIdToken()}` }
      });

      console.log(`[Upload] Received response for ${type} upload. Status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from API.' }));
        throw new Error(errorData?.error || `Upload failed with status ${response.status}`);
      }

      const result = await response.json();
      const downloadURL = result.url;

      if (!downloadURL || typeof downloadURL !== 'string') {
         throw new Error('Invalid URL received from upload API.');
      }

      console.log(`[Upload] Success for ${type}. URL: ${downloadURL}. Setting form value and showing toast.`);
      form.setValue(formFieldName, downloadURL, { shouldValidate: true });
      toast({ title: `${type.charAt(0).toUpperCase() + type.slice(1)} Uploaded`, description: "Image ready for submission." });

    } catch (error: any) {
      console.error(`[Upload] API Upload Error for ${type}:`, error.message, error);
      toast({ title: `Failed to Upload ${type.charAt(0).toUpperCase() + type.slice(1)}`, description: error.message || 'An unknown error occurred during upload.', variant: "destructive" });
      form.setValue(formFieldName, '', { shouldValidate: true });
      setPreviewState(null);
      if (objectURL) {
        console.log(`[Upload] Revoking objectURL for ${type} due to error: ${objectURL}`);
        URL.revokeObjectURL(objectURL);
      }
    } finally {
      console.log(`[Upload] Finally for ${type}. Setting isUploadingState to false.`);
      setIsUploadingState(false);
    }
  };


  const handleFormSubmit = (data: ServerFormValues) => {
    if (!user?.uid) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to submit a server.",
        variant: "destructive"
      });
      return;
    }
    if (isUploadingBanner || isUploadingLogo) {
        toast({
            title: "Upload in Progress",
            description: "Please wait for image uploads to complete before submitting.",
            variant: "default"
        });
        return;
    }

    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
       if (value !== undefined && value !== null && value !== '') {
        formData.append(key, String(value));
      }
    });
    formData.append('userId', user.uid);

    startSubmitTransition(() => {
        formAction(formData);
    });
  };

  useEffect(() => {
    if (currentFormActionState?.message) {
      if (currentFormActionState.error) {
        toast({
          title: 'Submission Failed',
          description: currentFormActionState.message || 'Please check the form for errors.',
          variant: 'destructive',
          duration: 5000,
        });
        if (currentFormActionState.errors) {
          currentFormActionState.errors.forEach(err => {
             // Check if path exists and is an array or string before trying to set error
             if (err.path) {
                 const pathKey = Array.isArray(err.path) ? err.path.join('.') : err.path;
                 // Ensure the pathKey is a valid key of ServerFormValues before setting error
                 if (pathKey in form.getValues()) {
                    form.setError(pathKey as keyof ServerFormValues, { message: err.message });
                 } else {
                    console.warn(`Attempted to set error on invalid path: ${pathKey}`);
                 }
            }
          });
        }
      } else {
        toast({
          title: 'Submission Successful!',
          description: currentFormActionState.message || 'Server submitted for review.',
          duration: 5000,
        });
        form.reset();
        if (bannerPreview) {
            console.log("[ServerSubmissionForm] Revoking bannerPreview ObjectURL on successful form submission:", bannerPreview);
            URL.revokeObjectURL(bannerPreview);
        }
        if (logoPreview) {
            console.log("[ServerSubmissionForm] Revoking logoPreview ObjectURL on successful form submission:", logoPreview);
            URL.revokeObjectURL(logoPreview);
        }
        setBannerPreview(null);
        setLogoPreview(null);
        if (currentFormActionState.serverId && !currentFormActionState.error) {
          router.push(`/dashboard?submissionSuccess=true&serverId=${currentFormActionState.serverId}`);
        } else if (!currentFormActionState.error) {
            router.push('/dashboard?submissionSuccess=true');
        }
      }
    }
  }, [currentFormActionState, toast, form, router, bannerPreview, logoPreview]);


  if (authLoading) {
    return (
      <Card className="max-w-2xl mx-auto my-8">
        <CardHeader>
          <Button onClick={() => router.back()} variant="outline" size="sm" className="mb-4 self-start">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
            </Button>
          <CardTitle className="text-2xl">Submit Your Server</CardTitle>
          <CardDescription>Loading authentication status...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="max-w-2xl mx-auto my-8">
        <CardHeader>
          <Button onClick={() => router.back()} variant="outline" size="sm" className="mb-4 self-start">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
            </Button>
          <CardTitle className="text-2xl">Submit Your Server</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <p className="text-lg font-medium mb-2">Authentication Required</p>
          <p className="text-muted-foreground mb-4">
            You need to be logged in to submit a server.
          </p>
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/login?redirect=/servers/submit">Login to Continue</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="max-w-2xl mx-auto my-8">
      <CardHeader>
        <Button onClick={() => router.back()} variant="outline" size="sm" className="mb-4 self-start">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
        </Button>
        <CardTitle className="text-2xl">Submit Your Server</CardTitle>
        <CardDescription>Fill in the details below to list your server on ServerSpotlight.</CardDescription>
      </CardHeader>
      <CardContent>
         <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Server Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Awesome Server" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                control={form.control}
                name="ipAddress"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>IP Address or Domain</FormLabel>
                    <FormControl>
                        <Input placeholder="play.example.com or 123.45.67.89" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Port</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="25565" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <FormField
              control={form.control}
              name="game"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Game</FormLabel>
                  <Controller
                    name="game"
                    control={form.control}
                    render={({ field: controllerField }) => (
                        <Select
                            onValueChange={controllerField.onChange}
                            value={controllerField.value}
                            name={controllerField.name}
                        >
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a game" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {games.map((game) => (
                                <SelectItem key={game.id} value={game.name}>
                                {game.name}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                    )}
                    />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="A brief description of your server (max 1000 characters)." className="min-h-[120px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel htmlFor="banner-upload">Banner Image (Optional)</FormLabel>
              <FormControl>
                <Input
                  id="banner-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        handleApiFileUpload(file, 'banner', setBannerPreview, setIsUploadingBanner, 'bannerUrl');
                    }
                    e.target.value = '';
                  }}
                  disabled={isUploadingBanner}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
              </FormControl>
              {isUploadingBanner && <div className="flex items-center text-sm text-muted-foreground mt-2"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading banner...</div>}
              {bannerPreview && !isUploadingBanner && form.getValues("bannerUrl") && <div className="flex items-center text-sm text-green-600 mt-2"><CheckCircle className="mr-2 h-4 w-4" /> Banner uploaded.</div>}
              {bannerPreview && <img src={bannerPreview} alt="Banner preview" data-ai-hint="game screenshot" className="mt-2 max-h-40 w-full object-contain rounded-md border" />}
              {!bannerPreview && !isUploadingBanner && <div className="mt-2 p-4 border-dashed border-2 rounded-md flex flex-col items-center justify-center h-32 bg-muted/50"><ImageUp className="h-8 w-8 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Banner Preview</p></div> }
              <FormDescription>Recommended size: 800x200px. Max 5MB. (JPG, PNG, WEBP, GIF)</FormDescription>
              <FormMessage>{form.formState.errors.bannerUrl?.message}</FormMessage>
            </FormItem>

            <FormItem>
              <FormLabel htmlFor="logo-upload">Logo Image (Optional)</FormLabel>
              <FormControl>
                  <Input
                    id="logo-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                           handleApiFileUpload(file, 'logo', setLogoPreview, setIsUploadingLogo, 'logoUrl');
                        }
                        e.target.value = '';
                    }}
                    disabled={isUploadingLogo}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
              </FormControl>
              {isUploadingLogo && <div className="flex items-center text-sm text-muted-foreground mt-2"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading logo...</div>}
              {logoPreview && !isUploadingLogo && form.getValues("logoUrl") && <div className="flex items-center text-sm text-green-600 mt-2"><CheckCircle className="mr-2 h-4 w-4" /> Logo uploaded.</div>}
              {logoPreview && <img src={logoPreview} alt="Logo preview" data-ai-hint="square logo" className="mt-2 h-24 w-24 object-contain rounded-md border" />}
              {!logoPreview && !isUploadingLogo && <div className="mt-2 p-4 border-dashed border-2 rounded-md flex flex-col items-center justify-center h-24 w-24 bg-muted/50"><ImageUp className="h-6 w-6 text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">Logo Preview</p></div> }
              <FormDescription>Recommended size: 100x100px. Max 5MB. (JPG, PNG, WEBP, GIF)</FormDescription>
              <FormMessage>{form.formState.errors.logoUrl?.message}</FormMessage>
            </FormItem>

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="PvP, Survival, Minigames (comma-separated)" {...field} />
                  </FormControl>
                  <FormDescription>Comma-separated list of tags (e.g., RPG, PvP, Economy). Max 5 tags, 20 chars each.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end pt-2">
                <Button type="submit" className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground"
                        disabled={isSubmittingForm || isUploadingBanner || isUploadingLogo}>
                   {(isSubmittingForm || isUploadingBanner || isUploadingLogo) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                   {isSubmittingForm ? 'Submitting...' : (isUploadingBanner || isUploadingLogo) ? 'Uploading...' : 'Submit Server'}
                </Button>
            </div>
            </form>
        </Form>
      </CardContent>
    </Card>
  );
}

