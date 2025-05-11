
import { RegistrationForm } from '@/components/auth/RegisterForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

// export const metadata = { // metadata needs to be in layout for client components
//     title: 'Register - ServerSpotlight',
//     description: 'Create a new ServerSpotlight account.',
// };

export default function RegisterPage() {
  // useEffect to set title can be added here if needed, or rely on AuthLayout metadata
  return (
    <div className="flex justify-center items-center w-full py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create an Account</CardTitle>
          <CardDescription>Join ServerSpotlight to submit and vote for servers.</CardDescription>
        </CardHeader>
        <CardContent>
          <RegistrationForm />
           <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
