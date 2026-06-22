import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // This is what would otherwise be a silent black screen.
    // Logging here at minimum gets it into device logs / Xcode console.
    console.error('App crashed:', error, errorInfo);
    this.setState({ errorInfo: errorInfo.componentStack || null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>{this.state.error?.message}</Text>
            <Text style={styles.stack}>{this.state.error?.stack}</Text>
            {this.state.errorInfo && (
              <Text style={styles.stack}>{this.state.errorInfo}</Text>
            )}
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', paddingTop: 60 },
  scroll: { padding: 16 },
  title: { color: '#EF4444', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  message: { color: '#F9FAFB', fontSize: 14, marginBottom: 12 },
  stack: { color: '#9CA3AF', fontSize: 11, fontFamily: 'monospace' },
});
