import { ReactNode } from "react";
import { View, type ViewProps } from "react-native";

type GlassCardProps = ViewProps & {
  children: ReactNode;
};

export function GlassCard({ children, className = "", ...props }: GlassCardProps) {
  return (
    <View
      className={`rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-4 shadow-glass backdrop-blur-xl ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
