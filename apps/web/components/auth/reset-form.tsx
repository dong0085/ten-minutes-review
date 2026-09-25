"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { Button } from "@tmr/ui/components/button";
import { Card, CardContent } from "@tmr/ui/components/card";
import { Input } from "@tmr/ui/components/input";
import { Label } from "@tmr/ui/components/label";

export function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (response.ok) {
        setDone(true);
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "This reset link is invalid or has expired.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardContent className="space-y-3">
          <Alert variant="success">
            <AlertDescription>Your password has been updated.</AlertDescription>
          </Alert>
          <Link className="text-sm font-medium underline" href="/signin">
            Sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="reset-password">New password</Label>
            <Input
              id="reset-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="reset-confirm">Confirm password</Label>
            <Input
              id="reset-confirm"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving..." : "Set new password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
