import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Terra<span style={{ color: "#8ed1df" }}>Lot</span></h1>
        <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>Investor Portal</p>
        <SignIn forceRedirectUrl="/investor" />
      </div>
    </div>
  );
}
