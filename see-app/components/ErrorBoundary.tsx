import React, { Component, ErrorInfo, ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  resetError = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.setState({
      hasError: false,
      error: null
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      return (
        <View className="flex-1 bg-black px-4 pt-20">
          <ScrollView>
            <View className="gap-4">
              <View className="gap-2">
                <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">
                  // ERROR_BOUNDARY
                </Text>
                <Text className="text-2xl font-bold text-white">
                  Something went wrong
                </Text>
                <Text className="font-mono text-sm text-zinc-400">
                  The application encountered an unexpected error. Please try
                  again.
                </Text>
              </View>

              <View className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-4">
                <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">
                  ERROR_MESSAGE
                </Text>
                <Text className="mt-2 font-mono text-xs text-red-400">
                  {this.state.error.message}
                </Text>
              </View>

              {__DEV__ && this.state.error.stack && (
                <View className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-4">
                  <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">
                    STACK_TRACE
                  </Text>
                  <ScrollView horizontal className="mt-2">
                    <Text className="font-mono text-[10px] text-zinc-400">
                      {this.state.error.stack}
                    </Text>
                  </ScrollView>
                </View>
              )}

              <Pressable
                onPress={this.resetError}
                className="mt-4 rounded-xl border border-white/20 bg-white px-4 py-4 active:scale-[0.99]"
              >
                <Text className="text-center font-mono text-[10px] font-bold text-black">
                  [ RESET -&gt; RETRY ]
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}
