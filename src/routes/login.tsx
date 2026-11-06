import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient, authEnabled, googleSignInAvailable, signInWithGoogle } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Read after mount so the server render and first client render match.
  const [google, setGoogle] = useState(false);
  const [googleError, setGoogleError] = useState(false);
  useEffect(() => {
    setGoogle(googleSignInAvailable());
    setGoogleError(new URLSearchParams(window.location.search).get("error") === "google");
  }, []);

  if (!isPending && user) return <Navigate to="/" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "up") {
        const res = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
        });
        if (res.error) throw new Error(res.error.message || "Could not create the account.");
      } else {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message || "Could not sign in.");
      }
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  };

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink px-5 py-10 text-paper">
      <img
        src="/chars/enma.webp"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/80 to-ink/40" />
      <div className="relative w-full max-w-sm rounded-lg border border-line bg-ink-2/90 p-6">
        <p className="font-body text-[0.62rem] tracking-[0.28em] text-mist uppercase">GANRYŪ</p>
        <h1 className="mt-1 font-display text-3xl tracking-[0.12em]">
          {mode === "in" ? "Return to the ring" : "Take a name"}
        </h1>
        <p className="mt-2 text-sm text-paper-dim">
          Progress is kept to your account — fighter, fold, and the cuts you have already made.
        </p>
        {authEnabled ? (
          <>
            <form className="mt-5 grid gap-3" onSubmit={(e) => void submit(e)}>
              {mode === "up" && (
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  autoComplete="nickname"
                />
              )}
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                required
              />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                minLength={8}
                required
              />
              {(error || googleError) && (
                <p className="text-sm text-blood">{error || "Google sign-in did not complete. Try again or use email."}</p>
              )}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Working…" : mode === "in" ? "Sign in" : "Create account"}
              </Button>
            </form>
            <button
              type="button"
              className="mt-3 w-full text-center font-body text-xs tracking-[0.14em] text-mist uppercase hover:text-paper"
              onClick={() => setMode(mode === "in" ? "up" : "in")}
            >
              {mode === "in" ? "Need an account" : "Already have an account"}
            </button>
            {google && (
              <div className="mt-5 grid gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setBusy(true);
                    signInWithGoogle("/").catch((err) => {
                      setError(err instanceof Error ? err.message : "Google sign-in failed.");
                      setBusy(false);
                    });
                  }}
                >
                  Continue with Google
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="mt-4 text-sm text-mist">Sign-in is disabled.</p>
        )}
        <Link
          to="/"
          className="mt-5 block text-center font-body text-xs tracking-[0.18em] text-mist uppercase hover:text-paper"
        >
          Play as guest
        </Link>
      </div>
    </main>
  );
}
