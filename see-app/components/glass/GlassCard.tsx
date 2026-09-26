import { ReactNode } from "react";
import { View, type ViewProps } from "react-native";

type GlassCardProps = ViewProps & {
  children: ReactNode;
  /** "default" keeps legacy bg-zinc-950/60. "blur" uses blur-friendly rgba(18,18,20,0.55). */
  variant?: "default" | "blur";
};

export function GlassCard({ children, variant = "default", className = "", style, ...props }: GlassCardProps) {
  const bg = variant === "blur" ? "bg-[rgba(18,18,20,0.55)]" : "bg-zinc-950/60";
  return (
    <View
      className={`rounded-lg border border-white/[0.08] ${bg} px-4 py-4 shadow-glass backdrop-blur-xl ${className}`}
      style={[{ borderTopColor: "rgba(255, 255, 255, 0.20)" }, style]}
      {...props}
    >
      {children}
    </View>
  );
}
