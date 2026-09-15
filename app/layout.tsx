import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Client Progress Dashboard",
  description: "Live project progress, powered by the onboarding checklist.",
};

// Runs before paint to apply the saved theme (or system preference) and avoid
// a light/dark flash. Kept as a plain inline script since it must run before
// React hydrates and before Tailwind's dark: classes are evaluated.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
