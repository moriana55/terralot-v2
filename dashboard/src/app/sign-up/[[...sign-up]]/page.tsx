import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Terra<span style={{ color: "#8ed1df" }}>Lot</span></h1>
        <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>Create your account</p>
        <SignUp forceRedirectUrl="/investor" />
      </div>
    </div>
  );
}
