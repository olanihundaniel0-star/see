import { Component, type ErrorInfo, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { AppText, Button } from "@/components/ui/primitives";
import { theme } from "@/constants/theme";
type Props = { children: ReactNode; fallback?: (error: Error, reset: () => void) => ReactNode };
type State = { error: Error | null };
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("SEE screen error", error, info); }
  resetError = () => this.setState({ error: null });
  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state.error, this.resetError);
    return <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 24, paddingTop: 80 }}>
      <ScrollView contentContainerStyle={{ gap: 16 }}>
        <AppText variant="title">Something went wrong</AppText>
        <AppText muted>Try opening this screen again. Your saved work is safe.</AppText>
        {__DEV__ ? <AppText variant="code" danger selectable>{this.state.error.message}</AppText> : null}
        <Button label="Try again" onPress={this.resetError} />
      </ScrollView>
    </View>;
  }
}
