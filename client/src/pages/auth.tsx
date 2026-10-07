import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Auth() {
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await apiRequest(
        "POST",
        "/api/auth/request-code",
        { email }
      );

      const data = await response.json();

      setCodeSent(true);
      setMessage(
        data.message || "A sign-in code was sent to your email."
      );
    } catch (err: any) {
      setError(
        err?.message?.replace(/^\d+:\s*/, "") ||
          "Unable to send sign-in code."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      await apiRequest(
        "POST",
        "/api/auth/verify-code",
        { email, code }
      );

      await queryClient.invalidateQueries({
        queryKey: ["/api/auth/user"],
      });

      setLocation("/");
      window.location.reload();
    } catch (err: any) {
      setError(
        err?.message?.replace(/^\d+:\s*/, "") ||
          "Unable to verify sign-in code."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img
            src="/logo.png"
            alt="Daily Felix"
            className="h-14 w-auto object-contain mx-auto mb-3"
          />

          <CardTitle>Sign in to Daily Felix</CardTitle>

          <CardDescription>
            {codeSent
              ? "Enter the 6-digit code sent to your email."
              : "Enter your email to sign in or register."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!codeSent ? (
            <form onSubmit={requestCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>

                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Sending..."
                  : "Send sign-in code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Sign-in code</Label>

                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) =>
                    setCode(
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6)
                    )
                  }
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || code.length !== 6}
              >
                {isSubmitting
                  ? "Signing in..."
                  : "Sign in"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setCodeSent(false);
                  setCode("");
                  setMessage("");
                  setError("");
                }}
              >
                Use a different email
              </Button>
            </form>
          )}

          {message && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              {message}
            </p>
          )}

          {error && (
            <p className="mt-4 text-sm text-destructive text-center">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
