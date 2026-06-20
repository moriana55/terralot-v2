import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";

// Clerk yalnızca gerçek anahtar varken kullanılır. Placeholder anahtar (gate
// modu) durumunda <ClerkProvider> render edilmez; bu yüzden Clerk component'leri
// (useSession) çöker. O modda kullanıcıyı admin gate'ine yönlendiririz.
const CLERK_ENABLED = !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes("cGxhY2Vob2xkZXI");

export default function SignInPage() {
  if (!CLERK_ENABLED) redirect("/gate?next=/investor");
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
