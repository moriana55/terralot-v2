import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";

// Bkz. sign-in: placeholder Clerk (gate modu) durumunda ClerkProvider yok →
// Clerk component'i çöker. O modda gate'e yönlendir.
const CLERK_ENABLED = !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes("cGxhY2Vob2xkZXI");

export default function SignUpPage() {
  if (!CLERK_ENABLED) redirect("/gate?next=/investor");
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
